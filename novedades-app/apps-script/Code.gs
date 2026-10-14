/**
 * ============================================================
 * NOVEDADES DEL PERSONAL  -  v0.1 (prototipo)
 * ============================================================
 * Proyecto de Apps Script vinculado a una planilla de Google
 * que funciona como base de datos.
 *
 * Primera vez:
 *   1. Crear una planilla nueva en Drive.
 *   2. Extensiones > Apps Script, pegar estos archivos.
 *   3. Ejecutar instalarSistema() una vez (pide permisos).
 *   4. Implementar > Nueva implementación > Aplicación web
 *      (Ejecutar como: yo / Acceso: cualquier usuario).
 *   5. Entrar con el mismo usuario y clave de SGI.
 *
 * Usuarios: se leen (solo lectura) de la planilla "Stock Manager",
 * pestaña "Usuarios y contraseñas". Rol Administrador entra como
 * administración y rol Supervisor como supervisor. Los demás roles
 * no tienen acceso (se cambia en Usuarios y perfiles).
 *
 * Todo el cálculo (totales, noches, conformación) se hace en
 * el navegador. El servidor solo guarda, valida permisos y
 * manda los avisos por mail.
 * ============================================================
 */

var APP = {
  TITULO: 'Novedades del Personal',
  VERSION: '0.1.0',
  TZ: 'America/Argentina/Buenos_Aires',
  PROP_SS: 'NOV_SS_ID',
  SESION_SEG: 21600
};

// Usuarios compartidos con SGI (solo lectura).
var USUARIOS_SGI = {
  SS_ID: '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY',
  HOJA: 'Usuarios y contraseñas'
};

// El personal se lee directo de Stock Manager (SGI), pestaña "personal". La app no guarda copia.
var PERSONAL_SGI = {
  SS_ID: USUARIOS_SGI.SS_ID,
  HOJA: 'personal'
};
// Nombres de empresa de SGI a la sigla que usa la app.
var EMPRESAS_SGI = {
  'P.P.Q. SA': 'PPQ',
  'KONTROL DEFENSA ELECTRONICA S.A.': 'KDE',
  'L E GUYET SERVICIOS DE SEGURIDAD S.R.L.': 'LE GUYET',
  'LEG': 'LEG'
};

// Rol de SGI -> rol en Novedades. Un rol que no esté acá no entra.
var ROLES_NOVEDADES = {
  'ADMINISTRADOR': 'ADMIN',
  'SUPERVISOR': 'SUPERVISOR'
};

var DIAS_COL = (function () {
  var a = [];
  for (var i = 1; i <= 31; i++) a.push('D' + (i < 10 ? '0' + i : i));
  return a;
})();

var HOJAS = {
  Config: ['Clave', 'Valor'],
  // v1.22.9: lo que administración modifica a mano en los informes (STD, Consolidado, 30/31, Facturación...)
  AjustesInforme: ['Tipo', 'Periodo', 'Fila', 'Col', 'Valor', 'Usuario', 'Fecha'],
  // v1.23.0: proyecciones de servicios nuevos (solo administración)
  Simulaciones: ['Id', 'Nombre', 'Datos', 'Usuario', 'Fecha'],
  // v1.22.9: horas contratadas de un día puntual cargadas a mano en la Planificación de servicios (mandan sobre las del servicio)
  ContratadoDia: ['ServicioId', 'Fecha', 'D', 'N', 'Usuario', 'Actualizado'],
  Codigos: ['Codigo', 'Descripcion', 'Tipo', 'Activo'],
  Servicios: ['Id', 'Cliente', 'Servicio', 'Municipio', 'Empresa', 'Supervisor',
    'JefeOperaciones', 'Ciclo',
    'D_LUN', 'D_MAR', 'D_MIE', 'D_JUE', 'D_VIE', 'D_SAB', 'D_DOM',
    'N_LUN', 'N_MAR', 'N_MIE', 'N_JUE', 'N_VIE', 'N_SAB', 'N_DOM',
    'Activo', 'FechaBaja', 'CorreoServicio', 'D_FER', 'N_FER', 'Direccion', 'Jurisdiccion', 'Pestana', 'ObjetivoId', 'Localidad', 'SinDiferencia', 'Lineas'],
  Planilla: ['Periodo', 'ServicioId', 'Seccion', 'Orden', 'Legajo', 'Nombre',
    'Empresa', 'Puesto', 'Turno'].concat(DIAS_COL).concat(['ActualizadoPor', 'Actualizado']),
  Semanas: ['Periodo', 'ServicioId', 'Semana', 'Desde', 'Hasta', 'EnviadoPor',
    'FechaEnvio', 'Revisada', 'RevisadaPor'],
  Plus: ['Periodo', 'ServicioId', 'Legajo', 'Nombre', 'Funcion', 'Dias',
    'Observaciones', 'CargadoPor', 'Fecha', 'Dia'],
  Programaciones: ['Periodo', 'Supervisor', 'EnviadoPor', 'FechaEnvio', 'Servicios'],
  Feriados: ['Fecha', 'Descripcion'],
  // Lo proyectado de cada planilla (para marcar los días que se modificaron después).
  Proyectado: null,
  // Histórico desde 2023, aparte para que la planilla del día a día cargue rápido.
  PlanillaHist: null,
  // Semanas de cada período definidas a mano (si no hay, van de lunes a domingo).
  SemanasDef: ['Periodo', 'Semana', 'Desde', 'Hasta'],
  // Correos usados por cada usuario (para no tener que escribirlos de nuevo).
  Contactos: ['Usuario', 'Correo', 'Usos', 'Ultimo'],
  // Horas a facturar de cada conformación (se cargan en la ventana de la conformación).
  Facturar: ['Mes', 'ServicioId', 'HorasD', 'HorasN', 'Usuario', 'Fecha'],
  // Cambios hechos a mano en la conformación (horas de cada día, custodia y bunker).
  ConfAjustes: ['Mes', 'ServicioId', 'Datos', 'Usuario', 'Fecha']
};
HOJAS.Proyectado = HOJAS.Planilla.concat(['Proyectado']);
HOJAS.PlanillaHist = HOJAS.Planilla;

// Filas de un período: de la planilla del día a día o, si no hay, del archivo histórico (planilla aparte).
function planillaPeriodo_(periodo) {
  var f = leer_('Planilla').filter(function (x) { return x.Periodo === periodo; });
  // v1.21.2: servicio por servicio. Lo cargado en la app manda; los servicios que todavía no se cargaron en la app
  // salen del archivo de la empresa (histórico / Planificación del período traída de Drive).
  if (typeof histLeerPeriodo_ === 'function') {
    try {
      var h = histLeerPeriodo_(periodo);
      if (h.length) {
        if (!f.length) return h;
        var enApp = {}; f.forEach(function (x) { enApp[x.ServicioId] = 1; });
        return f.concat(h.filter(function (x) { return !enApp[x.ServicioId]; }));
      }
    } catch (e) { Logger.log('Archivo histórico: ' + e.message); }
  }
  if (f.length) return f;
  // Lo que todavía esté en la hoja PlanillaHist de la base (versión 1.15).
  try {
    var hh = ss_().getSheetByName('PlanillaHist');
    if (!hh || hh.getLastRow() < 2) return [];
    return leer_('PlanillaHist').filter(function (x) { return x.Periodo === periodo; });
  } catch (e2) { return []; }
}
// v1.22.9: objetivo nuevo (planilla con nombre libre) -> pestaña objetivos de Stock Manager. Devuelve su id.
function agregarObjetivoSGI_(s) {
  var sh = SpreadsheetApp.openById(USUARIOS_SGI.SS_ID).getSheetByName('objetivos');
  if (!sh) return '';
  var v = sh.getDataRange().getDisplayValues(), enc = v[0].map(function (t) { return String(t).trim().toLowerCase(); });
  var col = function (pref) { for (var i = 0; i < enc.length; i++) if (enc[i].indexOf(pref) === 0) return i; return -1; };
  var cN = col('nombre'), cI = col('id');
  var ya = v.slice(1).filter(function (f) { return normT_(f[cN]) === normT_(s.Cliente); })[0];
  if (ya) return cI >= 0 ? String(ya[cI]) : '';
  var maxId = 0; v.slice(1).forEach(function (f) { var n = Number(f[cI]); if (n > maxId) maxId = n; });
  var empSGI = s.Empresa; Object.keys(EMPRESAS_SGI).forEach(function (k) { if (normT_(EMPRESAS_SGI[k]) === normT_(s.Empresa)) empSGI = k; });
  var fila = enc.map(function () { return ''; });
  var pon = function (pref, x) { var c = col(pref); if (c >= 0) fila[c] = x; };
  pon('id', maxId + 1); pon('nombre', String(s.Cliente).toUpperCase()); pon('dir', s.Direccion || ''); pon('loca', s.Localidad || '');
  pon('juri', s.Jurisdiccion || ''); pon('empresa', empSGI || ''); pon('anot', 'Agregado desde Novedades del Personal');
  sh.appendRow(fila);
  try { CacheService.getScriptCache().remove('objetivosSGI'); } catch (e) { }
  return String(maxId + 1);
}
// v1.22.9: ajustes a mano de un informe: { "fila#col": valor }
function ajustesInforme_(tipo, periodo) {
  var out = {};
  try { leer_('AjustesInforme').forEach(function (a) { if (a.Tipo === tipo && a.Periodo === periodo) out[a.Fila + '#' + a.Col] = a.Valor; }); } catch (e) { }
  return out;
}
// Misma clave de fila que usa la app (servicio | legajo | nombre | retén)
function claveFilaInf_(f) {
  var nom = String(f.Nombre || f.nom || f.cliente || f.Cliente || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  return [f.ServicioId || f.sid || '', f.Legajo || f.leg || '', nom, (f.Seccion === 'RETEN' || f.reten) ? 'R' : 'C'].join('|');
}
// v1.22.6: el período que se abre en la planilla se actualiza desde la Planificación de Drive (con sus comentarios) si cambió
function traerPeriodoDrive_(periodo) {
  if (typeof asegurarPeriodoDrive_ !== 'function') return;
  try { if (asegurarPeriodoDrive_(periodo)) MEMO_HOJAS_ = {}; } catch (e) { Logger.log('Período desde Drive (' + periodo + '): ' + e.message); }
}
// Filas de los dos períodos que tocan un mes (para conformaciones por ciclo).
function planillaMes_(mes) {
  // v1.21.2: si un período todavía no está cargado en la app, se trae de la Planificación de la empresa en Drive
  [periodoAnterior_(mes), mes].forEach(function (p) { try { asegurarPeriodoDrive_(p); } catch (e) { Logger.log('Período desde Drive (' + p + '): ' + e.message); } });
  return planillaPeriodo_(periodoAnterior_(mes)).concat(planillaPeriodo_(mes));
}

var CODIGOS_INICIALES = [
  ['F', 'Franco', 'FRANCO'],
  ['INJ', 'Injustificado', 'AUSENCIA'],
  ['LSG', 'Licencia Sin Goce de Sueldo', 'LICENCIA'],
  ['ENF', 'Enfermedad', 'LICENCIA'],
  ['ART', 'ART', 'LICENCIA'],
  ['VAC', 'Vacaciones', 'LICENCIA'],
  ['SUS', 'Suspendido', 'AUSENCIA'],
  ['NAC', 'Nacimiento', 'LICENCIA'],
  ['MAT', 'Maternidad', 'LICENCIA'],
  ['FALL', 'Licencia por Fallecimiento', 'LICENCIA'],
  ['RES', 'Reserva de Puesto', 'LICENCIA'],
  ['BAJA', 'Baja', 'BAJA'],
  ['DV', 'Día del Vigilador', 'LICENCIA'],
  ['CAS', 'Licencia por Matrimonio', 'LICENCIA']
];

// Puestos de la sección de abajo de la planilla. No suman horas al servicio.
var PUESTOS_RETEN = ['Retén', 'Instrucción'];

/**
 * Reemplaza la pestaña Codigos de la base por la lista de CODIGOS_INICIALES.
 * Ejecutar una vez desde el editor (la base ya tenía la lista anterior).
 */
function actualizarCodigos() {
  reescribir_('Codigos', CODIGOS_INICIALES.map(function (c) {
    return { Codigo: c[0], Descripcion: c[1], Tipo: c[2], Activo: 'SI' };
  }));
  Logger.log('Códigos actualizados: ' + CODIGOS_INICIALES.length + '.');
}


/* ============================================================
   ENTRADA WEB
   ============================================================ */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP.TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * v1.24.0: puente para la página publicada en GitHub Pages (https://ferchu17.github.io/Delben/novedades/).
 * La página manda { fn, args } y acá se llama a la misma función que usa la app desde Apps Script (login o api).
 * Así la app se abre desde GitHub, sin el cartel de Google, y el link no cambia aunque se publiquen versiones nuevas.
 * Para que funcione, la implementación tiene que estar con "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier persona".
 */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = String(req.fn || ''), args = Array.isArray(req.args) ? req.args : [];
    var permitidas = { api: api, login: login };
    if (!permitidas[fn]) throw new Error('Función no permitida: ' + fn);
    out = { ok: true, result: permitidas[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}


/* ============================================================
   INSTALACIÓN (ejecutar una vez desde el editor)
   ============================================================ */

function instalarSistema() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('Novedades del Personal - Base');
  }
  PropertiesService.getScriptProperties().setProperty(APP.PROP_SS, ss.getId());

  Object.keys(HOJAS).forEach(function (nombre) {
    var h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    var enc = HOJAS[nombre];
    if (h.getMaxColumns() < enc.length) {
      h.insertColumnsAfter(h.getMaxColumns(), enc.length - h.getMaxColumns());
    }
    h.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold')
      .setBackground('#1d3557').setFontColor('#ffffff');
    h.setFrozenRows(1);
    // Todo como texto: evita que Sheets convierta legajos o fechas.
    h.getRange(2, 1, h.getMaxRows() - 1, enc.length).setNumberFormat('@');
  });

  var sobrante = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (sobrante && ss.getSheets().length > 1) ss.deleteSheet(sobrante);

  if (leer_('Codigos').length === 0) {
    agregar_('Codigos', CODIGOS_INICIALES.map(function (c) {
      return { Codigo: c[0], Descripcion: c[1], Tipo: c[2], Activo: 'SI' };
    }));
  }

  if (leer_('Config').length === 0) {
    agregar_('Config', [
      { Clave: 'MAIL_AVISOS', Valor: Session.getEffectiveUser().getEmail() },
      { Clave: 'EMPRESA', Valor: 'DELBEN' }
    ]);
  }

  Logger.log('Instalado en: ' + ss.getUrl());
  Logger.log('Usuarios con acceso: ' + usuariosSGI_().filter(function (u) { return u.Rol; })
    .map(function (u) { return u.Usuario + ' (' + u.RolSGI + ')'; }).join(', '));
}


/* ============================================================
   ACCESO A HOJAS
   ============================================================ */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty(APP.PROP_SS);
  if (id) return SpreadsheetApp.openById(id);
  var a = SpreadsheetApp.getActiveSpreadsheet();
  if (!a) throw new Error('Falta ejecutar instalarSistema().');
  return a;
}

