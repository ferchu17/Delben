"""Arma la página de GitHub Pages de Novedades del Personal a partir de los archivos de Apps Script.

Uso: python3 armar_pagina.py <carpeta novedades-app> <carpeta de salida>
Hace lo mismo que Apps Script cuando abre Index.html: reemplaza <?!= include('X'); ?> por el contenido de X.html.
Antes de la app se cargan config.js (URL del backend) y puente.js (google.script.run -> backend).
Los archivos de Apps Script no se modifican: la lógica, los cálculos y los formatos son exactamente los mismos.
"""
import os
import re
import shutil
import sys

base, salida = sys.argv[1], sys.argv[2]
gas = os.path.join(base, 'apps-script')
web = os.path.join(base, 'web')
os.makedirs(salida, exist_ok=True)


def leer(nombre):
    with open(os.path.join(gas, nombre + '.html'), encoding='utf-8') as f:
        return f.read()


html = leer('Index')
html = html.replace("<?!= include('App'); ?>",
                    '<script src="config.js"></script>\n  <script src="puente.js"></script>\n  ' + "<?!= include('App'); ?>")
html = re.sub(r"<\?!=\s*include\('([^']+)'\);\s*\?>", lambda m: leer(m.group(1)), html)
if '<?' in html:
    raise SystemExit('Quedó un <? ?> de Apps Script sin reemplazar en Index.html')
with open(os.path.join(salida, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
for n in ('config.js', 'puente.js'):
    shutil.copy(os.path.join(web, n), os.path.join(salida, n))
print('Página armada en', salida, '-', len(html), 'caracteres')
