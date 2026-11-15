"""BRASA v0.20: crea una muestra espacial por semana desde brasa_mundial.db.

No vuelve a leer los 34 CSV ni altera la base original. Usa registros ya
agrupados por CELDA 1° / DIA / SENSOR. No recupera focos individuales NASA.

Ejemplo (desde backend):
 python exportar_mapa_mundial.py --origen brasa_mundial.db --salida brasa_mapa.db.gz

Selección acotada: 3 celdas-día de FRP más elevado + 2 de cobertura espacial
por país, semana ISO, familia de sensor, confianza y paso día/noche.
"""
from __future__ import annotations

import argparse
import gzip
import heapq
import math
import shutil
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

DEFAULT_PER_GROUP = 5


def push_top(heap: list, score: int | float, item: tuple, limit: int) -> None:
    if limit < 1:
        return
    candidate = (score, item)
    if len(heap) < limit:
        heapq.heappush(heap, candidate)
    elif candidate > heap[0]:
        heapq.heapreplace(heap, candidate)


def signature_spatial(year: int, cell_y: int, cell_x: int, day: int) -> int:
    # Hash espacial determinista que no depende de random/hash de Python.
    return ((cell_x * 73856093) ^ (cell_y * 19349663)
            ^ (day * 83492791) ^ (year * 123457)) & 0x7FFFFFFF