function hoja_(nombre) {
  var h = ss_().getSheetByName(nombre);
  if (!h && HOJAS[nombre]) {
    // Hojas nuevas que se agregaron en versiones posteriores se crean solas.
    h = ss_().insertSheet(nombre);
    if (h.getMaxColumns() < HOJAS[nombre].length) h.insertColumnsAfter(h.getMaxColumns(), HOJAS[nombre].length - h.getMaxColumns());
    h.getRange(1, 1, 1, HOJAS[nombre].length).setValues([HOJAS[nombre]]).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  if (!h) throw new Error('No existe la hoja "' + nombre + '". Ejecutá instalarSistema().');
  // Si a la hoja le faltan columnas nuevas, se agregan los títulos.
  var enc = HOJAS[nombre];
  if (enc && h.getMaxColumns() < enc.length) h.insertColumnsAfter(h.getMaxColumns(), enc.length - h.getMaxColumns());
  if (enc && h.getLastColumn() < enc.length) {
    h.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold');
  }
  return h;
}

// Lo leído de cada hoja se guarda en memoria mientras dura la ejecución (se borra al escribir)
// y, además, en la caché de Apps Script por unos minutos: así abrir una planilla o cambiar de pestaña
// no vuelve a leer toda la hoja cada vez. Cada vez que la app escribe una hoja, su caché se invalida.
var MEMO_HOJAS_ = {};
var HOJAS_EN_CACHE_ = { ContratadoDia: 1, AjustesInforme: 1, Planilla: 1, Proyectado: 1, Plus: 1, Semanas: 1, SemanasDef: 1, Programaciones: 1, Servicios: 1, Codigos: 1, Feriados: 1, Config: 1, Contactos: 1, Facturar: 1, ConfAjustes: 1 };
var CACHE_HOJA_SEG_ = 600;
function versionHoja_(nombre, nueva) {
  var c = CacheService.getScriptCache(), k = 'ver_' + nombre;
  if (nueva) { var v = String(Date.now()) + Math.floor(Math.random() * 1000); try { c.put(k, v, 21600); } catch (e) { } return v; }
  try { return c.get(k); } catch (e) { return null; }
}
function leerCacheHoja_(nombre, ver) {
  try {
    var c = CacheService.getScriptCache(), n = c.get('h_' + nombre + '_' + ver + '_n');
    if (n === null) return null;
    n = Number(n);
    if (!n) return [];
    var claves = []; for (var i = 0; i < n; i++) claves.push('h_' + nombre + '_' + ver + '_' + i);
    var t = c.getAll(claves), txt = '';
    for (var j = 0; j < n; j++) { if (t[claves[j]] === undefined || t[claves[j]] === null) return null; txt += t[claves[j]]; }
    return JSON.parse(txt);
  } catch (e) { return null; }
}
function guardarCacheHoja_(nombre, ver, vals) {
  try {
    var txt = JSON.stringify(vals), tam = 90000, trozos = {}, n = 0;
    if (txt.length > 4000000) return;   // muy grande: no vale la pena
    for (var i = 0; i < txt.length; i += tam) trozos['h_' + nombre + '_' + ver + '_' + (n++)] = txt.slice(i, i + tam);
    var c = CacheService.getScriptCache();
    if (n) c.putAll(trozos, CACHE_HOJA_SEG_);
    c.put('h_' + nombre + '_' + ver + '_n', String(n), CACHE_HOJA_SEG_);
  } catch (e) { /* sin caché: se lee de la hoja */ }
}
// Guardar / leer cualquier dato grande en la caché (en partes de 90 KB).
function cacheJSONGet_(clave) { return leerCacheHoja_(clave, 'x'); }
function cacheJSONPut_(clave, obj, seg) {
  var antes = CACHE_HOJA_SEG_; CACHE_HOJA_SEG_ = seg || 600;
  try { guardarCacheHoja_(clave, 'x', obj); } finally { CACHE_HOJA_SEG_ = antes; }
}
function leer_(nombre) {
  var enc = HOJAS[nombre], vals = MEMO_HOJAS_[nombre];
  if (!vals && HOJAS_EN_CACHE_[nombre]) {
    var ver = versionHoja_(nombre);
    if (ver) vals = leerCacheHoja_(nombre, ver);
    if (!vals) {
      if (!ver) ver = versionHoja_(nombre, true);   // la versión se fija ANTES de leer (si alguien escribe en el medio, la cambia)
      var h0 = hoja_(nombre), n0 = h0.getLastRow() - 1;
      vals = n0 < 1 ? [] : h0.getRange(2, 1, n0, enc.length).getDisplayValues();
      guardarCacheHoja_(nombre, ver, vals);
    }
    MEMO_HOJAS_[nombre] = vals;
  }
  if (!vals) {
    var h = hoja_(nombre);
    var n = h.getLastRow() - 1;
    vals = n < 1 ? [] : h.getRange(2, 1, n, enc.length).getDisplayValues();
    MEMO_HOJAS_[nombre] = vals;
  }
  if (!vals.length) return [];
  var out = [];
  vals.forEach(function (fila) {
    if (fila.join('') === '') return;
    var o = {};
    enc.forEach(function (k, i) { o[k] = fila[i]; });
    out.push(o);
  });
  return out;
}

function aFilas_(nombre, objs) {
  var enc = HOJAS[nombre];
  return objs.map(function (o) {
    return enc.map(function (k) {
      var v = o[k];
      return (v === null || v === undefined) ? '' : String(v);
    });
  });
}

function agregar_(nombre, objs) {
  delete MEMO_HOJAS_[nombre];
  if (HOJAS_EN_CACHE_[nombre]) versionHoja_(nombre, true);
  if (!objs.length) return;
  var h = hoja_(nombre);
  var filas = aFilas_(nombre, objs);
  var falta = h.getLastRow() + filas.length - h.getMaxRows();
  if (falta > 0) h.insertRowsAfter(h.getMaxRows(), falta);
  var r = h.getRange(h.getLastRow() + 1, 1, filas.length, filas[0].length);
  r.setNumberFormat('@');
  r.setValues(filas);
  if (HOJAS_EN_CACHE_[nombre]) { SpreadsheetApp.flush(); versionHoja_(nombre, true); }
}

function reescribir_(nombre, objs) {
  delete MEMO_HOJAS_[nombre];
  if (HOJAS_EN_CACHE_[nombre]) versionHoja_(nombre, true);
  var h = hoja_(nombre);
  var enc = HOJAS[nombre];
  var ult = h.getLastRow();
  if (ult > 1) h.getRange(2, 1, ult - 1, enc.length).clearContent();
  if (!objs.length) { if (HOJAS_EN_CACHE_[nombre]) { SpreadsheetApp.flush(); versionHoja_(nombre, true); } return; }
  var filas = aFilas_(nombre, objs);
  if (h.getMaxRows() < filas.length + 1) h.insertRowsAfter(h.getMaxRows(), filas.length + 1 - h.getMaxRows());
  var r = h.getRange(2, 1, filas.length, enc.length);
  r.setNumberFormat('@');
  r.setValues(filas);
  if (HOJAS_EN_CACHE_[nombre]) { SpreadsheetApp.flush(); versionHoja_(nombre, true); }
}

function config_() {
  var c = {};
  leer_('Config').forEach(function (f) { c[f.Clave] = f.Valor; });
  return c;
}

function periodoActualServidor_() {
  var h = new Date();
  var y = Number(Utilities.formatDate(h, APP.TZ, 'yyyy')), m = Number(Utilities.formatDate(h, APP.TZ, 'M')), dd = Number(Utilities.formatDate(h, APP.TZ, 'd'));
  if (dd < 26) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + ('0' + m).slice(-2);
}

function ahora_() {
  return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm');
}


/* ============================================================
   SESIÓN
   ============================================================ */

/**
 * Lee la pestaña "Usuarios y contraseñas" de Stock Manager.
 * Busca las columnas por título: usuario, password, nombre, rol, correo.
 */
/**
 * Personal de SGI: [{Legajo, Nombre, Empresa, Categoria, Estado, Supervisor}].
 * Se guarda 10 minutos en caché para no leer Stock Manager en cada pedido.
 */
/**
 * Lee una pestaña de Stock Manager (texto, como se ve) con la API de Sheets: no abre el archivo entero
 * (Stock Manager tiene más de 40 pestañas y abrirlo con SpreadsheetApp es lo que hacía lento el ingreso).
 * Si la API no responde, se lee de la forma de siempre.
 */
function leerPestanaSM_(hoja) {
  try {
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + USUARIOS_SGI.SS_ID + '/values/' + encodeURIComponent("'" + hoja.replace(/'/g, "''") + "'") +
      '?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS';
    var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      var v = JSON.parse(r.getContentText()).values || [];
      var W = v.reduce(function (m, f) { return Math.max(m, f.length); }, 0);
      return v.map(function (f) { while (f.length < W) f.push(''); return f.map(function (x) { return x === null || x === undefined ? '' : String(x); }); });
    }
    if (r.getResponseCode() === 400) return null;   // la pestaña no existe
  } catch (e) { Logger.log('API de Sheets (' + hoja + '): ' + e.message); }
  var h = SpreadsheetApp.openById(USUARIOS_SGI.SS_ID).getSheetByName(hoja);
  return h ? h.getDataRange().getDisplayValues() : null;
}

function personalSGI_() {
  var c = cacheJSONGet_('personalSGI2');
  if (c) return c;
  var vals = leerPestanaSM_(PERSONAL_SGI.HOJA);
  if (!vals) throw new Error('No se encontró la pestaña "' + PERSONAL_SGI.HOJA + '" en Stock Manager.');
  if (vals.length < 2) return [];
  var enc = vals[0].map(function (t) { return String(t).trim().toLowerCase(); });
  var col = function (n) { return enc.indexOf(n); };
  var cL = col('legajo'), cN = col('nombre'), cE = col('empresa'), cC = col('categoria'), cS = col('estado'), cSup = col('supervisor');
  var cD = col('dni');
  // La zona está en la columna T (sin título por ahora). Si está vacía, se usa el supervisor.
  var cZ = col('zona') >= 0 ? col('zona') : 19;
  if (cL < 0 || cN < 0) throw new Error('La pestaña personal de SGI no tiene las columnas "legajo" y "nombre".');
  var out = [];
  vals.slice(1).forEach(function (f) {
    var nombre = String(f[cN] || '').replace(/\s+/g, ' ').trim().toUpperCase();
    var legajo = String(f[cL] || '').trim();
    if (!nombre || !legajo) return;
    var emp = cE >= 0 ? String(f[cE] || '').trim() : '';
    out.push({
      Legajo: legajo, Nombre: nombre,
      Empresa: EMPRESAS_SGI[emp] || emp,
      Categoria: cC >= 0 ? String(f[cC] || '').trim() : '',
      Estado: cS >= 0 && String(f[cS] || '').trim().toLowerCase() === 'baja' ? 'Baja' : 'Activo',
      Supervisor: cSup >= 0 ? String(f[cSup] || '').trim() : '',
      Dni: cD >= 0 ? String(f[cD] || '').trim() : '',
      Zona: (cZ < f.length ? String(f[cZ] || '').trim() : '') || (cSup >= 0 ? String(f[cSup] || '').trim() : '')
    });
  });
  cacheJSONPut_('personalSGI2', out, 600);
  return out;
}

var MEMO_USUARIOS_ = null;
function usuariosSGI_() {
  if (MEMO_USUARIOS_) return MEMO_USUARIOS_;
  MEMO_USUARIOS_ = usuariosSGILeer_();
  return MEMO_USUARIOS_;
}
function usuariosSGILeer_() {
  var vals = leerPestanaSM_(USUARIOS_SGI.HOJA);
  if (!vals) throw new Error('No se encontró la pestaña "' + USUARIOS_SGI.HOJA + '" en Stock Manager.');
  if (vals.length < 2) return [];
  var enc = vals[0].map(function (t) { return String(t).trim().toLowerCase(); });
  var col = function (nombre) { return enc.indexOf(nombre); };
  var cU = col('usuario'), cP = col('password'), cN = col('nombre'), cR = col('rol'), cC = col('correo');
  if (cU < 0 || cP < 0) throw new Error('La pestaña de usuarios no tiene las columnas "usuario" y "password".');
  var out = [];
  vals.slice(1).forEach(function (f) {
    var usuario = String(f[cU] || '').trim();
    if (!usuario) return;
    var rolSGI = cR >= 0 ? String(f[cR] || '').trim() : '';
    out.push({
      Usuario: usuario,
      Nombre: cN >= 0 ? String(f[cN] || '').trim() : usuario,
      Email: cC >= 0 ? String(f[cC] || '').trim() : '',
      RolSGI: rolSGI,
      Rol: rolNovedades_(rolSGI),
      Clave: String(f[cP] || '')
    });
  });
  return out;
}

// Lo mismo sin las contraseñas, guardado 5 minutos (para cargar la app rápido; el ingreso lee siempre la hoja).
function usuariosSinClave_() {
  var c = CacheService.getScriptCache(), x = null;
  try { x = c.get('usuariosSGI'); } catch (e) { }
  if (x) return JSON.parse(x);
  var out = usuariosSGI_().map(function (u) { return { Usuario: u.Usuario, Nombre: u.Nombre, Email: u.Email, RolSGI: u.RolSGI, Rol: u.Rol }; });
  try { c.put('usuariosSGI', JSON.stringify(out), 300); } catch (e) { }
  return out;
}

/* ============================================================
   PERFILES Y PERMISOS
   Cada rol de SGI es un perfil. Para cada ventana el perfil tiene
   "Sin acceso", "Solo ver" o "Ver y editar". Se guarda en Config (PERFILES).
   ============================================================ */
var VENTANAS = [
  { clave: 'planillas', ventana: 'Planillas', pestana: 'Planilla del servicio' },
  { clave: 'programacion', ventana: 'Planillas', pestana: 'Programación' },
  { clave: 'missemanas', ventana: 'Semanas enviadas', pestana: 'Mis semanas enviadas' },
  { clave: 'bandeja', ventana: 'Semanas enviadas', pestana: 'Revisión de lo enviado' },
  { clave: 'informes', ventana: 'Informes', pestana: 'STD, Consolidado, Facturación, Contratadas vs. Realizadas y RRHH' },
  { clave: 'conformacion', ventana: 'Informes', pestana: 'Conformación horaria' },
  { clave: 'plus', ventana: 'Informes', pestana: 'Plus por función' },
  { clave: 'diagrama', ventana: 'Planificación de servicios', pestana: 'Planificación de servicios (antes Diagrama)' },
  { clave: 'presentismo', ventana: 'Informes', pestana: 'Presentismo General' },
  { clave: 'personal', ventana: 'Personal', pestana: 'Listado de personal' },
  { clave: 'servicios', ventana: 'Administración', pestana: 'Servicios' },
  { clave: 'codigos', ventana: 'Administración', pestana: 'Códigos' },
  { clave: 'datos', ventana: 'Administración', pestana: 'Datos' },
  { clave: 'cargamasiva', ventana: 'Administración', pestana: 'Carga masiva' },
  { clave: 'ficha', ventana: 'Personal', pestana: 'Ficha de la persona por período' },
  { clave: 'cierre', ventana: 'Administración', pestana: 'Control de cierre del período' },
  { clave: 'usuarios', ventana: 'Administración', pestana: 'Usuarios y perfiles' },
  { clave: 'ausencias', ventana: 'Informes', pestana: 'Ausencias (Stock Manager)' },
  { clave: 'resumen', ventana: 'Informes', pestana: 'Resumen por objetivo' },
  { clave: 'consultas', ventana: 'Consultas', pestana: 'Consultas (texto o audio)' },
  { clave: 'vacaciones', ventana: 'Planillas', pestana: 'Vacaciones por zona' },
  { clave: 'otrossup', ventana: 'Planillas', pestana: 'Otros supervisores (solo ver)' },
  { clave: 'stdsector', ventana: 'Planillas', pestana: 'STD del sector' },
  { clave: 'sgi', ventana: 'SGI', pestana: 'Botón SGI (entrar al SGI sin volver a loguearse)' }
];
var ACCESOS = { '': 'Sin acceso', V: 'Solo ver', E: 'Ver y editar' };

// Perfiles guardados, completados con las ventanas nuevas y los roles de SGI.
function perfiles_(rolesSGI) {
  var cfg = {};
  try { cfg = JSON.parse(config_().PERFILES || '{}'); } catch (e) { cfg = {}; }
  var perfiles = cfg.perfiles || ['Administrador', 'Supervisor'];
  (rolesSGI || []).forEach(function (r) { if (r && perfiles.indexOf(r) < 0) perfiles.push(r); });
  var guardadas = cfg.filas || [];
  // v1.21: cada ventana nueva aparece sola (con su acceso por defecto); los nombres se actualizan y las que ya no existen se sacan.
  var filas = VENTANAS.map(function (v) {
    var f = guardadas.filter(function (x) { return x.clave === v.clave; })[0];
    if (f) return { clave: v.clave, ventana: v.ventana, pestana: v.pestana, acc: f.acc || {} };
    var acc = { Administrador: 'E' };
    if (['planillas', 'programacion', 'missemanas'].indexOf(v.clave) >= 0) acc.Supervisor = 'E';
    if (v.clave === 'personal') acc.Supervisor = 'V';
    if (['vacaciones', 'otrossup', 'stdsector', 'consultas', 'sgi'].indexOf(v.clave) >= 0) acc.Supervisor = 'V';
    return { clave: v.clave, ventana: v.ventana, pestana: v.pestana, acc: acc, nueva: true };
  });
  return { perfiles: perfiles, filas: filas };
}
function permisosDe_(rolSGI) {
  var p = perfiles_([]), out = {};
  var r = normalizarRol_(rolSGI);
  var nombre = p.perfiles.filter(function (x) { return normalizarRol_(x) === r; })[0] || rolSGI;
  p.filas.forEach(function (f) { out[f.clave] = (f.acc || {})[nombre] || ''; });
  if (r === 'ADMINISTRADOR') p.filas.forEach(function (f) { out[f.clave] = 'E'; });
  return out;
}
// ADMIN (Administrador), SUPERVISOR (ve sus servicios) o CONSULTA (ve todos). Sin acceso: ''.
var PERFILES_CACHE_ = null;
function rolNovedades_(rolSGI) {
  var r = normalizarRol_(rolSGI);
  if (r === 'ADMINISTRADOR') return 'ADMIN';
  if (!PERFILES_CACHE_) PERFILES_CACHE_ = {};
  if (!(r in PERFILES_CACHE_)) {
    var per = permisosDe_(rolSGI);
    PERFILES_CACHE_[r] = Object.keys(per).some(function (k) { return per[k]; });
  }
  if (!PERFILES_CACHE_[r]) return '';
  return r === 'SUPERVISOR' ? 'SUPERVISOR' : 'CONSULTA';
}
function puede_(u, clave, editar) {
  if (esAdmin_(u)) return true;
  var a = (u.permisos || {})[clave] || '';
  return editar ? a === 'E' : !!a;
}
function exigir_(u, clave, editar) {
  if (!puede_(u, clave, editar)) throw new Error(editar ? 'Tu perfil no puede modificar esto.' : 'Tu perfil no tiene acceso a esta ventana.');
}

function normalizarRol_(r) {
  return String(r || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function publico_(u) {
  return { usuario: u.Usuario, nombre: u.Nombre, email: u.Email, rol: u.Rol, perfil: u.RolSGI, permisos: permisosDe_(u.RolSGI) };
}

function login(usuario, clave) {
  try {
    usuario = String(usuario || '').trim().toLowerCase();
    var u = usuariosSGI_().filter(function (x) {
      return x.Usuario.toLowerCase() === usuario;
    })[0];
    if (!u || u.Clave.trim() !== String(clave || '').trim()) {
      return { ok: false, error: 'Usuario o clave incorrectos.' };
    }
    if (!u.Rol) {
      return { ok: false, error: 'Tu usuario no tiene acceso a Novedades del Personal.' };
    }
    var token = Utilities.getUuid();
    var pub = publico_(u);
    try { CacheService.getScriptCache().put('usuariosSGI', JSON.stringify(usuariosSGI_().map(function (x) { return { Usuario: x.Usuario, Nombre: x.Nombre, Email: x.Email, RolSGI: x.RolSGI, Rol: x.Rol }; })), 300); } catch (e) { }
    CacheService.getScriptCache().put('S_' + token, JSON.stringify(pub), APP.SESION_SEG);
    // La base viaja con el ingreso (un solo viaje al servidor en lugar de dos).
    var base = null;
    try { base = ACCIONES_.base(pub, {}); } catch (e) { Logger.log('Base en el ingreso: ' + e.message); }
    return { ok: true, data: { token: token, usuario: pub, base: base } };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function sesion_(token) {
  var cache = CacheService.getScriptCache(), c = token ? cache.get('S_' + token) : null;
  if (!c) throw new Error('SESION_VENCIDA');
  // Mientras se usa la app, la sesión se renueva (no vence en medio del trabajo)
  try { cache.put('S_' + token, c, APP.SESION_SEG); } catch (e) { }
  return JSON.parse(c);
}

function esAdmin_(u) { return u.rol === 'ADMIN'; }

function exigirAdmin_(u) {
  if (!esAdmin_(u)) throw new Error('Esta acción es solo para administración.');
}


/* ============================================================
   PERÍODOS Y SEMANAS
   Período "2026-08" = 26/08/2026 al 25/09/2026.
   Las semanas van de lunes a domingo, recortadas al período.
   ============================================================ */

function periodoInfo_(periodo) {
  var p = String(periodo).split('-');
  var y = Number(p[0]), m = Number(p[1]);
  var desde = new Date(Date.UTC(y, m - 1, 26));
  var hasta = new Date(Date.UTC(y, m, 25));
  var n = Math.round((hasta - desde) / 864e5) + 1;
  return { desde: desde, hasta: hasta, n: n };
}

function fechaDia_(periodo, idx) {
  var d = periodoInfo_(periodo).desde;
  return new Date(d.getTime() + idx * 864e5);
}

function iso_(d) {
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function ddmm_(d) {
  return ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}

function semanasPeriodo_(periodo) {
  var info = periodoInfo_(periodo);
  var def = [];
  try { def = leer_('SemanasDef').filter(function (w) { return w.Periodo === periodo && w.Desde && w.Hasta; }); } catch (e) { def = []; }
  if (def.length) {
    var d0 = info.desde.getTime();
    return def.sort(function (a, b) { return Number(a.Semana) - Number(b.Semana); }).map(function (w) {
      var a = Math.round((new Date(w.Desde + 'T00:00:00Z').getTime() - d0) / 864e5), b = Math.round((new Date(w.Hasta + 'T00:00:00Z').getTime() - d0) / 864e5);
      return { numero: Number(w.Semana), desdeIdx: Math.max(0, a), hastaIdx: Math.min(info.n - 1, b) };
    }).filter(function (w) { return w.desdeIdx <= w.hastaIdx; });
  }
  var semanas = [], cur = null;
  for (var i = 0; i < info.n; i++) {
    var d = new Date(info.desde.getTime() + i * 864e5);
    var wd = (d.getUTCDay() + 6) % 7;
    if (!cur || wd === 0) {
      cur = { numero: semanas.length + 1, desdeIdx: i, hastaIdx: i };
      semanas.push(cur);
    }
    cur.hastaIdx = i;
  }
  return semanas;
}


/* ============================================================
   API: punto de entrada único
   ============================================================ */

function api(token, accion, datos) {
  try {
    var u = sesion_(token);
    var fn = ACCIONES_[accion];
    if (!fn) throw new Error('Acción desconocida: ' + accion);
    return { ok: true, data: fn(u, datos || {}) };
  } catch (e) {
    var m = String(e.message || e), authUrl = '';
    if (/permiso|permission|authorization|autoriz/i.test(m) && /DriveApp|UrlFetch|drive|Drive/.test(m)) {
      var falta = estadoAutorizacion_();
      if (falta.url) {
        authUrl = falta.url;
        m = 'La app necesita que el dueño (' + falta.dueno + ') autorice el permiso de Drive. Entrá con esa cuenta y tocá "Autorizar ahora". Después volvé a intentar.';
      } else {
        m = 'El permiso de Drive no está en la versión publicada de la app (' + falta.dueno + ' ya autorizó todo lo que la versión pide). ' +
          'Casi siempre es porque el archivo appsscript.json del editor no es el del zip: está oculto. ' +
          'En el editor: Configuración del proyecto (engranaje) > tildá "Mostrar el archivo de manifiesto appsscript.json" > pegá el del zip y guardá > ' +
          'ejecutá autorizarPermisos > Implementar > Gestionar implementaciones > lápiz > Versión: Nueva versión > Implementar. ' +
          'Error de Google: «' + m + '»';
      }
    }
    return { ok: false, error: m, authUrl: authUrl };
  }
}

var ACCIONES_ = {

  base: function (u) {
    try { quitarServiciosRepetidos_(); } catch (e) { Logger.log('Servicios repetidos: ' + e.message); }
    try { jefeOperacionesPorDefecto_(); } catch (e) { Logger.log('Jefe de operaciones: ' + e.message); }
    var servicios = leer_('Servicios').filter(function (s) {
      return esAdmin_(u) || u.rol === 'CONSULTA' || esMiZona_(u, s.Supervisor);
    });
    var usuarios = usuariosSinClave_();
    var res = {
      usuario: u,
      personal: personalSGI_(),
      codigos: leer_('Codigos'),
      feriados: (function () { try { asegurarFeriadosOficiales_(); } catch (e) { } return leer_('Feriados'); })(),
      periodosDatos: typeof periodosConDatos_ === 'function' ? periodosConDatos_() : [],
      objetivos: (function () { try { return objetivosSGI_(); } catch (e) { return []; } })(),
      firma: firmaDe_(u),
      semanasDef: leer_('SemanasDef'),
      avisos: destinoAvisos_(),
      contactos: contactosDe_(u),
      servicios: servicios,
      cubre: cubreA_(u),
      contrDia: (function () { var o = {}; try { leer_('ContratadoDia').forEach(function (x) { o[x.ServicioId + '|' + x.Fecha] = { d: Number(x.D) || 0, n: Number(x.N) || 0 }; }); } catch (e) { } return o; })(),
      supervisores: usuarios.filter(function (x) { return x.Rol; })
        .map(function (x) { return { usuario: x.Usuario, nombre: x.Nombre, rol: x.Rol }; })
    };
    if (esAdmin_(u) || puede_(u, 'usuarios')) {
      res.usuarios = usuarios.map(function (x) {
        return { Usuario: x.Usuario, Nombre: x.Nombre, Email: x.Email, RolSGI: x.RolSGI, Rol: x.Rol };
      });
    }
    if (esAdmin_(u) || puede_(u, 'datos')) res.config = config_();
    if (esAdmin_(u)) res.baseVacia = leer_('Servicios').length === 0;
    // v1.22.9: informes preparados en segundo plano (se activa solo, una vez)
    if (esAdmin_(u) && !PropertiesService.getScriptProperties().getProperty('INF_FONDO_OK')) {
      try { activarInformesFondo_(); PropertiesService.getScriptProperties().setProperty('INF_FONDO_OK', '1'); } catch (e) { Logger.log('Disparador de informes: ' + e.message); }
    }
    return res;
  },

  /**
   * Programación: el supervisor arma el período siguiente y la envía.
   * Se controla que todos los vigiladores de su zona tengan algo cargado todos los días.
   * Lo programado queda guardado en la planilla de ese período (consolidado).
   */
  enviarProgramacion: function (u, d) {
    var serv = servicioPermitido_(u, d.servicioId);
    exigir_(u, 'programacion', true);
    var info = periodoInfo_(d.periodo);
    var servs = serviciosZona_(serv.Supervisor, serv.Id);
    var todo = { numero: 0, desdeIdx: 0, hastaIdx: info.n - 1 };
    if (!(d.forzar && esAdmin_(u))) {
      var faltan = faltantesZona_(servs, d.periodo, todo, periodoAnterior_(d.periodo));
      if (faltan.length) return { faltan: faltan };
    }
    var reg = { Periodo: d.periodo, Supervisor: serv.Supervisor, EnviadoPor: u.usuario, FechaEnvio: ahora_(), Servicios: servs.map(function (s) { return s.Servicio; }).join(', ') };
    agregar_('Programaciones', [reg]);
    // Lo enviado queda como lo proyectado de cada servicio de la zona.
    var plP = planillaPeriodo_(d.periodo);
    servs.forEach(function (s) { guardarProyectado_(d.periodo, s.Id, plP.filter(function (f) { return f.ServicioId === s.Id; }), true); });
    var aviso = '';
    try {
      var dest = destinoAvisos_();
      if (d.correo && d.correo.para) {
        var plE = planillaPeriodo_(d.periodo), plusE = leer_('Plus');
        mandarCorreoArmado_(u, d.correo, servs.map(function (s) { return seccionSemana_(s, d.periodo, todo, plE, plusE); }).join(''));
      } else if (dest) {
        var planilla = planillaPeriodo_(d.periodo), plus = leer_('Plus');
        var html = cuerpoMail_('Programación ' + nombrePeriodo_(d.periodo) + ' de ' + u.nombre,
          servs.map(function (s) { return seccionSemana_(s, d.periodo, todo, planilla, plus); }).join(''));
        enviarMail_(dest, u, 'Programación ' + nombrePeriodo_(d.periodo), html);
      }
    } catch (e) { aviso = 'La programación quedó enviada, pero el mail no salió: ' + e.message; }
    return { programacion: reg, aviso: aviso };
  },

  // Semanas enviadas por el supervisor (o todas, para administración), agrupadas por período y semana.
  guardarContratadoDia: function (u, d) {
    exigirAdmin_(u);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      MEMO_HOJAS_ = {}; CONTR_DIA_ = null;
      var nuevos = {}; (d.dias || []).forEach(function (x) { nuevos[x.Fecha] = x; });
      var lista = leer_('ContratadoDia').filter(function (x) { return !(x.ServicioId === d.servicioId && nuevos[x.Fecha]); });
      Object.keys(nuevos).forEach(function (f) {
        var x = nuevos[f];
        if (x.quitar) return;
        lista.push({ ServicioId: d.servicioId, Fecha: f, D: String(Number(x.D) || 0), N: String(Number(x.N) || 0), Usuario: u.usuario, Actualizado: ahora_() });
      });
      reescribir_('ContratadoDia', lista);
      var o = {}; lista.forEach(function (x) { o[x.ServicioId + '|' + x.Fecha] = { d: Number(x.D) || 0, n: Number(x.N) || 0 }; });
      return o;
    } finally { lock.releaseLock(); }
  },

  // v1.22.9: administración modifica a mano una celda de un informe (valor vacío = vuelve a lo calculado)
  ajustarInforme: function (u, d) {
    exigirAdmin_(u);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      MEMO_HOJAS_ = {};
      var lista = leer_('AjustesInforme').filter(function (a) { return !(a.Tipo === d.tipo && a.Periodo === d.periodo && a.Fila === d.fila && String(a.Col) === String(d.col)); });
      if (String(d.valor == null ? '' : d.valor).trim() !== '') lista.push({ Tipo: d.tipo, Periodo: d.periodo, Fila: d.fila, Col: String(d.col), Valor: String(d.valor).trim(), Usuario: u.usuario, Fecha: ahora_() });
      reescribir_('AjustesInforme', lista);
      return ajustesInforme_(d.tipo, d.periodo);
    } finally { lock.releaseLock(); }
  },

  // v1.22.9: líneas de teléfono de los servicios (Facturación y Planificación de servicios usan las mismas)
  lineas: function (u) {
    var cli = {}; try { cli = datosClientesModelo_(); } catch (e) { }
    var out = {};
    leer_('Servicios').forEach(function (s) { out[s.Id] = lineasServicio_(s, clienteModelo_(s, cli)); });
    return out;
  },
  guardarLineas: function (u, d) {
    exigirAdmin_(u);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      MEMO_HOJAS_ = {};
      var lista = leer_('Servicios'), s = lista.filter(function (x) { return x.Id === d.servicioId; })[0];
      if (!s) throw new Error('No se encontró el servicio.');
      s.Lineas = (d.lineas || []).filter(function (x) { return x && String(x.t || '').trim(); }).slice(0, N_LINEAS_)
        .map(function (x) { return String(x.t).replace(/[;*]/g, ' ').trim() + (x.vc ? '*' : ''); }).join(';') || ' ';
      reescribir_('Servicios', lista);
      try { CacheService.getScriptCache().removeAll(['INF6|facturacionNov|']); } catch (e) { }
      return lineasServicio_(s, null);
    } finally { lock.releaseLock(); }
  },

  // v1.22.7: administración quita un servicio de las pestañas. Si no tiene nada cargado se borra;
  // si tiene datos (planillas, proyección, plus o semanas) queda de baja con fecha de hoy y los datos no se pierden.
  quitarServicio: function (u, d) {
    exigirAdmin_(u);
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      MEMO_HOJAS_ = {};
      var lista = leer_('Servicios'), s = lista.filter(function (x) { return x.Id === d.id; })[0];
      if (!s) throw new Error('Ese servicio ya no está.');
      var tiene = ['Planilla', 'Proyectado', 'Plus', 'Semanas', 'ConfAjustes', 'Facturar'].some(function (h) {
        try { return leer_(h).some(function (f) { return f.ServicioId === s.Id; }); } catch (e) { return false; }
      });
      if (!tiene) {
        reescribir_('Servicios', lista.filter(function (x) { return x.Id !== s.Id; }));
        return { borrado: true };
      }
      s.Activo = 'NO'; s.FechaBaja = Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd');
      reescribir_('Servicios', lista);
      return { baja: true, FechaBaja: s.FechaBaja };
    } finally { lock.releaseLock(); }
  },

  // v1.22.6: Status personal: quién no tiene servicio en el período o tiene días sin cubrir (vacíos en todas sus planillas)
  statusPersonal: function (u, d) {
    exigir_(u, 'personal', false);
    var periodo = d.periodo, n = periodoInfo_(periodo).n;
    var servs = {}; leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
    var porClave = {}, porNombre = {};
    planillaPeriodo_(periodo).forEach(function (f) {
      if (!(f.Nombre || f.Legajo)) return;
      var k = clavePersona_(f), nk = String(f.Nombre || '').toUpperCase().replace(/\s+/g, ' ').trim();
      var x = porClave[k] || porNombre[nk];
      if (!x) { x = { dias: new Array(n).fill(false), servicios: {}, sups: {} }; }
      porClave[k] = x; if (nk) porNombre[nk] = porNombre[nk] || x;
      var sv = servs[f.ServicioId] || {};
      x.servicios[f.ServicioId] = sv.Cliente || sv.Servicio || f.ServicioId;
      if (sv.Supervisor) x.sups[String(sv.Supervisor).toLowerCase()] = 1;
      for (var j = 0; j < n; j++) if (valorBase_(f[DIAS_COL[j]])) x.dias[j] = true;
    });
    // v1.22.8: no van los supervisores (categoría SP o usuarios supervisores / administración de la app) ni Fernando Jacyno
    var toks = function (t) { return normT_(t).replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(function (x) { return x.length > 1; }); };
    var excluir = [['FERNANDO', 'JACYNO']];
    try { usuariosSinClave_().forEach(function (x) { if (/SUPERVISOR|ADMIN/i.test(String(x.Rol || '')) && x.Nombre) { var t = toks(x.Nombre); if (t.length >= 2) excluir.push(t); } }); } catch (e) { }
    var esExcluido = function (p) {
      if (normT_(p.Categoria) === 'SP') return true;
      var t = toks(p.Nombre);
      return excluir.some(function (e) { return e.every(function (k) { return t.indexOf(k) >= 0; }); });
    };
    var out = [];
    personalSGI_().forEach(function (p) {
      if (p.Estado === 'Baja' || esExcluido(p)) return;
      var x = porClave[clavePersona_(p)] || porNombre[p.Nombre];
      var faltan = [];
      if (x) for (var j = 0; j < n; j++) if (!x.dias[j]) faltan.push(j);
      if (x && !faltan.length) return;
      out.push({ Legajo: p.Legajo, Nombre: p.Nombre, Empresa: p.Empresa, Categoria: p.Categoria, ZonaSGI: p.Zona,
        sups: x ? Object.keys(x.sups) : [], servicios: x ? Object.keys(x.servicios).map(function (k) { return x.servicios[k]; }) : [],
        sinServicio: !x, faltan: faltan });
    });
    return { periodo: periodo, n: n, lista: out };
  },

  misSemanas: function (u) {
    var servs = leer_('Servicios');
    var mios = {};
    var objs = {};
    try { objetivosSGI_().forEach(function (o) { objs[o.Id] = o.Nombre; }); } catch (e) { }
    servs.forEach(function (s) { if (esAdmin_(u) || esMiZona_(u, s.Supervisor)) mios[s.Id] = objs[s.ObjetivoId] || s.Cliente || s.Servicio; });
    var grupos = {};
    leer_('Semanas').forEach(function (w) {
      if (!mios[w.ServicioId]) return;
      var k = w.Periodo + '|' + w.Semana;
      if (!grupos[k]) grupos[k] = { periodo: w.Periodo, semana: Number(w.Semana), desde: w.Desde, hasta: w.Hasta, enviado: w.FechaEnvio, por: w.EnviadoPor, servicios: [], ids: [] };
      grupos[k].servicios.push(mios[w.ServicioId]); grupos[k].ids.push(w.ServicioId);
    });
    var lista = Object.keys(grupos).map(function (k) { return grupos[k]; });
    lista.sort(function (a, b) { return a.periodo === b.periodo ? b.semana - a.semana : (a.periodo < b.periodo ? 1 : -1); });
    return { semanas: lista, programaciones: leer_('Programaciones').filter(function (p) { return esAdmin_(u) || esMiZona_(u, p.Supervisor); }) };
  },

  // HTML de una o varias semanas enviadas (para verlas o mandarlas por correo).
  htmlSemanas: function (u, d) {
    return { html: htmlSemanas_(u, d.items || []) };
  },

  mandarSemanas: function (u, d) {
    var para = String(d.para || '').split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
    if (!para.length) throw new Error('Escribí al menos un correo válido.');
    if (!(d.items || []).length) throw new Error('Elegí al menos una semana.');
    var html = cuerpoMail_('Semanas enviadas por ' + u.nombre, htmlSemanas_(u, d.items));
    var que = d.items.length === 1 ? 'Novedades semana ' + d.items[0].semana + ' ' + nombrePeriodo_(d.items[0].periodo) : 'Novedades de ' + d.items.length + ' semanas';
    enviarMail_(para.join(','), u, que, html);
    return { ok: true, para: para };
  },

  // Perfiles: matriz de ventanas por rol.
  perfiles: function (u) {
    exigir_(u, 'usuarios', false);
    var roles = usuariosSinClave_().map(function (x) { return x.RolSGI; });
    var p = perfiles_(roles);
    p.ventanas = VENTANAS;
    return p;
  },
  guardarPerfiles: function (u, d) {
    exigir_(u, 'usuarios', true);
    var perfiles = (d.perfiles || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    if (perfiles.map(normalizarRol_).indexOf('ADMINISTRADOR') < 0) perfiles.unshift('Administrador');
    var filas = (d.filas || []).filter(function (f) { return f.ventana || f.pestana; }).map(function (f, k) {
      var acc = {};
      perfiles.forEach(function (p) { var v = (f.acc || {})[p] || ''; if (v === 'V' || v === 'E') acc[p] = v; });
      return { clave: f.clave || ('extra' + k), ventana: String(f.ventana || '').trim(), pestana: String(f.pestana || '').trim(), acc: acc };
    });
    var lista = leer_('Config');
    var i = indice_(lista, 'Clave', 'PERFILES');
    var v = JSON.stringify({ perfiles: perfiles, filas: filas });
    if (i < 0) lista.push({ Clave: 'PERFILES', Valor: v }); else lista[i].Valor = v;
    reescribir_('Config', lista);
    return perfiles_([]);
  },

  // Datos: feriados, iguales para todos los servicios.
  guardarFeriados: function (u, d) {
    exigir_(u, 'datos', true);
    var lista = (d.feriados || []).filter(function (f) { return /^\d{4}-\d{2}-\d{2}$/.test(f.Fecha); })
      .map(function (f) { return { Fecha: f.Fecha, Descripcion: String(f.Descripcion || '').trim() }; });
    lista.sort(function (a, b) { return a.Fecha < b.Fecha ? -1 : 1; });
    reescribir_('Feriados', lista);
    return lista;
  },

  // Presentismo General: buscar, descargar y actualizar períodos (ver Presentismo.gs).
  enviarCorreo: function (u, d) {
    requiere_('libroServicio_', 'Excel.gs');
    return enviarCorreo_(u, d);
  },

  diagnostico: function (u) {
    return diagnostico_();
  },

  // Nueva planilla: el supervisor da de alta un servicio de su zona (eligiendo el objetivo de Stock Manager).
  nuevaPlanilla: function (u, d) {
    if (!(puede_(u, 'planillas', true) || puede_(u, 'programacion', true))) throw new Error('Tu perfil no puede crear planillas.');
    var s = d.servicio || {};
    if (!s.Cliente || !s.Servicio) throw new Error('Elegí el objetivo y poné el nombre de la planilla.');
    // v1.22.4: con candado (dos clics seguidos creaban la misma planilla dos veces) y sin repetir el servicio en la zona
    var lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      MEMO_HOJAS_['Servicios'] = null;
      var lista = leer_('Servicios');
      var sup = String(esAdmin_(u) && s.Supervisor ? s.Supervisor : u.usuario).toLowerCase();
      var igual = lista.filter(function (x) {
        return x.Activo !== 'NO' && (String(x.Servicio).toLowerCase() === String(s.Servicio).toLowerCase() ||
          (String(x.Supervisor || '').toLowerCase() === sup && nombreServicioParecido_(x.Servicio, s.Servicio)));
      })[0];
      if (igual) throw new Error('Ya existe la planilla "' + igual.Servicio + '" en esa zona: abrila desde su pestaña.');
      s.Id = 'S' + Utilities.formatDate(new Date(), APP.TZ, 'yyMMddHHmmss');
      s.Activo = 'SI'; s.FechaBaja = '';
      s.Supervisor = esAdmin_(u) && s.Supervisor ? s.Supervisor : u.usuario;
      s.Ciclo = s.Ciclo || '26-25';
      s.JefeOperaciones = s.JefeOperaciones || String(config_().JO_DEFECTO || JO_DEFECTO_);
      // v1.22.9: si el objetivo no está en el listado de clientes de Stock Manager, se agrega ahí (así aparece en todo)
      if (!s.ObjetivoId) { try { s.ObjetivoId = agregarObjetivoSGI_(s); } catch (e) { Logger.log('Objetivo nuevo en Stock Manager: ' + e.message); } }
      lista.push(s);
      reescribir_('Servicios', lista);
      return s;
    } finally { lock.releaseLock(); }
  },

  presentismo: function (u, d) {
    requiere_('accionPresentismo_', 'Presentismo.gs');
    return accionPresentismo_(u, d);
  },

  // Histórico desde 2023 (ver Historico.gs).
  historico: function (u, d) {
    requiere_('accionHistorico_', 'Historico.gs');
    return accionHistorico_(u, d);
  },

  // Carga masiva: subir un archivo por vez (ver Historico.gs).
  subirHistorico: function (u, d) {
    requiere_('accionSubirHistorico_', 'Historico.gs');
    return accionSubirHistorico_(u, d);
  },

  // Carga masiva: lo que ya está cargado (catálogo) y cambiar el período o el tipo de un archivo.
  catalogo: function (u, d) {
    requiere_('accionCatalogo_', 'Historico.gs');
    return accionCatalogo_(u, d);
  },

  // Conformaciones horarias en Excel, con el formato de Delben (ver Excel.gs).
  conformacionExcel: function (u, d) {
    requiere_('accionConformacion_', 'Excel.gs');
    requiere_('libroConformacionModelo_', 'Plantilla.gs');
    return accionConformacion_(u, d);
  },

  // Informes: STD, Consolidado, Plus, Contratadas vs. Realizadas y RRHH (ver Excel.gs).
  informe: function (u, d) {
    requiere_('accionInforme_', 'Excel.gs');
    requiere_('libroInformePlantilla_', 'Plantilla.gs');
    return accionInforme_(u, d);
  },

  // Excel con el formato de las planillas: de un servicio o de toda la zona (ver Excel.gs).
  excel: function (u, d) {
    requiere_('accionExcel_', 'Excel.gs');
    return accionExcel_(u, d);
  },

  // Ficha completa de una persona, leída de la pestaña personal de SGI.
  fichaPersona: function (u, d) {
    var leg = String(d.legajo || '').trim();
    if (!leg) throw new Error('Falta el legajo.');
    var vals = leerPestanaSM_(PERSONAL_SGI.HOJA);
    var enc = vals[0].map(function (t) { return String(t).trim().toLowerCase(); });
    var c = function (n) { return enc.indexOf(n); };
    var fila = null, cands = [];
    for (var i = 1; i < vals.length; i++) if (String(vals[i][c('legajo')]).trim() === leg) cands.push(vals[i]);
    // v1.22.10: el legajo se repite entre empresas: se elige por empresa o por nombre si vienen
    if (cands.length > 1 && (d.empresa || d.nombre)) {
      var x = cands.filter(function (f) { var e = String(f[c('empresa')] || '').trim(); return d.empresa && empClave_(EMPRESAS_SGI[e] || e) === empClave_(d.empresa); });
      if (!x.length && d.nombre) x = cands.filter(function (f) { return normT_(f[c('nombre')]).split(' ')[0] === normT_(d.nombre).split(' ')[0]; });
      if (x.length) cands = x;
    }
    fila = cands[0] || null;
    if (!fila) throw new Error('No se encontró el legajo ' + leg + ' en SGI.');
    var v = function (n) { var k = c(n); return k >= 0 ? String(fila[k] || '').trim() : ''; };
    var emp = v('empresa');
    var zona = (fila.length > 19 ? String(fila[c('zona') >= 0 ? c('zona') : 19] || '').trim() : '') || v('supervisor');
    return {
      Nombre: v('nombre').toUpperCase(), Legajo: leg, Empresa: EMPRESAS_SGI[emp] || emp, Estado: v('estado'),
      Categoria: v('categoria'), Dni: v('dni'), Cuil: v('cuil'), Ingreso: v('ingreso'), Nacimiento: v('nacimiento'),
      Edad: v('edad'), Antiguedad: v('antiguedad'), Domicilio: v('domicilio'), Telefono: v('telefono'), Correo: v('correo'),
      Supervisor: v('supervisor'), Zona: zona, Anotaciones: v('anotaciones'), DiasVacaciones: v('diasvacaciones')
    };
  },

  // Carga en la base los servicios y la planilla de Agosto-Septiembre 2026 (ver Carga.gs).
  cargarInicial: function (u) {
    exigirAdmin_(u);
    return cargarDatosIniciales();
  },

  planilla: function (u, d) {
    var serv = servicioPermitido_(u, d.servicioId);
    traerPeriodoDrive_(d.periodo);
    var sup = String(serv.Supervisor || '').toLowerCase();
    return {
      programacion: leer_('Programaciones').filter(function (p) {
        return p.Periodo === d.periodo && String(p.Supervisor || '').toLowerCase() === sup;
      }).pop() || null,
      servicio: serv,
      filas: planillaPeriodo_(d.periodo).filter(function (f) {
        return f.ServicioId === d.servicioId;
      }).sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); }),
      proyectado: leer_('Proyectado').filter(function (f) { return f.Periodo === d.periodo && f.ServicioId === d.servicioId; })
        .sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); }),
      plus: leer_('Plus').filter(function (f) {
        return f.Periodo === d.periodo && f.ServicioId === d.servicioId;
      }),
      semanas: leer_('Semanas').filter(function (f) {
        return f.Periodo === d.periodo && f.ServicioId === d.servicioId;
      }),
      ocupacion: ocupacion_(d.periodo, d.servicioId)
    };
  },

  // Varias planillas de un período en una sola llamada (las pestañas del supervisor, o todas para administración).
  // La ocupación (lo cargado en los otros servicios) va una sola vez para todas.
  planillas: function (u, d) {
    var permitidos = leer_('Servicios').filter(function (s) {
      return esAdmin_(u) || u.rol === 'CONSULTA' || esMiZona_(u, s.Supervisor);
    });
    var ids = (d.ids && d.ids.length ? d.ids : permitidos.map(function (s) { return s.Id; })).filter(function (id) {
      return permitidos.some(function (s) { return s.Id === id; });
    }).slice(0, 200);
    traerPeriodoDrive_(d.periodo);
    var pl = planillaPeriodo_(d.periodo), proy = leer_('Proyectado'), plus = leer_('Plus'), sem = leer_('Semanas'), prog = leer_('Programaciones');
    var nombres = {};
    leer_('Servicios').forEach(function (s) { nombres[s.Id] = s.Servicio; });
    var out = {};
    ids.forEach(function (id) {
      var serv = permitidos.filter(function (s) { return s.Id === id; })[0];
      var sup = String(serv.Supervisor || '').toLowerCase();
      out[id] = {
        programacion: prog.filter(function (p) { return p.Periodo === d.periodo && String(p.Supervisor || '').toLowerCase() === sup; }).pop() || null,
        servicio: serv,
        filas: pl.filter(function (f) { return f.ServicioId === id; }).sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); }),
        proyectado: proy.filter(function (f) { return f.Periodo === d.periodo && f.ServicioId === id; }).sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); }),
        plus: plus.filter(function (f) { return f.Periodo === d.periodo && f.ServicioId === id; }),
        semanas: sem.filter(function (f) { return f.Periodo === d.periodo && f.ServicioId === id; })
      };
    });
    var ocup = pl.filter(function (f) { return f.Legajo || f.Nombre; }).map(function (f) {
      var o = { ServicioId: f.ServicioId, Legajo: f.Legajo, Nombre: f.Nombre, Empresa: f.Empresa, Servicio: nombres[f.ServicioId] || f.ServicioId };
      DIAS_COL.forEach(function (c) { if (f[c]) o[c] = f[c]; });
      return o;
    });
    return { periodo: d.periodo, planillas: out, ocupacion: ocup };
  },

  // Borra la caché de las hojas (por si se cambió algo a mano en la planilla base).
  limpiarCache: function (u) {
    exigir_(u, 'datos', true);
    Object.keys(HOJAS_EN_CACHE_).forEach(function (h) { versionHoja_(h, true); });
    try { CacheService.getScriptCache().removeAll(['histPeriodos', 'presIdx_n']); } catch (e) { }
    return true;
  },

  guardarPlanilla: function (u, d) {
    servicioPermitido_(u, d.servicioId);
    exigir_(u, d.periodo > periodoActualServidor_() ? 'programacion' : 'planillas', true);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var todas = leer_('Planilla');
      var viejas = [], resto = [];
      todas.forEach(function (f) {
        if (f.Periodo === d.periodo && f.ServicioId === d.servicioId) viejas.push(f);
        else resto.push(f);
      });

      var nuevas = (d.filas || []).map(function (f, i) {
        var o = {
          Periodo: d.periodo, ServicioId: d.servicioId,
          Seccion: f.Seccion || 'COBERTURA', Orden: String(i + 1),
          Legajo: f.Legajo || '', Nombre: f.Nombre || '', Empresa: f.Empresa || '',
          Puesto: f.Puesto || '', Turno: f.Turno || 'Diurno',
          ActualizadoPor: u.usuario, Actualizado: ahora_()
        };
        DIAS_COL.forEach(function (c, j) {
          // El comentario va después de "|" y conserva mayúsculas y minúsculas.
          var s = String((f.Dias && f.Dias[j]) || '').trim();
          var k = s.indexOf('|');
          o[c] = k < 0 ? s.toUpperCase() : s.slice(0, k).trim().toUpperCase() + '|' + s.slice(k + 1).replace(/[\r\n|]+/g, ' ').trim().slice(0, 200);
        });
        return o;
      });

      // Un supervisor no puede cambiar días de semanas ya enviadas.
      if (!esAdmin_(u)) protegerSemanasEnviadas_(d.periodo, d.servicioId, viejas, nuevas);

      // Nadie puede quedar en dos servicios a la misma hora. Solo se controla lo que cambió.
      // Administración puede guardar igual (forzar).
      if (!(d.forzar && esAdmin_(u))) {
        var conf = conflictosAlGuardar_(d.periodo, d.servicioId, viejas, nuevas, resto);
        if (conf.length) return { conflictos: conf };
      }

      reescribir_('Planilla', resto.concat(nuevas));
      guardarProyectado_(d.periodo, d.servicioId, nuevas, false);

      var plusResto = leer_('Plus').filter(function (f) {
        return !(f.Periodo === d.periodo && f.ServicioId === d.servicioId);
      });
      var plusNuevo = (d.plus || []).filter(function (p) { return p.Nombre; }).map(function (p) {
        return {
          Periodo: d.periodo, ServicioId: d.servicioId, Legajo: p.Legajo || '',
          Nombre: p.Nombre, Funcion: p.Funcion || 'Encargado', Dias: p.Dia ? '1' : (p.Dias || ''),
          Observaciones: p.Observaciones || '', CargadoPor: u.usuario, Fecha: ahora_(), Dia: p.Dia || ''
        };
      });
      reescribir_('Plus', plusResto.concat(plusNuevo));

      return { guardado: ahora_() };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Envía las novedades de una semana de TODA la zona del supervisor del servicio
   * (todos sus servicios activos que todavía no la enviaron), en un solo mail.
   * Antes controla que cada vigilador de la zona tenga algo cargado todos los días
   * de la semana (horas o un código). Si falta algo, no envía y devuelve la lista.
   * Administración puede enviar igual (forzar).
   */
  enviarSemana: function (u, d) {
    var serv = servicioPermitido_(u, d.servicioId);
    exigir_(u, 'planillas', true);
    var semana = semanasPeriodo_(d.periodo)[Number(d.semana) - 1];
    if (!semana) throw new Error('Semana inválida.');

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sup = String(serv.Supervisor || '').toLowerCase();
      var servs = leer_('Servicios').filter(function (s) {
        return s.Id === serv.Id || (s.Activo !== 'NO' && String(s.Supervisor || '').toLowerCase() === sup);
      });
      var existentes = leer_('Semanas');
      var pendientes = servs.filter(function (s) {
        return !existentes.some(function (x) {
          return x.Periodo === d.periodo && x.ServicioId === s.Id && Number(x.Semana) === semana.numero;
        });
      });
      if (!pendientes.length) throw new Error('Esa semana ya estaba enviada.');

      if (!(d.forzar && esAdmin_(u))) {
        var faltan = faltantesZona_(servs, d.periodo, semana);
        if (faltan.length) return { faltan: faltan };
      }

      var regs = pendientes.map(function (s) {
        return {
          Periodo: d.periodo, ServicioId: s.Id, Semana: String(semana.numero),
          Desde: iso_(fechaDia_(d.periodo, semana.desdeIdx)),
          Hasta: iso_(fechaDia_(d.periodo, semana.hastaIdx)),
          EnviadoPor: u.usuario, FechaEnvio: ahora_(), Revisada: '', RevisadaPor: ''
        };
      });
      agregar_('Semanas', regs);
    } finally {
      lock.releaseLock();
    }

    var aviso = '';
    try {
      var extra = correosCobertura_(u, serv);
      if (d.correo && d.correo.para) {
        if (extra.length) d.correo.cc = [d.correo.cc || ''].concat(extra).filter(Boolean).join(', ');
        var plS = planillaPeriodo_(d.periodo), plusS = leer_('Plus');
        mandarCorreoArmado_(u, d.correo, pendientes.map(function (s) { return seccionSemana_(s, d.periodo, semana, plS, plusS); }).join(''));
      } else avisarNovedades_(u, pendientes, d.periodo, semana, extra);
    } catch (e) {
      aviso = 'Las novedades quedaron enviadas, pero el mail no salió: ' + e.message;
    }
    return { semanas: regs, servicios: pendientes.map(function (s) { return s.Servicio; }), aviso: aviso };
  },

  reabrirSemana: function (u, d) {
    exigir_(u, 'bandeja', true);
    var lista = leer_('Semanas').filter(function (s) {
      return !(s.Periodo === d.periodo && s.ServicioId === d.servicioId && Number(s.Semana) === Number(d.semana));
    });
    reescribir_('Semanas', lista);
    return true;
  },

  marcarRevisada: function (u, d) {
    exigir_(u, 'bandeja', true);
    var mismo = function (s) { return s.Periodo === d.periodo && s.ServicioId === d.servicioId && Number(s.Semana) === Number(d.semana); };
    var lista = leer_('Semanas'), hay = false;
    lista.forEach(function (s) {
      if (mismo(s)) {
        hay = true;
        s.Revisada = d.valor ? 'SI' : '';
        s.RevisadaPor = d.valor ? u.usuario : '';
      }
    });
    // v1.22.13: semanas azules porque las novedades se cargaron (planilla guardada) pero el supervisor no tocó "Enviar semana":
    // al revisarlas se registran como revisadas; si se les saca el tilde, vuelven a "novedades cargadas".
    if (!hay && d.valor) {
      var sem = semanasPeriodo_(d.periodo)[Number(d.semana) - 1];
      if (!sem) throw new Error('Semana inválida.');
      lista.push({ Periodo: d.periodo, ServicioId: d.servicioId, Semana: String(sem.numero),
        Desde: iso_(fechaDia_(d.periodo, sem.desdeIdx)), Hasta: iso_(fechaDia_(d.periodo, sem.hastaIdx)),
        EnviadoPor: '(guardado)', FechaEnvio: String(d.guardado || ahora_()), Revisada: 'SI', RevisadaPor: u.usuario });
    }
    if (!d.valor) lista = lista.filter(function (s) { return !(mismo(s) && s.EnviadoPor === '(guardado)'); });
    reescribir_('Semanas', lista);
    return true;
  },

  bandeja: function (u, d) {
    exigir_(u, 'bandeja', false);
    // v1.22.6: además de las semanas enviadas, qué servicios tienen proyección hecha y las proyecciones enviadas (último envío)
    var conProy = {}, guardado = {};
    leer_('Planilla').forEach(function (f) {
      if (f.Periodo !== d.periodo || !f.ServicioId) return;
      if (f.Nombre || f.Legajo) conProy[f.ServicioId] = 1;
      // v1.22.7: cuándo se guardó por última vez la planilla (las novedades de una semana ya cargadas = guardada después de que terminó)
      if (f.ActualizadoPor && f.ActualizadoPor !== 'histórico' && String(f.Actualizado || '') > String(guardado[f.ServicioId] || '')) guardado[f.ServicioId] = String(f.Actualizado);
    });
    var prog = leer_('Programaciones').filter(function (p) { return p.Periodo === d.periodo; });
    return {
      semanas: leer_('Semanas').filter(function (s) { return s.Periodo === d.periodo; }),
      programaciones: prog, conProy: conProy, guardado: guardado
    };
  },

  // Filas de planilla y plus de los períodos indicados (para conformación y reportes).
  // Ficha de una persona en un período (ver Plantilla.gs).
  ficha: function (u, d) {
    exigir_(u, 'ficha', false);
    return fichaPersona_(d.periodo, d.legajo, d.nombre);
  },
  fichaPdf: function (u, d) {
    exigir_(u, 'ficha', false);
    return fichaPdf_(String(d.html || ''), d.nombre);
  },
  // v1.19 (ver Extras.gs)
  ausencias: function (u, d) { return accionAusencias_(u, d); },
  pegarDatos: function (u, d) { return accionPegarDatos_(u, d); },
  revisarArchivo: function (u, d) { return accionRevisarArchivo_(u, d); },
  pegarTabla: function (u, d) { return accionPegarTabla_(u, d); },
  verTablas: function (u, d) { return accionVerTablas_(u, d); },
  // v1.21 · SGI: enlace con acceso directo (sin volver a loguearse) y configuración (solo administración)
  sgiLink: function (u, d) { return accionSGILink_(u, d); },
  sgiConfig: function (u, d) { return accionSGIConfig_(u, d); },
  // v1.22.3 · Cubrir vacaciones: un supervisor toma la zona de otro mientras está de vacaciones
  cubrirVacaciones: function (u, d) {
    exigir_(u, 'planillas', true);
    var tit = String(d.titular || '').trim().toLowerCase();
    var pr = PropertiesService.getScriptProperties(), k = 'CUBRE|' + String(u.usuario).toLowerCase();
    if (!tit) { pr.deleteProperty(k); return { cubre: [] }; }
    if (tit === String(u.usuario).toLowerCase()) throw new Error('Elegí a otro supervisor.');
    var existe = usuariosSinClave_().some(function (x) { return String(x.Usuario).toLowerCase() === tit; });
    if (!existe) throw new Error('No se encontró ese supervisor.');
    pr.setProperty(k, JSON.stringify({ titulares: [tit], desde: ahora_() }));
    return { cubre: cubreA_(u) };
  },
  reprocesarHistorico: function (u, d) { return accionReprocesarHistorico_(u, d); },
  repararHistorico: function (u, d) { exigir_(u, 'cargamasiva', true); var l = LockService.getScriptLock(); l.waitLock(30000); try { return repararHistorico_(); } finally { l.releaseLock(); } },
  resumen: function (u, d) { return accionResumen_(u, d); },
  vacaciones: function (u, d) { return accionVacaciones_(u, d); },
  otrosServicios: function (u, d) { return accionOtrosServicios_(u, d); },
  stdSector: function (u, d) { exigir_(u, 'stdsector', false); return accionSTDSector_(u, d); },
  consulta: function (u, d) { return accionConsulta_(u, d); },
  consultaPersona: function (u, d) { return accionConsultaPersona_(u, d); },
  // v1.22.11: imágenes del Instructivo (se piden solo al abrirlo, para no hacer más lenta la entrada)
  estadisticas: function (u, d) { return accionEstadisticas_(u, d); },
  simulaciones: function (u, d) { return accionSimulaciones_(u, d); },
  simExcel: function (u, d) { DESTINO_ = 'informes'; return accionSimExcel_(u, d); },
  instructivoImg: function (u, d) { try { return JSON.parse(include('InstructivoImg')); } catch (e) { return {}; } },
  migrarPresentismo: function (u, d) { exigir_(u, 'presentismo', true); return migrarPresentismo_(); },
  // Control de cierre del período (ver Plantilla.gs).
  cierre: function (u, d) {
    exigir_(u, 'cierre', false);
    return controlCierre_(d.periodo);
  },

  datosPeriodos: function (u, d) {
    if (!(puede_(u, 'conformacion') || puede_(u, 'plus') || puede_(u, 'ficha') || puede_(u, 'cierre'))) exigir_(u, 'conformacion', false);
    var per = d.periodos || [];
    var dentro = function (f) {
      return per.indexOf(f.Periodo) >= 0 && (!d.servicioId || f.ServicioId === d.servicioId);
    };
    var filas = [];
    per.forEach(function (p) { filas = filas.concat(planillaPeriodo_(p)); });
    // Plus de un período sin nada cargado en la app: se trae de los archivos de ese período (o del modelo de muestra)
    if (d.conPlus) per.forEach(function (p) { try { asegurarPlusPeriodo_(p); } catch (e) { Logger.log('Plus ' + p + ': ' + e.message); } });
    return { filas: filas.filter(dentro), plus: leer_('Plus').filter(dentro) };
  },

  // Semanas de un período definidas por administración (1 a 5, desde / hasta).
  guardarSemanasDef: function (u, d) {
    exigir_(u, 'datos', true);
    var resto = leer_('SemanasDef').filter(function (w) { return w.Periodo !== d.periodo; });
    var nuevas = (d.semanas || []).filter(function (w) { return /^\d{4}-\d{2}-\d{2}$/.test(w.Desde) && /^\d{4}-\d{2}-\d{2}$/.test(w.Hasta); })
      .map(function (w, k) { return { Periodo: d.periodo, Semana: String(k + 1), Desde: w.Desde, Hasta: w.Hasta }; });
    reescribir_('SemanasDef', resto.concat(nuevas));
    return leer_('SemanasDef');
  },

  // Dónde se guarda cada cosa (para Datos).
  ubicaciones: function (u) {
    exigir_(u, 'datos', false);
    var cfg = config_(), out = { base: ss_().getUrl(), informes: '', modelos: [] };
    out.informes = 'https://drive.google.com/drive/folders/' + (cfg.RAIZ_CARPETA || (typeof RAIZ_POR_DEFECTO_ !== 'undefined' ? RAIZ_POR_DEFECTO_ : ''));
    if (cfg.HIST_ARCHIVO_ID) out.archivoHist = 'https://docs.google.com/spreadsheets/d/' + cfg.HIST_ARCHIVO_ID + '/edit';
    ['PLANTILLA_ID', 'PLANTILLA_RRHH_ID', 'PLANTILLA_FACT_ID', 'CONF_26_25_ID', 'CONF_01_31_ID', 'CONF_22_ID'].forEach(function (k) {
      var id = typeof plantillaId_ === 'function' ? plantillaId_(k) : '';
      if (id) out.modelos.push({ clave: k, url: 'https://drive.google.com/file/d/' + id + '/view' });
    });
    try { out.presentismo = 'https://docs.google.com/spreadsheets/d/' + (cfg.PRESENTISMO_ID || PRESENTISMO_POR_DEFECTO); } catch (e) { }
    return out;
  },

  // Prueba paso a paso de lo que necesitan los informes, con el error real de cada paso.
  probarInstalacion: function (u) {
    exigir_(u, 'datos', false);
    var pasos = [];
    var probar = function (nombre, fn) {
      try { var r = fn(); pasos.push({ paso: nombre, ok: true, detalle: r || '' }); }
      catch (e) { pasos.push({ paso: nombre, ok: false, detalle: String(e && e.message || e) }); }
    };
    probar('Archivos del proyecto', function () { var d = diagnostico_(); if (d.faltan.length) throw new Error('Faltan: ' + d.faltan.join(', ')); return 'Están todos'; });
    probar('Autorización del dueño', function () { var a = estadoAutorizacion_(); if (a.url) throw new Error('Falta autorizar con la cuenta ' + a.dueno + ': ' + a.url); return 'Autorizado (' + a.dueno + ')'; });
    probar('Permiso de Drive', function () { return 'Mi unidad: ' + DriveApp.getRootFolder().getName(); });
    probar('Crear carpetas en Drive', function () { return 'Carpeta de informes: ' + carpetaInformes_().getName(); });
    probar('Permiso de conexión externa', function () { UrlFetchApp.getRequest('https://www.google.com'); return 'OK'; });
    probar('Usuario que ejecuta la app', function () { return Session.getEffectiveUser().getEmail(); });
    ['PLANTILLA_ID', 'PLANTILLA_RRHH_ID', 'PLANTILLA_FACT_ID', 'CONF_26_25_ID', 'CONF_01_31_ID', 'CONF_22_ID'].forEach(function (k) {
      probar('Modelo ' + k, function () { var f = DriveApp.getFileById(plantillaId_(k)); return f.getName(); });
    });
    probar('Abrir modelo de Planificación como planilla', function () { return modelo_('PLANTILLA_ID').getName(); });
    probar('Carpeta de informes', function () { return carpetaInformes_().getName(); });
    return pasos;
  },

  guardarServicio: function (u, d) {
    exigir_(u, 'servicios', true);
    var s = d.servicio || {};
    if (!s.Cliente || !s.Servicio) throw new Error('Faltan cliente o nombre del servicio.');
    if (s.Activo === 'NO' && !s.FechaBaja) throw new Error('Poné la fecha de baja del servicio.');
    if (s.Activo !== 'NO') s.FechaBaja = '';
    var lista = leer_('Servicios');
    if (!s.Id) {
      s.Id = 'S' + Utilities.formatDate(new Date(), APP.TZ, 'yyMMddHHmmss');
      s.Activo = s.Activo || 'SI';
      lista.push(s);
    } else {
      var i = indice_(lista, 'Id', s.Id);
      if (i < 0) throw new Error('No se encontró el servicio.');
      lista[i] = s;
    }
    reescribir_('Servicios', lista);
    return s;
  },

  guardarCodigo: function (u, d) {
    exigir_(u, 'codigos', true);
    var c = d.codigo || {};
    c.Codigo = String(c.Codigo || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,4}$/.test(c.Codigo)) throw new Error('El código tiene que empezar con una letra y tener hasta 5 letras o números.');
    var lista = leer_('Codigos');
    var i = indice_(lista, 'Codigo', c.Codigo);
    if (i < 0) lista.push(c); else lista[i] = c;
    reescribir_('Codigos', lista);
    return c;
  },

  guardarConfig: function (u, d) {
    exigir_(u, 'datos', true);
    var lista = leer_('Config');
    Object.keys(d.config || {}).forEach(function (k) {
      var i = indice_(lista, 'Clave', k);
      if (i < 0) lista.push({ Clave: k, Valor: d.config[k] });
      else lista[i].Valor = d.config[k];
    });
    reescribir_('Config', lista);
    return config_();
  }
};


