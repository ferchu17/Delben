/**
 * ============================================================
 * HISTÓRICO (desde abril 2023)
 * ============================================================
 * Recorre las carpetas de Drive de cada período, busca el archivo
 * "Novedades del Personal ... .xlsx" y pasa su pestaña STD a la planilla
 * de la app (una fila por persona y servicio, con los días).
 *   - D y N de cada día se vuelven a armar como horas con su color:
 *     N = 0 -> blanco · 15/9 o 24 h -> blanco · 7/1 -> celeste (tarde) · resto con nocturnas -> gris.
 *   - Los códigos (F, VAC, ENF, ...) quedan igual.
 *   - Puesto con "Retén" o "Instrucción" va a la sección de abajo.
 *   - El servicio se busca por el nombre del cliente; si no existe, se crea dado de baja.
 * Un período que ya tiene datos cargados en la app NO se toca.
 * Se procesa de a tandas (unos 4 minutos por vez): se vuelve a tocar el botón hasta que termina.
 *
 * ARCHIVO HISTÓRICO (v1.16)
 * Todo lo histórico se guarda en una planilla de Google aparte, que la app crea sola:
 * "Novedades del Personal - Archivo histórico" (carpeta "Novedades del Personal").
 *   - Una pestaña por año ("Hist 2023", "Hist 2024", ...) con las mismas columnas que la planilla.
 *   - Pestaña "Archivos": cada Excel que se subió, con enlace al original.
 *   - Los Excel originales quedan tal cual en la subcarpeta de "Novedades del Personal" que corresponde a su tipo.
 * Al consultar un período viejo solo se lee ese período (no toda la hoja), así que es rápido.
 * Los informes de un período viejo se arman con los modelos de la empresa, igual que los actuales.
 * ============================================================
 */

var HISTORICO_CARPETAS_POR_DEFECTO = ['1O2D3GxYR1VCX-IFt3IF9YI5QWNciVn1G']; // Presentismos 25 abril 2023 al Julio 2025

function carpetasHistorico_() {
  var v = String(config_().HIST_CARPETAS || '').trim();
  var ids = v ? v.split(/[\s,;]+/).map(function (x) { var m = x.match(/folders\/([a-zA-Z0-9_-]+)/); return m ? m[1] : x; }).filter(Boolean) : HISTORICO_CARPETAS_POR_DEFECTO;
  return ids;
}

// Lista (recursiva) de TODOS los archivos de las carpetas del histórico (Excel, planillas de Google y PDF),
// con el nombre de la carpeta donde están (de ahí sale el período: "40- Julio - Agosto 2026").
function archivosHistorico_(errores) {
  var out = [];
  var recorrer = function (carpeta, nivel) {
    var fs = carpeta.getFiles();
    while (fs.hasNext()) {
      var f = fs.next(), nom = f.getName(), mime = f.getMimeType();
      if (/\.(xls[xmb]?|csv|pdf)$/i.test(nom) || /spreadsheet|excel|pdf/i.test(mime)) out.push({ id: f.getId(), nombre: nom, carpeta: carpeta.getName() });
    }
    if (nivel > 3) return;
    var sub = carpeta.getFolders();
    while (sub.hasNext()) recorrer(sub.next(), nivel + 1);
  };
  carpetasHistorico_().forEach(function (id) {
    try { recorrer(DriveApp.getFolderById(id), 0); }
    catch (e) { if (errores) errores.push('No se pudo leer la carpeta ' + id + ': ' + e.message); }
  });
  return out;
}

/* ---------------- tipo y período de cada archivo ---------------- */

var TIPOS_ARCHIVO_ = [
  ['Novedades del Personal', /NOVEDADES DEL PERSONAL/],
  ['Planificación', /PLANIFICACION/],
  ['Horas Contratadas vs Realizadas', /HORAS CONTRATADAS|CONTRATADAS VS/],
  ['Conformación horaria', /CONFORMACION/],
  ['Proyección', /PROYECCION|PROGRAMACION/],
  ['Facturación', /FACTURACION|FACTURADAS/],
  ['Consolidado', /CONSOLIDADO/],
  ['STD', /\bSTD\b/],
  ['30/31 días', /\b3[01] ?DIAS\b/],
  ['Plus', /\bPLUS\b/],
  ['Presentismo', /PRESENTISMO/],
  ['Injustificados y Licencias', /INJUSTIFICADO|LICENCIA/]
];
function tipoArchivo_(nombre) {
  var n = normT_(String(nombre || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' '));
  for (var i = 0; i < TIPOS_ARCHIVO_.length; i++) if (TIPOS_ARCHIVO_[i][1].test(n)) return TIPOS_ARCHIVO_[i][0];
  // Planillas de los supervisores: "AGOSTO-SEPTIEMBRE_2026-SCARABETTA_F"
  if (/^(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)[\s_-]+/.test(n)) return 'Planilla de supervisor';
  return 'Otro';
}
var MESES_N_ = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
// Período (AAAA-MM del mes en que empieza, del 26 al 25) a partir de un texto:
// "Julio - Agosto 2026" -> 2026-07 · "AGOSTO-SEPTIEMBRE_2026" -> 2026-08 · "Agosto 26" / "Agosto 2026" -> 2026-07 (el período que termina en agosto).
function periodoDesdeTexto_(t) {
  var n = normT_(t).replace(/SETIEMBRE/g, 'SEPTIEMBRE'), L = MESES_N_.join('|');
  var m = n.match(new RegExp('(' + L + ')[\\s_]*(\\d{4})?[\\s_]*-[\\s_]*(' + L + ')[\\s_-]*(\\d{4})'));
  if (m) {
    var a = MESES_N_.indexOf(m[1]) + 1, b = MESES_N_.indexOf(m[3]) + 1, y = Number(m[4]);
    if (m[2]) y = Number(m[2]); else if (a > b) y--;
    return y + '-' + ('0' + a).slice(-2);
  }
  m = n.match(new RegExp('(' + L + ')[\\s_-]*(\\d{4}|\\d{2})(?!\\d)'));
  if (m) {
    var mm = MESES_N_.indexOf(m[1]) + 1, yy = Number(m[2]); if (yy < 100) yy += 2000;
    mm--; if (mm < 1) { mm = 12; yy--; }
    return yy + '-' + ('0' + mm).slice(-2);
  }
  return '';
}

function convertirTemporal_(id) {
  if (esPlanillaGoogle_(id)) return { ss: SpreadsheetApp.openById(id), temporal: false };
  var resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ mimeType: 'application/vnd.google-apps.spreadsheet', name: 'tmp historico ' + id })
  });
  if (resp.getResponseCode() !== 200) throw new Error('No se pudo leer el archivo ' + id);
  var nid = JSON.parse(resp.getContentText()).id;
  return { ss: SpreadsheetApp.openById(nid), temporal: nid };
}

// Valor de celda de la app a partir de D y N del STD.
function valorDesdeDN_(d, n) {
  var esNum = function (x) { return x !== '' && x !== null && !isNaN(Number(x)); };
  if (!esNum(d)) { var t = String(d || '').trim().toUpperCase(); return t === '0' ? '' : t; }
  var D = Number(d) || 0, N = esNum(n) ? Number(n) : 0, h = D + N;
  if (!h) return '';
  var hs = String(Math.round(h * 2) / 2).replace('.5', '.5');
  if (N === 0 || h >= 24) return hs;
  if (N <= 2 && D >= 5) return hs + 'T';
  return hs + 'N';
}

function periodoDesdeFecha_(d) {
  var y = d.getFullYear(), m = d.getMonth() + 1;
  if (d.getDate() < 26) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + ('0' + m).slice(-2);
}

// Lee la pestaña STD de un archivo y devuelve { periodo, filas: [{Cliente, Empresa, Legajo, Nombre, Puesto, dias[]}] }
function leerSTDHistorico_(ss) {
  var sh = ss.getSheetByName('STD') || ss.getSheets().filter(function (h) { return /STD/i.test(h.getName()); })[0];
  if (!sh) throw new Error('El archivo no tiene pestaña STD.');
  var W = sh.getLastColumn(), R = sh.getLastRow();
  var v = sh.getRange(1, 1, R, W).getValues();
  var hdr = -1;
  for (var r = 3; r < 12 && hdr < 0; r++) for (var c = 0; c < W; c++) if (normT_(v[r][c]) === 'APELLIDO Y NOMBRE') { hdr = r; break; }
  if (hdr < 0) throw new Error('No se encontró la fila de títulos en el STD.');
  var vis = sh.getRange(1, 1, R, W).getDisplayValues();
  var col = {}, dias = [];
  for (var c2 = 0; c2 < W; c2++) {
    var h = normT_(v[hdr][c2]);
    if (h && col[h] === undefined) col[h] = c2;
    if (h === 'D' && normT_(v[hdr][c2 + 1]) === 'N' && dias.length < 31) dias.push(c2);
  }
  var nts = [];
  try { nts = sh.getRange(1, 1, R, W).getNotes(); } catch (e) { nts = []; }
  var primera = null;
  for (var k = 0; k < dias.length && !primera; k++) { var x = v[hdr - 2][dias[k]]; if (x instanceof Date) primera = x; }
  if (!primera) throw new Error('No se encontraron las fechas del período.');
  var periodo = periodoDesdeFecha_(primera);
  var filas = [];
  for (var r2 = hdr + 1; r2 < R; r2++) {
    var fila = v[r2];
    if (/HORAS REALIZ/i.test(String(fila[0]) + String(fila[1]))) break;
    var nom = String(fila[col['APELLIDO Y NOMBRE']] || '').trim();
    if (!nom || nom === '0') continue;
    filas.push({
      Cliente: clienteSTD_(ss, v, vis, r2, col, hdr), Empresa: String(fila[col.EMPRESA] || '').trim(),
      Legajo: String(fila[col.LEGAJO] || '').replace(/\.0$/, '').trim(), Nombre: nom.toUpperCase(), Puesto: String(fila[col.PUESTO] || '').trim(),
      Supervisor: col.SUPERVISOR !== undefined ? String(vis[r2][col.SUPERVISOR] || '').trim() : '',
      dias: dias.map(function (dc) { return valorDesdeDN_(fila[dc], fila[dc + 1]); }),
      notas: dias.map(function (dc) { var nr = nts[r2] || []; return limpiarNotaHist_(nr[dc] || nr[dc + 1] || ''); })
    });
  }
  // v1.22.6: también los comentarios de las pestañas de cada servicio (ahí los ponen los supervisores)
  try { notasPestanasHist_(ss, filas, dias.length); } catch (e) { Logger.log('Comentarios de las pestañas: ' + e.message); }
  return { periodo: periodo, filas: filas };
}

// Texto del comentario sin el nombre de quien lo escribió ("Gerardo Vica:") ni el separador de la app ("|")
function limpiarNotaHist_(t) {
  t = String(t || '').replace(/\r/g, '');
  t = t.replace(/^\s*\[[^\]]*\][^\n]*\n/, '');                // "[Comentario encadenado] ..." de Excel nuevo
  t = t.replace(/^[^\n:]{2,60}:\s*\n/, '');                         // "Autor:\n"
  return t.replace(/\|/g, '/').replace(/\s+/g, ' ').trim().slice(0, 250);
}

/**
 * Comentarios de las pestañas de los servicios (formato de la planilla: APELLIDO Y NOMBRE en una columna,
 * Turno/Puesto al lado y después los días). Cada comentario va al mismo día de la persona en ese servicio.
 */
