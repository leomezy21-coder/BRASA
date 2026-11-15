"""
BRASA — API Backend (FastAPI)
==============================
Sirve los datos de incendios históricos de Ecuador desde SQLite.

Uso:
    cd backend
    uvicorn main:app --reload --port 8000

Endpoints implementados (match exacto con src/api/client.ts):
    GET  /api/regions
    POST /api/calendar
    POST /api/climatology
    POST /api/season
    POST /api/anomalies
    POST /api/hotspots
    POST /api/current-status
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────
DB_PATH = Path(__file__).parent / "brasa.db"
app = FastAPI(title="BRASA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Modelos de entrada (match con BaseFilterParams en types.ts)
# ─────────────────────────────────────────────

class BaseFilter(BaseModel):
    year_from: int = 2001
    year_to: int = 2025
    sensor: str = "harmonized"       # 'harmonized' | 'modis' | 'viirs'
    confidence: str = "all"          # 'all' | 'nominal_high'
    daynight: str = "all"            # 'all' | 'D' | 'N'
    province_id: Optional[str] = None
    canton_id: Optional[str] = None
    geojson: Optional[dict] = None   # ignorado por ahora (usar province/canton)

class HotspotFilter(BaseFilter):
    year: Optional[int] = None
    week: Optional[int] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None


# ─────────────────────────────────────────────
# Regiones estáticas de Ecuador (provincias del mock)
# ─────────────────────────────────────────────
REGIONS = [
    {"id": "chimborazo", "name": "Chimborazo", "center": [-1.6709, -78.6545], "zoom": 10,
     "geojson": {"type": "Polygon", "coordinates": [[[-78.50,-1.35],[-78.35,-1.60],[-78.40,-1.95],[-78.60,-2.35],[-78.95,-2.40],[-79.15,-2.10],[-79.00,-1.70],[-78.80,-1.40],[-78.50,-1.35]]]},
     "cantons": [
         {"id": "riobamba","name": "Riobamba","lat": -1.6709,"lon": -78.6545},
         {"id": "guano","name": "Guano","lat": -1.6033,"lon": -78.6322},
         {"id": "colta","name": "Colta","lat": -1.7167,"lon": -78.7500},
         {"id": "alausi","name": "Alausí","lat": -2.2000,"lon": -78.8500},
         {"id": "guamote","name": "Guamote","lat": -1.9333,"lon": -78.7167},
         {"id": "chambo","name": "Chambo","lat": -1.7000,"lon": -78.5833},
         {"id": "pallatanga","name": "Pallatanga","lat": -2.0000,"lon": -78.9667},
     ]},
    {"id": "pichincha", "name": "Pichincha", "center": [-0.2298, -78.5249], "zoom": 10,
     "geojson": {"type": "Polygon", "coordinates": [[[-78.70,0.25],[-78.20,0.15],[-78.10,-0.30],[-78.35,-0.65],[-78.75,-0.60],[-79.05,-0.15],[-78.70,0.25]]]},
     "cantons": [
         {"id": "quito","name": "Quito","lat": -0.2298,"lon": -78.5249},
         {"id": "cayambe","name": "Cayambe","lat": 0.0417,"lon": -78.1453},
         {"id": "mejia","name": "Mejía (Machachi)","lat": -0.5100,"lon": -78.5667},
         {"id": "ruminahui","name": "Rumiñahui (Sangolquí)","lat": -0.3333,"lon": -78.4500},
     ]},
    {"id": "guayas", "name": "Guayas", "center": [-2.1894, -79.8891], "zoom": 9,
     "geojson": {"type": "Polygon", "coordinates": [[[-79.90,-1.30],[-79.40,-1.80],[-79.45,-2.70],[-80.10,-2.85],[-80.45,-2.30],[-80.20,-1.60],[-79.90,-1.30]]]},
     "cantons": [
         {"id": "guayaquil","name": "Guayaquil","lat": -2.1894,"lon": -79.8891},
         {"id": "samborondon","name": "Samborondón","lat": -2.1400,"lon": -79.7200},
         {"id": "daule","name": "Daule","lat": -1.8600,"lon": -79.9800},
         {"id": "milagro","name": "Milagro","lat": -2.1333,"lon": -79.5833},
     ]},
    {"id": "azuay", "name": "Azuay", "center": [-2.9001, -79.0059], "zoom": 10,
     "geojson": {"type": "Polygon", "coordinates": [[[-79.10,-2.60],[-78.60,-2.75],[-78.70,-3.40],[-79.35,-3.35],[-79.50,-2.80],[-79.10,-2.60]]]},
     "cantons": [
         {"id": "cuenca","name": "Cuenca","lat": -2.9001,"lon": -79.0059},
         {"id": "gualaceo","name": "Gualaceo","lat": -2.8900,"lon": -78.7800},
         {"id": "paute","name": "Paute","lat": -2.7800,"lon": -78.7600},
     ]},
    {"id": "loja", "name": "Loja", "center": [-3.9931, -79.2042], "zoom": 9,
     "geojson": {"type": "Polygon", "coordinates": [[[-79.25,-3.50],[-78.90,-3.90],[-79.10,-4.60],[-79.70,-4.50],[-80.00,-4.00],[-79.50,-3.60],[-79.25,-3.50]]]},
     "cantons": [
         {"id": "loja","name": "Loja","lat": -3.9931,"lon": -79.2042},
         {"id": "catamayo","name": "Catamayo","lat": -3.9800,"lon": -79.3500},
         {"id": "calvas","name": "Calvas (Cariamanga)","lat": -4.3200,"lon": -79.5500},
     ]},
    {"id": "imbabura", "name": "Imbabura", "center": [0.3517, -78.1223], "zoom": 10,
     "geojson": {"type": "Polygon", "coordinates": [[[-78.15,0.70],[-77.85,0.40],[-78.10,0.15],[-78.55,0.20],[-78.60,0.60],[-78.15,0.70]]]},
     "cantons": [
         {"id": "ibarra","name": "Ibarra","lat": 0.3517,"lon": -78.1223},
         {"id": "otavalo","name": "Otavalo","lat": 0.2333,"lon": -78.2667},
         {"id": "cotacachi","name": "Cotacachi","lat": 0.3000,"lon": -78.2667},
     ]},
    {"id": "manabi", "name": "Manabí", "center": [-1.0546, -80.4544], "zoom": 9,
     "geojson": {"type": "Polygon", "coordinates": [[[-80.10,0.20],[-79.80,-0.60],[-80.20,-1.80],[-80.80,-1.60],[-80.70,-0.30],[-80.10,0.20]]]},
     "cantons": [
         {"id": "portoviejo","name": "Portoviejo","lat": -1.0546,"lon": -80.4544},
         {"id": "manta","name": "Manta","lat": -0.9677,"lon": -80.7089},
         {"id": "chone","name": "Chone","lat": -0.6981,"lon": -80.0936},
     ]},
]


# ─────────────────────────────────────────────
# Helpers de BD
# ─────────────────────────────────────────────

def get_conn():
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="Base de datos no encontrada. Ejecuta 'python ingest.py' primero."
        )
    return sqlite3.connect(DB_PATH)


def build_where(params: BaseFilter, alias: str = "") -> tuple[str, list]:
    """Construye cláusula WHERE y lista de parámetros según filtros."""
    p = alias + "." if alias else ""
    clauses = [f"{p}year BETWEEN ? AND ?"]
    values: list = [params.year_from, params.year_to]

    # Sensor
    if params.sensor == "modis":
        clauses.append(f"{p}sensor = 'MODIS'")
    elif params.sensor == "viirs":
        clauses.append(f"({p}sensor = 'VIIRS' OR {p}sensor LIKE 'VIIRS%')")
    # 'harmonized' = todos

    # Confianza
    if params.confidence == "nominal_high":
        clauses.append(f"{p}confidence IN ('h', 'n')")

    # Día/Noche
    if params.daynight in ("D", "N"):
        clauses.append(f"{p}daynight = ?")
        values.append(params.daynight)

    # Geografía
    if params.canton_id:
        clauses.append(f"{p}canton_id = ?")
        values.append(params.canton_id)
    elif params.province_id:
        clauses.append(f"{p}province_id = ?")
        values.append(params.province_id)

    return " AND ".join(clauses), values


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/api/regions")
def get_regions():
    """Devuelve la lista de provincias/regiones con sus cantones y GeoJSON."""
    return REGIONS


@app.post("/api/hotspots")
def get_hotspots(params: HotspotFilter):
    """Focos de calor individuales para un año y semana específicos."""
    conn = get_conn()
    where, vals = build_where(params)

    # Filtrar por año/semana específicos si vienen en params
    if params.year is not None:
        where += " AND year = ?"
        vals.append(params.year)
    if params.week is not None:
        where += " AND week = ?"
        vals.append(params.week)
    if params.date_from:
        where += " AND date >= ?"
        vals.append(params.date_from)
    if params.date_to:
        where += " AND date <= ?"
        vals.append(params.date_to)

    query = f"SELECT lat, lon, date, frp, sensor FROM hotspots WHERE {where} LIMIT 5000"
    df = pd.read_sql_query(query, conn, params=vals)
    conn.close()
    return {"points": df.to_dict(orient="records")}


@app.post("/api/calendar")
def get_calendar(params: BaseFilter):
    """Actividad semanal agregada (fire_cell_days) por año y semana."""
    conn = get_conn()
    where, vals = build_where(params)
    query = f"""
        SELECT year, week, COUNT(*) as value,
               CASE
                 WHEN MAX(year) < 2012 THEN 'MODIS'
                 WHEN MAX(year) <= 2018 THEN 'BOTH'
                 ELSE 'VIIRS_CAL'
               END as source
        FROM hotspots
        WHERE {where}
        GROUP BY year, week
        ORDER BY year, week
    """
    df = pd.read_sql_query(query, conn, params=vals)
    conn.close()

    # Rellenar semanas sin actividad con 0
    all_weeks = []
    for y in range(params.year_from, params.year_to + 1):
        for w in range(1, 53):
            row = df[(df["year"] == y) & (df["week"] == w)]
            if not row.empty:
                all_weeks.append({
                    "year": y, "week": w,
                    "value": float(row.iloc[0]["value"]),
                    "source": row.iloc[0]["source"]
                })
            else:
                # Determinar source por año
                src = "MODIS" if y < 2012 else ("BOTH" if y <= 2018 else "VIIRS_CAL")
                all_weeks.append({"year": y, "week": w, "value": 0.0, "source": src})

    return {"unit": "fire_cell_days", "weeks": all_weeks}


@app.post("/api/climatology")
def get_climatology(params: BaseFilter):
    """Estadísticas climatológicas (media, p10, p50, p90) por semana del año."""
    conn = get_conn()
    where, vals = build_where(params)

    # Usar todo el histórico para climatología (2001–2025)
    query = f"""
        SELECT week, year, COUNT(*) as cnt
        FROM hotspots
        WHERE {where}
        GROUP BY year, week
        ORDER BY week, year
    """
    df = pd.read_sql_query(query, conn, params=vals)
    conn.close()

    result = []
    for w in range(1, 53):
        week_data = df[df["week"] == w]["cnt"].values
        if len(week_data) == 0:
            result.append({"week": w, "mean": 0.0, "p10": 0.0, "p50": 0.0, "p90": 0.0})
        else:
            result.append({
                "week": w,
                "mean": round(float(np.mean(week_data)), 1),
                "p10":  round(float(np.percentile(week_data, 10)), 1),
                "p50":  round(float(np.percentile(week_data, 50)), 1),
                "p90":  round(float(np.percentile(week_data, 90)), 1),
            })
    return {"weeks": result}


@app.post("/api/season")
def get_season(params: BaseFilter):
    """Inicio, pico y fin de temporada de incendios por año."""
    conn = get_conn()
    where, vals = build_where(params)
    query = f"""
        SELECT year, week, COUNT(*) as cnt
        FROM hotspots
        WHERE {where}
        GROUP BY year, week
        ORDER BY year, week
    """
    df = pd.read_sql_query(query, conn, params=vals)
    conn.close()

    years_out = []
    for y in range(params.year_from, params.year_to + 1):
        ydf = df[df["year"] == y]
        if ydf.empty:
            continue

        week_vals = {row["week"]: row["cnt"] for _, row in ydf.iterrows()}
        if not week_vals:
            continue

        peak_week = max(week_vals, key=week_vals.get)
        peak_val = week_vals[peak_week]
        total = sum(week_vals.values())
        threshold = peak_val * 0.2 if peak_val > 0 else 1

        start_week = peak_week
        for w in range(1, peak_week + 1):
            if week_vals.get(w, 0) >= threshold:
                start_week = w
                break

        end_week = peak_week
        for w in range(peak_week, 53):
            if week_vals.get(w, 0) < threshold:
                end_week = w
                break

        years_out.append({
            "year": y,
            "start_week": int(start_week),
            "peak_week": int(peak_week),
            "end_week": int(end_week),
            "total": float(total),
        })

    return {"years": years_out}


@app.post("/api/anomalies")
def get_anomalies(params: BaseFilter):
    """Semanas con actividad anómalamente alta (z-score >= 1.6)."""
    conn = get_conn()
    where, vals = build_where(params)
    query = f"""
        SELECT year, week, COUNT(*) as cnt
        FROM hotspots
        WHERE {where}
        GROUP BY year, week
        ORDER BY year, week
    """
    df = pd.read_sql_query(query, conn, params=vals)
    conn.close()

    if df.empty:
        return {"items": []}

    # Calcular media y std por semana (histórico completo)
    clim = df.groupby("week")["cnt"].agg(["mean", "std"]).reset_index()
    clim.columns = ["week", "mean", "std"]
    clim["std"] = clim["std"].fillna(1.0).replace(0, 1.0)

    merged = df.merge(clim, on="week")
    merged["zscore"] = (merged["cnt"] - merged["mean"]) / merged["std"]
    merged["zscore"] = merged["zscore"].round(2)

    anomalies = merged[(merged["zscore"] >= 1.6) & (merged["cnt"] > 5)].copy()

    # Percentil aproximado usando distribución normal
    anomalies["percentile"] = anomalies["zscore"].apply(
        lambda z: round(min(99.9, (0.5 * (1 + float(np.tanh(z * 0.797885)))) * 100), 1)
    )

    anomalies = anomalies.sort_values("zscore", ascending=False)
    items = anomalies[["year", "week", "cnt", "zscore", "percentile"]].rename(
        columns={"cnt": "value"}
    ).to_dict(orient="records")

    return {"items": items}


@app.post("/api/current-status")
def get_current_status(params: BaseFilter):
    """Estado actual de la temporada (semana más reciente con datos)."""
    conn = get_conn()
    where, vals = build_where(params)

    # Encontrar el año y semana más reciente con datos
    latest_query = f"""
        SELECT year, week, COUNT(*) as cnt
        FROM hotspots
        WHERE {where}
        GROUP BY year, week
        ORDER BY year DESC, week DESC
        LIMIT 1
    """
    latest = pd.read_sql_query(latest_query, conn, params=vals)

    if latest.empty:
        conn.close()
        return {"week": 0, "value": 0.0, "percentile": 0.0, "zscore": 0.0, "level": "normal"}

    current_year = int(latest.iloc[0]["year"])
    current_week = int(latest.iloc[0]["week"])
    current_val = float(latest.iloc[0]["cnt"])

    # Histórico de esa semana para z-score
    hist_query = f"""
        SELECT year, COUNT(*) as cnt
        FROM hotspots
        WHERE {where} AND week = ?
        GROUP BY year
        ORDER BY year
    """
    hist_vals = vals + [current_week]
    hist = pd.read_sql_query(hist_query, conn, params=hist_vals)
    conn.close()

    if hist.empty or len(hist) < 2:
        return {"week": current_week, "value": current_val, "percentile": 50.0, "zscore": 0.0, "level": "normal"}

    hist_vals_arr = hist["cnt"].values
    mean = float(np.mean(hist_vals_arr))
    std = float(np.std(hist_vals_arr)) or 1.0
    zscore = round((current_val - mean) / std, 2)

    count_below = int(np.sum(hist_vals_arr <= current_val))
    percentile = round(min(99.8, (count_below / len(hist_vals_arr)) * 100), 1)

    level = "normal"
    if zscore >= 2.0 or percentile >= 90:
        level = "inusual"
    elif zscore >= 1.0 or percentile >= 70:
        level = "elevado"

    return {
        "week": current_week,
        "value": current_val,
        "percentile": percentile,
        "zscore": zscore,
        "level": level,
    }


@app.get("/health")
def health():
    return {"status": "ok", "db": DB_PATH.exists()}


# ─────────────────────────────────────────────
# Endpoints de Predicción ML (XGBoost + MODIS + ERA5)
# ─────────────────────────────────────────────

MODELS_DIR = Path(__file__).parent / "models"

@app.get("/api/prediction/geojson")
def get_prediction_geojson():
    """Retorna las 36 cuadrículas con probabilidades estimadas por XGBoost (MODIS + ERA5)."""
    geojson_path = MODELS_DIR / "prediccion_xgboost_recall_modis_era5_2019_2025.geojson"
    if not geojson_path.exists():
        # Fallback a public/data
        geojson_path = Path(__file__).parent.parent / "public" / "data" / "prediccion_xgboost_recall_modis_era5_2019_2025.geojson"
    if not geojson_path.exists():
        raise HTTPException(status_code=404, detail="Archivo GeoJSON de predicción no encontrado")
    
    import json
    with open(geojson_path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/api/prediction/metadata")
def get_prediction_metadata():
    """Retorna metadatos del modelo supervisado XGBoost y sus 14 variables."""
    meta_path = MODELS_DIR / "metadatos_xgboost_recall_modis_era5_2019_2025.json"
    if not meta_path.exists():
        meta_path = Path(__file__).parent.parent / "public" / "data" / "metadatos_xgboost_recall_modis_era5_2019_2025.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Metadatos no encontrados")
    
    import json
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)