/* ============================================================
   AUXILIARES
   ============================================================ */

function indice_(lista, campo, valor) {
  for (var i = 0; i < lista.length; i++) {
    if (String(lista[i][campo]).toLowerCase() === String(valor).toLowerCase()) return i;
  }
  return -1;
}

function servicioPermitido_(u, servicioId) {
  var s = leer_('Servicios').filter(function (x) { return x.Id === servicioId; })[0];
  if (!s) throw new Error('No se encontró el servicio.');
  if (!esAdmin_(u) && u.rol !== 'CONSULTA' && !esMiZona_(u, s.Supervisor)) {
    throw new Error('Ese servicio no está asignado a tu usuario.');
  }
  return s;
}

function claveFila_(f) {
  return (f.Seccion || '') + '|' + String(f.Nombre || '').trim().toUpperCase();
}

// ---------- Persona cargada dos veces a la misma hora ----------
function valorBase_(v) { var s = String(v || ''), k = s.indexOf('|'); return (k < 0 ? s : s.slice(0, k)).trim().toUpperCase(); }
function notaDe_(v) { var s = String(v || ''), k = s.indexOf('|'); return k < 0 ? '' : s.slice(k + 1); }
function horarioDeNota_(nota) {
  var m = String(nota || '').toUpperCase().match(/(\d{1,2})(?:[:.](\d{2}))?\s*(?:HS\.?|H)?\s*(?:A|AL|-|HASTA)\s*(?:LAS\s*)?(\d{1,2})(?:[:.](\d{2}))?/);
  if (!m) return null;
  var ini = Number(m[1]) + (Number(m[2]) || 0) / 60, fin = Number(m[3]) + (Number(m[4]) || 0) / 60;
  if (ini >= 24 || fin > 24) return null;
  return { ini: ini };
}
// Horario de la celda en horas desde el primer día del período (día i a las 00 = i * 24).
function intervaloCelda_(v, i) {
  var m = valorBase_(v).replace(',', '.').match(/^(\d{1,2}(?:\.5)?)([NDT])?$/);
  if (!m) return null;
  var h = Number(m[1]);
  if (!h || h > 24) return null;
  var hor = horarioDeNota_(notaDe_(v));
  var ini = hor ? hor.ini : m[2] === 'T' ? 14 : (m[2] === 'N' && h < 24 ? 30 - h : 6);
  return { a: i * 24 + ini, b: i * 24 + ini + h, h: h };
}
function clavePersona_(f) {
  // v1.22.4: el legajo se repite entre empresas (ej.: 70 de LE GUYET y 70 de PPQ): legajo + apellido
  if (f.Legajo) return 'L' + String(f.Legajo).trim() + '|' + (String(f.Nombre || '').toUpperCase().replace(/\s+/g, ' ').trim().split(' ')[0] || '');
  return f.Nombre ? 'N' + String(f.Nombre).toUpperCase().replace(/\s+/g, ' ').trim() : '';
}
function hhmm_(x) {
  x = ((x % 24) + 24) % 24;
  var h = Math.floor(x), m = Math.round((x - h) * 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function textoTurno_(v, iv) { return valorBase_(v).replace(/[NDT]$/, '') + ' (' + hhmm_(iv.a) + ' a ' + hhmm_(iv.b) + ')'; }

// Lo cargado en los otros servicios del mismo período (solo nombre, legajo, servicio y días).
function ocupacion_(periodo, servicioId) {
  var nombres = {};
  leer_('Servicios').forEach(function (s) { nombres[s.Id] = s.Servicio; });
  return leer_('Planilla').filter(function (f) {
    return f.Periodo === periodo && f.ServicioId !== servicioId && (f.Legajo || f.Nombre);
  }).map(function (f) {
    var o = { Legajo: f.Legajo, Nombre: f.Nombre, Servicio: nombres[f.ServicioId] || f.ServicioId };
    DIAS_COL.forEach(function (c) { if (f[c]) o[c] = f[c]; });
    return o;
  });
}

function conflictosAlGuardar_(periodo, servicioId, viejas, nuevas, resto) {
  var nombres = {};
  leer_('Servicios').forEach(function (s) { nombres[s.Id] = s.Servicio; });
  var antes = {};
  viejas.forEach(function (v) { antes[clavePersona_(v) + '|' + v.Seccion] = v; });

  var grupos = {};
  nuevas.forEach(function (f, r) {
    var k = clavePersona_(f);
    if (k) (grupos[k] = grupos[k] || []).push({ f: f, r: r, propia: true });
  });
  resto.forEach(function (f) {
    if (f.Periodo !== periodo) return;
    var k = clavePersona_(f);
    if (k && grupos[k]) grupos[k].push({ f: f, propia: false, servicio: nombres[f.ServicioId] || f.ServicioId });
  });

  var out = [], vistos = {};
  nuevas.forEach(function (f, r) {
    var k = clavePersona_(f);
    if (!k) return;
    var vieja = antes[k + '|' + f.Seccion];
    for (var i = 0; i < 31; i++) {
      var col = DIAS_COL[i];
      if (vieja && vieja[col] === f[col]) continue; // no cambió
      var iv = intervaloCelda_(f[col], i);
      if (!iv) continue;
      grupos[k].forEach(function (x) {
        if (x.propia && x.r === r) return;
        for (var j = Math.max(0, i - 1); j <= Math.min(30, i + 1); j++) {
          var iv2 = intervaloCelda_(x.f[DIAS_COL[j]], j);
          if (!iv2 || !(iv.a < iv2.b && iv2.a < iv.b)) continue;
          var id = [k, i, x.propia ? 'P' + x.r : x.servicio, j].join('|');
          var id2 = x.propia ? [k, j, 'P' + r, i].join('|') : '';
          if (vistos[id] || vistos[id2]) continue;
          vistos[id] = 1;
          out.push({
            nombre: f.Nombre, fecha: ddmm_(fechaDia_(periodo, i)), aca: textoTurno_(f[col], iv),
            servicio: x.propia ? 'Esta misma planilla (otra fila)' : x.servicio,
            alla: ddmm_(fechaDia_(periodo, j)) + ' · ' + textoTurno_(x.f[DIAS_COL[j]], iv2)
          });
        }
      });
    }
  });
  return out;
}

// Secciones de las semanas pedidas, solo de los servicios del usuario.
function htmlSemanas_(u, items) {
  var servs = leer_('Servicios').filter(function (s) { return esAdmin_(u) || esMiZona_(u, s.Supervisor); });
  var enviadas = leer_('Semanas'), plus = leer_('Plus');
  var planilla = [];
  items.forEach(function (it) { if (!planilla.some(function (f) { return f.Periodo === it.periodo; })) planilla = planilla.concat(planillaPeriodo_(it.periodo)); });
  return items.map(function (it) {
    var sem = semanasPeriodo_(it.periodo)[Number(it.semana) - 1];
    if (!sem) return '';
    var desde = fechaDia_(it.periodo, sem.desdeIdx), hasta = fechaDia_(it.periodo, sem.hastaIdx);
    var cuales = servs.filter(function (s) {
      return enviadas.some(function (w) { return w.Periodo === it.periodo && w.ServicioId === s.Id && Number(w.Semana) === sem.numero; });
    });
    return '<h2 style="font-size:16px;margin:22px 0 4px;color:#0b63c9">Semana ' + sem.numero + ' · ' + ddmm_(desde) + ' al ' + ddmm_(hasta) +
      ' · ' + nombrePeriodo_(it.periodo) + '</h2>' +
      cuales.map(function (s) { return seccionSemana_(s, it.periodo, sem, planilla, plus); }).join('');
  }).join('');
}

function periodoAnterior_(p) {
  var y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)) - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + ('0' + m).slice(-2);
}

