/**
 * ============================================================
 *  APP DE DATOS DEL PERSONAL - Google Apps Script
 * ============================================================
 *  - Sirve el formulario web (Index.html)
 *  - Guarda los datos en la hoja "informacionpersonal"
 *  - Sube las fotos/documentos de DNI a Drive
 *  - Genera un PDF completo con los datos y las imágenes del DNI
 *  - NO ENVÍA CORREOS
 * ============================================================
 */

const SPREADSHEET_ID = '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY';
const SHEET_NAME = 'informacionpersonal';

const CARPETA_DNI_ANVERSO_ID = '1pM7yFfOkEyTuZy058s74xW-PqIHN-G8CbS3pfNEX--leby4mrhyLuZBV_aKnpzwlIgI9RkCV';
const CARPETA_DNI_REVERSO_ID = '1T2q0XHW3uFBZc9CfgLdomi2BJ6LHiZphBcUNa63qBUdU5MpFflX0E9gp-0gPjz3sRNFg1q-6';

// La carpeta de PDFs se crea automáticamente dentro de Mi unidad.
// Si después querés usar una carpeta existente, reemplazá '' por su ID.
const CARPETA_PDF_ID = '';

const COLUMNAS_TEXTO_FORZADO = [5, 6, 9, 10, 17, 18, 19, 20];

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getPersonalActivo') {
    var salida;
    try {
      salida = { ok: true, personal: getPersonalActivo() };
    } catch (err) {
      salida = { ok: false, error: String(err && err.message ? err.message : err) };
    }

    var callback = e.parameter.callback;
    if (callback && /^[A-Za-z_$][\\w$.]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(salida) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService
      .createTextOutput(JSON.stringify(salida))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Datos del Personal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** API para el frontend de GitHub Pages. */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var action = String(req.action || '').trim();
    if (action === 'guardarDatos') {
      return ContentService
        .createTextOutput(JSON.stringify(guardarDatos(req.data || {})))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ok:false,error:'Acción no reconocida.'}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ok:false,error:String(err && err.message ? err.message : err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function _normalizarCabeceraPersonal_(valor) {
  return String(valor || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\\s+/g, ' ');
}

function _buscarIndicePersonal_(cabeceras, nombres, fallback) {
  for (var i = 0; i < nombres.length; i++) {
    var objetivo = _normalizarCabeceraPersonal_(nombres[i]);
    var idx = cabeceras.indexOf(objetivo);
    if (idx >= 0) return idx;
  }
  return fallback;
}

function getPersonalActivo() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('personal');
  if (!sheet) throw new Error('No se encontró la pestaña "personal".');

  var values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return [];

  var headers = values[0].map(_normalizarCabeceraPersonal_);

  var iNombre = _buscarIndicePersonal_(headers, [
    'apellido y nombre', 'apellido nombre', 'apellidos y nombre',
    'nombre y apellido', 'nombre completo', 'apellido_nombre',
    'nombre del personal', 'personal', 'nombre', 'nombres'
  ], -1);

  var iApellido = _buscarIndicePersonal_(headers, [
    'apellido', 'apellidos'
  ], -1);

  var iNombres = _buscarIndicePersonal_(headers, [
    'nombre', 'nombres'
  ], -1);

  var iDni = _buscarIndicePersonal_(headers, [
    'dni', 'documento', 'documento nacional de identidad',
    'nro dni', 'n° dni', 'nro. dni'
  ], -1);

  var iLegajo = _buscarIndicePersonal_(headers, [
    'legajo', 'nro legajo', 'n° legajo', 'nro. legajo'
  ], -1);

  var iFecha = _buscarIndicePersonal_(headers, [
    'fecha de nacimiento', 'fecha nacimiento', 'fec nacimiento',
    'f. nacimiento', 'nacimiento', 'fecha'
  ], -1);

  var iEstado = _buscarIndicePersonal_(headers, [
    'estado', 'status', 'situacion', 'situación'
  ], -1);

  if (iNombre < 0 && (iApellido < 0 || iNombres < 0)) {
    throw new Error('No se encontró la columna de nombre en la pestaña "personal".');
  }
  if (iDni < 0) throw new Error('No se encontró la columna DNI en la pestaña "personal".');
  if (iLegajo < 0) throw new Error('No se encontró la columna Legajo en la pestaña "personal".');
  if (iFecha < 0) throw new Error('No se encontró la columna Fecha de nacimiento en la pestaña "personal".');
  if (iEstado < 0) throw new Error('No se encontró la columna Estado en la pestaña "personal".');

  var salida = [];
  var vistos = {};

  for (var r = 1; r < values.length; r++) {
    var row = values[r] || [];
    var estado = String(row[iEstado] || '').trim();
    if (_normalizarCabeceraPersonal_(estado).indexOf('baja') >= 0) continue;

    var nombre = '';
    if (iNombre >= 0) {
      nombre = String(row[iNombre] || '').trim();
    } else {
      nombre = (String(row[iApellido] || '').trim() + ' ' + String(row[iNombres] || '').trim()).trim();
    }

    var dni = String(row[iDni] || '').trim();
    var legajo = String(row[iLegajo] || '').trim();
    var fechaNacimiento = String(row[iFecha] || '').trim();

    if (!nombre) continue;

    var clave = _normalizarCabeceraPersonal_(nombre) + '|' + dni;
    if (vistos[clave]) continue;
    vistos[clave] = true;

    salida.push({
      nombre: nombre,
      dni: dni,
      legajo: legajo,
      fechaNacimiento: fechaNacimiento
    });
  }

  salida.sort(function(a, b) {
    return _normalizarCabeceraPersonal_(a.nombre).localeCompare(_normalizarCabeceraPersonal_(b.nombre), 'es');
  });

  return salida;
}

function _getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No se encontró la pestaña "' + SHEET_NAME + '"');
  return sheet;
}

