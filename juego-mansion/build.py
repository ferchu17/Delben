#!/usr/bin/env python3
"""Arma el juego Mansión Sombranegra a partir de src/.

Genera:
  - index.html          página completa (para GitHub Pages: /Delben/mansion/)
  - mansion-claude.html contenido para publicar como artifact en Claude (sin <html>/<head>)
Uso: python3 juego-mansion/build.py
"""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(AQUI, 'src')
JS = ['core.js', 'content.js', 'content2.js', 'systems.js', 'ui.js']


def leer(n):
    with open(os.path.join(SRC, n), encoding='utf-8') as f:
        return f.read()


cuerpo = leer('head.html') + '\n<script>\n' + '\n'.join(leer(n) for n in JS) + '\n</script>\n'

with open(os.path.join(AQUI, 'mansion-claude.html'), 'w', encoding='utf-8') as f:
    f.write(cuerpo)

pagina = ('<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
          '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
          '<link rel="icon" type="image/png" sizes="64x64" href="/Delben/iconos/mansion-64.png">\n'
          '<link rel="apple-touch-icon" href="/Delben/iconos/mansion-192.png">\n'
          '</head>\n<body>\n' + cuerpo + '</body>\n</html>\n')
with open(os.path.join(AQUI, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(pagina)
print('OK', len(pagina), 'bytes')
