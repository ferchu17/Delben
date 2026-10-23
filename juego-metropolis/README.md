# Metrópolis Infinita

Juego de construir ciudades y estados para celular y computadora.
Realizado por Fernando Jacyno · 10/2026.

- Juego: https://ferchu17.github.io/Delben/metropolis/
- APK para Android: https://github.com/ferchu17/Delben/releases/download/metropolis-apk/MetropolisInfinita.apk
- Aparece en el Portal de aplicaciones: https://ferchu17.github.io/Delben/portal/

## Archivos

- `index.html`: el juego completo (un solo archivo). Se publica en `/metropolis/` con el workflow `deploy-pages.yml`.
- `servidor.gs`: el servidor para jugar en línea (Apps Script). No se publica en GitHub Pages.
- La APK se arma sola con `.github/workflows/apk-metropolis.yml` cuando cambia la carpeta `android-metropolis/`.

## Servidor para jugar en línea (una sola vez)

1. Crear una planilla de Google nueva, por ejemplo "Metrópolis Infinita - Servidor".
2. Extensiones › Apps Script. Borrar lo que haya y pegar `servidor.gs` completo.
3. Implementar › Nueva implementación › Aplicación web. Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
4. Autorizar los permisos y copiar el link que termina en `/exec`.
5. En el juego: Menú › Juego en línea › pegar el link › Guardar y probar.
   El link ya está fijo en `SERVIDOR_POR_DEFECTO` dentro de `index.html`, así que todos se conectan solos.

Las hojas Usuarios, Ofertas y Buzon se crean solas. Las partidas en la nube se guardan en la carpeta de Drive "Metrópolis Infinita - Partidas".
Cada vez que se cambie `servidor.gs` hay que hacer Implementar › Gestionar implementaciones › Editar › Nueva versión.
