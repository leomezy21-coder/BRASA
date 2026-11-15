"""BRASA: evaluación fuera de tiempo y fuera de celdas espaciales (piloto).

NO edita la base SQLite, NO entrena en Render y NO modifica modelos v1.
Evalúa los datos de 2024 en celdas 1° completas nunca vistas por el modelo.
La selección original de celdas activas de FIRMS limita la generalización.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).resolve().parent
FEATURES = ['lat', 'lon', 'temp_max', 'temp_media_7d', 'humedad_7d', 'viento_7d',
            'lluvia_7d', 'lluvia_30d', 'fuegos_previos_7d', 'fuegos_previos_30d',
            'dia_seno', 'dia_cos']


def metricas(y, p):
    y = np.asarray(y, dtype=int)
    p = np.clip(np.asarray(p, dtype=float), 1e-7, 1-1e-7)
    dos_clases = len(np.unique(y)) == 2
    return {
        'filas': int(len(y)),
        'positivos': int(np.sum(y)),
        'prevalencia': round(float(y.mean()), 6),
        'brier': round(float(brier_score_loss(y, p)), 6),
        'average_precision': round(float(average_precision_score(y, p)), 6) if dos_clases else None,
        'roc_auc': round(float(roc_auc_score(y, p)), 6) if dos_clases else None,
        'probabilidad_media': round(float(np.mean(p)), 6),
    }


def calibrar(p_val, y_val, p_test):
    if len(np.unique(y_val)) != 2:
        return p_test, 'Sin calibrar: conjunto de validacion sin ambas clases'
    p_val = np.clip(np.asarray(p_val), 1e-6, 1-1e-6)
    p_test = np.clip(np.asarray(p_test), 1e-6, 1-1e-6)
    logit_val = np.log(p_val / (1-p_val)).reshape(-1, 1)
    logit_test = np.log(p_test / (1-p_test)).reshape(-1, 1)
    cal = LogisticRegression(random_state=42, max_iter=2000)
    cal.fit(logit_val, y_val)
    return cal.predict_proba(logit_test)[:, 1], 'Platt (solamente validacion 2022–2023)'


def ejecutar(args):
    if not args.datos.is_file():
        raise ValueError(f'No existe el CSV: {args.datos}')
    df = pd.read_csv(args.datos)
    faltan = set(FEATURES + ['fecha','cell_y','cell_x','objetivo','particion']) - set(df.columns)
    if faltan:
        raise ValueError(f'Faltan columnas: {sorted(faltan)}')
    if df[FEATURES].isna().any().any():
        raise ValueError('Hay datos faltantes en las variables predictoras.')
    if not df['objetivo'].isin([0,1]).all():
        raise ValueError('objetivo debe ser 0 o 1.')
    if not set(df['particion']) <= {'entrenamiento','validacion','prueba'}:
        raise ValueError('Particiones desconocidas.')
    fechas = pd.to_datetime(df['fecha'], errors='coerce')
    if fechas.isna().any():
        raise ValueError('La columna fecha contiene fechas invalidas.')
    anios = fechas.dt.year
    if not ((df['particion'].eq('entrenamiento') & anios.le(2021) |
             df['particion'].eq('validacion') & anios.between(2022,2023) |
             df['particion'].eq('prueba') & anios.eq(2024)).all()):
        raise ValueError('La separacion temporal esperada 2018–2021 / 2022–2023 / 2024 no coincide.')
    if len(df.drop_duplicates(['fecha','cell_y','cell_x'])) != len(df):
        raise ValueError('Hay registros duplicados fecha+celda.')

    df['celda'] = df['cell_y'].astype(str) + '_' + df['cell_x'].astype(str)
    celdas = sorted(df['celda'].unique().tolist())
    if len(celdas) < args.folds * 2:
        raise ValueError(f'Se requieren al menos {args.folds * 2} celdas para {args.folds} folds; hay {len(celdas)}.')
    for p in ['entrenamiento','validacion','prueba']:
        if not df['particion'].eq(p).any():
            raise ValueError(f'Falta particion {p}.')
    print(f'Archivo: {args.datos.resolve()}', flush=True)
    print(f'Registros: {len(df):,} | Celdas: {len(celdas)} | Folds: {args.folds}', flush=True)
    print('Prueba geográfica: cada celda queda fuera de entrenamiento y calibracion en su fold.', flush=True)
    if len(celdas) <= 20:
        print('ATENCION: los datos originales seleccionaron celdas con incendios históricos; no representan todo Ecuador.', flush=True)

    # Celdas son la unidad de división; la selección de folds no utiliza sus etiquetas.
    kfold = GroupKFold(n_splits=args.folds)
    df_cells = pd.DataFrame({'celda':celdas})
    predicciones = []
    pliegues = []
    if args.solo_clima:
        features = [f for f in FEATURES if f not in ('lat','lon','fuegos_previos_7d','fuegos_previos_30d')]
    elif args.sin_coordenadas:
        features = [f for f in FEATURES if f not in ('lat','lon')]
    else:
        features = FEATURES

    for numero, (idx_tr, idx_te) in enumerate(kfold.split(df_cells, groups=df_cells['celda']), 1):
        celdas_tr = set(df_cells.iloc[idx_tr]['celda'])
        celdas_te = set(df_cells.iloc[idx_te]['celda'])
        if celdas_tr & celdas_te:
            raise AssertionError('Fuga espacial: celdas coincidentes.')
        train = df[(df['particion']=='entrenamiento') & df['celda'].isin(celdas_tr)]
        val = df[(df['particion']=='validacion') & df['celda'].isin(celdas_tr)]
        test = df[(df['particion']=='prueba') & df['celda'].isin(celdas_te)].copy()
        if min(len(train),len(val),len(test)) < 100:
            raise ValueError(f'Fold {numero} demasiado pequeño.')
        if train['objetivo'].nunique() != 2:
            raise ValueError(f'Fold {numero} sin dos clases en entrenamiento.')
        xtr,ytr = train[features],train['objetivo'].astype(int)
        xv,yv = val[features],val['objetivo'].astype(int)
        xt,yt = test[features],test['objetivo'].astype(int)
        modelo = LGBMClassifier(n_estimators=250,learning_rate=0.04,num_leaves=15,
                                min_child_samples=50,reg_lambda=2.0,
                                random_state=42,n_jobs=4,verbosity=-1)
        modelo.fit(xtr,ytr)
        p_raw = modelo.predict_proba(xt)[:,1]
        p_cal, metodo = calibrar(modelo.predict_proba(xv)[:,1], yv.to_numpy(), p_raw)
        basica = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1800, random_state=42))
        basica.fit(xtr,ytr)
        p_logit = basica.predict_proba(xt)[:,1]
        p_ref = np.full(len(test),float(ytr.mean()))

        test['fold'] = numero
        test['p_lightgbm'] = p_cal
        test['p_logistica'] = p_logit
        test['p_referencia'] = p_ref
        predicciones.append(test[['fecha','cell_y','cell_x','lat','lon','objetivo','fold',
                                   'p_lightgbm','p_logistica','p_referencia']])
        fila = {
            'fold': numero,
            'celdas_entrenamiento': len(celdas_tr),
            'celdas_excluidas': sorted(celdas_te),
            'filas_entrenamiento': len(train),
            'filas_validacion': len(val),
            'calibracion': metodo,
            'modelos': {
                'referencia_tasa': metricas(yt,p_ref),
                'regresion_logistica': metricas(yt,p_logit),
                'lightgbm_calibrado': metricas(yt,p_cal),
            },
        }
        pliegues.append(fila)
        m = fila['modelos']['lightgbm_calibrado']
        print(f"Fold {numero}/{args.folds}: {len(celdas_te)} celdas nuevas; "
              f"{len(test):,} filas 2024; Brier={m['brier']:.4f}; "
              f"ROC-AUC={m['roc_auc']}; AP={m['average_precision']}", flush=True)

    pred = pd.concat(predicciones,ignore_index=True).sort_values(['fecha','cell_y','cell_x'])
    prueba_original = df[df['particion']=='prueba']
    if len(pred) != len(prueba_original) or pred.duplicated(['fecha','cell_y','cell_x']).any():
        raise AssertionError('Predicciones fuera de fold duplicadas o faltantes.')
    real = pred['objetivo'].astype(int).to_numpy()
    globales = {
        'referencia_tasa':metricas(real,pred['p_referencia']),
        'regresion_logistica':metricas(real,pred['p_logistica']),
        'lightgbm_calibrado':metricas(real,pred['p_lightgbm']),
    }
    salida = {
        'caracter':'EXPERIMENTAL: validacion geográfica y temporal; NO autoriza alertas',
        'pregunta':'Prediccion de deteccion MODIS en los 7 dias siguientes para celdas no usadas en entrenamiento',
        'dataset':str(args.datos.resolve()),
        'celdas_total':len(celdas),
        'folds':args.folds,
        'features':features,
        'metodo':'GroupKFold por celda: entrenamiento <=2021, calibracion 2022-23, test 2024 solo en celdas no vistas',
        'metricas_globales_fuera_de_celda_2024':globales,
        'detalle_folds':pliegues,
        'limitaciones':[
            'Las celdas disponibles fueron seleccionadas originalmente por actividad histórica: sesgo de selección.',
            'Todas las celdas pueden haber tenido actividad alguna vez: faltan zonas sin registros de fuego.',
            'GroupKFold por celda evita identidad exacta pero NO separa espacialmente celdas vecinas.',
            'Los horizontes de 7 dias se solapan: filas consecutivas no son observaciones independientes.',
            'No deteccion no prueba ausencia de incendio; faltan controles de observacion y nubosidad.',
            'Se evaluó 2024 varias veces en el desarrollo; no es prueba final independiente.',
            'No utilizar en alertas reales; no es probabilidad de incendios individuales.',
        ],
    }
    args.salida.mkdir(exist_ok=True,parents=True)
    variante = 'solo_clima' if args.solo_clima else ('sin_coordenadas' if args.sin_coordenadas else 'completo')
    reporte = args.salida / ('validacion_geografica.json' if variante=='completo' else f'validacion_geografica_{variante}.json')
    csv_salida = args.salida / ('predicciones_geo_2024.csv' if variante=='completo' else f'predicciones_geo_{variante}_2024.csv')
    reporte.write_text(json.dumps(salida,ensure_ascii=False,indent=2),encoding='utf-8')
    pred.to_csv(csv_salida,index=False)
    print('\n=== PRUEBA 2024 EN CELDAS NO VISTAS ===',flush=True)
    for name,m in globales.items():
        print(f"{name}: Brier={m['brier']:.5f} | AP={m['average_precision']} | ROC-AUC={m['roc_auc']}",flush=True)
    print(f'REPORTE: {reporte.resolve()}',flush=True)
    print(f'PREDICCIONES: {csv_salida.resolve()}',flush=True)
    print('No se modificó el modelo entrenado original ni Render.',flush=True)


def main():
    ap=argparse.ArgumentParser(description='Validacion geografica y temporal de BRASA LightGBM')
    ap.add_argument('--datos',type=Path,default=HERE/'datos'/'entrenamiento_ecuador.csv')
    ap.add_argument('--salida',type=Path,default=HERE/'salidas')
    ap.add_argument('--folds',type=int,default=4)
    ap.add_argument('--sin-coordenadas',action='store_true',help='No usar latitud ni longitud')
    ap.add_argument('--solo-clima',action='store_true',help='Solo meteorologia + estacionalidad, sin historial de fuego ni coordenadas')
    args=ap.parse_args()
    if args.sin_coordenadas and args.solo_clima:
        ap.error('Elige solo una variante: --sin-coordenadas o --solo-clima')
    if not 2 <= args.folds <= 10:
        ap.error('--folds debe estar entre 2 y 10')
    try:
        ejecutar(args)
    except (ValueError,AssertionError) as e:
        print(f'ERROR: {e}',file=sys.stderr)
        sys.exit(1)


if __name__=='__main__':
    main()
