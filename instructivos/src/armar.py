"""Arma los instructivos: cada archivo src/<app>.js (window.GUIA = {...}) se convierte en instructivos/<app>.html.
Uso: python3 instructivos/src/armar.py"""
import os, glob
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = '''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instructivo</title>
<link rel="icon" type="image/png" sizes="64x64" href="/Delben/iconos/sgi-64.png">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<link href="motor.css" rel="stylesheet">
</head>
<body>
<script>
%s
</script>
<script src="motor.js"></script>
</body>
</html>
'''
for f in sorted(glob.glob(os.path.join(base, 'src', '*.js'))):
    nombre = os.path.splitext(os.path.basename(f))[0]
    open(os.path.join(base, nombre + '.html'), 'w', encoding='utf-8').write(TPL % open(f, encoding='utf-8').read())
    print('armado', nombre + '.html')
