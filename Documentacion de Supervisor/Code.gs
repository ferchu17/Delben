// =============================================================================
// DELBEN SGI · Documentación para supervisores
// Proyecto de Apps Script independiente. Archivos: Código.gs + Index (HTML)
// =============================================================================

// Planilla de SGI de donde se toman flota, documentación, pólizas y personal.
var SS_ID = '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY';

// -----------------------------------------------------------------------------
// SECCIONES (botones de la pantalla principal)
// tipo 'automotriz': listado de vehículos (hojas flota + documentacion + polizasid)
// tipo 'personas'  : listado de personal + documentos de la carpeta de Drive
// -----------------------------------------------------------------------------
var CONFIG = {
  secciones: [
    {
      id: 'automotriz',
      tipo: 'automotriz',
      titulo: 'Automotriz',
      icono: 'fa-car',
      color1: '#8A5212', color2: '#C08A2E'
    },
    {
      id: 'art',
      tipo: 'personas',
      titulo: 'ART',
      icono: 'fa-helmet-safety',
      color1: '#5B1F86', color2: '#8E3FBF',
      folderId: '1FoxJ4mUZaCVTmYMk83KXfTinjrUOAfc7',
      // Carpetas por empresa. Si queda vacío, se usan las subcarpetas de folderId.
      carpetas: []
    },
    {
      id: 'seguro-vida',
      tipo: 'personas',
      titulo: 'Seguro de vida',
      icono: 'fa-heart-pulse',
      color1: '#14653A', color2: '#2BAE66',
      folderId: '11rukAFFvCUvZ6W5bSF1aV3OvFxMDWSFI',
      carpetas: []
    }
  ],
  profundidadMaxima: 4,
  maxAdjuntosMB: 24,
  // Minutos que se guardan los listados en memoria para que abran rápido.
  minutosCache: 10,
  // Opcional: ID de planilla para registrar envíos (pestaña "envios"). Vacío = no registra.
  registroSheetId: ''
};

var ZONA = 'America/Argentina/Buenos_Aires';
var MIME_ACCESO_DIRECTO = 'application/vnd.google-apps.shortcut';
var MIME_CARPETA = 'application/vnd.google-apps.folder';

// -----------------------------------------------------------------------------
// WEB APP
// -----------------------------------------------------------------------------
function doGet() {
  var t = HtmlService.createTemplateFromFile('Index');
  t.configJson = JSON.stringify(getConfigApp());
  return t.evaluate()
    .setTitle('DELBEN · Documentación')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getConfigApp() {
  return {
    secciones: CONFIG.secciones.map(function (s) {
      return { id: s.id, tipo: s.tipo, titulo: s.titulo, icono: s.icono, color1: s.color1, color2: s.color2 };
    })
  };
}

function buscarSeccion_(id) {
  for (var i = 0; i < CONFIG.secciones.length; i++) if (CONFIG.secciones[i].id === id) return CONFIG.secciones[i];
  throw new Error('La sección solicitada no existe.');
}

// -----------------------------------------------------------------------------
// CACHE: los listados se guardan unos minutos para que las pantallas abran rápido
// -----------------------------------------------------------------------------
function conCache_(clave, fn) {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get(clave);
  if (guardado) { try { return JSON.parse(guardado); } catch (_) {} }
  var valor = fn();
  var t = JSON.stringify(valor);
  if (t.length < 95000) cache.put(clave, t, CONFIG.minutosCache * 60);
  return valor;
}

// Ejecutar a mano desde el editor si se quiere ver un cambio de la planilla al instante.
function limpiarCache() {
  var claves = ['auto_datos', 'personal'];
  CONFIG.secciones.forEach(function (s) { claves.push('carpeta_' + s.id); });
  CacheService.getScriptCache().removeAll(claves);
}

// -----------------------------------------------------------------------------
// UTILIDADES DE PLANILLA
// -----------------------------------------------------------------------------
function norm_(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
  return s.replace(/[^a-z0-9]/g, '');
}

// Devuelve las filas de una hoja como objetos {encabezadoNormalizado: valor}
function leerHoja_(nombre) {
  var sh = SpreadsheetApp.openById(SS_ID).getSheetByName(nombre);
  if (!sh) throw new Error('No se encontró la hoja "' + nombre + '" en la planilla de SGI.');
  var datos = sh.getDataRange().getValues();
  if (datos.length < 2) return [];
  var enc = datos[0].map(norm_);
  return datos.slice(1).map(function (fila) {
    var o = {};
    enc.forEach(function (h, i) { if (h) o[h] = fila[i]; });
    return o;
  }).filter(function (o) {
    return Object.keys(o).some(function (k) { return k !== 'id' && String(o[k]).trim() !== ''; });
  });
}

function fecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, ZONA, 'dd/MM/yyyy');
  return String(v == null ? '' : v).trim();
}

