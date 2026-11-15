import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.main import (
    app, health, regions, calendar, climatology, season, anomalies, current_status, hotspots,
    BaseFilter, HotspotFilter
)

print("--- 1. HEALTH CHECK ---")
h = health()
print(h)
assert h["status"] == "ok"
assert h["db"] is True
assert h["summary_ready"] is True
assert h["map_ready"] is True

print("\n--- 2. REGIONS CHECK ---")
regs = regions()
print(f"Total regiones devueltas: {len(regs)}")
assert len(regs) >= 170
ecu_reg = [r for r in regs if r["id"] == "ECU"][0]
print("Ecuador cantones disponibles:", len(ecu_reg["cantons"]))
assert len(ecu_reg["cantons"]) > 0

print("\n--- 3. CALENDAR CON COUNTRY_CODE 'ECU' ---")
cal1 = calendar(BaseFilter(year_from=2020, year_to=2024, country_code="ECU", sensor="harmonized"))
print(f"Semanas devueltas: {len(cal1['weeks'])}")
nonzero1 = [w for w in cal1["weeks"] if w["value"] > 0]
print(f"Semanas con fuego: {len(nonzero1)}, Primer valor: {nonzero1[0]}")
assert len(nonzero1) > 0

print("\n--- 4. CALENDAR CON PROVINCE_ID 'chimborazo' (RETROCOMPATIBILIDAD) ---")
cal2 = calendar(BaseFilter(year_from=2020, year_to=2024, province_id="chimborazo"))
print(f"Semanas devueltas: {len(cal2['weeks'])}")
nonzero2 = [w for w in cal2["weeks"] if w["value"] > 0]
print(f"Semanas con fuego: {len(nonzero2)}, Primer valor: {nonzero2[0]}")
assert len(nonzero2) > 0

print("\n--- 5. CALENDAR CON BRASIL 'BRA' ---")
cal_bra = calendar(BaseFilter(year_from=2023, year_to=2024, country_code="BRA"))
nonzero_bra = [w for w in cal_bra["weeks"] if w["value"] > 0]
print(f"Brasil semanas con fuego: {len(nonzero_bra)}, Primer valor: {nonzero_bra[0]}")
assert len(nonzero_bra) > 0

print("\n--- 6. HOTSPOTS CON ECUADOR 2024 SEMANA 36 ---")
hs = hotspots(HotspotFilter(year=2024, week=36, country_code="ECU"))
print(f"Puntos devueltos para Ecuador 2024 sem 36: {len(hs['points'])}")
assert len(hs["points"]) > 0

print("\n--- 7. CURRENT STATUS ---")
cs = current_status(BaseFilter(country_code="ECU"))
print("Current status Ecuador:", cs)
assert cs["level"] in ("normal", "elevado", "inusual")

print("\n>>> TODOS LOS TESTS DEL BACKEND MAIN.PY PASARON EXITOSAMENTE <<<")
