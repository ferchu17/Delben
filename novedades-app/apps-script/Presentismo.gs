/**
 * ============================================================
 * PRESENTISMO GENERAL
 * ============================================================
 * La planilla "Presentismo General" (una fila por período, persona y servicio,
 * desde abril 2023) queda como un archivo aparte en Drive, con su formato
 * original. No se mete dentro de la base de la app porque es muy pesada
 * (13.700 filas x 213 columnas) y haría lenta la carga de todas las pantallas.
 *
 * La app:
 *   - Agrega o actualiza un período con los mismos 213 columnas
 *     (período, persona, cada día con Fecha / Día / D / N, horas, estados,
 *     días, DNI, CUIT, fechas, total por día y feriados).
 *   - Busca en ella (por persona, legajo, cliente y rango de períodos) sin cargarla entera.
 *   - Descarga lo buscado en Excel con el mismo formato.
 * ============================================================
 */

var PRESENTISMO_POR_DEFECTO = '1EfBy_YjzD9UAPk9TiQwknDH8_XvbVHbvry0r6G9S24c'; // Presentismo General (planilla de Google)
var PRES_COLS = 213, PRES_FILA_DATOS = 6;
var PRES_ESTADOS = ['FCO', 'YNG', 'INJ', 'LSG', 'ENF', 'ART', 'VAC', 'DV', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'CAS', 'BAJA'];

function hojaPresentismo_() {
  var id = String(config_().PRESENTISMO_ID || PRESENTISMO_POR_DEFECTO).trim();
  var m = id.match(/\/d\/([a-zA-Z0-9_-]+)/); if (m) id = m[1];
  var ss;
  try { ss = SpreadsheetApp.openById(id); } catch (e) { throw new Error('No se pudo abrir el Presentismo General. Revisá el enlace en Datos.'); }
  return ss.getSheetByName('Hoja1') || ss.getSheets()[0];
}

// "2026-08" -> 41 (abril 2023 es el 1)
function numeroPeriodo_(p) { return (Number(p.slice(0, 4)) - 2023) * 12 + (Number(p.slice(5, 7)) - 4) + 1; }
function etiquetaPeriodo_(p) {
  var i = periodoInfo_(p), a = i.desde, b = i.hasta;
  var m1 = MESES_[a.getUTCMonth()], m2 = MESES_[b.getUTCMonth()];
  return numeroPeriodo_(p) + '- ' + (a.getUTCFullYear() !== b.getUTCFullYear()
    ? m1 + ' ' + a.getUTCFullYear() + ' - ' + m2 + ' ' + b.getUTCFullYear()
    : m1 + ' - ' + m2 + ' ' + b.getUTCFullYear());
}
function numeroDeEtiqueta_(t) { var m = String(t || '').match(/^\s*(\d+)/); return m ? Number(m[1]) : 0; }

// Una fila de 213 columnas, igual al Presentismo General.
function filaPresentismo_(f, ctx, etiqueta) {
  var x = estadisticasFila_(f, ctx), ficha = fichaPara_(ctx.fichas, f), serv = ctx.servs[f.ServicioId] || {};
  var row = new Array(PRES_COLS).fill('');
  row[0] = etiqueta; row[1] = f.Empresa; row[2] = f.Legajo ? Number(f.Legajo) || f.Legajo : ''; row[3] = f.Nombre;
  row[4] = ficha.Categoria || ''; row[5] = f.Puesto || (f.Seccion === 'RETEN' ? 'Reten' : f.Seccion === 'EVENTO' ? 'Eventual' : '');
  row[6] = serv.Cliente || serv.Servicio || '';
  var feriados = [];
  for (var i = 0; i < 31; i++) {
    var c0 = 7 + 4 * i;
    if (i >= ctx.n) continue;
    var d = fechaDia_(ctx.periodo, i);
    row[c0] = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    row[c0 + 1] = DIAS_NOMBRE_[(d.getUTCDay() + 6) % 7];
    var D = x.dias[i][0], N = x.dias[i][1];
    row[c0 + 2] = D === '' ? 0 : D; row[c0 + 3] = N === '' ? 0 : N;
    var tot = typeof D === 'number' ? D + (Number(N) || 0) : 0;
    row[172 + i] = tot;
    if (esFeriado_(d)) feriados.push(tot);
  }
  row[131] = x.D; row[132] = x.N; row[133] = x.tot; row[134] = x.iD; row[135] = x.iN; row[136] = x.rD; row[137] = x.rN;
  row[138] = x.de; row[139] = x.liq; row[140] = x.extras; row[141] = x.noc; row[142] = x.dif;
  PRES_ESTADOS.forEach(function (k, j) { row[143 + j] = x.est[k] || 0; });
  row[158] = x.ferTrab; row[160] = x.trab; row[161] = ctx.n;
  row[163] = ficha.Dni ? Number(ficha.Dni) || ficha.Dni : ''; row[164] = ficha.Cuil || ''; row[165] = ficha.Nacimiento || ''; row[166] = ficha.Ingreso || '';
  for (var k = 0; k < 9; k++) row[204 + k] = feriados[k] !== undefined ? feriados[k] : 0;
  return row;
}

