# DELBEN SGI — App (Apps Script + GitHub Pages)

Carpeta nueva y separada del resto (la carpeta vieja `sgi/` no se usa para esto).

- **Link para compartir (no cambia nunca):** https://ferchu17.github.io/Delben/sgi/
- **Acceso directo desde Novedades del Personal:** el botón SGI abre `https://ferchu17.github.io/Delben/sgi/?sso=...` y entra con el mismo usuario, sin pedir la clave (pase de un solo uso que vence a los 2 minutos, firmado con la clave de la pestaña oculta `SSO_Novedades` de Stock Manager).
- **Fuente de verdad:** `apps-script/` tiene los archivos del proyecto de Apps Script del SGI.

## Archivos

| Archivo | Qué cambió |
|---|---|
| `Code.gs` | `doGet` valida el acceso directo (`?sso=`) y nueva función `loginSSO`. El resto, igual. |
| `JS3.html` | Entrar con el acceso directo (`_entrarSGI`), tanto desde Apps Script como desde GitHub. La key de Gemini ya no está escrita en el código: se pide al servidor (`getGeminiKey`). El resto, igual. |
| `Admin.html`, `JS1.html`, `JS2.html` | Sin cambios. |
| `PuenteGitHub.gs` | **Nuevo**: `doPost` para la página de GitHub (reemplaza a `SGI_GitHub_API.gs`) y `getGeminiKey`. |

## Puesta en marcha (una sola vez)

1. En el proyecto de Apps Script del SGI: reemplazá `Code.gs` y `JS3.html`, y agregá `PuenteGitHub.gs`.
   Si el proyecto tiene `SGI_GitHub_API.gs`, **borralo** (un proyecto solo puede tener un `doPost`; `PuenteGitHub.gs` hace todo lo que hacía, incluida la subida de fotos).
2. **Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar**,
   con *Ejecutar como: Yo* y *Quién tiene acceso: Cualquier persona*.
3. Key del asistente de IA: Configuración del proyecto (engranaje) > Propiedades de la secuencia de comandos > Agregar: `GEMINI_KEY` = la key de Gemini.
4. La URL `/exec` va en `web/config.js` (`window.NOVEDADES_BACKEND`).

## Cómo funciona

`web/puente.js` (el mismo que Novedades) convierte cada `google.script.run.funcion(...)` en un pedido al `doPost`, y `google.script.url.getLocation` lee los parámetros de la dirección (`?sso=`). La pantalla, los datos y los permisos son los mismos que en Apps Script.