var MESES_ = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
function nombrePeriodo_(p) {
  var i = periodoInfo_(p);
  return MESES_[i.desde.getUTCMonth()] + ' - ' + MESES_[i.hasta.getUTCMonth()] + ' ' + i.hasta.getUTCFullYear();
}

// Lista de comentarios de celda de la semana, para el mail.
function notasHtml_(filas, semana, periodo) {
  var items = [];
  filas.forEach(function (f) {
    for (var i = semana.desdeIdx; i <= semana.hastaIdx; i++) {
      var v = String(f[DIAS_COL[i]] || ''), k = v.indexOf('|');
      if (k < 0) continue;
      var fecha = fechaDia_(periodo, i);
      items.push('<li>' + ddmm_(fecha) + ' · ' + f.Nombre + ' (' + v.slice(0, k).replace(/[NDT]$/, '') + '): ' +
        v.slice(k + 1).replace(/</g, '&lt;') + '</li>');
    }
  });
  return items.length ? '<p style="margin-bottom:4px"><b>Comentarios</b></p><ul style="margin-top:0">' + items.join('') + '</ul>' : '';
}

/**
 * Copia de las filas viejas los días de semanas enviadas, para que
 * un supervisor no los modifique. Si borró una fila que tenía datos
 * en una semana enviada, la fila se conserva.
 */
