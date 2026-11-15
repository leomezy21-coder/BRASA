"""BRASA v3 - entrenamiento exploratorio de Ecuador en celdas 0.25°.

Muestrea celdas INDEPENDIENTEMENTE de su historial de incendios y recupera
las fechas de detecciones MODIS tipo 0 desde los CSV NASA FIRMS originales.
Solo lectura; no modifica brasa_mundial.db, Render ni scripts v1/v2.

IMPORTANTE: y=0 significa 'no hay detección FIRMS en los CSV disponibles',
NO prueba ausencia de incendios. Cuadrícula territorial Natural Earth 1:110m
referencial, omite Galápagos. POWER es meteorología de baja resolución.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

from preparar_datos import obtener_power, acumulado, etiqueta_futura, fechas, CAMPOS

HERE = Path(__file__).resolve().parent
RAIZ = HERE.parent.parent
RESOLUCIONES = (0.25, 0.5)


def contiene_anillo(lon: float, lat: float, ring: list) -> bool:
    dentro = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lon < (xj-xi)*(lat-yi)/(yj-yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def dentro_pais(lon: float, lat: float, multi: list) -> bool:
    # 'poligonos' usa el formato coordinates de GeoJSON MultiPolygon.
    for poligono in multi:
        if poligono and contiene_anillo(lon, lat, poligono[0]):
            if not any(contiene_anillo(lon, lat, hueco) for hueco in poligono[1:]):
                return True
    return False


def celdas_ecuador(geografia: Path, paso: float) -> list[tuple[int, int]]:
    if not geografia.is_file():
        raise RuntimeError(f'Archivo geográfico ausente: {geografia}')
    geo = json.loads(geografia.read_text(encoding='utf-8'))
    ecu = next((x for x in geo['paises'] if x['codigo'] == 'ECU'), None)
    if not ecu:
        raise RuntimeError('No hay geometría ECU en países de referencia')
    xmin, ymin, xmax, ymax = ecu['bbox']
    xs = range(math.floor(xmin/paso)-1, math.ceil(xmax/paso)+1)
    ys = range(math.floor(ymin/paso)-1, math.ceil(ymax/paso)+1)
    resultado = [(y,x) for y in ys for x in xs
                 if dentro_pais((x+0.5)*paso, (y+0.5)*paso, ecu['poligonos'])]
    if not resultado:
        raise RuntimeError('No se generaron celdas dentro de Ecuador.')
    return sorted(resultado)


def archivos_modis(carpeta: Path, desde: int, hasta: int):
    archivos = sorted(carpeta.glob('*.csv'))
    if not archivos:
        raise RuntimeError(f'No hay archivos CSV en {carpeta}')
    nombres_modis = [p for p in archivos
                     if re.search(r'modis|m-c61|mcd14dl', p.name, re.IGNORECASE)]
    if not nombres_modis:
        raise RuntimeError('No se reconocen CSV MODIS por nombre. Comprueba data/raw y envía los nombres; no mezclaremos sensores.')
    elegidos = []
    desc = False
    for p in nombres_modis:
        anios = {int(a) for a in re.findall(r'(?<!\d)(20\d{2})(?!\d)', p.name)}
        if anios and not any(desde-1 <= y <= hasta for y in anios):
            continue
        if not anios:
            desc = True
        elegidos.append(p)
    if desc:
        print('AVISO: algunos archivos no indican año en su nombre; se comprobarán las fechas interiores.',flush=True)
    if not elegidos:
        raise RuntimeError('No hay archivos MODIS candidatos al periodo.')
    return elegidos


def leer_eventos(carpeta: Path, seleccion: set, paso: float, desde: int, hasta: int):
    archivos = archivos_modis(carpeta, desde, hasta)
    datos = defaultdict(set)
    min_d = f'{desde-1}-12-01'
    max_d = f'{hasta}-12-31'
    vistas = 0
    validas = 0
    print(f'CSV MODIS seleccionados: {len(archivos)}; extracción incremental para {len(seleccion)} celdas.',flush=True)
    campos = {'latitude', 'longitude', 'acq_date', 'date', 'instrument', 'satellite', 'type'}
    for pos, archivo in enumerate(archivos, 1):
        print(f'  [{pos}/{len(archivos)}] {archivo.name}',flush=True)
        for lote in pd.read_csv(archivo, chunksize=35000,
                                 usecols=lambda c: c.strip().lower() in campos,
                                 encoding='utf-8-sig', low_memory=True):
            vistas += len(lote)
            lote.columns = [x.strip().lower() for x in lote.columns]
            fecha_col = 'acq_date' if 'acq_date' in lote else 'date' if 'date' in lote else None
            if not {'latitude','longitude'} <= set(lote.columns) or not fecha_col:
                raise RuntimeError(f'{archivo.name}: faltan latitude/longitude/acq_date.')
            lat = pd.to_numeric(lote['latitude'], errors='coerce')
            lon = pd.to_numeric(lote['longitude'], errors='coerce')
            fecha = lote[fecha_col].astype(str).str[:10]
            filtrado = (lat.between(-6, 3) & lon.between(-82, -74) &
                        fecha.between(min_d, max_d))
            if 'type' in lote.columns:
                filtrado &= pd.to_numeric(lote['type'],errors='coerce').eq(0)
            if 'instrument' in lote.columns:
                filtrado &= lote['instrument'].fillna('').astype(str).str.upper().str.contains('MODIS',regex=False)
            if not filtrado.any():
                continue
            for la, lo, dia in zip(lat[filtrado], lon[filtrado], fecha[filtrado]):
                cid = (math.floor(float(la)/paso),math.floor(float(lo)/paso))
                if cid in seleccion:
                    datos[cid].add(dia)
                    validas += 1
        print(f'     detecciones MODIS tipo 0 en celdas elegidas (acumulado): {validas:,}',flush=True)
    return datos,{'archivos':len(archivos),'filas_csv_leidas':vistas,
                  'detecciones_en_celdas_elegidas':validas}


def crear_dataset(args):
    if not (2018 <= args.desde <= 2020 and args.hasta == 2024):
        raise RuntimeError('Este piloto utiliza inicio 2018-2020, validacion 2022–2023, prueba 2024.')
    if args.resolucion not in RESOLUCIONES or args.max_celdas < 8:
        raise RuntimeError('Usa --resolucion 0.25 o 0.5 y --max-celdas >= 8')
    todas = celdas_ecuador(args.geografia,args.resolucion)
    if args.max_celdas > len(todas):
        print(f'Nota: máximo solicitado > celdas disponibles, se usarán {len(todas)}.',flush=True)
    aleatorias = random.Random(42).sample(todas,min(args.max_celdas,len(todas)))
    elegidas = sorted(aleatorias)
    print(f'Cuadrícula Ecuador continental: {len(todas)} celdas de {args.resolucion} grados.',flush=True)
    print(f'Muestreo espacial aleatorio fijo: {len(elegidas)} celdas, sin consultar previamente las etiquetas.',flush=True)
    activos, auditoria = leer_eventos(args.raw,set(elegidas),args.resolucion,args.desde,args.hasta)
    sin_fuego = sum(not activos.get(c) for c in elegidas)
    print(f'Celdas sin detecciones MODIS registradas en el periodo: {sin_fuego}/{len(elegidas)}',flush=True)
    if sin_fuego == 0:
        print('AVISO: ninguna celda elegida está completamente sin detecciones históricas. No atribuir ceros a ausencia de incendio.',flush=True)
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.salida.with_suffix('.tmp.csv')
    totales = Counter(); positivos = Counter(); omitidas = 0
    try:
        with tmp.open('w',newline='',encoding='utf-8') as f:
            wr=csv.DictWriter(f,fieldnames=CAMPOS)
            wr.writeheader()
            for numero,(cy,cx) in enumerate(elegidas,1):
                la=(cy+0.5)*args.resolucion
                lo=(cx+0.5)*args.resolucion
                print(f'NASA POWER [{numero}/{len(elegidas)}]: {la:+.3f}, {lo:+.3f}',flush=True)
                clima=obtener_power(la,lo,args.desde,args.hasta,args.cache,args.solo_cache)
                serie=activos.get((cy,cx),set())
                for dia in fechas(dt.date(args.desde,1,1),dt.date(args.hasta,12,24)):
                    if dia.year in (2021,2023) and (dia.month,dia.day) > (12,24):
                        continue
                    hoy=clima.get(dia.isoformat(),{})
                    if hoy.get('T2M_MAX') is None:
                        omitidas+=1;continue
                    t7=acumulado(clima,dia,'T2M',7,True)
                    h7=acumulado(clima,dia,'RH2M',7,True)
                    v7=acumulado(clima,dia,'WS2M',7,True)
                    p7=acumulado(clima,dia,'PRECTOTCORR',7)
                    p30=acumulado(clima,dia,'PRECTOTCORR',30)
                    if any(v is None for v in (t7,h7,v7,p7,p30)):
                        omitidas+=1;continue
                    part=('entrenamiento' if dia.year <=2021 else
                          'validacion' if dia.year <=2023 else 'prueba')
                    dd=dia.timetuple().tm_yday
                    obj=etiqueta_futura(serie,dia)
                    wr.writerow({'fecha':dia.isoformat(),'cell_y':cy,'cell_x':cx,'lat':la,'lon':lo,
                        'temp_max':round(hoy['T2M_MAX'],3),'temp_media_7d':round(t7,3),
                        'humedad_7d':round(h7,3),'viento_7d':round(v7,3),
                        'lluvia_7d':round(p7,3),'lluvia_30d':round(p30,3),
                        'fuegos_previos_7d':sum((dia-dt.timedelta(days=j)).isoformat() in serie for j in range(7)),
                        'fuegos_previos_30d':sum((dia-dt.timedelta(days=j)).isoformat() in serie for j in range(30)),
                        'dia_seno':round(math.sin(2*math.pi*dd/365.25),6),
                        'dia_cos':round(math.cos(2*math.pi*dd/365.25),6),
                        'objetivo':obj,'particion':part})
                    totales[part]+=1; positivos[part]+=obj
        for p in ('entrenamiento','validacion','prueba'):
            if totales[p]<100 or not(0<positivos[p]<totales[p]):
                raise RuntimeError(f'Partición {p} sin clases suficientes: {positivos[p]} positivos de {totales[p]}')
        tmp.replace(args.salida)
    finally:
        tmp.unlink(missing_ok=True)
    informe={'caracter':'EXPERIMENTO, NO VALIDADO PARA ALERTAS',
             'fuente_fuego':'NASA FIRMS CSV MODIS original, tipo 0',
             'fuente_clima':'NASA POWER Daily Point API',
             'limite_geografico':'Natural Earth 1:110m Ecuador continental aproximado (sin Galapagos)',
             'resolucion_celdas_grados':args.resolucion,
             'muestreo':'aleatorio espacial de celdas, semilla fija 42, sin consultar actividad',
             'celdas_candidatas':len(todas),'celdas_elegidas':len(elegidas),
             'celdas_sin_detecciones_registradas':sin_fuego,
             'archivos':auditoria,'particiones':{p:{'filas':totales[p],'positivas':positivos[p]} for p in totales},
             'filas_omitidas_clima':omitidas,
             'advertencias':['No detección != no incendio; sesgo por nubes y cobertura satelital.',
                'Uso retrospectivo del clima; no constituye pronóstico meteorológico.',
                'Se limita a Ecuador continental; no incluye Galápagos.',
                'Los días de una misma celda y celdas vecinas NO son independientes.',
                'NASA POWER tiene resolución más gruesa que 0.25 grados.',
                'No fusionar MODIS y VIIRS en esta fase; no usar para alertas públicas.']}
    args.salida.with_suffix('.metadata.json').write_text(json.dumps(informe,ensure_ascii=False,indent=2),encoding='utf-8')
    print('\nOK: dataset v3 creado:',args.salida.resolve(),flush=True)
    print(f'Celdas sin detección registrada: {sin_fuego}/{len(elegidas)}',flush=True)
    for p in ('entrenamiento','validacion','prueba'):
        print(f' {p}: {totales[p]:,} filas; {positivos[p]:,} positivas ({100*positivos[p]/totales[p]:.2f}%)',flush=True)
    print('No modifica los modelos v1/v2 ni Render.',flush=True)


def main():
    ap=argparse.ArgumentParser(description='BRASA v3: grid Ecuador a 0.25° desde originales FIRMS')
    ap.add_argument('--raw',type=Path,default=RAIZ/'data'/'raw')
    ap.add_argument('--geografia',type=Path,default=RAIZ/'backend'/'geografia'/'paises_referencia.json')
    ap.add_argument('--desde',type=int,default=2018)
    ap.add_argument('--hasta',type=int,default=2024)
    ap.add_argument('--resolucion',type=float,default=0.25)
    ap.add_argument('--max-celdas',type=int,default=32)
    ap.add_argument('--cache',type=Path,default=HERE/'cache_power')
    ap.add_argument('--salida',type=Path,default=HERE/'datos'/'entrenamiento_ecuador_025.csv')
    ap.add_argument('--solo-cache',action='store_true')
    args=ap.parse_args()
    try:
        crear_dataset(args)
    except (RuntimeError,ValueError) as exc:
        print(f'ERROR: {exc}',file=sys.stderr)
        raise SystemExit(1)

if __name__=='__main__':
    main()
