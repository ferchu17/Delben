/* ============================================================
   INFORME DE NOVEDADES — Backend (Google Apps Script)
   Se publica como "Aplicación web" y la app (GitHub Pages) lo
   llama por fetch/POST. Todo responde JSON.
   ============================================================ */

const CONFIG = {
  SPREADSHEET_ID: '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY',
  HOJA_INFORMES:  'informes_novedades',
  HOJA_USUARIOS:  'Usuarios y contraseñas',
  HOJA_quienRetira: 'quienRetira',
  HOJA_OBJETIVOS: 'objetivos',

  // Se identifican por el gid de la URL (…/edit?gid=XXXX), así no importa cómo se llame la pestaña.
  USUARIOS_GID:  310678371,    // encabezados: id | nombre | usuario | password | rol | correo
  OBJETIVOS_GID: 1642036355,   // encabezados: id | nombre | dir | localidad | jurisdiccion | empresa
  CARPETA_ID:     '1NXkehdUKNsGKs_yjyfzHev82v_cBH9jz',   // carpeta de Drive donde se guardan los PDF

  // Opcional: si lo completás, la app tiene que mandar el mismo valor (js/config.js → TOKEN)
  TOKEN: '',

  // Si la detección automática de columnas falla, poné acá el nombre EXACTO del encabezado
  USUARIOS_COL_NOMBRE: '',   // ej: 'Nombre y apellido'
  USUARIOS_COL_EMAIL:  '',   // ej: 'Correo'
  OBJETIVOS_COL_NOMBRE: '',  // ej: 'Objetivo'
  OBJETIVOS_COL_EMAIL:  '',  // ej: 'Mail'
  QUIENRETIRA_COL_NOMBRE:  '',  // ej: 'Apellido y nombre'
  QUIENRETIRA_COL_EMPRESA: '',  // ej: 'Empresa'
  QUIENRETIRA_COL_LEGAJO:  '',  // ej: 'Legajo'

  LOGO_APP_ID: '1vP4JEsIwr37oQxkWtBD5bmjvWpetuBCf',   // logo DelBen en Drive

  REMITENTE: 'Informes de Novedades'
};

// Columnas de la hoja informes_novedades (base 0)
// id | informe_N | fecha | de | para | asunto | objetivo | informe | medidas_tomadas | informe (link)
const COL = { ID: 0, NUM: 1, FECHA: 2, DE: 3, PARA: 4, ASUNTO: 5, OBJ: 6, TEXTO: 7, MEDIDAS: 8, LINK: 9 };
const HEADERS = ['id', 'informe_N', 'fecha', 'de', 'para', 'asunto', 'objetivo', 'informe', 'medidas_tomadas', 'informe'];

/* ------------------------- Entradas web ------------------------- */