function protegerSemanasEnviadas_(periodo, servicioId, viejas, nuevas) {
  var enviadas = leer_('Semanas').filter(function (s) {
    return s.Periodo === periodo && s.ServicioId === servicioId;
  }).map(function (s) { return Number(s.Semana); });
  if (!enviadas.length) return;

  var idx = [];
  semanasPeriodo_(periodo).forEach(function (s) {
    if (enviadas.indexOf(s.numero) >= 0) {
      for (var i = s.desdeIdx; i <= s.hastaIdx; i++) idx.push(i);
    }
  });

  var mapaViejas = {};
  viejas.forEach(function (f) { mapaViejas[claveFila_(f)] = f; });
  var usadas = {};

  nuevas.forEach(function (f) {
    var v = mapaViejas[claveFila_(f)];
    idx.forEach(function (i) { f[DIAS_COL[i]] = v ? v[DIAS_COL[i]] : ''; });
    if (v) usadas[claveFila_(f)] = true;
  });

  viejas.forEach(function (v) {
    if (usadas[claveFila_(v)]) return;
    var tieneDatos = idx.some(function (i) { return v[DIAS_COL[i]]; });
    if (tieneDatos) {
      v.Orden = String(nuevas.length + 1);
      nuevas.push(v);
    }
  });
}

