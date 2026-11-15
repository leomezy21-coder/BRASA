"""BRASA v7: elegir candidato exploratorio según validación espacial y crear
previsualización RETROSPECTIVA para una fecha, sin usar Render ni reentrenar.

Uso:
 python previsualizar_riesgo_v7.py --comparacion salidas/v6_96/comparacion.json \
   --datos datos/entrenamiento_ecuador_96_fwi.csv --fecha 2024-09-05

ADVERTENCIA: P(detección MODIS en los 7 días siguientes) != P(incendio).
El conjunto 2024 ya fue usado repetidamente para comparar modelos y no es una
prueba final independiente. El resultado es SOLO demostración histórica.
"""
from __future__ import annotations
import argparse
import csv
import json
import shutil
from pathlib import Path
from datetime import datetime
import sys

import joblib
import numpy as np
import pandas as pd


def main():
    parser = argparse.ArgumentParser(description='BRASA: seleccion y demostracion retrospectiva')
    parser.add_argument('--comparacion', type=Path, default=Path('salidas/v6_96/comparacion.json'))
    parser.add_argument('--datos', type=Path, default=Path('datos/entrenamiento_ecuador_96_fwi.csv'))
    parser.add_argument('--salida', type=Path, default=Path('salidas/v7_previsualizacion'))
    parser.add_argument('--fecha', type=str, default='2024-09-05')
    parser.add_argument('--max-puntos', type=int, default=300)
    args = parser.parse_args()
    if not args.comparacion.is_file():
        raise SystemExit(f'Falta reporte v6: {args.comparacion}. Revisa si comparar_fwi.py terminó sin errores.')
    if not args.datos.is_file():
        raise SystemExit(f'Falta dataset v6: {args.datos}. Revisa si unir_fwi.py terminó correctamente.')
    try:
        fecha = pd.Timestamp(args.fecha)
    except Exception as exc:
        raise SystemExit(f'Fecha no válida (AAAA-MM-DD): {exc}')
    if fecha.year != 2024:
        raise SystemExit('La previsualización v7 se limita a fechas históricas de 2024, no pronósticos actuales.')
    if not 1 <= args.max_puntos <= 1000:
        raise SystemExit('--max-puntos debe estar entre 1 y 1000')

    comp = json.loads(args.comparacion.read_text(encoding='utf-8'))
    candidatos = []
    for variante in ('original', 'con_fwi'):
        bloque = comp.get('resultados', {}).get(variante)
        if not bloque:
            raise SystemExit(f'El JSON no incluye resultados para {variante}')
        met = bloque.get('geografia_2024', {})
        for modelo in ('regresion_logistica', 'lightgbm_calibrado'):
            m = met.get(modelo, {})
            brier = m.get('brier')
            auc = m.get('roc_auc')
            ap = m.get('average_precision')
            if any(v is None for v in (brier, auc, ap)):
                raise SystemExit(f'Faltan métricas para {variante}/{modelo} en comparación v6')
            candidatos.append({'variante':variante,'modelo':modelo,'brier':float(brier),
                               'roc_auc':float(auc),'ap':float(ap)})
    # Criterio único y reproducible: minimizar el Brier espacial.
    # En empate exacto, preferir modelo más interpretable y menos variables.
    candidatos.sort(key=lambda m: (m['brier'], m['modelo']!='regresion_logistica', m['variante']!='original'))
    ganador = candidatos[0]
    base_ref = comp['resultados']['original']['geografia_2024'].get('referencia_tasa', {})
    baseline = float(base_ref['brier']) if 'brier' in base_ref else None
    if baseline is not None and ganador['brier'] >= baseline:
        raise SystemExit('Ningun candidato supera la referencia en Brier: no generar probabilidad.')

    origen_modelo = args.comparacion.parent / ganador['variante'] / 'temporal' / 'modelo_lightgbm.joblib'
    if not origen_modelo.is_file():
        raise SystemExit(f'Falta el modelo v6 guardado: {origen_modelo}. Ejecuta comparar_fwi.py de nuevo.')
    artefactos = joblib.load(origen_modelo)  # cargar solo un archivo creado por nosotros; no de terceros
    features = artefactos.get('features', [])
    if not features:
        raise SystemExit('El modelo no declara sus variables predictoras')

    # La tabla v6 está limitada a un subconjunto espacial, NO contiene todas las celdas de Ecuador.
    tabla = pd.read_csv(args.datos)
    requeridas = {'fecha','cell_y','cell_x','lat','lon','objetivo'} | set(features)
    if not requeridas <= set(tabla.columns):
        raise SystemExit(f'Faltan columnas: {sorted(requeridas-set(tabla.columns))}')
    dia = tabla.loc[tabla['fecha'].astype(str) == fecha.strftime('%Y-%m-%d')].copy()
    if dia.empty:
        raise SystemExit(f'La fecha {args.fecha} no figura en el CSV; elige una fecha de 2024 disponible.')
    if dia[features].isna().any().any():
        raise SystemExit('Hay valores nulos en las variables de inferencia')

    if ganador['modelo']=='regresion_logistica':
        prob = artefactos['regresion_logistica'].predict_proba(dia[features])[:,1]
    else:
        p = np.clip(artefactos['lightgbm'].predict_proba(dia[features])[:,1],1e-6,1-1e-6)
        prob = artefactos['calibrador'].predict_proba(np.log(p/(1-p)).reshape(-1,1))[:,1]
    dia['probabilidad_deteccion_7d'] = np.clip(prob,0,1)
    dia = dia.sort_values('probabilidad_deteccion_7d',ascending=False).head(args.max_puntos).copy()
    dia['probabilidad_porcentaje']=np.round(100*dia['probabilidad_deteccion_7d'],1)

    salida = args.salida
    salida.mkdir(parents=True,exist_ok=True)
    columnas = ['fecha','lat','lon','cell_y','cell_x','probabilidad_porcentaje','objetivo']
    dia[columnas].to_csv(salida/'predicciones_historicas.csv',index=False,encoding='utf-8')
    features_geo=[]
    for r in dia[columnas].itertuples(index=False):
        features_geo.append({'type':'Feature',
            'geometry':{'type':'Point','coordinates':[float(r.lon),float(r.lat)]},
            'properties':{'fecha':r.fecha,'probabilidad_deteccion_7d':round(float(r.probabilidad_porcentaje)/100,4),
                          'probabilidad_porcentaje':float(r.probabilidad_porcentaje),
                          'deteccion_observada_proximos_7_dias':int(r.objetivo),
                          'resolucion_espacial_grados':0.25,
                          'indicador':'Estimacion retrospectiva MODIS, NO probabilidad de incendio real'}})
    geo={'type':'FeatureCollection','name':'BRASA v7 - DEMOSTRACION HISTORICA',
         'features':features_geo}
    (salida/'mapa_historico.geojson').write_text(json.dumps(geo,ensure_ascii=False,indent=2),encoding='utf-8')
    reporte={'fecha':args.fecha,'alcance':'DEMO RETROSPECTIVA; no es pronóstico futuro ni alerta pública',
             'objetivo':'P(al menos una detección MODIS en una celda 0.25° durante los 7 días siguientes)',
             'modelo_elegido_por':'Menor Brier en validación geográfica 2024; elección exploratoria, NO test independiente',
             'ganador':ganador,'candidatos':candidatos,'variables':features,
             'celdas_representadas':len(dia),
             'limitaciones':['2024 fue consultado repetidamente durante desarrollo: requiere test independiente',
              'El modelo fue entrenado con datos históricos; aquí se reutilizan sus artefactos, no se reentrena',
              'Son estimaciones de detección MODIS, NO de incendios confirmados',
              'La capa cubre solamente celdas seleccionadas de Ecuador, NO todo el país',
              'Las probabilidades pueden ser inestables fuera de la distribución de entrenamiento',
              'Las etiquetas sin detección pueden reflejar ausencia de observación satelital']}
    (salida/'reporte.json').write_text(json.dumps(reporte,ensure_ascii=False,indent=2),encoding='utf-8')
    print('\n=== BRASA v7: ELECCION EXPLORATORIA ===')
    for c in candidatos:
        print(f"{c['variante']:8} | {c['modelo']:20} | Brier={c['brier']:.5f} | AUC={c['roc_auc']:.4f} | AP={c['ap']:.4f}")
    print(f"CANDIDATO: {ganador['modelo']} / {ganador['variante']}")
    print(f"Fecha historica: {args.fecha} | Celdas representadas: {len(dia)}")
    print('Primeras cinco celdas, SOLO DEMO HISTORICA:')
    print(dia[['lat','lon','probabilidad_porcentaje','objetivo']].head().to_string(index=False))
    print('Archivos:',salida.resolve())
    print('NO se modifico Render ni se entreno un modelo nuevo.')


if __name__=='__main__':
    try:
        main()
    except (ValueError,KeyError,FileNotFoundError,TypeError) as exc:
        print(f'ERROR: {exc}',file=sys.stderr)
        sys.exit(1)
