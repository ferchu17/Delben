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
      cambiarEstadoRendicion: cambiarEstadoRendicion, guardarClaveGemini: guardarClaveGemini, responderPedido: responderPedido
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
  SpreadsheetApp.openById(CFG.REG_ID).getName();
  SpreadsheetApp.openById(CFG.STOCK_ID).getName();
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

function getUsuarios_() {
  const sh = SpreadsheetApp.openById(CFG.STOCK_ID).getSheetByName(CFG.HOJA_USUARIOS);
  return readSheet_(sh).rows.filter(r => String(r.usuario || '').trim());
}

function getSupervisores_() {
  return getUsuarios_()
    .filter(u => CFG.ROLES_CON_FONDO.indexOf(rolApp_(u.rol)) >= 0 && String(u.nombre || '').trim())
    .map(u => ({ nombre: String(u.nombre).trim(), correo: primerCorreo_(u.correo), rol: String(u.rol) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function getObjetivos_() {
  const sh = SpreadsheetApp.openById(CFG.STOCK_ID).getSheetByName(CFG.HOJA_OBJETIVOS);
  const lista = readSheet_(sh).rows
    .filter(r => String(r.nombre || '').trim())
    .filter(r => !/^\s*baja/i.test(String(r.anotaciones || '')))
    .map(r => String(r.nombre).trim());
  return Array.from(new Set(lista)).sort((a, b) => a.localeCompare(b));
}

function regSheet_(name) {
  const sh = SpreadsheetApp.openById(CFG.REG_ID).getSheetByName(name);
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

function calcularSaldos_(asig, tickets) {
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
  Object.keys(m).forEach(k => { m[k].saldo = round2_(m[k].asignado - m[k].consumido); });
  return m;
}

/* ======================= SUPERVISOR ======================= */

function getSupervisorData(token, como) {
  const s = sesRinde_(token, como);
  const asig = readSheet_(regSheet_('Asignaciones')).rows.filter(a => norm_(a.Supervisor) === norm_(s.nombre));
  const tks = readSheet_(regSheet_('Tickets')).rows.filter(t => norm_(t.Supervisor) === norm_(s.nombre));
  const sal = calcularSaldos_(asig, tks)[norm_(s.nombre)] || { asignado: 0, consumido: 0, saldo: 0, sinRendir: 0, cantSinRendir: 0 };
  const rend = readSheet_(regSheet_('Rendiciones')).rows
    .filter(r => norm_(r.Supervisor) === norm_(s.nombre))
    .map(r => {
      const nro = String(r['N° Planilla']);
      const tk = tks.filter(t => String(t['N° Planilla']) === nro && String(t.Estado) !== 'Rechazado');
      return {
        nro: r['N° Planilla'], fecha: fmtD_(r.Fecha), estado: String(r.Estado || ''),
        cant: tk.length, total: round2_(tk.reduce((a, t) => a + num_(t['Total con IVA']), 0))
      };
    });
  return {
    saldo: sal,
    asignaciones: asig.map(asigOut_).reverse(),
    tickets: tks.map(ticketOut_).reverse(),
    rendiciones: rend.reverse(),
    pedidos: leerPedidos_().filter(p => norm_(p.supervisor) === norm_(s.nombre)).slice(0, 10),
    objetivos: getObjetivos_()
  };
}

/**
 * Lee el ticket y devuelve los datos para confirmar.
 * - Si hay clave de Gemini (GEMINI_API_KEY) usa Gemini, que también lee lo escrito a mano.
 * - Si no hay clave o Gemini falla, usa la lectura de texto (OCR) de Google Drive, que no necesita clave.
 */
function leerTicket(token, dataUrl) {
  ses_(token);
  const opciones = [CFG.SUPERVISOR_LABEL].concat(getObjetivos_());
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
    'Reglas: "total" es el TOTAL final pagado con IVA e impuestos incluidos. En los tickets argentinos la coma es decimal y el punto separa miles: ' +
    'devolvé los números con punto decimal y sin separador de miles (ej 45956.19). Si un dato no se lee, poné null. No inventes datos.\n' +
    '"servicio": el supervisor suele escribir A MANO sobre el ticket a qué servicio corresponde la carga (ej. "Fincas", "San Francisco", "Laguna"). ' +
    'Si hay una anotación así, devolvé la opción de esta lista que corresponda, copiada exactamente igual: ' + JSON.stringify(opciones) +
    '. Si dice supervisor o propio, devolvé "' + CFG.SUPERVISOR_LABEL + '". Si no hay anotación a mano o no coincide claramente con ninguna, devolvé null.';
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

  let total = 0;
  for (let i = 0; i < lineas.length && !total; i++) {
    const l = lineas[i];
    if (/^TOTAL\b/i.test(l) && !/OTROS|TRIBUT|SUB/i.test(l)) {
      let mm = l.match(/(\d[\d.]*[.,]\d{2})\s*$/);
      if (!mm && lineas[i + 1]) mm = lineas[i + 1].match(/^\$?\s*(\d[\d.]*[.,]\d{2})\s*$/);
      if (mm) total = num_(mm[1]);
    }
  }
  if (!total) {
    const nums = (t.match(/\b\d{1,3}(?:\.\d{3})+,\d{2}\b|\b\d+,\d{2}\b/g) || []).map(num_).filter(n => n >= 500 && n < 20000000);
    if (nums.length) total = Math.max.apply(null, nums);
  }
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
  return Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes());
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
  const sal = calcularSaldos_(asig, tks);
  const saldos = sups.map(u => sal[norm_(u.nombre)] || { nombre: u.nombre, asignado: 0, consumido: 0, saldo: 0, sinRendir: 0, cantSinRendir: 0 });
  Object.keys(sal).forEach(k => { if (!saldos.some(x => norm_(x.nombre) === k)) saldos.push(sal[k]); });
  return {
    readOnly: s.rol !== 'admin',
    geminiActiva: !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),
    supervisores: sups,
    objetivos: getObjetivos_(),
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

function generarArchivos_(nro, supervisor, tickets, fecha) {
  const folder = DriveApp.getFolderById(CFG.FOLDER_ID);
  const fechaTxt = Utilities.formatDate(fecha, CFG.TZ, 'dd-MM-yyyy');
  const nombre = 'Rendicion Combustible N° ' + nro + ' - ' + supervisor + ' - ' + fechaTxt;
  const copia = DriveApp.getFileById(CFG.TEMPLATE_ID).makeCopy(nombre, folder);
  const ss = SpreadsheetApp.openById(copia.getId());
  try {
    const sh = ss.getSheets()[0];

    // Logo KTL arriba a la derecha (columna H)
    try {
      const img = sh.insertImage(DriveApp.getFileById(CFG.LOGO_KTL_ID).getBlob(), 8, 1, 6, 8);
      const h = 70;
      img.setHeight(h).setWidth(Math.round(h * img.getWidth() / img.getHeight()));
    } catch (e) { console.error('Logo KTL: ' + e); }

    sh.getRange('C6').setValue(fecha).setNumberFormat('dd/MM/yyyy');
    sh.getRange('G6').setValue(nro);
    sh.getRange('C8').setValue(supervisor);

    // Filas extra si hay más de 9 tickets (se insertan antes de la última fila de la tabla)
    const extra = Math.max(0, tickets.length - CFG.FILAS_PLANILLA);
    const ultimaTabla = CFG.FILA_INICIO + CFG.FILAS_PLANILLA - 1; // 27
    if (extra > 0) {
      sh.insertRowsAfter(ultimaTabla - 1, extra);
      const alto = sh.getRowHeight(ultimaTabla - 1);
      for (let i = 0; i < extra; i++) {
        const r = ultimaTabla + i;
        sh.getRange(ultimaTabla - 1, 1, 1, 9).copyTo(sh.getRange(r, 1, 1, 9), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        sh.setRowHeight(r, alto);
        try { sh.getRange(r, 6, 1, 2).merge(); } catch (e) {}
      }
    }

    const vals = tickets.map(t => [
      'Combustible',
      t['Fecha ticket'] instanceof Date ? t['Fecha ticket'] : dateFromAny_(t['Fecha ticket']),
      String(t['N° Comprobante'] || ''),
      String(t.Proveedor || ''),
      String(t['Corresponde a'] || ''),
      '',
      num_(t['Total con IVA'])
    ]);
    if (vals.length) {
      sh.getRange(CFG.FILA_INICIO, 4, vals.length, 1).setNumberFormat('@');
      sh.getRange(CFG.FILA_INICIO, 2, vals.length, 7).setValues(vals);
      sh.getRange(CFG.FILA_INICIO, 3, vals.length, 1).setNumberFormat('dd/MM/yyyy');
    }
    // Nombre del empleado sobre la firma (B33 en la plantilla)
    sh.getRange(33 + extra, 2).setValue(supervisor);
    SpreadsheetApp.flush();

    // Excel (solo la planilla)
    const token = ScriptApp.getOAuthToken();
    const xlsx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + token } }).getBlob().setName(nombre + '.xlsx');
    const xlsxFile = folder.createFile(xlsx);

    // Hoja de comprobantes con las fotos (solo para el PDF)
    agregarComprobantes_(ss, nro, supervisor, tickets);
    SpreadsheetApp.flush();

    const q = 'format=pdf&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false' +
      '&pagenum=UNDEFINED&fzr=false&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4&horizontal_alignment=CENTER';
    const pdf = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' + q,
      { headers: { Authorization: 'Bearer ' + token } }).getBlob().setName(nombre + '.pdf');
    const pdfFile = folder.createFile(pdf);

    return { xlsxUrl: xlsxFile.getUrl(), pdfUrl: pdfFile.getUrl(), pdfBlob: pdf };
  } finally {
    try { copia.setTrashed(true); } catch (e) {}
  }
}

function agregarComprobantes_(ss, nro, supervisor, tickets) {
  const sh = ss.insertSheet('COMPROBANTES');
  const maxC = sh.getMaxColumns();
  if (maxC > 5) sh.deleteColumns(6, maxC - 5);
  sh.setColumnWidth(1, 12); sh.setColumnWidth(2, 370); sh.setColumnWidth(3, 16); sh.setColumnWidth(4, 370); sh.setColumnWidth(5, 12);
  sh.getRange('B1:D1').merge().setValue('COMPROBANTES - PLANILLA N° ' + nro + ' - ' + supervisor)
    .setFontFamily('Arial').setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);
  const filasNec = 1 + Math.ceil(tickets.length / 2) * 2;
  if (sh.getMaxRows() < filasNec + 1) sh.insertRowsAfter(sh.getMaxRows(), filasNec + 1 - sh.getMaxRows());

  tickets.forEach((t, i) => {
    const col = (i % 2 === 0) ? 2 : 4;
    const rCap = 2 + Math.floor(i / 2) * 2;
    const rImg = rCap + 1;
    // Una fila de 2 tickets por hoja A4 vertical (la fila de la foto ocupa casi toda la hoja)
    sh.setRowHeight(rCap, 40);
    sh.setRowHeight(rImg, 980);
    const cap = '#' + (i + 1) + ' · ' + fmtD_(t['Fecha ticket']) + ' · N° ' + t['N° Comprobante'] +
      '\n' + t['Corresponde a'] + ' · ' + money_(num_(t['Total con IVA']));
    sh.getRange(rCap, col).setValue(cap).setFontFamily('Arial').setFontSize(9).setFontWeight('bold')
      .setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBorder(true, true, false, true, false, false);
    sh.getRange(rImg, col).setBorder(false, true, true, true, false, false);
    sh.getRange(rImg, 5).setValue('.').setFontColor('#ffffff'); // asegura que la fila entre en el PDF
    const fid = driveId_(t['Link Foto']);
    if (!fid) return;
    try {
      const img = sh.insertImage(DriveApp.getFileById(fid).getBlob(), col, rImg, 5, 5);
      const w = img.getWidth(), h = img.getHeight();
      const k = Math.min(360 / w, 968 / h);
      img.setWidth(Math.round(w * k)).setHeight(Math.round(h * k));
      img.setAnchorCellXOffset(Math.max(5, Math.round((370 - w * k) / 2)));
    } catch (e) {
      sh.getRange(rImg, col).setValue('No se pudo insertar la foto: ' + e.message).setWrap(true);
    }
  });
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
  const objs = getObjetivos_().map(norm_);
  const ca = norm_(t.correspondeA);
  if (ca !== norm_(CFG.SUPERVISOR_LABEL) && objs.indexOf(ca) < 0) throw new Error('"Corresponde a" tiene que ser un servicio de la lista o SUPERVISOR.');
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
function fmtD_(v) { return v instanceof Date ? Utilities.formatDate(v, CFG.TZ, 'dd/MM/yyyy') : String(v || ''); }
function fmtDT_(v) { return v instanceof Date ? Utilities.formatDate(v, CFG.TZ, 'dd/MM/yyyy HH:mm') : String(v || ''); }

/* ======================= PEDIDOS DE FONDOS ======================= */

const HOJA_PEDIDOS = 'Pedidos';
const COLS_PEDIDOS = ['ID', 'Fecha', 'Supervisor', 'Monto', 'Motivo', 'Estado', 'Respuesta', 'Fecha respuesta', 'Atendido por'];

/** Pestaña "Pedidos" de la planilla de registros (se crea sola la primera vez). */
function hojaPedidos_() {
  const ss = SpreadsheetApp.openById(CFG.REG_ID);
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
  const sal = calcularSaldos_(asig, tks)[norm_(s.nombre)] || { saldo: 0, sinRendir: 0, cantSinRendir: 0 };
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
 * (Esta función hace lo mismo, pero necesita agregar el permiso script.scriptapp en appsscript.json.)
 */
function instalarRecordatorio() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'recordatorioSemanal')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('recordatorioSemanal').timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).inTimezone(CFG.TZ).create();
  Logger.log('Recordatorio instalado: todos los lunes a las 8.');
}

/**
 * Mail de los lunes: le recuerda que envíe la rendición SOLO a las personas de la pestaña "quienRetira"
 * de Stock Manager que tienen "SI" en la columna "correo de combustible" (columna E), al correo de esa fila.
 * Incluye su disponible y lo que tiene sin rendir.
 */
function recordatorioSemanal() {
  const sh = SpreadsheetApp.openById(CFG.STOCK_ID).getSheetByName('quienRetira');
  if (!sh) throw new Error('No existe la pestaña "quienRetira" en Stock Manager.');
  const t = readSheet_(sh);
  const colSi = t.headers.find(h => norm_(h) === 'correo de combustible') || t.headers[4];
  const destinatarios = t.rows
    .filter(r => norm_(r[colSi]) === 'si' && String(r.nombre || '').trim() && primerCorreo_(r.correo))
    .map(r => ({ nombre: String(r.nombre).trim().replace(/\s+/g, ' '), correo: primerCorreo_(r.correo) }));
  if (!destinatarios.length) return;

  const asig = readSheet_(regSheet_('Asignaciones')).rows;
  const tks = readSheet_(regSheet_('Tickets')).rows;
  const sal = calcularSaldos_(asig, tks);
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