function idDrive_(url) {
  var s = String(url || '').trim();
  if (!s) return '';
  var m = s.match(/\/d\/([A-Za-z0-9_-]{10,})/) || s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
}

function txt_(v) { return String(v == null ? '' : v).trim(); }

// -----------------------------------------------------------------------------
// AUTOMOTRIZ
// No se muestran los vehículos con "No Ver" o "Baja" en observaciones.
// -----------------------------------------------------------------------------
function datosAutomotriz_() {
  var docsPorDominio = {};
  leerHoja_('documentacion').forEach(function (d) {
    var dom = txt_(d.dominio).toUpperCase();
    if (dom) docsPorDominio[dom] = d;
  });

  var vehiculos = [];
  leerHoja_('flota').forEach(function (v) {
    var dom = txt_(v.dominio).toUpperCase();
    if (!dom) return;
    var obs = norm_(v.obs);
    if (obs.indexOf('nover') >= 0 || obs.indexOf('baja') >= 0) return;

    var d = docsPorDominio[dom] || {};
    var docs = [];
    function agregar(tipo, corto, largo, valor) {
      var id = idDrive_(valor);
      docs.push({ tipo: tipo, etiqueta: corto, id: id, nombre: id ? dom + ' - ' + largo : '' });
    }
    agregar('cedula', 'Cédula', 'Cédula verde', d.cedulaverde);
    agregar('vtv', 'VTV', 'VTV', d.vtvlink);
    agregar('tarjeta', 'Tarj. Circ.', 'Tarjeta de circulación', d.tarjcirculacion);

    vehiculos.push({
      dominio: dom,
      marca: txt_(v.marca),
      modelo: txt_(v.modelo),
      anio: txt_(v.anio),
      empresa: txt_(v.empresa),
      ubicacion: txt_(v.ubicacion),
      vtv: fecha_(v.vtv),
      poliza: fecha_(v.poliza),
      docs: docs
    });
  });
  vehiculos.sort(function (a, b) { return a.dominio.localeCompare(b.dominio); });

  var polizas = leerHoja_('polizasid').map(function (p) {
    var emp = txt_(p.empresa);
    var docs = [];
    [['poliza', 'Póliza', p.poliza], ['frente', 'Frente póliza', p.frentepoliza]].forEach(function (x) {
      var id = idDrive_(x[2]);
      docs.push({ tipo: x[0], etiqueta: x[1], id: id, nombre: id ? emp + ' - ' + x[1] : '' });
    });
    return { empresa: emp, cuit: txt_(p.cuit), observaciones: txt_(p.observaciones), docs: docs };
  }).filter(function (p) { return p.empresa; });

  return { vehiculos: vehiculos, polizas: polizas };
}

function getDatosAutomotriz() {
  var datos = conCache_('auto_datos', datosAutomotriz_);
  var permitidos = {};
  datos.vehiculos.concat(datos.polizas).forEach(function (x) {
    x.docs.forEach(function (d) { if (d.id) permitidos[d.id] = d.nombre; });
  });
  guardarPermitidos_('automotriz', permitidos);
  return datos;
}

// -----------------------------------------------------------------------------
// PERSONAL (ART y Seguro de vida). No se muestran las bajas.
// -----------------------------------------------------------------------------
function getPersonal(seccionId) {
  var s = buscarSeccion_(seccionId);
  if (s.tipo !== 'personas') throw new Error('Esta sección no tiene listado de personal.');
  return conCache_('personal', personal_);
}

