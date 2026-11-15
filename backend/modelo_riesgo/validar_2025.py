"""BRASA v8 - evaluación temporal 2025 independiente, exclusivamente retrospectiva.

Reutiliza el modelo de regresión logística SIN FWI elegido con los datos 2018-2024
antes de consultar 2025. Lee CSV originales NASA FIRMS (MODIS, type 0), controla
cobertura mundial diaria y obtiene clima de NASA POWER 2025 con cache local.

NO reentrena, NO cambia Render, NO afirma predecir incendios reales.
No publica automáticamente el resultado en internet.

Uso desde backend/modelo_riesgo:
 python validar_2025.py
"""
from __future__ import annotations

import argparse
from collections import defaultdict, Counter
from datetime import date, timedelta
import json
import math
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, roc_auc_score, average_precision_score

from preparar_datos import obtener_power, acumulado, etiqueta_futura
from preparar_datos_v3 import archivos_modis

BASE = Path(__file__).resolve().parent
INICIO = date(2025, 1, 1)
FIN = date(2025, 12, 24)  # 7 días siguientes permanecen dentro de 2025
RESOLUCION = 0.25


def extraer_modis_csv(carpeta: Path, celdas: set[tuple[int,int]]):
    if not carpeta.is_dir():
        raise RuntimeError(f'Carpeta FIRMS ausente: {carpeta}')
    archivos = archivos_modis(carpeta, 2025, 2025)
    historial = defaultdict(set)
    cubiertas = set()  # cobertura temporal de MODIS en los archivos a escala mundial
    detecciones = 0
    total_csv = 0
    print(f'Leyendo {len(archivos)} CSV MODIS sin cargar archivos completos en memoria.', flush=True)
    for num, archivo in enumerate(archivos, 1):
        por_archivo = 0
        for chunk in pd.read_csv(
            archivo, chunksize=50000, encoding='utf-8-sig', low_memory=True,
            usecols=lambda col: col.strip().lower() in {
                'latitude', 'longitude', 'acq_date', 'date', 'type', 'instrument'
            }
        ):
            chunk.columns = [x.strip().lower() for x in chunk.columns]
            fcol = 'acq_date' if 'acq_date' in chunk else 'date' if 'date' in chunk else None
            if fcol is None or not {'latitude', 'longitude'} <= set(chunk.columns):
                raise RuntimeError(f'{archivo.name}: faltan acq_date o latitud/longitud.')
            fecha = chunk[fcol].astype(str).str[:10]
            period = fecha.between('2024-12-01', '2025-12-31')
            if 'instrument' in chunk:
                period &= chunk['instrument'].fillna('').astype(str).str.upper().str.contains('MODIS', regex=False)
            if not period.any():
                continue
            cubiertas.update(fecha[period].unique())
            lat = pd.to_numeric(chunk['latitude'], errors='coerce')
            lon = pd.to_numeric(chunk['longitude'], errors='coerce')
            selected = period & lat.between(-6, 3) & lon.between(-82, -74)
            if 'type' in chunk:
                selected &= pd.to_numeric(chunk['type'], errors='coerce').eq(0)
            if not selected.any():
                continue
            for la, lo, fecha_str in zip(lat[selected], lon[selected], fecha[selected]):
                cy = math.floor(float(la) / RESOLUCION)
                cx = math.floor(float(lo) / RESOLUCION)
                if (cy, cx) in celdas:
                    historial[(cy, cx)].add(fecha_str)
                    detecciones += 1
                    por_archivo += 1
        total_csv += 1
        print(f'[{num}/{len(archivos)}] {archivo.name}: detecciones de celdas elegidas={por_archivo:,}', flush=True)
    dias_2025 = {d for d in cubiertas if '2025-01-01' <= d <= '2025-12-31'}
    total_dias = (date(2025,12,31)-INICIO).days + 1
    print(f'Cobertura temporal mundial MODIS 2025: {len(dias_2025)}/{total_dias} fechas en CSV.', flush=True)
    if len(dias_2025) < 350 or '2025-12-31' not in dias_2025:
        raise RuntimeError('Cobertura 2025 insuficiente o el año está incompleto. NO interpretar días faltantes como ausencia de incendios. Revisa CSV originales.')
    return historial, cubiertas, {'archivos':total_csv, 'fechas_2025':len(dias_2025), 'detecciones_seleccionadas':detecciones}


