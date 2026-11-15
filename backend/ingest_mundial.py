"""BRASA - ingesta incremental mundial NASA FIRMS.

Crea una representación espacial resumida de detecciones tipo=0,
una fila por día/sensor/celda de 1 grado, NO eventos individuales.
La aplicación actual usa el nombre 'hotspots' pero sus conteos y
filtros territoriales requieren adaptación para interpretación científica.

Ejemplos (desde backend):
 python ingest_mundial.py --bd brasa_prueba.db --archivos 1 --filas 100000
 python ingest_mundial.py --bd brasa.db
"""
from __future__ import annotations

import argparse
import math
import sqlite3
import sys
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
RAW = HERE.parent / 'data' / 'raw'
COLUMNS = {'latitude', 'longitude', 'lat', 'lon', 'acq_date', 'date',
           'instrument', 'satellite', 'frp', 'daynight', 'confidence', 'type'}
CHUNKSIZE = 30000


def create_database(db: Path, resolution: float) -> sqlite3.Connection:
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db), timeout=120)
    con.execute('PRAGMA journal_mode=WAL')
    con.execute('PRAGMA synchronous=NORMAL')
    con.execute('PRAGMA busy_timeout=120000')
    con.execute('PRAGMA cache_size=-24000')
    con.executescript('''
        CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS archivos_procesados (
            nombre TEXT PRIMARY KEY, bytes INTEGER NOT NULL,
            filas_leidas INTEGER NOT NULL DEFAULT 0,
            terminado INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS hotspots (
            date TEXT NOT NULL,
            sensor TEXT NOT NULL,
            cell_y INTEGER NOT NULL,
            cell_x INTEGER NOT NULL,
            year INTEGER NOT NULL,
            week INTEGER NOT NULL,
            lat REAL NOT NULL,
            lon REAL NOT NULL,
            frp REAL NOT NULL,
            daynight TEXT NOT NULL,
            confidence TEXT NOT NULL,
            province_id TEXT,
            canton_id TEXT,
            PRIMARY KEY(date, sensor, cell_y, cell_x)
        ) WITHOUT ROWID;
    ''')
    previous = con.execute("SELECT value FROM metadata WHERE key='resolucion_grados'").fetchone()
    if previous and float(previous[0]) != resolution:
        con.close()
        raise SystemExit('ERROR: la BD existe con distinta resolucion. Usa otra ruta --bd.')
    if not previous:
        con.execute('INSERT INTO metadata(key,value) VALUES (?,?)',
                    ('resolucion_grados', str(resolution)))
    con.execute('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)',
                ('metrica', 'presencia por dia, sensor y celda; tipo=0'))
    con.commit()
    return con


def normalize_chunk(chunk: pd.DataFrame, step: float) -> list[tuple]:
    df = chunk.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    if 'latitude' not in df and 'lat' in df:
        df.rename(columns={'lat':'latitude'}, inplace=True)
    if 'longitude' not in df and 'lon' in df:
        df.rename(columns={'lon':'longitude'}, inplace=True)
    if 'acq_date' not in df and 'date' in df:
        df.rename(columns={'date':'acq_date'}, inplace=True)
    for mandatory in ('latitude','longitude','acq_date'):
        if mandatory not in df:
            raise ValueError(f'Falta columna obligatoria {mandatory}')
    if 'type' in df:
        # Solo tipo 0: incendios/vegetacion; se excluyen otras fuentes termicas.
        df = df[pd.to_numeric(df['type'],errors='coerce').eq(0)].copy()
    if df.empty:
        return []
    lat = pd.to_numeric(df['latitude'], errors='coerce')
    lon = pd.to_numeric(df['longitude'], errors='coerce')
    dt = pd.to_datetime(df['acq_date'],errors='coerce')
    ok = lat.between(-90,90) & lon.between(-180,180) & dt.notna()
    df = df.loc[ok].copy()
    if df.empty:
        return []
    lat, lon, dt = lat.loc[ok], lon.loc[ok], dt.loc[ok]
    df['cell_y'] = np.floor(lat.to_numpy(dtype='float64') / step).astype('int32')
    df['cell_x'] = np.floor(lon.to_numpy(dtype='float64') / step).astype('int32')
    df['date'] = dt.dt.strftime('%Y-%m-%d')
    iso = dt.dt.isocalendar()
    df['year'] = iso.year.to_numpy(dtype='int32')
    df['week'] = iso.week.to_numpy(dtype='int32')

    if 'instrument' in df:
        name = df['instrument'].fillna('').astype(str).str.upper()
    else:
        name = pd.Series('',index=df.index)
    # VIIRS is detected from instrument or satellite; MODIS otherwise.
    if 'satellite' in df:
        satellite = df['satellite'].fillna('').astype(str).str.upper()
    else:
        satellite = pd.Series('',index=df.index)
    is_viirs = name.str.contains('VIIRS',regex=False) | satellite.str.contains('NPP|NOAA|JPSS',regex=True)
    df['sensor'] = np.where(is_viirs,'VIIRS','MODIS')

    frp = pd.to_numeric(df['frp'],errors='coerce') if 'frp' in df else pd.Series(0.0,index=df.index)
    df['frp'] = frp.fillna(0.0).clip(lower=0).astype('float32')
    if 'daynight' in df:
        df['daynight'] = df['daynight'].fillna('').astype(str).str.upper().str[:1]
    else:
        df['daynight'] = 'D'
    df.loc[~df['daynight'].isin(['D','N']), 'daynight'] = 'D'
    if 'confidence' in df:
        raw = df['confidence'].fillna('').astype(str).str.strip().str.lower()
        numeric = pd.to_numeric(raw,errors='coerce')
        df['confidence_score'] = np.where(
            raw.isin(['h','high']) | (numeric>=80), 2,
            np.where(raw.isin(['n','nominal']) | (numeric>=50), 1, 0)
        ).astype('int8')
    else:
        df['confidence_score'] = 1

    # Una celda-día-sensor cuenta UNA vez, independientemente del número
    # de pixeles activos en el archivo original.
    grouped = df.groupby(['date','sensor','cell_y','cell_x'],sort=False,observed=True).agg(
        year=('year','first'),week=('week','first'),
        frp=('frp','max'),confidence_score=('confidence_score','max'),
        daynight=('daynight','first')
    ).reset_index()
    result = []
    for row in grouped.itertuples(index=False):
        result.append((str(row.date),str(row.sensor),int(row.cell_y),int(row.cell_x),
                       int(row.year),int(row.week),
                       round((int(row.cell_y)+0.5)*step,6),
                       round((int(row.cell_x)+0.5)*step,6),
                       float(row.frp),str(row.daynight),
                       ['l','n','h'][int(row.confidence_score)]))
    return result


