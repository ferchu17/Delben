# DELBEN SGI — Migración a GitHub Pages

Esta rama es una copia de trabajo. Los archivos originales del SGI no se modifican.

## Primer paso completado
Se agregó `SGI_GitHub_API.gs`, que expone por POST las funciones que el frontend original utiliza mediante `google.script.run`.

También se agregó `sgi-github-adapter.js`, que mantiene la API `google.script.run` en el navegador y la transporta al backend por HTTP.

## Estado actual
La interfaz original todavía no fue publicada como página de GitHub. Antes de moverla hay que integrar sus cuatro archivos (ADMIN + JS1/JS2/JS3), conservar sus estilos y probar el acceso a Sheets/Drive/correos.

## Backend necesario
El puente se agrega a una COPIA del proyecto Apps Script original. No reemplaza `Code.gs`.

El frontend guardará la URL de la implementación en:
`localStorage.delben_sgi_backend`

Para configurarla desde la consola del navegador:
```js
setDelbenSgiBackendUrl('https://script.google.com/macros/s/XXXXX/exec')
```

## Funciones actualmente contempladas por el puente
getData, getBatchData, getDataAsObjects, getExternalData,
guardarUltimaConexion, getUltimasConexiones, appendRowSafe, updateRow,
deleteRow, deleteRowsByIds, appendRowsAutoId, ensureMovilerosTilde,
setCellByHeader, upsertRows, saveSheetData, saveAllRows, appendRow,
clearSheet, loginCheck, cambiarPassword, enviarCorreoSalida,
enviarCorreoSalidaMasiva, enviarCorreoCorrespondePedido,
enviarCorreoPreparacion, enviarWhatsApp, getAparienciaConfig,
saveAparienciaConfig.