function _getSiguienteId(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const ultimoId = sheet.getRange(lastRow, 1).getValue();
  const idNum = parseInt(ultimoId, 10);
  return isNaN(idNum) ? lastRow : idNum + 1;
}

function _subirFotoADrive(foto, nombrePersona, etiqueta, carpetaId) {
  if (!foto || !foto.bytes) return '';

  const carpeta = DriveApp.getFolderById(carpetaId);
  const bytes = Utilities.base64Decode(foto.bytes);
  const blob = Utilities.newBlob(
    bytes,
    foto.mimeType || 'application/octet-stream',
    foto.fileName || etiqueta
  );

  const nombreArchivo =
    (nombrePersona || 'SinNombre') + ' - ' + etiqueta + ' - ' + (foto.fileName || 'archivo');
  blob.setName(nombreArchivo);

  const archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return archivo.getUrl();
}

function _getCarpetaPDF() {
  if (CARPETA_PDF_ID) {
    return DriveApp.getFolderById(CARPETA_PDF_ID);
  }

  const nombre = 'PDF - Datos del Personal';
  const existentes = DriveApp.getFoldersByName(nombre);
  if (existentes.hasNext()) return existentes.next();

  return DriveApp.createFolder(nombre);
}

function _si(valor) {
  return valor ? 'SÍ' : '';
}

function _mayus(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return valor.toString().toUpperCase();
}

function _texto(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return String(valor);
}

function _agregarSeccionPDF_(doc, titulo, datos) {
  const p = doc.getBody().appendParagraph(titulo);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  const tabla = doc.getBody().appendTable();
  tabla.setBorderWidth(0.5);

  Object.keys(datos).forEach(function(clave) {
    const fila = tabla.appendTableRow();
    fila.appendTableCell(clave).setBold(true);
    fila.appendTableCell(_texto(datos[clave]));
  });

  doc.getBody().appendParagraph('');
}

function _agregarImagenDNI_(doc, url, titulo) {
  if (!url) return;

  const p = doc.getBody().appendParagraph(titulo);
  p.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  try {
    const archivoId = String(url).match(/[-\w]{25,}/);
    if (!archivoId) {
      doc.getBody().appendParagraph('Archivo: ' + url);
      return;
    }

    const archivo = DriveApp.getFileById(archivoId[0]);
    const mime = archivo.getMimeType();

    if (mime.indexOf('image/') === 0) {
      const img = doc.getBody().appendImage(archivo.getBlob());
      const maxW = 430;
      if (img.getWidth() > maxW) {
        const ratio = maxW / img.getWidth();
        img.setWidth(maxW);
        img.setHeight(Math.round(img.getHeight() * ratio));
      }
      doc.getBody().appendParagraph('');
    } else {
      doc.getBody().appendParagraph(
        'El archivo no es una imagen (por ejemplo, PDF). Se guardó el enlace:'
      );
      doc.getBody().appendParagraph(url);
    }
  } catch (err) {
    doc.getBody().appendParagraph('No se pudo insertar la imagen. Archivo: ' + url);
  }
}

