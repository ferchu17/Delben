/**
 * ============================================================
 * CONSOLIDADO, STD y 30/31 DÍAS (datos, archivos y vistas)
 * ============================================================
 * Cómo se arma (igual que se hacía a mano en el Excel):
 *   - CONSOLIDADO: todos los vigiladores de todas las pestañas de servicio (el diagrama), sin agrupar,
 *     tal cual, aunque tengan días vacíos.
 *   - STD: lo mismo que el Consolidado pero sin las filas que no tienen ningún dato. Es el que va a RRHH.
 *   - 30/31 DÍAS: el STD agrupado por persona (si trabajó en varios servicios queda en una sola fila).
 *     Si un día figura F en un servicio y horas en otro, cuenta como trabajado.
 * Siglas que no están en la tabla de Códigos: el día queda en blanco y se avisa (persona, día y servicio).
 * Domicilio del objetivo, Jurisdicción, Supervisor y JO salen de la pestaña Facturacion del modelo de
 * Planificación; la categoría (Cat.) sale de la pestaña Personal del modelo (si no está, de SGI, salvo "BAJA").
 * ============================================================
 */

// Colores de los estados: los mismos del formato condicional de las pestañas de servicio de la empresa
// (se evalúan en este orden, igual que en el Excel).
var COLORES_ESTADO_ = [
  ['DV', '#8497b0', '#ffff00'], ['RES', '#ffff00', null], ['ART', '#ff7c80', null], ['BAJA', '#0d0d0d', '#ffffff'],
  ['ENF', '#cc9900', null], ['SUS', '#7030a0', '#ffffff'], ['INJ', '#ff0000', '#ffff00'], ['F', '#92d050', null], ['VAC', '#8497b0', null]
];

/* ---------------- datos que salen de los modelos de la empresa ---------------- */

function claveModelo_() { return String(PropertiesService.getScriptProperties().getProperty('MOD_PLANTILLA_ID') || plantillaId_('PLANTILLA_ID')); }