function notasPestanasHist_(ss, filas, nDias) {
  var noSon = /^(DATOS|STD|CONSOLIDADO|PERSONAL|FACTURACION|HOJA ?\d*|\d+ DIAS|PLUS.*|INJUSTIFICADOS.*|ENEVTOS|EVENTOS)$/;
  var porNombre = {};
  filas.forEach(function (f, i) { var k = normT_(f.Nombre); (porNombre[k] = porNombre[k] || []).push(i); });
  ss.getSheets().forEach(function (sh) {
    if (noSon.test(normT_(sh.getName()).trim())) return;
    var R = Math.min(sh.getLastRow(), 400), W = Math.min(sh.getLastColumn(), 45);
    if (R < 6 || W < 8) return;
    var nt = sh.getRange(1, 1, R, W).getNotes();
    if (!nt.some(function (r) { return r.some(function (x) { return x; }); })) return;
    var v = sh.getRange(1, 1, R, W).getDisplayValues();
    var cli = [v[0][3], v[0][2], v[4] && v[4][1], sh.getName()].map(function (x) { return String(x || '').trim(); }).filter(function (x) { return x && !/^#|!/.test(x); });
    var cN = -1, cD = -1;
    for (var r = 0; r < R; r++) {
      var hdr = -1;
      for (var c = 0; c < Math.min(W, 8); c++) if (normT_(v[r][c]) === 'APELLIDO Y NOMBRE') { hdr = c; break; }
      if (hdr >= 0) { cN = hdr; cD = hdr + 2; r++; continue; }
      if (cN < 0) continue;
      var nom = String(v[r][cN] || '').trim(), linea = normT_(v[r].slice(0, cN + 1).join(' '));
      if (/TOTAL|CONTRATADO|DIFERENCIA/.test(linea)) { cN = -1; continue; }
      if (!nom) continue;
      var cand = porNombre[normT_(nom)] || [];
      if (cand.length > 1) {
        var mismos = cand.filter(function (i) { return cli.some(function (x) { return mismoNombre_(filas[i].Cliente, x) || normT_(filas[i].Cliente) === normT_(x); }); });
        if (mismos.length) cand = mismos;
      }
      if (!cand.length) continue;
      for (var j = 0; j < nDias; j++) {
        var t = limpiarNotaHist_(nt[r][cD + j] || '');
        if (!t) continue;
        cand.forEach(function (i) { filas[i].notas = filas[i].notas || []; if (!filas[i].notas[j]) filas[i].notas[j] = t; });
      }
    }
  });
}

/**
 * Cliente de una fila del STD. En el Excel la celda Cliente tiene un vínculo a la pestaña del servicio
 * (ej.: 'C5N'!A1) y al pasar el archivo a Google la primera fila de cada servicio a veces queda con el
 * vínculo en lugar del nombre. Ese era el error que dejaba al primer vigilador de cada servicio afuera.
 * Se toma: el texto que se ve; si también es un vínculo, el nombre del servicio (celda B5) de esa pestaña;
 * si no, el cliente de la fila siguiente o anterior del mismo servicio.
 */
var RX_VINCULO_ = /^'?([^'!]+)'?!\$?[A-Z]{1,3}\$?\d+$/;
function clienteSTD_(ss, v, vis, r, col, hdr) {
  var c = col.CLIENTE;
  if (c === undefined) return '';
  var t = String(v[r][c] || '').trim(), d = String(vis[r][c] || '').trim();
  if (!RX_VINCULO_.test(t)) return t;
  if (d && !RX_VINCULO_.test(d)) return d;
  var tab = t.match(RX_VINCULO_)[1];
  try { var h = ss.getSheetByName(tab); if (h) { var b5 = String(h.getRange('B5').getDisplayValue() || '').trim(); if (b5 && !/^#/.test(b5)) return b5; } } catch (e) { }
  for (var k = 1; k < 40; k++) {
    var abajo = v[r + k] && String(v[r + k][c] || '').trim(), arriba = r - k > hdr && v[r - k] && String(v[r - k][c] || '').trim();
    if (abajo && !RX_VINCULO_.test(abajo) && String(v[r + k][c] || '') !== '') {
      // la fila siguiente es del mismo servicio si su vínculo apunta a la misma pestaña (o si no hay otro dato)
      return abajo;
    }
    if (arriba && !RX_VINCULO_.test(arriba)) return arriba;
  }
  return tab;
}

/**
 * Corrige lo que ya se cargó con ese error: las filas que quedaron en servicios con nombre de vínculo
 * ("C5N'!A1", "Ailico!A1"...) pasan al servicio correcto. Para elegirlo se mira, en el mismo período:
 *   - el parecido del nombre de la pestaña (y del nombre del servicio en el modelo de Planificación),
 *   - en qué servicio falta justo ese número de orden,
 *   - y en qué servicio figura esa persona en los demás períodos.
 * Si no hay ninguno parecido, el servicio mal nombrado se renombra con el nombre de la pestaña.
 */
function repararHistorico_() {
  var inicio = Date.now(), servs = leer_('Servicios'), S = {};
  servs.forEach(function (s) { S[s.Id] = s; });
  var malos = {};
  servs.forEach(function (s) { if (RX_VINCULO_.test(String(s.Cliente || '').trim())) malos[s.Id] = String(s.Cliente).trim().match(RX_VINCULO_)[1]; });
  if (!Object.keys(malos).length) return { movidas: 0, renombrados: 0, periodos: 0, log: ['No hay nada para corregir.'] };
  // Nombre del servicio de cada pestaña del modelo de Planificación (celda B5)
  var b5 = {};
  try { modelo_('PLANTILLA_ID').getSheets().forEach(function (h) { var x = String(h.getRange('B5').getDisplayValue() || '').trim(); if (x.length > 2 && isNaN(Number(x))) b5[normT_(h.getName())] = x; }); } catch (e) { }
  var bigr = function (t) { var x = normT_(t).replace(/[^A-Z0-9]/g, ''), o = {}; for (var i = 0; i < x.length - 1; i++) o[x.substr(i, 2)] = 1; return o; };
  var sim = function (a, b) {
    if (!a || !b) return 0;
    var A = bigr(a), B = bigr(b), na = Object.keys(A).length, nb = Object.keys(B).length;
    if (!na || !nb) return 0;
    var com = Object.keys(A).filter(function (k) { return B[k]; }).length, d = 2 * com / (na + nb);
    var ta = tokensNombre_(a), tb = tokensNombre_(b);
    if (ta.length && tb.length && (ta.every(function (t) { return tb.indexOf(t) >= 0; }) || tb.every(function (t) { return ta.indexOf(t) >= 0; }))) d = Math.max(d, 0.8);
    return d;
  };
  var puntaje = function (tab, s) {
    var alt = b5[normT_(tab)] || '', ns = [s.Cliente, s.Servicio, s.Pestana].filter(Boolean), m = 0;
    ns.forEach(function (n) { m = Math.max(m, sim(tab, n), alt ? sim(alt, n) : 0); });
    return m;
  };
  var periodos = histPeriodos_(), datos = {};
  periodos.forEach(function (p) { datos[p] = histLeerPeriodo_(p); });
  // Dónde figura cada persona (filas correctas)
  var pf = {};
  periodos.forEach(function (p) { datos[p].forEach(function (f) { if (malos[f.ServicioId]) return; var k = String(f.Legajo || '').trim() || normT_(f.Nombre); if (!k) return; pf[k] = pf[k] || {}; pf[k][f.ServicioId] = (pf[k][f.ServicioId] || 0) + 1; }); });
  var cambiados = {}, movidas = 0, renombrar = {}, log = [], resumen = {};
  periodos.forEach(function (p) {
    var buenos = {};
    datos[p].forEach(function (f) { if (!malos[f.ServicioId]) (buenos[f.ServicioId] = buenos[f.ServicioId] || []).push(f); });
    datos[p].forEach(function (f) {
      var tab = malos[f.ServicioId];
      if (!tab) return;
      var k = String(f.Legajo || '').trim() || normT_(f.Nombre), pc = pf[k] || {}, tot = 0;
      Object.keys(pc).forEach(function (x) { tot += pc[x]; });
      var pool = {}; Object.keys(buenos).forEach(function (x) { pool[x] = 1; }); Object.keys(pc).forEach(function (x) { pool[x] = 1; });
      var mejor = null;
      Object.keys(pool).forEach(function (sid) {
        var s = S[sid]; if (!s || malos[sid]) return;
        var sc = puntaje(tab, s);
        var gap = !!buenos[sid] && !buenos[sid].some(function (g) { return g.Seccion === f.Seccion && String(g.Orden) === String(f.Orden); });
        var share = tot ? (pc[sid] || 0) / tot : 0, t = sc + (gap ? 0.3 : 0) + 0.6 * share;
        if (!mejor || t > mejor.t) mejor = { t: t, sid: sid, sc: sc, gap: gap, share: share };
      });
      var elegido = mejor && (mejor.sc >= 0.5 || (mejor.gap && mejor.share >= 0.5)) ? mejor.sid : null;
      if (!elegido) {
        var g = servs.filter(function (s) { return !malos[s.Id]; }).map(function (s) { return { sid: s.Id, sc: puntaje(tab, s) }; }).sort(function (a, b) { return b.sc - a.sc; })[0];
        if (g && g.sc >= 0.6) elegido = g.sid;
      }
      if (elegido) {
        f.ServicioId = elegido; f._movida = 1; cambiados[p] = 1; movidas++;
        var rk = tab + ' → ' + (S[elegido].Cliente || S[elegido].Servicio);
        resumen[rk] = (resumen[rk] || 0) + 1;
      } else renombrar[f.ServicioId] = b5[normT_(tab)] || tab.replace(/\s+/g, ' ').trim();
    });
  });
  var mapa = {};
  Object.keys(cambiados).forEach(function (p) {
    // Orden dentro de cada servicio y sección, como en la planilla
    var orden = {};
    datos[p].forEach(function (f) { var ok = f.ServicioId + '|' + f.Seccion; orden[ok] = orden[ok] || []; orden[ok].push(f); });
    // La fila corregida era la primera de su servicio en el STD: va primero y se vuelve a numerar
    Object.keys(orden).forEach(function (ok) {
      orden[ok].sort(function (a, b) { return ((b._movida || 0) - (a._movida || 0)) || (Number(a.Orden) || 0) - (Number(b.Orden) || 0); });
      orden[ok].forEach(function (f, i) { f.Orden = String(i + 1); });
    });
    datos[p].forEach(function (f) { delete f._movida; });
    mapa[p] = datos[p];
  });
  if (Object.keys(mapa).length) histEscribirPeriodos_(mapa);
  // Servicios mal nombrados: los que quedaron vacíos se borran; los que no se pudieron ubicar se renombran.
  var usados = {};
  periodos.forEach(function (p) { datos[p].forEach(function (f) { usados[f.ServicioId] = 1; }); });
  try { leer_('Planilla').forEach(function (f) { usados[f.ServicioId] = 1; }); leer_('Plus').forEach(function (f) { usados[f.ServicioId] = 1; }); } catch (e) { }
  var borrados = 0, renombrados = 0;
  var nuevos = leer_('Servicios').filter(function (s) {
    if (!malos[s.Id]) return true;
    if (!usados[s.Id]) { borrados++; return false; }
    var nom = renombrar[s.Id] || malos[s.Id];
    s.Cliente = nom; s.Servicio = nom; renombrados++;
    return true;
  });
  reescribir_('Servicios', nuevos);
  try { CacheService.getScriptCache().remove('histPeriodos'); } catch (e) { }
  Object.keys(resumen).sort().forEach(function (k) { log.push(k + ' (' + resumen[k] + ' fila' + (resumen[k] === 1 ? '' : 's') + ')'); });
  return { movidas: movidas, periodos: Object.keys(mapa).length, borrados: borrados, renombrados: renombrados, log: log, seg: Math.round((Date.now() - inicio) / 1000) };
}

/* ---------------- archivo histórico (planilla aparte) ---------------- */

var HIST_ARCH_ENC_ = ['Periodo', 'Archivo', 'ArchivoId', 'CargadoPor', 'Fecha', 'Filas', 'Tipo', 'Origen'];
var MEMO_ARCH_ = null, MEMO_HISTP_ = {};

function fijarConfig_(clave, valor) {
  var lista = leer_('Config'), k = indice_(lista, 'Clave', clave);
  if (k < 0) lista.push({ Clave: clave, Valor: valor }); else lista[k].Valor = valor;
  reescribir_('Config', lista);
}

// Planilla "Novedades del Personal - Archivo histórico" (se crea sola la primera vez).
function archivoHist_(crear) {
  if (MEMO_ARCH_) return MEMO_ARCH_;
  var id = String(config_().HIST_ARCHIVO_ID || '');
  if (id) { try { MEMO_ARCH_ = SpreadsheetApp.openById(id); return MEMO_ARCH_; } catch (e) { if (!crear) return null; } }
  if (!crear) return null;
  var ss = SpreadsheetApp.create('Novedades del Personal - Archivo histórico');
  try { var f = DriveApp.getFileById(ss.getId()); carpetaRaiz_().addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (e) { /* queda en Mi unidad */ }
  var h = ss.getSheets()[0];
  h.setName('Archivos');
  h.getRange(1, 1, 1, HIST_ARCH_ENC_.length).setValues([HIST_ARCH_ENC_]).setFontWeight('bold');
  h.setFrozenRows(1);
  fijarConfig_('HIST_ARCHIVO_ID', ss.getId());
  MEMO_ARCH_ = ss;
  return ss;
}

// Los archivos que no son de ningún tipo conocido quedan en la carpeta "Novedades del Personal".
function carpetaOriginalesHist_() { return carpetaRaiz_(); }

function hojaAnioHist_(ss, anio, crear) {
  var nombre = 'Hist ' + anio, h = ss.getSheetByName(nombre);
  if (h || !crear) return h;
  h = ss.insertSheet(nombre);
  var enc = HOJAS.Planilla;
  if (h.getMaxColumns() < enc.length) h.insertColumnsAfter(h.getMaxColumns(), enc.length - h.getMaxColumns());
  h.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold');
  h.setFrozenRows(1);
  return h;
}

function aObjetoPlanilla_(fila) {
  var o = {};
  HOJAS.Planilla.forEach(function (k, i) { o[k] = fila[i]; });
  return o;
}

// Filas de un período del archivo histórico. Lee solo la columna del período y después solo esas filas.
function histLeerPeriodo_(periodo) {
  if (MEMO_HISTP_[periodo]) return MEMO_HISTP_[periodo];
  var ss = archivoHist_(false);
  if (!ss) return [];
  var h = hojaAnioHist_(ss, String(periodo).slice(0, 4), false);
  if (!h) return [];
  var n = h.getLastRow() - 1;
  if (n < 1) return [];
  var col = h.getRange(2, 1, n, 1).getDisplayValues(), ini = -1, fin = -1;
  for (var i = 0; i < n; i++) if (col[i][0] === periodo) { if (ini < 0) ini = i; fin = i; }
  var out = [];
  if (ini >= 0) {
    h.getRange(2 + ini, 1, fin - ini + 1, HOJAS.Planilla.length).getDisplayValues().forEach(function (f) {
      if (f[0] === periodo) out.push(aObjetoPlanilla_(f));
    });
  }
  MEMO_HISTP_[periodo] = out;
  return out;
}

// Guarda (reemplaza) períodos completos en el archivo histórico. mapa = { '2024-03': [filas], ... }
function histEscribirPeriodos_(mapa) {
  var periodos = Object.keys(mapa);
  if (!periodos.length) return;
  var ss = archivoHist_(true), enc = HOJAS.Planilla, porAnio = {};
  periodos.forEach(function (p) { var a = p.slice(0, 4); (porAnio[a] = porAnio[a] || []).push(p); });
  Object.keys(porAnio).forEach(function (anio) {
    var h = hojaAnioHist_(ss, anio, true), n = h.getLastRow() - 1;
    var viejas = n > 0 ? h.getRange(2, 1, n, enc.length).getDisplayValues() : [];
    var quitar = {};
    porAnio[anio].forEach(function (p) { quitar[p] = 1; });
    var filas = viejas.filter(function (f) { return f.join('') !== '' && !quitar[f[0]]; });
    porAnio[anio].forEach(function (p) {
      mapa[p].forEach(function (o) { filas.push(enc.map(function (k) { var v = o[k]; return v === null || v === undefined ? '' : String(v); })); });
      delete MEMO_HISTP_[p];
    });
    // Ordenado por período, servicio, sección y orden: así cada período queda junto y se lee rápido.
    var iS = enc.indexOf('ServicioId'), iSe = enc.indexOf('Seccion'), iO = enc.indexOf('Orden');
    filas.sort(function (a, b) {
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[iS] < b[iS] ? -1 : a[iS] > b[iS] ? 1 :
        a[iSe] < b[iSe] ? -1 : a[iSe] > b[iSe] ? 1 : (Number(a[iO]) || 0) - (Number(b[iO]) || 0);
    });
    if (n > 0) h.getRange(2, 1, n, enc.length).clearContent();
    if (filas.length) {
      if (h.getMaxRows() < filas.length + 1) h.insertRowsAfter(h.getMaxRows(), filas.length + 1 - h.getMaxRows());
      var r = h.getRange(2, 1, filas.length, enc.length);
      r.setNumberFormat('@');
      r.setValues(filas);
    }
  });
  try { CacheService.getScriptCache().remove('histPeriodos'); } catch (e) { }
}

// Períodos guardados en el archivo histórico.
function histPeriodos_() {
  var c = null;
  try { c = CacheService.getScriptCache().get('histPeriodos'); } catch (e) { }
  if (c) return JSON.parse(c);
  var ss = archivoHist_(false), p = {};
  if (ss) ss.getSheets().forEach(function (h) {
    if (!/^Hist \d{4}$/.test(h.getName())) return;
    var n = h.getLastRow() - 1;
    if (n > 0) h.getRange(2, 1, n, 1).getDisplayValues().forEach(function (r) { if (r[0]) p[r[0]] = 1; });
  });
  var out = Object.keys(p).sort();
  try { CacheService.getScriptCache().put('histPeriodos', JSON.stringify(out), 21600); } catch (e) { }
  return out;
}

// Hoja "Archivos" del archivo histórico: el catálogo de todo lo cargado (un renglón por archivo).
function hojaCatalogo_(crear) {
  var ss = archivoHist_(crear);
  if (!ss) return null;
  var h = ss.getSheetByName('Archivos');
  if (!h) { if (!crear) return null; h = ss.insertSheet('Archivos'); }
  if (h.getLastColumn() < HIST_ARCH_ENC_.length || String(h.getRange(1, 1).getValue()) !== 'Periodo') {
    if (h.getMaxColumns() < HIST_ARCH_ENC_.length) h.insertColumnsAfter(h.getMaxColumns(), HIST_ARCH_ENC_.length - h.getMaxColumns());
    h.getRange(1, 1, 1, HIST_ARCH_ENC_.length).setValues([HIST_ARCH_ENC_]).setFontWeight('bold');
    h.setFrozenRows(1);
    // Todo como texto (si no, "2026-07" se vuelve una fecha)
    if (h.getMaxRows() > 1) h.getRange(2, 1, h.getMaxRows() - 1, HIST_ARCH_ENC_.length).setNumberFormat('@');
  }
  return h;
}
function catalogo_() {
  var h = hojaCatalogo_(false);
  if (!h || h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, HIST_ARCH_ENC_.length).getDisplayValues().filter(function (f) { return f[2]; }).map(function (f) {
    var o = {}; HIST_ARCH_ENC_.forEach(function (k, i) { o[k] = f[i]; });
    o.Tipo = o.Tipo || tipoArchivo_(o.Archivo);
    o.url = 'https://drive.google.com/file/d/' + o.ArchivoId + '/view';
    return o;
  });
}
// Archivos originales de un período (el último primero).
function originalesHist_(periodo) {
  return catalogo_().filter(function (o) { return o.Periodo === periodo; }).reverse().map(function (o) {
    return { nombre: o.Archivo, tipo: o.Tipo, fecha: o.Fecha, filas: o.Filas, url: o.url, descarga: 'https://drive.google.com/uc?export=download&id=' + o.ArchivoId };
  });
}
// Agrega (o actualiza, si ya estaba) un archivo en el catálogo.
function registrarOriginalHist_(u, periodo, archivo, filas, tipo, origen) {
  var h = hojaCatalogo_(true), id = archivo.getId(), n = h.getLastRow() - 1;
  var fila = [periodo, archivo.getName(), id, u ? u.usuario : 'editor', ahora_(), String(filas === undefined ? '' : filas), tipo || tipoArchivo_(archivo.getName()), origen || 'Subido'];
  if (n > 0) {
    var ids = h.getRange(2, 3, n, 1).getDisplayValues();
    for (var i = 0; i < n; i++) if (ids[i][0] === id) { h.getRange(i + 2, 1, 1, fila.length).setValues([fila]); return; }
  }
  var r0 = h.getLastRow() + 1;
  if (h.getMaxRows() < r0) h.insertRowsAfter(h.getMaxRows(), 10);
  h.getRange(r0, 1, 1, fila.length).setNumberFormat('@').setValues([fila]);
}
function registrarVarios_(u, filas) {
  if (!filas.length) return;
  var h = hojaCatalogo_(true), n = h.getLastRow() - 1, pos = {};
  if (n > 0) h.getRange(2, 3, n, 1).getDisplayValues().forEach(function (r, i) { pos[r[0]] = i + 2; });
  var nuevas = [];
  filas.forEach(function (f) {
    var fila = [f.periodo, f.nombre, f.id, u ? u.usuario : 'editor', ahora_(), String(f.filas === undefined ? '' : f.filas), f.tipo, f.origen || 'Drive'];
    if (pos[f.id]) h.getRange(pos[f.id], 1, 1, fila.length).setValues([fila]); else nuevas.push(fila);
  });
  if (nuevas.length) {
    var r0 = h.getLastRow() + 1;
    if (h.getMaxRows() < r0 + nuevas.length - 1) h.insertRowsAfter(h.getMaxRows(), r0 + nuevas.length - 1 - h.getMaxRows());
    h.getRange(r0, 1, nuevas.length, nuevas[0].length).setNumberFormat('@').setValues(nuevas);
  }
}

/* ---------------- nombres de servicios (igual que en la pantalla Servicios) ---------------- */

var PALABRAS_VACIAS_ = ['EX', 'CONSORCIO', 'CONS', 'EDIFICIO', 'EDIF', 'BARRIO', 'B', 'BO', 'OBRA', 'EL', 'LA', 'LOS', 'LAS', 'DE', 'DEL', 'Y', 'SA', 'SRL', 'S', 'A', 'PROPIETARIOS', 'COPROPIETARIOS'];
var ROMANOS_ = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10' };
function tokensNombre_(t) {
  return normT_(t).replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    .map(function (x) { return ROMANOS_[x] || x; }).filter(function (x) { return PALABRAS_VACIAS_.indexOf(x) < 0; });
}
function mismoNombre_(a, b) {
  var x = tokensNombre_(a), y = tokensNombre_(b);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  var chico = x.length <= y.length ? x : y, grande = x.length <= y.length ? y : x;
  return chico.length >= 2 && chico.every(function (t) { return grande.indexOf(t) >= 0; });
}

// Contexto para pasar filas del STD a filas de la app (busca o crea el servicio de cada cliente).
function contextoServicios_() {
  var servicios = leer_('Servicios'), porClave = {};
  var clave = function (t) { return normT_(t).replace(/[^A-Z0-9]/g, ''); };
  servicios.forEach(function (s) { porClave[clave(s.Cliente)] = s.Id; porClave[clave(s.Servicio)] = porClave[clave(s.Servicio)] || s.Id; });
  var ctx = { nuevos: [] };
  ctx.idDe = function (cliente, empresa) {
    var k = clave(cliente);
    if (porClave[k]) return porClave[k];
    var parecido = servicios.filter(function (s) { return mismoNombre_(s.Cliente, cliente) || mismoNombre_(s.Servicio, cliente); })[0];
    if (parecido) { porClave[k] = parecido.Id; return parecido.Id; }
    var sid = 'H' + (Object.keys(porClave).length + 1) + Utilities.formatDate(new Date(), APP.TZ, 'ssSSS');
    porClave[k] = sid;
    var s = { Id: sid, Cliente: cliente || 'Sin cliente', Servicio: cliente || 'Sin cliente', Empresa: empresa, Supervisor: '', Ciclo: '26-25', Activo: 'NO', FechaBaja: '' };
    ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].forEach(function (d) { s['D_' + d] = '0'; s['N_' + d] = '0'; });
    ctx.nuevos.push(s);
    servicios.push(s);
    return sid;
  };
  ctx.guardar = function () { if (ctx.nuevos.length) reescribir_('Servicios', leer_('Servicios').concat(ctx.nuevos)); };
  return ctx;
}

// Filas del STD -> filas de la planilla de la app.
function filasAppDesdeSTD_(res, ctx, origen) {
  var orden = {}, out = [];
  res.filas.forEach(function (f) {
    var sid = ctx.idDe(f.Cliente, f.Empresa);
    var sec = /RETEN|RET[EÉ]N|INSTRUC/i.test(f.Puesto) ? 'RETEN' : 'COBERTURA';
    var ok = sid + '|' + sec; orden[ok] = (orden[ok] || 0) + 1;
    var fila = { Periodo: res.periodo, ServicioId: sid, Seccion: sec, Orden: String(orden[ok]), Legajo: f.Legajo, Nombre: f.Nombre,
      Empresa: f.Empresa, Puesto: f.Puesto, Turno: '', ActualizadoPor: origen || 'histórico', Actualizado: ahora_() };
    DIAS_COL.forEach(function (dc, j) {
      fila[dc] = f.dias[j] || '';
      var nt = f.notas && f.notas[j];                 // v1.22.6: comentario del Excel -> nota de la celda
      if (nt && String(fila[dc]).indexOf('|') < 0) fila[dc] = fila[dc] + '|' + nt;
    });
    out.push(fila);
  });
  return out;
}

function periodoConDatosApp_(periodo) {
  return leer_('Planilla').some(function (f) { return f.Periodo === periodo && f.ActualizadoPor !== 'histórico'; });
}

// Plus Encargado del Excel histórico -> filas de la hoja Plus (Función "Encargado").
function leerPlusHistorico_(ss, periodo, ctx) {
  var sh = ss.getSheetByName('Plus Encargado') || ss.getSheets().filter(function (h) { return /PLUS/i.test(h.getName()); })[0];
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), hdr = -1, col = {};
  for (var r = 0; r < Math.min(v.length, 15) && hdr < 0; r++) for (var c = 0; c < v[r].length; c++) if (/^(APELLIDO Y NOMBRE|APELLIDO Y NOMBRES|NOMBRE Y APELLIDO|APELLIDO|NOMBRE)$/.test(normT_(v[r][c]))) { hdr = r; break; }
  if (hdr < 0) return [];
  v[hdr].forEach(function (x, c) { var t = normT_(x); if (t && col[t] === undefined) col[t] = c; });
  var busca = function (re) { var k = Object.keys(col).filter(function (t) { return re.test(t); })[0]; return k === undefined ? undefined : col[k]; };
  if (col['APELLIDO Y NOMBRE'] === undefined) col['APELLIDO Y NOMBRE'] = busca(/APELLIDO|NOMBRE/);
  if (col.SERVICIO === undefined) col.SERVICIO = busca(/SERVICIO|CLIENTE|OBJETIVO/);
  var cLeg = col.LP !== undefined ? col.LP : (col.LEGAJO !== undefined ? col.LEGAJO : busca(/^(LP|LEG)/));
  var cDias = col['DIAS DE COBERTURA'] !== undefined ? col['DIAS DE COBERTURA'] : (col.DIAS !== undefined ? col.DIAS : busca(/DIAS/));
  var cPlata = col['PLUS EN $'] !== undefined ? col['PLUS EN $'] : busca(/PLUS EN|\$|IMPORTE|MONTO/);
  var out = [];
  for (var r2 = hdr + 1; r2 < v.length; r2++) {
    var f = v[r2], nom = String(f[col['APELLIDO Y NOMBRE']] || '').trim();
    if (!nom) continue;
    var serv = String(f[col.SERVICIO] || '').trim();
    out.push({ _serv: serv, _emp: String(f[0] || ''), Periodo: periodo, ServicioId: serv ? ctx.idDe(serv, String(f[0] || '')) : '', Legajo: String(cLeg !== undefined ? f[cLeg] : '').replace(/\.0$/, ''),
      Nombre: nom.toUpperCase(), Funcion: 'Encargado', Dias: cDias !== undefined && f[cDias] !== null && f[cDias] !== undefined ? String(f[cDias]) : '',
      Observaciones: cPlata !== undefined && f[cPlata] ? 'Plus $ ' + f[cPlata] : '', CargadoPor: 'histórico', Fecha: ahora_() });
  }
  return out;
}
// Guarda el plus histórico de un período (si ese período no tiene plus cargado en la app).
function guardarPlusHistorico_(periodo, filas) {
  if (!filas.length) return 0;
  filas = filas.map(function (f) { var o = {}; Object.keys(f).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = f[k]; }); return o; });
  var todas = leer_('Plus');
  // v1.21.2: lo cargado a mano en la app se respeta; del archivo se agrega a quien no esté ya cargado en ese período
  var clave = function (p) { return (String(p.Legajo || '').replace(/\.0$/, '') || normT_(p.Nombre)) + '|' + normT_(p.Funcion || 'Encargado'); };
  var enApp = {};
  todas.forEach(function (p) { if (p.Periodo === periodo && p.CargadoPor !== 'histórico') enApp[clave(p)] = 1; });
  var nuevas = filas.filter(function (f) { return !enApp[clave(f)]; });
  reescribir_('Plus', todas.filter(function (p) { return !(p.Periodo === periodo && p.CargadoPor === 'histórico'); }).concat(nuevas));
  return nuevas.length;
}

