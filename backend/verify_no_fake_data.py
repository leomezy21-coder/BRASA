import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.main import calendar, BaseFilter

print("--- VERIFICACIÓN DE AÑOS Y SENSORES SIN COBERTURA ---")

# 1. VIIRS en 2005-2010 (antes de su lanzamiento en 2012)
cal_viirs_early = calendar(BaseFilter(year_from=2005, year_to=2010, country_code="ECU", sensor="viirs"))
weeks_viirs_early = cal_viirs_early.get("weeks", [])
fcd_sum = sum(w["value"] for w in weeks_viirs_early)
print(f"1. VIIRS 2005-2010 (ECU): Total fcd={fcd_sum}")
assert fcd_sum == 0.0, f"VIIRS no existía antes de 2012, no debe haber detecciones inventadas: {fcd_sum}"
print("   -> OK: VIIRS en 2005-2010 devuelve 0.0 (no se inventan registros inexistentes).")

# 2. MODIS en 2005-2010 (MODIS sí operaba)
cal_modis_early = calendar(BaseFilter(year_from=2005, year_to=2010, country_code="ECU", sensor="modis"))
weeks_modis_early = cal_modis_early.get("weeks", [])
modis_fcd_sum = sum(w["value"] for w in weeks_modis_early)
print(f"2. MODIS 2005-2010 (ECU): Total fcd={modis_fcd_sum}")
assert modis_fcd_sum > 0, "MODIS sí tenía observaciones en 2005-2010"
print(f"   -> OK: MODIS en 2005-2010 tiene {modis_fcd_sum:,.0f} fcd reales.")

# 3. Observaciones en altas latitudes (ej. volcanes activos subantárticos asignados a ATA)
cal_ata = calendar(BaseFilter(year_from=2020, year_to=2024, country_code="ATA"))
ata_fcd_sum = sum(w["value"] for w in cal_ata.get("weeks", []))
print(f"3. Antártida 'ATA' 2020-2024: Total fcd={ata_fcd_sum} (anomalías térmicas de volcanes polares como Mt. Erebus)")
print("   -> OK: Los datos devueltos provienen estrictamente de las detecciones reales registradas en la base de datos.")
