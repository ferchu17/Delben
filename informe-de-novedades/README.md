# Informe de Novedades

App web (GitHub Pages) + backend en Google Apps Script. Carpeta: `informe-de-novedades/`.

```
index.html · css/app.css · js/config.js · js/pdf.js · js/app.js
assets/logo_ktl.jpg      (logo del PDF)
assets/logo_delben.png   (logo de la app — FALTA subirlo)
backend/Code.gs · backend/appsscript.json
```

## 1. Backend (Apps Script)
1. script.google.com → Proyecto nuevo → pegar `backend/Code.gs` (y en Configuración activar "Mostrar appsscript.json" y pegar el de `backend/`).
2. Ejecutar `probarListas` una vez, aceptar permisos y revisar en el registro que lea bien nombres y correos. Si no detecta las columnas, completar `USUARIOS_COL_*` / `OBJETIVOS_COL_*` en CONFIG.
3. Implementar → Aplicación web → Ejecutar como: yo · Acceso: cualquier persona → copiar la URL `/exec`.
4. (Recomendado) poner un `TOKEN` en CONFIG.

## 2. Frontend
1. Pegar la URL en `js/config.js` (`API_URL`) y el mismo `TOKEN`.
2. Subir `assets/logo_delben.png`.
3. Subir la carpeta a GitHub y activar Pages. Sin `API_URL` la app corre en modo DEMO.

## Hoja `informes_novedades`
Columnas: id | informe_N | fecha | de | para | asunto | objetivo | informe (texto) | medidas_tomadas | informe (link al PDF en Drive).