function personal_() {
  return leerHoja_('personal').filter(function (p) {
    return txt_(p.nombre) && norm_(p.estado) !== 'baja';
  }).map(function (p) {
    return {
      nombre: txt_(p.nombre),
      legajo: txt_(p.legajo).replace(/\.0$/, ''),
      dni: txt_(p.dni).replace(/\.0$/, ''),
      cuil: txt_(p.cuil),
      empresa: txt_(p.empresa),
      supervisor: txt_(p.supervisor)
    };
  }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
}

// -----------------------------------------------------------------------------
// DOCUMENTOS DE LA CARPETA DE DRIVE (ART y Seguro de vida)
// -----------------------------------------------------------------------------
function listarCarpeta(seccionId) {
  var s = buscarSeccion_(seccionId);
  var salida = conCache_('carpeta_' + s.id, function () { return listarCarpeta_(s); });
  var permitidos = {};
  salida.forEach(function (d) { permitidos[d.id] = d.nombre; });
  guardarPermitidos_(s.id, permitidos);
  return salida;
}

// Cada documento lleva "empresa" = carpeta de primer nivel (PPQ, LEG, LE GUYET, KDE…)
function listarCarpeta_(s) {
  var salida = [];
  var raices = [];
  if (s.carpetas && s.carpetas.length) {
    s.carpetas.forEach(function (c) { raices.push({ titulo: c.titulo, id: c.folderId }); });
  } else if (s.folderId) {
    var raiz = abrirCarpeta_(s.folderId, s.titulo);
    recorrer_(raiz, '', 0, salida, true);
    subcarpetasDe_(raiz).forEach(function (sub) { raices.push({ titulo: sub.getName(), id: sub.getId(), carpeta: sub }); });
  }
  raices.forEach(function (r) {
    var carpeta = r.carpeta || abrirCarpeta_(r.id, r.titulo);
    recorrer_(carpeta, r.titulo, 1, salida, false);
  });
  salida.forEach(function (d) { d.empresa = d.ruta ? d.ruta.split(' / ')[0] : ''; });
  salida.sort(function (a, b) {
    if (a.ruta !== b.ruta) { if (!a.ruta) return -1; if (!b.ruta) return 1; return a.ruta.localeCompare(b.ruta, 'es'); }
    return a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
  });
  return salida;
}

function abrirCarpeta_(id, nombre) {
  try { return DriveApp.getFolderById(id); }
  catch (e) { throw new Error('No se puede abrir la carpeta "' + nombre + '". Verificá que esté compartida con la cuenta que publicó la app.'); }
}

function subcarpetasDe_(carpeta) {
  var out = [];
  var it = carpeta.getFolders();
  while (it.hasNext()) { var c = it.next(); if (!c.isTrashed()) out.push(c); }
  var acc = carpeta.getFilesByType(MIME_ACCESO_DIRECTO);
  while (acc.hasNext()) {
    var a = acc.next();
    try { if (!a.isTrashed() && a.getTargetMimeType() === MIME_CARPETA) out.push(DriveApp.getFolderById(a.getTargetId())); } catch (_) {}
  }
  return out.sort(function (x, y) { return x.getName().localeCompare(y.getName(), 'es'); });
}

function recorrer_(carpeta, ruta, nivel, salida, soloArchivos) {
  var it = carpeta.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed()) continue;
    if (f.getMimeType() === MIME_ACCESO_DIRECTO) {
      try {
        if (f.getTargetMimeType() === MIME_CARPETA) continue;
        f = DriveApp.getFileById(f.getTargetId());
      } catch (_) { continue; }
    }
    salida.push({
      id: f.getId(), nombre: f.getName(), ruta: ruta, mime: f.getMimeType(), tamano: f.getSize(),
      actualizado: Utilities.formatDate(f.getLastUpdated(), ZONA, 'dd/MM/yyyy')
    });
  }
  if (soloArchivos || nivel >= CONFIG.profundidadMaxima) return;
  subcarpetasDe_(carpeta).forEach(function (sub) {
    recorrer_(sub, ruta ? ruta + ' / ' + sub.getName() : sub.getName(), nivel + 1, salida, false);
  });
}

// -----------------------------------------------------------------------------
// SEGURIDAD: solo se entregan archivos que figuran en la sección
// -----------------------------------------------------------------------------
function guardarPermitidos_(seccionId, mapa) {
  var t = JSON.stringify(mapa);
  if (t.length < 95000) CacheService.getScriptCache().put('perm_' + seccionId, t, 21600);
}

function permitidos_(seccion) {
  var c = CacheService.getScriptCache().get('perm_' + seccion.id);
  if (c) { try { return JSON.parse(c); } catch (_) {} }
  if (seccion.tipo === 'automotriz') getDatosAutomotriz(); else listarCarpeta(seccion.id);
  c = CacheService.getScriptCache().get('perm_' + seccion.id);
  return c ? JSON.parse(c) : {};
}

