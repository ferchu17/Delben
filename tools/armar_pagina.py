"""Arma la página de GitHub Pages de Novedades del Personal a partir de los archivos de Apps Script.

Uso: python3 armar_pagina.py <carpeta de la app> <carpeta de salida> [archivo principal, por defecto Index]
Hace lo mismo que Apps Script cuando abre Index.html: reemplaza <?!= include('X'); ?> por el contenido de X.html.
Antes de la app se cargan config.js (URL del backend) y puente.js (google.script.run -> backend).
Los archivos de Apps Script no se modifican: la lógica, los cálculos y los formatos son exactamente los mismos.
"""
import os
import re
import hashlib
import shutil
import sys

base, salida = sys.argv[1], sys.argv[2]
principal = sys.argv[3] if len(sys.argv) > 3 else 'Index'
gas = os.path.join(base, 'apps-script')
web = os.path.join(base, 'web')
os.makedirs(salida, exist_ok=True)


def leer(nombre):
    with open(os.path.join(gas, nombre + '.html'), encoding='utf-8') as f:
        return f.read().replace('\r\n', '\n')


def version(nombre):
    with open(os.path.join(web, nombre), 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:10]


# ?v=... cambia cada vez que cambia el archivo: así el navegador no usa una copia vieja guardada
html = leer(principal)
# config.js y puente.js van antes del primer include de scripts (la app ya encuentra google.script.run armado)
puente = '<script src="config.js?v=' + version('config.js') + '"></script>\n<script src="puente.js?v=' + version('puente.js') + '"></script>\n'
INC = r"""<\?!=\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>"""
m0 = [m for m in re.finditer(INC, html) if m.group(1) not in ('Styles', 'Logo', 'Formato')]
if m0:
    html = html[:m0[0].start()] + puente + html[m0[0].start():]
else:
    html = html.replace('</head>', puente + '</head>', 1)
html = re.sub(INC, lambda m: leer(m.group(1)), html)
if '<?' in html:
    raise SystemExit('Quedó un <? ?> de Apps Script sin reemplazar en Index.html')
with open(os.path.join(salida, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
for n in ('config.js', 'puente.js'):
    shutil.copy(os.path.join(web, n), os.path.join(salida, n))
print('Página armada en', salida, '-', len(html), 'caracteres')
