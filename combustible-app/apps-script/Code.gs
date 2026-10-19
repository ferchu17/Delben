/**
 * DELBEN - Control de Combustible
 * Proyecto de Apps Script independiente (Web App).
 * Archivos: Code.gs, Index.html, appsscript.json
 *
 * Configuración necesaria (una sola vez):
 *  - Configuración del proyecto > Propiedades del script > agregar GEMINI_API_KEY con tu clave de Gemini.
 *  - Ejecutar la función autorizar() desde el editor para aceptar los permisos.
 *  - Implementar > Nueva implementación > Aplicación web (Ejecutar como: Yo / Acceso: Cualquier persona).
 */

const CFG = {
  STOCK_ID: '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY',     // Stock Manager (usuarios y objetivos)
  REG_ID: '1LNQm3eXJ_0vRj6f8IfEzf8lqhNqVZyr6uVmbO64FqyU',       // Rendicion de Combustible (registros)
  FOLDER_ID: '1KbV6eLOB7brVS-WqmfKLphnIROqHtZYP',               // Carpeta de PDFs / Excel
  TEMPLATE_ID: '1l-f0iZQGPRKqyQVZTMHC6blMTGwhiYt9kK9hFIi-fFQ',  // PLANTILLA - Rendicion Gastos de Combustible
  LOGO_KTL_ID: '1wqKYz4bZkRAIIgvBoE_tychFVfBtneDT',             // Logo KTL Placa (6).jpg
  LOGO_DELBEN_ID: '1bjLDdND-atVR4Gtbz6AjRg6hXXSLAstC',          // Delben_Combustible_logo_160.png (logo de la app)
  FOTOS_FOLDER_NAME: 'Fotos de tickets',
  MAIL_ADMIN: 'fjacyno@ktl-seguridad.com',
  MAIL_NOMBRE: 'DELBEN - Control de Combustible',
  GEMINI_MODEL: 'gemini-2.5-flash',
  TZ: 'America/Argentina/Buenos_Aires',
  HOJA_USUARIOS: 'Usuarios y contraseñas',
  HOJA_OBJETIVOS: 'objetivos',
  ROLES_CON_FONDO: ['supervisor', 'visor'],
  FILAS_PLANILLA: 9,          // filas de tickets que trae la plantilla (19 a 27)
  FILA_INICIO: 19,
  SUPERVISOR_LABEL: 'SUPERVISOR'
};

const ESTADOS = ['Pendiente', 'Aprobado', 'Observado', 'Rechazado'];

/* ======================= WEB APP ======================= */

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.logoDelben = getLogoDelben_();
  const out = t.evaluate()
    .setTitle('DELBEN - Control de Combustible')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  try { out.setFaviconUrl('https://drive.google.com/thumbnail?id=' + CFG.LOGO_DELBEN_ID + '&sz=w128&ext=.png'); } catch (e) {}
  return out;
}

function getLogoDelben_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('logo_app_combustible');
  if (c) return c;
  try {
    const blob = DriveApp.getFileById(CFG.LOGO_DELBEN_ID).getBlob();
    const data = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    if (data.length < 95000) cache.put('logo_app_combustible', data, 21600);
    return data;
  } catch (e) {
    return '';
  }
}

/**
 * Puente para la página publicada en GitHub Pages (https://ferchu17.github.io/Delben/combustible/).
 * La página manda { fn, args } y acá se llama a la misma función que usa la app dentro de Apps Script.
 * Así la app se abre desde GitHub, sin el cartel de Google arriba, y el link no cambia con las versiones nuevas.
 * La implementación tiene que estar con "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier persona".
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(req.fn || ''), args = Array.isArray(req.args) ? req.args : [];
    const permitidas = {
      login: login, checkSession: checkSession, logout: logout,
      getSupervisorData: getSupervisorData, leerTicket: leerTicket, guardarTicket: guardarTicket,
      eliminarTicket: eliminarTicket, enviarRendicion: enviarRendicion, getFoto: getFoto,
      getRendicionPdf: getRendicionPdf, pedirFondos: pedirFondos,
      getAdminData: getAdminData, guardarAsignacion: guardarAsignacion, eliminarAsignacion: eliminarAsignacion,
      actualizarTicket: actualizarTicket, regenerarRendicion: regenerarRendicion,
      cambiarEstadoRendicion: cambiarEstadoRendicion, guardarClaveGemini: guardarClaveGemini, responderPedido: responderPedido,
      agregarCorresponde: agregarCorresponde, eliminarCorresponde: eliminarCorresponde
    };
    if (!permitidas[fn]) throw new Error('Función no permitida: ' + fn);
    out = { ok: true, result: permitidas[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Ejecutar una vez desde el editor para aceptar todos los permisos. */
