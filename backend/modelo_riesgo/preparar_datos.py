"""BRASA | Piloto experimental de predicción de detecciones FIRMS.

Lee brasa_mundial.db EN MODO LECTURA y consulta NASA POWER por coordenadas.
No altera bases existentes ni simula observaciones meteorológicas.
Objetivo: actividad MODIS en una celda de 1 grado en los 7 días SIGUIENTES.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point'
PARAMETROS = ('T2M_MAX', 'T2M', 'RH2M', 'WS2M', 'PRECTOTCORR')
CAMPOS = ['fecha', 'cell_y', 'cell_x', 'lat', 'lon', 'temp_max', 'temp_media_7d',
          'humedad_7d', 'viento_7d', 'lluvia_7d', 'lluvia_30d',
          'fuegos_previos_7d', 'fuegos_previos_30d', 'dia_seno', 'dia_cos',
          'objetivo', 'particion']


def args_cli():
    p = argparse.ArgumentParser(description='Crea datos de entrenamiento reales para BRASA (piloto Ecuador).')
    p.add_argument('--db', type=Path, default=Path('../brasa_mundial.db'))
    p.add_argument('--pais', default='ECU', help='Código ISO3. Piloto diseñado para Ecuador.')
    p.add_argument('--desde', type=int, default=2018)
    p.add_argument('--hasta', type=int, default=2024)
    p.add_argument('--max-celdas', type=int, default=8, help='8 por defecto; 0 para todas (después del piloto)')
    p.add_argument('--cache', type=Path, default=Path('cache_power'))
    p.add_argument('--salida', type=Path, default=Path('datos/entrenamiento_ecuador.csv'))
    p.add_argument('--solo-cache', action='store_true', help='No usar la red; fallará si faltan respuestas NASA POWER')
    return p.parse_args()


def fechas(d0, d1):
    actual = d0
    while actual <= d1:
        yield actual
        actual += dt.timedelta(days=1)


def leer_fuego(db: Path, pais: str, desde: int, hasta: int):
    if not db.is_file():
        raise RuntimeError(f'No existe la base fuente: {db}')
    # URIs sqlite en Windows: usar URI Path.as_uri() para acceso de solo lectura.
    con = sqlite3.connect(f'{db.resolve().as_uri()}?mode=ro', uri=True, timeout=120)
    con.execute('PRAGMA query_only=ON')
    tablas = {r[0] for r in con.execute('SELECT name FROM sqlite_master WHERE type="table"')}
    if not {'hotspots', 'celda_pais'} <= tablas:
        con.close()
        raise RuntimeError('La BD no contiene hotspots + celda_pais. Se requiere brasa_mundial.db.')
    d_ini = f'{desde - 1}-12-01'
    d_fin = f'{hasta}-12-31'
    q = '''SELECT h.cell_y,h.cell_x,h.lat,h.lon,h.date
           FROM hotspots h JOIN celda_pais c
           ON h.cell_y=c.cell_y AND h.cell_x=c.cell_x
           WHERE c.country_code=? AND h.sensor='MODIS'
             AND h.date BETWEEN ? AND ?'''
    celdas = {}
    contador = Counter()
    filas = 0
    for cy, cx, lat, lon, fecha in con.execute(q, (pais.upper(), d_ini, d_fin)):
        if not fecha or len(fecha) < 10:
            continue
        cid = (int(cy), int(cx))
        item = celdas.setdefault(cid, {'lat': float(lat), 'lon': float(lon), 'fechas': set()})
        item['fechas'].add(fecha[:10])
        if f'{desde}-01-01' <= fecha[:10] < f'{min(desde+4, hasta)}-01-01':
            contador[cid] += 1
        filas += 1
    con.close()
    print(f'Leídos {filas:,} registros agregados MODIS para {pais}; {len(celdas)} celdas con historial.')
    if not celdas:
        raise RuntimeError('No se hallaron celdas. Revisa código de país, sensor y periodo.')
    return celdas, contador


def obtener_power(lat, lon, anio_ini, anio_fin, cache: Path, solo_cache=False):
    cache.mkdir(parents=True, exist_ok=True)
    cache_file = cache / f'power_{lat:+07.3f}_{lon:+08.3f}_{anio_ini}_{anio_fin}.json'
    if cache_file.exists():
        data = json.loads(cache_file.read_text(encoding='utf-8'))
    else:
        if solo_cache:
            raise RuntimeError(f'Sin archivo de POWER: {cache_file.name}')
        params = {'parameters': ','.join(PARAMETROS), 'community': 'AG',
                  'longitude': str(lon), 'latitude': str(lat),
                  'start': f'{anio_ini-1}1201', 'end': f'{anio_fin}1231',
                  'format': 'JSON', 'time-standard': 'UTC'}
        url = POWER_URL + '?' + urllib.parse.urlencode(params)
        # Un punto por celda del mapa, sin solicitudes duplicadas.
        ultima = None
        for intento in range(4):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'BRASA-Academic-Research/1.0'})
                with urllib.request.urlopen(req, timeout=180) as response:
                    data = json.load(response)
                break
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                ultima = exc
                if intento == 3:
                    raise RuntimeError(f'NASA POWER falló para ({lat},{lon}): {ultima}') from exc
                pausa = 5 * (2 ** intento)
                print(f'  Reintento NASA POWER {intento+1}/3, pausa {pausa} s: {exc}', flush=True)
                time.sleep(pausa)
        if 'properties' not in data or 'parameter' not in data['properties']:
            raise RuntimeError('La API POWER no devolvió properties.parameter válido. No se usarán datos inventados.')
        cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        time.sleep(1)  # Trato responsable de la API pública
    info = data.get('properties', {}).get('parameter', {})
    for param in PARAMETROS:
        if param not in info:
            raise RuntimeError(f'Falta {param} en NASA POWER para ({lat},{lon}).')
    por_dia = {}
    fechas_union = set().union(*(set(info[k]) for k in PARAMETROS))
    for fecha in fechas_union:
        if not (isinstance(fecha, str) and len(fecha) == 8 and fecha.isdigit()):
            continue
        valores = []
        for parametro in PARAMETROS:
            v = info[parametro].get(fecha)
            if v is None or not isinstance(v, (int, float)) or not math.isfinite(v) or v <= -900:
                valores.append(None)
            else:
                valores.append(float(v))
        por_dia[f'{fecha[:4]}-{fecha[4:6]}-{fecha[6:8]}'] = dict(zip(PARAMETROS, valores))
    return por_dia


def acumulado(serie, hoy, nombre, n, promedio=False):
    valores = []
    for i in range(n):
        fecha = (hoy - dt.timedelta(days=i)).isoformat()
        punto = serie.get(fecha)
        v = punto.get(nombre) if punto else None
        if v is None:
            return None
        valores.append(v)
    return sum(valores)/n if promedio else sum(valores)


def etiqueta_futura(fechas_activas, hoy):
    return int(any((hoy + dt.timedelta(days=j)).isoformat() in fechas_activas for j in range(1, 8)))


def main():
    args = args_cli()
    if args.desde < 2005 or args.hasta <= args.desde or args.hasta > 2025:
        raise RuntimeError('Usa al menos 2 años entre 2005 y 2025; para este piloto: 2018–2024.')
    if args.max_celdas < 0:
        raise RuntimeError('--max-celdas debe ser 0 (todas) o mayor que 0.')
    if args.hasta < 2024 or args.desde > 2020:
        raise RuntimeError('Este primer piloto requiere entrenamiento 2018–2021, validación 2022–2023 y prueba 2024.')
    celdas, contador = leer_fuego(args.db, args.pais, args.desde, args.hasta)
    # Solo ordenar celdas por actividad ANTERIOR a validación/prueba para no usar etiquetas futuras.
    orden = sorted(celdas, key=lambda k: (-contador[k], k))
    elegidas = orden[:args.max_celdas] if args.max_celdas else orden
    print(f'Piloto: {len(elegidas)} de {len(celdas)} celdas. Se seleccionan por actividad histórica PREVIA a 2022.')
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    args.cache.mkdir(parents=True, exist_ok=True)
    temp = args.salida.with_suffix('.csv.tmp')
    total = Counter()
    positivas = Counter()
    omitidas = 0
    try:
        with temp.open('w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=CAMPOS)
            writer.writeheader()
            for i, cid in enumerate(elegidas, 1):
                cell = celdas[cid]
                lat, lon = cell['lat'], cell['lon']
                print(f'[{i}/{len(elegidas)}] NASA POWER, centro celda: {lat}, {lon}', flush=True)
                weather = obtener_power(lat, lon, args.desde, args.hasta, args.cache, args.solo_cache)
                activos = cell['fechas']
                for dia in fechas(dt.date(args.desde, 1, 1), dt.date(args.hasta, 12, 24)):
                    # No cruzar horizonte de evaluación entre particiones.
                    if (dia.year == 2021 or dia.year == 2023) and (dia.month, dia.day) > (12, 24):
                        continue
                    actual = weather.get(dia.isoformat(), {})
                    if actual.get('T2M_MAX') is None:
                        omitidas += 1
                        continue
                    t7 = acumulado(weather, dia, 'T2M', 7, promedio=True)
                    h7 = acumulado(weather, dia, 'RH2M', 7, promedio=True)
                    v7 = acumulado(weather, dia, 'WS2M', 7, promedio=True)
                    p7 = acumulado(weather, dia, 'PRECTOTCORR', 7)
                    p30 = acumulado(weather, dia, 'PRECTOTCORR', 30)
                    if any(x is None for x in (t7, h7, v7, p7, p30)):
                        omitidas += 1
                        continue
                    part = ('entrenamiento' if dia.year <= 2021 else
                            'validacion' if dia.year <= 2023 else 'prueba')
                    d_o_y = dia.timetuple().tm_yday
                    objetivo = etiqueta_futura(activos, dia)
                    writer.writerow({
                        'fecha': dia.isoformat(), 'cell_y': cid[0], 'cell_x': cid[1],
                        'lat': lat, 'lon': lon,
                        'temp_max': round(actual['T2M_MAX'], 3),
                        'temp_media_7d': round(t7, 3),
                        'humedad_7d': round(h7, 3), 'viento_7d': round(v7, 3),
                        'lluvia_7d': round(p7, 3), 'lluvia_30d': round(p30, 3),
                        'fuegos_previos_7d': sum((dia-dt.timedelta(days=j)).isoformat() in activos for j in range(0,7)),
                        'fuegos_previos_30d': sum((dia-dt.timedelta(days=j)).isoformat() in activos for j in range(0,30)),
                        'dia_seno': round(math.sin(2 * math.pi * d_o_y/365.25), 6),
                        'dia_cos': round(math.cos(2 * math.pi * d_o_y/365.25), 6),
                        'objetivo': objetivo, 'particion': part,
                    })
                    total[part] += 1
                    positivas[part] += objetivo
        if not all(total[x] > 0 for x in ('entrenamiento', 'validacion', 'prueba')):
            raise RuntimeError(f'Particiones insuficientes: {dict(total)}')
        if any(positivas[x] == 0 or positivas[x] == total[x] for x in total):
            raise RuntimeError(f'Las particiones no contienen ambas clases. Ajusta --max-celdas o revisa cobertura: {dict(positivas)} / {dict(total)}')
        temp.replace(args.salida)
    finally:
        temp.unlink(missing_ok=True)
    manifest = {
        'tipo': 'PILOTO_NO_VALIDADO', 'origen_fuego': str(args.db),
        'origen_clima': 'NASA POWER Daily Point API (UTC)',
        'sensor': 'MODIS', 'pais': args.pais.upper(),
        'resolucion': 'celdas de 1 grado con país aproximado por centro',
        'objetivo': 'deteccion MODIS en siguientes 7 dias, NO incendio real',
        'celdas_utilizadas': len(elegidas), 'celdas_disponibles_con_fuego': len(celdas),
        'particiones': {s: {'filas': total[s], 'positivos': positivas[s]} for s in total},
        'filas_omitidas_por_clima': omitidas,
        'advertencias': ['Celdas seleccionadas por actividad historica; sesgo de seleccion.',
                         'Sin deteccion FIRMS no demuestra que no haya habido incendio.',
                         'Celdas sin cobertura de sensor tampoco se distinguen.',
                         'Nunca utilizar el dataset de Render muestreado para entrenar.',
                         'Temperatura y humedad POWER son promedios de reanalisis meteorologico, no sensores locales.']
    }
    args.salida.with_suffix('.metadata.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\nOK: dataset REAL creado:', args.salida.resolve())
    for s in ('entrenamiento','validacion','prueba'):
        print(f' {s}: {total[s]:,} filas; {positivas[s]:,} positivas ({100*positivas[s]/total[s]:.2f}%)')
    print('No se ha entrenado aún ni desplegado ningún modelo.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, sqlite3.Error) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        sys.exit(1)