/**
 * Plus de un período que no tiene nada cargado en la app: se busca en los archivos de ese período
 * (lo subido en Carga masiva / lo traído de Drive: Novedades del Personal, Planificación o Plus) y,
 * si el modelo de Planificación es de ese período, en su pestaña Plus Encargado (el de muestra).
 * Lo que se encuentra se guarda en la hoja Plus como "histórico" (se busca una sola vez por período).
 */
function asegurarPlusPeriodo_(periodo) {
  if (!periodo) return 0;
  if (leer_('Plus').some(function (p) { return p.Periodo === periodo && p.CargadoPor === 'histórico'; })) return 0;
  var props = PropertiesService.getScriptProperties(), marca = 'PLUSCHK2|' + periodo;
  var cat = [];
  try { cat = catalogo_().filter(function (o) { return o.Periodo === periodo && /Novedades|Planificaci|Plus/i.test(o.Tipo); }); } catch (e) { }
  // v1.21.2: también los archivos de las carpetas del histórico en Drive (los que se trajeron antes del catálogo)
  try {
    archivosHistoricoCache_().forEach(function (a) {
      var t = tipoArchivo_(a.nombre), per = periodoDesdeTexto_(a.carpeta) || periodoDesdeTexto_(a.nombre);
      if (per === periodo && /Novedades|Planificaci|Plus/i.test(t) && !cat.some(function (o) { return o.ArchivoId === a.id; }))
        cat.push({ ArchivoId: a.id, Archivo: a.nombre, Tipo: t, Periodo: per });
    });
  } catch (e) { Logger.log('Plus (Drive): ' + e.message); }
  // Primero Novedades del Personal y Plus; la Planificación (pesada) al final
  cat.sort(function (a, b) { return (/Planificaci/i.test(a.Tipo) ? 1 : 0) - (/Planificaci/i.test(b.Tipo) ? 1 : 0); }).reverse();
  var firma = cat.map(function (o) { return o.ArchivoId; }).join(',') + '|' + plantillaId_('PLANTILLA_ID');
  if (props.getProperty(marca) === firma) return 0;
  props.setProperty(marca, firma);
  var ctx = contextoServicios_(), filas = [];
  // 1) El último archivo subido de ese período que tenga Plus
  cat.reverse();
  for (var i = 0; i < cat.length && !filas.length; i++) {
    var tmp = null;
    try { tmp = convertirTemporal_(cat[i].ArchivoId); filas = leerPlusHistorico_(tmp.ss, periodo, ctx); }
    catch (e) { Logger.log('Plus de ' + cat[i].Archivo + ': ' + e.message); }
    finally { if (tmp && tmp.temporal) { try { DriveApp.getFileById(tmp.temporal).setTrashed(true); } catch (e2) { } } }
  }
  // 2) El modelo de Planificación, si es de ese período ("Planificacion Agosto - Septiembre 2026")
  if (!filas.length) {
    try {
      var nomMod = DriveApp.getFileById(plantillaId_('PLANTILLA_ID')).getName();
      if (periodoDesdeTexto_(nomMod) === periodo) filas = leerPlusHistorico_(modelo_('PLANTILLA_ID'), periodo, ctx);
    } catch (e) { Logger.log('Plus del modelo: ' + e.message); }
  }
  if (!filas.length) return 0;
  ctx.guardar();
  return guardarPlusHistorico_(periodo, filas);
}

