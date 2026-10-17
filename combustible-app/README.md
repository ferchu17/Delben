# Control de Combustible

- `apps-script/`: los archivos del proyecto de Apps Script (Code.gs, Index.html, appsscript.json). Se pegan tal cual en el editor.
- `web/`: `config.js` (link /exec del backend) y `puente.js` (hace que `google.script.run` llame al `doPost` de Apps Script).
- La página https://ferchu17.github.io/Delben/combustible/ se arma sola al publicar (`tools/armar_pagina.py combustible-app _site/combustible`), sin el cartel de Google.
