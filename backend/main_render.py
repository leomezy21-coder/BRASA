"""API experimental BRASA mundial; NO modifica el backend Ecuador original.

Levantar con: python -m uvicorn main_mundial:app --reload --port 8000
Metricas: presencia en celda 1°/dia/sensor, tipo=0. NO incendios individuales.
"""
from __future__ import annotations
from datetime import date, timedelta
import json
import os
import sqlite3
from pathlib import Path
from statistics import mean, pstdev
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
DB = Path(os.environ.get('BRASA_DB_PATH', str(HERE/'brasa_render.db')))
MAP_DB = Path(os.environ.get('BRASA_MAP_DB_PATH', str(HERE/'brasa_mapa.db')))
app = FastAPI(title='BRASA NASA FIRMS API Mundial (resumen para Render)',version='0.20')
app.add_middleware(CORSMiddleware,allow_origins=['*'],allow_methods=['GET','POST'],allow_headers=['*'])

class Filter(BaseModel):
    year_from: int = Field(default=2005,ge=2000,le=2100)
    year_to: int = Field(default=2025,ge=2000,le=2100)
    sensor: Literal['modis','viirs','harmonized'] = 'harmonized'
    confidence: Literal['all','nominal_high'] = 'all'
    daynight: Literal['all','D','N'] = 'all'
    country_code: str | None = None
    continent: str | None = None
    # Campos del FRONTEND Ecuador: se rechazan hasta que adapten filtros.
    province_id: str | None = None
    canton_id: str | None = None
    bbox: tuple[float,float,float,float] | None = None
    geojson: dict | None = None

class HotspotFilter(Filter):
    year: int | None = None
    week: int | None = Field(default=None,ge=1,le=53)
    date_from: str | None = None
    date_to: str | None = None


def connect():
    if not DB.exists():
        raise HTTPException(503,detail=f'Base no encontrada: {DB.name}')
    try:
        # Lectura solamente: asegura que nunca cambie la base durante consultas.
        con = sqlite3.connect(f'file:{DB.as_posix()}?mode=ro',uri=True,timeout=30)
        con.row_factory=sqlite3.Row
        return con
    except sqlite3.Error as exc:
        raise HTTPException(503,detail=str(exc))


def ready(con):
    if not con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='resumen_semanal'").fetchone():
        raise HTTPException(503,detail='Faltan los resúmenes. Ejecuta preparar_consultas_mundiales.py.')


def validate(f:Filter, for_points=False):
    if f.year_from > f.year_to or f.year_to-f.year_from>100:
        raise HTTPException(422,detail='Rango de años inválido')
    if f.province_id or f.canton_id:
        raise HTTPException(422,detail='La API mundial usa country_code (ISO3), no province_id/canton_id. Adaptar frontend.')
    if f.geojson is not None:
        raise HTTPException(422,detail='Filtrado por polígonos personalizados no implementado en la API mundial.')
    if f.bbox is not None:
        if not for_points:
            raise HTTPException(422,detail='bbox solo está disponible para /api/hotspots; estadísticas por bbox no implementadas.')
        a,b,c,d=f.bbox
        if a>c or b>d or not(-180<=a<=180 and -180<=c<=180 and -90<=b<=90 and -90<=d<=90):
            raise HTTPException(422,detail='bbox inválida')
    if f.country_code and f.continent:
        raise HTTPException(422,detail='Usa country_code o continent, no ambos.')


def filtered_where(f:Filter,alias='r'):
    validate(f)
    w=[f'{alias}.year BETWEEN ? AND ?']
    v=[f.year_from,f.year_to]
    if f.country_code:
        w.append(f'{alias}.country_code = ?')
        v.append(f.country_code.upper())
    elif f.continent:
        w.append(f'{alias}.country_code IN (SELECT country_code FROM paises_ref WHERE continent=?)')
        v.append(f.continent)
    else:
        w.append(f"{alias}.country_code = '*'")
    if f.sensor!='harmonized':
        w.append(f'{alias}.sensor = ?')
        v.append(f.sensor.upper())
    if f.confidence=='nominal_high':
        w.append(f"{alias}.confidence IN ('n','h')")
    if f.daynight!='all':
        w.append(f'{alias}.daynight = ?')
        v.append(f.daynight)
    return ' AND '.join(w),v


def weekly(f):
    with connect() as con:
        ready(con)
        where, vals=filtered_where(f)
        rows=con.execute(f'''SELECT r.year,r.week,SUM(r.n) AS n FROM resumen_semanal r
                WHERE {where} GROUP BY r.year,r.week ORDER BY r.year,r.week''',vals).fetchall()
    return {(int(r['year']),int(r['week'])):int(r['n']) for r in rows}


def weekly_full(f):
    counts=weekly(f)
    return {(y,w):counts.get((y,w),0) for y in range(f.year_from,f.year_to+1) for w in range(1,54)}