// Lee un archivo (Novedades del Personal o Planificación): STD -> planilla y Plus Encargado -> plus. Devuelve lo que hizo.
function extraerDeArchivo_(id, ctx, periodoDefecto) {
  var tmp = null;
  try {
    tmp = convertirTemporal_(id);
    var res = null, errSTD = null;
    try { res = leerSTDHistorico_(tmp.ss); } catch (e) { errSTD = e; }
    var per = res ? res.periodo : (periodoDefecto || '');
    var out = { periodo: per, filas: [], plus: [], enApp: res ? periodoConDatosApp_(res.periodo) : true };
    if (res && !out.enApp) out.filas = filasAppDesdeSTD_(res, ctx);
    if (per) { try { out.plus = leerPlusHistorico_(tmp.ss, per, ctx); } catch (e) { out.plus = []; } }
    // Sin STD y sin Plus: es un error de verdad (archivo que no corresponde)
    if (errSTD && !out.plus.length) throw errSTD;
    return out;
  } finally {
    if (tmp && tmp.temporal) { try { DriveApp.getFileById(tmp.temporal).setTrashed(true); } catch (e2) { } }
  }
}

/**
 * Carga masiva desde las carpetas de Drive (se puede ejecutar desde el editor o desde la app).
 * Cada archivo de las carpetas se anota en el catálogo con su tipo y su período (sale del nombre de la carpeta).
 * De los "Novedades del Personal" (y de las Planificaciones de períodos que no tienen Novedades) se pasan los datos:
 * la pestaña STD a la planilla (archivo histórico) y Plus Encargado al plus.
 * Va de a tandas de unos 4 minutos.
 */