function _generarPDFPersonal_(data, id, fecha, urlAnverso, urlReverso) {
  const nombre = _mayus(data.apellidoNombre) || 'SIN NOMBRE';
  const doc = DocumentApp.create('DATOS DEL PERSONAL - ' + nombre + ' - ID ' + id);
  const body = doc.getBody();

  body.clear();

  const titulo = body.appendParagraph('FICHA DE DATOS DEL PERSONAL');
  titulo.setHeading(DocumentApp.ParagraphHeading.TITLE);
  titulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const subtitulo = body.appendParagraph('KTL SEGURIDAD');
  subtitulo.setBold(true);
  subtitulo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const info = body.appendParagraph(
    'ID: ' + id + '    |    Fecha de carga: ' +
    Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
  );
  info.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendHorizontalRule();

  _agregarSeccionPDF_(doc, '1. DATOS PERSONALES', {
    'Dirección de correo': data.direccionCorreo,
    'Apellido y Nombre': data.apellidoNombre,
    'Legajo': data.legajo,
    'DNI': data.dni,
    'Fecha de nacimiento': data.fechaNacimiento
  });

  _agregarSeccionPDF_(doc, '2. DOMICILIO', {
    'Domicilio': data.domicilio,
    'Altura': data.altura,
    'Piso - Dpto': data.pisoDpto,
    'Entre calle': data.entreCalle1,
    'Entre calle': data.entreCalle2,
    'Datos adicionales': data.datosAdicional,
    'Localidad': data.localidad,
    'Partido': data.partido,
    'Observaciones': data.observaciones
  });

  _agregarSeccionPDF_(doc, '3. DATOS DE CONTACTO', {
    'Teléfono celular': data.telefonoCelular,
    'Teléfono fijo': data.telefonoFijo,
    'Otro teléfono': data.otroTelefono,
    'Teléfono de otro contacto': data.telefonoOtroContacto,
    'Correo electrónico': data.correoElectronico
  });

  _agregarSeccionPDF_(doc, '4. ¿CON QUIÉN VIVE?', {
    'Padre': _si(data.conQuienVive && data.conQuienVive.padre),
    'Madre': _si(data.conQuienVive && data.conQuienVive.madre),
    'Suegro': _si(data.conQuienVive && data.conQuienVive.suegro),
    'Suegra': _si(data.conQuienVive && data.conQuienVive.suegra),
    'Esposa': _si(data.conQuienVive && data.conQuienVive.esposa),
    'Hijo 1': _si(data.conQuienVive && data.conQuienVive.hijo1),
    'Hijo 2': _si(data.conQuienVive && data.conQuienVive.hijo2),
    'Hijo 3': _si(data.conQuienVive && data.conQuienVive.hijo3),
    'Hijo 4': _si(data.conQuienVive && data.conQuienVive.hijo4),
    'Hijo 5': _si(data.conQuienVive && data.conQuienVive.hijo5)
  });

  _agregarSeccionPDF_(doc, '5. FAMILIARES', {
    'Padre': data.nombrePadre,
    'Madre': data.nombreMadre,
    'Suegro': data.nombreSuegro,
    'Suegra': data.nombreSuegra,
    'Hijo 1 - Nombre': data.hijo1Nombre,
    'Hijo 1 - Fecha': data.hijo1Fecha,
    'Hijo 2 - Nombre': data.hijo2Nombre,
    'Hijo 2 - Fecha': data.hijo2Fecha,
    'Hijo 3 - Nombre': data.hijo3Nombre,
    'Hijo 3 - Fecha': data.hijo3Fecha,
    'Hijo 4 - Nombre': data.hijo4Nombre,
    'Hijo 4 - Fecha': data.hijo4Fecha,
    'Hijo 5 - Nombre': data.hijo5Nombre,
    'Hijo 5 - Fecha': data.hijo5Fecha
  });

  _agregarSeccionPDF_(doc, '6. EDUCACIÓN', {
    'Posee secundario': data.poseeSecundario,
    'Posee analítico o título': data.poseeAnaliticoTitulo,
    'Observaciones': data.observacionesAnalitico
  });

  _agregarImagenDNI_(doc, urlAnverso, '7. DNI - ANVERSO');
  _agregarImagenDNI_(doc, urlReverso, '8. DNI - REVERSO');

  _agregarSeccionPDF_(doc, '9. DECLARACIONES', {
    'Domicilio': _si(data.declaracionDomicilio),
    'Declaración jurada 1': _si(data.declaracionJurada1),
    'Declaración jurada 2': _si(data.declaracionJurada2)
  });

  const pie = body.appendParagraph(
    'Documento generado automáticamente por la aplicación de Datos del Personal.'
  );
  pie.setItalic(true);
  pie.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(doc.getId())
    .getBlob()
    .setName('DATOS DEL PERSONAL - ' + nombre + ' - ID ' + id + '.pdf');

  const carpetaPDF = _getCarpetaPDF();
  const pdfFile = carpetaPDF.createFile(pdfBlob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // El Google Doc intermedio no se necesita después de crear el PDF.
  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return {
    url: pdfFile.getUrl(),
    id: pdfFile.getId(),
    nombre: pdfFile.getName()
  };
}

function guardarDatos(data) {
  try {
    const sheet = _getSheet();
    const id = _getSiguienteId(sheet);
    const fecha = new Date();

    const nombrePersona = data.apellidoNombre || '';

    const urlAnverso = _subirFotoADrive(
      data.fotoDniAnverso,
      nombrePersona,
      'DNI Anverso',
      CARPETA_DNI_ANVERSO_ID
    );

    const urlReverso = _subirFotoADrive(
      data.fotoDniReverso,
      nombrePersona,
      'DNI Reverso',
      CARPETA_DNI_REVERSO_ID
    );

    const fila = [
      id,
      fecha,
      _mayus(data.direccionCorreo),
      _mayus(data.apellidoNombre),
      _mayus(data.legajo),
      _mayus(data.dni),
      _mayus(data.fechaNacimiento),
      _mayus(data.domicilio),
      _mayus(data.altura),
      _mayus(data.pisoDpto),
      _mayus(data.entreCalle1),
      _mayus(data.entreCalle2),
      _mayus(data.datosAdicional),
      _mayus(data.localidad),
      _mayus(data.partido),
      _mayus(data.observaciones),
      _mayus(data.telefonoCelular),
      _mayus(data.telefonoFijo),
      _mayus(data.otroTelefono),
      _mayus(data.telefonoOtroContacto),
      _mayus(data.correoElectronico),
      _si(data.conQuienVive && data.conQuienVive.padre),
      _si(data.conQuienVive && data.conQuienVive.madre),
      _si(data.conQuienVive && data.conQuienVive.suegro),
      _si(data.conQuienVive && data.conQuienVive.suegra),
      _si(data.conQuienVive && data.conQuienVive.esposa),
      _si(data.conQuienVive && data.conQuienVive.hijo1),
      _si(data.conQuienVive && data.conQuienVive.hijo2),
      _si(data.conQuienVive && data.conQuienVive.hijo3),
      _si(data.conQuienVive && data.conQuienVive.hijo4),
      _si(data.conQuienVive && data.conQuienVive.hijo5),
      _mayus(data.nombrePadre),
      _mayus(data.nombreMadre),
      _mayus(data.nombreSuegro),
      _mayus(data.nombreSuegra),
      _mayus(data.hijo1Nombre),
      _mayus(data.hijo1Fecha),
      _mayus(data.hijo2Nombre),
      _mayus(data.hijo2Fecha),
      _mayus(data.hijo3Nombre),
      _mayus(data.hijo3Fecha),
      _mayus(data.hijo4Nombre),
      _mayus(data.hijo4Fecha),
      _mayus(data.hijo5Nombre),
      _mayus(data.hijo5Fecha),
      _mayus(data.poseeSecundario),
      _mayus(data.poseeAnaliticoTitulo),
      _mayus(data.observacionesAnalitico),
      urlAnverso,
      urlReverso,
      _si(data.declaracionDomicilio),
      _si(data.declaracionJurada1),
      _si(data.declaracionJurada2)
    ];

    const nextRow = sheet.getLastRow() + 1;

    COLUMNAS_TEXTO_FORZADO.forEach(function(col) {
      sheet.getRange(nextRow, col).setNumberFormat('@');
    });

    sheet.getRange(nextRow, 1, 1, fila.length).setValues([fila]);

    return {
      ok: true,
      id: id,
      fotoDniAnversoUrl: urlAnverso,
      fotoDniReversoUrl: urlReverso
    };
  } catch (err) {
    return {
      ok: false,
      error: String(err && err.message ? err.message : err)
    };
  }
}