INSERT = '''
    INSERT INTO hotspots(date,sensor,cell_y,cell_x,year,week,lat,lon,frp,daynight,confidence)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(date,sensor,cell_y,cell_x) DO UPDATE SET
      frp=MAX(hotspots.frp, excluded.frp),
      confidence=CASE WHEN excluded.confidence='h' OR
        (excluded.confidence='n' AND hotspots.confidence='l')
        THEN excluded.confidence ELSE hotspots.confidence END,
      daynight=CASE WHEN hotspots.daynight=excluded.daynight
        THEN hotspots.daynight ELSE 'B' END
'''


def ingest(con: sqlite3.Connection, filename: Path, step: float,
           max_rows: int | None = None) -> int:
    size = filename.stat().st_size
    saved = con.execute('SELECT bytes,filas_leidas,terminado FROM archivos_procesados WHERE nombre=?',
                        (filename.name,)).fetchone()
    if saved and saved[0] != size:
        raise SystemExit(f'ERROR: cambio el tamano de {filename.name}; no se puede reanudar de forma segura.')
    if saved and saved[2]:
        print(f'  OMITIDO: {filename.name} ya fue procesado',flush=True)
        return 0
    done = int(saved[1]) if saved else 0
    seen = 0
    inserted = 0
    reader = pd.read_csv(filename, usecols=lambda c: c.strip().lower() in COLUMNS,
                         chunksize=CHUNKSIZE, low_memory=True,
                         encoding='utf-8-sig')
    for chunk in reader:
        rows = len(chunk)
        if seen + rows <= done:
            seen += rows
            continue
        if seen < done:
            raise SystemExit('ERROR: checkpoint no coincide con los bloques, usa el mismo CHUNKSIZE.')
        if max_rows is not None and inserted >= max_rows:
            break
        normalized = normalize_chunk(chunk,step)
        with con:
            if normalized:
                con.executemany(INSERT,normalized)
            seen += rows
            con.execute('INSERT OR REPLACE INTO archivos_procesados(nombre,bytes,filas_leidas,terminado) VALUES (?,?,?,0)',
                        (filename.name,size,seen))
        inserted += rows
        if inserted % 300000 < CHUNKSIZE:
            print(f'  {filename.name}: {seen:,} filas leidas; {len(normalized):,} celdas en el ultimo bloque',flush=True)
        if max_rows is not None and inserted >= max_rows:
            break
    else:
        con.execute('UPDATE archivos_procesados SET terminado=1 WHERE nombre=?',(filename.name,))
        con.commit()
    return inserted


def main() -> None:
    ap = argparse.ArgumentParser(description='NASA FIRMS: ingesta mundial por bloques y celdas')
    ap.add_argument('--entrada',type=Path,default=RAW)
    ap.add_argument('--bd',type=Path,default=HERE/'brasa.db')
    ap.add_argument('--resolucion',type=float,default=1.0)
    ap.add_argument('--archivos',type=int,default=0,help='Limita numero de CSV para prueba')
    ap.add_argument('--filas',type=int,default=0,help='Limita filas por ejecucion para prueba')
    args = ap.parse_args()
    if not (0 < args.resolucion <= 2):
        ap.error('--resolucion debe estar entre 0 y 2 grados')
    files = sorted(args.entrada.glob('*.csv'))
    if args.archivos:
        files = files[:args.archivos]
    if not files:
        raise SystemExit(f'No hay archivos CSV en {args.entrada}')
    print(f'Archivos: {len(files)} | base: {args.bd} | celdas: {args.resolucion} grados',flush=True)
    db = create_database(args.bd,args.resolucion)
    total = 0
    try:
        for path in files:
            print('Leyendo',path.name,'...',flush=True)
            total += ingest(db,path,args.resolucion,args.filas or None)
        db.executescript('''
            CREATE INDEX IF NOT EXISTS idx_hotspots_year_week ON hotspots(year,week);
            CREATE INDEX IF NOT EXISTS idx_hotspots_sensor_year ON hotspots(sensor,year);
        ''')
        db.commit()
        n = db.execute('SELECT COUNT(*) FROM hotspots').fetchone()[0]
        finished = db.execute('SELECT COUNT(*) FROM archivos_procesados WHERE terminado=1').fetchone()[0]
        print(f'OK: {n:,} celdas-dia-sensor | {finished} archivos completos | {total:,} filas leidas en esta ejecucion',flush=True)
        print('ATENCION: representa celdas aproximadas de 1 grado, no las detecciones individuales.',flush=True)
        print('La API React actual no tiene filtros mundiales implementados ni armonizacion validada.',flush=True)
    finally:
        db.close()

if __name__ == '__main__':
    main()