@app.get('/health')
def health():
    if not DB.exists():
        return {'status':'sin_base','db':False,'summary_ready':False}
    with connect() as con:
        prepared=con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='resumen_semanal'").fetchone() is not None
        completed=con.execute('SELECT COUNT(*) FROM archivos_procesados WHERE terminado=1').fetchone()[0]
    return {'status':'ok' if prepared and completed==34 else 'incompleto',
            'db':True,'summary_ready':prepared,'csv_completos':completed,
            'metrica':'presencia_celda_dia_sensor_1grado', 'map_ready':MAP_DB.is_file()}


@app.get('/api/metadata')
def metadata():
    return {'dataset':'NASA FIRMS / BRASA mundial (resumen espacial)',
            'coverage':'archivos MODIS y VIIRS disponibles, no equivale a cobertura completa por sensor',
            'metrica':'presencia de al menos una deteccion tipo 0 por celda de 1 grado, dia y familia de sensor',
            'limites':['No contar como incendios individuales',
                'MODIS y VIIRS NO estan armonizados ni son directamente comparables',
                'VIIRS S-NPP y NOAA-20 se agrupan en VIIRS y pueden fusionarse dentro de una misma celda-dia',
                'Paises asignados por centro de celda segun Natural Earth 1:110m: aproximacion',
                'Mapa: muestras limitadas de centros de celdas 1°, no ubicaciones exactas de focos NASA',
                'FRP muestra maximo de la celda-dia en la base original, no suma',
                'El año de las series es año ISO de la semana, no necesariamente año calendario',
                'La confianza/dia-noche se resumen por celda; los filtros no equivalen a filtrar pixeles originales']}


@app.get('/api/countries')
def countries():
    with connect() as con:
        ready(con)
        rows=con.execute('SELECT country_code,name,continent,lat,lon FROM paises_ref ORDER BY name').fetchall()
    return [dict(r) for r in rows]


@app.get('/api/regions')
def regions():
    # Mantiene la forma Region del frontend, pero las entidades SON PAISES.
    geo=json.loads((HERE/'geografia'/'paises_referencia.json').read_text(encoding='utf-8'))
    return [{'id':p['codigo'],'name':p['nombre'],
             'center':[(p['bbox'][1]+p['bbox'][3])/2,(p['bbox'][0]+p['bbox'][2])/2],
             'zoom':4, 'geojson':{'type':'MultiPolygon','coordinates':p['poligonos']},
             'cantons':[]} for p in geo['paises']]


@app.post('/api/calendar')
def calendar(f:Filter):
    counts=weekly_full(f)
    src={'modis':'MODIS','viirs':'VIIRS_CAL','harmonized':'BOTH'}[f.sensor]
    return {'unit':'fire_cell_days',
            'weeks':[{'year':y,'week':w,'value':float(n),'source':src}
                     for (y,w),n in counts.items()]}


@app.post('/api/climatology')
def climatology(f:Filter):
    vals=weekly_full(f)
    out=[]
    for w in range(1,54):
        arr=sorted(float(vals[(y,w)]) for y in range(f.year_from,f.year_to+1))
        def percentile(p):
            if not arr:return 0.0
            k=(len(arr)-1)*p
            lo=int(k);hi=min(len(arr)-1,lo+1)
            return round(arr[lo]+(arr[hi]-arr[lo])*(k-lo),1)
        out.append({'week':w,'mean':round(mean(arr),1),'p10':percentile(.1),
                    'p50':percentile(.5),'p90':percentile(.9)})
    return {'weeks':out}


@app.post('/api/season')
def season(f:Filter):
    counts=weekly_full(f)
    years=[]
    for y in range(f.year_from,f.year_to+1):
        arr={w:counts[(y,w)] for w in range(1,54)}
        total=sum(arr.values())
        if total==0:continue
        peak=max(arr,key=arr.get)
        threshold=arr[peak]*.2
        start=next((w for w in range(1,peak+1) if arr[w]>=threshold),peak)
        end=next((w for w in range(peak,54) if arr[w]<threshold),53)
        years.append({'year':y,'start_week':start,'peak_week':peak,'end_week':end,'total':float(total)})
    return {'years':years}


@app.post('/api/anomalies')
def anomalies(f:Filter):
    counts=weekly_full(f)
    items=[]
    for w in range(1,54):
        arr=[counts[(y,w)] for y in range(f.year_from,f.year_to+1)]
        av=mean(arr)
        sd=pstdev(arr)
        if sd<1e-10:continue
        for y,v in zip(range(f.year_from,f.year_to+1),arr):
            z=(v-av)/sd
            if z>=1.6 and v>5:
                # Percentil empírico (entre años), no un pronóstico.
                pct=round(sum(x<=v for x in arr)/len(arr)*100,1)
                items.append({'year':y,'week':w,'value':float(v),
                              'zscore':round(z,2),'percentile':pct})
    return {'items':sorted(items,key=lambda i:i['zscore'],reverse=True)}