function importarHistorico() {
  var inicio = Date.now();
  // Lo ya procesado sale del catálogo (archivos traídos de Drive), no de una celda de Config que se llenaría.
  var hechos = catalogo_().filter(function (o) { return o.Origen === 'Drive'; }).map(function (o) { return o.ArchivoId; });
  var errores = [], archivos = archivosHistorico_(errores);
  var pendientes = archivos.filter(function (a) { return hechos.indexOf(a.id) < 0; });
  pasarHistoricoAlArchivo();
  // Períodos que tienen un "Novedades del Personal" en las carpetas (de esos no hace falta abrir la Planificación, que pesa mucho)
  var conNovedades = {};
  archivos.forEach(function (a) { if (tipoArchivo_(a.nombre) === 'Novedades del Personal') conNovedades[periodoDesdeTexto_(a.carpeta) || periodoDesdeTexto_(a.nombre)] = 1; });
  var ctx = contextoServicios_(), log = errores.slice(), mapa = {}, catalogo = [], plusN = 0;
  // Primero se anota todo lo que no hay que abrir (es rápido); después se abren los que tienen datos.
  pendientes.sort(function (a, b) { return (tipoArchivo_(a.nombre) === 'Otro' ? 0 : 1) - (tipoArchivo_(b.nombre) === 'Otro' ? 0 : 1); });
  for (var i = 0; i < pendientes.length; i++) {
    if (Date.now() - inicio > 230000) break;
    var a = pendientes[i], tipo = tipoArchivo_(a.nombre), per = periodoDesdeTexto_(a.carpeta) || periodoDesdeTexto_(a.nombre), filasN = '';
    var abrir = tipo === 'Novedades del Personal' || (tipo === 'Planificación' && !conNovedades[per]);
    if (abrir) {
      try {
        var x = extraerDeArchivo_(a.id, ctx, per);
        per = x.periodo || per;
        if (x.enApp) log.push(a.nombre + ': el período ya tiene datos cargados en la app, no se tocó.');
        else { mapa[per] = x.filas; filasN = x.filas.length; log.push(a.nombre + ': ' + x.filas.length + ' filas (' + nombrePeriodo_(per) + ').'); }
        plusN += guardarPlusHistorico_(per, x.plus);
      } catch (e) { log.push(a.nombre + ': ' + e.message); }
    }
    catalogo.push({ periodo: per, nombre: a.nombre, id: a.id, filas: filasN, tipo: tipo, origen: 'Drive' });
    hechos.push(a.id);
  }
  ctx.guardar();
  histEscribirPeriodos_(mapa);
  registrarVarios_(null, catalogo);
  var res2 = { total: archivos.length, hechos: archivos.filter(function (x) { return hechos.indexOf(x.id) >= 0; }).length, log: log,
    servNuevos: ctx.nuevos.length, catalogados: catalogo.length, periodos: Object.keys(mapa).length, plus: plusN };
  Logger.log(JSON.stringify(res2));
  return res2;
}

function accionHistorico_(u, d) {
  exigir_(u, 'cargamasiva', true);
  if (d && d.reiniciar) {
    // Empezar de nuevo: se sacan del catálogo los archivos traídos de Drive (se vuelven a anotar al traerlos).
    var h = hojaCatalogo_(false);
    if (h && h.getLastRow() > 1) {
      var W = HIST_ARCH_ENC_.length, v = h.getRange(2, 1, h.getLastRow() - 1, W).getDisplayValues();
      var quedan = v.filter(function (f) { return f[7] !== 'Drive'; });
      h.getRange(2, 1, v.length, W).clearContent();
      if (quedan.length) h.getRange(2, 1, quedan.length, W).setNumberFormat('@').setValues(quedan);
    }
  }
  return importarHistorico();
}

/**
 * Carga masiva desde la computadora: cualquier archivo (Novedades del Personal, Planificación, Horas Contratadas,
 * Conformaciones, Proyección, planillas de supervisores, PDF...). El original queda guardado tal cual en Drive
 * y se anota en el catálogo con su tipo y su período. De los que traen STD se pasan los datos a la app.
 */
function accionSubirHistorico_(u, d) {
  exigir_(u, 'cargamasiva', true);
  if (!d || !d.base64) throw new Error('No llegó el archivo.');
  var nombre = String(d.nombre || 'archivo.xlsx');
  var ext = (nombre.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  var mime = { xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    pdf: 'application/pdf', csv: 'text/csv' }[ext.toLowerCase()] || 'application/octet-stream';
  var tipo = d.tipo || tipoArchivo_(nombre);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    pasarHistoricoAlArchivo();
    // El original va a la carpeta que le corresponde según su tipo (Novedades, Proyeccion, STD, Consolidado...).
    var orig = (CARPETA_TIPO_[tipo] ? subcarpeta_(CARPETA_TIPO_[tipo]) : carpetaOriginalesHist_()).createFile(Utilities.newBlob(Utilities.base64Decode(d.base64), mime, nombre));
    var out = { tipo: tipo, original: 'https://drive.google.com/file/d/' + orig.getId() + '/view', filas: 0, servicios: 0, servNuevos: [], plus: 0, yaHabia: false, enApp: false };
    var per = d.periodo || periodoDesdeTexto_(nombre);
    var conDatos = /\.xls[xmb]?$/i.test(nombre) && (tipo === 'Novedades del Personal' || tipo === 'Planificación' || tipo === 'STD' || tipo === '30/31 días' || tipo === 'Plus');
    if (conDatos) {
      var ctx = contextoServicios_();
      try {
        var x = extraerDeArchivo_(orig.getId(), ctx, per);
        per = x.periodo || per;
        out.yaHabia = histPeriodos_().indexOf(per) >= 0;
        out.enApp = x.enApp;
        if (!x.enApp && x.filas.length) { var mapa = {}; mapa[per] = x.filas; histEscribirPeriodos_(mapa); }
        out.filas = x.filas.length;
        out.servicios = Object.keys(x.filas.reduce(function (a, f) { a[f.ServicioId] = 1; return a; }, {})).length;
        out.plus = guardarPlusHistorico_(per, x.plus);
        ctx.guardar();
        out.servNuevos = ctx.nuevos.map(function (s) { return s.Cliente; });
      } catch (e) { out.aviso = 'Se guardó el archivo, pero no se pudieron leer sus datos: ' + e.message; }
    }
    if (!per) out.aviso = (out.aviso ? out.aviso + ' ' : '') + 'No se reconoció el período en el nombre: elegilo en la lista de lo cargado.';
    registrarOriginalHist_(u, per, orig, out.filas || '', tipo, 'Subido');
    // El archivo nuevo reemplaza al que se había subido antes del mismo tipo y período (los anteriores eran de prueba).
    if (per && d.reemplazar !== false) { try { out.reemplazados = reemplazarAnteriores_(per, tipo, orig.getId()); } catch (e) { Logger.log('Reemplazar: ' + e.message); } }
    try { orig.addViewer(u.email); } catch (e) { }
    out.periodo = per; out.nombrePeriodo = per ? nombrePeriodo_(per) : 'sin período';
    return out;
  } finally { lock.releaseLock(); }
}

// Lo que hay cargado: catálogo completo + períodos con datos (para la ventana Carga masiva).
function accionCatalogo_(u, d) {
  exigir_(u, 'cargamasiva', false);
  if (d && d.cambiar) {
    exigir_(u, 'cargamasiva', true);
    var h = hojaCatalogo_(true), n = h.getLastRow() - 1;
    if (n > 0) {
      var ids = h.getRange(2, 3, n, 1).getDisplayValues();
      for (var i = 0; i < n; i++) if (ids[i][0] === d.cambiar) {
        if (d.periodo !== undefined) h.getRange(i + 2, 1).setValue(d.periodo);
        if (d.tipo) h.getRange(i + 2, 7).setValue(d.tipo);
      }
    }
  }
  var idxT = {}; try { idxT = indiceTablasHist_(); } catch (e) { }
  return { archivos: catalogo_(), tablas: idxT, periodosDatos: periodosConDatos_(), tipos: TIPOS_ARCHIVO_.map(function (t) { return t[0]; }).concat(['Planilla de supervisor', 'Otro']),
    carpetas: carpetasHistorico_(), archivoHist: (config_().HIST_ARCHIVO_ID ? 'https://docs.google.com/spreadsheets/d/' + config_().HIST_ARCHIVO_ID + '/edit' : '') };
}

// Períodos que tienen datos (para los selectores de consulta e informes).
function periodosConDatos_() {
  // Se guarda 10 minutos (cambia solo si cambia la Planilla o el archivo histórico): así el ingreso es más rápido.
  var hp = CacheService.getScriptCache().get('histPeriodos') || '';
  var ck = 'perDatos|' + (versionHoja_('Planilla') || '') + '|' + hp.length + hp.slice(-12);
  var ya = cacheJSONGet_(ck);
  if (ya) return ya;
  var out = periodosConDatosLeer_();
  cacheJSONPut_(ck, out, 600);
  return out;
}
function periodosConDatosLeer_() {
  var p = {};
  leer_('Planilla').forEach(function (f) { if (f.Periodo) p[f.Periodo] = 1; });
  try { histPeriodos_().forEach(function (x) { p[x] = 1; }); } catch (e) { }
  // Lo que todavía esté en la hoja PlanillaHist de la base (versión 1.15), hasta que se pase al archivo.
  try {
    var h = ss_().getSheetByName('PlanillaHist'), n = h ? h.getLastRow() - 1 : 0;
    if (n > 0) h.getRange(2, 1, n, 1).getDisplayValues().forEach(function (r) { if (r[0]) p[r[0]] = 1; });
  } catch (e) { }
  return Object.keys(p).sort();
}

/**
 * Pasa al archivo histórico (planilla aparte) todo lo histórico que haya quedado en la base:
 *   - las filas importadas del histórico que quedaron en Planilla (versiones viejas), y
 *   - la hoja PlanillaHist de la versión 1.15.
 * Se puede ejecutar desde el editor; también corre solo al importar o subir archivos.
 */
function pasarHistoricoAlArchivo() {
  var mapa = {}, total = 0;
  var sumar = function (f) { (mapa[f.Periodo] = mapa[f.Periodo] || []).push(f); total++; };
  var todas = leer_('Planilla');
  var hist = todas.filter(function (f) { return f.ActualizadoPor === 'histórico'; });
  hist.forEach(sumar);
  var hh = ss_().getSheetByName('PlanillaHist'), hayHH = hh && hh.getLastRow() > 1;
  if (hayHH) leer_('PlanillaHist').forEach(sumar);
  if (!total) return 0;
  histEscribirPeriodos_(mapa);
  if (hist.length) reescribir_('Planilla', todas.filter(function (f) { return f.ActualizadoPor !== 'histórico'; }));
  if (hayHH) { hh.getRange(2, 1, hh.getLastRow() - 1, hh.getLastColumn()).clearContent(); delete MEMO_HOJAS_.PlanillaHist; }
  return total;
}
// Nombre anterior (v1.15), por si quedó en algún activador o se ejecuta desde el editor.
function separarHistorico() { return pasarHistoricoAlArchivo(); }


// Saca del catálogo (y manda a la papelera) los archivos subidos antes con el mismo período y tipo.
function reemplazarAnteriores_(periodo, tipo, idNuevo) {
  var h = hojaCatalogo_(false);
  if (!h || h.getLastRow() < 2) return 0;
  var W = HIST_ARCH_ENC_.length, v = h.getRange(2, 1, h.getLastRow() - 1, W).getDisplayValues(), quedan = [], n = 0;
  v.forEach(function (f) {
    var viejo = f[0] === periodo && f[6] === tipo && f[2] !== idNuevo && f[7] === 'Subido';
    if (!viejo) { quedan.push(f); return; }
    n++;
    try { DriveApp.getFileById(f[2]).setTrashed(true); } catch (e) { }
  });
  if (!n) return 0;
  h.getRange(2, 1, v.length, W).clearContent();
  if (quedan.length) h.getRange(2, 1, quedan.length, W).setNumberFormat('@').setValues(quedan);
  return n;
}

