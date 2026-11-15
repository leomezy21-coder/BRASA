"""Extrae la capa espacial compacta, en solo lectura, al iniciar Render."""
from __future__ import annotations
import gzip
import shutil
import sqlite3
from contextlib import closing
from pathlib import Path

HERE = Path(__file__).resolve().parent
ARCHIVO = HERE / 'brasa_mapa.db.gz'
BD = HERE / 'brasa_mapa.db'


def valida(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        with closing(sqlite3.connect(path.as_uri()+'?mode=ro', uri=True)) as con:
            return (con.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
                    and con.execute("SELECT name FROM sqlite_master WHERE name='mapa_muestras'").fetchone() is not None
                    and con.execute('SELECT COUNT(*) FROM mapa_muestras').fetchone()[0] > 0)
    except sqlite3.Error:
        return False


def main():
    if valida(BD):
        print('Capa espacial ya disponible.',flush=True)
        return
    if not ARCHIVO.is_file():
        raise SystemExit('Falta brasa_mapa.db.gz. Ejecuta exportar_mapa_mundial.py en tu PC.')
    temp = HERE / 'brasa_mapa.db.incompleto'
    with gzip.open(ARCHIVO,'rb') as src, temp.open('wb') as dst:
        shutil.copyfileobj(src,dst,length=1024*1024)
    if not valida(temp):
        temp.unlink(missing_ok=True)
        raise SystemExit('La capa espacial comprimida no paso la verificacion de integridad.')
    temp.replace(BD)
    print('Capa espacial extraida e integra.',flush=True)


if __name__ == '__main__':
    main()