/**
 * Agrega o reemplaza un período en el Presentismo General con lo cargado en la app.
 */
function actualizarPresentismo_(periodo) {
  var sh = hojaPresentismo_();
  var num = numeroPeriodo_(periodo), etiqueta = etiquetaPeriodo_(periodo);
  var filas = filasDelPeriodo_(periodo, function (f) { return f.Seccion !== 'EVENTO'; });
  if (!filas.length) throw new Error('El período ' + nombrePeriodo_(periodo) + ' no tiene datos en la app.');
  var ctx = contextoInforme_(periodo);
  var vals = filas.map(function (f) { return filaPresentismo_(f, ctx, etiqueta); });
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    // Borrar las filas que ya tenía ese período (de abajo hacia arriba)
    var ult = sh.getLastRow();
    if (ult >= PRES_FILA_DATOS) {
      var colA = sh.getRange(PRES_FILA_DATOS, 1, ult - PRES_FILA_DATOS + 1, 1).getValues();
      var tramos = [], ini = -1;
      for (var i = 0; i <= colA.length; i++) {
        var es = i < colA.length && numeroDeEtiqueta_(colA[i][0]) === num;
        if (es && ini < 0) ini = i;
        if (!es && ini >= 0) { tramos.push([ini, i - ini]); ini = -1; }
      }
      tramos.reverse().forEach(function (t) { sh.deleteRows(PRES_FILA_DATOS + t[0], t[1]); });
    }
    // Insertar en orden de período
    ult = sh.getLastRow();
    var colA2 = ult >= PRES_FILA_DATOS ? sh.getRange(PRES_FILA_DATOS, 1, ult - PRES_FILA_DATOS + 1, 1).getValues() : [];
    var pos = PRES_FILA_DATOS + colA2.length;
    for (var j = 0; j < colA2.length; j++) if (numeroDeEtiqueta_(colA2[j][0]) > num) { pos = PRES_FILA_DATOS + j; break; }
    if (pos <= sh.getLastRow()) sh.insertRowsBefore(pos, vals.length);
    else if (sh.getMaxRows() < pos + vals.length - 1) sh.insertRowsAfter(sh.getMaxRows(), pos + vals.length - 1 - sh.getMaxRows());
    sh.getRange(pos, 1, vals.length, PRES_COLS).setValues(vals);
  } finally { lock.releaseLock(); borrarIndicePresentismo_(); }
  return { periodo: etiqueta, filas: vals.length };
}

/**
 * Búsqueda: q = { texto, cliente, desde, hasta } (desde/hasta en "AAAA-MM").
 * Solo se leen las columnas A a G de toda la planilla; las filas completas, solo las encontradas.
 */
// Índice de búsqueda (período, legajo, nombre y cliente de cada fila), guardado en caché por 6 horas en partes.
function indicePresentismo_(sh) {
  var cache = CacheService.getScriptCache(), cab = cache.get('presIdx_n');
  if (cab) {
    var n = Number(cab), keys = [];
    for (var k = 0; k < n; k++) keys.push('presIdx_' + k);
    var partes = cache.getAll(keys);
    if (Object.keys(partes).length === n) {
      var out = [];
      for (var k2 = 0; k2 < n; k2++) out = out.concat(JSON.parse(partes['presIdx_' + k2]));
      return out;
    }
  }
  var ult = sh.getLastRow();
  if (ult < PRES_FILA_DATOS) return [];
  var v = sh.getRange(PRES_FILA_DATOS, 1, ult - PRES_FILA_DATOS + 1, 7).getDisplayValues();
  var idx = v.map(function (r) { return [String(r[0]), String(r[2]), String(r[3]), String(r[6])]; });
  try {
    var trozos = {}, t = 0, tam = 1200;
    for (var i = 0; i < idx.length; i += tam) trozos['presIdx_' + (t++)] = JSON.stringify(idx.slice(i, i + tam));
    cache.putAll(trozos, 21600); cache.put('presIdx_n', String(t), 21600);
  } catch (e) { /* sin caché */ }
  return idx;
}
function borrarIndicePresentismo_() { try { CacheService.getScriptCache().remove('presIdx_n'); } catch (e) { } }