function blobDe_(seccion, fileId) {
  var mapa = permitidos_(seccion);
  if (!Object.prototype.hasOwnProperty.call(mapa, fileId)) {
    throw new Error('El documento no pertenece a esta sección. Volvé a abrir la pestaña e intentá de nuevo.');
  }
  var archivo;
  try { archivo = DriveApp.getFileById(fileId); }
  catch (e) { throw new Error('No se puede abrir el documento "' + mapa[fileId] + '". Verificá que esté compartido con la cuenta que publicó la app.'); }

  var mime = archivo.getMimeType();
  var blob = (mime === MimeType.GOOGLE_DOCS || mime === MimeType.GOOGLE_SHEETS || mime === MimeType.GOOGLE_SLIDES)
    ? archivo.getAs(MimeType.PDF)
    : archivo.getBlob();

  // En Automotriz el archivo se nombra "DOMINIO - Documento.ext"
  var original = archivo.getName();
  var ext = (blob.getContentType() === 'application/pdf') ? '.pdf' : (original.match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0];
  var nombre = seccion.tipo === 'automotriz' && mapa[fileId] ? mapa[fileId] + ext : original + (/\.[A-Za-z0-9]{2,5}$/.test(original) ? '' : ext);
  return blob.setName(nombre);
}

// -----------------------------------------------------------------------------
// DESCARGAR
// -----------------------------------------------------------------------------
function descargarDocumento(seccionId, fileId) {
  var blob = blobDe_(buscarSeccion_(seccionId), fileId);
  return { nombre: blob.getName(), mime: blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) };
}

// -----------------------------------------------------------------------------
// ENVIAR POR MAIL
// -----------------------------------------------------------------------------
function enviarDocumentos(seccionId, fileIds, destinatarios, mensaje, remitente) {
  var seccion = buscarSeccion_(seccionId);
  if (!fileIds || !fileIds.length) throw new Error('Seleccioná al menos un documento.');

  var correos = String(destinatarios || '').split(/[;,\s]+/).map(function (c) { return c.trim(); }).filter(String);
  if (!correos.length) throw new Error('Escribí al menos un correo de destino.');
  var invalidos = correos.filter(function (c) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c); });
  if (invalidos.length) throw new Error('Correo no válido: ' + invalidos.join(', '));

  remitente = txt_(remitente);
  if (!remitente) throw new Error('Escribí tu nombre para que el destinatario sepa quién le envía la documentación.');
  if (MailApp.getRemainingDailyQuota() < correos.length) {
    throw new Error('Se alcanzó el límite diario de correos de la cuenta. Probá mañana o descargá los documentos.');
  }

  var adjuntos = [], total = 0;
  fileIds.forEach(function (id) {
    var b = blobDe_(seccion, id);
    total += b.getBytes().length;
    adjuntos.push(b);
  });
  if (total > CONFIG.maxAdjuntosMB * 1048576) {
    throw new Error('Los documentos seleccionados pesan ' + (total / 1048576).toFixed(1) + ' MB y el máximo por correo es ' +
      CONFIG.maxAdjuntosMB + ' MB. Enviálos en dos o más correos.');
  }

  var lista = adjuntos.map(function (b) { return '<li>' + esc_(b.getName()) + '</li>'; }).join('');
  var msg = txt_(mensaje) ? '<p style="white-space:pre-line">' + esc_(mensaje) + '</p>' : '';
  MailApp.sendEmail({
    to: correos.join(','),
    subject: 'DELBEN · ' + seccion.titulo + ' · Documentación enviada por ' + remitente,
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#24415A;font-size:14px"><p>Hola,</p>' +
      '<p><b>' + esc_(remitente) + '</b> te envía documentación de <b>' + esc_(seccion.titulo) + '</b>.</p>' + msg +
      '<p>Archivos adjuntos:</p><ul>' + lista + '</ul><p style="color:#7A8FA3;font-size:12px">Enviado desde DELBEN SGI.</p></div>',
    body: remitente + ' te envía documentación de ' + seccion.titulo + '. Adjuntos: ' + adjuntos.map(function (b) { return b.getName(); }).join(', '),
    attachments: adjuntos,
    name: 'DELBEN SGI'
  });

  registrarEnvio_(seccion.titulo, remitente, correos.join(', '), adjuntos);
  return { ok: true, enviados: adjuntos.length, destinatarios: correos };
}

function registrarEnvio_(seccion, remitente, destinatarios, adjuntos) {
  var id = txt_(CONFIG.registroSheetId);
  if (!id) return;
  try {
    var ss = SpreadsheetApp.openById(id);
    var sh = ss.getSheetByName('envios') || ss.insertSheet('envios');
    if (sh.getLastRow() === 0) sh.appendRow(['fecha', 'seccion', 'enviadoPor', 'destinatarios', 'documentos']);
    sh.appendRow([Utilities.formatDate(new Date(), ZONA, 'dd/MM/yyyy HH:mm'), seccion, remitente, destinatarios,
      adjuntos.map(function (b) { return b.getName(); }).join(' | ')]);
  } catch (e) { console.error('No se pudo registrar el envío: ' + e); }
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