// Pestaña Facturacion del modelo de Planificación: por cliente, domicilio, supervisor, JO, jurisdicción y empresa.
function datosClientesModelo_() {
  var k = 'cliMod3_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, claveModelo_())).slice(0, 16);
  var c = cacheJSONGet_(k);
  if (c) return c;
  var out = {};
  try {
    var sh = modelo_('PLANTILLA_ID').getSheetByName('Facturacion');
    if (sh) {
      var v = sh.getRange(1, 1, Math.min(sh.getLastRow(), 200), Math.min(sh.getMaxColumns(), 40)).getDisplayValues();
      // v1.22.9: las líneas pintadas de verde son las que tienen VigiControl
      var fondos = sh.getRange(1, 27, Math.min(sh.getLastRow(), 200), 12).getBackgrounds();
      var hdr = -1;
      for (var r = 0; r < 6 && hdr < 0; r++) if (normT_(v[r][0]) === 'CLIENTE') hdr = r;
      for (var i = (hdr < 0 ? 3 : hdr + 2); i < v.length; i++) {
        var nom = String(v[i][0] || '').trim();
        if (!nom || normT_(nom) === 'TOTAL') continue;
        var g = function (c) { return v[i][c] === undefined ? '' : v[i][c]; };
        out[normT_(nom)] = { nombre: nom, empresa: g(1), dir: g(15), sup: g(16), srv: g(17), jo: g(22), libros: g(23), jur: g(24),
          tels: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37].map(g).filter(function (t) { return t && !/^#/.test(t); }).join(' / '), ind: g(38),
          lineas: [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37].map(function (c, j) {
            var t = String(g(c) || '').trim(); if (!t || /^#/.test(t)) return '';
            var bg = String((fondos[i] || [])[j] || '').toLowerCase();
            return t.replace(/[;*]/g, ' ') + (/^#(92d050|00b050|66ff66|00ff00|c6efce|a9d08e)$/.test(bg) ? '*' : '');
          }).filter(Boolean).join(';') };
      }
    }
  } catch (e) { Logger.log('Clientes del modelo: ' + e.message); }
  cacheJSONPut_(k, out, 21600);
  return out;
}
function clienteModelo_(serv, mapa) {
  if (!serv) return {};
  var cands = [serv.Cliente, serv.Servicio, serv.Pestana].filter(Boolean);
  for (var i = 0; i < cands.length; i++) if (mapa[normT_(cands[i])]) return mapa[normT_(cands[i])];
  var keys = Object.keys(mapa);
  for (var j = 0; j < cands.length; j++) {
    var k = keys.filter(function (x) { return mismoNombre_(x, cands[j]); })[0];
    if (k) return mapa[k];
  }
  return {};
}

// Pestaña Personal del modelo: la categoría (Cat.) de cada legajo, tal cual figura en los archivos de la empresa.
function categoriasModelo_() {
  var k = 'catMod3_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, claveModelo_())).slice(0, 16);
  var c = cacheJSONGet_(k);
  if (c) return c;
  var out = {};
  try {
    var sh = modelo_('PLANTILLA_ID').getSheetByName('Personal');
    if (sh && sh.getLastRow() > 2) {
      sh.getRange(3, 1, sh.getLastRow() - 2, 5).getDisplayValues().forEach(function (r) {
        var leg = String(r[1] || '').replace(/\.0$/, '').trim();
        if (leg && r[3]) out[leg] = String(r[3]).trim();
        if (r[0] && r[3]) out['N|' + empClave_(r[2]) + '|' + normT_(r[0])] = String(r[3]).trim();
        if (leg && r[2] && r[3]) out[leg + '|' + empClave_(r[2])] = String(r[3]).trim();
      });
    }
  } catch (e) { Logger.log('Categorías del modelo: ' + e.message); }
  cacheJSONPut_(k, out, 21600);
  return out;
}
function categoriaDe_(legajo, ctx, fila) {
  var leg = String(legajo || '').trim(), m = (fila && ctx.cats[leg + '|' + empClave_(fila.Empresa)]) || (fila && fila.Nombre && ctx.cats['N|' + empClave_(fila.Empresa) + '|' + normT_(fila.Nombre)]) || (!fila || !fila.Empresa ? ctx.cats[leg] : '');
  // v1.21.2: el mismo legajo puede ser de otra empresa: si la ficha de SGI (legajo + empresa) tiene categoría, manda esa
  if (fila) { var fs = fichaPara_(ctx.fichas, fila), cs = String(fs.Categoria || '').trim(); if (cs && normT_(cs) !== 'BAJA') return cs; }
  if (m) return m;
  var f = fila ? fichaPara_(ctx.fichas, fila) : (ctx.fichas[leg] || {}), cat = String(f.Categoria || '').trim();
  return normT_(cat) === 'BAJA' ? '' : cat;
}

function codigosValidos_() {
  var v = { F: 1, FCO: 1 };
  leer_('Codigos').forEach(function (c) { if (c.Activo !== 'NO' && c.Codigo) v[normT_(c.Codigo)] = 1; });
  return v;
}

/* ---------------- armado de las filas ---------------- */

// Resumen de una fila a partir de sus días ya leídos ([D, N] o [código, 0]) — mismas cuentas que estadisticasFila_.
function resumenDias_(dias, ctx, horasPorSeccion) {
  var x = { D: 0, N: 0, iD: 0, iN: 0, rD: 0, rN: 0, est: {}, trab: 0, ferTrab: 0, aus: 0, dias: dias };
  dias.forEach(function (d, i) {
    if (i >= ctx.n) return;
    if (typeof d[0] === 'number') { x.trab++; if (esFeriado_(fechaDia_(ctx.periodo, i))) x.ferTrab++; }
    else if (d[0]) {
      var k = d[0] === 'F' ? 'FCO' : d[0];
      x.est[k] = (x.est[k] || 0) + 1;
      if (COD_AUSENTISMO_.indexOf(d[0]) >= 0) x.aus++;
    }
  });
  ['D', 'N', 'iD', 'iN', 'rD', 'rN'].forEach(function (k) { x[k] = horasPorSeccion[k] || 0; });
  x.tot = x.D + x.N; x.de = x.iD + x.iN + x.rD + x.rN; x.liq = x.tot + x.de;
  var he = horasExtras_(x.tot, x.aus, ctx.n);   // v1.22.10: mismas fórmulas que el Consolidado
  x.hsAus = he.hsAus; x.normales = he.normales; x.trabVsNor = he.tvn; x.extras = he.extras; x.dif = he.dif;
  x.noc = x.N + x.iN + x.rN;
  x.tdias = x.trab + Object.keys(x.est).reduce(function (a, k) { return a + (k === 'DV' ? 0 : x.est[k]); }, 0);
  x.ratio = Math.round(x.liq / HS_BASE_PERIODO * 10000) / 10000;
  return x;
}

/**
 * tipo: 'consolidado' | 'std' | 'treinta'
 * Devuelve { periodo, n, dias:[{fecha, dia, feriado}], items:[...], invalidos:[...], totales:{todas, servicios, reten} }
 */
function datosSTD_(periodo, tipo) {
  var ctx = contextoInforme_(periodo), n = ctx.n;
  ctx.cats = categoriasModelo_();
  var clientes = datosClientesModelo_(), validos = codigosValidos_();
  var orden = {};
  leer_('Servicios').forEach(function (s, k) { orden[s.Id] = k; });
  var filas = planillaPeriodo_(periodo).filter(function (f) { return (f.Nombre || f.Legajo) && f.Seccion !== 'EVENTO'; });
  var invalidos = [];
  var items = filas.map(function (f) {
    var serv = ctx.servs[f.ServicioId] || {}, g = {};
    Object.keys(f).forEach(function (k) { g[k] = f[k]; });
    for (var i = 0; i < n; i++) {
      var v = f[DIAS_COL[i]];
      if (!v) continue;
      var c = leerCelda_(v);
      if (c.tipo === 'codigo' && !validos[c.cod]) {
        invalidos.push({ Legajo: f.Legajo, Nombre: f.Nombre, Servicio: serv.Servicio || f.ServicioId, ServicioId: f.ServicioId, Dia: iso_(fechaDia_(periodo, i)), Valor: c.cod });
        g[DIAS_COL[i]] = '';
      }
    }
    var x = estadisticasFila_(g, ctx);
    var vacio = !x.dias.some(function (d) { return d[0] !== '' && d[0] !== undefined; });
    return { f: g, x: x, serv: serv, cli: clienteModelo_(serv, clientes), cat: categoriaDe_(f.Legajo, ctx, f), vacio: vacio, reten: f.Seccion === 'RETEN' };
  });
  // Orden: primero la cobertura de cada servicio y al final Instrucción / Retén (como en el STD de la empresa)
  items.sort(function (a, b) {
    return (a.reten - b.reten) || ((orden[a.f.ServicioId] || 0) - (orden[b.f.ServicioId] || 0)) || (Number(a.f.Orden) || 0) - (Number(b.f.Orden) || 0);
  });
  if (tipo !== 'consolidado') items = items.filter(function (it) { return !it.vacio; });
  if (tipo === 'treinta') items = agruparPorPersona_(items, ctx);
  // Totales por día (filas de abajo: Horas Realizadas, de Servicios y de Instrucción / Retén)
  var tot = { todas: [], servicios: [], reten: [] };
  for (var d = 0; d < n; d++) { tot.todas.push([0, 0]); tot.servicios.push([0, 0]); tot.reten.push([0, 0]); }
  items.forEach(function (it) {
    (it.partes || [it]).forEach(function (p) {
      p.x.dias.forEach(function (dd, i) {
        if (i >= n || typeof dd[0] !== 'number') return;
        tot.todas[i][0] += dd[0]; tot.todas[i][1] += dd[1];
        var t = p.reten ? tot.reten : tot.servicios;
        t[i][0] += dd[0]; t[i][1] += dd[1];
      });
    });
  });
  var dias = [];
  for (var j = 0; j < n; j++) { var fd = fechaDia_(periodo, j); dias.push({ fecha: iso_(fd), dia: DIAS_NOMBRE_[(fd.getUTCDay() + 6) % 7], feriado: esFeriado_(fd) || '' }); }
  return { periodo: periodo, nombre: nombrePeriodo_(periodo), n: n, dias: dias, items: items, invalidos: invalidos, totales: tot, ctx: ctx };
}

// 30/31 días: una fila por persona. Si un día tiene horas en algún servicio, cuenta como trabajado (aunque en otro figure F).
function agruparPorPersona_(items, ctx) {
  var grupos = {}, ordenG = [];
  items.forEach(function (it) {
    var k = it.f.Legajo ? 'L' + String(it.f.Legajo).trim() : 'N' + normT_(it.f.Nombre);
    if (!grupos[k]) { grupos[k] = []; ordenG.push(k); }
    grupos[k].push(it);
  });
  return ordenG.map(function (k) {
    var g = grupos[k];
    if (g.length === 1) { g[0].partes = [g[0]]; return g[0]; }
    var dias = [], horas = { D: 0, N: 0, iD: 0, iN: 0, rD: 0, rN: 0 };
    for (var i = 0; i < 31; i++) {
      var hs = null, cod = '';
      g.forEach(function (it) {
        var d = it.x.dias[i] || ['', ''];
        if (typeof d[0] === 'number') { hs = hs || [0, 0]; hs[0] += d[0]; hs[1] += d[1]; }
        else if (d[0] && (!cod || cod === 'F')) cod = d[0];
      });
      dias.push(hs ? hs : (cod ? [cod, 0] : ['', '']));
    }
    g.forEach(function (it) { ['D', 'N', 'iD', 'iN', 'rD', 'rN'].forEach(function (c) { horas[c] += it.x[c]; }); });
    // El servicio que figura es el de más horas
    var princ = g.slice().sort(function (a, b) { return b.x.liq - a.x.liq; })[0];
    return { f: princ.f, x: resumenDias_(dias, ctx, horas), serv: princ.serv, cli: princ.cli, cat: princ.cat, reten: false, partes: g,
      servicios: g.map(function (it) { return it.serv.Servicio || ''; }).filter(function (s, i, a) { return s && a.indexOf(s) === i; }) };
  });
}

/* ---------------- escribir la pestaña del modelo (STD, Consolidado, 30/31 Dias) ---------------- */

// Columnas de una pestaña con el diseño del STD (por sus títulos). cab = primeras 10 filas (valores).
function columnasSTD_(cab, W) {
  var hdr = -1;
  for (var r = 4; r < Math.min(10, cab.length) && hdr < 0; r++) for (var c = 0; c < W; c++) if (normT_(cab[r][c]) === 'APELLIDO Y NOMBRE') { hdr = r; break; }
  if (hdr < 0) return null;
  var fF = hdr - 2, fS = hdr - 1;
  var col = {}, dos = {}, diasCols = [];
  for (var c2 = 0; c2 < W; c2++) {
    var h = normT_(cab[hdr][c2]), h6 = normT_(cab[fF][c2]), h7 = normT_(cab[fS][c2]);
    if (h === 'D' && normT_(cab[hdr][c2 + 1]) === 'N' && diasCols.length < 31 && !col.A) diasCols.push(c2);
    [h6, h7].forEach(function (t) { if (t && col[t] === undefined) col[t] = c2; });
    if (h) { if (col[h] === undefined) col[h] = c2; else if (dos[h] === undefined) dos[h] = c2; }
    if (h6 === 'A' && col.A === undefined) col.A = c2;
    for (var rr = 0; rr < hdr; rr++) if (normT_(cab[rr][c2]) === 'PRODUCTIVIDAD' && col.PRODUCTIVIDAD === undefined) col.PRODUCTIVIDAD = c2;
  }
  var busca = function (pref) { var k = Object.keys(col).filter(function (t) { return t.indexOf(pref) === 0; })[0]; return k ? col[k] : undefined; };
  var C = {
    emp: col.EMPRESA, ord: col.ORDEN, leg: col.LEGAJO, nom: col['APELLIDO Y NOMBRE'], cat: col.CAT, pue: col.PUESTO, cli: col.CLIENTE,
    A: col.A, B: col.B, ABC: col.ABC, iD: busca('INSTRUCCION'), rD: busca('RETEN'), DE: col.DE, liq: busca('TOTAL HORAS'),
    ext: busca('TOTAL HS EXTRA'), noc: busca('TOTAL HS NOC'), dif: undefined,
    fer: busca('FERIAD'), trab: busca('DIAS TRABAJADO'), tdias: busca('TOTAL DE DIAS'), aus: busca('DIAS DE AUSENT'), hsAus: busca('HS DE AUSENT'),
    norm: busca('HS NORMALES'), tvn: busca('HS TRAB'), prod: col.PRODUCTIVIDAD, dom: busca('DOMICILIO'), jur: busca('JURIDICCION') !== undefined ? busca('JURIDICCION') : busca('JURISDICCION'),
    sup: col.SUPERVISOR, jo: col.JO, nom2: dos['APELLIDO Y NOMBRE'], leg2: dos.LEGAJO, dni: col.DNI, edad: col.EDAD, cuil: col.CUIL,
    ing: busca('FECHA DE INGRESO'), ant: busca('ANTIGUEDAD')
  };
  for (var cc = (C.A || 0); cc < W; cc++) if (normT_(cab[fS][cc]) === 'DIFERENCIAS') { C.dif = cc; break; }
  var codCols = {};
  ['FCO', 'YNG', 'INJ', 'LSG', 'ENF', 'ART', 'VAC', 'DV', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'CAS', 'BAJA'].forEach(function (k) {
    for (var c3 = (C.A || 0); c3 < W; c3++) if (normT_(cab[fS][c3]) === k) { codCols[k] = c3; break; }
  });
  var numCol = (C.emp > 0 && !normT_(cab[hdr][0])) ? 0 : -1;
  return { hdr: hdr, fF: fF, fS: fS, C: C, codCols: codCols, diasCols: diasCols, numCol: numCol };
}

function llenarPestanaSTD2_(sh, datos, colANombre) {
  var ctx = datos.ctx, periodo = datos.periodo, n = datos.n;
  var W = sh.getMaxColumns(), cab = sh.getRange(1, 1, 10, W).getValues();
  var m = columnasSTD_(cab, W);
  if (!m) throw new Error('La pestaña "' + sh.getName() + '" no tiene el título "Apellido y Nombre".');
  var hdr = m.hdr, fF = m.fF, fS = m.fS, C = m.C, codCols = m.codCols, diasCols = m.diasCols, numCol = m.numCol;

  // Zona de datos: desde la fila siguiente a los títulos hasta 3 filas antes de "Horas Realizadas"
  var desde = hdr + 2, maxR = sh.getMaxRows();
  var colA = sh.getRange(desde, 1, maxR - desde + 1, 8).getValues(), filaTot = -1;
  for (var q = 0; q < colA.length && filaTot < 0; q++) if (/HORAS REALIZ|TOTAL DE INSTRUCC/i.test(colA[q].join(' '))) filaTot = desde + q;
  var hasta = filaTot > 0 ? filaTot - 3 : maxR;
  var hay = hasta - desde + 1, need = Math.max(1, datos.items.length);
  if (need > hay) { sh.insertRowsAfter(hasta - 1, need - hay); }
  else if (need < hay) { sh.deleteRows(desde + need, hay - need); }   // sin filas vacías de más
  hasta = desde + need - 1;
  sh.getRange(desde, 1, need, W).clearContent();
  var put = function (row, c, v) { if (c !== undefined && c >= 0 && c < W) row[c] = (v === 0 ? '' : v); };
  var vals = datos.items.map(function (it, k) {
    var f = it.f, x = it.x, ficha = fichaPara_(ctx.fichas, f), serv = it.serv || {}, cli = it.cli || {}, row = [];
    for (var w = 0; w < W; w++) row.push('');
    var leg = f.Legajo ? Number(f.Legajo) || f.Legajo : '';
    if (numCol === 0) row[0] = colANombre ? f.Nombre : k + 1;
    put(row, C.emp, f.Empresa); put(row, C.ord, f.Orden ? Number(f.Orden) : k + 1); put(row, C.leg, leg); put(row, C.nom, f.Nombre);
    put(row, C.cat, it.cat); put(row, C.pue, f.Puesto || (f.Seccion === 'RETEN' ? 'Instrucción' : ''));
    put(row, C.cli, serv.Cliente || serv.Servicio || '');
    diasCols.forEach(function (dc, i) {
      if (i >= n) return;
      var d = x.dias[i] || ['', ''];
      row[dc] = d[0] === 0 ? '' : d[0]; row[dc + 1] = (d[1] === 0 || d[1] === '') ? '' : d[1];
    });
    put(row, C.A, x.D); put(row, C.B, x.N); put(row, C.ABC, x.tot);
    if (C.iD !== undefined) { put(row, C.iD, x.iD); put(row, C.iD + 1, x.iN); }
    if (C.rD !== undefined) { put(row, C.rD, x.rD); put(row, C.rD + 1, x.rN); }
    put(row, C.DE, x.de); put(row, C.liq, x.liq); put(row, C.ext, x.extras); put(row, C.noc, x.noc); put(row, C.dif, x.dif);
    Object.keys(codCols).forEach(function (k2) { put(row, codCols[k2], x.est[k2] || 0); });
    put(row, C.fer, x.ferTrab); put(row, C.trab, x.trab); put(row, C.tdias, x.tdias); put(row, C.aus, x.aus); put(row, C.hsAus, x.hsAus);
    put(row, C.norm, x.normales); put(row, C.tvn, x.trabVsNor); put(row, C.prod, x.ratio);
    put(row, C.dom, cli.dir || serv.Direccion || ''); put(row, C.jur, cli.jur || serv.Jurisdiccion || '');
    put(row, C.sup, ctx.nomSup[String(serv.Supervisor || '').toLowerCase()] || cli.sup || '');
    put(row, C.jo, serv.JefeOperaciones || cli.jo || ''); put(row, C.nom2, f.Nombre); put(row, C.leg2, leg);
    put(row, C.dni, ficha.Dni ? Number(ficha.Dni) || ficha.Dni : ''); put(row, C.edad, edad_(ficha.Nacimiento)); put(row, C.cuil, ficha.Cuil || '');
    put(row, C.ing, ficha.Ingreso || ''); put(row, C.ant, edad_(ficha.Ingreso));
    return row;
  });
  if (vals.length) sh.getRange(desde, 1, vals.length, W).setValues(vals);
  // Encabezado: período, fechas y días de la semana (los pone el sistema según el calendario)
  for (var r4 = 0; r4 < 4; r4++) for (var c4 = 0; c4 < Math.min(W, 12); c4++) {
    if (normT_(cab[r4][c4]) === 'PERIODO') sh.getRange(r4 + 2, c4 + 1).setValue(datos.nombre);
  }
  var fechas = sh.getRange(fF + 1, 1, 2, W).getValues();
  diasCols.forEach(function (dc, i) {
    if (i < n) {
      var d = fechaDia_(periodo, i);
      fechas[0][dc] = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      fechas[1][dc] = esFeriado_(d) ? 'Feriado' : DIAS_NOMBRE_[(d.getUTCDay() + 6) % 7];
    } else { fechas[0][dc] = ''; fechas[1][dc] = ''; }
  });
  sh.getRange(fF + 1, 1, 2, W).setValues(fechas);
  // Filas de totales de abajo, cada una con su fila de D + N
  var R2 = sh.getMaxRows(), abajo = sh.getRange(hasta + 1, 1, Math.max(1, R2 - hasta), 8).getValues();
  abajo.forEach(function (fila, q2) {
    var t = normT_(fila.join(' ')), arr = null;
    if (/TOTAL DE INSTRUCC/.test(t)) arr = datos.totales.reten;
    else if (/HORAS REALIZADAS DE SERVICIO/.test(t)) arr = datos.totales.servicios;
    else if (/HORAS REALIZADAS/.test(t)) arr = datos.totales.todas;
    if (!arr) return;
    var fr = hasta + 1 + q2, v1 = sh.getRange(fr, 1, 2, W).getValues(), sD = 0, sN = 0;
    diasCols.forEach(function (dc, i) {
      var a = i < n ? arr[i] : [0, 0];
      v1[0][dc] = a[0] || ''; v1[0][dc + 1] = a[1] || ''; v1[1][dc] = (a[0] + a[1]) || ''; v1[1][dc + 1] = '';
      sD += a[0]; sN += a[1];
    });
    if (C.A !== undefined) { v1[0][C.A] = sD || ''; v1[0][C.B] = sN || ''; if (C.ABC !== undefined) v1[0][C.ABC] = (sD + sN) || ''; }
    // Lo que quedaba con error (#REF!) en las demás columnas de esas filas se limpia
    for (var w2 = 0; w2 < W; w2++) for (var z = 0; z < 2; z++) if (/^#(REF|N\/A|VALUE|DIV)/.test(String(v1[z][w2]))) v1[z][w2] = '';
    sh.getRange(fr, 1, 2, W).setValues(v1);
  });
  ajustarColumnasDias_(sh, diasCols, n);
  limpiarFormulasExternas_(sh);
  // Colores de los estados en los días (los del formato de las pestañas de servicio)
  if (diasCols.length) coloresEstados_(sh, sh.getRange(desde, diasCols[0] + 1, need, diasCols.length * 2));
  compactarEncabezado_(sh);
  return sh;
}

// Agrega las reglas de color de los estados (mismo orden que el Excel). La F de la hoja queda con el color que trae el modelo.
function coloresEstados_(sh, rango) {
  try {
    var reglas = sh.getConditionalFormatRules(), tieneF = false;
    reglas.forEach(function (r) {
      var b = r.getBooleanCondition(); if (!b) return;
      var v = normT_((b.getCriteriaValues() || [])[0]);
      if (v === 'F') tieneF = true;
    });
    var nuevas = [];
    COLORES_ESTADO_.forEach(function (e) {
      if (e[0] === 'F' && tieneF) return;
      var b = SpreadsheetApp.newConditionalFormatRule().whenTextContains(e[0]).setBackground(e[1]).setRanges([rango]);
      if (e[2]) b.setFontColor(e[2]);
      nuevas.push(b.build());
    });
    sh.setConditionalFormatRules(nuevas.concat(reglas));
  } catch (e) { Logger.log('Colores de estados: ' + e.message); }
}

// Arriba de la pestaña: se borran las celdas grises (Personal, Facturación, Condiciones, Vacaciones, Consolidado...)
// y las de las empresas, Período y los meses del período pasan a ocupar ese lugar.
var NAV_ = ['PERSONAL', 'FACTURACION', 'CONDICIONES', 'VACACIONES', 'CONSOLIDADO', 'RETIRO', 'FLOTA', 'LICENCIAS'];
function compactarEncabezado_(sh) {
  try {
    var W = Math.min(sh.getMaxColumns(), 16), v = sh.getRange(1, 1, 4, W).getDisplayValues();
    var nav = [], info = -1;
    for (var r = 0; r < 4; r++) for (var c = 0; c < W; c++) {
      var t = normT_(v[r][c]);
      if (NAV_.indexOf(t) >= 0) nav.push([r, c]);
      if ((t === 'PERIODO' || /KDE|PPQ|LEGUYET/.test(t)) && (info < 0 || c < info)) info = c;
    }
    if (!nav.length) return;
    var c0 = nav.reduce(function (m, x) { return Math.min(m, x[1]); }, 99);
    nav.forEach(function (x) { var rg = sh.getRange(x[0] + 1, x[1] + 1); try { rg.breakApart(); } catch (e) { } rg.clear(); });
    if (info < 0 || info <= c0) return;
    var ancho = 4, mover = sh.getRange(1, info + 1, 4, ancho);
    // Lo que se mueve pasa a valores (si tuviera fórmulas, al correrlas de lugar quedarían apuntando mal)
    SpreadsheetApp.flush();
    mover.setValues(mover.getValues());
    var tmp = sh.getParent().insertSheet('tmp_' + Date.now());
    mover.copyTo(tmp.getRange(1, 1));
    try { mover.breakApart(); } catch (e) { }
    mover.clear();
    var dest = sh.getRange(1, c0 + 1, 4, ancho);
    try { dest.breakApart(); } catch (e) { }
    tmp.getRange(1, 1, 4, ancho).copyTo(dest);
    sh.getParent().deleteSheet(tmp);
    // Las reglas de color de las empresas apuntaban a la celda vieja: se mueven a la nueva
    var reglas = sh.getConditionalFormatRules(), cambio = false;
    reglas = reglas.map(function (rg) {
      var rs = rg.getRanges();
      if (rs.length === 1 && rs[0].getRow() <= 4 && rs[0].getColumn() === info + 1) {
        cambio = true;
        return rg.copy().setRanges([sh.getRange(rs[0].getRow(), c0 + 1, rs[0].getNumRows(), rs[0].getNumColumns())]).build();
      }
      return rg;
    });
    if (cambio) sh.setConditionalFormatRules(reglas);
  } catch (e) { Logger.log('Encabezado: ' + e.message); }
}

/* ---------------- vista en la app y descarga ---------------- */

/**
 * Encabezado de la pestaña del modelo (tal cual: textos, colores, negritas, tamaños, celdas combinadas, anchos y
 * columnas ocultas), para que la app muestre el STD y el 30/31 días igual al archivo que va a RRHH
 * (Novedades del Personal) y el Consolidado igual a la Planificación.
 */
function hojaModeloSTD_(tipo) {
  var ss = modelo_(tipo === 'consolidado' ? 'PLANTILLA_ID' : 'PLANTILLA_RRHH_ID');
  if (!ss) return null;
  var hs = ss.getSheets();
  if (tipo === 'consolidado') return ss.getSheetByName('Consolidado');
  if (tipo === 'treinta') return hs.filter(function (h) { return /^\d+\s*DIAS/i.test(h.getName()); })[0] || null;
  return ss.getSheetByName('STD') || hs.filter(function (h) { return /STD/i.test(h.getName()); })[0] || null;
}
function cabeceraSTD_(tipo) {
  var clave = 'cabSTD3|' + tipo + '|' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,
    String(PropertiesService.getScriptProperties().getProperty(tipo === 'consolidado' ? 'MOD_PLANTILLA_ID' : 'MOD_PLANTILLA_RRHH_ID') || ''))).slice(0, 12);
  var ya = cacheJSONGet_(clave);
  if (ya) return ya;
  var sh = hojaModeloSTD_(tipo);
  if (!sh) return null;
  var W = Math.min(sh.getMaxColumns(), 200), cab10 = sh.getRange(1, 1, 10, W).getValues();
  var m = columnasSTD_(cab10, W);
  if (!m) return null;
  var R = m.hdr + 2, rg = sh.getRange(1, 1, R, W);
  var out = { W: W, hdr: m.hdr, fF: m.fF, fS: m.fS, C: m.C, codCols: m.codCols, diasCols: m.diasCols, numCol: m.numCol,
    vals: rg.getDisplayValues(), bgs: rg.getBackgrounds(), fcs: rg.getFontColors(), fws: rg.getFontWeights(), fss: rg.getFontSizes(),
    ffs: rg.getFontFamilies(), has: rg.getHorizontalAlignments(), wraps: rg.getWraps(),
    merges: rg.getMergedRanges().map(function (x) { return [x.getRow() - 1, x.getColumn() - 1, x.getNumRows(), x.getNumColumns()]; }),
    anchos: [], ocultas: [], altos: [] };
  for (var c = 1; c <= W; c++) { out.anchos.push(sh.getColumnWidth(c)); var oc = false; try { oc = sh.isColumnHiddenByUser(c); } catch (e) { } out.ocultas.push(oc ? 1 : 0); }
  for (var r = 1; r <= R; r++) out.altos.push(sh.getRowHeight(r));
  // Igual que el Excel que se descarga: sin las celdas grises (Personal, Facturación, Condiciones, Vacaciones...)
  // y con empresas / período / meses en su lugar.
  var nav = [], info = -1;
  for (var r2 = 0; r2 < Math.min(4, R); r2++) for (var c2 = 0; c2 < Math.min(W, 16); c2++) {
    var t = normT_(out.vals[r2][c2]);
    if (NAV_.indexOf(t) >= 0) nav.push([r2, c2]);
    if ((t === 'PERIODO' || /KDE|PPQ|LEGUYET/.test(t)) && (info < 0 || c2 < info)) info = c2;
  }
  if (nav.length) {
    var c0 = nav.reduce(function (a, x) { return Math.min(a, x[1]); }, 99);
    var limpia = function (r3, c3) { out.vals[r3][c3] = ''; out.bgs[r3][c3] = '#ffffff'; out.fcs[r3][c3] = '#000000'; out.fws[r3][c3] = 'normal'; };
    nav.forEach(function (x) { limpia(x[0], x[1]); });
    out.merges = out.merges.filter(function (g) { return !(g[0] < 4 && nav.some(function (x) { return x[0] >= g[0] && x[0] < g[0] + g[2] && x[1] >= g[1] && x[1] < g[1] + g[3]; })); });
    if (info > c0) {
      var d = info - c0;
      for (var r4 = 0; r4 < 4; r4++) for (var k = 0; k < 4; k++) {
        ['vals', 'bgs', 'fcs', 'fws', 'fss', 'ffs', 'has', 'wraps'].forEach(function (a) { out[a][r4][c0 + k] = out[a][r4][info + k]; });
        limpia(r4, info + k);
      }
      out.merges = out.merges.map(function (g) { return g[0] < 4 && g[1] >= info && g[1] < info + 4 ? [g[0], g[1] - d, g[2], g[3]] : g; });
    }
  }
  cacheJSONPut_(clave, out, 21600);
  return out;
}

// Lo que muestra la app (pantalla completa): filas listas para dibujar.
var FORMATO_FIJO_STD_ = false;   // el encabezado del STD, 30/31 y Consolidado de Informes sale del modelo de la empresa (como antes)
function vistaSTD_(periodo, tipo) {
  var d = datosSTD_(periodo, tipo);
  var nomSup = d.ctx.nomSup, cab = null;
  // v1.21: el formato (encabezado, totales, colores) ya viene fijo en la app (Formato.html): no se lee el modelo (más rápido).
  if (!FORMATO_FIJO_STD_) { try { cab = cabeceraSTD_(tipo); } catch (e) { Logger.log('Encabezado del modelo: ' + e.message); } }
  return {
    cab: cab, tipo: tipo,
    periodo: periodo, nombre: d.nombre, n: d.n, dias: d.dias, invalidos: d.invalidos, totales: d.totales, base: HS_BASE_PERIODO,
    filas: d.items.map(function (it, k) {
      var f = it.f, x = it.x, serv = it.serv || {}, cli = it.cli || {}, ficha = fichaPara_(d.ctx.fichas, f);
      return {
        emp: f.Empresa, ord: Number(f.Orden) || k + 1, leg: f.Legajo, nom: f.Nombre, cat: it.cat, pue: f.Puesto || (f.Seccion === 'RETEN' ? 'Instrucción' : ''),
        cli: serv.Cliente || serv.Servicio || '', sid: f.ServicioId, servicios: it.servicios || null, reten: it.reten,
        raw: FORMATO_FIJO_STD_ ? DIAS_COL.slice(0, d.n).map(function (c) { return f[c] || ''; }) : undefined, turno: f.Turno || '',
        dias: x.dias.slice(0, d.n), A: x.D, B: x.N, ABC: x.tot, iD: x.iD, iN: x.iN, rD: x.rD, rN: x.rN, DE: x.de, liq: x.liq, ext: x.extras, noc: x.noc, dif: x.dif,
        est: x.est, fer: x.ferTrab, trab: x.trab, tdias: x.tdias, aus: x.aus, hsAus: x.hsAus, norm: x.normales, tvn: x.trabVsNor, prod: x.ratio,
        dom: cli.dir || serv.Direccion || '', jur: cli.jur || serv.Jurisdiccion || '', sup: nomSup[String(serv.Supervisor || '').toLowerCase()] || cli.sup || '', jo: serv.JefeOperaciones || cli.jo || '',
        dni: ficha.Dni || '', edad: edad_(ficha.Nacimiento), cuil: ficha.Cuil || '', ing: ficha.Ingreso || '', ant: edad_(ficha.Ingreso)
      };
    })
  };
}

// Copia de un archivo solo con valores (sin fórmulas, vínculos ni accesos directos) y en Excel.
function descargaValores_(id, nombre) {
  var src = DriveApp.getFileById(id), copia = src.makeCopy('tmp descarga ' + nombre);
  try {
    var ss = SpreadsheetApp.openById(copia.getId());
    try { ss.setSpreadsheetTimeZone(APP.TZ); } catch (e) { }
    // v1.22.10: las pestañas que solo tienen fórmulas propias (Consolidado, STD, 30/31 días) quedan CON sus fórmulas;
    // las que traen datos de otras pestañas o archivos van solo con valores (sin vínculos)
    ss.getSheets().forEach(function (sh) {
      var rg = sh.getDataRange(), fo = rg.getFormulas(), externas = false;
      for (var i = 0; i < fo.length && !externas; i++) for (var j = 0; j < fo[i].length; j++) if (fo[i][j] && fo[i][j].indexOf('!') >= 0) { externas = true; break; }
      if (externas) rg.copyTo(rg, { contentsOnly: true });
      try { if (sh.getFrozenRows()) sh.setFrozenRows(0); if (sh.getFrozenColumns()) sh.setFrozenColumns(0); } catch (e) { }
    });
    SpreadsheetApp.flush();
    // Los ceros no se ven (las celdas con un 0 escrito quedan vacías; las fórmulas no se tocan)
    ss.getSheets().forEach(function (sh) {
      try {
        var rg2 = sh.getDataRange(), v = rg2.getValues(), f2 = rg2.getFormulas(), lista = [];
        for (var i = 0; i < v.length; i++) for (var j = 0; j < v[i].length; j++) if (v[i][j] === 0 && !f2[i][j]) lista.push(colLetra_(j + 1) + (i + 1));
        for (var k = 0; k < lista.length; k += 500) sh.getRangeList(lista.slice(k, k + 500)).clearContent();
      } catch (e) { Logger.log('Ceros en ' + sh.getName() + ': ' + e.message); }
    });
    SpreadsheetApp.flush();
    var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + copia.getId() + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('No se pudo exportar a Excel (' + resp.getResponseCode() + ').');
    return { nombre: String(nombre).replace(/[\\/:*?"<>|]/g, ' ') + '.xlsx', base64: Utilities.base64Encode(resp.getBlob().getBytes()) };
  } finally { try { copia.setTrashed(true); } catch (e) { } }
}


/* ---------------- vistas rápidas de los demás informes (sin abrir archivos) ---------------- */

/**
 * Facturación (pestaña Facturacion del archivo de novedades): una fila por servicio, hasta Indumentaria.
 * Contratadas = las del servicio en cada día del período · Realizadas = cobertura (sin retén / instrucción)
 * Eventuales = filas de Eventuales / Adicional · No cubiertas = contratadas que no se cubrieron.
 */
function datosFacturacionNov_(periodo) {
  var d = datosSTD_(periodo, 'consolidado'), ctx = d.ctx, n = d.n, clientes = datosClientesModelo_();
  var por = {};
  var nuevo = function (sid) {
    if (!por[sid]) {
      var serv = ctx.servs[sid] || { Id: sid, Servicio: sid }, cD = 0, cN = 0;
      for (var i = 0; i < n; i++) { var c = contratadoDia_(serv, fechaDia_(periodo, i)); cD += c.d; cN += c.n; }
      por[sid] = { sid: sid, serv: serv, cli: clienteModelo_(serv, clientes), cD: cD, cN: cN, rD: 0, rN: 0, ev: 0, ext: 0, vac: 0, ret: 0, ins: 0, pers: 0 };
    }
    return por[sid];
  };
  d.items.forEach(function (it) {
    var x = it.x, o = nuevo(it.f.ServicioId);
    if (noFactura_(it.f.Nombre)) return;     // v1.22.9: sus horas no se facturan
    o.rD += x.D; o.rN += x.N; o.ret += x.rD + x.rN; o.ins += x.iD + x.iN; o.ext += x.extras; o.vac += x.est.VAC || 0;
    if (!it.reten && !it.vacio) o.pers++;
  });
  planillaPeriodo_(periodo).forEach(function (f) {
    if (f.Seccion !== 'EVENTO') return;
    var o = nuevo(f.ServicioId);
    for (var i = 0; i < n; i++) { var c = leerCelda_(f[DIAS_COL[i]]); if (c.tipo === 'horas') o.ev += c.d + c.n; }
  });
  var nomSup = ctx.nomSup;
  var filas = Object.keys(por).map(function (k) { return por[k]; }).filter(function (o) {
    return o.serv.Activo !== 'NO' || o.rD || o.rN || o.ev;
  }).map(function (o) {
    var r2 = function (v) { return Math.round(v * 100) / 100; }, cli = o.cli, s = o.serv;
    if (sinDiferencia_(s)) { o.cD = o.rD; o.cN = o.rN; }
    var contr = o.cD + o.cN, real = o.rD + o.rN;
    return {
      sid: o.sid, cliente: (cli.nombre || s.Cliente || s.Servicio || '').toUpperCase(), empresa: s.Empresa || cli.empresa || '',
      cD: r2(o.cD), cN: r2(o.cN), cT: r2(contr), rD: r2(o.rD), rN: r2(o.rN), ev: r2(o.ev), rT: r2(real + o.ev), ext: r2(o.ext), vac: o.vac,
      nc: r2(Math.max(0, contr - real)), ret: r2(o.ret), ins: r2(o.ins), ri: r2(o.ret + o.ins),
      dir: cli.dir || s.Direccion || '', sup: nomSup[String(s.Supervisor || '').toLowerCase()] || cli.sup || '', srv: cli.srv || '',
      dD: r2(o.cD / 31), dN: r2(o.cN / 31), mD: r2(o.cD / 31 * 30), mN: r2(o.cN / 31 * 30),
      jo: s.JefeOperaciones || cli.jo || '', libros: cli.libros || '', jur: cli.jur || s.Jurisdiccion || '', ind: cli.ind || ''
    };
  }).map(function (f) {
    // v1.22.9: una columna por línea; las de VigiControl en verde con su comentario
    var ls = lineasServicio_(por[f.sid].serv, por[f.sid].cli);
    f._st = {};
    for (var j = 0; j < N_LINEAS_; j++) {
      f['tel' + (j + 1)] = ls[j] ? ls[j].t : '';
      if (ls[j] && ls[j].vc) f._st['tel' + (j + 1)] = { bg: '#92d050', title: 'Posee VigiControl' };
    }
    return f;
  });
  filas.sort(function (a, b) { return a.cliente.localeCompare(b.cliente); });
  return filas;
}

// v1.22.9: líneas de teléfono de un servicio ("número*" = con VigiControl). Las cargadas en la app mandan; si no, las del modelo.
function lineasServicio_(serv, cli) {
  var crudo = serv ? serv.Lineas : '', t = String(crudo || '').trim();
  if (!crudo && cli) t = cli.lineas || '';     // nunca se cargaron en la app: las del modelo (si se borraron todas, queda " ")
  return t ? t.split(';').map(function (x) { x = String(x).trim(); return { t: x.replace(/\*$/, '').trim(), vc: /\*$/.test(x) }; }).filter(function (x) { return x.t; }) : [];
}
var N_LINEAS_ = 12;
var COLS_FACTNOV_ = [
  ['cliente', 'Cliente', 0, ''], ['empresa', 'Empresa', 0, ''],
  // v1.22.9: los colores de cada columna son los de la pestaña Facturacion del Excel; las no cubiertas van en rojo y en negativo
  ['cD', 'Diurnas', 1, 'Horas Contratadas', { bg: '#ffffcc' }], ['cN', 'Nocturnas', 1, 'Horas Contratadas', { bg: '#f2f2f2' }], ['cT', 'Total de Horas', 1, '', { bg: '#e2f0d9' }],
  ['rD', 'Diurnas', 1, 'Horas Realizadas', { bg: '#ffffcc' }], ['rN', 'Nocturnas', 1, 'Horas Realizadas', { bg: '#f2f2f2' }], ['ev', 'Eventuales Adicional', 1, ''],
  ['rT', 'Total de Horas con Eventuales', 1, '', { bg: '#e2f0d9' }], ['ext', 'Total de Hs. Extras Realizadas en el Servicio', 1, '', { bg: '#a9d18e' }], ['vac', 'Vacaciones', 1, '', { bg: '#ccff66' }],
  ['nc', 'Horas No Cubiertas', 1, '', { fc: '#ff0000', neg: 1 }], ['ret', 'Horas Reten', 1, '', { bg: '#ffffcc' }], ['ins', 'Horas Instruccion', 1, '', { bg: '#bdd7ee' }], ['ri', 'Total Hs. Ret. - Inst.', 1, '', { bg: '#ffcc66' }],
  ['dir', 'Direccion', 0, ''], ['sup', 'Supervisor', 0, ''], ['srv', 'Servicio', 0, ''],
  ['dD', 'Diurnas x día', 1, 'Por día (31)'], ['dN', 'Nocturnas x día', 1, 'Por día (31)'], ['mD', 'Diurnas 30 días', 1, '30 días'], ['mN', 'Nocturnas 30 días', 1, '30 días'],
  ['jo', 'JO', 0, ''], ['libros', 'Libros por puesto', 0, ''], ['jur', 'Juridicción', 0, '']
].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (j) { return ['tel' + j, 'Línea ' + j, 0, 'Teléfonos de contacto (verde = VigiControl)', { tel: 1 }]; }))
 .concat([['ind', 'Indumentaria', 0, '']]);

// Vista genérica: { titulo, cols:[{k,t,n,g}], filas, total }
function vistaTabla_(tipo, periodo) {
  var col = function (a) { return a.map(function (c) { var o = { k: c[0], t: c[1], n: !!c[2], g: c[3] || '' }; if (c[4]) Object.keys(c[4]).forEach(function (x) { o[x] = c[4][x]; }); return o; }); };
  var sumar = function (filas, cols) {
    var t = {};
    cols.forEach(function (c) { if (c.n) t[c.k] = Math.round(filas.reduce(function (s, f) { return s + (Number(f[c.k]) || 0); }, 0) * 100) / 100; });
    return t;
  };
  var out;
  if (tipo === 'facturacionNov') {
    var cols = col(COLS_FACTNOV_), filas = datosFacturacionNov_(periodo);
    out = { cols: cols, filas: filas, total: sumar(filas, cols), enlace: 'sid' };
  } else if (tipo === 'facturacion') {
    var c2 = col([['Cliente', 'Cliente'], ['Empresa', 'Empresa'], ['ContrD', 'Diurnas', 1, 'Contratadas'], ['ContrN', 'Nocturnas', 1, 'Contratadas'], ['Contr', 'Total', 1, 'Contratadas'],
      ['RealD', 'Diurnas', 1, 'Realizadas'], ['RealN', 'Nocturnas', 1, 'Realizadas'], ['Eventuales', 'Eventuales / adicional', 1, ''], ['RealTot', 'Total con eventuales', 1, ''],
      ['NoCubiertas', 'No cubiertas', 1, '', { fc: '#ff0000', neg: 1 }], ['Extras', 'De más', 1, ''], ['Reten', 'Retén', 1, ''], ['Instruccion', 'Instrucción', 1, ''], ['RetInst', 'Total ret. - inst.', 1, ''], ['Supervisor', 'Supervisor']]);
    var f2 = datosFacturacion_(periodo);
    out = { cols: c2, filas: f2, total: sumar(f2, c2), grupo: 'Empresa' };
  } else if (tipo === 'plus') {
    var c3 = col([['Empresa', 'Empresa'], ['Legajo', 'LP'], ['Nombre', 'Apellido y Nombre'], ['Servicio', 'Servicio'], ['Funcion', 'Función'], ['Dias', 'Días de Cobertura', 1], ['Plata', 'Plus en $', 1]]);
    var f3 = datosPlus_(periodo);
    out = { cols: c3, filas: f3, total: sumar(f3, c3) };
  } else if (tipo === 'licencias') {
    var c4 = col([['Codigo', 'Código'], ['Empresa', 'Empresa'], ['Legajo', 'LP'], ['Nombre', 'Apellido y Nombre'], ['Servicio', 'Servicio'], ['Dias', 'Días', 1], ['Fechas', 'Fechas']]);
    var f4 = datosLicencias_(periodo);
    out = { cols: c4, filas: f4, total: sumar(f4, c4), colorCodigo: 'Codigo' };
  } else if (tipo === 'eventos') {
    var nom = {}, n = periodoInfo_(periodo).n;
    leer_('Servicios').forEach(function (s0) { nom[s0.Id] = s0.Servicio; });
    var f5 = planillaPeriodo_(periodo).filter(function (f) { return f.Seccion === 'EVENTO' && (f.Nombre || f.Legajo); }).map(function (f) {
      var h = 0, dias = [];
      for (var i = 0; i < n; i++) { var c = leerCelda_(f[DIAS_COL[i]]); if (c.tipo === 'horas') { h += c.d + c.n; dias.push(ddmm_(fechaDia_(periodo, i)) + ' (' + c.h + ')'); } }
      return { sid: f.ServicioId, Servicio: nom[f.ServicioId] || f.ServicioId, Legajo: f.Legajo, Nombre: f.Nombre, Puesto: f.Puesto || 'Eventual', Horas: h, Dias: dias.join(', ') };
    }).sort(function (a, b) { return a.Servicio.localeCompare(b.Servicio) || String(a.Nombre).localeCompare(String(b.Nombre)); });
    var c5 = col([['Servicio', 'Servicio'], ['Legajo', 'LP'], ['Nombre', 'Apellido y Nombre'], ['Puesto', 'Puesto'], ['Horas', 'Horas', 1], ['Dias', 'Días (horas)']]);
    out = { cols: c5, filas: f5, total: sumar(f5, c5), enlace: 'sid' };
  } else if (tipo === 'extras') {
    // v1.22.10: horas extras por persona con las fórmulas del Consolidado (sirve para períodos de 28, 29, 30 y 31 días)
    var dx = datosSTD_(periodo, 'consolidado'), nD = dx.n, por = {};
    dx.items.forEach(function (it) {
      var f = it.f, k = (String(f.Legajo || '').trim() || normT_(f.Nombre)) + '|' + normT_(f.Nombre).split(' ')[0];
      var o = por[k] = por[k] || { Legajo: f.Legajo, Nombre: f.Nombre, Empresa: f.Empresa, Servicios: [], tot: 0, D: 0, N: 0, de: 0, aus: 0, trab: 0 };
      var sv = (it.serv && (it.serv.Cliente || it.serv.Servicio)) || ''; if (sv && o.Servicios.indexOf(sv) < 0) o.Servicios.push(sv);
      o.tot += it.x.tot; o.D += it.x.D; o.N += it.x.N; o.de += it.x.de; o.aus += it.x.aus; o.trab += it.x.trab;
    });
    var f6 = Object.keys(por).map(function (k) {
      var o = por[k], he = horasExtras_(o.tot, o.aus, nD);
      return { Legajo: o.Legajo, Nombre: o.Nombre, Empresa: o.Empresa, Servicio: o.Servicios.join(' · '), D: o.D, N: o.N, Tot: o.tot, DE: o.de, Liq: o.tot + o.de,
        Trab: o.trab, Aus: o.aus, HsAus: he.hsAus, Norm: he.normales, Tvn: he.tvn, Ext: he.extras, Dif: he.dif, Prod: Math.round((o.tot + o.de) / HS_BASE_PERIODO * 10000) / 100 };
    }).sort(function (a, b) { return b.Ext - a.Ext || String(a.Nombre).localeCompare(String(b.Nombre)); });
    var c6 = col([['Legajo', 'LP'], ['Nombre', 'Apellido y Nombre'], ['Empresa', 'Empresa'], ['Servicio', 'Servicios'],
      ['D', 'Diurnas (A)', 1], ['N', 'Nocturnas (B)', 1], ['Tot', 'A+B', 1, '', { bg: '#e2f0d9' }], ['DE', 'Instr. + Retén', 1], ['Liq', 'Total a liquidar', 1],
      ['Trab', 'Días trabajados', 1], ['Aus', 'Días de ausentismo', 1], ['HsAus', 'Hs. de ausentismo', 1], ['Norm', 'Hs. normales', 1], ['Tvn', 'Hs. trab. vs nor.', 1],
      ['Ext', 'Horas extras', 1, '', { bg: '#a9d18e' }], ['Dif', 'Diferencias', 1, '', { fc: '#ff0000' }], ['Prod', 'Productividad %', 1]]);
    out = { cols: c6, filas: f6, total: sumar(f6, c6),
      nota: 'Período de ' + nD + ' días: cada día de ausentismo descuenta ' + (Math.round(HS_BASE_PERIODO / nD * 10000) / 10000) + ' hs (208 / ' + nD + ').' };
  } else throw new Error('Ese informe no tiene vista rápida.');
  out.periodo = periodo; out.nombre = nombrePeriodo_(periodo); out.tipo = tipo;
  // Período sin datos en la app: se muestra lo cargado desde archivos (Carga masiva), tal cual
  if (!out.filas.length) {
    var tt = { facturacionNov: 'Facturación', facturacion: 'Horas Contratadas vs Realizadas', plus: 'Plus', licencias: 'Injustificados y Licencias', eventos: 'Eventos' }[tipo];
    var tb = [];
    try { tb = tablasHist_(periodo, tt); } catch (e) { }
    if (tb.length) {
      var t0 = tb[0], aNum = function (x) { var s0 = String(x === undefined ? '' : x).trim(); if (!/^-?[\d.]+(,\d+)?$/.test(s0)) return null; var v0 = Number(s0.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(v0) ? null : v0; };
      var cols2 = t0.cab.map(function (c, i) {
        var no = 0, si = 0;
        t0.filas.forEach(function (f) { var x = f[i]; if (String(x || '').trim()) { if (aNum(x) !== null) si++; else no++; } });
        return { k: 'c' + i, t: c, n: si > 0 && si >= no * 3, g: '' };
      });
      var filas2 = t0.filas.map(function (f) { var o = {}; cols2.forEach(function (c, i) { o[c.k] = c.n ? (aNum(f[i]) || 0) : (f[i] || ''); }); return o; });
      out = { cols: cols2, filas: filas2, total: sumar(filas2, cols2), periodo: periodo, nombre: nombrePeriodo_(periodo), tipo: tipo,
        origen: 'Datos del archivo cargado: ' + t0.archivo + ' (pestaña ' + t0.pestana + ')' };
    }
  }
  return out;
}

/**
 * RESUMEN por objetivo: horas eventuales, caídas, retén, instrucción, total instr. + retén y días de vacaciones.
 * Vacaciones: si el mismo vigilador figura en varios servicios, sus días se cuentan una sola vez
 * (en el servicio donde aparece primero).
 */
function datosResumen_(periodo) {
  var fn = datosFacturacionNov_(periodo), d = datosSTD_(periodo, 'consolidado');
  var vistos = {}, vacPor = {};
  d.items.forEach(function (it) {
    var v = it.x.est.VAC || 0;
    if (!v) return;
    var k = it.f.Legajo ? 'L' + String(it.f.Legajo).trim() : 'N' + normT_(it.f.Nombre);
    if (vistos[k]) return;
    vistos[k] = 1;
    vacPor[it.f.ServicioId] = (vacPor[it.f.ServicioId] || 0) + v;
  });
  var filas = fn.map(function (f) {
    return { sid: f.sid, cliente: f.cliente, empresa: f.empresa, sup: f.sup, ev: f.ev, caidas: f.nc, ret: f.ret, ins: f.ins, ri: f.ri, vac: vacPor[f.sid] || 0 };
  });
  var tot = { ev: 0, caidas: 0, ret: 0, ins: 0, ri: 0, vac: 0 };
  filas.forEach(function (f) { Object.keys(tot).forEach(function (k) { tot[k] += Number(f[k]) || 0; }); });
  Object.keys(tot).forEach(function (k) { tot[k] = Math.round(tot[k] * 100) / 100; });
  return { periodo: periodo, nombre: nombrePeriodo_(periodo), filas: filas, total: tot, personasVac: Object.keys(vistos).length };
}