/**
 * Carga masiva pegando como en Excel: filas ya acomodadas en la app (columna por columna).
 *   d = { periodo, filas: [{ Cliente, Empresa, Legajo, Nombre, Puesto, dias: [valor | [D, N]] }] }
 * Reemplaza lo que había de ese período en el archivo histórico. Si el período tiene datos cargados por
 * los supervisores en la app, no se toca (salvo que se pida "forzar").
 */
function accionPegarDatos_(u, d) {
  exigir_(u, 'cargamasiva', true);
  var periodo = String(d.periodo || '');
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('Elegí el período de los datos pegados.');
  var filas = (d.filas || []).filter(function (f) { return String(f.Nombre || '').trim() || String(f.Legajo || '').trim(); });
  if (!filas.length) throw new Error('No hay filas con nombre o legajo.');
  if (periodoConDatosApp_(periodo) && !d.forzar) throw new Error('Ese período tiene datos cargados por los supervisores en la app: no se reemplaza con lo pegado.');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    pasarHistoricoAlArchivo();
    var ctx = contextoServicios_();
    var res = { periodo: periodo, filas: filas.map(function (f) {
      return { Cliente: String(f.Cliente || '').trim(), Empresa: String(f.Empresa || '').trim(), Legajo: String(f.Legajo || '').replace(/\.0$/, '').trim(),
        Nombre: String(f.Nombre || '').trim().toUpperCase(), Puesto: String(f.Puesto || '').trim(),
        dias: (f.dias || []).slice(0, 31).map(function (x) { return Array.isArray(x) ? valorDesdeDN_(x[0], x[1]) : valorDesdeDN_(x, ''); }) };
    }) };
    var app = filasAppDesdeSTD_(res, ctx, 'histórico');
    var mapa = {}; mapa[periodo] = app;
    histEscribirPeriodos_(mapa);
    ctx.guardar();
    try { CacheService.getScriptCache().remove('histPeriodos'); } catch (e) { }
    return { periodo: periodo, nombrePeriodo: nombrePeriodo_(periodo), filas: app.length,
      servicios: Object.keys(app.reduce(function (a, f) { a[f.ServicioId] = 1; return a; }, {})).length, servNuevos: ctx.nuevos.map(function (s) { return s.Cliente; }) };
  } finally { lock.releaseLock(); }
}


/* ============================================================
   CARGA MASIVA v1.20: REVISAR ANTES DE CARGAR y TODO TIPO DE DATOS
   ============================================================
   1) Se sube el archivo: el original queda en su carpeta y se lee todo lo que tiene, SIN guardar nada:
      - STD (Novedades del Personal, Planificación, STD, 30/31): personas por servicio, horas, siglas raras,
        servicios que no existen en la app;
      - Plus Encargado;
      - cualquier otra pestaña con datos (Facturación, Horas Contratadas vs Realizadas, Totales de las
        conformaciones, Consolidado, Proyección...): como tabla, tal cual (títulos y filas).
   2) Se muestra el resumen para controlar. Recién con "Cargar" se guarda (reemplaza lo anterior del mismo
      período y tipo). Con "Descartar" el archivo va a la papelera.
   Las tablas se guardan en la pestaña "Datos" del Archivo histórico y se ven en Informes (para los períodos
   que no tienen datos en la app) y en Carga masiva > Ver datos.
   ============================================================ */
var HIST_DATOS_ENC_ = ['Periodo', 'Tipo', 'ArchivoId', 'Archivo', 'Pestana', 'Fila', 'Es', 'Datos'];
var TIPO_TABLA_PESTANA_ = [[/^FACTURACION$/, 'Facturación'], [/CONTRATADAS|VS OPERACION|VS REALIZ/, 'Horas Contratadas vs Realizadas'], [/^TOTALES$/, 'Conformación horaria'],
  [/^CONSOLIDADO$/, 'Consolidado'], [/^STD$/, 'STD'], [/^3[01] ?DIAS$/, '30/31 días'], [/INJUSTIFICADO|LICENCIA/, 'Injustificados y Licencias'], [/^PLUS/, 'Plus'], [/^EN[EV]+TOS$|^EVENTOS$/, 'Eventos']];
var PESTANAS_SIN_TABLA_ = /^(DATOS|HOJA ?\d*|PERSONAL|CONSULTA)$/;

