# Mansión Sombranegra

Juego de terror y misterio (3 capítulos) creado por Fernando Jacyno, 10/2026.

- Se juega en: https://ferchu17.github.io/Delben/mansion/
- APK de Android: https://github.com/ferchu17/Delben/releases/download/mansion-apk/MansionSombranegra.apk (la arma `.github/workflows/apk-mansion.yml` con el proyecto `android-mansion/`)

## Cómo está armado

El código está en `src/` y se junta en un solo archivo con:

```
python3 juego-mansion/build.py
```

Eso genera `index.html` (lo que publica GitHub Pages) y `mansion-claude.html` (la versión para Claude).
Después de cambiar algo en `src/`, hay que correr `build.py` y subir también `index.html`.

| Archivo | Qué tiene |
|---|---|
| `src/head.html` | Estilos y pantallas (portada, diario, candados, menú, ayuda) |
| `src/core.js` | Sonido sintetizado, controles, dibujo de mapas, personajes, criaturas y sustos |
| `src/content.js` | El caso sorteado (sospechosos, armas, claves), los documentos y los 7 mapas |
| `src/content2.js` | Objetos, acertijos, sustos guionados, eventos y objetivos de cada capítulo |
| `src/systems.js` | Estado, jugador, linterna, cordura, IA de las criaturas, escondites y luces |
| `src/ui.js` | Diálogos, paneles, guardado (aparato, nube de Claude y código), juego en línea y arranque |

Para agregar capítulos: sumar el mapa en `buildAreas()` (content.js), sus objetos en `populate()`
y sus objetivos en `objetivo()` (content2.js).
