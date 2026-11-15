"""
BRASA — Bitácora Regional de Actividad Satelital Armonizada
NASA Space Apps Challenge 2026 — Equipo CODE RED
Backend Principal FastAPI (Multi-territorial, datos NASA FIRMS)
==============================================================
Sirve consultas históricas mundiales y regionales desde SQLite optimizado.
Permite selección por país (ISO3), continente o global, además de soporte
heredado para regiones y provincias de Ecuador.

Uso:
    uvicorn backend.main:app --reload --port 8000
    o desde backend/: uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import json
import os
import sqlite3
from datetime import date
from pathlib import Path
from statistics import mean, pstdev
from typing import Literal, Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent

# Resolución inteligente de rutas de base de datos
def resolve_db_path() -> Path:
    env_path = os.environ.get("BRASA_DB_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    for candidate in ("brasa_render.db", "brasa_mundial.db", "brasa.db"):
        p = HERE / candidate
        if p.is_file():
            return p
    return HERE / "brasa_render.db"

def resolve_map_db_path() -> Path:
    env_path = os.environ.get("BRASA_MAP_DB_PATH")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    for candidate in ("brasa_mapa.db", "brasa_mundial.db"):
        p = HERE / candidate
        if p.is_file():
            return p
    return HERE / "brasa_mapa.db"

DB = resolve_db_path()
MAP_DB = resolve_map_db_path()

app = FastAPI(
    title="BRASA NASA FIRMS API",
    description="Bitácora Regional de Actividad Satelital Armonizada — NASA Space Apps Challenge 2026",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Modelos de entrada compatibles (Frontend y Backend)
# ─────────────────────────────────────────────

class BaseFilter(BaseModel):
    year_from: int = Field(default=2001, ge=2000, le=2100)
    year_to: int = Field(default=2025, ge=2000, le=2100)
    sensor: Literal["harmonized", "modis", "viirs"] = "harmonized"
    confidence: Literal["all", "nominal_high"] = "all"
    daynight: Literal["all", "D", "N"] = "all"
    country_code: Optional[str] = None
    continent: Optional[str] = None
    # Soporte compatible para selecciones heredadas del cliente
    province_id: Optional[str] = None
    canton_id: Optional[str] = None
    bbox: Optional[tuple[float, float, float, float]] = None
    geojson: Optional[dict] = None

class HotspotFilter(BaseFilter):
    year: Optional[int] = None
    week: Optional[int] = Field(default=None, ge=1, le=53)
    date_from: Optional[str] = None
    date_to: Optional[str] = None


# Provincias históricas de Ecuador para retrocompatibilidad
ECUADOR_PROVINCES = [
    {"id": "chimborazo", "name": "Chimborazo", "lat": -1.6709, "lon": -78.6545},
    {"id": "pichincha", "name": "Pichincha", "lat": -0.2298, "lon": -78.5249},
    {"id": "guayas", "name": "Guayas", "lat": -2.1894, "lon": -79.8891},
    {"id": "azuay", "name": "Azuay", "lat": -2.9001, "lon": -79.0059},
    {"id": "loja", "name": "Loja", "lat": -3.9931, "lon": -79.2042},
    {"id": "imbabura", "name": "Imbabura", "lat": 0.3517, "lon": -78.1223},
    {"id": "manabi", "name": "Manabí", "lat": -1.0546, "lon": -80.4544},
]


def connect_summary():
    """Conexión en modo solo lectura a la base de resumen."""
    current_db = resolve_db_path()
    if not current_db.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"Base de datos de resumen no encontrada: {current_db.name}. Asegúrese de que brasa_render.db esté presente."
        )
    try:
        con = sqlite3.connect(f"file:{current_db.as_posix()}?mode=ro", uri=True, timeout=30)
        con.row_factory = sqlite3.Row
        return con
    except sqlite3.Error as exc:
        raise HTTPException(status_code=503, detail=f"Error al conectar a SQLite: {exc}")


def check_summary_ready(con):
    exists = con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='resumen_semanal'").fetchone()
    if not exists:
        raise HTTPException(
            status_code=503,
            detail="Falta la tabla 'resumen_semanal' en la base de datos. Ejecute preparar_consultas_mundiales.py."
        )


def normalize_filter(f: BaseFilter) -> tuple[str | None, str | None]:
    """
    Normaliza el país y continente. Si se envió province_id de Ecuador o un código ISO3,
    se traduce sin lanzar error 422.
    """
    country = f.country_code
    continent = f.continent

    if not country and f.province_id:
        prov = f.province_id.strip()
        # Si tiene 3 letras, es código ISO3 (ej. 'ECU', 'BRA', 'USA')
        if len(prov) == 3:
            country = prov.upper()
        elif any(p["id"] == prov.lower() for p in ECUADOR_PROVINCES):
            country = "ECU"
        else:
            country = prov.upper()

    if country:
        country = country.upper()

    return country, continent


def build_where_summary(f: BaseFilter, alias: str = "r") -> tuple[str, list]:
    if f.year_from > f.year_to:
        f.year_from, f.year_to = f.year_to, f.year_from

    country, continent = normalize_filter(f)

    w = [f"{alias}.year BETWEEN ? AND ?"]
    v = [f.year_from, f.year_to]

    if country and country != "*":
        w.append(f"{alias}.country_code = ?")
        v.append(country)
    elif continent and continent != "all":
        w.append(f"{alias}.country_code IN (SELECT country_code FROM paises_ref WHERE continent=?)")
        v.append(continent)
    else:
        # Consulta global
        w.append(f"{alias}.country_code = '*'")

    if f.sensor != "harmonized":
        w.append(f"{alias}.sensor = ?")
        v.append(f.sensor.upper())

    if f.confidence == "nominal_high":
        w.append(f"{alias}.confidence IN ('n', 'h')")

    if f.daynight in ("D", "N"):
        w.append(f"{alias}.daynight = ?")
        v.append(f.daynight)

    return " AND ".join(w), v


def get_weekly_dict(f: BaseFilter) -> dict[tuple[int, int], int]:
    with connect_summary() as con:
        check_summary_ready(con)
        where_clause, vals = build_where_summary(f)
        query = f"""
            SELECT r.year, r.week, SUM(r.n) AS n
            FROM resumen_semanal r
            WHERE {where_clause}
            GROUP BY r.year, r.week
            ORDER BY r.year, r.week
        """
        rows = con.execute(query, vals).fetchall()
    return {(int(r["year"]), int(r["week"])): int(r["n"]) for r in rows}


def get_weekly_full_dict(f: BaseFilter) -> dict[tuple[int, int], int]:
    counts = get_weekly_dict(f)
    return {
        (y, w): counts.get((y, w), 0)
        for y in range(f.year_from, f.year_to + 1)
        for w in range(1, 54)
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    db_file = resolve_db_path()
    map_file = resolve_map_db_path()
    db_exists = db_file.is_file()
    summary_ready = False
    completed_csv = 0

    if db_exists:
        try:
            with connect_summary() as con:
                summary_ready = con.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='resumen_semanal'"
                ).fetchone() is not None
                if con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='archivos_procesados'").fetchone():
                    completed_csv = con.execute(
                        "SELECT COUNT(*) FROM archivos_procesados WHERE terminado=1"
                    ).fetchone()[0]
        except Exception:
            pass

    return {
        "status": "ok" if (db_exists and summary_ready) else "parcial",
        "db": db_exists,
        "db_name": db_file.name,
        "summary_ready": summary_ready,
        "csv_completos": completed_csv,
        "map_ready": map_file.is_file(),
        "metrica": "presencia_celda_dia_sensor_1grado",
    }


@app.get("/api/metadata")
def metadata():
    return {
        "dataset": "NASA FIRMS / BRASA (Bitácora Regional de Actividad Satelital Armonizada)",
        "fuente": "NASA Fire Information for Resource Management System (FIRMS)",
        "periodo_objetivo": "2001–2025 (disponibilidad efectiva 2004–2026 en dataset preprocesado)",
        "cobertura": "Mundial (177 países de referencia, 34 archivos CSV de NASA FIRMS)",
        "sensores": {
            "MODIS": "Satélites Terra y Aqua, resolución nominal 1 km, registros desde 2000/2001",
            "VIIRS": "Satélites Suomi-NPP (desde 2012) y NOAA-20 (desde 2018), resolución nominal 375 m"
        },
        "metrica": "presencia de al menos una detección tipo 0 por celda de 1 grado, día y familia de sensor (fire_cell_days a 1°)",
        "nota_cientifica": [
            "Los píxeles individuales de MODIS (1 km) y VIIRS (375 m) tienen diferentes capacidades de detección.",
            "La métrica fire_cell_days a 1 grado unifica la presencia diaria para evitar que la mayor resolución de VIIRS multiplique artificialmente los conteos.",
            "MODIS y VIIRS se presentan diferenciados; el período de solapamiento 2012–2018 permite evaluar el comportamiento interanual.",
            "Las detecciones se clasifican exclusivamente como type=0 (fuego de vegetación), descartando fuentes térmicas industriales u offshore.",
            "Los mapas espaciales muestran centros de celdas activas con su FRP representativo."
        ]
    }


@app.get("/api/countries")
def countries():
    with connect_summary() as con:
        check_summary_ready(con)
        rows = con.execute("SELECT country_code, name, continent, lat, lon FROM paises_ref ORDER BY name").fetchall()
    return [dict(r) for r in rows]


@app.get("/api/regions")
def regions():
    """
    Devuelve las entidades territoriales en el contrato Region[] de la UI.
    Incluye los 177 países de referencia mundial y sus coordenadas geográficas.
    """
    geo_path = HERE / "geografia" / "paises_referencia.json"
    if geo_path.is_file():
        try:
            geo_data = json.loads(geo_path.read_text(encoding="utf-8"))
            regions_list = []
            for p in geo_data.get("paises", []):
                bbox = p.get("bbox", [-180, -90, 180, 90])
                center_lat = (bbox[1] + bbox[3]) / 2
                center_lon = (bbox[0] + bbox[2]) / 2

                # Para Ecuador, adjuntamos sus cantones y provincias tradicionales
                cantons_list = []
                if p["codigo"] == "ECU":
                    cantons_list = [
                        {"id": prov["id"], "name": prov["name"], "lat": prov["lat"], "lon": prov["lon"]}
                        for prov in ECUADOR_PROVINCES
                    ]

                regions_list.append({
                    "id": p["codigo"],
                    "name": p["nombre"],
                    "continent": p.get("continente", "Other"),
                    "center": [center_lat, center_lon],
                    "zoom": 5 if p["codigo"] in ("ECU", "URY", "PRY") else 4,
                    "geojson": {"type": "MultiPolygon", "coordinates": p.get("poligonos", [])},
                    "cantons": cantons_list,
                })
            return regions_list
        except Exception:
            pass

    # Fallback si el json no está disponible: leer desde paises_ref en SQLite
    with connect_summary() as con:
        check_summary_ready(con)
        rows = con.execute("SELECT country_code, name, continent, lat, lon FROM paises_ref ORDER BY name").fetchall()
        return [
            {
                "id": r["country_code"],
                "name": r["name"],
                "continent": r["continent"],
                "center": [r["lat"], r["lon"]],
                "zoom": 4,
                "geojson": None,
                "cantons": [],
            }
            for r in rows
        ]


@app.post("/api/calendar")
def calendar(f: BaseFilter):
    counts = get_weekly_full_dict(f)
    src_map = {"modis": "MODIS", "viirs": "VIIRS_CAL", "harmonized": "BOTH"}
    src = src_map[f.sensor]
    return {
        "unit": "fire_cell_days",
        "weeks": [
            {"year": y, "week": w, "value": float(n), "source": src}
            for (y, w), n in counts.items()
        ]
    }


@app.post("/api/climatology")
def climatology(f: BaseFilter):
    vals = get_weekly_full_dict(f)
    out = []
    for w in range(1, 54):
        arr = sorted(float(vals[(y, w)]) for y in range(f.year_from, f.year_to + 1))
        def percentile(p: float) -> float:
            if not arr:
                return 0.0
            k = (len(arr) - 1) * p
            lo = int(k)
            hi = min(len(arr) - 1, lo + 1)
            return round(arr[lo] + (arr[hi] - arr[lo]) * (k - lo), 1)

        mean_val = round(mean(arr), 1) if arr else 0.0
        out.append({
            "week": w,
            "mean": mean_val,
            "p10": percentile(0.1),
            "p50": percentile(0.5),
            "p90": percentile(0.9),
        })
    return {"weeks": out}


@app.post("/api/season")
def season(f: BaseFilter):
    counts = get_weekly_full_dict(f)
    years = []
    for y in range(f.year_from, f.year_to + 1):
        arr = {w: counts[(y, w)] for w in range(1, 54)}
        total = sum(arr.values())
        if total == 0:
            continue
        peak = max(arr, key=arr.get)
        threshold = arr[peak] * 0.2
        start = next((w for w in range(1, peak + 1) if arr[w] >= threshold), peak)
        end = next((w for w in range(peak, 54) if arr[w] < threshold), 53)
        years.append({
            "year": y,
            "start_week": start,
            "peak_week": peak,
            "end_week": end,
            "total": float(total)
        })
    return {"years": years}


@app.post("/api/anomalies")
def anomalies(f: BaseFilter):
    counts = get_weekly_full_dict(f)
    items = []
    for w in range(1, 54):
        arr = [counts[(y, w)] for y in range(f.year_from, f.year_to + 1)]
        av = mean(arr) if arr else 0.0
        sd = pstdev(arr) if len(arr) > 1 else 0.0
        if sd < 1e-10:
            continue
        for y, v in zip(range(f.year_from, f.year_to + 1), arr):
            z = (v - av) / sd
            if z >= 1.6 and v > 5:
                pct = round(sum(x <= v for x in arr) / len(arr) * 100, 1)
                items.append({
                    "year": y,
                    "week": w,
                    "value": float(v),
                    "zscore": round(z, 2),
                    "percentile": pct
                })
    return {"items": sorted(items, key=lambda i: i["zscore"], reverse=True)}


@app.post("/api/current-status")
def current_status(f: BaseFilter):
    counts = get_weekly_full_dict(f)
    nonzero = [(y, w, n) for (y, w), n in counts.items() if n > 0]
    if not nonzero:
        return {"week": 0, "value": 0.0, "percentile": 0.0, "zscore": 0.0, "level": "normal"}

    # Semana más reciente con datos registrados
    y, w, value = max(nonzero, key=lambda t: (t[0], t[1]))
    vals = [counts[(yr, w)] for yr in range(f.year_from, f.year_to + 1)]
    avg = mean(vals) if vals else 0.0
    sd = pstdev(vals) if len(vals) > 1 else 0.0
    z = (value - avg) / sd if sd > 0 else 0.0
    percentile = round(sum(v <= value for v in vals) / len(vals) * 100, 1) if vals else 50.0

    level = "normal"
    if z >= 2.0 or percentile >= 90.0:
        level = "inusual"
    elif z >= 1.0 or percentile >= 70.0:
        level = "elevado"

    return {
        "year": y,
        "week": w,
        "value": float(value),
        "percentile": percentile,
        "zscore": round(z, 2),
        "level": level
    }


@app.post("/api/hotspots")
def hotspots(f: HotspotFilter):
    """
    Puntos espaciales de presencia de celdas-día (1 grado) con FRP y sensor.
    Se alimenta de brasa_mapa.db (2.8M de muestras de NASA FIRMS).
    """
    map_db = resolve_map_db_path()
    if not map_db.is_file():
        raise HTTPException(
            status_code=503,
            detail="La capa espacial no está desplegada en el servidor. Ejecute descomprimir_mapa.py."
        )

    w: list[str] = []
    v: list[Any] = []

    # Filtrar por año y semana
    if f.year is not None:
        w.append("year = ?")
        v.append(f.year)
    if f.week is not None:
        w.append("week = ?")
        v.append(f.week)

    if f.date_from and f.date_to:
        w.append("date BETWEEN ? AND ?")
        v.extend([f.date_from, f.date_to])

    country, continent = normalize_filter(f)
    if country and country != "*":
        w.append("country_code = ?")
        v.append(country)
    elif continent and continent != "all":
        with connect_summary() as con:
            codes = [r[0] for r in con.execute("SELECT country_code FROM paises_ref WHERE continent=?", (continent,))]
        if codes:
            placeholders = ",".join(["?"] * len(codes))
            w.append(f"country_code IN ({placeholders})")
            v.extend(codes)

    if f.sensor != "harmonized":
        w.append("sensor = ?")
        v.append(f.sensor.upper())

    if f.confidence == "nominal_high":
        w.append("confidence IN ('n', 'h')")

    if f.daynight in ("D", "N"):
        w.append("daynight IN (?, 'B')")
        v.append(f.daynight)

    if f.bbox:
        left, bottom, right, top = f.bbox
        w.extend(["lon BETWEEN ? AND ?", "lat BETWEEN ? AND ?"])
        v.extend([left, right, bottom, top])

    where_sql = f"WHERE {' AND '.join(w)}" if w else ""
    query = f"""
        SELECT lat, lon, date, frp, sensor
        FROM mapa_muestras
        {where_sql}
        ORDER BY frp DESC, date DESC
        LIMIT 5000
    """

    try:
        with sqlite3.connect(f"file:{map_db.as_posix()}?mode=ro", uri=True, timeout=30) as con:
            rows = con.execute(query, v).fetchall()
            return {
                "points": [
                    {"lat": float(lat), "lon": float(lon), "date": d, "frp": float(frp), "sensor": s}
                    for lat, lon, d, frp, s in rows
                ],
                "sampled": True,
                "spatial_resolution_degrees": 1.0,
                "limit": 5000,
                "nota": "Muestras de presencia de celdas de 1 grado por día y sensor de NASA FIRMS."
            }
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Error consultando mapa de focos: {exc}")
