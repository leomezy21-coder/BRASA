"""Prepara tablas auxiliares para consultar BRASA mundial sin recargar CSV.

Ejecutar desde backend: python preparar_consultas_mundiales.py --bd brasa_mundial.db
Utiliza las celdas 1x1 y el centro de cada celda; los paises son estimados.
"""
from __future__ import annotations
import argparse
import json
import math
import sqlite3
from pathlib import Path

HERE = Path(__file__).resolve().parent
GEO = HERE / 'geografia' / 'paises_referencia.json'


def inside_ring(x, y, ring):
    """Ray casting sobre coordenadas [longitud, latitud]."""
    inside = False
    if not ring:
        return False
    x0, y0 = ring[-1]
    for x1, y1 in ring:
        if (y1 > y) != (y0 > y):
            cut = (x0 - x1) * (y - y1) / (y0 - y1) + x1
            if x < cut:
                inside = not inside
        x0, y0 = x1, y1
    return inside


def inside_polygons(lon, lat, polygons):
    for rings in polygons:
        if not rings or not inside_ring(lon, lat, rings[0]):
            continue
        if any(inside_ring(lon, lat, hole) for hole in rings[1:]):
            continue
        return True
    return False


def assign_country(lon, lat, countries):
    for p in countries:
        box = p['bbox']
        if box[0] <= lon <= box[2] and box[1] <= lat <= box[3]:
            if inside_polygons(lon, lat, p['poligonos']):
                return p['codigo']
    return None


def prepare(db):
    if not db.is_file():
        raise SystemExit(f'ERROR: la base no existe: {db}')
    if not GEO.is_file():
        raise SystemExit(f'ERROR: falta la geografia: {GEO}')
    data = json.loads(GEO.read_text(encoding='utf-8'))
    countries = data['paises']
    con = sqlite3.connect(str(db), timeout=180)
    con.execute('PRAGMA busy_timeout=180000')
    con.execute('PRAGMA temp_store=FILE')
    try:
        tables = {x[0] for x in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'hotspots','archivos_procesados','metadata'} <= tables:
            raise SystemExit('ERROR: estructura de BD incorrecta; se esperaba ingesta_mundial.')
        complete = con.execute('SELECT COUNT(*) FROM archivos_procesados WHERE terminado=1').fetchone()[0]
        if complete != 34:
            raise SystemExit(f'ERROR: hay {complete} CSV completos; se esperaban 34.')
        resolution = float(con.execute("SELECT value FROM metadata WHERE key='resolucion_grados'").fetchone()[0])
        if abs(resolution - 1.0) > 1e-7:
            raise SystemExit('ERROR: este adaptador requiere celdas de 1 grado.')
        exists = con.execute("SELECT name FROM sqlite_master WHERE name='resumen_semanal'").fetchone()
        if exists:
            mark = con.execute("SELECT value FROM metadata WHERE key='api_resumen_version'").fetchone()
            if mark and mark[0] == '1':
                print('Los resúmenes ya estan preparados. Usa --recrear si hace falta regenerarlos.',flush=True)
                return
            print('Se encontro un resumen incompleto: reconstruyendo SOLO tablas derivadas.',flush=True)
            for table in ('resumen_semanal','celda_pais','paises_ref'):
                con.execute(f'DROP TABLE IF EXISTS {table}')
            con.commit()

        print('Asignando centros de celdas a 177 paises de referencia...',flush=True)
        con.execute('''CREATE TABLE IF NOT EXISTS celda_pais (
            cell_y INTEGER NOT NULL, cell_x INTEGER NOT NULL,
            country_code TEXT NOT NULL,
            PRIMARY KEY(cell_y,cell_x)
        ) WITHOUT ROWID''')
        con.execute('''CREATE TABLE IF NOT EXISTS paises_ref (
            country_code TEXT PRIMARY KEY,
            name TEXT NOT NULL, continent TEXT NOT NULL,
            lon REAL NOT NULL, lat REAL NOT NULL
        )''')
        con.executemany('''INSERT OR REPLACE INTO paises_ref(country_code,name,continent,lon,lat)
            VALUES(?,?,?,?,?)''', (
                (p['codigo'],p['nombre'],p['continente'],(p['bbox'][0]+p['bbox'][2])/2,
                 (p['bbox'][1]+p['bbox'][3])/2) for p in countries))
        cells = []
        for y in range(-90,90):
            for x in range(-180,180):
                cc = assign_country(x + 0.5,y + 0.5,countries)
                if cc:
                    cells.append((y,x,cc))
        con.executemany('INSERT OR REPLACE INTO celda_pais VALUES (?,?,?)', cells)
        con.commit()
        print(f'{len(cells):,} celdas asignadas. Agregando 20M registros por semana/sensor/pais...',flush=True)
        con.execute('''CREATE TABLE resumen_semanal (
            country_code TEXT NOT NULL, year INTEGER NOT NULL, week INTEGER NOT NULL,
            sensor TEXT NOT NULL, confidence TEXT NOT NULL, daynight TEXT NOT NULL,
            n INTEGER NOT NULL,
            PRIMARY KEY(country_code,year,week,sensor,confidence,daynight)
        ) WITHOUT ROWID''')
        # Un solo barrido de hotspots. SIN_PAIS incluye mar y territorios no asignados.
        con.execute('''INSERT INTO resumen_semanal
            SELECT COALESCE(c.country_code,'SIN_PAIS'), h.year,h.week,h.sensor,h.confidence,h.daynight,
                   COUNT(*)
            FROM hotspots h LEFT JOIN celda_pais c ON h.cell_y=c.cell_y AND h.cell_x=c.cell_x
            GROUP BY COALESCE(c.country_code,'SIN_PAIS'),h.year,h.week,h.sensor,h.confidence,h.daynight''')
        con.commit()
        print('Calculando resumen global...',flush=True)
        con.execute('''INSERT INTO resumen_semanal
            SELECT '*',year,week,sensor,confidence,daynight,SUM(n)
            FROM resumen_semanal
            WHERE country_code <> '*'
            GROUP BY year,week,sensor,confidence,daynight''')
        con.execute('''INSERT OR REPLACE INTO metadata(key,value) VALUES ('api_resumen_version','1')''')
        con.commit()
        n = con.execute("SELECT COUNT(*) FROM resumen_semanal").fetchone()[0]
        global_count = con.execute("SELECT SUM(n) FROM resumen_semanal WHERE country_code='*'").fetchone()[0]
        print(f'OK: resumen_semanal={n:,} filas; global={global_count:,} celdas-dia-sensor',flush=True)
        print('ATENCION: asignacion geografica aproximada. VIIRS y MODIS NO estan armonizados.',flush=True)
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--bd',type=Path,default=HERE/'brasa_mundial.db')
    p.add_argument('--recrear',action='store_true',help='Borra SOLO las tablas derivadas y las reconstruye.')
    opts = p.parse_args()
    if opts.recrear:
        con = sqlite3.connect(str(opts.bd));
        for table in ('resumen_semanal','celda_pais','paises_ref'):
            con.execute(f'DROP TABLE IF EXISTS {table}')
        con.commit(); con.close()
    prepare(opts.bd)

if __name__ == '__main__':
    main()