// Una pestaña como tabla: busca la fila de títulos (y la de abajo si también son títulos) y las filas con datos.
function tablaDePestana_(sh) {
  var R = Math.min(sh.getLastRow(), 3000), W = Math.min(sh.getLastColumn(), 200);   // v1.21: hasta 200 columnas (STD y 31 días completos)
  if (R < 2 || W < 2) return null;
  var v = sh.getRange(1, 1, R, W).getDisplayValues();
  var esTexto = function (x) { x = String(x || '').trim(); return x && isNaN(Number(x.replace(',', '.'))) && !/^#/.test(x); };
  var hdr = -1, mejor = 0;
  for (var r = 0; r < Math.min(R, 15); r++) {
    var n = v[r].filter(esTexto).length;
    if (n > mejor) { mejor = n; hdr = r; }
  }
  if (hdr < 0 || mejor < 2) return null;
  var cab = v[hdr].map(function (x) { return String(x || '').trim(); });
  // Títulos en dos filas (ej.: "Horas Contratadas" / "Diurnas"): se juntan
  if (hdr + 1 < R) {
    var sig = v[hdr + 1], txt = sig.filter(esTexto).length, num = sig.filter(function (x) { return x && !esTexto(x); }).length;
    if (txt >= 2 && num <= 1) {
      var arrastre = '';
      cab = cab.map(function (c, i) { if (c) arrastre = c; var b = String(sig[i] || '').trim(); return b ? ((c || arrastre) ? (c || arrastre) + ' ' : '') + b : c; });
      hdr++;
    }
  }
  // Columnas útiles: hasta la última con título o con datos
  var ultCol = 0;
  cab.forEach(function (c, i) { if (c) ultCol = i; });
  var filas = [], vacias = 0;
  for (var r2 = hdr + 1; r2 < R; r2++) {
    var f = v[r2].slice(0, W);
    if (!f.some(function (x) { return String(x || '').trim(); })) { if (++vacias >= 5) break; continue; }
    vacias = 0;
    f.forEach(function (x, i) { if (String(x || '').trim() && i > ultCol) ultCol = i; });
    filas.push(f);
  }
  if (!filas.length) return null;
  ultCol = Math.min(ultCol, W - 1);
  cab = cab.slice(0, ultCol + 1).map(function (c, i) { return c || ('Col ' + (i + 1)); });
  return { pestana: sh.getName(), cab: cab, filas: filas.map(function (f) { return f.slice(0, ultCol + 1); }) };
}

function tipoTablaDe_(pestana, tipoArchivo) {
  var n = normT_(pestana);
  for (var i = 0; i < TIPO_TABLA_PESTANA_.length; i++) if (TIPO_TABLA_PESTANA_[i][0].test(n)) return TIPO_TABLA_PESTANA_[i][1];
  return tipoArchivo || 'Otro';
}

// Lee un archivo sin guardar nada. Devuelve el resumen (para mostrar) y lo leído (para cargar después).
function analizarArchivo_(id, nombre, tipo, periodo) {
  var out = { tipo: tipo, periodo: periodo || '', std: null, plus: [], tablas: [], avisos: [], resumen: {} };
  if (!/\.(xls[xmb]?|csv)$/i.test(nombre) && !esPlanillaGoogle_(id)) { out.avisos.push('Es un ' + (nombre.split('.').pop() || 'archivo') + ': se guarda para consultar, no tiene datos para pasar.'); return out; }
  var tmp = convertirTemporal_(id);
  try {
    var ss = tmp.ss;
    try { out.std = leerSTDHistorico_(ss); out.periodo = out.std.periodo; } catch (e) { out.std = null; }
    var ctxSeco = contextoServicios_();
    if (out.periodo) { try { out.plus = leerPlusHistorico_(ss, out.periodo, ctxSeco); } catch (e) { out.plus = []; } }
    var conSTD = !!out.std;
    ss.getSheets().forEach(function (sh) {
      if (out.tablas.length >= 40 || sh.isSheetHidden()) return;
      var n = normT_(sh.getName());
      if (PESTANAS_SIN_TABLA_.test(n)) return;
      if (/^PLUS/.test(n) && out.plus.length) return;
      // De Novedades / Planificación (que traen STD) se guardan como tabla Facturación, Consolidado, 30/31, Licencias y Eventos;
      // las pestañas de cada servicio no (sus datos ya están en el STD).
      var tt = tipoTablaDe_(sh.getName(), '');
      if (conSTD && tt === 'Otro') return;
      var t = null;
      try { t = tablaDePestana_(sh); } catch (e) { }
      if (t) { t.tipo = tipoTablaDe_(sh.getName(), tipo); out.tablas.push(t); }
    });
    if (!out.periodo) out.periodo = periodo || '';
    // Resumen para controlar
    var r = out.resumen;
    if (out.std) {
      var ctx = contextoServicios_(), validos = codigosValidos_(), porServ = {}, raras = {};
      out.std.filas.forEach(function (f) {
        var sid = ctx.idDe(f.Cliente, f.Empresa), k = f.Cliente || '(sin cliente)';
        var x = porServ[k] = porServ[k] || { cliente: k, sid: sid, nuevo: ctx.nuevos.some(function (s) { return s.Id === sid; }), personas: 0, d: 0, n: 0, codigos: {} };
        x.personas++;
        f.dias.forEach(function (val) {
          var c = leerCelda_(val);
          if (c.tipo === 'horas') { x.d += c.d; x.n += c.n; }
          else if (c.tipo === 'codigo') { x.codigos[c.cod] = (x.codigos[c.cod] || 0) + 1; if (!validos[c.cod]) raras[c.cod] = (raras[c.cod] || 0) + 1; }
        });
      });
      r.servicios = Object.keys(porServ).map(function (k) { var x = porServ[k]; x.d = Math.round(x.d * 10) / 10; x.n = Math.round(x.n * 10) / 10; x.app = x.nuevo ? '' : ((leer_('Servicios').filter(function (s) { return s.Id === x.sid; })[0] || {}).Servicio || ''); return x; });
      r.filasSTD = out.std.filas.length;
      r.siglasRaras = raras;
      if (Object.keys(raras).length) out.avisos.push('Siglas que no están en Códigos (quedan en blanco en los informes): ' + Object.keys(raras).map(function (k) { return k + ' (' + raras[k] + ')'; }).join(', ') + '.');
      var nuevos = r.servicios.filter(function (x) { return x.nuevo; });
      if (nuevos.length) out.avisos.push('Servicios que no están en la app y se van a crear dados de baja: ' + nuevos.map(function (x) { return x.cliente; }).join(', ') + '.');
      if (periodoConDatosApp_(out.periodo)) out.avisos.push(nombrePeriodo_(out.periodo) + ' ya tiene datos cargados por los supervisores: el STD de este archivo no los reemplaza (sí se guardan las tablas y el plus).');
    }
    r.plus = out.plus.length;
    r.tablas = out.tablas.map(function (t) { return { pestana: t.pestana, tipo: t.tipo, filas: t.filas.length, columnas: t.cab.length, cab: t.cab.slice(0, 12) }; });
    if (!out.std && !out.plus.length && !out.tablas.length) out.avisos.push('No se encontraron datos para pasar: se guarda solo el archivo.');
    if (!out.periodo) out.avisos.push('No se reconoció el período: elegilo antes de cargar.');
    return out;
  } finally {
    if (tmp && tmp.temporal) { try { DriveApp.getFileById(tmp.temporal).setTrashed(true); } catch (e2) { } }
  }
}

// Hoja "Datos" del Archivo histórico (las tablas cargadas).
function hojaDatosHist_(crear) {
  var ss = archivoHist_(crear);
  if (!ss) return null;
  var h = ss.getSheetByName('Datos');
  if (!h && crear) { h = ss.insertSheet('Datos'); h.getRange(1, 1, 1, HIST_DATOS_ENC_.length).setValues([HIST_DATOS_ENC_]).setFontWeight('bold'); h.setFrozenRows(1); }
  return h;
}
// Guarda tablas de un período y tipo (reemplaza las anteriores del mismo período y tipo).
function guardarTablasHist_(periodo, archivoId, archivo, tablas) {
  if (!tablas.length) return 0;
  var h = hojaDatosHist_(true), n = h.getLastRow() - 1, W = HIST_DATOS_ENC_.length;
  var tipos = {}; tablas.forEach(function (t) { tipos[t.tipo] = 1; });
  var nuevas = [];
  tablas.forEach(function (t) {
    nuevas.push([periodo, t.tipo, archivoId, archivo, t.pestana, '0', 'T', JSON.stringify(t.cab)]);
    t.filas.forEach(function (f, i) { nuevas.push([periodo, t.tipo, archivoId, archivo, t.pestana, String(i + 1), 'D', JSON.stringify(f).slice(0, 49000)]); });
  });
  // v1.21: si no hay nada que reemplazar se agrega al final (sin reescribir toda la hoja)
  var abc = n > 0 ? h.getRange(2, 1, n, 3).getDisplayValues() : [];
  var hayViejas = abc.some(function (f) { return (f[0] === periodo && tipos[f[1]]) || f[2] === archivoId; });
  if (!hayViejas) {
    var r0 = n + 2;
    if (h.getMaxRows() < r0 + nuevas.length) h.insertRowsAfter(h.getMaxRows(), r0 + nuevas.length - h.getMaxRows());
    h.getRange(r0, 1, nuevas.length, W).setNumberFormat('@').setValues(nuevas);
    try { CacheService.getScriptCache().remove('datosHistIdx'); } catch (e) { }
    return nuevas.length;
  }
  var viejas = n > 0 ? h.getRange(2, 1, n, W).getDisplayValues() : [];
  var quedan = viejas.filter(function (f) { return !(f[0] === periodo && tipos[f[1]]) && f[2] !== archivoId; });
  var todas = quedan.concat(nuevas);
  if (n > 0) h.getRange(2, 1, n, W).clearContent();
  if (h.getMaxRows() < todas.length + 1) h.insertRowsAfter(h.getMaxRows(), todas.length + 1 - h.getMaxRows());
  if (todas.length) h.getRange(2, 1, todas.length, W).setNumberFormat('@').setValues(todas);
  try { CacheService.getScriptCache().remove('datosHistIdx'); } catch (e) { }
  return nuevas.length;
}
// Tablas guardadas de un período (y tipo, opcional): [{ tipo, pestana, archivo, cab, filas }]
function tablasHist_(periodo, tipo) {
  var h = hojaDatosHist_(false);
  if (!h || h.getLastRow() < 2) return [];
  var n = h.getLastRow() - 1, ab = h.getRange(2, 1, n, 2).getDisplayValues(), ini = -1, fin = -1;
  for (var i = 0; i < n; i++) if (ab[i][0] === periodo && (!tipo || ab[i][1] === tipo)) { if (ini < 0) ini = i; fin = i; }
  if (ini < 0) return [];
  var v = h.getRange(2 + ini, 1, fin - ini + 1, HIST_DATOS_ENC_.length).getDisplayValues(), out = {}, orden = [];
  v.forEach(function (f) {
    if (f[0] !== periodo || (tipo && f[1] !== tipo)) return;
    var k = f[2] + '|' + f[4];
    if (!out[k]) { out[k] = { tipo: f[1], archivoId: f[2], archivo: f[3], pestana: f[4], cab: [], filas: [] }; orden.push(k); }
    var x; try { x = JSON.parse(f[7]); } catch (e) { x = []; }
    if (f[6] === 'T') out[k].cab = x; else out[k].filas.push(x);
  });
  return orden.map(function (k) { return out[k]; });
}
// Qué tablas hay por período (para la ventana Carga masiva)
function indiceTablasHist_() {
  var h = hojaDatosHist_(false), out = {};
  if (!h || h.getLastRow() < 2) return out;
  h.getRange(2, 1, h.getLastRow() - 1, 7).getDisplayValues().forEach(function (f) {
    if (f[6] !== 'T') return;
    (out[f[0]] = out[f[0]] || []).push({ tipo: f[1], archivoId: f[2], archivo: f[3], pestana: f[4] });
  });
  return out;
}

// Paso 1 (revisar) y paso 2 (cargar o descartar) de la carga masiva.
function accionRevisarArchivo_(u, d) {
  exigir_(u, 'cargamasiva', true);
  if (d.modo === 'descartar') {
    try { DriveApp.getFileById(d.archivoId).setTrashed(true); } catch (e) { }
    return { descartado: true };
  }
  if (d.modo === 'cargar') return cargarArchivoRevisado_(u, d);
  if (!d.base64) throw new Error('No llegó el archivo.');
  var nombre = String(d.nombre || 'archivo.xlsx');
  var ext = (nombre.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  var mime = { xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    pdf: 'application/pdf', csv: 'text/csv' }[ext.toLowerCase()] || 'application/octet-stream';
  var tipo = d.tipo || tipoArchivo_(nombre);
  var orig = (CARPETA_TIPO_[tipo] ? subcarpeta_(CARPETA_TIPO_[tipo]) : carpetaOriginalesHist_()).createFile(Utilities.newBlob(Utilities.base64Decode(d.base64), mime, nombre));
  try { orig.addViewer(u.email); } catch (e) { }
  var per = d.periodo || periodoDesdeTexto_(nombre);
  var a = analizarArchivo_(orig.getId(), nombre, tipo, per);
  cacheJSONPut_('ANA|' + orig.getId(), { std: a.std, plus: a.plus, tablas: a.tablas, periodo: a.periodo, tipo: tipo, nombre: nombre }, 21600);
  return { archivoId: orig.getId(), nombre: nombre, tipo: tipo, periodo: a.periodo, nombrePeriodo: a.periodo ? nombrePeriodo_(a.periodo) : '', resumen: a.resumen, avisos: a.avisos,
    original: 'https://drive.google.com/file/d/' + orig.getId() + '/view' };
}

function cargarArchivoRevisado_(u, d) {
  var id = d.archivoId, a = cacheJSONGet_('ANA|' + id);
  var f = DriveApp.getFileById(id), nombre = f.getName();
  if (!a) { var x = analizarArchivo_(id, nombre, d.tipo || tipoArchivo_(nombre), d.periodo); a = { std: x.std, plus: x.plus, tablas: x.tablas, periodo: x.periodo, tipo: d.tipo || tipoArchivo_(nombre), nombre: nombre }; }
  var per = d.periodo || a.periodo, tipo = d.tipo || a.tipo;
  if (!per) throw new Error('Elegí el período del archivo.');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    pasarHistoricoAlArchivo();
    var ctx = contextoServicios_(), out = { filas: 0, servicios: 0, plus: 0, tablas: 0, enApp: false };
    if (a.std && a.std.filas && a.std.filas.length) {
      try { guardarSupHist_(per, a.std.filas); } catch (e) { }
      a.std.periodo = per;
      out.enApp = periodoConDatosApp_(per);
      if (!out.enApp) {
        var filas = filasAppDesdeSTD_(a.std, ctx);
        var mapa = {}; mapa[per] = filas; histEscribirPeriodos_(mapa);
        out.filas = filas.length;
        out.servicios = Object.keys(filas.reduce(function (o, r) { o[r.ServicioId] = 1; return o; }, {})).length;
      }
    }
    if (a.plus && a.plus.length) {
      var plus = a.plus.map(function (p) { var o = {}; Object.keys(p).forEach(function (k) { o[k] = p[k]; }); o.Periodo = per; o.ServicioId = p._serv ? ctx.idDe(p._serv, p._emp || '') : ''; return o; });
      out.plus = guardarPlusHistorico_(per, plus);
    }
    if (a.tablas && a.tablas.length) out.tablas = guardarTablasHist_(per, id, nombre, a.tablas);
    ctx.guardar();
    out.servNuevos = ctx.nuevos.map(function (s) { return s.Cliente; });
    registrarOriginalHist_(u, per, f, out.filas || '', tipo, 'Subido');
    if (d.reemplazar !== false) { try { out.reemplazados = reemplazarAnteriores_(per, tipo, id); } catch (e) { } }
    try { CacheService.getScriptCache().remove('histPeriodos'); } catch (e) { }
    out.periodo = per; out.nombrePeriodo = nombrePeriodo_(per); out.tipo = tipo;
    return out;
  } finally { lock.releaseLock(); }
}

/**
 * Pegar una tabla (Facturación, Horas Contratadas vs Realizadas, Plus, Conformación, otro):
 *   d = { periodo, tipo, cab: [...], filas: [[...]], nombre }
 * Si es Plus, además se pasa al plus del período (columnas LP / Apellido y Nombre / Servicio / Días / Plus en $).
 */
function accionPegarTabla_(u, d) {
  exigir_(u, 'cargamasiva', true);
  var periodo = String(d.periodo || '');
  if (!/^\d{4}-\d{2}$/.test(periodo)) throw new Error('Elegí el período.');
  var cab = (d.cab || []).map(String), filas = (d.filas || []).filter(function (f) { return f.some(function (x) { return String(x || '').trim(); }); });
  if (!filas.length) throw new Error('No hay filas para cargar.');
  var tipo = d.tipo || 'Otro', id = 'PEGADO-' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd-HHmmss');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var out = { periodo: periodo, nombrePeriodo: nombrePeriodo_(periodo), filas: filas.length, plus: 0 };
    out.tablas = guardarTablasHist_(periodo, id, d.nombre || ('Pegado ' + tipo), [{ tipo: tipo, pestana: tipo, cab: cab, filas: filas }]);
    if (tipo === 'Plus') {
      var ix = function (re) { for (var i = 0; i < cab.length; i++) if (re.test(normT_(cab[i]))) return i; return -1; };
      var cL = ix(/^(LP|LEGAJO)$/), cN = ix(/APELLIDO|NOMBRE/), cS = ix(/SERVICIO|CLIENTE|OBJETIVO/), cD = ix(/DIAS/), cP = ix(/PLUS EN|\$|IMPORTE|MONTO/), cF = ix(/FUNCION/);
      var ctx = contextoServicios_();
      var plus = filas.filter(function (f) { return cN >= 0 && String(f[cN] || '').trim(); }).map(function (f) {
        var serv = cS >= 0 ? String(f[cS] || '').trim() : '';
        return { Periodo: periodo, ServicioId: serv ? ctx.idDe(serv, '') : '', Legajo: cL >= 0 ? String(f[cL] || '').replace(/\.0$/, '').trim() : '', Nombre: String(f[cN]).trim().toUpperCase(),
          Funcion: cF >= 0 && f[cF] ? String(f[cF]) : 'Encargado', Dias: cD >= 0 ? String(f[cD] || '') : '', Observaciones: cP >= 0 && f[cP] ? 'Plus $ ' + f[cP] : '', CargadoPor: 'histórico', Fecha: ahora_() };
      });
      out.plus = guardarPlusHistorico_(periodo, plus);
      ctx.guardar();
    }
    // Queda anotado en lo cargado
    var h = hojaCatalogo_(true), r0 = h.getLastRow() + 1;
    h.getRange(r0, 1, 1, HIST_ARCH_ENC_.length).setNumberFormat('@').setValues([[periodo, d.nombre || ('Pegado ' + tipo), id, u.usuario, ahora_(), String(filas.length), tipo, 'Pegado']]);
    return out;
  } finally { lock.releaseLock(); }
}

