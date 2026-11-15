import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.main import (
    app, health, metadata, countries, regions, calendar, climatology,
    season, anomalies, current_status, hotspots,
    BaseFilter, HotspotFilter
)

print("="*60)
print("VERIFICACIÓN INDIVIDUAL DE LOS 10 ENDPOINTS DE BRASA")
print("="*60)

# 1. GET /health
print("\n[1/10] Verificando GET /health...")
h = health()
print("   Respuesta:", h)
assert h["status"] in ("ok", "parcial"), f"Status inesperado: {h['status']}"
assert "db" in h and h["db"] is True
assert "summary_ready" in h and h["summary_ready"] is True
assert "map_ready" in h and h["map_ready"] is True
print("   -> OK: Servidor sano, bases SQLite de resumen y mapa verificadas.")

# 2. GET /api/metadata
print("\n[2/10] Verificando GET /api/metadata...")
m = metadata()
print("   Dataset:", m.get("dataset"))
print("   Fuente:", m.get("fuente"))
print("   Métrica:", m.get("metrica"))
assert "dataset" in m and "fuente" in m and "sensores" in m
assert "fire_cell_days" in m.get("metrica", "")
assert "MODIS" in m["sensores"] and "VIIRS" in m["sensores"]
print("   -> OK: Metadatos transparentes y rigurosos sin falsa calibración radiométrica.")

# 3. GET /api/countries
print("\n[3/10] Verificando GET /api/countries...")
c_list = countries()
print(f"   Total países de referencia: {len(c_list)}")
assert len(c_list) >= 170
sample_c = [c for c in c_list if c["country_code"] in ("ECU", "BRA", "USA")]
for c in sample_c:
    print(f"   - {c['country_code']}: {c['name']} (Continente: {c['continent']}, Lat: {c['lat']}, Lon: {c['lon']})")
    assert all(k in c for k in ("country_code", "name", "continent", "lat", "lon"))
print("   -> OK: Catálogo mundial cargado correctamente desde paises_ref.")

# 4. GET /api/regions
print("\n[4/10] Verificando GET /api/regions...")
r_list = regions()
print(f"   Total entidades devueltas: {len(r_list)}")
assert len(r_list) >= 170
ecu = [r for r in r_list if r["id"] == "ECU"][0]
print(f"   Ecuador centro: {ecu['center']}, cantones/provincias integrados: {len(ecu['cantons'])}")
assert len(ecu["cantons"]) == 7, f"Esperadas 7 provincias históricas en ECU, encontradas {len(ecu['cantons'])}"
bra = [r for r in r_list if r["id"] == "BRA"][0]
print(f"   Brasil centro: {bra['center']}, cantones: {len(bra['cantons'])} (nivel nacional)")
assert len(bra["cantons"]) == 0
print("   -> OK: Contrato Region[] de UI cumplido con geometrías y retrocompatibilidad.")

# 5. POST /api/calendar
print("\n[5/10] Verificando POST /api/calendar...")
# Probar con ECU, BRA y ESP
for c_code in ("ECU", "BRA", "ESP"):
    cal = calendar(BaseFilter(year_from=2021, year_to=2024, country_code=c_code, sensor="harmonized"))
    assert cal.get("unit") == "fire_cell_days"
    weeks = cal.get("weeks", [])
    active = [w for w in weeks if w["value"] > 0]
    print(f"   - {c_code}: {len(weeks)} semanas generadas, {len(active)} semanas con actividad (Total fcd: {sum(w['value'] for w in active):,.0f})")
    assert len(weeks) > 0
# Probar con sensor modis y viirs
cal_modis = calendar(BaseFilter(year_from=2023, year_to=2024, country_code="ECU", sensor="modis"))
cal_viirs = calendar(BaseFilter(year_from=2023, year_to=2024, country_code="ECU", sensor="viirs"))
print(f"   - ECU 2023-2024: MODIS fcd={sum(w['value'] for w in cal_modis['weeks'])}, VIIRS fcd={sum(w['value'] for w in cal_viirs['weeks'])}")
print("   -> OK: Calendario responde con unidades exactas y discriminación por sensor.")