// Un solo mail con las novedades de la semana de todos los servicios enviados.
function avisarNovedades_(u, servs, periodo, semana, extra) {
  var dest = [destinoAvisos_() || ''].concat(extra || []).filter(Boolean).join(', ');
  if (!dest) return;
  var desde = fechaDia_(periodo, semana.desdeIdx);
  var hasta = fechaDia_(periodo, semana.hastaIdx);
  var planilla = planillaPeriodo_(periodo), plus = leer_('Plus');
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  var html =
    '<div style="font-family:Arial,sans-serif;color:#1d2a3a">' +
    '<p><b>' + u.nombre + '</b> envió las novedades de la semana del ' + ddmm_(desde) + ' al ' + ddmm_(hasta) +
    ' (' + servs.length + (servs.length === 1 ? ' servicio' : ' servicios') + ').</p>' +
    servs.map(function (s) { return seccionSemana_(s, periodo, semana, planilla, plus); }).join('') +
    '<p style="font-size:11px;color:#55606e">Celdas grises: turno noche. Celdas celestes: turno tarde. *: tiene comentario.</p>' +
    (url ? '<p><a href="' + url + '">Abrir Novedades del Personal</a></p>' : '') +
    '</div>';
  enviarMail_(dest, u, 'Novedades semana del ' + ddmm_(desde) + ' al ' + ddmm_(hasta), html);
}

