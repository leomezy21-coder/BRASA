"""Une FWI histórico CEMS (D-1 y promedio D-7..D-1) con el piloto BRASA v3.

Evita fuga temporal: en fecha t usa exclusivamente FWI de días anteriores.
Usa la cuadrícula más cercana del producto 0.25° y verifica cobertura antes de escribir.
No sobrescribe CSV v3; crea un CSV nuevo con dos columnas FWI.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import xarray as xr

BASE = Path(__file__).resolve().parent


def cargar_fwi(carpeta: Path, anios: list[int], celdas: pd.DataFrame) -> dict[tuple[int,int], pd.Series]:
    coleccion = {tuple(map(int, x)): {} for x in celdas[['cell_y','cell_x']].itertuples(index=False,name=None)}
    for year in anios:
        archivo = carpeta / f'fwi_ecuador_{year}.nc'
        if not archivo.is_file():
            raise RuntimeError(f'Falta {archivo}; primero ejecuta descargar_fwi_historico.py')
        print(f'Leyendo {archivo.name}...', flush=True)
        with xr.open_dataset(archivo) as ds:
            if 'fwinx' not in ds or not {'valid_time','latitude','longitude'} <= set(ds.sizes):
                raise RuntimeError(f'Incompatible: {archivo}. Debe tener fwinx y ejes valid_time, latitude, longitude.')
            fechas = pd.to_datetime(ds['valid_time'].values).normalize()
            if len(fechas) < 340 or not (fechas.year == year).all():
                raise RuntimeError(f'Fechas del año {year} insuficientes o mezcladas ({len(fechas)})')
            if len(fechas.unique()) != len(fechas):
                raise RuntimeError(f'Fechas duplicadas en {archivo.name}')
            for r in celdas.itertuples(index=False):
                key = (int(r.cell_y),int(r.cell_x))
                lat = float(r.lat)
                lon = float(r.lon) % 360  # 279° equivale a -81°
                valores = ds['fwinx'].sel(latitude=lat,longitude=lon,method='nearest').values
                valores = np.asarray(valores,dtype=float).reshape(-1)
                if len(valores) != len(fechas):
                    raise RuntimeError(f'Forma inesperada para celda {key}: {valores.shape}')
                valores = np.where(np.isfinite(valores)&(valores>=0)&(valores<1000),valores,np.nan)
                coleccion[key].update(zip(fechas,valores))
    series = {}
    for key, value in coleccion.items():
        s = pd.Series(value,dtype=float).sort_index()
        idx = pd.date_range(f'{min(anios)}-01-01', f'{max(anios)}-12-31',freq='D')
        series[key] = s.reindex(idx)
    return series


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--datos',type=Path,default=BASE/'datos'/'entrenamiento_ecuador_025.csv')
    p.add_argument('--carpeta',type=Path,default=BASE/'datos'/'fwi_cems_historico')
    p.add_argument('--salida',type=Path,default=BASE/'datos'/'entrenamiento_ecuador_025_fwi.csv')
    args=p.parse_args()
    if not args.datos.is_file():
        raise SystemExit(f'Falta CSV fuente: {args.datos}')
    if args.salida.exists():
        raise SystemExit(f'No se sobrescribirá {args.salida}. Usa otro --salida si lo deseas.')
    df=pd.read_csv(args.datos)
    req={'fecha','cell_y','cell_x','lat','lon','objetivo','particion'}
    if not req <= set(df.columns):
        raise SystemExit(f'Columnas faltantes: {sorted(req-set(df.columns))}')
    df['fecha']=pd.to_datetime(df['fecha'],errors='raise')
    if df.duplicated(['fecha','cell_y','cell_x']).any():
        raise SystemExit('CSV tiene celdas-fecha duplicadas.')
    anios=list(range(int(df.fecha.dt.year.min()),int(df.fecha.dt.year.max())+1))
    celdas=df[['cell_y','cell_x','lat','lon']].drop_duplicates(['cell_y','cell_x'])
    if len(celdas)!=len(df[['cell_y','cell_x','lat','lon']].drop_duplicates()):
        raise SystemExit('Una celda aparece con más de un centro.')
    if len(celdas)<8:
        raise SystemExit('Muestra de menos de 8 celdas.')
    print(f'Uniendo CEMS FWI para {len(celdas)} celdas y años {anios[0]}–{anios[-1]}',flush=True)
    data=cargar_fwi(args.carpeta,anios,celdas)
    partes=[]
    for key,sub in df.groupby(['cell_y','cell_x'],sort=False):
        serie=data[tuple(map(int,key))]
        # FWI anterior al día de predicción; NO usar dato del mismo día por seguridad.
        anterior=serie.shift(1)
        ultimos7=serie.shift(1).rolling(7,min_periods=7).mean()
        bloque=sub.copy()
        bloque['fwi_ayer']=anterior.reindex(bloque.fecha).to_numpy()
        bloque['fwi_media_7d_previos']=ultimos7.reindex(bloque.fecha).to_numpy()
        partes.append(bloque)
    total=pd.concat(partes,ignore_index=True)
    valid=total[['fwi_ayer','fwi_media_7d_previos']].notna().all(axis=1)
    n_omitidos=int((~valid).sum())
    limpio=total[valid].sort_values(['fecha','cell_y','cell_x']).copy()
    cob=len(limpio)/len(total)
    print(f'FWI disponible: {len(limpio):,}/{len(total):,} filas ({cob:.2%}). Omitidas {n_omitidos:,}.',flush=True)
    if cob < 0.90:
        raise SystemExit('COBERTURA INSUFICIENTE: <90% de filas con FWI completo. No se genera CSV para evitar sesgo.')
    for part in ['entrenamiento','validacion','prueba']:
        p0=limpio[limpio.particion==part]
        if len(p0)<100 or p0.objetivo.nunique()<2:
            raise SystemExit(f'Partición {part} insuficiente: {len(p0)} filas; {p0.objetivo.nunique()} clases')
        print(f' {part}: {len(p0):,} filas; {int(p0.objetivo.sum()):,} positivas',flush=True)
    limpio['fecha']=limpio['fecha'].dt.strftime('%Y-%m-%d')
    args.salida.parent.mkdir(parents=True,exist_ok=True)
    temporal=args.salida.with_suffix('.tmp.csv')
    try:
        limpio.to_csv(temporal,index=False,encoding='utf-8')
        temporal.replace(args.salida)
    finally:
        temporal.unlink(missing_ok=True)
    metadatos={
        'fuente':'Copernicus CEMS EWDS cems-fire-historical-v1, reanalysis, fwinx, version 4.1',
        'variables_agregadas':['fwi_ayer','fwi_media_7d_previos'],
        'relacion_temporal':'FWI de 1–7 días previos al día t para predecir MODIS próximos 7 días',
        'metodo_espacial':'valor de celda CEMS 0.25° más cercana al centro de celda FIRMS',
        'filas_originales':int(len(total)), 'filas_con_fwi':int(len(limpio)),
        'limitaciones':['FWI reanalysis/hindcast: no demuestra capacidad de pronóstico en tiempo real.',
                       'FWI no es probabilidad de incendio; es un índice meteorológico de peligro.',
                       'Valores faltantes eliminados sin rellenar artificialmente.',
                       'Se evita FWI del día t y días futuros.'],
    }
    args.salida.with_suffix('.metadata.json').write_text(json.dumps(metadatos,indent=2,ensure_ascii=False),encoding='utf-8')
    print(f'OK: {args.salida.resolve()}')
    return 0


if __name__=='__main__':
    try:
        raise SystemExit(main())
    except (ValueError,RuntimeError,KeyError,FileNotFoundError) as exc:
        print(f'ERROR: {exc}',file=sys.stderr)
        raise SystemExit(1)
