"""Descarga FWI histórico CEMS/EWDS para Ecuador, año por año, sin sobrescribir.

Uso desde backend/modelo_riesgo:
    ..\\.venv\\Scripts\\python.exe descargar_fwi_historico.py --desde 2018 --hasta 2024

Requiere ~/.cdsapirc configurado con la API Key de EWDS y aceptación de licencia.
No almacena credenciales. Los .nc son históricos/retrospectivos, NO pronósticos.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import sys
import time

import cdsapi
import numpy as np
import xarray as xr

DATASET = 'cems-fire-historical-v1'
BASE = Path(__file__).resolve().parent


def validar_archivo(path: Path, year: int) -> tuple[bool, str]:
    if not path.is_file() or path.stat().st_size < 500:
        return False, 'archivo ausente o demasiado pequeño'
    try:
        with xr.open_dataset(path) as ds:
            if 'fwinx' not in ds.data_vars or not {'valid_time','latitude','longitude'} <= set(ds.sizes):
                return False, 'NetCDF sin fwinx/valid_time/latitude/longitude'
            fechas = np.array(ds['valid_time'].values, dtype='datetime64[D]')
            anios = fechas.astype('datetime64[Y]').astype(int) + 1970
            n = int((anios == year).sum())
            if n < 340:
                return False, f'solo {n} fechas de {year} (se esperaban >=340)'
            if len(np.unique(fechas[anios == year])) != n:
                return False, 'fechas duplicadas'
            lo, la = ds['longitude'], ds['latitude']
            if lo.size < 20 or la.size < 20:
                return False, 'cuadrícula incompleta'
            return True, f'{n} fechas, cuadrícula {la.size}×{lo.size}'
    except Exception as e:
        return False, f'no se pudo abrir como NetCDF: {e}'


def descargar(client: cdsapi.Client, year: int, output: Path):
    request = {
        'product_type': 'reanalysis',
        'variable': ['fire_weather_index'],
        'dataset_type': 'consolidated_dataset',
        'system_version': ['4_1'],
        'year': [str(year)],
        'month': [f'{i:02d}' for i in range(1, 13)],
        'day': [f'{i:02d}' for i in range(1, 32)],
        'grid': '0.25/0.25',
        'data_format': 'netcdf',
        'area': [2, -81, -5, -75],
    }
    temp = output.with_suffix('.parcial.nc')
    temp.unlink(missing_ok=True)
    # El servidor puede dejar la solicitud en cola; puede ser necesario reintentar al día siguiente.
    client.retrieve(DATASET, request).download(str(temp))
    ok, msg = validar_archivo(temp, year)
    if not ok:
        raise RuntimeError(f'Archivo devuelto para {year} no válido: {msg}; revisar {temp}')
    temp.replace(output)
    return msg


def main():
    ap = argparse.ArgumentParser(description='Descargar FWI histórico de Copernicus EWDS para BRASA')
    ap.add_argument('--desde', type=int, default=2018)
    ap.add_argument('--hasta', type=int, default=2024)
    ap.add_argument('--carpeta', type=Path, default=BASE / 'datos' / 'fwi_cems_historico')
    args = ap.parse_args()
    if args.desde > args.hasta or args.desde < 1980 or args.hasta > 2025:
        ap.error('Rango de años no válido para este experimento')
    args.carpeta.mkdir(parents=True, exist_ok=True)
    cliente = None
    correcto = 0
    for year in range(args.desde, args.hasta + 1):
        destino = args.carpeta / f'fwi_ecuador_{year}.nc'
        ok, mensaje = validar_archivo(destino, year)
        if ok:
            print(f'[{year}] Ya existe y es válido: {mensaje}', flush=True)
            correcto += 1
            continue
        if destino.exists():
            print(f'[{year}] Archivo preexistente inválido: {mensaje}. No se sobrescribe. Renómbralo antes de continuar.', file=sys.stderr)
            return 1
        try:
            if cliente is None:
                cliente = cdsapi.Client()
            print(f'[{year}] Solicitando FWI consolidado a EWDS...', flush=True)
            print(f'  Nota: podrían existir colas o límites de peticiones del proveedor.', flush=True)
            mensaje = descargar(cliente, year, destino)
            print(f'[{year}] OK: {mensaje} | {destino.stat().st_size/1048576:.2f} MiB', flush=True)
            correcto += 1
        except Exception as exc:
            print(f'[{year}] ERROR: {exc}', file=sys.stderr, flush=True)
            print('Se conservan los años anteriores. Reejecuta el mismo comando más adelante:', file=sys.stderr)
            print('los años ya descargados se saltarán automáticamente.', file=sys.stderr)
            return 2
    print(f'COMPLETO: {correcto} años. Ruta: {args.carpeta.resolve()}', flush=True)
    print('Fuente: Copernicus CEMS EWDS (NO NASA GFWED), FWI histórico reanalizado.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