/**
 * Todos los correos salen con el nombre "Delben" y el asunto
 * "Delben - Supervisor <nombre> - <qué se envía>".
 * Salen desde la cuenta que publica la app: para que salgan desde delbensgi@gmail.com,
 * la app se publica desde esa cuenta (o se agrega como "Enviar como" y se completa REMITENTE).
 */
var REMITENTE = ''; // ej.: 'delbensgi@gmail.com' si está configurada como alias en la cuenta que publica
// extra: { cc, bcc, asunto } (el asunto que escribe el supervisor reemplaza al armado)
function enviarMail_(para, u, que, html, adjuntos, extra) {
  extra = extra || {};
  var rol = u.rol === 'ADMIN' ? 'Administración' : 'Supervisor';
  var op = {
    to: para, name: 'Delben - ' + u.nombre,
    subject: extra.asunto || ('Delben - ' + rol + ' ' + u.nombre + ' - ' + que),
    htmlBody: html
  };
  if (extra.cc) op.cc = extra.cc;
  if (extra.bcc) op.bcc = extra.bcc;
  if (u.email) op.replyTo = u.email;
  if (adjuntos && adjuntos.length) op.attachments = adjuntos;
  if (REMITENTE) {
    GmailApp.sendEmail(op.to, op.subject, '', { htmlBody: op.htmlBody, name: op.name, from: REMITENTE, attachments: op.attachments, cc: op.cc, bcc: op.bcc, replyTo: op.replyTo });
  } else {
    MailApp.sendEmail(op);
  }
}

// "a@x.com; b@y.com" -> "a@x.com,b@y.com" (solo correos válidos)
function listaCorreos_(t) {
  return String(t || '').split(/[,; \n]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); }).join(',');
}

/**
 * Correo armado por el supervisor en la ventana de correo.
 * d: { que: 'servicio' | 'zona' | 'semanas', periodo, servicioId, items, para, cc, cco, asunto, cuerpo }
 * El Excel adjunto tiene el mismo formato y colores que la planilla de la app.
 */
function enviarCorreo_(u, d) {
  var para = listaCorreos_(d.para), cc = listaCorreos_(d.cc), cco = listaCorreos_(d.cco);
  if (!para) throw new Error('Escribí al menos un destinatario válido en "Para".');
  if (!String(d.asunto || '').trim()) throw new Error('Escribí el asunto.');
  var esc = function (t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var cuerpo = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2a3a;white-space:pre-wrap">' + esc(d.cuerpo) + '</div>';
  var adj = [], extraHtml = '', ids = [];
  if (d.que === 'servicio' || d.que === 'zona') {
    var serv = servicioPermitido_(u, d.servicioId), r;
    if (d.que === 'zona') {
      var sup = (usuariosSinClave_().filter(function (x) { return x.Usuario.toLowerCase() === String(serv.Supervisor).toLowerCase(); })[0] || {});
      r = libroZona_(serv.Supervisor, d.periodo, sup.Nombre || serv.Supervisor);
    } else r = libroServicio_(serv, d.periodo);
    adj.push(r.adjunto()); ids.push(r.id);
  } else if (d.que === 'semanas') {
    if (!(d.items || []).length) throw new Error('Elegí al menos una semana.');
    extraHtml = '<hr style="border:0;border-top:1px solid #dde3ea;margin:18px 0">' + htmlSemanas_(u, d.items);
  }
  enviarMail_(para, u, '', cuerpo + extraHtml, adj, { cc: cc, bcc: cco, asunto: String(d.asunto).trim() });
  ids.forEach(function (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { } });
  recordarContactos_(u, [para, cc, cco]);
  if (d.que === 'servicio') {
    var ls = leer_('Servicios'), k = indice_(ls, 'Id', d.servicioId);
    if (k >= 0 && !ls[k].CorreoServicio) { ls[k].CorreoServicio = para; reescribir_('Servicios', ls); }
  }
  return { enviado: true, para: para.split(',') };
}

/* ============================================================
   OBJETIVOS (servicios) de Stock Manager, pestaña "objetivos"
   id · nombre · dir · localidad · jurisdiccion · empresa · anotaciones
   ============================================================ */
function objetivosSGI_() {
  var cache = CacheService.getScriptCache(), c = cache.get('objetivosSGI');
  if (c) return JSON.parse(c);
  var v = leerPestanaSM_('objetivos');
  if (!v || !v.length) return [];
  var enc = v[0].map(function (t) { return String(t).trim().toLowerCase(); });
  var col = function (pref) { for (var i = 0; i < enc.length; i++) if (enc[i].indexOf(pref) === 0) return i; return -1; };
  var cI = col('id'), cN = col('nombre'), cD = col('dir'), cL = col('loca'), cJ = col('juri'), cE = col('empresa'), cA = col('anot');
  var g = function (f, k) { return k >= 0 ? String(f[k] || '').trim() : ''; };
  var out = v.slice(1).filter(function (f) { return g(f, cN); }).map(function (f) {
    var emp = g(f, cE);
    return { Id: g(f, cI), Nombre: g(f, cN), Direccion: g(f, cD), Localidad: g(f, cL), Jurisdiccion: g(f, cJ), Empresa: EMPRESAS_SGI[emp] || emp, Anotaciones: g(f, cA) };
  });
  cache.put('objetivosSGI', JSON.stringify(out), 600);
  return out;
}

/* ============================================================
   FIRMA DE LOS CORREOS: nombre y teléfono de la pestaña "quienRetira" de Stock Manager
   (id · nombre · correo · telefono). Se busca por correo y, si no, por nombre.
   ============================================================ */
var FIRMA_EMPRESA = 'KTL'; // "Supervisor KTL"
function firmaDe_(u) {
  var out = { nombre: u.nombre, cargo: (u.rol === 'ADMIN' ? 'Administración' : 'Supervisor') + ' ' + FIRMA_EMPRESA, telefono: '' };
  var cache = CacheService.getScriptCache(), ck = 'firma_' + u.usuario, c = cache.get(ck);
  if (c) return JSON.parse(c);
  try {
    var v = leerPestanaSM_('quienRetira');
    if (!v || !v.length) return out;
    var enc = v[0].map(function (t) { return String(t).trim().toLowerCase(); });
    var c = function (pref) { for (var i = 0; i < enc.length; i++) if (enc[i].indexOf(pref) === 0) return i; return -1; };
    var cN = c('nombre'), cC = c('correo'), cT = c('tele');
    var n = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); };
    var mail = String(u.email || '').toLowerCase().trim(), nom = n(u.nombre);
    var fila = v.slice(1).filter(function (f) { return mail && cC >= 0 && String(f[cC]).toLowerCase().trim() === mail; })[0] ||
      v.slice(1).filter(function (f) {
        var x = n(f[cN]); if (!x || !nom) return false;
        var pa = nom.split(' ').filter(function (p) { return p.length > 2; });
        return x === nom || (pa.length && pa.every(function (p) { return x.indexOf(p) >= 0; }));
      })[0];
    if (fila) {
      if (cN >= 0 && String(fila[cN]).trim()) out.nombre = String(fila[cN]).trim();
      if (cT >= 0) out.telefono = String(fila[cT]).trim();
    }
    cache.put(ck, JSON.stringify(out), 21600);
  } catch (e) { /* sin firma extra */ }
  return out;
}

// A quién le llegan los avisos de semanas y novedades (se puede cambiar en Datos y en cada envío).
function destinoAvisos_() {
  return String(config_().MAIL_AVISOS || '').trim() || 'fjacyno@ktl-seguridad.com';
}

// Correos que ya usó cada usuario (los más usados primero).
function contactosDe_(u) {
  try {
    return leer_('Contactos').filter(function (c) { return c.Usuario === u.usuario; })
      .sort(function (a, b) { return Number(b.Usos) - Number(a.Usos) || (a.Ultimo < b.Ultimo ? 1 : -1); })
      .slice(0, 40).map(function (c) { return c.Correo; });
  } catch (e) { return []; }
}
function recordarContactos_(u, listas) {
  var nuevos = [];
  listas.forEach(function (l) { String(l || '').split(',').forEach(function (x) { x = x.trim().toLowerCase(); if (x && nuevos.indexOf(x) < 0) nuevos.push(x); }); });
  if (!nuevos.length) return;
  var todos = leer_('Contactos');
  nuevos.forEach(function (c) {
    var k = -1;
    for (var i = 0; i < todos.length; i++) if (todos[i].Usuario === u.usuario && todos[i].Correo === c) { k = i; break; }
    if (k < 0) todos.push({ Usuario: u.usuario, Correo: c, Usos: '1', Ultimo: ahora_() });
    else { todos[k].Usos = String(Number(todos[k].Usos || 0) + 1); todos[k].Ultimo = ahora_(); }
  });
  reescribir_('Contactos', todos);
}

