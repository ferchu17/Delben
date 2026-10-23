# Presentismo de Servicios

Presentes del personal en cada servicio, con horas diurnas (06 a 21) y nocturnas (21 a 06).

- **Vigilador:** da el presente con su DNI, el servicio (o el QR del puesto) y su horario de entrada y salida. Si lo trasladan a otro servicio, la app le pregunta a qué hora se retiró del anterior y lo corrige. Ve solo sus presentes del período actual (26 al 25).
- **Encargado** (usuario de servicio de SGI): informa a día vencido el personal de su servicio desde un desplegable con buscador, con observación, horario o licencia por persona, y manda el correo al servicio.
- **Supervisor / Administrador:** buscador de presentes de cualquier período con totales, descarga, informar y anular en cualquier servicio y fecha, QR de todos los servicios.

Link: https://ferchu17.github.io/Delben/presentismo/ · APK: https://github.com/ferchu17/Delben/releases/download/presentismo-apk/Presentismo.apk · Instructivo: https://ferchu17.github.io/Delben/instructivos/presentismo.html

## Archivos

| Archivo | Dónde va |
|---|---|
| `apps-script/Code.gs` | Proyecto de Apps Script de la planilla **Presentismo de Servicios** (cuenta **delbensgii@gmail.com**) |
| `apps-script/Index.html` | Mismo proyecto, archivo HTML llamado **Index**. Es la misma pantalla que se publica en GitHub Pages |
| `apps-script/appsscript.json` | Manifiesto del proyecto |
| `web/config.js` | URL `/exec` de la implementación (la usa la página de GitHub) |
| `web/puente.js` | Pasa cada `google.script.run` de la página al `doPost` de Apps Script |

La página de GitHub se arma sola al subir cambios (`.github/workflows/deploy-pages.yml` → `tools/armar_pagina.py presentismo-app`). La APK se arma con `.github/workflows/apk-presentismo.yml` (proyecto `android-presentismo`).

## Instalación / actualización

1. Pegá los tres archivos en el proyecto de Apps Script (un solo archivo de código: Code.gs).
2. Ejecutá `configurarPlanilla()` y aceptá los permisos. En el registro muestra la versión, los servicios, el personal y con qué objetivo coincide cada usuario de servicio.
3. **Implementar > Gestionar implementaciones > editar > Nueva versión** ("Ejecutar como: Yo", "Cualquier persona"). La URL `/exec` no cambia.
4. La versión de `Code.gs` e `Index.html` (`VERSION`) tiene que ser la misma; si no, la app avisa que está desactualizada.

## Datos

- **Servicios:** pestaña `objetivos` de Stock Manager, menos los que terminan en "baja".
- **Usuarios:** pestaña `Usuarios y contraseñas` de Stock Manager. Rol *Servicios* = encargado del objetivo con el mismo nombre; *Supervisor* y *Administrador* ven todo. Otros usuarios se asignan en la pestaña `Encargados`.
- **Correo del servicio:** columna correo del usuario de servicio.
- **Personal:** pestaña personal de Stock Manager (sin bajas). El personal actual de cada servicio sale de las novedades semanales (`NOVEDADES_BASE_ID`) y de los presentes de los últimos 45 días.
- **Planilla Presentismo de Servicios:** `Presentes`, `Codigos` (tipos de licencia), `Encargados`, `Envios`.

## Ajustes en Code.gs

- `NOVEDADES_BASE_ID`: ID de "Novedades del Personal - Base" (compartida con delbensgii como Lector).
- `DIAS_ATRAS_ENCARGADO`: hasta cuántos días atrás informa y anula el encargado (3).
- `MAIL_PRUEBA`: si tiene un correo, todos los mails van solo ahí; vacío = van a los servicios.
