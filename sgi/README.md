# DELBEN SGI — migración a GitHub Pages

La migración se trabaja en esta rama separada: **sgi-github-pages**.

## Cómo está ahora

- `sgi/index.html`: interfaz completa del SGI original preparada para ejecutarse como página estática.
- `sgi-github-adapter.js`: adaptador de `google.script.run` a HTTP.
- `SGI_GitHub_API.gs`: puente del lado Apps Script.
- `sgi/config.html`: pantalla para guardar y probar la URL del nuevo backend.

## Backend

El nuevo backend debe ser una **copia** del proyecto Apps Script original del SGI. Se debe conservar el `Code.gs` original y agregar `SGI_GitHub_API.gs`.

El puente expone las funciones que la interfaz utiliza y agrega soporte para `uploadFotosDrive`.

## Flujo de prueba

1. Crear una copia del proyecto Apps Script original.
2. Copiar el `Code.gs` original a esa copia, sin modificar el proyecto original.
3. Agregar `SGI_GitHub_API.gs`.
4. Implementar el proyecto como Web App. Para un frontend público de GitHub Pages, la implementación debe permitir acceso anónimo y ejecutar con la identidad del usuario propietario del proyecto. Google documenta estas opciones en la configuración de Web Apps. 
5. Abrir `sgi/config.html`, pegar la URL `/exec`, guardar y probar.
6. Entrar a `sgi/index.html` y validar login, lecturas, guardados, correos, Drive y demás módulos.

El frontend usa `Content-Type: text/plain` en el POST para evitar el preflight habitual y sigue redirecciones del Web App.
