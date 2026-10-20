# Minuta Operativa del Servicio

App web (GitHub Pages) + backend en Google Apps Script. Carpeta del repo: `minuta-operativa/`.

```
index.html · manifest.webmanifest · sw.js
css/app.css
js/config.js · js/app.js · js/pdf.js
assets/logo_delben.png (app) · assets/logo_ktl.jpg (PDF) · íconos
assets/logos/san-francisco.png · assets/logos/fincas-de-iraola-2.png
backend/Code.gs · backend/appsscript.json
```

## 1. Backend (Apps Script) — con la cuenta delbensgi@gmail.com
1. script.google.com → Proyecto nuevo "Minuta Operativa" → pegar `backend/Code.gs`.
   En Configuración del proyecto activar "Mostrar el archivo de manifiesto appsscript.json" y pegar el de `backend/`.
2. Ejecutar **`prepararPlanilla`** una vez (acepta permisos). Crea las pestañas/columnas que falten y carga
   en `Config_Servicios` los 5 servicios con usuario "Servicios" (solo si está vacía).
3. Ejecutar **`probar`** y mirar el registro: usuarios, personal, códigos, servicios, carpeta y cupo de correos.
4. Implementar → Nueva implementación → Aplicación web → Ejecutar como: **yo** · Acceso: **cualquier persona** → copiar la URL `/exec`.
   Cada vez que se cambie `Code.gs`: Implementar → Gestionar implementaciones → editar → **Nueva versión**.

La cuenta que implementa tiene que poder **editar** la planilla Minuta Operativa y la carpeta de minutas,
y **leer** Stock Manager (usuarios y personal).

## 2. Frontend
1. Pegar la URL `/exec` en `js/config.js` → `API_URL`. Sin URL la app corre en MODO DEMO (usuario demo / clave demo).
2. Subir la carpeta `minuta-operativa/` al repo. Queda en `https://ferchu17.github.io/Delben/minuta-operativa/`.
3. APK: en WebIntoApp cargar ese link.

## Cómo funciona
- **MODO PRUEBA** (`CONFIG.MODO_PRUEBA = true` en `Code.gs`): todos los correos van solo a `CORREO_PRUEBA`.
  El mail dice a quiénes se hubiera enviado. Cuando esté todo bien: poner `false` y publicar una Nueva versión.
- **Ingreso**: usuario y contraseña de la pestaña "Usuarios y contraseñas" de SGI.
  - Rol *Servicios*: el servicio es el usuario (ej. `sfrancisco`, `laguna`, `raizen`, `arauco`, `azarate`).
    Entra directo a su servicio, con su logo y su supervisor, y no puede cambiar de servicio.
    Si el usuario todavía no está en `Config_Servicios`, se agrega solo con el nombre del usuario y los datos de `objetivos`.
  - *Supervisor*, *Administrador* y *Visor*: solo ven la pestaña Informes, de sus servicios o de todos.
- **Logos**: salen solos por el nombre del servicio (lista `LOGOS` en `Code.gs`, archivos en `assets/logos/`).
  Para un cliente nuevo: subir el logo y agregar una línea. Si se completa `logoCliente` en `Config_Servicios`, manda ese.
- **Config_Servicios** (una fila por servicio):
  - `supervisor`: el usuario de SGI (ej. `gvica`).
  - `secciones`, `vehiculos` y `equipos`: listas separadas por `;`. Los vehículos van como `Vehículo|Dominio`.
  - `correos`: correos fijos extra del servicio, en copia siempre.
  - `idCarpeta`: opcional. Si queda vacío, se usa (o se crea) una subcarpeta con el nombre del servicio.
  - `activo`: NO para ocultarlo.
- **Fotos**: hasta 60 por minuta (`FOTOS_MAX` en `js/config.js`). Se pueden agregar de a varias, en cualquier momento.
- **Horas**: diurnas de 06:00 a 21:00 y nocturnas de 21:00 a 06:00. Se calculan solas con el ingreso y el egreso.
- **Guardar y enviar**: arma el PDF, lo guarda en Drive, guarda los datos en las pestañas y manda el mail.
  La minuta guardada **no se puede modificar**.
  - **Para**: el supervisor de turno elegido, el encargado que hace el informe (correo de la pestaña personal) y la cuenta del servicio.
  - **Copia**: Gustavo San Martín, Fernando, el supervisor del servicio, los correos fijos del servicio y los que se agreguen (cliente, nocturno…).
- **Contactos**: los que agregan al enviar quedan en `Minuta_Contactos` para ese servicio.
- **Informes**: buscador por cualquier dato (novedades, vigilador, legajo, patente, sector, fecha), con Ver PDF, Descargar y Reenviar.
- **Borrador**: mientras cargan, la minuta se guarda sola en el celular. Si se cierra la app, no se pierde.

## Pestañas nuevas o columnas agregadas por la app
- `Minutas`: + `guardia`, `tituloInforme`
- `Minuta_Personal`: + `horasDiurnas`, `horasNocturnas`
- `Minuta_Contactos` (nueva): idServicio | servicio | nombre | correo | fechaAlta | usuario
