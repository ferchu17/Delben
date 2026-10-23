# Licencias del Personal

App para que el supervisor cargue licencias (vacaciones, enfermedad, ART, fallecimiento, nacimiento, maternidad, matrimonio, sin goce, suspensión, sanción, cambio de objetivo) con firma digital del supervisor y del vigilador, foto o archivo del certificado, PDF A4 con logo KTL y envío por mail.

## Archivos

| Archivo | Dónde va |
|---|---|
| `Code.gs` | Proyecto de Apps Script (cuenta **delbensgii@gmail.com**) |
| `index.html` | Proyecto de Apps Script, como archivo HTML llamado **index**. Es la misma pantalla que se publica en GitHub Pages |
| `appsscript.json` | Manifiesto del proyecto de Apps Script |

## Instalación

1. Con la cuenta delbensgii@gmail.com, abrí la planilla de Licencias y entrá en **Extensiones > Apps Script**.
2. Pegá `Code.gs`, creá el archivo HTML `index` y pegá `index.html`. En Configuración del proyecto activá "Mostrar el archivo de manifiesto appsscript.json" y pegá `appsscript.json`.
3. Compartí **Stock Manager** con delbensgii@gmail.com como **editor**. De ahí salen el personal, los objetivos y los usuarios, y la app guarda el email del vigilador en la columna O de Personal.
4. Ejecutá `instalar()` una vez y autorizá los permisos. Crea las hojas y la carpeta de Drive "Licencias del Personal" con su subcarpeta "Adjuntos", y en el Registro de ejecución muestra un diagnóstico.
5. En la hoja **Config** cargá los tres correos de RRHH (`RRHH_1`, `RRHH_2`, `RRHH_3`).
6. Implementá: **Implementar > Nueva implementación > Aplicación web**, con "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier persona".
7. Pegá la URL `/exec` en `BACKEND_DEFAULT` dentro de `index.html` (en GitHub) para que funcione desde GitHub Pages.

## Hojas de la planilla

- **Licencias**: una fila por licencia con N°, fechas, supervisor, vigilador, legajo, DNI, empresa, objetivo, tipo, período, desde, hasta, días, reintegro, motivo, firma, links del PDF y de los adjuntos, estado y a quién se envió.
- **TiposLicencia**: los tipos y sus textos. Para agregar uno nuevo se suma una fila, sin tocar el código. Columnas:
  - `fechas`: RANGO, DESDE o NO
  - `periodo`: SI o NO
  - `certificado`: NO, OPCIONAL u OBLIGATORIO
  - `firma empleado`: SI, OPCIONAL o NO
  - `motivo`: SI o NO
  - `objetivo nuevo`: SI o NO
  - `activo`: SI o NO

  Variables que se pueden usar en el texto: `{dias} {desde} {hasta} {reintegro} {periodo} {tipo} {objetivo} {objetivoNuevo} {motivo} {empleado} {empresa}`.
- **Empresas**: código de la solapa Personal → razón social que se imprime (LEGUYET → L.E. GUYET, KDE → KONTROL DEFENSA ELECTRONICA S.A., PPQ → P.P.Q S.A.).
- **Destinatarios**: los que salen marcados por defecto en cada licencia (además del supervisor que inició sesión). En pantalla se pueden quitar o agregar otros.
- **Contactos**: libreta de direcciones para la lista desplegable de destinatarios. Se puede importar tal cual el CSV que exporta Outlook (Nombre, Apellidos, Dirección de correo electrónico). También aparecen los usuarios de SGI que tienen email.
- **Config**: `EMAIL_ADMIN` (copia de todo), `RRHH_1..3`, `CIUDAD`.

## Mails

- **Para**: el vigilador (si tiene email; si no, `EMAIL_ADMIN`).
- **CC**: el supervisor que inició sesión, `EMAIL_ADMIN` y RRHH 1 a 3.
- **Adjuntos**: el PDF y los certificados.

## Conexión con Novedades del Personal

- `licenciasDePersona(token, dniOLegajo, empresa)` devuelve las licencias de una persona.
- Abrir `licencias/?dni=30111222` muestra directo las licencias de ese DNI (después de iniciar sesión).