function accionVerTablas_(u, d) {
  exigir_(u, 'cargamasiva', false);
  return { periodo: d.periodo, nombrePeriodo: nombrePeriodo_(d.periodo), tablas: tablasHist_(d.periodo, d.tipo || '') };
}


/* ===================== v1.21 · Volver a leer los archivos históricos =====================
 * Recorre lo cargado (catálogo) y vuelve a leer cada Excel con datos: el Plus Encargado pasa al plus del período
 * (si el período no tiene plus cargado en la app) y las pestañas (Facturación, STD, 30/31 días, Consolidado, Plus,
 * Licencias, Eventos, Horas Contratadas...) quedan guardadas completas para verlas en "Ver datos".
 * La planilla (STD) de los períodos no se toca. Va de a tandas de unos 4 minutos: se sigue solo hasta terminar.
 */
function accionReprocesarHistorico_(u, d) {
  exigir_(u, 'cargamasiva', true);
  var pr = PropertiesService.getScriptProperties(), K = 'REPROC_IDX';
  if (d && d.reiniciar) pr.deleteProperty(K);
  var lista = catalogo_().filter(function (o) {
    return o.ArchivoId && !/^PEGADO/.test(o.ArchivoId) && /\.(xls[xmb]?|csv)$/i.test(o.Archivo || '') && o.Periodo;
  });
  // v1.21.2: los Excel de las carpetas del histórico de Drive que no están en lo cargado (se trajeron antes del catálogo)
  var nuevosCat = [];
  try {
    var arch = archivosHistoricoCache_(), conNov = {};
    arch.forEach(function (a) { if (tipoArchivo_(a.nombre) === 'Novedades del Personal') conNov[periodoDesdeTexto_(a.carpeta) || periodoDesdeTexto_(a.nombre)] = 1; });
    arch.forEach(function (a) {
      if (!/\.(xls[xmb]?)$/i.test(a.nombre) || lista.some(function (o) { return o.ArchivoId === a.id; })) return;
      var t = tipoArchivo_(a.nombre), per = periodoDesdeTexto_(a.carpeta) || periodoDesdeTexto_(a.nombre);
      if (!per || t === 'Otro' || (t === 'Planificación' && conNov[per])) return;
      lista.push({ ArchivoId: a.id, Archivo: a.nombre, Tipo: t, Periodo: per, _drive: true });
    });
  } catch (e) { Logger.log('Reprocesar (Drive): ' + e.message); }
  lista = lista.sort(function (a, b) { return a.Periodo < b.Periodo ? -1 : a.Periodo > b.Periodo ? 1 : String(a.ArchivoId).localeCompare(String(b.ArchivoId)); });
  var desde = Number(pr.getProperty(K) || 0), inicio = Date.now(), log = [], plusN = 0, tablasN = 0, i = desde;
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ctx = contextoServicios_();
    for (; i < lista.length; i++) {
      if (Date.now() - inicio > 220000) break;
      var o = lista[i];
      try {
        var a = analizarArchivo_(o.ArchivoId, o.Archivo, o.Tipo || tipoArchivo_(o.Archivo), o.Periodo);
        var per = o.Periodo || a.periodo;
        if (a.plus && a.plus.length) {
          var plus = a.plus.map(function (p) { var x = {}; Object.keys(p).forEach(function (k) { x[k] = p[k]; }); x.Periodo = per; x.ServicioId = p._serv ? ctx.idDe(p._serv, p._emp || '') : ''; return x; });
          var n = guardarPlusHistorico_(per, plus); plusN += n;
          if (n) try { PropertiesService.getScriptProperties().deleteProperty('PLUSCHK|' + per); } catch (e) { }
        }
        if (a.tablas && a.tablas.length) tablasN += guardarTablasHist_(per, o.ArchivoId, o.Archivo, a.tablas) ? a.tablas.length : 0;
        if (a.std && a.std.filas && a.std.filas.length && /Novedades|Planificaci|STD|30\/31/i.test(o.Tipo || '')) { try { guardarSupHist_(per, a.std.filas); } catch (e) { } }
        log.push(o.Archivo + ': ' + (a.plus ? a.plus.length : 0) + ' de plus · ' + (a.tablas ? a.tablas.length : 0) + ' pestañas (' + nombrePeriodo_(per) + ').');
        if (o._drive) nuevosCat.push({ periodo: per, nombre: o.Archivo, id: o.ArchivoId, filas: '', tipo: o.Tipo, origen: 'Drive' });
      } catch (e) { log.push(o.Archivo + ': ' + e.message); }
      pr.setProperty(K, String(i + 1));
    }
    ctx.guardar();
    if (nuevosCat.length) { try { registrarVarios_(null, nuevosCat); } catch (e) { Logger.log('Catálogo: ' + e.message); } }
  } finally { lock.releaseLock(); }
  var fin = i >= lista.length;
  if (fin) pr.deleteProperty(K);
  try { CacheService.getScriptCache().removeAll(['datosHistIdx', 'histPeriodos']); } catch (e) { }
  return { total: lista.length, hechos: i, fin: fin, plus: plusN, tablas: tablasN, log: log };
}


// Lista de archivos de las carpetas del histórico, guardada una hora (recorrer las carpetas de Drive tarda).
function archivosHistoricoCache_() {
  var k = 'histArchLista', c = null;
  try { c = cacheJSONGet_(k); } catch (e) { }
  if (c) return c;
  var l = archivosHistorico_([]);
  try { cacheJSONPut_(k, l, 3600); } catch (e) { }
  return l;
}


/* ===================== v1.21.2 · Período desde la Planificación de la empresa en Drive =====================
 * Para las conformaciones: si un período (o algunos de sus servicios) no está cargado en la app, se busca en Drive
 * el Excel de la empresa de ese período (Novedades del Personal o, si todavía no está, la Planificación) y su
 * pestaña STD se guarda en el archivo histórico. Lo cargado en la app siempre manda (servicio por servicio).
 * Se vuelve a leer solo si el archivo cambió (se mira cada 30 minutos como mucho).
 */
function asegurarPeriodoDrive_(periodo) {
  if (!/^\d{4}-\d{2}$/.test(String(periodo || ''))) return 0;
  var cache = CacheService.getScriptCache(), k = 'DRVPER2|' + periodo;   // v1.22.6: se vuelve a leer una vez (ahora con los comentarios)
  if (cache.get(k)) return 0;
  cache.put(k, '1', 1800);
  var nom = nombrePeriodo_(periodo).replace(/'/g, "\\'");
  var it = DriveApp.searchFiles("title contains '" + nom + "' and trashed = false"), best = null;
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (!/\.xls[xmb]?$/i.test(n)) continue;                         // solo los Excel de la empresa (no lo que arma la app)
    var t = normT_(n);
    var pr = /NOVEDADES DEL PERSONAL/.test(t) ? 2 : /PLANIFICACION/.test(t) ? 1 : 0;
    if (!pr || periodoDesdeTexto_(n) !== periodo) continue;
    if (!best || pr > best.pr || (pr === best.pr && f.getLastUpdated() > best.f.getLastUpdated())) best = { f: f, pr: pr };
  }
  if (!best) return 0;
  var props = PropertiesService.getScriptProperties(), marca = best.f.getId() + '|' + best.f.getLastUpdated().getTime();
  if (props.getProperty('DRVPER2|' + periodo) === marca) return 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) return 0;
  var tmp = null;
  try {
    if (props.getProperty('DRVPER2|' + periodo) === marca) return 0;
    tmp = convertirTemporal_(best.f.getId());
    var res = leerSTDHistorico_(tmp.ss);
    if (res.periodo && res.periodo !== periodo) { props.setProperty('DRVPER2|' + periodo, marca); return 0; }
    res.periodo = periodo;
    var ctx = contextoServicios_();
    var filas = filasAppDesdeSTD_(res, ctx, 'histórico');
    try { guardarSupHist_(periodo, res.filas); } catch (e) { }
    var mapa = {}; mapa[periodo] = filas;
    histEscribirPeriodos_(mapa);
    try { guardarPlusHistorico_(periodo, leerPlusHistorico_(tmp.ss, periodo, ctx)); } catch (e) { }
    ctx.guardar();
    try { registrarVarios_(null, [{ periodo: periodo, nombre: best.f.getName(), id: best.f.getId(), filas: filas.length, tipo: tipoArchivo_(best.f.getName()), origen: 'Drive' }]); } catch (e) { }
    MEMO_HISTP_[periodo] = null;
    try { CacheService.getScriptCache().removeAll(['histPeriodos', 'perDatos|']); } catch (e) { }
    props.setProperty('DRVPER2|' + periodo, marca);
    return filas.length;
  } finally {
    if (tmp && tmp.temporal) { try { DriveApp.getFileById(tmp.temporal).setTrashed(true); } catch (e2) { } }
    lock.releaseLock();
  }
}


/* ===================== v1.21.2 · Supervisor de cada período =====================
 * La zona de un supervisor cambia con el tiempo (en 2023 un objetivo podía ser de otro supervisor).
 * De la columna Supervisor del STD de cada archivo histórico se guarda quién era el supervisor de cada
 * persona y objetivo en ese período (pestaña "Supervisores" del archivo histórico). Ausencias lo usa.
 */
function guardarSupHist_(periodo, filasSTD) {
  var filas = (filasSTD || []).filter(function (f) { return f.Supervisor; });
  if (!periodo || !filas.length) return 0;
  var ss = archivoHist_(true), h = ss.getSheetByName('Supervisores');
  if (!h) { h = ss.insertSheet('Supervisores'); h.getRange(1, 1, 1, 5).setValues([['Periodo', 'Legajo', 'Nombre', 'Objetivo', 'Supervisor']]).setFontWeight('bold'); h.setFrozenRows(1); }
  var n = h.getLastRow() - 1, viejas = n > 0 ? h.getRange(2, 1, n, 5).getDisplayValues() : [];
  var quedan = viejas.filter(function (f) { return f[0] && f[0] !== periodo; }), visto = {};
  filas.forEach(function (f) {
    var k = (f.Legajo || f.Nombre) + '|' + f.Cliente; if (visto[k]) return; visto[k] = 1;
    quedan.push([periodo, String(f.Legajo || ''), String(f.Nombre || ''), String(f.Cliente || ''), String(f.Supervisor || '')]);
  });
  if (n > 0) h.getRange(2, 1, n, 5).clearContent();
  if (h.getMaxRows() < quedan.length + 1) h.insertRowsAfter(h.getMaxRows(), quedan.length + 1 - h.getMaxRows());
  h.getRange(2, 1, quedan.length, 5).setNumberFormat('@').setValues(quedan);
  try { CacheService.getScriptCache().remove('supHist3'); } catch (e) { }
  return filas.length;
}
// { 'AAAA-MM': { 'L|legajo': sup, 'N|NOMBRE': sup, 'O|OBJETIVO': sup } }
function supHist_() {
  var c = null; try { c = cacheJSONGet_('supHist3'); } catch (e) { }
  if (c) return c;
  var out = {};
  try {
    var ss = archivoHist_(false), h = ss ? ss.getSheetByName('Supervisores') : null;
    if (h && h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, 5).getDisplayValues().forEach(function (f) {
      if (!f[0] || !f[4]) return;
      var m = out[f[0]] = out[f[0]] || {};
      if (f[1]) m['L|' + f[1] + '|' + (normT_(f[2]).split(' ')[0] || '')] = f[4];   // legajo + apellido (el legajo se repite entre empresas)
      if (f[2]) m['N|' + normT_(f[2])] = f[4];
      if (f[3]) m['O|' + normT_(f[3])] = f[4];
    });
  } catch (e) { Logger.log('Supervisores históricos: ' + e.message); }
  try { cacheJSONPut_('supHist3', out, 3600); } catch (e) { }
  return out;
}