function doGet(e) {
  // Diagnóstico y prueba de lectura: abrir /exec?action=listas debe devolver JSON.
  try {
    const action = e && e.parameter && e.parameter.action;
    if (action === 'listas') return json_(listas_());
    if (action === 'logo') return json_(logo_());
    return json_({
      ok: true,
      msg: 'API Informe de Novedades funcionando',
      version: '2026-10-15-post-json',
      pruebaPost: 'Enviar POST JSON con action=listas'
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'La petición POST llegó vacía. Se esperaba un cuerpo JSON.' });
    }
    const req = JSON.parse(e.postData.contents);
    if (!req || typeof req !== 'object' || Array.isArray(req)) {
      return json_({ ok: false, error: 'El cuerpo recibido no es un objeto JSON.' });
    }
    if (CONFIG.TOKEN && req.token !== CONFIG.TOKEN) return json_({ ok: false, error: 'No autorizado' });
    switch (req.action) {
      case 'logo':       return json_(logo_());
      case 'listas':     return json_(listas_());
      case 'reservar':   return json_(reservar_(req));
      case 'finalizar':  return json_(finalizar_(req));
      case 'buscar':     return json_(buscar_(req));
      case 'pdf':        return json_(obtenerPdf_(req));
      case 'reenviar':   return json_(reenviar_(req));
      default:           return json_({ ok: false, error: 'Acción desconocida: ' + String(req.action || '(vacía)') });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function logo_() {
  const b = DriveApp.getFileById(CONFIG.LOGO_APP_ID).getBlob();
  return { ok: true, src: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}

// Cada lista se lee por separado: si una falla, las otras (y el N° siguiente) siguen llegando.
function listas_() {
  const out = { ok: true, errores: [] };
  const intentar = function (clave, fn, vacio) {
    try { out[clave] = fn(); }
    catch (e) { out[clave] = vacio; out.errores.push(clave + ': ' + (e && e.message || e)); }
  };
  intentar('usuarios',    leerUsuarios_,    []);
  intentar('quienRetira', leerquienRetir_,  []);
  intentar('objetivos',   leerObjetivos_,   []);
  intentar('siguiente',   siguienteNumero_, '0001');
  return out;
}

/* ------------------------- Hojas y listas ------------------------- */

function ss_() { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }

function hojaInformes_() {
  const ss = ss_();
  let sh = ss.getSheetByName(CONFIG.HOJA_INFORMES);
  if (!sh) sh = ss.insertSheet(CONFIG.HOJA_INFORMES);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  return sh;
}

function norm_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// Busca la fila de encabezados (entre las primeras 5) y devuelve {rows, head, headerRow}
function hojaPor_(nombreHoja, gid) {
  const ss = ss_();
  let sh = null;
  if (gid) sh = ss.getSheets().find(s => s.getSheetId() === Number(gid)) || null;
  if (!sh && nombreHoja) sh = ss.getSheetByName(nombreHoja);
  if (!sh) throw new Error('No existe la pestaña "' + nombreHoja + '" (gid ' + gid + ')');
  return sh;
}

function tabla_(nombreHoja, gid) {
  const sh = hojaPor_(nombreHoja, gid);
  const vals = sh.getDataRange().getValues();
  let h = 0;
  for (let i = 0; i < Math.min(5, vals.length); i++) {
    if (vals[i].some(c => /mail|correo|nombre|objetivo|servicio/.test(norm_(c)))) { h = i; break; }
  }
  return { head: vals[h].map(norm_), headRaw: vals[h], rows: vals.slice(h + 1) };
}

function idx_(head, exacto, regex) {
  if (exacto) { const i = head.indexOf(norm_(exacto)); if (i >= 0) return i; }
  for (let i = 0; i < head.length; i++) if (regex.test(head[i])) return i;
  return -1;
}

// IMPORTANTE: nunca se devuelve ninguna columna de contraseña, solo nombre y correo.
function leerUsuarios_() {
  const t = tabla_(CONFIG.HOJA_USUARIOS, CONFIG.USUARIOS_GID);
  const iMail = idx_(t.head, CONFIG.USUARIOS_COL_EMAIL, /mail|correo/);
  let iFull = idx_(t.head, CONFIG.USUARIOS_COL_NOMBRE, /nombre\s*y\s*apellido|apellido\s*y\s*nombre|nombre completo|^persona$/);
  let iNom = -1, iApe = -1;
  if (iFull < 0) { iNom = idx_(t.head, '', /^nombres?$/); iApe = idx_(t.head, '', /^apellidos?$/); }
  if (iFull < 0 && iNom < 0) iFull = idx_(t.head, '', /nombre|apellido/);
  if (iFull < 0 && iNom < 0) iFull = idx_(t.head, '', /usuario/);
  const out = [], seen = {};
  t.rows.forEach(r => {
    let nombre = iFull >= 0 ? r[iFull] : [r[iNom], iApe >= 0 ? r[iApe] : ''].join(' ');
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre || seen[norm_(nombre)]) return;
    seen[norm_(nombre)] = 1;
    out.push({ nombre: nombre, email: iMail >= 0 ? String(r[iMail] || '').trim() : '' });
  });
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Lista del campo "De" y del personal (vigiladores): pestaña "quienRetira".
// Devuelve { nombre, empresa, legajo }.
function leerquienRetir_() {
  const ss = ss_();
  const esperado = norm_(CONFIG.HOJA_quienRetira).replace(/\s+/g, '');

  // Acepta "quienRetira" o "quien retira", sin distinguir mayúsculas ni tildes.
  const sh = ss.getSheets().find(s => norm_(s.getName()).replace(/\s+/g, '') === esperado);
  if (!sh) {
    throw new Error('No se encontró la pestaña "' + CONFIG.HOJA_quienRetira + '" en la planilla. Verificá el nombre de la hoja.');
  }

  const vals = sh.getDataRange().getDisplayValues();
  if (!vals.length) return [];

  const reNombre = /^(nombre|nombres|apellido y nombre|apellidos y nombres|nombre y apellido|nombre completo|quienretira|quien retira|personal|empleado|vigilador|persona)$/;
  let headerRow = 0, colNombre = -1;

  for (let r = 0; r < Math.min(5, vals.length); r++) {
    const heads = vals[r].map(norm_);
    let c = -1;
    if (CONFIG.QUIENRETIRA_COL_NOMBRE) c = heads.indexOf(norm_(CONFIG.QUIENRETIRA_COL_NOMBRE));
    if (c < 0) c = heads.findIndex(h => reNombre.test(h));
    if (c >= 0) { headerRow = r; colNombre = c; break; }
  }
  if (colNombre < 0) {
    headerRow = 0;
    colNombre = vals[0].findIndex(v => String(v || '').trim() !== '');
    if (colNombre < 0) colNombre = 0;
  }

  const heads = vals[headerRow].map(norm_);
  let colEmpresa = CONFIG.QUIENRETIRA_COL_EMPRESA ? heads.indexOf(norm_(CONFIG.QUIENRETIRA_COL_EMPRESA)) : -1;
  if (colEmpresa < 0) colEmpresa = heads.findIndex(h => /empresa|razon social|firma/.test(h));
  let colLegajo = CONFIG.QUIENRETIRA_COL_LEGAJO ? heads.indexOf(norm_(CONFIG.QUIENRETIRA_COL_LEGAJO)) : -1;
  if (colLegajo < 0) colLegajo = heads.findIndex(h => /legajo|^leg\.?$|n.*legajo/.test(h));

  const vistos = {}, out = [];
  vals.slice(headerRow + 1).forEach(row => {
    const nombre = String(row[colNombre] || '').replace(/\s+/g, ' ').trim();
    const clave = norm_(nombre);
    if (!nombre || /^(nombre|nombres|apellido|personal|empleado|vigilador|persona)$/.test(clave)) return;
    // Clave única: nombre + legajo, así dos "Martínez" distintos no se pisan.
    const legajo = colLegajo >= 0 ? String(row[colLegajo] || '').trim() : '';
    const k = clave + '|' + legajo;
    if (vistos[k]) return;
    vistos[k] = true;
    out.push({
      nombre: nombre,
      empresa: colEmpresa >= 0 ? String(row[colEmpresa] || '').trim() : '',
      legajo: legajo
    });
  });
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

function leerObjetivos_() {
  const t = tabla_(CONFIG.HOJA_OBJETIVOS, CONFIG.OBJETIVOS_GID);
  const iMail = idx_(t.head, CONFIG.OBJETIVOS_COL_EMAIL, /mail|correo/);
  const iNom = idx_(t.head, CONFIG.OBJETIVOS_COL_NOMBRE, /objetivo|servicio|nombre|puesto|cliente/);
  const col = iNom >= 0 ? iNom : 0;
  const out = [], seen = {};
  t.rows.forEach(r => {
    const nombre = String(r[col] || '').replace(/\s+/g, ' ').trim();
    if (!nombre || seen[norm_(nombre)]) return;
    seen[norm_(nombre)] = 1;
    out.push({ nombre: nombre, email: iMail >= 0 ? String(r[iMail] || '').trim() : '' });
  });
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* ------------------------- Numeración ------------------------- */

function pad_(n, l) { n = String(n); while (n.length < l) n = '0' + n; return n; }

function siguienteNumero_() {
  const sh = hojaInformes_();
  const last = sh.getLastRow();
  let maxN = 0;
  if (last > 1) sh.getRange(2, COL.NUM + 1, last - 1, 1).getValues()
    .forEach(r => { maxN = Math.max(maxN, parseInt(String(r[0]).replace(/\D/g, ''), 10) || 0); });
  return pad_(maxN + 1, 4);
}

/* ------------------------- Guardado en 2 pasos -------------------------
   1) reservar: asigna el N° (con candado, sin duplicados) y escribe la fila.
   2) finalizar: recibe el PDF ya armado con ese N°, lo guarda en Drive,
      completa el link en la hoja y envía los mails.
-------------------------------------------------------------------- */

function reservar_(req) {
  const d = req.data || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hojaInformes_();
    const last = sh.getLastRow();
    let maxId = 0, maxN = 0;
    if (last > 1) sh.getRange(2, 1, last - 1, 2).getValues().forEach(r => {
      maxId = Math.max(maxId, Number(r[COL.ID]) || 0);
      maxN = Math.max(maxN, parseInt(String(r[COL.NUM]).replace(/\D/g, ''), 10) || 0);
    });
    const id = maxId + 1, num = pad_(maxN + 1, 4), row = last + 1;
    sh.getRange(row, COL.NUM + 1).setNumberFormat('@');
    sh.getRange(row, COL.FECHA + 1).setNumberFormat('@');
    sh.getRange(row, 1, 1, HEADERS.length).setValues([[
      id, num, d.fecha || '', d.de || '', (d.para || []).join('; '),
      d.asunto || '', d.objetivo || '', d.informe || '', d.medidas || '', ''
    ]]);
    SpreadsheetApp.flush();
    return { ok: true, id: id, numero: num };
  } finally {
    lock.releaseLock();
  }
}

function buscarFila_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function slug_(s) {
  return norm_(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

function finalizar_(req) {
  const sh = hojaInformes_();
  const row = buscarFila_(sh, req.id);
  if (row < 0) throw new Error('No se encontró el informe reservado');
  const vals = sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  const num = String(vals[COL.NUM]);
  const nombre = 'Informe_de_Novedades_' + num + (slug_(vals[COL.ASUNTO]) ? '_' + slug_(vals[COL.ASUNTO]) : '') + '.pdf';

  let url = String(vals[COL.LINK] || '');
  let file;
  if (url) {
    file = DriveApp.getFileById(idDeUrl_(url));              // reintento: se reutiliza el PDF
  } else {
    const blob = Utilities.newBlob(Utilities.base64Decode(req.pdfBase64), 'application/pdf', nombre);
    file = DriveApp.getFolderById(CONFIG.CARPETA_ID).createFile(blob);
    url = file.getUrl();
    sh.getRange(row, COL.LINK + 1).setValue(url);
  }
  const enviados = enviarMail_(file.getBlob().setName(nombre), num, vals[COL.ASUNTO], vals[COL.DE], req.to, req.cc, vals[COL.OBJ]);
  return { ok: true, id: req.id, numero: num, url: url, enviados: enviados };
}

/* ------------------------- Mail ------------------------- */

function emailsValidos_(arr) {
  return [].concat.apply([], (arr || []).map(s => String(s || '').split(/[;,\s]+/))).map(s => s.trim()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    .filter((s, i, a) => a.indexOf(s) === i);
}

function enviarMail_(blob, num, asunto, de, to, cc, objetivo) {
  to = emailsValidos_(to);
  cc = emailsValidos_(cc).filter(e => to.indexOf(e) < 0);
  if (!to.length) throw new Error('No hay destinatarios con correo válido');
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:560px;border:1px solid #e3e8e5;border-radius:12px;overflow:hidden">' +
    '<div style="height:6px;background:linear-gradient(90deg,#1fa364,#0e86a8,#f5821f,#d7263d)"></div>' +
    '<div style="padding:20px 24px;color:#1b2a2f">' +
    '<h2 style="margin:0 0 4px;color:#0b6e4f">Informe de Novedades N° ' + num + '</h2>' +
    '<p style="margin:0 0 14px;color:#5b6b70">Adjunto en PDF</p>' +
    '<table style="font-size:14px;border-collapse:collapse">' +
    '<tr><td style="padding:3px 12px 3px 0;color:#5b6b70">De</td><td><b>' + esc_(de) + '</b></td></tr>' +
    '<tr><td style="padding:3px 12px 3px 0;color:#5b6b70">Asunto</td><td><b>' + esc_(asunto) + '</b></td></tr>' +
    '<tr><td style="padding:3px 12px 3px 0;color:#5b6b70">Objetivo</td><td><b>' + esc_(objetivo) + '</b></td></tr></table>' +
    '</div></div>';
  MailApp.sendEmail({
    to: to.join(','), cc: cc.join(','), name: CONFIG.REMITENTE,
    subject: 'Informe de Novedades N° ' + num + ' - ' + asunto,
    htmlBody: html, attachments: [blob]
  });
  return { to: to, cc: cc };
}

function esc_(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function idDeUrl_(url) {
  const m = String(url).match(/[-\w]{25,}/);
  if (!m) throw new Error('Link de Drive inválido');
  return m[0];
}

/* ------------------------- Buscador ------------------------- */

function fechaTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
  return String(v || '');
}

function fechaNum_(txt) {            // 'dd/mm/yyyy' -> yyyymmdd
  const m = String(txt).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}

function buscar_(req) {
  const sh = hojaInformes_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, items: [] };
  const vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const tokens = norm_(req.q || '').split(/\s+/).filter(Boolean);
  const desde = req.desde ? Number(String(req.desde).replace(/-/g, '')) : 0;   // 'yyyy-mm-dd'
  const hasta = req.hasta ? Number(String(req.hasta).replace(/-/g, '')) : 99999999;
  const items = [];
  vals.forEach(r => {
    if (!r[COL.ID]) return;
    const f = fechaTxt_(r[COL.FECHA]), fn = fechaNum_(f);
    if (fn && (fn < desde || fn > hasta)) return;
    const hay = norm_([r[COL.NUM], f, r[COL.DE], r[COL.PARA], r[COL.ASUNTO], r[COL.OBJ], r[COL.TEXTO], r[COL.MEDIDAS]].join(' '));
    if (!tokens.every(t => hay.indexOf(t) >= 0)) return;
    items.push({
      id: r[COL.ID], numero: String(r[COL.NUM]), fecha: f, de: r[COL.DE], para: r[COL.PARA],
      asunto: r[COL.ASUNTO], objetivo: r[COL.OBJ], informe: r[COL.TEXTO], medidas: r[COL.MEDIDAS],
      link: String(r[COL.LINK] || '')
    });
  });
  items.sort((a, b) => Number(b.id) - Number(a.id));
  return { ok: true, items: items.slice(0, 150), total: items.length };
}

function filaPorId_(id) {
  const sh = hojaInformes_();
  const row = buscarFila_(sh, id);
  if (row < 0) throw new Error('Informe no encontrado');
  return sh.getRange(row, 1, 1, HEADERS.length).getValues()[0];
}

function obtenerPdf_(req) {
  const r = filaPorId_(req.id);
  if (!r[COL.LINK]) throw new Error('Este informe todavía no tiene PDF');
  const f = DriveApp.getFileById(idDeUrl_(r[COL.LINK]));
  return { ok: true, base64: Utilities.base64Encode(f.getBlob().getBytes()), nombre: f.getName(), url: String(r[COL.LINK]) };
}

function reenviar_(req) {
  const r = filaPorId_(req.id);
  if (!r[COL.LINK]) throw new Error('Este informe todavía no tiene PDF');
  const f = DriveApp.getFileById(idDeUrl_(r[COL.LINK]));
  const env = enviarMail_(f.getBlob(), String(r[COL.NUM]), r[COL.ASUNTO], r[COL.DE], req.to, req.cc, r[COL.OBJ]);
  return { ok: true, enviados: env };
}

/* ------------------------- Utilidad de prueba -------------------------
   Ejecutala una vez desde el editor para aceptar los permisos y ver las listas. */
function probarListas() {
  Logger.log('Encabezados usuarios: ' + JSON.stringify(tabla_(CONFIG.HOJA_USUARIOS, CONFIG.USUARIOS_GID).headRaw.filter(h => !/contrase|clave|pass/i.test(h))));
  Logger.log('Encabezados objetivos: ' + JSON.stringify(tabla_(CONFIG.HOJA_OBJETIVOS, CONFIG.OBJETIVOS_GID).headRaw));
  Logger.log(JSON.stringify({
    usuarios: leerUsuarios_().slice(0, 5),
    quienRetira: leerquienRetir_().slice(0, 5),
    objetivos: leerObjetivos_().slice(0, 5),
    siguiente: siguienteNumero_()
  }, null, 2));
}