// Lee varias filas sueltas en una sola llamada (API de Sheets); si no se puede, de a tramos.
function leerFilasPresentismo_(sh, filas) {
  var out = [];
  if (!filas.length) return out;
  var tramos = [];
  for (var a = 0; a < filas.length;) { var b = a; while (b + 1 < filas.length && filas[b + 1] === filas[b] + 1) b++; tramos.push([filas[a], filas[b]]); a = b + 1; }
  try {
    var id = sh.getParent().getId(), nom = "'" + sh.getName().replace(/'/g, "''") + "'";
    for (var g = 0; g < tramos.length; g += 120) {
      var q = tramos.slice(g, g + 120).map(function (t) { return 'ranges=' + encodeURIComponent(nom + '!A' + t[0] + ':HE' + t[1]); }).join('&');
      var resp = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' + id + '/values:batchGet?' + q +
        '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) throw new Error('batchGet ' + resp.getResponseCode());
      JSON.parse(resp.getContentText()).valueRanges.forEach(function (vr, k) {
        var t = tramos[g + k], vals = vr.values || [];
        for (var r = 0; r <= t[1] - t[0]; r++) { var fila = vals[r] || []; while (fila.length < PRES_COLS) fila.push(''); out.push(fila.slice(0, PRES_COLS)); }
      });
    }
    return out;
  } catch (e) {
    out = [];
    tramos.forEach(function (t) { sh.getRange(t[0], 1, t[1] - t[0] + 1, PRES_COLS).getValues().forEach(function (r) { out.push(r); }); });
    return out;
  }
}

function buscarPresentismo_(q) {
  var sh = hojaPresentismo_();
  var base = indicePresentismo_(sh).map(function (r) { return [r[0], '', r[1], r[2], '', '', r[3]]; });
  if (!base.length) return { filas: [], total: 0 };
  var toks = normT_(q.texto || '').split(' ').filter(Boolean), cli = normT_(q.cliente || '');
  var dN = q.desde ? numeroPeriodo_(q.desde) : 0, hN = q.hasta ? numeroPeriodo_(q.hasta) : 9999;
  var idx = [];
  base.forEach(function (r, i) {
    var n = numeroDeEtiqueta_(r[0]);
    if (!n || n < dN || n > hN) return;
    if (cli && normT_(r[6]).indexOf(cli) < 0) return;
    if (toks.length) { var k = normT_(r[2] + ' ' + r[3]); if (!toks.every(function (t) { return k.indexOf(t) >= 0; })) return; }
    idx.push(i);
  });
  var total = idx.length, MAX = 500;
  idx = idx.slice(0, MAX);
  var filas = leerFilasPresentismo_(sh, idx.map(function (i) { return PRES_FILA_DATOS + i; }));
  return { filas: filas, total: total, max: MAX };
}

/**
 * Lo mismo pero armado con los datos de la app (planilla del día a día + archivo histórico):
 * no abre el archivo Presentismo General, que pesa mucho. Mismas 213 columnas.
 */
function buscarPresentismoApp_(q) {
  var inicio = Date.now();
  var toks = normT_(q.texto || '').split(' ').filter(Boolean), cli = normT_(q.cliente || '');
  var pers = periodosConDatos_().filter(function (p) { return (!q.desde || p >= q.desde) && (!q.hasta || p <= q.hasta); });
  if (!toks.length && !cli && pers.length > 3) pers = pers.slice(-3);   // sin persona ni cliente: los últimos 3 períodos
  var servs = {}; leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  var nomSup = {}; usuariosSinClave_().forEach(function (x) { nomSup[x.Usuario.toLowerCase()] = x.Nombre; });
  var fichas = fichasSGI_();
  var filas = [], total = 0, MAX = 500, cortado = false;
  for (var k = 0; k < pers.length; k++) {
    if (Date.now() - inicio > 240000) { cortado = true; break; }
    var p = pers[k], ctx = { periodo: p, n: periodoInfo_(p).n, servs: servs, nomSup: nomSup, fichas: fichas }, et = etiquetaPeriodo_(p);
    planillaPeriodo_(p).forEach(function (f) {
      if (!(f.Nombre || f.Legajo) || f.Seccion === 'EVENTO') return;
      if (toks.length) { var kk = normT_(f.Legajo + ' ' + f.Nombre); if (!toks.every(function (t) { return kk.indexOf(t) >= 0; })) return; }
      if (cli) { var sv = servs[f.ServicioId] || {}; if (normT_((sv.Cliente || '') + ' ' + (sv.Servicio || '')).indexOf(cli) < 0) return; }
      total++;
      if (filas.length < MAX) filas.push(filaPresentismo_(f, ctx, et));
    });
  }
  return { filas: filas, total: total, max: MAX, cortado: cortado, periodos: pers.length };
}

// Agrega todos los períodos que tienen datos en la app y todavía no están en el Presentismo General.
function completarPresentismo_() {
  var inicio = Date.now(), sh = hojaPresentismo_(), ult = sh.getLastRow(), ya = {};
  if (ult >= PRES_FILA_DATOS) sh.getRange(PRES_FILA_DATOS, 1, ult - PRES_FILA_DATOS + 1, 1).getValues().forEach(function (r) { ya[numeroDeEtiqueta_(r[0])] = 1; });
  var faltan = periodosConDatos_().filter(function (p) { return numeroPeriodo_(p) >= 1 && !ya[numeroPeriodo_(p)]; });
  var hechos = [];
  for (var i = 0; i < faltan.length && Date.now() - inicio < 240000; i++) {
    var r = actualizarPresentismo_(faltan[i]); hechos.push(r.periodo + ' (' + r.filas + ' filas)');
  }
  return { hechos: hechos, faltan: faltan.length - hechos.length };
}

function accionPresentismo_(u, d) {
  if (d.modo === 'abrir') { exigir_(u, 'presentismo', false); var h = hojaPresentismo_(); return { url: h.getParent().getUrl() + '#gid=' + h.getSheetId(), nombre: 'Presentismo General' }; }
  if (d.modo === 'actualizar') { exigir_(u, 'presentismo', true); return actualizarPresentismo_(d.periodo); }
  if (d.modo === 'completar') { exigir_(u, 'presentismo', true); return completarPresentismo_(); }
  exigir_(u, 'presentismo', false);
  var r = d.fuente === 'archivo' ? buscarPresentismo_(d) : buscarPresentismoApp_(d);
  if (d.modo === 'excel') {
    // La búsqueda se escribe en la pestaña "Consulta" de la misma planilla, con el mismo encabezado y formato.
    var src = hojaPresentismo_(), ss = src.getParent();
    var c = ss.getSheetByName('Consulta') || ss.insertSheet('Consulta');
    c.clear();
    var nf = Math.max(1, r.filas.length);
    if (c.getMaxRows() < PRES_FILA_DATOS + nf) c.insertRowsAfter(c.getMaxRows(), PRES_FILA_DATOS + nf - c.getMaxRows());
    if (c.getMaxColumns() < PRES_COLS) c.insertColumnsAfter(c.getMaxColumns(), PRES_COLS - c.getMaxColumns());
    src.getRange(1, 1, PRES_FILA_DATOS - 1, PRES_COLS).copyTo(c.getRange(1, 1, PRES_FILA_DATOS - 1, PRES_COLS));
    src.getRange(1, 1, PRES_FILA_DATOS - 1, PRES_COLS).copyTo(c.getRange(1, 1, PRES_FILA_DATOS - 1, PRES_COLS), SpreadsheetApp.CopyPasteType.PASTE_COLUMN_WIDTHS, false);
    src.getRange(PRES_FILA_DATOS, 1, 1, PRES_COLS).copyTo(c.getRange(PRES_FILA_DATOS, 1, nf, PRES_COLS), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    if (r.filas.length) c.getRange(PRES_FILA_DATOS, 1, r.filas.length, PRES_COLS).setValues(r.filas);
    c.setFrozenRows(PRES_FILA_DATOS - 1);
    SpreadsheetApp.flush();
    // Archivo aparte, solo con la consulta y con valores (sin vínculos a la planilla grande)
    var nombre = 'Presentismo General - ' + (d.texto || d.cliente || 'Consulta') + ' - ' + Utilities.formatDate(new Date(), APP.TZ, 'dd-MM-yyyy HH.mm');
    var nuevo = crearLibro_(nombre), hoja = c.copyTo(nuevo);
    hoja.setName('Presentismo General');
    nuevo.deleteSheet(nuevo.getSheets()[0]);
    var rg = hoja.getDataRange(); rg.copyTo(rg, { contentsOnly: true });
    SpreadsheetApp.flush();
    return { nombre: nombre, url: nuevo.getUrl(), xlsx: 'https://docs.google.com/spreadsheets/d/' + nuevo.getId() + '/export?format=xlsx', total: r.total };
  }
  // Vista en la app: resumen por fila
  return {
    total: r.total, max: r.max, cortado: r.cortado || false,
    filas: r.filas.map(function (x) {
      var est = PRES_ESTADOS.map(function (k, j) { return Number(x[143 + j]) ? k + ' ' + x[143 + j] : ''; }).filter(Boolean).join(', ');
      return { Periodo: x[0], Empresa: x[1], Legajo: x[2], Nombre: x[3], Cat: x[4], Puesto: x[5], Cliente: x[6],
        D: Number(x[131]) || 0, N: Number(x[132]) || 0, Liq: Number(x[139]) || 0, Extras: Number(x[140]) || 0, Estados: est,
        Dias: Array.apply(null, Array(31)).map(function (_, i) { var D = x[9 + 4 * i], N = x[10 + 4 * i]; return D === '' || D === 0 && !N ? '' : (typeof D === 'number' ? D + (Number(N) || 0) : String(D)); }) };
    })
  };
}