// Correo armado por el usuario en la ventana de correo, con un detalle opcional al final.
function mandarCorreoArmado_(u, c, detalleHtml) {
  var para = listaCorreos_(c.para), cc = listaCorreos_(c.cc), cco = listaCorreos_(c.cco);
  if (!para) throw new Error('Escribí al menos un destinatario válido en "Para".');
  var esc = function (t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2a3a;white-space:pre-wrap">' + esc(c.cuerpo) + '</div>' +
    (detalleHtml ? '<hr style="border:0;border-top:1px solid #dde3ea;margin:18px 0">' + detalleHtml : '');
  enviarMail_(para, u, '', html, [], { cc: cc, bcc: cco, asunto: String(c.asunto || '').trim() || 'Delben - Novedades' });
  recordarContactos_(u, [para, cc, cco]);
}

// Guarda lo proyectado de una planilla: siempre al enviar; al guardar, solo mientras el período no empezó o si todavía no había.
function guardarProyectado_(periodo, servicioId, filas, forzar) {
  try {
    var todas = leer_('Proyectado');
    var tiene = todas.some(function (f) { return f.Periodo === periodo && f.ServicioId === servicioId; });
    var empezo = periodoInfo_(periodo).desde.getTime() <= Date.now();
    if (!forzar && tiene && empezo) return;
    var resto = todas.filter(function (f) { return !(f.Periodo === periodo && f.ServicioId === servicioId); });
    var cuando = ahora_();
    reescribir_('Proyectado', resto.concat(filas.map(function (f) { var o = JSON.parse(JSON.stringify(f)); o.Proyectado = cuando; return o; })));
  } catch (e) { Logger.log('Proyectado: ' + e.message); }
}

/* ============================================================
   DIAGNÓSTICO: archivos del proyecto y permisos
   ============================================================ */
function diagnostico_() {
  var faltan = [];
  var mod = { 'Excel.gs': 'accionExcel_', 'Plantilla.gs': 'libroInformePlantilla_', 'Historico.gs': 'importarHistorico',
    'Presentismo.gs': 'accionPresentismo_', 'Carga.gs': 'cargarDatosIniciales' };
  Object.keys(mod).forEach(function (f) { if (typeof globalThis[mod[f]] !== 'function') faltan.push(f); });
  var permisos = [];
  try { DriveApp.getRootFolder().getId(); } catch (e) { permisos.push('Drive'); }
  try { UrlFetchApp.getRequest('https://www.google.com'); } catch (e) { permisos.push('Conexión externa'); }
  return { faltan: faltan, permisos: permisos };
}
// Si un archivo .gs no está en el proyecto, avisa cuál falta en vez de "is not defined".
function requiere_(fn, archivo) {
  if (typeof globalThis[fn] !== 'function') throw new Error('Falta el archivo ' + archivo + ' en el proyecto de Apps Script. Crealo (Secuencia de comandos) con ese nombre, pegá su contenido del zip y publicá una versión nueva.');
}

/**
 * EJECUTAR UNA VEZ DESDE EL EDITOR (después de cambiar appsscript.json):
 * pide los permisos de Drive, conexión externa y correo, que hacen falta para los Excel e informes.
 */
// ¿Le falta al dueño de la app autorizar algún permiso de la versión publicada? Si falta, devuelve el enlace para autorizar.
function estadoAutorizacion_() {
  var out = { url: '', dueno: '' };
  try { out.dueno = Session.getEffectiveUser().getEmail(); } catch (e) { }
  try {
    var ai = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (ai.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) out.url = ai.getAuthorizationUrl() || '';
  } catch (e) { }
  return out;
}

function autorizarPermisos() {
  DriveApp.createFolder('Novedades - prueba de permisos').setTrashed(true);
  DriveApp.getRootFolder();
  UrlFetchApp.getRequest('https://www.google.com');
  MailApp.getRemainingDailyQuota();
  SpreadsheetApp.getActive && SpreadsheetApp.openById(USUARIOS_SGI.SS_ID).getName();
  try { activarInformesFondo_(); PropertiesService.getScriptProperties().setProperty('INF_FONDO_OK', '1'); } catch (e) { Logger.log('Disparador de informes: ' + e.message); }   // v1.22.9
  Logger.log('Permisos autorizados. Ahora publicá una versión nueva: Implementar > Gestionar implementaciones > editar > Nueva versión.');
}

// Envuelve el cuerpo de un correo con el formato de Delben.
function cuerpoMail_(titulo, contenido) {
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  return '<div style="font-family:Arial,sans-serif;color:#1d2a3a">' +
    '<div style="height:4px;background:linear-gradient(90deg,#3aa935,#0b63c9);margin-bottom:12px"></div>' +
    '<h2 style="margin:0 0 10px;font-size:18px">' + titulo + '</h2>' + contenido +
    '<p style="font-size:11px;color:#55606e">Celdas grises: turno noche. Celdas celestes: turno tarde. *: tiene comentario.</p>' +
    (url ? '<p><a href="' + url + '">Abrir Novedades del Personal</a></p>' : '') + '</div>';
}

// Servicios activos de la zona de un supervisor (y el servicio pedido aunque esté de baja).
function serviciosZona_(supervisor, incluirId) {
  var sup = String(supervisor || '').toLowerCase();
  return leer_('Servicios').filter(function (s) {
    return s.Id === incluirId || (s.Activo !== 'NO' && String(s.Supervisor || '').toLowerCase() === sup);
  });
}

// Tabla de un servicio para el mail.
function seccionSemana_(serv, periodo, semana, planilla, plusTodos) {
  var filas = planilla.filter(function (f) {
    return f.Periodo === periodo && f.ServicioId === serv.Id;
  });
  var plus = plusTodos.filter(function (f) {
    return f.Periodo === periodo && f.ServicioId === serv.Id;
  });

  var th = 'style="background:#1d3557;color:#fff;padding:4px 6px;font-size:12px"';
  var td = 'style="border:1px solid #d5dbe3;padding:3px 6px;font-size:12px;text-align:center"';
  var tdl = 'style="border:1px solid #d5dbe3;padding:3px 6px;font-size:12px"';

  var cab = '<tr><th ' + th + '>Apellido y nombre</th><th ' + th + '>Legajo</th>';
  for (var i = semana.desdeIdx; i <= semana.hastaIdx; i++) {
    cab += '<th ' + th + '>' + ddmm_(fechaDia_(periodo, i)) + '</th>';
  }
  cab += '</tr>';

  var cuerpo = filas.filter(function (f) { return f.Seccion === 'COBERTURA'; }).map(function (f) {
    var t = '<tr><td ' + tdl + '>' + f.Nombre + '</td><td ' + td + '>' + (f.Legajo || '<b style="color:#c0392b">?</b>') + '</td>';
    for (var i = semana.desdeIdx; i <= semana.hastaIdx; i++) {
      var full = f[DIAS_COL[i]] || '', k = full.indexOf('|');
      var v = k < 0 ? full : full.slice(0, k), nota = k < 0 ? '' : full.slice(k + 1);
      var m = v.match(/^\d+(?:[.,]\d+)?([NDT])?$/);
      var tu = m ? (m[1] || (f.Turno === 'Nocturno' ? 'N' : 'D')) : '';
      var fondo = tu === 'N' ? 'background:#a6a6a6;color:#111;' : tu === 'T' ? 'background:#cfe0f5;color:#1d3f73;' : '';
      t += '<td ' + td.replace('"', '"' + fondo) + (nota ? ' title="' + nota.replace(/"/g, '&quot;') + '"' : '') + '>' +
        v.replace(/^(\d+(?:[.,]\d+)?)[NDT]$/, '$1') + (nota ? '<sup style="color:#c0392b">*</sup>' : '') + '</td>';
    }
    return t + '</tr>';
  }).join('');

  var plusHtml = plus.length
    ? '<p style="margin-top:16px"><b>Plus por función</b></p><table style="border-collapse:collapse">' +
      plus.map(function (p) {
        return '<tr><td ' + tdl + '>' + p.Nombre + '</td><td ' + tdl + '>' + p.Funcion + '</td><td ' + td + '>' + p.Dias + ' días</td></tr>';
      }).join('') + '</table>'
    : '';

  return '<h3 style="margin:20px 0 6px;font-size:15px">' + serv.Servicio + '</h3>' +
    (cuerpo ? '<table style="border-collapse:collapse">' + cab + cuerpo + '</table>' : '<p style="color:#55606e">Sin personal cargado.</p>') +
    notasHtml_(filas, semana, periodo) +
    plusHtml;
}

/**
 * Vigiladores de la zona que no tienen nada cargado algún día de la semana, en ningún servicio.
 * Zona (por ahora): las personas que figuran en cobertura en los servicios del supervisor en el período.
 * No se controla a quien está de baja en Personal ni los días desde un código BAJA en adelante.
 * También devuelve los valores no válidos de la semana en esos servicios.
 */
function faltantesZona_(servs, periodo, semana, periodoZonaExtra) {
  var ids = {};
  servs.forEach(function (s) { ids[s.Id] = s.Servicio; });
  var nombres = {};
  leer_('Servicios').forEach(function (s) { nombres[s.Id] = s.Servicio; });
  var filas = leer_('Planilla').filter(function (f) { return f.Periodo === periodo; });
  var bajas = {};
  personalSGI_().forEach(function (p) {
    if (p.Estado === 'Baja' && p.Legajo) bajas['L' + String(p.Legajo).trim()] = 1;
  });
  var codigos = {};
  leer_('Codigos').forEach(function (c) { if (c.Activo !== 'NO') codigos[String(c.Codigo).toUpperCase()] = 1; });

  var zona = {}, orden = [];
  // En la programación, la zona incluye también a quienes estaban en el período anterior.
  var base = periodoZonaExtra ? filas.concat(leer_('Planilla').filter(function (f) { return f.Periodo === periodoZonaExtra; })) : filas;
  base.forEach(function (f) {
    if (!ids[f.ServicioId] || f.Seccion !== 'COBERTURA') return;
    var k = clavePersona_(f);
    if (!k || bajas[k] || zona[k]) return;
    zona[k] = { nombre: f.Nombre, legajo: f.Legajo, servicioId: f.ServicioId, servicio: ids[f.ServicioId], filas: [] };
    orden.push(k);
  });
  filas.forEach(function (f) { var k = clavePersona_(f); if (k && zona[k]) zona[k].filas.push(f); });

  var DIAS_N = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var out = [];
  orden.forEach(function (k) {
    var z = zona[k];
    var baja = 99;
    z.filas.forEach(function (f) {
      for (var i = 0; i < 31; i++) if (valorBase_(f[DIAS_COL[i]]) === 'BAJA' && i < baja) baja = i;
    });
    for (var i = semana.desdeIdx; i <= semana.hastaIdx; i++) {
      if (i >= baja) break;
      var tiene = z.filas.some(function (f) { return valorBase_(f[DIAS_COL[i]]) !== ''; });
      if (!tiene) {
        var fe = fechaDia_(periodo, i);
        out.push({ tipo: 'vacio', nombre: z.nombre, legajo: z.legajo, idx: i, servicioId: z.servicioId, servicio: z.servicio,
          fecha: DIAS_N[fe.getUTCDay()] + ' ' + ddmm_(fe) });
      }
    }
  });

  filas.forEach(function (f) {
    if (!ids[f.ServicioId]) return;
    for (var i = semana.desdeIdx; i <= semana.hastaIdx; i++) {
      var v = valorBase_(f[DIAS_COL[i]]).replace(',', '.');
      if (!v || codigos[v]) continue;
      var m = v.match(/^(\d{1,2}(?:\.5)?)([NDT])?$/);
      if (m && Number(m[1]) <= 24) continue;
      var fe = fechaDia_(periodo, i);
      out.push({ tipo: 'error', valor: v, nombre: f.Nombre || '(fila sin nombre)', legajo: f.Legajo, idx: i,
        servicioId: f.ServicioId, servicio: ids[f.ServicioId], fecha: DIAS_N[fe.getUTCDay()] + ' ' + ddmm_(fe) });
    }
  });
  return out;
}


/* ===================== v1.22.3 · Cubrir vacaciones ===================== */
// Usuarios cuyas zonas cubre este supervisor (mientras el otro está de vacaciones).
function cubreA_(u) {
  if (!u || !u.usuario) return [];
  try { var x = JSON.parse(PropertiesService.getScriptProperties().getProperty('CUBRE|' + String(u.usuario).toLowerCase()) || 'null'); return x && x.titulares ? x.titulares : []; }
  catch (e) { return []; }
}
// ¿La zona de ese supervisor es del usuario (la suya o la que cubre)?
function esMiZona_(u, sup) {
  var s = String(sup || '').toLowerCase(), me = String(u.usuario || '').toLowerCase();
  if (s === me) return true;
  return cubreA_(u).indexOf(s) >= 0;
}
// Si el servicio es de la zona que se está cubriendo: correos del supervisor de vacaciones y del que lo cubre.
function correosCobertura_(u, serv) {
  var tit = String(serv && serv.Supervisor || '').toLowerCase(), me = String(u.usuario || '').toLowerCase();
  if (!tit || tit === me) return [];
  var out = [];
  try {
    usuariosSinClave_().forEach(function (x) {
      var k = String(x.Usuario).toLowerCase();
      if ((k === tit || k === me) && x.Email && /@/.test(x.Email)) out.push(String(x.Email).trim());
    });
  } catch (e) { }
  if (u.email && out.indexOf(u.email) < 0 && /@/.test(u.email)) out.push(u.email);
  return out;
}


/* ===================== v1.22.4 · Pestañas (servicios) repetidas =====================
 * Si en una zona hay el mismo servicio más de una vez (ej.: "Frigorifico Pacheco" y dos "FRIGORIFICO PACHECHO"),
 * se queda el que tiene datos y se borran los que están vacíos (sin planilla, proyección, semanas, plus ni ajustes).
 * Nunca se borra uno que tenga datos.
 */
function nombreServicioParecido_(a, b) {
  var x = normT_(a).replace(/[^A-Z0-9]/g, ''), y = normT_(b).replace(/[^A-Z0-9]/g, '');
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.replace(/\D/g, '') !== y.replace(/\D/g, '')) return false;      // MANZANA 1 / MANZANA 2, SUCRE 4225 / SUCRE 1949: distintos
  if (Math.min(x.length, y.length) >= 6 && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0)) return true;
  // distancia de edición (errores de tipeo: PACHECHO / PACHECO)
  var m = x.length, n = y.length, d = [];
  for (var i = 0; i <= m; i++) { d[i] = [i]; }
  for (var j = 1; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return d[m][n] <= Math.max(1, Math.floor(Math.max(m, n) * 0.12));
}
// v1.22.6: dos servicios son el mismo si apuntan al mismo objetivo del SGI o si se parecen por Servicio o por Cliente
// (ej.: "AMENABAR" / Cliente "Amenabar 1570" y "CONSORCIO AMENABAR 1570").
function serviciosIguales_(a, b) {
  if (a.ObjetivoId && b.ObjetivoId) return String(a.ObjetivoId) === String(b.ObjetivoId);
  var na = [a.Servicio, a.Cliente], nb = [b.Servicio, b.Cliente];
  return na.some(function (x) { return x && nb.some(function (y) { return y && nombreServicioParecido_(x, y); }); });
}
function quitarServiciosRepetidos_() {
  // Primero, rápido: ¿hay algún par parecido en la misma zona donde uno sea de "+ Nueva planilla"? Si no, no se hace nada.
  // v1.22.6: el resultado se recuerda mientras la hoja Servicios no cambie (así el ingreso no lo vuelve a revisar).
  var cache = CacheService.getScriptCache(), ver = versionHoja_('Servicios') || '', ck = 'repOK|' + ver;
  if (ver && cache.get(ck)) return 0;
  var act0 = leer_('Servicios').filter(function (s) { return s.Activo !== 'NO'; }), hay = false;
  var nuevo = function (s) { return /^S\d{12}$/.test(String(s.Id)); };
  for (var i0 = 0; i0 < act0.length && !hay; i0++) for (var j0 = i0 + 1; j0 < act0.length && !hay; j0++)
    if ((nuevo(act0[i0]) || nuevo(act0[j0])) && String(act0[i0].Supervisor || '').toLowerCase() === String(act0[j0].Supervisor || '').toLowerCase() && serviciosIguales_(act0[i0], act0[j0])) hay = true;
  if (!hay) { if (ver) cache.put(ck, '1', 21600); return 0; }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return 0;
  try { MEMO_HOJAS_ = {}; return quitarServiciosRepetidosLock_(); } finally { lock.releaseLock(); }
}
function quitarServiciosRepetidosLock_() {
  var lista = leer_('Servicios');
  var act = lista.filter(function (s) { return s.Activo !== 'NO'; });
  var conDatos = {};
  ['Planilla', 'Proyectado', 'Plus', 'Semanas'].forEach(function (h) { try { leer_(h).forEach(function (f) { if (f.ServicioId) conDatos[f.ServicioId] = 1; }); } catch (e) { } });
  ['ConfAjustes', 'Facturar'].forEach(function (h) { try { leer_(h).forEach(function (f) { if (f.ServicioId) conDatos[f.ServicioId] = 1; }); } catch (e) { } });
  var borrar = {};
  act.forEach(function (a, i) {
    if (borrar[a.Id]) return;
    var grupo = [a].concat(act.slice(i + 1).filter(function (b) {
      return !borrar[b.Id] && String(b.Supervisor || '').toLowerCase() === String(a.Supervisor || '').toLowerCase() && serviciosIguales_(a, b);
    }));
    if (grupo.length < 2) return;
    var llenos = grupo.filter(function (x) { return conDatos[x.Id]; });
    if (!llenos.length) llenos = [grupo.slice().sort(function (p, q) { return String(p.Id) < String(q.Id) ? -1 : 1; })[0]];   // ninguno tiene datos: queda el más viejo
    // Solo se borran planillas creadas con "+ Nueva planilla" (Id S + fecha) y vacías
    grupo.forEach(function (x) { if (llenos.indexOf(x) < 0 && !conDatos[x.Id] && /^S\d{12}$/.test(String(x.Id))) borrar[x.Id] = 1; });
  });
  // v1.22.5: repetidos que SÍ tienen datos (ej.: uno con Agosto y otro con Septiembre): los datos pasan al servicio
  // original (el que no es de "+ Nueva planilla") si ese período no tiene nada; después se borra el repetido.
  var movidos = fusionarRepetidosConDatos_(act, borrar);
  var ids = Object.keys(borrar);
  if (!ids.length) return movidos;
  // Si el que queda no tiene objetivo del SGI, toma el del repetido que se borra
  act.forEach(function (x) {
    if (!borrar[x.Id] || !x.ObjetivoId) return;
    var keep = act.filter(function (o) { return !borrar[o.Id] && !o.ObjetivoId && String(o.Supervisor || '').toLowerCase() === String(x.Supervisor || '').toLowerCase() && serviciosIguales_(o, x); })[0];
    if (keep) keep.ObjetivoId = x.ObjetivoId;
  });
  reescribir_('Servicios', lista.filter(function (s) { return !borrar[s.Id]; }));
  Logger.log('Servicios repetidos borrados: ' + ids.join(', '));
  return ids.length;
}

function fusionarRepetidosConDatos_(act, borrar) {
  var hojas = ['Planilla', 'Proyectado', 'Plus', 'Semanas'], datos = {}, cambio = {}, movidos = 0;
  hojas.forEach(function (h) { try { datos[h] = leer_(h); } catch (e) { datos[h] = []; } });
  var perDe = function (h, id) { var o = {}; datos[h].forEach(function (f) { if (f.ServicioId === id) o[f.Periodo] = 1; }); return o; };
  act.forEach(function (dup) {
    if (borrar[dup.Id] || !/^S\d{12}$/.test(String(dup.Id))) return;
    var orig = act.filter(function (o) {
      return o.Id !== dup.Id && !borrar[o.Id] && !/^S\d{12}$/.test(String(o.Id)) &&
        String(o.Supervisor || '').toLowerCase() === String(dup.Supervisor || '').toLowerCase() && serviciosIguales_(o, dup);
    })[0];
    if (!orig) return;
    // ¿Algún período tiene datos en los dos? Entonces no se toca (no se pisa nada).
    // v1.22.6: lo Proyectado no cuenta como choque (es la foto de lo enviado): en ese período manda el que tiene la planilla cargada
    var choca = hojas.some(function (h) { if (h === 'Proyectado') return false; var a = perDe(h, dup.Id), b = perDe(h, orig.Id); return Object.keys(a).some(function (p) { return b[p]; }); });
    if (choca) return;
    var plDup = perDe('Planilla', dup.Id), prA = perDe('Proyectado', dup.Id), prB = perDe('Proyectado', orig.Id);
    Object.keys(prA).forEach(function (p) {
      if (!prB[p]) return;
      var quitarDe = plDup[p] ? orig.Id : dup.Id;   // se queda la foto del que tiene la planilla de ese período
      datos.Proyectado = datos.Proyectado.filter(function (f) { return !(f.ServicioId === quitarDe && f.Periodo === p); });
      cambio.Proyectado = 1;
    });
    // El original se queda con el objetivo del SGI del repetido (así la pestaña muestra el nombre completo del objetivo)
    if (!orig.ObjetivoId && dup.ObjetivoId) orig.ObjetivoId = dup.ObjetivoId;
    hojas.forEach(function (h) { datos[h].forEach(function (f) { if (f.ServicioId === dup.Id) { f.ServicioId = orig.Id; cambio[h] = 1; movidos++; } }); });
    borrar[dup.Id] = 1;
  });
  Object.keys(cambio).forEach(function (h) { reescribir_(h, datos[h]); });
  return movidos;
}
// v1.22.5: Jefe de Operaciones por defecto (por ahora Gustavo San Martin en todos los servicios que no tienen)
var JO_DEFECTO_ = 'Gustavo San Martin';
function jefeOperacionesPorDefecto_() {
  var jo = String(config_().JO_DEFECTO || JO_DEFECTO_).trim();
  if (!jo) return 0;
  var lista = leer_('Servicios'), n = 0;
  lista.forEach(function (s) { if (!String(s.JefeOperaciones || '').trim()) { s.JefeOperaciones = jo; n++; } });
  if (n) reescribir_('Servicios', lista);
  return n;
}
