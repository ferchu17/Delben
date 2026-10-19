# Novedades del Personal — App (Apps Script + GitHub Pages)

Carpeta nueva y separada del resto del repositorio. Contiene la app **Novedades del Personal** completa (versión 1.25.1) y la página que la publica en GitHub sin el cartel de Google.

- **Link para compartir (no cambia nunca):** https://ferchu17.github.io/Delben/novedades/
- **Fuente de verdad:** la carpeta `apps-script/` tiene los mismos archivos que el proyecto de Apps Script, sin cambios.

## Botón SGI

El botón SGI abre el SGI publicado en GitHub (https://ferchu17.github.io/Delben/sgi/) con el acceso directo: entra sin volver a pedir usuario y clave. Ver `sgi-app/README.md`.

## Cómo funciona

```
Usuario ──> https://ferchu17.github.io/Delben/novedades/   (la pantalla: GitHub Pages, sin cartel de Google)
                │  login / api   (fetch POST)
                ▼
        Apps Script /exec  (doPost en Code.gs)  ──>  planillas, Drive, Stock Manager, modelos de Excel
```

- La pantalla es la misma `Index.html` + `Styles` + `Logo` + `Formato` + `App` de Apps Script, armada en una sola página por `tools/armar_pagina.py` (en la raíz del repositorio, lo usan Novedades y el SGI).
- `web/puente.js` hace que cada `google.script.run.login(...)` / `google.script.run.api(...)` se mande al `doPost` de Apps Script. **La lógica, las fórmulas, los cálculos y los formatos de los Excel no cambian**: todo sigue corriendo en Apps Script con los mismos archivos.
- El link viejo de Apps Script (`/exec`) sigue funcionando igual.

## Puesta en marcha (una sola vez)

1. En Apps Script, reemplazá `Code.gs` por el de `apps-script/Code.gs` (trae la función `doPost`).
2. **Implementar → Gestionar implementaciones → lápiz (editar) → Versión: Nueva versión → Implementar.**
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier persona** (si está en "cualquier persona con cuenta de Google", la página no puede conectarse).
3. Copiá la URL de la Aplicación web (termina en `/exec`) y pegala en `web/config.js`:
   `window.NOVEDADES_BACKEND = 'https://script.google.com/macros/s/.../exec';`
4. Subí el cambio a `main`: GitHub Actions arma la página sola (workflow *Deploy Delben to GitHub Pages*).

## Cómo seguir trabajando

- Cada versión nueva: se reemplazan los archivos que cambian en `apps-script/` (y en el proyecto de Apps Script). Al subir a `main`, la página se vuelve a armar sola.
- **Para que la URL de Apps Script no cambie:** siempre *editar* la implementación existente (lápiz → Nueva versión). "Nueva implementación" crea otra URL.
- Si alguna vez la URL de Apps Script cambia, solo se cambia `web/config.js`; el link de GitHub para la gente sigue igual.
- También se puede probar otro servidor sin tocar el repositorio: `https://ferchu17.github.io/Delben/novedades/?servidor=URL_EXEC` (queda guardado en ese navegador).

## Lo que no está en el repositorio (a propósito)

El repositorio es **público**. Por eso no se suben:

- `InstructivoImg.html` (capturas del Instructivo con datos reales de personas). Va solo en el proyecto de Apps Script; la página lo pide al servidor cuando se abre el Instructivo.
- Los datos de prueba de la demo.

Los datos (planillas, personal, Stock Manager) nunca están en GitHub: quedan en Google Drive con sus permisos, y la app pide usuario y clave de SGI para todo.

## Estructura

```
novedades-app/
├── apps-script/        Archivos del proyecto de Apps Script (copiar tal cual)
└── web/
    ├── config.js       URL del servidor (Apps Script /exec)
    └── puente.js       google.script.run -> doPost

tools/armar_pagina.py   (raíz del repositorio) arma la página con los include() de Index.html
```