function autorizar() {
  ss_(CFG.REG_ID).getName();
  ss_(CFG.STOCK_ID).getName();
  DriveApp.getFolderById(CFG.FOLDER_ID).getName();
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  MailApp.getRemainingDailyQuota();
  // El logo de la app queda visible con el enlace para que se vea como ícono en la pestaña del navegador
  DriveApp.getFileById(CFG.LOGO_DELBEN_ID).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('Permisos OK. Clave Gemini configurada: ' + !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'));
}

/* ======================= SESIÓN ======================= */

function login(usuario, password) {
  usuario = String(usuario || '').trim();
  password = String(password || '');
  if (!usuario || !password) throw new Error('Ingresá usuario y contraseña.');
  const u = getUsuarios_().find(r => norm_(r.usuario) === norm_(usuario) && String(r.password) === password);
  if (!u) throw new Error('Usuario o contraseña incorrectos.');
  const rol = rolApp_(u.rol);
  if (!rol) throw new Error('Tu usuario no tiene acceso a Control de Combustible.');
  const ses = { nombre: u.nombre, usuario: u.usuario, rol: rol, correo: primerCorreo_(u.correo) };
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('tk_' + token, JSON.stringify(ses), 21600);
  ses.token = token;
  return ses;
}

function checkSession(token) {
  const s = ses_(token);
  s.token = token;
  return s;
}

function logout(token) {
  CacheService.getScriptCache().remove('tk_' + token);
  return true;
}

function ses_(token) {
  const cache = CacheService.getScriptCache();
  const raw = token ? cache.get('tk_' + token) : null;
  if (!raw) throw new Error('SESION_VENCIDA');
  cache.put('tk_' + token, raw, 21600);
  return JSON.parse(raw);
}

function rolApp_(rol) {
  const r = norm_(rol);
  if (r === 'administrador') return 'admin';
  if (r === 'visor') return 'visor';
  if (r === 'supervisor') return 'supervisor';
  return '';
}

function exigirAdmin_(s) {
  if (s.rol !== 'admin') throw new Error('Solo el administrador puede hacer esto.');
}

function exigirRinde_(s) {
  if (CFG.ROLES_CON_FONDO.indexOf(s.rol) < 0) throw new Error('Tu usuario no rinde combustible.');
}

/**
 * Sesión para las pantallas del supervisor.
 * Si el administrador entra con "Cargar ticket" y elige un supervisor (como), trabaja en nombre de ese supervisor:
 * ve su disponible, carga sus tickets y envía su rendición (el mail le llega a ese supervisor con copia a administración).
 */
function sesRinde_(token, como) {
  const s = ses_(token);
  if (como && s.rol === 'admin') {
    const u = getSupervisores_().find(x => norm_(x.nombre) === norm_(como));
    if (!u) throw new Error('Elegí un supervisor de la lista.');
    return { nombre: u.nombre, correo: u.correo, rol: 'supervisor', admin: s.nombre };
  }
  exigirRinde_(s);
  return s;
}

/* ======================= DATOS BASE ======================= */

/** Abre cada planilla una sola vez por pedido (abrir Stock Manager es lo más lento). */
const SS_ABIERTAS_ = {};
function ss_(id) { return SS_ABIERTAS_[id] || (SS_ABIERTAS_[id] = SpreadsheetApp.openById(id)); }

/** Guarda listas que cambian poco (supervisores, a quién corresponde) 10 minutos en memoria. */
function enCache_(clave, fn) {
  const cache = CacheService.getScriptCache();
  const c = cache.get(clave);
  if (c) { try { return JSON.parse(c); } catch (e) {} }
  const v = fn();
  try { const txt = JSON.stringify(v); if (txt.length < 90000) cache.put(clave, txt, 600); } catch (e) {}
  return v;
}

function getUsuarios_() {
  const sh = ss_(CFG.STOCK_ID).getSheetByName(CFG.HOJA_USUARIOS);
  return readSheet_(sh).rows.filter(r => String(r.usuario || '').trim());
}

function getSupervisores_() {
  return enCache_('comb_supervisores', () => getUsuarios_()
    .filter(u => CFG.ROLES_CON_FONDO.indexOf(rolApp_(u.rol)) >= 0 && String(u.nombre || '').trim())
    .map(u => ({ nombre: String(u.nombre).trim(), correo: primerCorreo_(u.correo), rol: String(u.rol) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre)));
}

/** Lista de "A quién corresponde": pestaña a_quien_corresponde de la planilla de registros (columnas id, funcion_servicio). */
const HOJA_CORR = 'a_quien_corresponde';
function hojaCorresponde_() {
  const ss = ss_(CFG.REG_ID);
  let sh = ss.getSheetByName(HOJA_CORR);
  if (!sh) {
    sh = ss.insertSheet(HOJA_CORR);
    sh.getRange(1, 1, 1, 2).setValues([['id', 'funcion_servicio']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function getCorrespondeRows_() {
  return enCache_('comb_corresponde', () => readSheet_(hojaCorresponde_()).rows
    .filter(r => String(r.funcion_servicio || '').trim())
    .map(r => ({ id: r.id, nombre: String(r.funcion_servicio).trim() })));
}
function getCorresponde_() {
  const vistos = {};
  return getCorrespondeRows_().map(r => r.nombre).filter(n => { const k = norm_(n); if (vistos[k]) return false; vistos[k] = true; return true; });
}

/** El administrador agrega un servicio o puesto a la lista "A quién corresponde". */
function agregarCorresponde(token, nombre) {
  const s = ses_(token);
  exigirAdmin_(s);
  nombre = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!nombre) throw new Error('Escribí el servicio o puesto.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(hojaCorresponde_());
    if (tab.rows.some(r => norm_(r.funcion_servicio) === norm_(nombre))) throw new Error('"' + nombre + '" ya está en la lista.');
    appendObj_(tab, { id: nextId_(tab.rows, 'id'), funcion_servicio: nombre });
    CacheService.getScriptCache().remove('comb_corresponde');
    return true;
  } finally {
    lock.releaseLock();
  }
}

function eliminarCorresponde(token, id) {
  const s = ses_(token);
  exigirAdmin_(s);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(hojaCorresponde_());
    const r = tab.rows.find(x => String(x.id) === String(id));
    if (!r) throw new Error('No se encontró.');
    tab.sh.deleteRow(r._r);
    CacheService.getScriptCache().remove('comb_corresponde');
    return true;
  } finally {
    lock.releaseLock();
  }
}

function getObjetivos_() {
  const sh = ss_(CFG.STOCK_ID).getSheetByName(CFG.HOJA_OBJETIVOS);
  const lista = readSheet_(sh).rows
    .filter(r => String(r.nombre || '').trim())
    .filter(r => !/^\s*baja/i.test(String(r.anotaciones || '')))
    .map(r => String(r.nombre).trim());
  return Array.from(new Set(lista)).sort((a, b) => a.localeCompare(b));
}

function regSheet_(name) {
  const sh = ss_(CFG.REG_ID).getSheetByName(name);
  if (!sh) throw new Error('No existe la pestaña "' + name + '" en la planilla de registros.');
  return sh;
}

/** Lee una hoja y devuelve {sh, headers, rows:[{header:valor, _r:filaReal}]} */
function readSheet_(sh) {
  const values = sh.getDataRange().getValues();
  const headers = (values[0] || []).map(h => String(h).trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(v => v === '' || v === null)) continue;
    const o = { _r: i + 1 };
    headers.forEach((h, j) => { if (h) o[h] = row[j]; });
    rows.push(o);
  }
  return { sh: sh, headers: headers, rows: rows };
}

function appendObj_(t, obj, textCols) {
  const r = t.sh.getLastRow() + 1;
  const row = t.headers.map(h => (obj[h] === undefined || obj[h] === null) ? '' : obj[h]);
  const rng = t.sh.getRange(r, 1, 1, t.headers.length);
  (textCols || []).forEach(h => {
    const j = t.headers.indexOf(h);
    if (j >= 0) t.sh.getRange(r, j + 1).setNumberFormat('@');
  });
  rng.setValues([row]);
  return r;
}

function setCell_(t, rowNum, header, value) {
  const j = t.headers.indexOf(header);
  if (j < 0) throw new Error('Falta la columna "' + header + '" en ' + t.sh.getName());
  t.sh.getRange(rowNum, j + 1).setValue(value);
}

function nextId_(rows, field) {
  let max = 0;
  rows.forEach(r => { const n = parseInt(String(r[field]).replace(/\D/g, ''), 10); if (n > max) max = n; });
  return max + 1;
}

/* ======================= SALDOS ======================= */

/**
 * Saldo de cada supervisor = asignado - consumido.
 * Consumido = tickets cargados en la app (no rechazados)
 *           + rendiciones cargadas a mano en la pestaña Rendiciones que no tienen tickets en la pestaña Tickets
 *             (las anteriores a la app, con su PDF): de esas se descuenta la columna Total.
 */
function calcularSaldos_(asig, tickets, rendiciones) {
  const m = {};
  const get = n => { const k = norm_(n); if (!m[k]) m[k] = { nombre: String(n).trim(), asignado: 0, consumido: 0, sinRendir: 0, cantSinRendir: 0 }; return m[k]; };
  asig.forEach(a => { if (String(a.Supervisor || '').trim()) get(a.Supervisor).asignado += num_(a.Monto); });
  tickets.forEach(t => {
    if (!String(t.Supervisor || '').trim()) return;
    if (String(t.Estado) === 'Rechazado') return;
    const s = get(t.Supervisor);
    s.consumido += num_(t['Total con IVA']);
    if (!String(t['N° Planilla'] || '').trim()) { s.sinRendir += num_(t['Total con IVA']); s.cantSinRendir++; }
  });
  const conTickets = {};
  tickets.forEach(t => { const n = String(t['N° Planilla'] || '').trim(); if (n) conTickets[n] = true; });
  (rendiciones || []).forEach(r => {
    const n = String(r['N° Planilla'] || '').trim();
    if (!n || conTickets[n] || !String(r.Supervisor || '').trim()) return;
    get(r.Supervisor).consumido += num_(r.Total);
  });
  Object.keys(m).forEach(k => { m[k].saldo = round2_(m[k].asignado - m[k].consumido); });
  return m;
}

/* ======================= SUPERVISOR ======================= */

function getSupervisorData(token, como) {
  const s = sesRinde_(token, como);
  const asig = readSheet_(regSheet_('Asignaciones')).rows.filter(a => norm_(a.Supervisor) === norm_(s.nombre));
  const tks = readSheet_(regSheet_('Tickets')).rows.filter(t => norm_(t.Supervisor) === norm_(s.nombre));
  const rendRows = readSheet_(regSheet_('Rendiciones')).rows.filter(r => norm_(r.Supervisor) === norm_(s.nombre));
  const sal = calcularSaldos_(asig, tks, rendRows)[norm_(s.nombre)] || { asignado: 0, consumido: 0, saldo: 0, sinRendir: 0, cantSinRendir: 0 };
  const rend = rendRows.map(r => {
    const nro = String(r['N° Planilla']).trim();
    const todos = tks.filter(t => String(t['N° Planilla']).trim() === nro);
    const tk = todos.filter(t => String(t.Estado) !== 'Rechazado');
    // Rendición anterior a la app (sin tickets en la pestaña Tickets): se usan su Total y Cant. Tickets
    const historica = !todos.length;
    return {
      nro: r['N° Planilla'], fecha: fmtD_(r.Fecha), estado: String(r.Estado || ''), pdf: !!driveId_(r['Link PDF']),
      cant: historica ? num_(r['Cant. Tickets']) : tk.length,
      total: historica ? round2_(num_(r.Total)) : round2_(tk.reduce((a, t) => a + num_(t['Total con IVA']), 0))
    };
  });
  return {
    saldo: sal,
    asignaciones: asig.map(asigOut_).reverse(),
    tickets: tks.map(ticketOut_).reverse(),
    rendiciones: rend.reverse(),
    pedidos: leerPedidos_().filter(p => norm_(p.supervisor) === norm_(s.nombre)).slice(0, 10),
    objetivos: getCorresponde_()
  };
}

/**
 * Lee el ticket y devuelve los datos para confirmar.
 * - Si hay clave de Gemini (GEMINI_API_KEY) usa Gemini, que también lee lo escrito a mano.
 * - Si no hay clave o Gemini falla, usa la lectura de texto (OCR) de Google Drive, que no necesita clave.
 */
function leerTicket(token, dataUrl) {
  ses_(token);
  const opciones = getCorresponde_();
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (key) {
    try { return leerConGemini_(key, dataUrl, opciones); } catch (e) { console.error('Gemini: ' + e.message); }
  }
  return leerConOcrDrive_(dataUrl, opciones);
}

function leerConGemini_(key, dataUrl, opciones) {
  const parts = String(dataUrl).split(',');
  const mime = (parts[0].match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const prompt =
    'Sos un lector de tickets/facturas de combustible de Argentina. Leé la imagen y devolvé SOLO un JSON con estas claves:\n' +
    '{"fecha":"DD/MM/AAAA","numero":"punto de venta y número tal cual figura, ej 00014-00021464","proveedor":"razón social del EMISOR (la estación)",' +
    '"cuit":"CUIT del EMISOR con guiones, NO el del cliente","producto":"ej NAFTA SUPER, INFINIA, DIESEL","litros":numero,"precio_litro":numero,' +
    '"total":numero,"servicio":"opción de la lista o null"}\n' +
    'Reglas: "total" es el TOTAL final pagado con IVA e impuestos incluidos (el importe más grande del renglón TOTAL); ' +
    'NUNCA el subtotal, el neto gravado ni el importe sin IVA. '+ 'En los tickets argentinos la coma es decimal y el punto separa miles: ' +
    'devolvé los números con punto decimal y sin separador de miles (ej 45956.19). Si un dato no se lee, poné null. No inventes datos.\n' +
    '"servicio": el supervisor suele escribir A MANO sobre el ticket a qué servicio corresponde la carga (ej. "Fincas", "San Francisco", "Laguna"). ' +
    'Si hay una anotación así, devolvé la opción de esta lista que corresponda, copiada exactamente igual: ' + JSON.stringify(opciones) +
    '. Si no hay anotación a mano o no coincide claramente con ninguna, devolvé null.';
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: parts[1] } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CFG.GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
  const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  const j = JSON.parse(res.getContentText());
  const txt = j.candidates[0].content.parts.map(p => p.text || '').join('').replace(/```json|```/g, '').trim();
  const d = JSON.parse(txt);
  return {
    fecha: isoFromAny_(d.fecha),
    numero: d.numero ? String(d.numero).trim() : '',
    proveedor: d.proveedor ? String(d.proveedor).trim() : '',
    cuit: d.cuit ? String(d.cuit).trim() : '',
    producto: d.producto ? String(d.producto).trim() : '',
    litros: d.litros === null || d.litros === undefined ? '' : num_(d.litros),
    precio: d.precio_litro === null || d.precio_litro === undefined ? '' : num_(d.precio_litro),
    total: d.total === null || d.total === undefined ? '' : num_(d.total),
    correspondeA: d.servicio ? (opciones.find(o => norm_(o) === norm_(d.servicio)) || '') : '',
    via: 'gemini'
  };
}

/** OCR de Google Drive: sube la foto como documento de Google (Drive lee el texto), lo exporta como texto y lo borra. */
function leerConOcrDrive_(dataUrl, opciones) {
  const parts = String(dataUrl).split(',');
  const mime = (parts[0].match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const token = ScriptApp.getOAuthToken();
  const b = 'delben' + Date.now();
  const meta = JSON.stringify({ name: 'OCR ticket temporal', mimeType: 'application/vnd.google-apps.document' });
  const head = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: ' + mime + '\r\n\r\n';
  const tail = '\r\n--' + b + '--';
  const payload = Utilities.newBlob(head).getBytes().concat(Utilities.base64Decode(parts[1])).concat(Utilities.newBlob(tail).getBytes());
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=es&fields=id', {
    method: 'post', contentType: 'multipart/related; boundary=' + b, payload: payload,
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    console.error('OCR Drive ' + res.getResponseCode() + ': ' + res.getContentText());
    throw new Error('No se pudo leer el ticket automáticamente. Cargá los datos a mano.');
  }
  const id = JSON.parse(res.getContentText()).id;
  let texto = '';
  try {
    texto = UrlFetchApp.fetch('https://docs.google.com/document/d/' + id + '/export?format=txt',
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }).getContentText();
  } finally {
    UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id,
      { method: 'delete', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  }
  const r = parsearTicket_(texto, opciones);
  r.via = 'ocr';
  return r;
}

/** Saca los datos del texto de un ticket fiscal argentino (YPF, Shell, Axion, etc.). */
function parsearTicket_(texto, opciones) {
  const t = String(texto || '').replace(/\r/g, '').replace(/﻿/g, '');
  const lineas = t.split('\n').map(l => l.trim()).filter(Boolean);
  const r = { fecha: '', numero: '', proveedor: '', cuit: '', producto: '', litros: '', precio: '', total: '', correspondeA: '' };
  let m;

  m = t.match(/fecha[^\d\n]{0,15}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i) || t.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (m) r.fecha = isoFromAny_(m[1]);

  m = t.match(/N[°ºo.]{0,2}\s*:?\s*(\d{4,5})\s*-\s*(\d{6,8})/i) || t.match(/\b(\d{4,5})\s*-\s*(\d{8})\b/);
  if (m) r.numero = m[1] + '-' + m[2];

  m = t.match(/\b(2[03457]|3[034])\s?-?\s?(\d{8})\s?-?\s?(\d)\b/);
  if (m) r.cuit = m[1] + '-' + m[2] + '-' + m[3];

  const propias = /P\.?\s?P\.?\s?Q|KONTROL|GUYET|\bLEG\b|TRIMMER/i;
  const prov = lineas.find(l => /(S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?(\s?U\.?)?|S\.?\s?A\.?\s?S\.?)$/i.test(l) && !propias.test(l) && l.length < 60);
  if (prov) r.proveedor = prov.replace(/\s+/g, ' ');

  m = t.match(/\b(NAFTA[^\n]{0,20}|INFINIA[^\n]{0,15}|SUPER\s*XXI|GAS\s*-?\s*OIL[^\n]{0,12}|EURO\s*DIESEL|ULTRA\s*DIESEL|DIESEL[^\n]{0,15}|V-?\s?POWER[^\n]{0,15}|QUANTIUM[^\n]{0,15}|PREMIUM|GNC)/i);
  if (m) r.producto = m[1].replace(/\s+/g, ' ').trim().toUpperCase();

  m = t.match(/(\d{1,3}[.,]\d{1,4})\s*x\s*\$\s*(\d[\d.]*[.,]\d{2,4})/i);
  if (m) { r.litros = num_(m[1]); r.precio = num_(m[2]); }
  else {
    m = t.match(/(\d{1,3}[.,]\d{2,4})\s*(?:u|lts?|litros)\.?\s*x/i);
    if (m) r.litros = num_(m[1]);
  }

  // Total CON IVA: nunca el subtotal ni el neto gravado. El total final siempre es el mayor importe del ticket
  // (subtotal, neto, IVA e impuestos son partes de él), salvo lo que se pagó en efectivo o el vuelto.
  const RX_IMP = /\$?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?!\d)/g;
  const importes = l => { const out = []; let x; RX_IMP.lastIndex = 0; while ((x = RX_IMP.exec(l))) out.push(num_(x[1])); return out.filter(n => n >= 100 && n < 20000000); };
  const pago = /EFECTIVO|RECIB|SU PAGO|PAGO CON|PAGA CON|VUELTO|CAMBIO|ENTREG/i;
  let total = 0;
  // 1) Renglones "TOTAL ..." con importe en el mismo renglón (no subtotal / neto / gravado / IVA)
  lineas.forEach(l => {
    if (/\bTOTAL\b/i.test(l) && !/SUB|NETO|GRAVAD|IVA|OTROS|TRIBUT|PERCEP|IMPUEST|LITRO|PAGO|EFECT|VUELTO/i.test(l)) {
      importes(l).forEach(n => { if (n > total) total = n; });
    }
  });
  // 2) El mayor importe del ticket (sin pagos/vuelto). Si es mayor que el encontrado, es el total real
  //    (pasa cuando el OCR separa las etiquetas de los valores).
  let mayor = 0;
  lineas.forEach(l => { if (!pago.test(l)) importes(l).forEach(n => { if (n > mayor) mayor = n; }); });
  if (mayor > total) total = mayor;
  if (total) r.total = round2_(total);
  if (r.litros && r.total && !r.precio) r.precio = round2_(r.total / r.litros);

  const nt = ' ' + norm_(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const stop = ['barrio', 'consorcio', 'servicio', 'servicios', 'supervisores', 'centro', 'comercial', 'lopez', 'manzana'];
  const cands = opciones.filter(o => o !== CFG.SUPERVISOR_LABEL).filter(o =>
    norm_(o).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 5 && stop.indexOf(w) < 0)
      .some(w => nt.indexOf(' ' + w + ' ') >= 0));
  if (cands.length === 1) r.correspondeA = cands[0];
  return r;
}

/** PDF de una rendición (para verlo dentro de la app). */
function getRendicionPdf(token, nro) {
  const s = ses_(token);
  const r = readSheet_(regSheet_('Rendiciones')).rows.find(x => String(x['N° Planilla']) === String(nro));
  if (!r) throw new Error('No se encontró la rendición N° ' + nro);
  if (s.rol === 'supervisor' && norm_(r.Supervisor) !== norm_(s.nombre)) throw new Error('Esa rendición no es tuya.');
  const id = driveId_(r['Link PDF']);
  if (!id) throw new Error('La rendición no tiene PDF.');
  // El PDF se muestra con el visor de Drive dentro de la app: queda visible para quien tenga el link
  try {
    const f = DriveApp.getFileById(id);
    if (f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK && f.getSharingAccess() !== DriveApp.Access.ANYONE) {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
  } catch (e) { console.error('Compartir PDF ' + id + ': ' + e.message); }
  return { id: id, preview: 'https://drive.google.com/file/d/' + id + '/preview', link: 'https://drive.google.com/file/d/' + id + '/view' };
}

/** El administrador carga la clave de Gemini desde la app (opcional: mejora la lectura y lee lo escrito a mano). */
function guardarClaveGemini(token, clave) {
  const s = ses_(token);
  exigirAdmin_(s);
  clave = String(clave || '').trim();
  const props = PropertiesService.getScriptProperties();
  if (!clave) { props.deleteProperty('GEMINI_API_KEY'); return { ok: true, activa: false }; }
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CFG.GEMINI_MODEL + '?key=' + encodeURIComponent(clave);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('La clave no funciona (error ' + res.getResponseCode() + '). Revisá que esté bien copiada.');
  props.setProperty('GEMINI_API_KEY', clave);
  return { ok: true, activa: true };
}

function guardarTicket(token, t, como) {
  const s = sesRinde_(token, como);
  validarTicket_(t);
  if (!t.foto) throw new Error('Falta la foto del ticket.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(regSheet_('Tickets'));
    chequearDuplicado_(tab.rows, t, null);
    const id = nextId_(tab.rows, 'ID');
    const fecha = dateFromIso_(t.fecha);
    const foto = guardarFoto_(t.foto, fecha, s.nombre, t.numero, id);
    appendObj_(tab, {
      'ID': id,
      'Fecha carga': new Date(),
      'Supervisor': s.nombre,
      'Corresponde a': String(t.correspondeA).trim(),
      'Fecha ticket': fecha,
      'N° Comprobante': String(t.numero).trim(),
      'Proveedor': String(t.proveedor || '').trim(),
      'CUIT Proveedor': String(t.cuit || '').trim(),
      'Producto': String(t.producto || '').trim(),
      'Litros': t.litros === '' ? '' : num_(t.litros),
      'Precio x Litro': t.precio === '' ? '' : num_(t.precio),
      'Total con IVA': num_(t.total),
      'Link Foto': foto.getUrl(),
      'Estado': 'Pendiente',
      'Observacion Admin': '',
      'N° Planilla': ''
    }, ['N° Comprobante', 'CUIT Proveedor']);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function eliminarTicket(token, id) {
  const s = ses_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(regSheet_('Tickets'));
    const t = tab.rows.find(r => String(r.ID) === String(id));
    if (!t) throw new Error('No se encontró el ticket.');
    if (s.rol !== 'admin' && norm_(t.Supervisor) !== norm_(s.nombre)) throw new Error('Ese ticket no es tuyo.');
    if (String(t['N° Planilla'] || '').trim()) throw new Error('El ticket ya está en la rendición N° ' + t['N° Planilla'] + ' y no se puede borrar.');
    const fid = driveId_(t['Link Foto']);
    if (fid) { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) {} }
    tab.sh.deleteRow(t._r);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** El supervisor envía su rendición: todos sus tickets sin rendir (no rechazados). */
function enviarRendicion(token, como) {
  const s = sesRinde_(token, como);
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const tTab = readSheet_(regSheet_('Tickets'));
    const mios = tTab.rows.filter(t => norm_(t.Supervisor) === norm_(s.nombre) && !String(t['N° Planilla'] || '').trim() && String(t.Estado) !== 'Rechazado');
    if (!mios.length) throw new Error('No tenés tickets pendientes de rendir.');
    mios.sort((a, b) => dateVal_(a['Fecha ticket']) - dateVal_(b['Fecha ticket']));
    const rTab = readSheet_(regSheet_('Rendiciones'));
    const nro = nextId_(rTab.rows, 'N° Planilla');
    const fecha = new Date();
    const gen = generarArchivos_(nro, s.nombre, mios, fecha);
    mios.forEach(t => setCell_(tTab, t._r, 'N° Planilla', nro));
    const total = round2_(mios.reduce((a, t) => a + num_(t['Total con IVA']), 0));
    appendObj_(rTab, {
      'N° Planilla': nro, 'Fecha': fecha, 'Supervisor': s.nombre, 'Cant. Tickets': mios.length,
      'Total': total, 'Link Excel': gen.xlsxUrl, 'Link PDF': gen.pdfUrl, 'Estado': 'Enviada'
    });
    SpreadsheetApp.flush();
    enviarMail_(nro, s.nombre, s.correo, mios.length, total, gen.pdfBlob, false);
    return { nro: nro, total: total, cant: mios.length, pdfUrl: gen.pdfUrl };
  } finally {
    lock.releaseLock();
  }
}

/** Devuelve la foto de un ticket como dataURL (para verla en la app). */
function getFoto(token, id) {
  const s = ses_(token);
  const t = readSheet_(regSheet_('Tickets')).rows.find(r => String(r.ID) === String(id));
  if (!t) throw new Error('No se encontró el ticket.');
  if (s.rol === 'supervisor' && norm_(t.Supervisor) !== norm_(s.nombre)) throw new Error('Ese ticket no es tuyo.');
  const fid = driveId_(t['Link Foto']);
  if (!fid) throw new Error('El ticket no tiene foto.');
  const b = DriveApp.getFileById(fid).getBlob();
  return 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
}

/* ======================= ADMINISTRADOR ======================= */

function getAdminData(token) {
  const s = ses_(token);
  if (s.rol !== 'admin' && s.rol !== 'visor') throw new Error('Sin acceso.');
  const asig = readSheet_(regSheet_('Asignaciones')).rows;
  const tks = readSheet_(regSheet_('Tickets')).rows;
  const rend = readSheet_(regSheet_('Rendiciones')).rows;
  const sups = getSupervisores_();
  const sal = calcularSaldos_(asig, tks, rend);
  const saldos = sups.map(u => sal[norm_(u.nombre)] || { nombre: u.nombre, asignado: 0, consumido: 0, saldo: 0, sinRendir: 0, cantSinRendir: 0 });
  Object.keys(sal).forEach(k => { if (!saldos.some(x => norm_(x.nombre) === k)) saldos.push(sal[k]); });
  return {
    readOnly: s.rol !== 'admin',
    geminiActiva: !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),
    supervisores: sups,
    objetivos: getCorresponde_(),
    corresponde: getCorrespondeRows_(),
    saldos: saldos,
    asignaciones: asig.map(asigOut_).reverse(),
    tickets: tks.map(ticketOut_).reverse(),
    pedidos: leerPedidos_(),
    rendiciones: rend.map(r => ({
      nro: r['N° Planilla'], fecha: fmtD_(r.Fecha), supervisor: String(r.Supervisor || ''),
      cant: num_(r['Cant. Tickets']), total: num_(r.Total), excel: String(r['Link Excel'] || ''),
      pdf: String(r['Link PDF'] || ''), estado: String(r.Estado || '')
    })).reverse()
  };
}

function guardarAsignacion(token, a) {
  const s = ses_(token);
  exigirAdmin_(s);
  const sup = getSupervisores_().find(u => norm_(u.nombre) === norm_(a.supervisor));
  if (!sup) throw new Error('Elegí un supervisor de la lista.');
  const monto = num_(a.monto);
  if (!(monto > 0)) throw new Error('Ingresá un monto mayor a cero.');
  if (!a.fecha) throw new Error('Ingresá la fecha.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(regSheet_('Asignaciones'));
    const id = nextId_(tab.rows, 'ID');
    appendObj_(tab, {
      'ID': id, 'Fecha': dateFromIso_(a.fecha), 'Supervisor': sup.nombre, 'Monto': monto,
      'Observacion': String(a.observacion || '').trim(), 'Cargado por': s.nombre, 'Fecha carga': new Date()
    });
    if (a.pedidoId) marcarPedido_(a.pedidoId, 'Asignado', 'Se asignaron ' + money_(monto) + ' (asignación ' + id + ')', s.nombre);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

function eliminarAsignacion(token, id) {
  const s = ses_(token);
  exigirAdmin_(s);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(regSheet_('Asignaciones'));
    const a = tab.rows.find(r => String(r.ID) === String(id));
    if (!a) throw new Error('No se encontró la asignación.');
    tab.sh.deleteRow(a._r);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** El administrador corrige datos del ticket y/o cambia el estado. */
function actualizarTicket(token, id, c) {
  const s = ses_(token);
  exigirAdmin_(s);
  validarTicket_(c);
  if (ESTADOS.indexOf(c.estado) < 0) throw new Error('Estado inválido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const tab = readSheet_(regSheet_('Tickets'));
    const t = tab.rows.find(r => String(r.ID) === String(id));
    if (!t) throw new Error('No se encontró el ticket.');
    chequearDuplicado_(tab.rows, c, String(id));
    const r = t._r;
    const nc = tab.headers.indexOf('N° Comprobante') + 1;
    const cc = tab.headers.indexOf('CUIT Proveedor') + 1;
    if (nc) tab.sh.getRange(r, nc).setNumberFormat('@');
    if (cc) tab.sh.getRange(r, cc).setNumberFormat('@');
    setCell_(tab, r, 'Corresponde a', String(c.correspondeA).trim());
    setCell_(tab, r, 'Fecha ticket', dateFromIso_(c.fecha));
    setCell_(tab, r, 'N° Comprobante', String(c.numero).trim());
    setCell_(tab, r, 'Proveedor', String(c.proveedor || '').trim());
    setCell_(tab, r, 'CUIT Proveedor', String(c.cuit || '').trim());
    setCell_(tab, r, 'Producto', String(c.producto || '').trim());
    setCell_(tab, r, 'Litros', c.litros === '' ? '' : num_(c.litros));
    setCell_(tab, r, 'Precio x Litro', c.precio === '' ? '' : num_(c.precio));
    setCell_(tab, r, 'Total con IVA', num_(c.total));
    setCell_(tab, r, 'Estado', c.estado);
    setCell_(tab, r, 'Observacion Admin', String(c.observacion || '').trim());
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Vuelve a armar el Excel y el PDF de una rendición con los datos corregidos (excluye rechazados). */
function regenerarRendicion(token, nro, reenviar) {
  const s = ses_(token);
  exigirAdmin_(s);
  const lock = LockService.getScriptLock();
  lock.waitLock(60000);
  try {
    const rTab = readSheet_(regSheet_('Rendiciones'));
    const rend = rTab.rows.find(r => String(r['N° Planilla']) === String(nro));
    if (!rend) throw new Error('No se encontró la rendición N° ' + nro);
    const tks = readSheet_(regSheet_('Tickets')).rows
      .filter(t => String(t['N° Planilla']) === String(nro) && String(t.Estado) !== 'Rechazado')
      .sort((a, b) => dateVal_(a['Fecha ticket']) - dateVal_(b['Fecha ticket']));
    if (!tks.length) throw new Error('La rendición no tiene tickets válidos.');
    [rend['Link Excel'], rend['Link PDF']].forEach(u => { const id = driveId_(u); if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} } });
    const sup = String(rend.Supervisor);
    const gen = generarArchivos_(nro, sup, tks, rend.Fecha instanceof Date ? rend.Fecha : new Date());
    const total = round2_(tks.reduce((a, t) => a + num_(t['Total con IVA']), 0));
    setCell_(rTab, rend._r, 'Cant. Tickets', tks.length);
    setCell_(rTab, rend._r, 'Total', total);
    setCell_(rTab, rend._r, 'Link Excel', gen.xlsxUrl);
    setCell_(rTab, rend._r, 'Link PDF', gen.pdfUrl);
    SpreadsheetApp.flush();
    if (reenviar) {
      const u = getSupervisores_().find(x => norm_(x.nombre) === norm_(sup));
      enviarMail_(nro, sup, u ? u.correo : '', tks.length, total, gen.pdfBlob, true);
    }
    return { pdfUrl: gen.pdfUrl, excelUrl: gen.xlsxUrl, total: total };
  } finally {
    lock.releaseLock();
  }
}

function cambiarEstadoRendicion(token, nro, estado) {
  const s = ses_(token);
  exigirAdmin_(s);
  const ok = ['Enviada', 'Revisada', 'Enviada a Finanzas'];
  if (ok.indexOf(estado) < 0) throw new Error('Estado inválido.');
  const tab = readSheet_(regSheet_('Rendiciones'));
  const r = tab.rows.find(x => String(x['N° Planilla']) === String(nro));
  if (!r) throw new Error('No se encontró la rendición.');
  setCell_(tab, r._r, 'Estado', estado);
  return true;
}

/* ======================= EXCEL + PDF ======================= */

/** Arma el PDF de la rendición (ya no se genera Excel: con el PDF alcanza) y lo guarda en la carpeta. */
function generarArchivos_(nro, supervisor, tickets, fecha) {
  const folder = DriveApp.getFolderById(CFG.FOLDER_ID);
  const fechaTxt = Utilities.formatDate(fecha, CFG.TZ, 'dd-MM-yyyy');
  const nombre = 'Rendicion Combustible N° ' + nro + ' - ' + supervisor + ' - ' + fechaTxt;
  // PDF: hoja 1 = la planilla; después las fotos de los tickets, 2 por hoja (A4 vertical)
  const pdf = armarPdf_(nombre, nro, supervisor, tickets, fecha);
  const pdfFile = folder.createFile(pdf);
  try { pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { xlsxUrl: '', pdfUrl: pdfFile.getUrl(), pdfBlob: pdf };
}

/**
 * PDF de la rendición armado página por página (sin convertir desde HTML), así cada hoja tiene su orientación:
 * hoja 1 = planilla en A4 HORIZONTAL; hojas de tickets en A4 VERTICAL, 2 tickets por hoja.
 * Si algo falla, se arma con el método anterior (todo vertical) para que la rendición salga igual.
 */
function armarPdf_(nombre, nro, supervisor, tickets, fecha) {
  try {
    return armarPdfDirecto_(nombre, nro, supervisor, tickets, fecha);
  } catch (err) {
    console.error('PDF directo: ' + err.message + ' — se usa el armado HTML');
    return armarPdfHtml_(nombre, nro, supervisor, tickets, fecha);
  }
}

function armarPdfDirecto_(nombre, nro, supervisor, tickets, fecha) {
  const doc = { paginas: [], imagenes: [] };
  const AZUL = '0.122 0.220 0.392', NEGRO = '0 0 0', GRIS_F = '0.949 0.949 0.949', GRIS_L = '0.6 0.6 0.6';
  const M = 28;

  // ---------- Hoja 1: planilla (A4 horizontal) ----------
  const p = pdfPagina_(doc, 842, 595);
  pdfRect_(p, M, M, 842 - 2 * M, 595 - 2 * M, 1.6);
  let logoW = 0;
  try {
    const lb = DriveApp.getFileById(CFG.LOGO_KTL_ID).getBlob().getBytes();
    const li = pdfImagen_(doc, lb);
    if (li !== null) {
      const d = doc.imagenes[li], lh = 46;
      logoW = lh * d.w / d.h;
      pdfImg_(p, li, 842 - M - 14 - logoW, M + 10, logoW, lh);
    }
  } catch (e) {}
  const anchoTit = 842 - 2 * M - 28 - logoW;
  pdfTxtC_(p, M + 14 + anchoTit / 2, M + 38, 13, true, 'FORMULARIO DE RENDICION DE FONDOS FIJO - REINTEGRO DE GASTOS COMBUSTIBLE', AZUL);

  const X0 = M + 14, XB = 232, XR = 842 - M - 14;
  let y = M + 76;
  const campo = (lbl, val, w) => {
    pdfTxt_(p, X0, y + 13, 10, true, lbl);
    pdfRect_(p, XB, y, w, 19, 1.2);
    pdfTxtC_(p, XB + w / 2, y + 13.5, 10, false, pdfCortar_(val, 10, false, w - 8));
  };
  campo('EMPRESA:', '', XR - XB); y += 25;
  campo('FECHA:', fmtD_(fecha), 140);
  pdfTxt_(p, 520, y + 13, 10, true, 'PLANILLA N°');
  pdfRect_(p, 620, y, XR - 620, 19, 1.2);
  pdfTxtC_(p, 620 + (XR - 620) / 2, y + 13.5, 10, false, String(nro));
  y += 25;
  campo('NOMBRE DEL EMPLEADO', supervisor, XR - XB); y += 25;
  campo('ES TITULAR DE FONDO FIJO?', 'NO', 140); y += 25;
  campo('TIENE TARJETA PRECARGABLE?', 'NO', 140); y += 25;

  // Tabla de tickets
  const cols = [['CONCEPTO', 140], ['FECHA', 80], ['N° COMPROBANTE', 120], ['PROVEEDOR', 190], ['USUARIO', 136], ['MONTO', XR - X0 - 666]];
  const ty = y + 12, th = 24;
  const n = Math.max(CFG.FILAS_PLANILLA, tickets.length);
  const libre = (595 - M - 14) - 74 - 24 - (ty + th);
  const rh = Math.min(19, libre / n);
  const fs = Math.min(9, rh * 0.55);
  let x = X0;
  pdfRellenar_(p, X0, ty, XR - X0, th, GRIS_F);
  cols.forEach(c => { pdfRect_(p, x, ty, c[1], th, 1.2); pdfTxtC_(p, x + c[1] / 2, ty + 15.5, 8.5, true, c[0]); x += c[1]; });
  const filas = tickets.map(t => ['Combustible', fmtD_(t['Fecha ticket']), String(t['N° Comprobante'] || ''), String(t.Proveedor || ''),
    String(t['Corresponde a'] || ''), money_(num_(t['Total con IVA']))]);
  let total = 0;
  tickets.forEach(t => { total += num_(t['Total con IVA']); });
  const yT = ty + th, hT = rh * n;
  x = X0;
  cols.forEach(c => { pdfLinea_(p, x, yT, x, yT + hT, 1.2); x += c[1]; });
  pdfLinea_(p, XR, yT, XR, yT + hT, 1.2);
  for (let i = 0; i < n; i++) {
    const yy = yT + i * rh;
    if (i > 0) pdfLinea_(p, X0, yy, XR, yy, 0.5, GRIS_L);
    const f = filas[i];
    if (!f) continue;
    x = X0;
    f.forEach((v, j) => {
      const w = cols[j][1], base = yy + rh / 2 + fs * 0.35;
      const tx = pdfCortar_(v, fs, false, w - 8);
      if (j === 5) pdfTxtR_(p, x + w - 4, base, fs, false, tx);
      else if (j === 1 || j === 2) pdfTxtC_(p, x + w / 2, base, fs, false, tx);
      else pdfTxt_(p, x + 4, base, fs, false, tx);
      x += w;
    });
  }
  const yTot = yT + hT;
  pdfRect_(p, X0, yTot, XR - X0, 24, 1.4);
  pdfLinea_(p, XR - cols[5][1], yTot, XR - cols[5][1], yTot + 24, 1.4);
  pdfTxt_(p, X0 + 6, yTot + 16, 11, true, 'TOTAL DE GASTOS CON IVA');
  pdfTxtR_(p, XR - 4, yTot + 16, 11, true, money_(total));

  const yF = yTot + 50;
  pdfTxt_(p, X0, yF, 9.5, false, supervisor);
  pdfTxt_(p, X0, yF + 12, 9.5, false, '.------------------------------------------');
  pdfTxt_(p, X0, yF + 24, 9.5, false, 'Firma del Empleado');
  pdfTxt_(p, 470, yF + 12, 9.5, false, '.------------------------------------------');
  pdfTxt_(p, 470, yF + 24, 9.5, false, 'Firma de Responsable Administrativo');

  // ---------- Hojas de tickets (A4 vertical, 2 por hoja) ----------
  const PW = 595, PH = 842, colW = (PW - 2 * M - 12) / 2;
  for (let i = 0; i < tickets.length; i += 2) {
    const q = pdfPagina_(doc, PW, PH);
    pdfTxtC_(q, PW / 2, M + 10, 11, true, pdfCortar_('COMPROBANTES - PLANILLA N° ' + nro + ' - ' + supervisor, 11, true, PW - 2 * M));
    for (let j = i; j < i + 2 && j < tickets.length; j++) {
      const t = tickets[j], cx = M + (j - i) * (colW + 12), cy = M + 22;
      pdfRellenar_(q, cx, cy, colW, 30, GRIS_F);
      pdfRect_(q, cx, cy, colW, 30, 0.8);
      pdfTxtC_(q, cx + colW / 2, cy + 12, 8.5, true, pdfCortar_('#' + (j + 1) + ' · ' + fmtD_(t['Fecha ticket']) + ' · N° ' + (t['N° Comprobante'] || ''), 8.5, true, colW - 8));
      pdfTxtC_(q, cx + colW / 2, cy + 24, 8.5, true, pdfCortar_((t['Corresponde a'] || '') + ' · ' + money_(num_(t['Total con IVA'])), 8.5, true, colW - 8));
      const iy = cy + 30, maxH = PH - M - iy;
      let dibujada = false;
      const fid = driveId_(t['Link Foto']);
      if (fid) {
        try {
          const ii = pdfImagen_(doc, DriveApp.getFileById(fid).getBlob().getBytes());
          if (ii !== null) {
            const d = doc.imagenes[ii], k = Math.min((colW - 8) / d.w, (maxH - 8) / d.h);
            const w = d.w * k, h = d.h * k;
            pdfRect_(q, cx, iy, colW, h + 8, 0.8);
            pdfImg_(q, ii, cx + (colW - w) / 2, iy + 4, w, h);
            dibujada = true;
          }
        } catch (e) {}
      }
      if (!dibujada) { pdfRect_(q, cx, iy, colW, 60, 0.8); pdfTxtC_(q, cx + colW / 2, iy + 34, 9, false, 'Sin foto'); }
    }
  }
  return pdfArmar_(doc, nombre + '.pdf');
}

/* ---------- Escritor de PDF mínimo (texto Helvetica, líneas, rectángulos y fotos JPEG) ---------- */
const HELV_W_ = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
const HELV_B_W_ = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0, 0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];const WINANSI_EXTRA_ = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '™': 0x99 };

function pdfBytesTexto_(s) {
  const out = [];
  for (const ch of String(s == null ? '' : s)) {
    const c = ch.charCodeAt(0);
    if ((c >= 32 && c < 127) || (c >= 160 && c <= 255)) out.push(c);
    else if (WINANSI_EXTRA_[ch]) out.push(WINANSI_EXTRA_[ch]);
    else out.push(63);
  }
  return out;
}
function pdfAncho_(s, size, bold) {
  const W = bold ? HELV_B_W_ : HELV_W_;
  return pdfBytesTexto_(s).reduce((a, c) => a + (W[c - 32] || 556), 0) * size / 1000;
}
function pdfCortar_(s, size, bold, max) {
  s = String(s == null ? '' : s);
  if (pdfAncho_(s, size, bold) <= max) return s;
  while (s.length && pdfAncho_(s + '...', size, bold) > max) s = s.slice(0, -1);
  return s + '...';
}
function pdfPagina_(doc, w, h) { const p = { w: w, h: h, ops: [], imgs: {} }; doc.paginas.push(p); return p; }
function pdfN_(v) { return (Math.round(v * 100) / 100).toString(); }
function pdfTxt_(p, x, y, size, bold, s, color) {
  const esc = pdfBytesTexto_(s).map(c => (c === 40 || c === 41 || c === 92) ? '\\' + String.fromCharCode(c) : String.fromCharCode(c)).join('');
  p.ops.push((color || '0 0 0') + ' rg BT /' + (bold ? 'F2' : 'F1') + ' ' + pdfN_(size) + ' Tf ' + pdfN_(x) + ' ' + pdfN_(p.h - y) + ' Td (' + esc + ') Tj ET');
}
function pdfTxtC_(p, cx, y, size, bold, s, color) { pdfTxt_(p, cx - pdfAncho_(s, size, bold) / 2, y, size, bold, s, color); }
function pdfTxtR_(p, rx, y, size, bold, s, color) { pdfTxt_(p, rx - pdfAncho_(s, size, bold), y, size, bold, s, color); }
function pdfRect_(p, x, y, w, h, lw, color) {
  p.ops.push((color || '0 0 0') + ' RG ' + pdfN_(lw) + ' w ' + pdfN_(x) + ' ' + pdfN_(p.h - y - h) + ' ' + pdfN_(w) + ' ' + pdfN_(h) + ' re S');
}
function pdfRellenar_(p, x, y, w, h, color) {
  p.ops.push(color + ' rg ' + pdfN_(x) + ' ' + pdfN_(p.h - y - h) + ' ' + pdfN_(w) + ' ' + pdfN_(h) + ' re f');
}
function pdfLinea_(p, x1, y1, x2, y2, lw, color) {
  p.ops.push((color || '0 0 0') + ' RG ' + pdfN_(lw) + ' w ' + pdfN_(x1) + ' ' + pdfN_(p.h - y1) + ' m ' + pdfN_(x2) + ' ' + pdfN_(p.h - y2) + ' l S');
}
/** Agrega una foto JPEG al documento; devuelve su número o null si no es JPEG. */
function pdfImagen_(doc, bytes) {
  const d = medidaImagen_(bytes);
  if (!d || d.png || !d.w || !d.h) return null;
  doc.imagenes.push({ bytes: bytes, w: d.w, h: d.h, c: d.c || 3 });
  return doc.imagenes.length - 1;
}
function pdfImg_(p, idx, x, y, w, h) {
  p.imgs[idx] = true;
  p.ops.push('q ' + pdfN_(w) + ' 0 0 ' + pdfN_(h) + ' ' + pdfN_(x) + ' ' + pdfN_(p.h - y - h) + ' cm /Im' + idx + ' Do Q');
}
function pdfArmar_(doc, nombreArchivo) {
  const out = [], ofs = [];
  const put = s => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff); };
  const putB = b => { for (let i = 0; i < b.length; i++) out.push(b[i] & 0xff); };
  const objs = [];
  const nImg = doc.imagenes.length, nPag = doc.paginas.length;
  // 1 catálogo, 2 páginas, 3-4 fuentes, 5.. imágenes, después página + contenido de cada hoja
  const idImg = i => 5 + i, idPag = i => 5 + nImg + i * 2, idCont = i => 6 + nImg + i * 2;
  objs[1] = { s: '<< /Type /Catalog /Pages 2 0 R >>' };
  objs[2] = { s: '<< /Type /Pages /Kids [' + doc.paginas.map((_, i) => idPag(i) + ' 0 R').join(' ') + '] /Count ' + nPag + ' >>' };
  objs[3] = { s: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' };
  objs[4] = { s: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>' };
  doc.imagenes.forEach((im, i) => {
    const cs = im.c === 1 ? '/DeviceGray' : im.c === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
    objs[idImg(i)] = { s: '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace ' + cs +
      ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>', stream: im.bytes };
  });
  doc.paginas.forEach((pg, i) => {
    const xo = Object.keys(pg.imgs).map(k => '/Im' + k + ' ' + idImg(+k) + ' 0 R').join(' ');
    objs[idPag(i)] = { s: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pg.w + ' ' + pg.h + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>' +
      (xo ? ' /XObject << ' + xo + ' >>' : '') + ' >> /Contents ' + idCont(i) + ' 0 R >>' };
    const cont = pg.ops.join('\n');
    const cb = []; for (let k = 0; k < cont.length; k++) cb.push(cont.charCodeAt(k) & 0xff);
    objs[idCont(i)] = { s: '<< /Length ' + cb.length + ' >>', stream: cb };
  });
  put('%PDF-1.4\n%âãÏÓ\n');
  for (let i = 1; i < objs.length; i++) {
    ofs[i] = out.length;
    put(i + ' 0 obj\n' + objs[i].s + '\n');
    if (objs[i].stream) { put('stream\n'); putB(objs[i].stream); put('\nendstream\n'); }
    put('endobj\n');
  }
  const xref = out.length;
  let x = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objs.length; i++) x += ('0000000000' + ofs[i]).slice(-10) + ' 00000 n \n';
  put(x + 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
  return Utilities.newBlob(out.map(b => b > 127 ? b - 256 : b), 'application/pdf', nombreArchivo);
}

/**
 * Arma el PDF de la rendición en HTML (así salen siempre las hojas justas):
 * hoja 1 = planilla "Formulario de rendición de fondos fijo" con el logo KTL; después 2 tickets por hoja.
 */
function armarPdfHtml_(nombre, nro, supervisor, tickets, fecha) {
  const e = esc_;
  // Logo KTL con su proporción real (alto 17 mm, ancho según la foto), para que no salga deformado
  let logo = '', logoW = 29.5;
  try {
    const lb = DriveApp.getFileById(CFG.LOGO_KTL_ID).getBlob();
    const ld = medidaImagen_(lb.getBytes());
    if (ld && ld.h) logoW = 17 * ld.w / ld.h;
    logo = dataUrl_(lb);
  } catch (err) {}
  const filas = tickets.map(t => ({
    fecha: fmtD_(t['Fecha ticket']), numero: String(t['N° Comprobante'] || ''), prov: String(t.Proveedor || ''),
    corr: String(t['Corresponde a'] || ''), total: num_(t['Total con IVA'])
  }));
  const total = filas.reduce((a, f) => a + f.total, 0);
  const vacias = Math.max(0, CFG.FILAS_PLANILLA - filas.length);
  let cuerpo = filas.map(f => '<tr><td>Combustible</td><td class="c">' + e(f.fecha) + '</td><td class="c">' + e(f.numero) + '</td><td>' + e(f.prov) +
    '</td><td>' + e(f.corr) + '</td><td class="r">' + money_(f.total) + '</td></tr>').join('');
  for (let i = 0; i < vacias; i++) cuerpo += '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';

  const css =
    '@page{size:A4 portrait;margin:10mm}' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;margin:0}' +
    '.hoja{border:2px solid #000;padding:8mm 7mm 6mm}' +
    '.salto{page-break-before:always}' +
    'table{border-collapse:collapse;width:100%}' +
    '.cab td{vertical-align:middle}' +
    '.tit{font-size:12pt;font-weight:bold;text-align:center;color:#1f3864}' +
    '.campos td{padding:2.2mm 1mm;font-size:10pt}' +
    '.lbl{font-weight:bold;white-space:nowrap}' +
    '.box{border:1.5px solid #000;text-align:center;height:6mm}' +
    '.det{margin-top:6mm}' +
    '.det th{border:1.5px solid #000;font-size:9pt;padding:2mm 1mm;text-align:center;background:#f2f2f2}' +
    '.det td{border-left:1.5px solid #000;border-right:1.5px solid #000;border-bottom:1px solid #999;padding:1.6mm 1.5mm;font-size:9pt;height:5mm}' +
    '.det tr.tot td{border:1.5px solid #000;font-weight:bold;font-size:11pt;padding:2mm 1.5mm}' +
    '.c{text-align:center}.r{text-align:right;white-space:nowrap}' +
    '.firma{margin-top:16mm;font-size:9.5pt}' +
    '.tk td{width:50%;vertical-align:top;text-align:center;padding:0 2mm}' +
    '.cap{font-size:9pt;font-weight:bold;border:1px solid #000;border-bottom:0;padding:1.5mm;background:#f2f2f2}' +
    '.foto{border:1px solid #000;padding:2mm}' +
    '.tt{font-size:11pt;font-weight:bold;text-align:center;margin-bottom:3mm}';

  let html = '<html><head><meta charset="utf-8"><style>' + css + '</style></head><body>' +
    '<div class="hoja">' +
    '<table class="cab"><tr><td class="tit">FORMULARIO DE RENDICION DE FONDOS FIJO - REINTEGRO DE GASTOS COMBUSTIBLE</td>' +
    '<td style="width:' + (logoW + 4).toFixed(1) + 'mm;text-align:right">' + (logo ? '<img src="' + logo + '" style="height:17mm;width:' + logoW.toFixed(1) + 'mm">' : '') + '</td></tr></table>' +
    '<table class="campos" style="margin-top:4mm">' +
    '<tr><td class="lbl" style="width:52mm">EMPRESA:</td><td class="box" colspan="3"></td></tr>' +
    '<tr><td class="lbl">FECHA:</td><td class="box" style="width:38mm">' + e(fmtD_(fecha)) + '</td>' +
    '<td class="lbl" style="text-align:right;padding-right:3mm">PLANILLA N°</td><td class="box" style="width:38mm">' + e(nro) + '</td></tr>' +
    '<tr><td class="lbl">NOMBRE DEL EMPLEADO</td><td class="box" colspan="3">' + e(supervisor) + '</td></tr>' +
    '<tr><td class="lbl">ES TITULAR DE FONDO FIJO?</td><td class="box" style="width:38mm">NO</td><td colspan="2"></td></tr>' +
    '<tr><td class="lbl">TIENE TARJETA PRECARGABLE?</td><td class="box" style="width:38mm">NO</td><td colspan="2"></td></tr>' +
    '</table>' +
    '<table class="det"><tr><th style="width:22%">CONCEPTO</th><th style="width:12%">FECHA</th><th style="width:15%">N° COMPROBANTE</th>' +
    '<th style="width:20%">PROVEEDOR</th><th style="width:16%">USUARIO</th><th style="width:15%">MONTO</th></tr>' + cuerpo +
    '<tr class="tot"><td colspan="5">TOTAL DE GASTOS CON IVA</td><td class="r">' + money_(total) + '</td></tr></table>' +
    '<div class="firma">' + e(supervisor) + '<br>.------------------------------------------<br>Firma del Empleado' +
    '<br><br><br><br>.------------------------------------------<br>Firma de Responsable Administrativo</div>' +
    '</div>';

  // Hojas de tickets: 2 por hoja, uno al lado del otro
  const FW = 88, FH = 232; // medida máxima de cada foto en mm
  for (let i = 0; i < tickets.length; i += 2) {
    html += '<div class="salto"><div class="tt">COMPROBANTES - PLANILLA N° ' + e(nro) + ' - ' + e(supervisor) + '</div><table class="tk"><tr>';
    for (let j = i; j < i + 2; j++) {
      const t = tickets[j];
      if (!t) { html += '<td></td>'; continue; }
      let img = '<div style="padding:20mm 0">Sin foto</div>';
      const fid = driveId_(t['Link Foto']);
      if (fid) {
        try {
          const b = DriveApp.getFileById(fid).getBlob();
          const d = medidaImagen_(b.getBytes());
          let w = FW, h = FH;
          if (d) { const k = Math.min(FW / d.w, FH / d.h); w = d.w * k; h = d.h * k; }
          img = '<img src="' + dataUrl_(b) + '" style="width:' + w.toFixed(1) + 'mm;height:' + h.toFixed(1) + 'mm">';
        } catch (err) { img = '<div style="padding:20mm 0">No se pudo cargar la foto</div>'; }
      }
      html += '<td><div class="cap">#' + (j + 1) + ' · ' + e(fmtD_(t['Fecha ticket'])) + ' · N° ' + e(t['N° Comprobante']) + '<br>' +
        e(t['Corresponde a']) + ' · ' + money_(num_(t['Total con IVA'])) + '</div><div class="foto">' + img + '</div></td>';
    }
    html += '</tr></table></div>';
  }
  html += '</body></html>';
  return HtmlService.createHtmlOutput(html).getBlob().getAs('application/pdf').setName(nombre + '.pdf');
}

function dataUrl_(blob) {
  return 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/** Ancho y alto en píxeles de una foto JPEG o PNG (para que entre entera en la hoja). */
function medidaImagen_(bytes) {
  const u = i => bytes[i] & 0xff;
  if (u(0) === 0x89 && u(1) === 0x50) return { png: true, w: (u(16) << 24) | (u(17) << 16) | (u(18) << 8) | u(19), h: (u(20) << 24) | (u(21) << 16) | (u(22) << 8) | u(23) };
  if (u(0) !== 0xff || u(1) !== 0xd8) return null;
  let i = 2;
  while (i < bytes.length - 9) {
    if (u(i) !== 0xff) { i++; continue; }
    const m = u(i + 1);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: (u(i + 5) << 8) | u(i + 6), w: (u(i + 7) << 8) | u(i + 8), c: u(i + 9) };
    }
    i += 2 + ((u(i + 2) << 8) | u(i + 3));
  }
  return null;
}

function enviarMail_(nro, supervisor, correoSup, cant, total, pdfBlob, corregida) {
  const asunto = 'DELBEN - Rendición de Combustible N° ' + nro + ' - ' + supervisor + (corregida ? ' (corregida)' : '');
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
    '<p>Se ' + (corregida ? 'corrigió' : 'generó') + ' la <b>Rendición de Gastos de Combustible N° ' + nro + '</b>.</p>' +
    '<table style="border-collapse:collapse">' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Supervisor:</b></td><td>' + esc_(supervisor) + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Fecha:</b></td><td>' + Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm') + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Tickets:</b></td><td>' + cant + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Total con IVA:</b></td><td>' + money_(total) + '</td></tr>' +
    '</table><p>Se adjunta el PDF con la planilla y las fotos de los comprobantes.</p>' +
    '<p style="color:#777;font-size:12px">DELBEN - Control de Combustible</p></div>';
  const para = correoSup && correoSup !== CFG.MAIL_ADMIN ? correoSup : CFG.MAIL_ADMIN;
  const opts = { to: para, subject: asunto, htmlBody: html, name: CFG.MAIL_NOMBRE, attachments: [pdfBlob] };
  if (para !== CFG.MAIL_ADMIN) opts.cc = CFG.MAIL_ADMIN;
  if (corregida) { opts.to = CFG.MAIL_ADMIN; delete opts.cc; if (correoSup && correoSup !== CFG.MAIL_ADMIN) opts.cc = correoSup; }
  MailApp.sendEmail(opts);
}

/* ======================= AUXILIARES ======================= */

function guardarFoto_(dataUrl, fecha, supervisor, numero, id) {
  const parts = String(dataUrl).split(',');
  const mime = (parts[0].match(/data:(.*?);/) || [])[1] || 'image/jpeg';
  const ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
  const nombre = Utilities.formatDate(fecha, CFG.TZ, 'yyyy-MM-dd') + ' - ' + supervisor + ' - ' + String(numero).replace(/[\\/:*?"<>|]/g, '-') + ' - ID' + id + '.' + ext;
  const blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mime, nombre);
  return carpetaFotos_().createFile(blob);
}

function carpetaFotos_() {
  const root = DriveApp.getFolderById(CFG.FOLDER_ID);
  const it = root.getFoldersByName(CFG.FOTOS_FOLDER_NAME);
  return it.hasNext() ? it.next() : root.createFolder(CFG.FOTOS_FOLDER_NAME);
}

function validarTicket_(t) {
  if (!t) throw new Error('Faltan datos.');
  if (!String(t.correspondeA || '').trim()) throw new Error('Elegí a quién corresponde el gasto.');
  if (!t.fecha) throw new Error('Ingresá la fecha del ticket.');
  if (!String(t.numero || '').trim()) throw new Error('Ingresá el N° de comprobante.');
  if (!(num_(t.total) > 0)) throw new Error('Ingresá el total con IVA.');
  const objs = getCorresponde_().map(norm_);
  const ca = norm_(t.correspondeA);
  if (objs.indexOf(ca) < 0) throw new Error('"A quién corresponde" tiene que ser uno de la lista (se cargan en Corresponde).');
}

function chequearDuplicado_(rows, t, exceptId) {
  const n = digits_(t.numero);
  const c = digits_(t.cuit);
  const dup = rows.find(r =>
    String(r.ID) !== String(exceptId) &&
    String(r.Estado) !== 'Rechazado' &&
    digits_(r['N° Comprobante']) === n &&
    (!c || !digits_(r['CUIT Proveedor']) || digits_(r['CUIT Proveedor']) === c));
  if (dup) throw new Error('Ese ticket ya fue cargado (ID ' + dup.ID + ', ' + dup.Supervisor + ', ' + fmtD_(dup['Fecha ticket']) + ').');
}

function ticketOut_(t) {
  return {
    id: t.ID, fechaCarga: fmtDT_(t['Fecha carga']), supervisor: String(t.Supervisor || ''),
    correspondeA: String(t['Corresponde a'] || ''), fecha: fmtD_(t['Fecha ticket']), fechaIso: isoFromAny_(t['Fecha ticket']),
    numero: String(t['N° Comprobante'] || ''), proveedor: String(t.Proveedor || ''), cuit: String(t['CUIT Proveedor'] || ''),
    producto: String(t.Producto || ''), litros: t.Litros === '' ? '' : num_(t.Litros), precio: t['Precio x Litro'] === '' ? '' : num_(t['Precio x Litro']),
    total: num_(t['Total con IVA']), foto: String(t['Link Foto'] || ''), estado: String(t.Estado || 'Pendiente'),
    observacion: String(t['Observacion Admin'] || ''), planilla: String(t['N° Planilla'] || '')
  };
}

function asigOut_(a) {
  return {
    id: a.ID, fecha: fmtD_(a.Fecha), supervisor: String(a.Supervisor || ''), monto: num_(a.Monto),
    observacion: String(a.Observacion || ''), cargadoPor: String(a['Cargado por'] || ''), fechaCarga: fmtDT_(a['Fecha carga'])
  };
}

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function num_(v) {
  if (typeof v === 'number') return v;
  let s = String(v === null || v === undefined ? '' : v).replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.indexOf(',') >= 0) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function round2_(n) { return Math.round(n * 100) / 100; }
function digits_(s) { return String(s || '').replace(/\D/g, '').replace(/^0+/, ''); }
function primerCorreo_(s) { return String(s || '').split(/[;,\s]+/).filter(x => x.indexOf('@') > 0)[0] || ''; }
function esc_(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function money_(n) {
  const v = round2_(n || 0).toFixed(2).split('.');
  return '$ ' + v[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + v[1];
}

function driveId_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

function dateFromIso_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) throw new Error('Fecha inválida.');
  return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
}

function dateFromAny_(v) {
  if (v instanceof Date) return v;
  const iso = isoFromAny_(v);
  return iso ? dateFromIso_(iso) : '';
}

function isoFromAny_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  return '';
}

function dateVal_(v) { const d = dateFromAny_(v); return d instanceof Date ? d.getTime() : 0; }
function fmtD_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'dd/MM/yyyy');
  const iso = isoFromAny_(v); // fechas escritas a mano como texto: 29-09-2026, 22/9/2026
  return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : String(v || '');
}
function fmtDT_(v) { return v instanceof Date ? Utilities.formatDate(v, CFG.TZ, 'dd/MM/yyyy HH:mm') : String(v || ''); }

/* ======================= PEDIDOS DE FONDOS ======================= */

const HOJA_PEDIDOS = 'Pedidos';
const COLS_PEDIDOS = ['ID', 'Fecha', 'Supervisor', 'Monto', 'Motivo', 'Estado', 'Respuesta', 'Fecha respuesta', 'Atendido por'];

/** Pestaña "Pedidos" de la planilla de registros (se crea sola la primera vez). */
function hojaPedidos_() {
  const ss = ss_(CFG.REG_ID);
  let sh = ss.getSheetByName(HOJA_PEDIDOS);
  if (!sh) {
    sh = ss.insertSheet(HOJA_PEDIDOS);
    sh.getRange(1, 1, 1, COLS_PEDIDOS.length).setValues([COLS_PEDIDOS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leerPedidos_() {
  return readSheet_(hojaPedidos_()).rows.map(p => ({
    id: p.ID, fecha: fmtDT_(p.Fecha), supervisor: String(p.Supervisor || ''), monto: num_(p.Monto),
    motivo: String(p.Motivo || ''), estado: String(p.Estado || 'Pendiente'), respuesta: String(p.Respuesta || ''),
    fechaRespuesta: fmtDT_(p['Fecha respuesta'])
  })).reverse();
}

/** El supervisor pide fondos: queda registrado y le llega un mail al administrador con el monto. */
function pedirFondos(token, p, como) {
  const s = sesRinde_(token, como);
  const monto = num_(p && p.monto);
  if (!(monto > 0)) throw new Error('Ingresá el monto que necesitás.');
  const motivo = String((p && p.motivo) || '').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let id;
  try {
    const tab = readSheet_(hojaPedidos_());
    if (tab.rows.some(r => norm_(r.Supervisor) === norm_(s.nombre) && String(r.Estado) === 'Pendiente')) {
      throw new Error('Ya tenés un pedido de fondos pendiente. Esperá la respuesta de administración.');
    }
    id = nextId_(tab.rows, 'ID');
    appendObj_(tab, { 'ID': id, 'Fecha': new Date(), 'Supervisor': s.nombre, 'Monto': monto, 'Motivo': motivo, 'Estado': 'Pendiente' });
  } finally {
    lock.releaseLock();
  }
  const asig = readSheet_(regSheet_('Asignaciones')).rows.filter(a => norm_(a.Supervisor) === norm_(s.nombre));
  const tks = readSheet_(regSheet_('Tickets')).rows.filter(t => norm_(t.Supervisor) === norm_(s.nombre));
  const rendP = readSheet_(regSheet_('Rendiciones')).rows.filter(r => norm_(r.Supervisor) === norm_(s.nombre));
  const sal = calcularSaldos_(asig, tks, rendP)[norm_(s.nombre)] || { saldo: 0, sinRendir: 0, cantSinRendir: 0 };
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
    '<p><b>' + esc_(s.nombre) + '</b> pidió fondos para combustible.</p>' +
    '<table style="border-collapse:collapse">' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Monto pedido:</b></td><td style="font-size:18px"><b>' + money_(monto) + '</b></td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Disponible actual:</b></td><td>' + money_(sal.saldo) + '</td></tr>' +
    '<tr><td style="padding:4px 12px 4px 0"><b>Tickets sin rendir:</b></td><td>' + (sal.cantSinRendir || 0) + ' por ' + money_(sal.sinRendir || 0) + '</td></tr>' +
    (motivo ? '<tr><td style="padding:4px 12px 4px 0"><b>Motivo:</b></td><td>' + esc_(motivo) + '</td></tr>' : '') +
    '<tr><td style="padding:4px 12px 4px 0"><b>Fecha:</b></td><td>' + Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm') + '</td></tr>' +
    '</table><p>Para asignarlo entrá a la app Combustible → <b>Asignaciones</b> → Pedidos de fondos.</p>' +
    '<p style="color:#777;font-size:12px">DELBEN - Control de Combustible</p></div>';
  MailApp.sendEmail({
    to: CFG.MAIL_ADMIN,
    subject: 'DELBEN - Pedido de fondos de combustible - ' + s.nombre + ' - ' + money_(monto),
    htmlBody: html, name: CFG.MAIL_NOMBRE, replyTo: s.correo || CFG.MAIL_ADMIN
  });
  return { id: id };
}

/** El administrador rechaza un pedido (o lo marca como atendido sin asignar). */
function responderPedido(token, id, estado, respuesta) {
  const s = ses_(token);
  exigirAdmin_(s);
  if (['Rechazado', 'Asignado'].indexOf(estado) < 0) throw new Error('Estado inválido.');
  marcarPedido_(id, estado, String(respuesta || '').trim(), s.nombre);
  return true;
}

function marcarPedido_(id, estado, respuesta, quien) {
  const tab = readSheet_(hojaPedidos_());
  const p = tab.rows.find(r => String(r.ID) === String(id));
  if (!p) return;
  setCell_(tab, p._r, 'Estado', estado);
  setCell_(tab, p._r, 'Respuesta', respuesta);
  setCell_(tab, p._r, 'Fecha respuesta', new Date());
  setCell_(tab, p._r, 'Atendido por', quien);
}

/* ======================= RECORDATORIO DE LOS LUNES ======================= */

/**
 * El mail de los lunes se programa desde el editor: Activadores (ícono del reloj) → Agregar activador →
 * función recordatorioSemanal → Basado en tiempo → Temporizador semanal → Todos los lunes → 8 a 9 h → Guardar.
 */

/**
 * Mail de los lunes: le recuerda que envíe la rendición SOLO a las personas de la pestaña "quienRetira"
 * de Stock Manager que tienen "SI" en la columna "correo de combustible" (columna E), al correo de esa fila.
 * Incluye su disponible y lo que tiene sin rendir.
 */
function recordatorioSemanal() {
  const sh = ss_(CFG.STOCK_ID).getSheetByName('quienRetira');
  if (!sh) throw new Error('No existe la pestaña "quienRetira" en Stock Manager.');
  const t = readSheet_(sh);
  const colSi = t.headers.find(h => norm_(h) === 'correo de combustible') || t.headers[4];
  const destinatarios = t.rows
    .filter(r => norm_(r[colSi]) === 'si' && String(r.nombre || '').trim() && primerCorreo_(r.correo))
    .map(r => ({ nombre: String(r.nombre).trim().replace(/\s+/g, ' '), correo: primerCorreo_(r.correo) }));
  if (!destinatarios.length) return;

  const asig = readSheet_(regSheet_('Asignaciones')).rows;
  const tks = readSheet_(regSheet_('Tickets')).rows;
  const sal = calcularSaldos_(asig, tks, readSheet_(regSheet_('Rendiciones')).rows);
  destinatarios.forEach(u => {
    const x = sal[norm_(u.nombre)] || { saldo: 0, sinRendir: 0, cantSinRendir: 0 };
    const pend = x.cantSinRendir
      ? 'Tenés <b>' + x.cantSinRendir + ' ticket(s) sin rendir por ' + money_(x.sinRendir) + '</b>. Entrá a la app, revisá que estén todos y tocá <b>Enviar rendición</b>.'
      : 'No tenés tickets cargados sin rendir. Si cargaste combustible esta semana, sacale foto a los tickets en la app y enviá la rendición.';
    const html =
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
      '<p>Hola ' + esc_(u.nombre) + ':</p>' +
      '<p>Hoy es lunes: <b>enviá tu rendición de combustible de la semana</b>.</p>' +
      '<p>' + pend + '</p>' +
      '<p>Tu disponible para combustible: <b style="color:' + (x.saldo < 0 ? '#c62828' : '#1d4f9f') + '">' + money_(x.saldo) + '</b></p>' +
      '<p style="color:#777;font-size:12px">DELBEN - Control de Combustible</p></div>';
    try {
      MailApp.sendEmail({ to: u.correo, subject: 'DELBEN - Recordatorio: enviá tu rendición de combustible', htmlBody: html, name: CFG.MAIL_NOMBRE });
    } catch (e) { console.error('Recordatorio ' + u.nombre + ': ' + e); }
  });
}
