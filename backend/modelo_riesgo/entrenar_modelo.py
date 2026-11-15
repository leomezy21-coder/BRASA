"""Entrenamiento LightGBM, regresión logística y baseline. Separación temporal estricta.
Genera métricas con datos no vistos. No declara modelo confiable automáticamente.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
from lightgbm import LGBMClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

FEATURES = ['lat', 'lon', 'temp_max', 'temp_media_7d', 'humedad_7d', 'viento_7d',
            'lluvia_7d', 'lluvia_30d', 'fuegos_previos_7d', 'fuegos_previos_30d',
            'dia_seno', 'dia_cos']


def evaluar(y, p):
    y = np.asarray(y, dtype=int)
    p = np.clip(np.asarray(p, dtype=float), 1e-7, 1 - 1e-7)
    return {'ejemplos': len(y), 'positivos': int(y.sum()),
            'tasa_real': round(float(y.mean()), 5),
            'brier_menor_es_mejor': round(float(brier_score_loss(y, p)), 6),
            'average_precision_mayor_es_mejor': round(float(average_precision_score(y, p)), 6),
            'roc_auc': round(float(roc_auc_score(y, p)), 6) if len(np.unique(y)) == 2 else None,
            'probabilidad_media': round(float(p.mean()), 5)}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--datos', type=Path, default=Path('datos/entrenamiento_ecuador.csv'))
    ap.add_argument('--salida', type=Path, default=Path('salidas'))
    args=ap.parse_args()
    if not args.datos.is_file():
        raise SystemExit(f'No existe {args.datos}. Ejecuta preparar_datos.py primero.')
    df=pd.read_csv(args.datos)
    faltan = set(FEATURES + ['fecha','objetivo','particion']) - set(df.columns)
    if faltan:
        raise SystemExit(f'Columnas ausentes: {faltan}')
    if df[FEATURES].isnull().any().any():
        raise SystemExit('No se permiten valores meteorológicos nulos en este piloto.')
    d = {}
    for nombre in ('entrenamiento','validacion','prueba'):
        parte = df[df['particion']==nombre]
        if len(parte)<100 or parte['objetivo'].nunique()<2:
            raise SystemExit(f'{nombre}: muestra insuficiente o solo una clase ({len(parte)} filas).')
        d[nombre] = (parte[FEATURES], parte['objetivo'].astype(int), parte)
    xtr,ytr,_=d['entrenamiento']
    xval,yval,_=d['validacion']
    xte,yte,tabla_prueba=d['prueba']
    if (pd.to_datetime(df[df['particion']=='entrenamiento']['fecha']).max() >=
        pd.to_datetime(df[df['particion']=='validacion']['fecha']).min()):
        raise SystemExit('Fuga temporal entre entrenamiento y validación.')
    if (pd.to_datetime(df[df['particion']=='validacion']['fecha']).max() >=
        pd.to_datetime(df[df['particion']=='prueba']['fecha']).min()):
        raise SystemExit('Fuga temporal entre validación y prueba.')

    modelo_ref=make_pipeline(StandardScaler(),LogisticRegression(max_iter=1800,random_state=42))
    modelo_ref.fit(xtr,ytr)
    modelo_lgbm=LGBMClassifier(n_estimators=250,learning_rate=0.04,num_leaves=15,
                              min_child_samples=50,reg_lambda=2.0,
                              random_state=42,n_jobs=4,verbosity=-1)
    modelo_lgbm.fit(xtr,ytr)
    # Calibración Platt: ajustar SOLO en validación, nunca en prueba.
    p_val=np.clip(modelo_lgbm.predict_proba(xval)[:,1],1e-6,1-1e-6)
    logit=np.log(p_val/(1-p_val)).reshape(-1,1)
    calibrador=LogisticRegression(max_iter=2000,random_state=42)
    calibrador.fit(logit,yval)
    p_te=np.clip(modelo_lgbm.predict_proba(xte)[:,1],1e-6,1-1e-6)
    p_cal=calibrador.predict_proba(np.log(p_te/(1-p_te)).reshape(-1,1))[:,1]
    p_log=modelo_ref.predict_proba(xte)[:,1]
    p_prior=np.full(len(yte),float(ytr.mean()))
    resultados={
        'caracter':'EXPERIMENTAL, NO VALIDADO PARA ALERTAS PUBLICAS',
        'definicion':'P(deteccion MODIS en la celda de 1 grado durante los 7 dias siguientes | clima observado e historial hasta hoy)',
        'calibracion':'regresion logistica (Platt) ajustada exclusivamente con validacion',
        'particiones':{n:{'desde':str(parte['fecha'].min()),'hasta':str(parte['fecha'].max()),'filas':len(parte)}
                       for n, (_,__,parte) in d.items()},
        'resultados_prueba_2024':{
            'baseline_tasa_historica':evaluar(yte,p_prior),
            'regresion_logistica':evaluar(yte,p_log),
            'lightgbm_sin_calibrar':evaluar(yte,p_te),
            'lightgbm_calibrado':evaluar(yte,p_cal),
        },
        'features':FEATURES,
        'limitaciones':['No representa el numero real de incendios.',
                        'La falta de deteccion FIRMS puede significar falta de observacion.',
                        'Celdas de 1 grado; pais aproximado.',
                        'Las probabilidades deben contrastarse en otras areas y anos.'],
    }
    args.salida.mkdir(parents=True,exist_ok=True)
    (args.salida/'metricas.json').write_text(json.dumps(resultados,ensure_ascii=False,indent=2),encoding='utf-8')
    joblib.dump({'lightgbm':modelo_lgbm,'calibrador':calibrador,'features':FEATURES,
                 'regresion_logistica':modelo_ref,
                 'advertencia':'SOLO PILOTO. No utilizar para avisos oficiales.'},args.salida/'modelo_lightgbm.joblib')
    muestra=tabla_prueba[['fecha','cell_y','cell_x','lat','lon','objetivo']].copy()
    muestra['probabilidad_calibrada']=p_cal
    muestra.sample(min(25,len(muestra)),random_state=42).to_csv(args.salida/'ejemplos_historicos_2024.csv',index=False)
    print('\n=== RESULTADOS DE PRUEBA: 2024 NO USADO PARA ENTRENAR ===')
    for nombre,m in resultados['resultados_prueba_2024'].items():
        print(f"{nombre}: Brier={m['brier_menor_es_mejor']:.5f} | AP={m['average_precision_mayor_es_mejor']:.4f} | ROC-AUC={m['roc_auc']}")
    mejor = resultados['resultados_prueba_2024']['lightgbm_calibrado']['brier_menor_es_mejor'] < resultados['resultados_prueba_2024']['baseline_tasa_historica']['brier_menor_es_mejor']
    print('¿LightGBM calibrado supera baseline en Brier?:', 'SI' if mejor else 'NO')
    print('Reporte:',(args.salida/'metricas.json').resolve())
    print('Este resultado NO autoriza aún a decir que el sistema predice incendios reales.')


if __name__=='__main__':
    main()