def evaluar(y, p):
    if len(y) < 100 or len(set(y)) != 2:
        raise RuntimeError('Prueba insuficiente o con una sola clase; no se pueden validar probabilidades.')
    return {
        'ejemplos':len(y), 'positivos':int(np.sum(y)),
        'prevalencia':round(float(np.mean(y)),6),
        'brier':round(float(brier_score_loss(y,p)),6),
        'roc_auc':round(float(roc_auc_score(y,p)),6),
        'average_precision':round(float(average_precision_score(y,p)),6),
        'probabilidad_media':round(float(np.mean(p)),6),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--raw',type=Path,default=BASE.parent.parent/'data'/'raw')
    parser.add_argument('--datos-base',type=Path,default=BASE/'datos'/'entrenamiento_ecuador_96_fwi.csv')
    parser.add_argument('--modelo',type=Path,default=BASE/'salidas'/'v6_96'/'original'/'temporal'/'modelo_lightgbm.joblib')
    parser.add_argument('--comparacion',type=Path,default=BASE/'salidas'/'v6_96'/'comparacion.json')
    parser.add_argument('--cache',type=Path,default=BASE/'cache_power')
    parser.add_argument('--salida',type=Path,default=BASE/'salidas'/'v8_test_independiente_2025')
    parser.add_argument('--solo-cache', action='store_true',help='No conectar con NASA POWER')
    args=parser.parse_args()
    for p in (args.datos_base,args.modelo,args.comparacion):
        if not p.is_file():
            raise RuntimeError(f'Archivo requerido ausente: {p}')

    comparacion=json.loads(args.comparacion.read_text(encoding='utf-8'))
    modelos=comparacion.get('resultados',{})
    # Validar que evaluamos el modelo ganador de v7 por Brier geográfico sin mirar 2025.
    candidatos=[]
    for variante in ('original','con_fwi'):
        geo=modelos.get(variante,{}).get('geografia_2024',{})
        for nombre in ('regresion_logistica','lightgbm_calibrado'):
            m=geo.get(nombre,{})
            if 'brier' in m:
                candidatos.append((float(m['brier']),variante,nombre))
    if not candidatos:
        raise RuntimeError('No se encuentran métricas de 2024 para seleccionar un modelo.')
    ganador=min(candidatos)
    if ganador[1:] != ('original','regresion_logistica'):
        raise RuntimeError(f'En este experimento el ganador 2024 no coincide con regresion_logistica/original: {ganador}. No se cambia de modelo automáticamente.')

    artefacto=joblib.load(args.modelo)  # exclusivamente generado en este proyecto
    features=artefacto.get('features',[])
    modelo=artefacto.get('regresion_logistica')
    if modelo is None or not features or any('fwi' in x.lower() for x in features):
        raise RuntimeError('El archivo no contiene la regresión logística sin FWI esperada.')
    base=pd.read_csv(args.datos_base,usecols=lambda c:c in {'cell_y','cell_x','lat','lon'})
    # Los centros provienen exclusivamente de 2018–2024, jamás del resultado 2025.
    celdas=base[['cell_y','cell_x','lat','lon']].drop_duplicates().sort_values(['cell_y','cell_x'])
    ids={(int(r.cell_y),int(r.cell_x)) for r in celdas.itertuples(index=False)}
    if not (8<=len(ids)<=400) or len(celdas)!=len(ids):
        raise RuntimeError('La base no contiene una cuadrícula de celdas única y válida.')
    for r in celdas.itertuples(index=False):
        expected_lat=(int(r.cell_y)+.5)*RESOLUCION
        expected_lon=(int(r.cell_x)+.5)*RESOLUCION
        if abs(float(r.lat)-expected_lat)>1e-6 or abs(float(r.lon)-expected_lon)>1e-6:
            raise RuntimeError('Coordenadas inconsistentes con cuadrícula 0.25°.')
    print(f'Modelo FIJO por validación 2024: regresión logística SIN FWI. Celdas: {len(ids)}.',flush=True)

    fuego, disponibilidad, auditoria = extraer_modis_csv(args.raw,ids)
    dias_sin_observacion = sorted((INICIO+timedelta(days=i)).isoformat() for i in range(365)
                                     if (INICIO+timedelta(days=i)).isoformat() not in disponibilidad)
    if dias_sin_observacion:
        print(f'AVISO: días sin cobertura global: {len(dias_sin_observacion)}. Se excluirán ventanas afectadas.',flush=True)
    filas=[]
    n_sin_clima=n_sin_cobertura=0
    for i,r in enumerate(celdas.itertuples(index=False),1):
        lat,lon=float(r.lat),float(r.lon)
        celda=(int(r.cell_y),int(r.cell_x))
        print(f'NASA POWER 2025 [{i}/{len(celdas)}]: ({lat:+.3f}, {lon:+.3f})',flush=True)
        clima=obtener_power(lat,lon,2025,2025,args.cache,args.solo_cache)
        serie=fuego.get(celda,set())
        for off in range((FIN-INICIO).days+1):
            dia=INICIO+timedelta(days=off)
            # Ventana completa tanto antes como después, solo con fechas MODIS cubiertas.
            if any((dia+timedelta(days=j)).isoformat() not in disponibilidad for j in range(-29,8)):
                n_sin_cobertura+=1
                continue
            hoy=clima.get(dia.isoformat(),{})
            tmax=hoy.get('T2M_MAX')
            t7=acumulado(clima,dia,'T2M',7,True)
            h7=acumulado(clima,dia,'RH2M',7,True)
            v7=acumulado(clima,dia,'WS2M',7,True)
            p7=acumulado(clima,dia,'PRECTOTCORR',7)
            p30=acumulado(clima,dia,'PRECTOTCORR',30)
            if any(x is None for x in (tmax,t7,h7,v7,p7,p30)):
                n_sin_clima+=1;continue
            dd=dia.timetuple().tm_yday
            fila={
                'fecha':dia.isoformat(), 'cell_y':celda[0], 'cell_x':celda[1],
                'lat':lat,'lon':lon,'temp_max':tmax,'temp_media_7d':t7,
                'humedad_7d':h7,'viento_7d':v7,'lluvia_7d':p7,'lluvia_30d':p30,
                'fuegos_previos_7d':sum((dia-timedelta(days=j)).isoformat() in serie for j in range(7)),
                'fuegos_previos_30d':sum((dia-timedelta(days=j)).isoformat() in serie for j in range(30)),
                'dia_seno':round(math.sin(2*math.pi*dd/365.25),6),
                'dia_cos':round(math.cos(2*math.pi*dd/365.25),6),
                'objetivo':etiqueta_futura(serie,dia),
            }
            filas.append(fila)
    df=pd.DataFrame(filas)
    if len(df)<500 or df.objetivo.nunique()<2:
        raise RuntimeError(f'Sin filas suficientes o sin dos clases en 2025: {len(df)}. Revisa cobertura y datos.')
    if not set(features)<=set(df.columns):
        raise RuntimeError(f'Faltan variables requeridas: {set(features)-set(df.columns)}')
    p=np.clip(modelo.predict_proba(df[features])[:,1],1e-7,1-1e-7)
    y=df.objetivo.astype(int).values

    met=evaluar(y,p)
    base_2024 = json.loads((args.modelo.parent/'metricas.json').read_text(encoding='utf-8'))
    base_prob=float(base_2024['resultados_prueba_2024']['baseline_tasa_historica']['probabilidad_media'])
    p_ref=np.full(len(df),base_prob)
    mref=evaluar(y,p_ref)
    df['probabilidad_deteccion_7d']=p
    args.salida.mkdir(parents=True,exist_ok=True)
    df[['fecha','cell_y','cell_x','lat','lon','objetivo','probabilidad_deteccion_7d']].to_csv(args.salida/'predicciones_2025.csv',index=False)
    bins=np.linspace(0,1,11)
    df['decila_probabilidad']=pd.cut(p,bins,include_lowest=True).astype(str)
    calib=df.groupby('decila_probabilidad',observed=True).agg(ejemplos=('objetivo','size'),
         tasa_observada=('objetivo','mean'),probabilidad_media=('probabilidad_deteccion_7d','mean'))
    calib.to_csv(args.salida/'calibracion_2025.csv')
    result={
        'descripcion':'PRUEBA EXPLORATORIA INDEPENDIENTE 2025, Ecuador continental, muestra de celdas 0.25°',
        'objetivo':'P(detección satelital MODIS en los próximos 7 días; NO incendio real)',
        'modelo_fijado_antes_de_2025':'regresion_logistica SIN FWI entrenada 2018-2021, evaluada/calibrada 2022-2023, elegida en 2024',
        'total_celdas':len(ids),'cobertura_firms':auditoria,
        'fechas_firms_globales_faltantes_2025':dias_sin_observacion,
        'filas_omitidas_sin_cobertura':n_sin_cobertura,'filas_omitidas_sin_clima':n_sin_clima,
        'periodo_2025':{'desde':str(df.fecha.min()),'hasta':str(df.fecha.max())},
        'modelo':met,'referencia_tasa_entrenamiento':mref,
        'advertencias':[
            'FIRMS sin detección no confirma ausencia de fuego (nubes, sensor, paso satelital).',
            'No se evaluó Ecuador completo ni áreas fuera de la muestra fija; sin inferencias para Chimborazo exacto.',
            'Las predicciones son retrospectivas usando NASA POWER de 2025, NO pronósticos meteorológicos futuros.',
            'No volver a ajustar el modelo ni sus hiperparámetros mirando el test 2025.',
            'Un ROC-AUC alto NO es tasa de aciertos, ni probabilidad de incendios reales.',
            'No utilizar para alertas públicas sin validación independiente adicional.',
        ],
    }
    (args.salida/'metricas_2025.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print('\n=== BRASA 2025 - PRUEBA TEMPORAL NO USADA PARA ELEGIR MODELO ===',flush=True)
    print(f"Filas: {met['ejemplos']:,}; positivos: {met['positivos']:,} ({100*met['prevalencia']:.2f}%).")
    print(f"Regresión logística: Brier={met['brier']:.5f} | ROC-AUC={met['roc_auc']:.5f} | AP={met['average_precision']:.5f}")
    print(f"Referencia: Brier={mref['brier']:.5f} | ROC-AUC={mref['roc_auc']:.5f} | AP={mref['average_precision']:.5f}")
    print('Reporte:', (args.salida/'metricas_2025.json').resolve())
    print('No se modificó el modelo, GitHub ni Render.')

if __name__=='__main__':
    try:
        main()
    except (RuntimeError,ValueError,FileNotFoundError,KeyError) as e:
        print(f'ERROR: {e}',file=sys.stderr)
        sys.exit(1)
