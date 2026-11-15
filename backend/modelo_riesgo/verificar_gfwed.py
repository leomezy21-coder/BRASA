"""BRASA v4: descarga e inspecciona UNA muestra diaria oficial de NASA GFWED.

No modifica entrenamientos anteriores, Render, bases ni archivos FIRMS.
La comprobacion prepara el mapeo de variables/coordinate para integrar FWI.

Ejemplo (desde backend/modelo_riesgo):
  ..\\.venv\\Scripts\\python.exe verificar_gfwed.py --fecha 2024-09-05

Si la URL oficial da 404, verifica la estructura de carpetas en
https://data.giss.nasa.gov/impacts/gfwed/ y suministra --url.
"""
from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
import os
import sys
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
BASE = ('https://portal.nccs.nasa.gov/datashare/GlobalFWI/'
        'v2.0/fwiCalcs.GEOS-5/Default/GEOS-5')


def descargar(url: str, destino: Path, limite_mb: int):
    destino.parent.mkdir(parents=True, exist_ok=True)
    temp = destino.with_suffix('.descarga.tmp')
    if destino.exists():
        print(f'Archivo descargado previamente: {destino}')
        return
    if temp.exists():
        temp.unlink()
    req = urllib.request.Request(url, headers={'User-Agent': 'BRASA-Educational-Fire-Weather/1.0'})
    limite = limite_mb * 1024 * 1024
    total = 0
    try:
        with urllib.request.urlopen(req, timeout=90) as response, temp.open('wb') as f:
            longitud = response.headers.get('Content-Length')
            if longitud and int(longitud) > limite:
                raise ValueError(f'Archivo supera el límite de {limite_mb} MB; no se descargó.')
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > limite:
                    raise ValueError(f'Archivo supera el límite de {limite_mb} MB; descarga detenida.')
                f.write(chunk)
        if total < 128:
            raise RuntimeError('Archivo demasiado pequeño para ser un NetCDF válido.')
        temp.replace(destino)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, RuntimeError) as ex:
        temp.unlink(missing_ok=True)
        raise RuntimeError(f'No fue posible descargar GFWED. {ex}') from ex
    print(f'Descarga completada: {destino.name} ({total / (1024*1024):.2f} MiB)')


def inspeccionar(ruta: Path, latitud: float, longitud: float):
    import xarray as xr
    if not ruta.is_file():
        raise RuntimeError(f'No existe {ruta}')
    with xr.open_dataset(ruta, decode_times=False) as datos:
        print('\n=== ESTRUCTURA REAL DEL NETCDF NASA GFWED ===')
        print('Archivo:',ruta.resolve())
        print('Dimensiones:',dict(datos.sizes))
        print('Variables (primeras 30):')
        for nombre, variable in list(datos.data_vars.items())[:30]:
            print(' -',nombre,':',list(variable.dims), 'unidades:',variable.attrs.get('units','sin especificar'))
        print('Coordenadas:',list(datos.coords))
        # Sólo se inspecciona el archivo; no se inventan valores ni se atribuye resolución.
        candidates = [(la,lo) for la,lo in [('lat','lon'),('latitude','longitude'),('Latitude','Longitude')]
                      if la in datos.coords and lo in datos.coords]
        if candidates:
            la,lo = candidates[0]
            try:
                lon_data = datos[lo]
                londa = longitud % 360 if float(lon_data.max().item()) > 180 else longitud
                cerca=datos.sel({la:latitud, lo:londa},method='nearest')
                print(f'Punto solicitado: ({latitud},{longitud})')
                print('Punto de malla más cercano:',float(cerca[la].item()),float(cerca[lo].item()))
                claves = [k for k in cerca.data_vars if k.upper()=='FWI' or k.upper().endswith('_FWI') or 'FIRE_WEATHER_INDEX' in k.upper()]
                for clave in claves[:5]:
                    v = cerca[clave]
                    if v.size == 1:
                        print(f'{clave}: {v.item()} (sin clasificación de riesgo)')
            except Exception as ex:
                print('No se pudo calcular la ubicación más cercana (el archivo se conservó):',ex)
        else:
            print('Nombres de coordenadas no estándar; revisaremos la estructura antes de unir datos.')
        print('\nNo se entrenó un modelo ni se interpretó FWI como probabilidad.')


def main():
    p=argparse.ArgumentParser(description='BRASA: verificar 1 archivo diario de NASA GFWED')
    p.add_argument('--fecha',default='2024-09-05',help='YYYY-MM-DD')
    p.add_argument('--url',default=None,help='Sobrescribe la URL de ejemplo si NASA cambia carpetas')
    p.add_argument('--archivo',type=Path,default=None,help='Inspeccionar archivo .nc local sin descargar')
    p.add_argument('--lat',type=float,default=-1.67)
    p.add_argument('--lon',type=float,default=-78.65)
    p.add_argument('--limite-mb',type=int,default=100)
    a=p.parse_args()
    if a.archivo is not None:
        ruta=a.archivo
    else:
        d=date.fromisoformat(a.fecha)
        ruta=HERE/'datos'/'gfwed'/f'FWI.GEOS-5.Daily.Default.{d:%Y%m%d}.nc'
        url=a.url or f'{BASE}/{d.year}/{ruta.name}'
        print('Descargando únicamente un archivo diario de prueba desde NASA:')
        print(url)
        descargar(url,ruta,a.limite_mb)
    inspeccionar(ruta,a.lat,a.lon)


if __name__=='__main__':
    try:
        main()
    except Exception as e:
        print('ERROR:',e,file=sys.stderr)
        sys.exit(1)
