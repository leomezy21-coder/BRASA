
from pathlib import Path
import cdsapi

dataset = "cems-fire-historical-v1"

request = {
    "product_type": "reanalysis",
    "variable": ["fire_weather_index"],
    "dataset_type": "consolidated_dataset",
    "system_version": ["4_1"],
    "year": ["2024"],
    "month": ["09"],
    "day": ["05"],
    "grid": "0.25/0.25",
    "data_format": "netcdf",
    "area": [2, -81, -5, -75]
}

carpeta = Path("datos/gfwed")
carpeta.mkdir(parents=True, exist_ok=True)

salida = carpeta / "fwi_ecuador_20240905.nc"

cliente = cdsapi.Client()
cliente.retrieve(dataset, request).download(str(salida))

print("Archivo descargado:", salida.resolve())
print("Tamano en MB:", round(salida.stat().st_size / 1048576, 2))