@app.post('/api/current-status')
def current_status(f:Filter):
    counts=weekly_full(f)
    nonzero=[(y,w,n) for (y,w),n in counts.items() if n>0]
    if not nonzero:
        return {'week':0,'value':0.0,'percentile':0.0,'zscore':0.0,'level':'normal'}
    y,w,value=max(nonzero,key=lambda t:(t[0],t[1]))
    vals=[counts[(yr,w)] for yr in range(f.year_from,f.year_to+1)]
    avg=mean(vals);sd=pstdev(vals)
    z=(value-avg)/sd if sd>0 else 0.0
    percentile=round(sum(v<=value for v in vals)/len(vals)*100,1)
    level='inusual' if z>=2 or percentile>=90 else 'elevado' if z>=1 or percentile>=70 else 'normal'
    return {'year':y,'week':w,'value':float(value),'percentile':percentile,
            'zscore':round(z,2),'level':level}


@app.post('/api/hotspots')
def hotspots(f: HotspotFilter):
    """Devuelve muestras ESPACIALES de celdas-día 1°, no pixeles originales.

    Mantiene el contrato {points: [{lat,lon,date,frp,sensor}]} del frontend.
    Requiere año+semana ISO, o date_from+date_to (máx. 31 días).
    Filtra por country_code ISO3, sensor, confianza y dia/noche. MAX 5000.
    """
    validate(f,for_points=True)
    if not MAP_DB.is_file():
        raise HTTPException(503,detail='La capa espacial no esta desplegada. Ejecuta descomprimir_mapa.py.')
    if f.year is None and f.week is not None:
        raise HTTPException(422,detail='Indica year junto con week.')
    if f.year is not None and f.week is None and not (f.date_from and f.date_to):
        raise HTTPException(422,detail='Indica week junto con year o un rango date_from/date_to.')
    if f.year is not None and not(f.year_from <= f.year <= f.year_to):
        raise HTTPException(422,detail='year debe estar dentro de year_from/year_to.')
    if bool(f.date_from) != bool(f.date_to):
        raise HTTPException(422,detail='Indica ambos date_from y date_to.')
    if f.year is None and not f.date_from:
        raise HTTPException(422,detail='Indica year+week o date_from+date_to para evitar consultas masivas.')

    w=[];v=[]
    if f.year is not None:
        w.extend(['year=?','week=?']) if f.week is not None else w.append('year=?')
        v.append(f.year)
        if f.week is not None:
            v.append(f.week)
    if f.date_from:
        try:
            start=date.fromisoformat(f.date_from)
            end=date.fromisoformat(f.date_to)
        except (ValueError,TypeError):
            raise HTTPException(422,detail='Fechas invalidas. Usa YYYY-MM-DD.')
        if start > end or (end-start).days > 31:
            raise HTTPException(422,detail='El rango de fechas debe estar entre 0 y 31 dias.')
        w.append('date BETWEEN ? AND ?')
        v.extend([start.isoformat(),end.isoformat()])
    if f.country_code:
        w.append('country_code=?')
        v.append(f.country_code.upper())
    elif f.continent:
        with connect() as con:
            codes=[r[0] for r in con.execute('SELECT country_code FROM paises_ref WHERE continent=?',(f.continent,))]
        if not codes:
            return {'points':[], 'sampled':True, 'spatial_resolution_degrees':1.0}
        w.append('country_code IN ('+','.join(['?']*len(codes))+')')
        v.extend(codes)
    if f.sensor != 'harmonized':
        w.append('sensor=?')
        v.append(f.sensor.upper())
    if f.confidence == 'nominal_high':
        w.append("confidence IN ('n','h')")
    if f.daynight in ('D','N'):
        # B significa que en esa celda-día hubo pasos diurnos Y nocturnos.
        w.append('daynight IN (?,?)')
        v.extend([f.daynight,'B'])
    if f.bbox:
        left,bottom,right,top=f.bbox
        w.extend(['lon BETWEEN ? AND ?','lat BETWEEN ? AND ?'])
        v.extend([left,right,bottom,top])
    query=('SELECT lat,lon,date,frp,sensor FROM mapa_muestras WHERE '
           + ' AND '.join(w) + ' ORDER BY frp DESC,date DESC LIMIT 5000')
    try:
        with sqlite3.connect(MAP_DB.resolve().as_uri()+'?mode=ro',uri=True,timeout=30) as con:
            rows=con.execute(query,v).fetchall()
    except sqlite3.Error as exc:
        raise HTTPException(503,detail=f'Error de acceso a mapa espacial: {exc}')
    return {'points':[{'lat':float(lat),'lon':float(lon),'date':dia,
                       'frp':float(frp),'sensor':sensor} for lat,lon,dia,frp,sensor in rows],
            'sampled':True,'spatial_resolution_degrees':1.0,'limit':5000,
            'representation':'muestra de centros de celdas de 1 grado por dia y sensor',
            'note':'No son focos individuales NASA FIRMS. FRP es maximo de celda-dia. '
                   'La muestra espacial no permite interpretar distribuciones exhaustivas.'}