def exportar(origen: Path, salida: Path, max_por_grupo: int = DEFAULT_PER_GROUP,
             max_semanas: int = 0) -> None:
    origen = origen.resolve()
    salida = salida.resolve()
    temporal = salida.with_suffix('.db.tmp')
    temporal_gz = salida.with_suffix('.gz.tmp')
    if not origen.is_file():
        raise SystemExit(f'No existe la base fuente: {origen}')
    if any(p.exists() for p in (salida,temporal,temporal_gz)):
        raise SystemExit('Ya existe una salida/temporal. No se sobreescribe; cambia --salida o retira el temporal.')
    if not (1 <= max_por_grupo <= 15):
        raise SystemExit('--muestra debe estar entre 1 y 15')
    n_frp = (max_por_grupo + 1) // 2
    n_geo = max_por_grupo - n_frp
    if n_geo == 0 and max_por_grupo >= 2:
        n_geo = 1
        n_frp = max_por_grupo-1

    original = sqlite3.connect(str(origen), timeout=180)
    destino = sqlite3.connect(str(temporal), timeout=180)
    try:
        original.execute('PRAGMA busy_timeout=180000')
        original.execute('PRAGMA query_only=ON')
        required = {'hotspots','celda_pais','archivos_procesados','metadata'}
        tables = {r[0] for r in original.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not required.issubset(tables):
            raise RuntimeError('La BD fuente no tiene las tablas necesarias. Ejecuta primero preparar_consultas_mundiales.py.')
        total_csv = original.execute('SELECT COUNT(*) FROM archivos_procesados WHERE terminado=1').fetchone()[0]
        if total_csv != 34:
            raise RuntimeError(f'La BD fuente debe tener 34 CSV completos; tiene {total_csv}')
        resolution = original.execute("SELECT value FROM metadata WHERE key='resolucion_grados'").fetchone()
        if resolution is None or not math.isclose(float(resolution[0]),1.0):
            raise RuntimeError('Este exportador usa únicamente celdas de 1°')

        destino.executescript('''
            PRAGMA journal_mode=DELETE;
            PRAGMA synchronous=FULL;
            PRAGMA temp_store=FILE;
            CREATE TABLE mapa_muestras (
                year INTEGER NOT NULL, week INTEGER NOT NULL,
                country_code TEXT NOT NULL, sensor TEXT NOT NULL,
                date TEXT NOT NULL, cell_y INTEGER NOT NULL, cell_x INTEGER NOT NULL,
                lat REAL NOT NULL, lon REAL NOT NULL, frp REAL NOT NULL,
                confidence TEXT NOT NULL, daynight TEXT NOT NULL,
                PRIMARY KEY(year,week,country_code,sensor,date,cell_y,cell_x)
            ) WITHOUT ROWID;
            CREATE TABLE mapa_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        destino.executemany('INSERT INTO mapa_metadata VALUES (?,?)',[
            ('modelo','muestra_celda_1grado_dia_sensor'),
            ('resolucion_grados','1.0'),
            ('muestra_max_por_pais_semana_sensor_confianza_dianoche',str(max_por_grupo)),
            ('nota','Latitud/longitud son centros de celdas de 1 grado; FRP maximo de esa celda y dia. NO coordenadas individuales NASA.'),
        ])
        destino.commit()

        query = '''
            SELECT h.year,h.week,COALESCE(c.country_code,'SIN_PAIS'),
                   h.sensor,h.confidence,h.daynight,h.date,h.cell_y,h.cell_x,
                   h.lat,h.lon,h.frp
            FROM hotspots AS h
            LEFT JOIN celda_pais AS c
                ON h.cell_y=c.cell_y AND h.cell_x=c.cell_x
            ORDER BY h.year,h.week
        '''
        cursor = original.execute(query)
        key_week = None
        groups = {}
        processed = saved = total_weeks = 0
        INSERT = '''INSERT OR IGNORE INTO mapa_muestras
            (year,week,country_code,sensor,date,cell_y,cell_x,lat,lon,frp,confidence,daynight)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'''

        def flush_week() -> None:
            nonlocal saved,total_weeks
            if not groups:
                return
            chosen = []
            for a,b in groups.values():
                unique = {}
                for _, r in a + b:
                    # r contiene solo observaciones agregadas existentes (no inventadas).
                    unique[(r[4],r[5],r[6])] = r
                chosen.extend(unique.values())
            with destino:
                destino.executemany(INSERT,chosen)
            saved += len(chosen)
            total_weeks += 1
            if total_weeks % 26 == 0:
                print(f'  {total_weeks} semanas ISO procesadas; {saved:,} muestras espaciales',flush=True)
            groups.clear()

        print(f'Leyendo la base existente por semanas; máximo {max_por_grupo} muestras por grupo.',flush=True)
        for row in cursor:
            (year,week,country,sensor,confidence,daynight,date,
             cell_y,cell_x,lat,lon,frp) = row
            current = (year,week)
            if key_week is None:
                key_week = current
            elif current != key_week:
                flush_week()
                if max_semanas and total_weeks >= max_semanas:
                    break
                key_week = current
            processed += 1
            group = (country,sensor,confidence,daynight)
            if group not in groups:
                groups[group] = ([],[])
            top,geo = groups[group]
            record = (year,week,country,sensor,date,cell_y,cell_x,lat,lon,frp,confidence,daynight)
            push_top(top, float(frp), record, n_frp)
            if n_geo:
                push_top(geo, -signature_spatial(int(year),int(cell_y),int(cell_x),int(date[8:10])), record,n_geo)
        else:
            flush_week()

        destino.execute('CREATE INDEX idx_mapa_fecha ON mapa_muestras(date)')
        destino.commit()
        destino.execute('VACUUM')
        check = destino.execute('PRAGMA quick_check').fetchone()[0]
        rows = destino.execute('SELECT COUNT(*) FROM mapa_muestras').fetchone()[0]
        if check != 'ok' or rows < 1:
            raise RuntimeError(f'Integridad o contenido incorrectos: {check}, filas={rows}')
        print(f'OK: {processed:,} filas fuente examinadas; {rows:,} muestras seleccionadas; integridad {check}',flush=True)
    except BaseException:
        original.close()
        destino.close()
        temporal.unlink(missing_ok=True)
        temporal_gz.unlink(missing_ok=True)
        raise
    original.close()
    destino.close()
    with temporal.open('rb') as src, gzip.open(temporal_gz,'wb',compresslevel=7) as dst:
        shutil.copyfileobj(src,dst,length=2*1024*1024)
    tam = temporal_gz.stat().st_size / (1024**2)
    if tam >= 95:
        temporal_gz.unlink(missing_ok=True)
        temporal.unlink(missing_ok=True)
        raise SystemExit(f'Archivo comprimido {tam:.1f} MiB demasiado grande para GitHub. Vuelve a ejecutar con --muestra 2.')
    temporal_gz.replace(salida)
    temporal.unlink(missing_ok=True)
    print(f'Archivo creado: {salida} ({tam:.2f} MiB).')
    print('NO son focos individuales: son muestras de celdas de 1 grado por dia y sensor.',flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--origen',type=Path,default=Path('brasa_mundial.db'))
    p.add_argument('--salida',type=Path,default=Path('brasa_mapa.db.gz'))
    p.add_argument('--muestra',type=int,default=DEFAULT_PER_GROUP)
    p.add_argument('--semanas',type=int,default=0,help='Para prueba: leer solo N semanas ISO')
    opts=p.parse_args()
    exportar(opts.origen,opts.salida,opts.muestra,opts.semanas)

if __name__=='__main__':
    main()