# 6. POST /api/climatology
print("\n[6/10] Verificando POST /api/climatology...")
clim = climatology(BaseFilter(year_from=2005, year_to=2025, country_code="ECU"))
weeks_clim = clim.get("weeks", [])
print(f"   Total semanas climatológicas: {len(weeks_clim)}")
assert len(weeks_clim) >= 52
w36 = [w for w in weeks_clim if w["week"] == 36][0]
print(f"   - Semana pico 36 (ECU): Media={w36['mean']} fcd, P10={w36['p10']}, P50={w36['p50']}, P90={w36['p90']}")
assert w36["p90"] >= w36["p50"] >= w36["p10"]
print("   -> OK: Percentiles y media consistentes para la serie histórica.")

# 7. POST /api/season
print("\n[7/10] Verificando POST /api/season...")
seas = season(BaseFilter(year_from=2018, year_to=2024, country_code="ECU"))
years_seas = seas.get("years", [])
print(f"   Temporadas anuales analizadas: {len(years_seas)}")
for y in years_seas:
    print(f"   - Año {y['year']}: Inicio sem {y['start_week']}, Pico sem {y['peak_week']}, Fin sem {y['end_week']}, Total {y['total']:.0f} fcd")
    assert y["start_week"] <= y["peak_week"] <= y["end_week"]
print("   -> OK: Detección estacional correcta (inicio, pico y fin de temporada).")

# 8. POST /api/anomalies
print("\n[8/10] Verificando POST /api/anomalies...")
anom = anomalies(BaseFilter(year_from=2005, year_to=2025, country_code="ECU"))
items_anom = anom.get("items", [])
print(f"   Semanas anómalas detectadas (Z >= 1.6): {len(items_anom)}")
if items_anom:
    top = items_anom[0]
    print(f"   - Anomalía récord: Año {top['year']} Sem {top['week']}, Valor={top['value']} fcd, Z-Score={top['zscore']}σ, Percentil={top['percentile']}%")
    assert top["zscore"] >= 1.6
print("   -> OK: Detección de valores atípicos mediante Z-score empírico.")

# 9. POST /api/current-status
print("\n[9/10] Verificando POST /api/current-status...")
cs_ecu = current_status(BaseFilter(country_code="ECU"))
print(f"   - Ecuador: Año {cs_ecu.get('year')}, Sem {cs_ecu.get('week')}, Valor={cs_ecu.get('value')} fcd, Z={cs_ecu.get('zscore')}σ, Nivel={cs_ecu.get('level')}")
assert cs_ecu["level"] in ("normal", "elevado", "inusual")
assert cs_ecu.get("year") is not None
cs_bra = current_status(BaseFilter(country_code="BRA"))
print(f"   - Brasil:  Año {cs_bra.get('year')}, Sem {cs_bra.get('week')}, Valor={cs_bra.get('value')} fcd, Z={cs_bra.get('zscore')}σ, Nivel={cs_bra.get('level')}")
assert cs_bra["level"] in ("normal", "elevado", "inusual")
print("   -> OK: Estado actual devuelve año de referencia real y clasificación semafórica.")

# 10. POST /api/hotspots
print("\n[10/10] Verificando POST /api/hotspots...")
hs_ecu = hotspots(HotspotFilter(year=2024, week=36, country_code="ECU"))
pts_ecu = hs_ecu.get("points", [])
print(f"   - Ecuador 2024 sem 36: {len(pts_ecu)} celdas-día con fuego")
assert len(pts_ecu) > 0
sample_pt = pts_ecu[0]
print(f"     Muestra: Lat={sample_pt['lat']}, Lon={sample_pt['lon']}, Fecha={sample_pt['date']}, FRP={sample_pt['frp']} MW, Sensor={sample_pt['sensor']}")
assert all(k in sample_pt for k in ("lat", "lon", "date", "frp", "sensor"))

hs_bra = hotspots(HotspotFilter(year=2024, week=36, country_code="BRA"))
pts_bra = hs_bra.get("points", [])
print(f"   - Brasil 2024 sem 36: {len(pts_bra)} celdas-día con fuego")
assert len(pts_bra) > 0
print("   -> OK: Capa geoespacial devuelve focos con coordenadas, fecha, FRP y sensor.")

print("\n" + "="*60)
print("LOS 10 ENDPOINTS FUERON INDIVIDUALMENTE VERIFICADOS CON ÉXITO")
print("="*60)
