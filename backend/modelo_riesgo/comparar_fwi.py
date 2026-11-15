"""Compara v3 vs v3+FWI en filas idénticas, con prueba temporal y espacial.
Importa entrenar_modelo.py y validar_geografia.py existentes sin modificarlos.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

import entrenar_modelo
import validar_geografia

BASE = Path(__file__).resolve().parent
NUEVAS = ['fwi_ayer','fwi_media_7d_previos']


def run_main(module, argv):
    original=sys.argv
    try:
        sys.argv=[module.__file__,*argv]
        module.main()
    finally:
        sys.argv=original


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--datos',type=Path,default=BASE/'datos'/'entrenamiento_ecuador_025_fwi.csv')
    ap.add_argument('--salida',type=Path,default=BASE/'salidas'/'v5_fwi')
    ap.add_argument('--folds',type=int,default=4)
    args=ap.parse_args()
    if not args.datos.is_file():
        raise SystemExit('Falta el CSV unido con FWI. Ejecuta unir_fwi.py primero.')
    sin_fwi=list(entrenar_modelo.FEATURES)
    if any(x in sin_fwi for x in NUEVAS):
        raise SystemExit('FEATURES originales ya contienen FWI: revisar antes de repetir.')
    reportes={}
    try:
        for nombre, features in [('original',sin_fwi),('con_fwi',sin_fwi+NUEVAS)]:
            print(f'\n========== MODELO {nombre.upper()} (MISMAS FILAS) ==========',flush=True)
            folder=args.salida/nombre
            entrenar_modelo.FEATURES=features
            validar_geografia.FEATURES=features
            run_main(entrenar_modelo,['--datos',str(args.datos),'--salida',str(folder/'temporal')])
            run_main(validar_geografia,['--datos',str(args.datos),'--salida',str(folder/'geografia'), '--folds',str(args.folds)])
            t=json.loads((folder/'temporal'/'metricas.json').read_text(encoding='utf8'))
            g=json.loads((folder/'geografia'/'validacion_geografica.json').read_text(encoding='utf8'))
            reportes[nombre]={'features':features,
                              'temporal_2024':t['resultados_prueba_2024'],
                              'geografia_2024':g['metricas_globales_fuera_de_celda_2024']}
    finally:
        entrenar_modelo.FEATURES=sin_fwi
        validar_geografia.FEATURES=sin_fwi
    args.salida.mkdir(parents=True,exist_ok=True)
    (args.salida/'comparacion.json').write_text(json.dumps({
        'metodologia':'Comparación sobre idéntico CSV, mismas celdas y años, modelos reentrenados',
        'dataset':str(args.datos.resolve()), 'resultados':reportes,
        'advertencia':'Reanálisis retrospectivo. No aprobado para alertas ni estimación de incendio individual.'},
        ensure_ascii=False,indent=2),encoding='utf-8')
    print('\n========== COMPARACIÓN GEO ESPACIAL ==========',flush=True)
    for modelo in ['regresion_logistica','lightgbm_calibrado']:
        a=reportes['original']['geografia_2024'][modelo]
        b=reportes['con_fwi']['geografia_2024'][modelo]
        print(f'{modelo}:')
        print(f"  SIN FWI: Brier={a['brier']} | ROC-AUC={a['roc_auc']} | AP={a['average_precision']}")
        print(f"  CON FWI: Brier={b['brier']} | ROC-AUC={b['roc_auc']} | AP={b['average_precision']}")
    print('Comparacion guardada:',(args.salida/'comparacion.json').resolve())
    print('No se ha modificado el modelo v3 ni Render.')


if __name__=='__main__':
    main()
