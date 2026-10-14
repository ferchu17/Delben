/**
 * ============================================================
 * ARCHIVOS EXCEL
 * ============================================================
 * Arma los Excel con el mismo formato y colores que las planillas
 * de los supervisores:
 *   - Una pestaña por servicio (calco de la planilla).
 *   - STD: vigilador por vigilador, cada día con horas Diurnas y Nocturnas.
 *   - Personal: el personal de la zona con total de horas, estados y horas extras.
 *   - Totales: lo mismo que Personal, de todas las zonas.
 * Sin filas vacías de por medio en STD, Personal y Totales.
 *
 * Se arma una planilla de Google temporal, se exporta como .xlsx y se manda
 * a la papelera. Necesita los permisos de Drive y de conexión externa
 * (están en appsscript.json).
 * ============================================================
 */

// Horas del mes a partir de las cuales se cuentan horas extras (Guardia - 200 HS).
var HORAS_BASE_MES = 200;

var XL = {
  AMARILLO: '#ffff00', VERDE: '#c5e0b4', VERDE2: '#a9d08e', VERDE_BTN: '#92d050', GRIS_DIA: '#d9d9d9',
  SAB: '#375623', DOM: '#ff0000', NOCHE: '#a6a6a6', TARDE: '#9dc3e6', AZUL_TOT: '#2e75b6',
  NEG: '#ff0000', POS: '#0070c0', LEY_VERDE: '#c5e0b4', LEY_AMARILLA: '#ffe699'
};
// Colores de los códigos (formato condicional del Excel): [fondo, letra]
var XL_CODIGOS = {
  F: ['#92d050', '#000000'], INJ: ['#ff0000', '#ffff00'], SUS: ['#7030a0', '#ffffff'], ENF: ['#cc9900', '#000000'],
  ART: ['#ff7c80', '#000000'], RES: ['#ffff00', '#000000'], VAC: ['#8497b0', '#ffffff'], DV: ['#8497b0', '#ffff00'],
  BAJA: ['#0d0d0d', '#ffffff']
};
var DIAS_XL_ = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'];
var DIAS_KEY_ = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

/* ---------------- cuentas de horas ---------------- */

// Horas nocturnas (21 a 06) de un turno de h horas que empieza a la hora ini.
function repartirDesde_(ini, h) {
  var n = 0;
  for (var k = -1; k <= 1; k++) {
    var a = 21 + 24 * k, b = 30 + 24 * k;
    n += Math.max(0, Math.min(ini + h, b) - Math.max(ini, a));
  }
  n = Math.round(n * 100) / 100;
  return { d: Math.round((h - n) * 100) / 100, n: n };
}

// Lee una celda: { tipo: 'horas', h, d, n, color } | { tipo: 'codigo', cod } | { tipo: 'vacio' }
function leerCelda_(v) {
  var b = valorBase_(v).replace(',', '.');
  if (!b) return { tipo: 'vacio' };
  var m = b.match(/^(\d{1,2}(?:\.5)?)([NDT])?$/);
  if (!m) return { tipo: 'codigo', cod: b };
  var h = Number(m[1]);
  var color = m[2] === 'N' || m[2] === 'T' ? m[2] : '';
  var hor = horarioDeNota_(notaDe_(v));
  var ini = hor ? hor.ini : (color === 'T' ? 14 : (color === 'N' && h < 24 ? 30 - h : 6));
  var r = repartirDesde_(ini, h);
  return { tipo: 'horas', h: h, d: r.d, n: r.n, color: color };
}

var FERIADOS_CACHE_ = null;
function esFeriado_(fecha) {
  if (!FERIADOS_CACHE_) { FERIADOS_CACHE_ = {}; leer_('Feriados').forEach(function (f) { FERIADOS_CACHE_[f.Fecha] = f.Descripcion || 'Feriado'; }); }
  return FERIADOS_CACHE_[iso_(fecha)] || '';
}
// v1.22.8: servicios donde las horas contratadas son las realizadas (RAZ Barracas, Trelles y Montenegro): nunca hay diferencia.
// Se marca en el servicio (Servicios > Editar) y, si no se marcó nada, va por el nombre.
function sinDiferencia_(serv) {
  if (!serv) return false;
  var v = String(serv.SinDiferencia || '').toUpperCase();
  if (v === 'SI') return true;
  if (v === 'NO') return false;
  var t = normT_(String(serv.Servicio || '') + ' ' + String(serv.Cliente || ''));
  return /\bRAZ\b/.test(t) && /BARRACAS|TRELLES|MONTENEGRO/.test(t);
}
// Horas contratadas de un día. Si es feriado y el servicio tiene horas de feriado cargadas, se usan esas.
// v1.22.9: personas cuyas horas no suman para la facturación (Daniel Cruz). Se puede cambiar en Config (NO_FACTURA, nombres separados por coma).
var NO_FACTURA_ = null;
function noFactura_(nombre) {
  if (!NO_FACTURA_) {
    NO_FACTURA_ = [['CRUZ', 'DANIEL']];
    try { var c = String(config_().NO_FACTURA || '').trim(); if (c) NO_FACTURA_ = c.split(',').map(function (x) { return normT_(x).split(' ').filter(Boolean); }); } catch (e) { }
  }
  var lista = NO_FACTURA_;
  var t = normT_(nombre).split(' ');
  return lista.some(function (x) { return x.length && x.every(function (k) { return t.indexOf(k) >= 0; }); });
}
var CONTR_DIA_ = null;
function contratadoDia_(serv, fecha) {
  var num = function (x) { return Number(String(x || '0').replace(',', '.')) || 0; };
  // v1.22.9: lo cargado a mano en la Planificación de servicios para ese día manda
  if (!CONTR_DIA_) { CONTR_DIA_ = {}; try { leer_('ContratadoDia').forEach(function (x) { CONTR_DIA_[x.ServicioId + '|' + x.Fecha] = { d: num(x.D), n: num(x.N) }; }); } catch (e) { } }
  var ov = serv && CONTR_DIA_[serv.Id + '|' + iso_(fecha)];
  if (ov) return { d: ov.d, n: ov.n };
  if (esFeriado_(fecha) && (String(serv.D_FER || '') !== '' || String(serv.N_FER || '') !== '')) {
    return { d: num(serv.D_FER), n: num(serv.N_FER) };
  }
  var k = DIAS_KEY_[(fecha.getUTCDay() + 6) % 7];
  return { d: num(serv['D_' + k]), n: num(serv['N_' + k]) };
}

/* ---------------- libro temporal y exportación ---------------- */

/* ---------------- Carpetas de Drive ----------------
   Todo se guarda en la carpeta "Novedades del Personal" de Fernando, cada cosa en su subcarpeta:
     Novedades · Proyeccion · Conformacines Horarias · Contratado Vs. Realizado · Consolidado · STD · Facturacion · Plus por funcion
   (Se busca la subcarpeta por su nombre; si no existe, se crea.) */
var RAIZ_POR_DEFECTO_ = '12RNxh3wbvAFOIyjYAYE86rfRFj05MQB4';
var CARPETA_DE_ = {
  conformacion: 'Conformacines Horarias', std: 'STD', consolidado: 'Consolidado', facturacion: 'Contratado Vs. Realizado',
  plus: 'Plus por funcion', planificacion: 'Proyeccion', facturacionNov: 'Facturacion', treinta: 'Novedades', licencias: 'Proyeccion', eventos: 'Proyeccion', rrhh: 'Novedades', planilla: 'Proyeccion'
};
// Carpeta de cada tipo de archivo cargado en Carga masiva.
var CARPETA_TIPO_ = {
  'Novedades del Personal': 'Novedades', 'Planificación': 'Proyeccion', 'Proyección': 'Proyeccion', 'Planilla de supervisor': 'Proyeccion',
  'Horas Contratadas vs Realizadas': 'Contratado Vs. Realizado', 'Conformación horaria': 'Conformacines Horarias', 'Consolidado': 'Consolidado',
  'STD': 'STD', '30/31 días': 'Novedades', 'Plus': 'Plus por funcion', 'Facturación': 'Facturacion'
};
var DESTINO_ = '', MEMO_RAIZ_ = null, MEMO_SUBC_ = {};
function carpetaRaiz_() {
  if (MEMO_RAIZ_) return MEMO_RAIZ_;
  var id = String(config_().RAIZ_CARPETA || RAIZ_POR_DEFECTO_);
  try { var c = DriveApp.getFolderById(id); if (!c.isTrashed()) { MEMO_RAIZ_ = c; return c; } } catch (e) { }
  MEMO_RAIZ_ = carpetaInformesVieja_();
  return MEMO_RAIZ_;
}
function subcarpeta_(nombre) {
  if (!nombre) return carpetaRaiz_();
  if (MEMO_SUBC_[nombre]) return MEMO_SUBC_[nombre];
  var raiz = carpetaRaiz_(), it = raiz.getFolders(), k = normT_(nombre).replace(/[^A-Z0-9]/g, '');
  while (it.hasNext()) { var f = it.next(); if (normT_(f.getName()).replace(/[^A-Z0-9]/g, '') === k) { MEMO_SUBC_[nombre] = f; return f; } }
  MEMO_SUBC_[nombre] = raiz.createFolder(nombre);
  return MEMO_SUBC_[nombre];
}
// Carpeta donde va lo que se está armando ahora (según DESTINO_).
function carpetaSalida_() { return subcarpeta_(CARPETA_DE_[DESTINO_] || ''); }
function carpetaInformes_() { return carpetaRaiz_(); }

// Carpeta vieja (versiones anteriores): solo si no se puede abrir la carpeta "Novedades del Personal".
var MEMO_CARPETA_INF_ = null;
function carpetaInformesVieja_() {
  if (MEMO_CARPETA_INF_) return MEMO_CARPETA_INF_;
  var id = String(config_().INFORMES_CARPETA || '');
  if (id) { try { var c0 = DriveApp.getFolderById(id); if (!c0.isTrashed()) { MEMO_CARPETA_INF_ = c0; return c0; } } catch (e) { /* se crea de nuevo */ } }
  // Si ya existe una carpeta con ese nombre se usa esa (así no se crean dos si se abren dos informes a la vez).
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { }
  try {
    delete MEMO_HOJAS_.Config;
    id = String(config_().INFORMES_CARPETA || '');
    if (id) { try { var c1 = DriveApp.getFolderById(id); if (!c1.isTrashed()) { MEMO_CARPETA_INF_ = c1; return c1; } } catch (e) { } }
    var it = DriveApp.getRootFolder().getFoldersByName('Novedades del Personal - Informes');
    var c = it.hasNext() ? it.next() : DriveApp.createFolder('Novedades del Personal - Informes');
    var lista = leer_('Config'), k = indice_(lista, 'Clave', 'INFORMES_CARPETA');
    if (k < 0) lista.push({ Clave: 'INFORMES_CARPETA', Valor: c.getId() }); else lista[k].Valor = c.getId();
    reescribir_('Config', lista);
    MEMO_CARPETA_INF_ = c;
    return c;
  } finally { try { lock.releaseLock(); } catch (e) { } }
}
function moverAInformes_(id) {
  try { var f = DriveApp.getFileById(id), c = carpetaSalida_(); c.addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (e) { /* queda en Mi unidad */ }
}

function crearLibro_(nombre) {
  var ss = SpreadsheetApp.create(nombre);
  try { ss.setSpreadsheetTimeZone(APP.TZ); } catch (e) { }
  moverAInformes_(ss.getId());
  return ss;
}

// Copia completa de una planilla modelo de la empresa (mismo formato, pestañas, anchos, colores y fórmulas).
function copiaModelo_(clave, nombre) {
  var m = modelo_(clave);
  if (!m) return null;
  var f = DriveApp.getFileById(m.getId()).makeCopy(nombre, carpetaSalida_());
  if (f.getMimeType() !== MimeType.GOOGLE_SHEETS) throw new Error('El modelo ' + clave + ' no quedó como planilla de Google. Revisá el ID en Datos > Planillas modelo.');
  var ss = SpreadsheetApp.openById(f.getId());
  // Misma zona horaria que la app: si no, las fechas se corren un día (26/08 aparecía como 25/08 20:00).
  try { ss.setSpreadsheetTimeZone(APP.TZ); } catch (e) { }
  return ss;
}

/**
 * El informe queda como planilla de Google en la carpeta de informes (se abre en el navegador con su formato)
 * y se ofrece el enlace para bajarlo en Excel. Para adjuntarlo a un correo se exporta a .xlsx.
 */
function colLetra_(n) { var t = ''; while (n > 0) { var m = (n - 1) % 26; t = String.fromCharCode(65 + m) + t; n = Math.floor((n - 1) / 26); } return t; }
function exportarXlsx_(ss, nombre) {
  // Sin paneles inmovilizados: en la vista de Google aparecen como una franja gris entre los títulos y los datos.
  ss.getSheets().forEach(function (sh) { try { if (sh.getFrozenRows()) sh.setFrozenRows(0); if (sh.getFrozenColumns()) sh.setFrozenColumns(0); } catch (e) { } });
  // v1.22.9: los ceros solos no se muestran (tampoco en el Excel ni en el PDF)
  ss.getSheets().forEach(function (sh) {
    try {
      var rg = sh.getDataRange(), v = rg.getValues(), fo = rg.getFormulas(), lista = [];
      for (var i = 0; i < v.length; i++) for (var j = 0; j < v[i].length; j++) if (v[i][j] === 0 && !fo[i][j]) lista.push(colLetra_(j + 1) + (i + 1));
      for (var k = 0; k < lista.length; k += 500) sh.getRangeList(lista.slice(k, k + 500)).clearContent();
    } catch (e) { Logger.log('Ceros en ' + sh.getName() + ': ' + e.message); }
  });
  SpreadsheetApp.flush();
  var id = ss.getId();
  return {
    nombre: nombre + '.xlsx', id: id, url: ss.getUrl(),
    xlsx: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
    getName: function () { return nombre + '.xlsx'; },
    adjunto: function () {
      var resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
        { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) throw new Error('export ' + resp.getResponseCode());
      return resp.getBlob().setName(nombre + '.xlsx');
    }
  };
}
function salida_(r) { return { nombre: r.nombre, url: r.url, xlsx: r.xlsx }; }

// Manda el informe: adjunto en Excel; si no se puede exportar, con el enlace.
function mandarInforme_(para, u, que, r, texto) {
  var adj = [];
  try { adj = [r.adjunto()]; } catch (e) { adj = []; }
  var cuerpo = '<p>' + texto + '</p><p><a href="' + r.url + '">Abrir la planilla</a> · <a href="' + r.xlsx + '">Descargar en Excel</a></p>';
  enviarMail_(para.join(','), u, que, cuerpoMail_(que, cuerpo), adj);
}

function nombreHoja_(t) {
  return String(t || 'Hoja').replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 95);
}

/* ---------------- pestaña de un servicio (calco de la planilla) ---------------- */

function hojaServicio_(ss, serv, periodo, filasPlanilla, codigos) {
  var info = periodoInfo_(periodo), n = info.n;
  var sh = ss.insertSheet(nombreHoja_(serv.Servicio));
  var C0 = 6, CT = C0 + n, ultCol = CT; // días desde F, Total al final
  var fechas = [];
  for (var i = 0; i < n; i++) fechas.push(fechaDia_(periodo, i));

  // Anchos de columna (en píxeles), como el Excel
  sh.setColumnWidth(1, 28); sh.setColumnWidth(2, 78); sh.setColumnWidth(3, 82); sh.setColumnWidth(4, 290); sh.setColumnWidth(5, 130);
  sh.setColumnWidths(C0, n, 38); sh.setColumnWidth(CT, 58);
  sh.getRange(1, 1, 200, ultCol).setFontFamily('Calibri').setFontSize(11).setVerticalAlignment('middle');

  // Filas 1 a 3
  sh.getRange(1, 3).setValue((serv.Empresa || '') + '.').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange(1, 4).setValue(serv.Cliente || serv.Servicio).setFontSize(14).setFontWeight('bold');
  sh.getRange(2, 4, 1, 2).setValues([['Personal', 'STD']]).setBackground(XL.VERDE_BTN).setFontSize(18).setFontWeight('bold')
    .setFontColor('#1f3c9a').setHorizontalAlignment('center').setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange(3, 2, 1, ultCol - 1).merge().setValue('Cobertura de Servicios').setBackground(XL.AMARILLO).setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, true, true, true, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(2, 31); sh.setRowHeight(3, 41);

  var fila = 4;
  var encabezado = function (titTurno) {
    sh.getRange(fila, 1, 2, 1).merge();
    sh.getRange(fila, 2, 2, 1).merge().setValue('Empresa');
    sh.getRange(fila, 3, 2, 1).merge().setValue('LP');
    sh.getRange(fila, 4, 2, 1).merge().setValue('APELLIDO Y NOMBRE');
    sh.getRange(fila, 5, 2, 1).merge().setValue(titTurno).setWrap(true);
    sh.getRange(fila, CT, 2, 1).merge().setValue('Total');
    var nums = [], dias = [], bgD = [], fcD = [];
    fechas.forEach(function (d) {
      var w = (d.getUTCDay() + 6) % 7;
      var fer = esFeriado_(d);
      nums.push(d.getUTCDate()); dias.push(fer ? 'Feriado' : DIAS_XL_[w]);
      bgD.push(fer ? '#ff8c00' : w === 5 ? XL.SAB : w === 6 ? XL.DOM : '#ffffff');
      fcD.push(fer || w >= 5 ? '#ffff00' : '#000000');
    });
    sh.getRange(fila, C0, 1, n).setValues([nums]).setBackground(XL.GRIS_DIA);
    sh.getRange(fila + 1, C0, 1, n).setValues([dias]).setBackgrounds([bgD]).setFontColors([fcD]);
    var r = sh.getRange(fila, 1, 2, ultCol);
    r.setFontWeight('bold').setHorizontalAlignment('center').setFontFamily('Arial').setFontSize(10)
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(fila, 2).setFontFamily('Calibri').setFontSize(11);
    sh.getRange(fila, CT).setFontFamily('Calibri').setFontSize(11);
    fila += 2;
  };

  var bloque = function (filas, minimo) {
    var cant = Math.max(minimo, filas.length);
    if (!cant) return fila;
    var vals = [], bgs = [], fcs = [], notas = [], bolds = [];
    for (var k = 0; k < cant; k++) {
      var f = filas[k];
      var rowV = [k + 1, f ? f.Empresa : '', f ? (f.Legajo ? Number(f.Legajo) || f.Legajo : '') : '', f ? f.Nombre : '', f ? f.Puesto : ''];
      var rowB = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'], rowF = ['#000000', '#000000', '#000000', '#000000', '#000000'];
      var rowN = ['', '', '', '', ''], rowW = ['bold', 'bold', 'bold', 'normal', 'normal'];
      var tot = 0;
      for (var i = 0; i < n; i++) {
        var v = f ? f[DIAS_COL[i]] : '';
        var c = leerCelda_(v), bg = '#ffffff', fc = '#000000', w = 'normal', val = '';
        if (c.tipo === 'horas') {
          val = c.h; tot += c.h;
          if (c.color === 'N') bg = XL.NOCHE; else if (c.color === 'T') bg = XL.TARDE;
        } else if (c.tipo === 'codigo') {
          val = c.cod; w = 'bold';
          var col = XL_CODIGOS[c.cod] || (c.cod.indexOf('F') >= 0 ? XL_CODIGOS.F : null);
          if (col) { bg = col[0]; fc = col[1]; }
        }
        rowV.push(val); rowB.push(bg); rowF.push(fc); rowN.push(notaDe_(v)); rowW.push(w);
      }
      rowV.push(f ? tot : ''); rowB.push('#ffffff'); rowF.push('#000000'); rowN.push(''); rowW.push('normal');
      vals.push(rowV); bgs.push(rowB); fcs.push(rowF); notas.push(rowN); bolds.push(rowW);
    }
    var r = sh.getRange(fila, 1, cant, ultCol);
    r.setValues(vals).setBackgrounds(bgs).setFontColors(fcs).setNotes(notas).setFontWeights(bolds)
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(fila, 1, cant, 3).setHorizontalAlignment('center');
    sh.getRange(fila, C0, cant, n + 1).setHorizontalAlignment('center');
    var desde = fila;
    fila += cant;
    return desde;
  };

  var cob = filasPlanilla.filter(function (f) { return f.Seccion !== 'RETEN' && f.Seccion !== 'EVENTO'; });
  var ret = filasPlanilla.filter(function (f) { return f.Seccion === 'RETEN'; });
  var evs = filasPlanilla.filter(function (f) { return f.Seccion === 'EVENTO'; });

  encabezado('Turno');
  bloque(cob, 10);

  // Totales de cobertura
  var T = [], C = [], D = [];
  for (var i = 0; i < n; i++) {
    var t = 0;
    cob.forEach(function (f) { var c = leerCelda_(f[DIAS_COL[i]]); if (c.tipo === 'horas') t += c.h; });
    var ct = sinDiferencia_(serv) ? { d: t, n: 0 } : contratadoDia_(serv, fechas[i]);
    T.push(t); C.push(ct.d + ct.n); D.push(t - ct.d - ct.n);
  }
  var suma = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  var filaTot = function (etq, arr, bg, fuenteArial, negrita, colorDif) {
    sh.getRange(fila, 4, 1, 2).setBackground(bg);
    sh.getRange(fila, 4).setValue(etq).setFontWeight('bold');
    if (fuenteArial) sh.getRange(fila, 4).setFontFamily('Arial').setFontSize(10);
    var vals = arr.concat([suma(arr)]);
    var r = sh.getRange(fila, C0, 1, n + 1);
    r.setValues([vals]).setBackground(bg).setHorizontalAlignment('center');
    if (negrita) r.setFontWeight('bold').setFontFamily('Arial').setFontSize(10);
    if (colorDif) {
      r.setBackgrounds([vals.map(function (v) { return v < 0 ? XL.NEG : v > 1 ? XL.POS : bg; })])
        .setFontColors([vals.map(function (v) { return v < 0 || v > 1 ? '#ffff00' : '#000000'; })]);
    }
    sh.getRange(fila, 4, 1, n + 3).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    fila++;
  };
  filaTot('TOTAL POR DIA', T, XL.VERDE, true, false, false);
  filaTot('CONTRATADO X DÍA', C, XL.AMARILLO, false, false, false);
  filaTot('DIFERENCIA DIURNO', D, XL.VERDE, true, true, true);
  sh.getRange(fila, CT).setValue('TOTAL').setBackground(XL.AZUL_TOT).setHorizontalAlignment('center');
  fila += 1;

  // Instrucción o Retén
  sh.getRange(fila, 4, 1, ultCol - 3).merge().setValue('RETEN / INSTRUCCIÓN').setBackground(XL.AMARILLO).setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setBorder(true, true, true, true, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(fila, 30);
  fila++;
  encabezado('Instrucción\no Reten');
  bloque(ret, 5);
  var R = [];
  for (var j = 0; j < n; j++) {
    var tr = 0;
    ret.forEach(function (f) { var c = leerCelda_(f[DIAS_COL[j]]); if (c.tipo === 'horas') tr += c.h; });
    R.push(tr);
  }
  sh.getRange(fila, 3, 1, 3).merge().setValue('Total por dia Instrucción / Reten').setHorizontalAlignment('center');
  sh.getRange(fila, 3, 1, n + 3).setBackground(XL.VERDE2).setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(fila, C0, 1, n).setValues([R]).setHorizontalAlignment('center');
  fila += 2;

  // Eventuales / Adicional
  sh.getRange(fila, 4, 1, ultCol - 3).merge().setValue('EVENTUALES / ADICIONAL').setBackground('#f8cbad').setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setBorder(true, true, true, true, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(fila, 30);
  fila++;
  encabezado('Evento / Puesto');
  bloque(evs, 3);
  var EV = [];
  for (var q = 0; q < n; q++) {
    var te = 0;
    evs.forEach(function (f) { var c = leerCelda_(f[DIAS_COL[q]]); if (c.tipo === 'horas') te += c.h; });
    EV.push(te);
  }
  sh.getRange(fila, 3, 1, 3).merge().setValue('Total por dia Eventuales / Adicional').setHorizontalAlignment('center');
  sh.getRange(fila, 3, 1, n + 4).setBackground('#f8cbad').setFontWeight('bold').setFontFamily('Arial').setFontSize(10)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(fila, C0, 1, n + 1).setValues([EV.concat([EV.reduce(function (a, b) { return a + b; }, 0)])]).setHorizontalAlignment('center');
  fila += 3;

  // Tabla de códigos
  if (codigos.length) {
    var ley = codigos.map(function (c) { return [c.Codigo, c.Descripcion]; });
    var r = sh.getRange(fila, 3, ley.length, 2);
    r.setValues(ley).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    r.setBackgrounds(ley.map(function (x, k) { var b = k % 2 ? XL.LEY_AMARILLA : XL.LEY_VERDE; return [b, b]; }));
  }
  sh.setFrozenRows(5);
  sh.setFrozenColumns(5);
  sh.setHiddenGridlines(true);
  return sh;
}

/* ---------------- STD, Personal y Totales ---------------- */

// Una fila por persona y servicio, con las horas diurnas y nocturnas de cada día.
// opt: { titulo, porApellido (orden alfabético, como "30 Días"), subtotales (total por servicio, como el Consolidado) }
function hojaSTD_(ss, periodo, servs, planilla, personal, opt) {
  opt = opt || {};
  var info = periodoInfo_(periodo), n = info.n;
  var sh = ss.insertSheet(opt.titulo || 'STD');
  var cat = {};
  personal.forEach(function (p) { cat[p.Legajo] = p.Categoria; });
  var nombres = {}, orden = {};
  servs.forEach(function (s, k) { nombres[s.Id] = s.Cliente || s.Servicio; orden[s.Id] = k; });

  var cab1 = ['Empresa', 'Orden', 'Legajo', 'Apellido y Nombre', 'Cat.', 'Puesto', 'Cliente'];
  var fechasTxt = [], semTxt = [], dn = [];
  for (var i = 0; i < n; i++) {
    var d = fechaDia_(periodo, i);
    fechasTxt.push(ddmm_(d) + '/' + d.getUTCFullYear(), '');
    semTxt.push(DIAS_XL_[(d.getUTCDay() + 6) % 7], '');
    dn.push('D', 'N');
  }
  var ancho = cab1.length + 2 * n + 3;
  sh.getRange(1, 1).setValue((opt.titulo || 'STD') + ' · ' + nombrePeriodo_(periodo)).setFontSize(14).setFontWeight('bold');
  sh.getRange(2, 8, 1, 2 * n).setValues([fechasTxt]);
  sh.getRange(3, 8, 1, 2 * n).setValues([semTxt]);
  sh.getRange(4, 1, 1, ancho).setValues([cab1.concat(dn).concat(['Total D', 'Total N', 'Total'])]);
  for (var j = 0; j < n; j++) {
    sh.getRange(2, 8 + 2 * j, 1, 2).merge();
    sh.getRange(3, 8 + 2 * j, 1, 2).merge();
    var w = (fechaDia_(periodo, j).getUTCDay() + 6) % 7;
    if (w >= 5) sh.getRange(3, 8 + 2 * j, 1, 2).setBackground(w === 5 ? XL.SAB : XL.DOM).setFontColor('#ffff00');
  }
  sh.getRange(2, 8, 1, 2 * n).setBackground(XL.GRIS_DIA);
  sh.getRange(2, 1, 3, ancho).setFontWeight('bold').setHorizontalAlignment('center').setFontFamily('Arial').setFontSize(10)
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  var filas = planilla.filter(function (f) { return f.Periodo === periodo && nombres[f.ServicioId] !== undefined && (f.Nombre || f.Legajo); });
  if (opt.porApellido) filas.sort(function (a, b) { return String(a.Nombre).localeCompare(String(b.Nombre)) || (orden[a.ServicioId] - orden[b.ServicioId]); });
  else filas.sort(function (a, b) { return (orden[a.ServicioId] - orden[b.ServicioId]) || (a.Seccion === b.Seccion ? Number(a.Orden) - Number(b.Orden) : (a.Seccion === 'RETEN' ? 1 : -1)); });
  var vals = [], bgs = [], cont = {}, sub = null, nro = 0;
  var cerrarSub = function () {
    if (!sub) return;
    var row = ['', '', '', 'Total ' + sub.nombre, '', '', ''];
    for (var i = 0; i < n; i++) row.push(sub.d[i], sub.n[i]);
    row.push(sub.tD, sub.tN, sub.tD + sub.tN);
    vals.push(row); bgs.push(row.map(function () { return XL.VERDE2; }));
    sub = null;
  };
  filas.forEach(function (f) {
    cont[f.ServicioId] = (cont[f.ServicioId] || 0) + 1;
    nro++;
    if (opt.subtotales && (!sub || sub.id !== f.ServicioId)) {
      cerrarSub();
      sub = { id: f.ServicioId, nombre: nombres[f.ServicioId], d: [], n: [], tD: 0, tN: 0 };
      for (var z = 0; z < n; z++) { sub.d.push(0); sub.n.push(0); }
    }
    var row = [f.Empresa, opt.porApellido ? nro : cont[f.ServicioId], f.Legajo ? Number(f.Legajo) || f.Legajo : '', f.Nombre, cat[f.Legajo] || '', f.Puesto || (f.Seccion === 'RETEN' ? 'Retén' : f.Seccion === 'EVENTO' ? 'Eventual' : ''), nombres[f.ServicioId]];
    var bg = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'];
    var tD = 0, tN = 0;
    for (var i = 0; i < n; i++) {
      var c = leerCelda_(f[DIAS_COL[i]]);
      if (c.tipo === 'horas') {
        row.push(c.d, c.n); tD += c.d; tN += c.n; bg.push('#ffffff', c.n ? '#ededed' : '#ffffff');
        if (sub && f.Seccion !== 'RETEN' && f.Seccion !== 'EVENTO') { sub.d[i] += c.d; sub.n[i] += c.n; }
      }
      else if (c.tipo === 'codigo') {
        row.push(c.cod, 0);
        var col = XL_CODIGOS[c.cod] || (c.cod.indexOf('F') >= 0 ? XL_CODIGOS.F : null);
        bg.push(col ? col[0] : '#ffffff', '#ffffff');
      } else { row.push('', ''); bg.push('#ffffff', '#ffffff'); }
    }
    row.push(tD, tN, tD + tN); bg.push(XL.VERDE, XL.VERDE, XL.VERDE);
    if (sub && f.Seccion !== 'RETEN' && f.Seccion !== 'EVENTO') { sub.tD += tD; sub.tN += tN; }
    vals.push(row); bgs.push(bg);
  });
  cerrarSub();
  if (vals.length) {
    var r = sh.getRange(5, 1, vals.length, ancho);
    r.setValues(vals).setBackgrounds(bgs).setFontFamily('Calibri').setFontSize(10)
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(5, 8, vals.length, 2 * n + 3).setHorizontalAlignment('center');
  }
  sh.setColumnWidth(4, 240); sh.setColumnWidth(6, 140); sh.setColumnWidth(7, 170);
  sh.setColumnWidths(8, 2 * n, 30);
  sh.setFrozenRows(4); sh.setFrozenColumns(4);
  return sh;
}

// Resumen por persona: horas, estados y horas extras.
function resumenPersonas_(periodo, servIds, planilla, personal, codigos) {
  var porLeg = {};
  personal.forEach(function (p) { porLeg[p.Legajo] = p; });
  var servNom = {};
  leer_('Servicios').forEach(function (s) { servNom[s.Id] = s.Servicio; });
  var res = {};
  planilla.forEach(function (f) {
    if (f.Periodo !== periodo || !servIds[f.ServicioId] || !(f.Nombre || f.Legajo)) return;
    var k = clavePersona_(f);
    if (!res[k]) {
      var p = porLeg[f.Legajo] || {};
      res[k] = { Nombre: f.Nombre, Legajo: f.Legajo, Empresa: f.Empresa || p.Empresa || '', Categoria: p.Categoria || '',
        Zona: p.Zona || p.Supervisor || '', Servicios: {}, D: 0, N: 0, cods: {} };
    }
    var x = res[k];
    x.Servicios[servNom[f.ServicioId] || f.ServicioId] = 1;
    for (var i = 0; i < 31; i++) {
      var c = leerCelda_(f[DIAS_COL[i]]);
      if (c.tipo === 'horas') { x.D += c.d; x.N += c.n; }
      else if (c.tipo === 'codigo') x.cods[c.cod] = (x.cods[c.cod] || 0) + 1;
    }
  });
  return Object.keys(res).map(function (k) { return res[k]; }).sort(function (a, b) { return a.Nombre.localeCompare(b.Nombre); });
}

function hojaPersonas_(ss, titulo, lista, codigos, conZona) {
  var sh = ss.insertSheet(titulo);
  var cods = codigos.map(function (c) { return c.Codigo; });
  var cab = ['Apellido y Nombre', 'Legajo', 'Empresa', 'Cat.'].concat(conZona ? ['Zona'] : [])
    .concat(['Servicios', 'Horas diurnas', 'Horas nocturnas', 'Total de horas', 'Horas extras']).concat(cods).concat(['Total estados']);
  var vals = lista.map(function (x) {
    var tot = x.D + x.N, est = 0;
    var row = [x.Nombre, x.Legajo ? Number(x.Legajo) || x.Legajo : '', x.Empresa, x.Categoria].concat(conZona ? [x.Zona] : [])
      .concat([Object.keys(x.Servicios).join(', '), x.D, x.N, tot, Math.max(0, tot - HORAS_BASE_MES)]);
    cods.forEach(function (c) { var v = x.cods[c] || 0; est += v; row.push(v || ''); });
    row.push(est || '');
    return row;
  });
  // Fila de totales
  if (vals.length) {
    var totRow = cab.map(function () { return ''; });
    totRow[0] = 'TOTAL (' + vals.length + ' personas)';
    for (var c = (conZona ? 6 : 5); c < cab.length; c++) {
      totRow[c] = vals.reduce(function (s, r) { return s + (Number(r[c]) || 0); }, 0);
    }
    vals.push(totRow);
  }
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff')
    .setHorizontalAlignment('center').setWrap(true);
  if (vals.length) {
    var r = sh.getRange(2, 1, vals.length, cab.length);
    r.setValues(vals).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    var bgs = vals.map(function (row, k) {
      var b = k === vals.length - 1 ? XL.VERDE2 : (k % 2 ? '#f2f2f2' : '#ffffff');
      return row.map(function () { return b; });
    });
    r.setBackgrounds(bgs);
    sh.getRange(vals.length + 1, 1, 1, cab.length).setFontWeight('bold');
    sh.getRange(2, conZona ? 7 : 6, vals.length, cab.length - (conZona ? 6 : 5)).setHorizontalAlignment('center');
    // Horas extras en rojo cuando hay
    var colExt = (conZona ? 5 : 4) + 5;
    if (vals.length > 1) sh.getRange(2, colExt, vals.length - 1, 1).setFontColor('#c00000').setFontWeight('bold');
  }
  sh.getRange(1, 1, Math.max(2, vals.length + 1), cab.length).setFontFamily('Calibri').setFontSize(10);
  sh.setColumnWidth(1, 240); sh.setColumnWidth(conZona ? 6 : 5, 220);
  sh.setFrozenRows(1); sh.setFrozenColumns(1);
  return sh;
}

/* ---------------- armado de los libros ---------------- */

function libroServicio_(serv, periodo) {
  var nombre = 'Delben - ' + serv.Servicio + ' - ' + nombrePeriodo_(periodo);
  var ss = crearLibro_(nombre);
  var filas = planillaPeriodo_(periodo).filter(function (f) { return f.ServicioId === serv.Id; })
    .sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); });
  var codigos = leer_('Codigos').filter(function (c) { return c.Activo !== 'NO'; });
  hojaServicio_(ss, serv, periodo, filas, codigos);
  ss.deleteSheet(ss.getSheets()[0]);
  return exportarXlsx_(ss, nombre);
}

// Todas las pestañas de la zona + STD + Personal + Totales (de todas las zonas).
function libroZona_(supervisor, periodo, nombreSup) {
  var servs = leer_('Servicios').filter(function (s) {
    return s.Activo !== 'NO' && String(s.Supervisor || '').toLowerCase() === String(supervisor || '').toLowerCase();
  });
  var nombre = 'Delben - ' + (nombreSup || supervisor) + ' - ' + nombrePeriodo_(periodo);
  var ss = crearLibro_(nombre);
  var planilla = planillaPeriodo_(periodo);
  var codigos = leer_('Codigos').filter(function (c) { return c.Activo !== 'NO'; });
  var personal = personalSGI_();
  servs.forEach(function (s) {
    var filas = planilla.filter(function (f) { return f.ServicioId === s.Id; }).sort(function (a, b) { return Number(a.Orden) - Number(b.Orden); });
    hojaServicio_(ss, s, periodo, filas, codigos);
  });
  hojaSTD_(ss, periodo, servs, planilla, personal);
  var ids = {};
  servs.forEach(function (s) { ids[s.Id] = 1; });
  hojaPersonas_(ss, 'Personal', resumenPersonas_(periodo, ids, planilla, personal, codigos), codigos, false);
  var todos = {};
  leer_('Servicios').forEach(function (s) { todos[s.Id] = 1; });
  var lt = resumenPersonas_(periodo, todos, planilla, personal, codigos)
    .sort(function (a, b) { return a.Zona.localeCompare(b.Zona) || a.Nombre.localeCompare(b.Nombre); });
  hojaPersonas_(ss, 'Totales', lt, codigos, true);
  ss.deleteSheet(ss.getSheets()[0]);
  return exportarXlsx_(ss, nombre);
}

/* ---------------- acciones (se llaman desde api) ---------------- */

/**
 * d: { periodo, servicioId, alcance: 'servicio' | 'zona', modo: 'descargar' | 'mail', para }
 * Descargar devuelve el archivo en base64; mail lo manda adjunto.
 */
function accionExcel_(u, d) {
  DESTINO_ = 'planilla';
  var serv = servicioPermitido_(u, d.servicioId);
  var blob, que, avisos = [];
  if (d.formato === 'planificacion' && plantillaId_('PLANTILLA_ID')) {
    // Con la Planificación de la empresa: la pestaña del servicio (o las de la zona + STD + Personal + Totales), con su formato
    var ids = [serv.Id], extra = null;
    if (d.alcance === 'zona') {
      ids = leer_('Servicios').filter(function (s) { return s.Activo !== 'NO' && String(s.Supervisor || '').toLowerCase() === String(serv.Supervisor || '').toLowerCase(); }).map(function (s) { return s.Id; });
      extra = function (ss) {
        var planilla = planillaPeriodo_(d.periodo);
        var codigos = leer_('Codigos').filter(function (c) { return c.Activo !== 'NO'; });
        var personal = personalSGI_(), mios = {}, todos = {};
        ids.forEach(function (id) { mios[id] = 1; });
        leer_('Servicios').forEach(function (s) { todos[s.Id] = 1; });
        hojaPersonas_(ss, 'Personal', resumenPersonas_(d.periodo, mios, planilla, personal, codigos), codigos, false);
        hojaPersonas_(ss, 'Totales', resumenPersonas_(d.periodo, todos, planilla, personal, codigos)
          .sort(function (a, b) { return a.Zona.localeCompare(b.Zona) || a.Nombre.localeCompare(b.Nombre); }), codigos, true);
      };
    }
    var sup = (usuariosSGI_().filter(function (x) { return x.Usuario.toLowerCase() === String(serv.Supervisor).toLowerCase(); })[0] || {});
    var nom = d.alcance === 'zona' ? 'Delben - ' + (sup.Nombre || serv.Supervisor) + ' - ' + nombrePeriodo_(d.periodo) : 'Delben - ' + serv.Servicio + ' - ' + nombrePeriodo_(d.periodo);
    var pl = libroPlanificacion_(d.periodo, { servicios: ids, conSTD: d.alcance === 'zona', extra: extra, nombre: nom });
    blob = pl.r; avisos = pl.avisos;
    que = d.alcance === 'zona' ? 'Diagrama de servicio de la zona ' + nombrePeriodo_(d.periodo) : 'Diagrama de servicio ' + serv.Servicio + ' ' + nombrePeriodo_(d.periodo);
    if (d.modo === 'mail') {
      var para1 = String(d.para || '').split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
      if (!para1.length) throw new Error('Escribí al menos un correo válido.');
      mandarInforme_(para1, u, que, blob, 'Te enviamos el ' + que.toLowerCase() + '.');
      return { enviado: true, para: para1 };
    }
    var o = salida_(blob); o.avisos = avisos; return o;
  }
  if (d.alcance === 'zona') {
    var sup = (usuariosSGI_().filter(function (x) { return x.Usuario.toLowerCase() === String(serv.Supervisor).toLowerCase(); })[0] || {});
    blob = libroZona_(serv.Supervisor, d.periodo, sup.Nombre || serv.Supervisor);
    que = 'Diagrama de servicio de la zona ' + nombrePeriodo_(d.periodo);
  } else {
    blob = libroServicio_(serv, d.periodo);
    que = 'Diagrama de servicio ' + serv.Servicio + ' ' + nombrePeriodo_(d.periodo);
  }
  if (d.modo === 'mail') {
    var para = String(d.para || '').split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
    if (!para.length) throw new Error('Escribí al menos un correo válido.');
    mandarInforme_(para, u, que, blob, 'Te enviamos el ' + que.toLowerCase() + '.');
    return { enviado: true, para: para };
  }
  return salida_(blob);
}


/* ============================================================
   INFORMES: STD, Consolidado, Plus por función, Facturadas vs. Contratadas y RRHH
   ============================================================ */

// Horas por servicio según su ciclo de facturación, para el mes en que termina el período.
function datosFacturacion_(periodo) {
  var mes = mesDePeriodo_(periodo);
  var servs = leer_('Servicios');
  var planilla = planillaMes_(mes);
  var nomSup = {};
  usuariosSGI_().forEach(function (x) { nomSup[x.Usuario.toLowerCase()] = x.Nombre; });
  var out = [];
  servs.forEach(function (s) {
    var c = conformacionServicio_(s, mes, planilla);
    if (s.Activo === 'NO' && !c.tot.rD && !c.tot.rN) return;
    var t = c.tot, contr = t.cD + t.cN, realiz = t.rD + t.rN, ev = t.aD + t.aN;
    out.push({ Cliente: s.Cliente || s.Servicio, Servicio: s.Servicio, Empresa: s.Empresa || '', Ciclo: s.Ciclo || '26-25',
      ContrD: t.cD, ContrN: t.cN, Contr: contr, RealD: t.rD, RealN: t.rN, Eventuales: ev, RealTot: realiz + ev,
      NoCubiertas: t.caidas, Extras: t.demas, Reten: t.ret, Instruccion: t.ins, RetInst: t.ret + t.ins,
      Supervisor: nomSup[String(s.Supervisor || '').toLowerCase()] || s.Supervisor || '' });
  });
  out.sort(function (a, b) { return a.Empresa.localeCompare(b.Empresa) || a.Cliente.localeCompare(b.Cliente); });
  return out;
}

var COLS_FACT_ = [
  ['Cliente', 'Cliente'], ['Empresa', 'Empresa'], ['ContrD', 'Contratadas diurnas'], ['ContrN', 'Contratadas nocturnas'], ['Contr', 'Total contratadas'],
  ['RealD', 'Realizadas diurnas'], ['RealN', 'Realizadas nocturnas'], ['Eventuales', 'Eventuales / adicional'], ['RealTot', 'Total con eventuales'],
  ['NoCubiertas', 'Horas no cubiertas'], ['Extras', 'Horas de más'], ['Reten', 'Horas retén'], ['Instruccion', 'Horas instrucción'],
  ['RetInst', 'Total ret. - inst.'], ['Supervisor', 'Supervisor']
];

function hojaFacturacion_(ss, periodo, datos) {
  var sh = ss.insertSheet('Contratadas vs. Realizadas');
  sh.getRange(1, 1).setValue('Horas contratadas vs. realizadas · ' + nombrePeriodo_(periodo)).setFontSize(14).setFontWeight('bold');
  var cab = COLS_FACT_.map(function (c) { return c[1]; });
  sh.getRange(3, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true).setHorizontalAlignment('center');
  var fila = 4, num = COLS_FACT_.slice(2, 14).map(function (c) { return c[0]; });
  var gen = {}; num.forEach(function (k) { gen[k] = 0; });
  var empresas = [];
  datos.forEach(function (d) { if (empresas.indexOf(d.Empresa) < 0) empresas.push(d.Empresa); });
  empresas.forEach(function (emp) {
    var l = datos.filter(function (d) { return d.Empresa === emp; });
    sh.getRange(fila, 1, 1, cab.length).merge().setValue(emp || 'Sin empresa').setBackground(XL.AMARILLO).setFontWeight('bold');
    fila++;
    var vals = l.map(function (d) { return COLS_FACT_.map(function (c) { return d[c[0]]; }); });
    sh.getRange(fila, 1, vals.length, cab.length).setValues(vals);
    var sub = COLS_FACT_.map(function (c, k) {
      if (k === 0) return 'Total ' + (emp || '');
      if (num.indexOf(c[0]) < 0) return '';
      var t = l.reduce(function (s, d) { return s + (Number(d[c[0]]) || 0); }, 0); gen[c[0]] += t; return t;
    });
    fila += vals.length;
    sh.getRange(fila, 1, 1, cab.length).setValues([sub]).setBackground(XL.VERDE).setFontWeight('bold');
    fila += 2;
  });
  var tot = COLS_FACT_.map(function (c, k) { return k === 0 ? 'TOTAL GENERAL' : (num.indexOf(c[0]) >= 0 ? gen[c[0]] : ''); });
  sh.getRange(fila, 1, 1, cab.length).setValues([tot]).setBackground(XL.VERDE2).setFontWeight('bold');
  sh.getRange(3, 1, fila - 2, cab.length).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID).setFontFamily('Calibri');
  sh.getRange(4, 3, fila - 3, 12).setHorizontalAlignment('center');
  sh.setColumnWidth(1, 240); sh.setColumnWidths(3, 12, 95); sh.setColumnWidth(15, 150);
  sh.setFrozenRows(3);
  return sh;
}

function datosPlus_(periodo) {
  try { asegurarPlusPeriodo_(periodo); } catch (e) { Logger.log('Plus ' + periodo + ': ' + e.message); }
  var nom = {};
  leer_('Servicios').forEach(function (s) { nom[s.Id] = s.Servicio; });
  var porLeg = {};
  personalSGI_().forEach(function (p) { porLeg[p.Legajo] = p; });
  // v1.22.6: el plus cargado día por día se junta en una fila por persona, función y servicio (sumando los días)
  var junt = {}, lista = [];
  leer_('Plus').filter(function (p) { return p.Periodo === periodo && (p.Nombre || p.Legajo); }).forEach(function (p) {
    var k = (String(p.Legajo || '').replace(/\.0$/, '') || normT_(p.Nombre)) + '|' + normT_(p.Nombre).split(' ')[0] + '|' + normT_(p.Funcion || 'Encargado') + '|' + p.ServicioId;
    var x = junt[k];
    if (!x) { x = junt[k] = { Periodo: p.Periodo, ServicioId: p.ServicioId, Legajo: p.Legajo, Nombre: p.Nombre, Funcion: p.Funcion, Dias: 0, obs: [], sinNum: true }; lista.push(x); }
    var d = Number(String(p.Dias || '').replace(',', '.'));
    if (!isNaN(d) && String(p.Dias || '') !== '') { x.Dias += d; x.sinNum = false; }
    if (p.Observaciones && x.obs.indexOf(p.Observaciones) < 0) x.obs.push(p.Observaciones);
  });
  lista.forEach(function (x) { x.Dias = x.sinNum ? '' : String(x.Dias); x.Observaciones = x.obs.join(' · '); });
  return lista.map(function (p) {
    return { Empresa: (porLeg[p.Legajo] || {}).Empresa || '', Legajo: p.Legajo, Nombre: p.Nombre, Servicio: nom[p.ServicioId] || p.ServicioId,
      Funcion: p.Funcion, Dias: Number(p.Dias) || '', Observaciones: p.Observaciones || '',
      Plata: (String(p.Observaciones || '').match(/Plus \$ ?([\d.,]+)/) || [])[1] ? Number((String(p.Observaciones).match(/Plus \$ ?([\d.,]+)/) || [])[1].replace(/\.(?=\d{3})/g, '').replace(',', '.')) || '' : '' };
  }).sort(function (a, b) { return a.Servicio.localeCompare(b.Servicio) || a.Nombre.localeCompare(b.Nombre); });
}

function hojaPlus_(ss, periodo, datos) {
  var sh = ss.insertSheet('Plus Encargado');
  sh.getRange(1, 1).setValue('Plus por función · ' + nombrePeriodo_(periodo)).setFontSize(14).setFontWeight('bold');
  var cab = ['Empresa', 'LP', 'Apellido y Nombre', 'Servicio', 'Función', 'Días de cobertura', 'Plus en $', 'Observaciones'];
  sh.getRange(3, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setHorizontalAlignment('center');
  var vals = datos.map(function (d) { return [d.Empresa, Number(d.Legajo) || d.Legajo, d.Nombre, d.Servicio, d.Funcion, d.Dias, '', d.Observaciones]; });
  vals.push(['', '', '', 'Total', '', datos.reduce(function (s, d) { return s + d.Dias; }, 0), '', '']);
  sh.getRange(4, 1, vals.length, cab.length).setValues(vals).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(3 + vals.length, 1, 1, cab.length).setBackground(XL.VERDE).setFontWeight('bold');
  sh.setColumnWidth(3, 240); sh.setColumnWidth(4, 170); sh.setColumnWidth(8, 220);
  return sh;
}

// v1.22.10: Excel simple de una vista rápida (ej.: Horas extras), con los mismos títulos y totales
function libroVistaGen_(tipo, titulo, periodo) {
  var r = vistaTabla_(tipo, periodo), nombre = 'Delben - ' + titulo + ' - ' + nombrePeriodo_(periodo);
  var ss = crearLibro_(nombre), sh = ss.getSheets()[0];
  sh.setName(titulo.slice(0, 30));
  sh.getRange(1, 1).setValue(titulo + ' · ' + nombrePeriodo_(periodo)).setFontSize(14).setFontWeight('bold');
  if (r.nota) sh.getRange(2, 1).setValue(r.nota).setFontColor('#1e7a45');
  var cab = r.cols.map(function (c) { return c.t; });
  sh.getRange(4, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);
  var vals = r.filas.map(function (f) { return r.cols.map(function (c) { var v = f[c.k]; return v === undefined || v === null ? '' : v; }); });
  vals.push(r.cols.map(function (c, k) { return k === 0 ? 'Totales' : (c.n ? r.total[c.k] : ''); }));
  if (vals.length) sh.getRange(5, 1, vals.length, cab.length).setValues(vals);
  r.cols.forEach(function (c, k) { if (c.bg) sh.getRange(4, k + 1, vals.length + 1, 1).setBackground(c.bg); if (c.fc) sh.getRange(5, k + 1, vals.length, 1).setFontColor(c.fc); });
  sh.getRange(4 + vals.length, 1, 1, cab.length).setFontWeight('bold').setBackground('#e2efda');
  sh.setFrozenRows(4); sh.setColumnWidth(2, 240);
  return exportarXlsx_(ss, nombre);
}
function libroInforme_(tipo, periodo) {
  if (tipo === 'extras') return libroVistaGen_('extras', 'Horas extras', periodo);
  if (tipo === 'facturacionNov') return libroFacturacionNov_(periodo);
  // Si está cargada la planilla modelo de la empresa, se usan sus pestañas tal cual (ver Plantilla.gs).
  var conModelo = libroInformePlantilla_(tipo, periodo);
  if (conModelo) return conModelo;
  if (tipo === 'stdsup') tipo = 'std';
  var nombres = { std: 'STD', consolidado: 'Consolidado', plus: 'Plus por función', facturacion: 'Horas contratadas vs. realizadas', rrhh: 'RRHH', licencias: 'Injustificados y Licencias', eventos: 'Eventos' };
  var nombre = 'Delben - ' + nombres[tipo] + ' - ' + nombrePeriodo_(periodo);
  var ss = crearLibro_(nombre);
  var servs = leer_('Servicios').filter(function (s) { return s.Activo !== 'NO'; });
  var planilla = planillaPeriodo_(periodo);
  if (tipo === 'std') hojaSTD_(ss, periodo, servs, planilla, personalSGI_(), { titulo: 'STD' });
  else if (tipo === 'consolidado') hojaSTD_(ss, periodo, servs, planilla, personalSGI_(), { titulo: 'Consolidado', subtotales: true });
  else if (tipo === 'plus') hojaPlus_(ss, periodo, datosPlus_(periodo));
  else if (tipo === 'facturacion') hojaFacturacion_(ss, periodo, datosFacturacion_(periodo));
  else if (tipo === 'licencias') hojaLicencias_(ss, periodo, datosLicencias_(periodo));
  else if (tipo === 'eventos') hojaSTD_(ss, periodo, leer_('Servicios'), planilla.filter(function (f) { return f.Seccion === 'EVENTO'; }), personalSGI_(), { titulo: 'Eventos' });
  else if (tipo === 'rrhh') {
    var personal = personalSGI_();
    hojaPlus_(ss, periodo, datosPlus_(periodo));
    hojaSTD_(ss, periodo, servs, planilla, personal, { titulo: 'STD' });
    hojaSTD_(ss, periodo, servs, planilla, personal, { titulo: periodoInfo_(periodo).n + ' Días', porApellido: true });
  } else throw new Error('Informe desconocido.');
  ss.deleteSheet(ss.getSheets()[0]);
  return exportarXlsx_(ss, nombre);
}

// Vista previa (en la app) y descarga en Excel de cada informe.
// Marca de los datos de un período: si no cambió, se reusa el informe ya armado.
function marcaPeriodo_(periodo) {
  var f = planillaPeriodo_(periodo), ult = '';
  f.forEach(function (x) { if (String(x.Actualizado) > ult) ult = String(x.Actualizado); });
  var pl = leer_('Plus').filter(function (x) { return x.Periodo === periodo; });
  pl.forEach(function (x) { if (String(x.Fecha) > ult) ult = String(x.Fecha); });
  var aj = ''; try { leer_('AjustesInforme').forEach(function (a) { if (a.Periodo === periodo) aj += a.Fecha + a.Fila + a.Col + a.Valor; }); } catch (e) { }
  return f.length + '|' + pl.length + '|' + ult + (aj ? '|' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, aj)).slice(0, 10) : '');
}
// Arma (o reusa) el informe de un período y devuelve dónde verlo.
function informeCacheado_(tipo, periodo, armar, marca) {
  var clave = 'INF6|' + tipo + '|' + periodo, props = PropertiesService.getScriptProperties();
  marca = marca || marcaPeriodo_(periodo);
  var ver = function () {
    var p = String(props.getProperty(clave) || '').split('#');
    if (p[0] && p[1] === marca) {
      try { if (esPlanillaGoogle_(p[0])) { var ss0 = SpreadsheetApp.openById(p[0]); return vistaInforme_(ss0.getId(), ss0.getName(), true); } } catch (e) { }
    }
    return null;
  };
  var ya = ver();
  if (ya) return ya;
  // Si dos personas lo piden a la vez, se arma una sola vez.
  return conTurno_('inf_' + tipo + '_' + periodo, 280, function () {
    ya = ver();
    if (ya) return ya;
    var viejo = String(props.getProperty(clave) || '').split('#')[0];
    var r = armar();
    props.setProperty(clave, r.id + '#' + marca);
    // El archivo anterior del mismo informe y período se reemplaza (no se juntan copias)
    if (viejo && viejo !== r.id) { try { DriveApp.getFileById(viejo).setTrashed(true); } catch (e) { } }
    var out = vistaInforme_(r.id, r.nombre, false); out.avisos = r.avisos || []; return out;
  });
}
/* v1.22.9: INFORMES EN SEGUNDO PLANO
 * Cada 15 minutos (disparador) se prepara el próximo informe del período en curso que cambió desde la última vez,
 * así al tocar "Descargar Excel" o "Ver archivo de la empresa" ya está armado y abre al instante.
 * También se dejan listas las vistas rápidas (Consolidado, STD, 30/31 días, Facturación). */
var INF_FONDO_ = ['planificacion', 'std', 'treinta', 'consolidado', 'rrhh', 'facturacionNov'];
function prepararInformesFondo() {
  var ini = Date.now(), props = PropertiesService.getScriptProperties();
  var per = periodoActualServidor_(), marca = marcaPeriodo_(per);
  // vistas rápidas (baratas)
  ['consolidado', 'std', 'treinta', 'facturacionNov'].forEach(function (t) {
    try { accionInforme_({ usuario: 'sistema', rol: 'ADMIN' }, { tipo: t, periodo: per, modo: 'vista' }); } catch (e) { Logger.log('Vista ' + t + ': ' + e.message); }
  });
  // archivos de la empresa: los que estén desactualizados, mientras haya tiempo (cada ejecución tiene ~6 minutos)
  for (var k = 0; k < INF_FONDO_.length && Date.now() - ini < 200000; k++) {
    var t = INF_FONDO_[k], p = String(props.getProperty('INF6|' + t + '|' + per) || '').split('#');
    if (p[1] === marca) continue;
    try {
      informeCacheado_(t, per, function () {
        if (t === 'planificacion') { var p1 = libroPlanificacion_(per); p1.r.avisos = p1.avisos; return p1.r; }
        return libroInforme_(t, per);
      }, marca);
    } catch (e) { Logger.log('Informe en segundo plano ' + t + ': ' + e.message); }
  }
}
function activarInformesFondo_() {
  var ya = ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === 'prepararInformesFondo'; });
  if (!ya) ScriptApp.newTrigger('prepararInformesFondo').timeBased().everyMinutes(15).create();
  return true;
}
// Para que quien abre el informe lo pueda ver dentro de la app, se le da permiso de lectura a ese archivo.
function compartirCon_(u, r) {
  try {
    var mail = String(u.email || '').trim(), id = (String(r.url).match(/\/d\/([^/]+)/) || [])[1];
    if (mail && id && mail.toLowerCase() !== String(Session.getEffectiveUser().getEmail()).toLowerCase()) DriveApp.getFileById(id).addViewer(mail);
  } catch (e) { /* lo ve igual quien ya tenga acceso */ }
  return r;
}
function vistaInforme_(id, nombre, reusado) {
  return { nombre: nombre, url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit', xlsx: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
    vista: 'https://docs.google.com/spreadsheets/d/' + id + '/preview', reusado: reusado };
}

function accionInforme_(u, d) {
  exigir_(u, 'informes', false);
  DESTINO_ = d.tipo || '';
  var periodo = d.periodo;
  // Vista rápida en la app (Consolidado, STD y 30/31 días): se arma con los datos, sin abrir archivos.
  if (d.modo === 'vista') {
    // v1.21: la vista queda guardada 10 minutos mientras no cambie la planilla (cambiar de pestaña o volver es al instante)
    var verV = ['Planilla', 'Servicios', 'Codigos', 'Feriados', 'Plus', 'AjustesInforme', 'ContratadoDia'].map(function (h) { return versionHoja_(h) || '0'; }).join('.');
    var kV = 'VIS2|' + d.tipo + '|' + periodo + '|' + verV;
    var yaV = null; try { yaV = cacheJSONGet_(kV); } catch (e) { }
    if (yaV) return yaV;
    var outV = /^(consolidado|std|treinta)$/.test(d.tipo) ? vistaSTD_(periodo, d.tipo) : vistaTabla_(d.tipo, periodo);
    outV.ajustes = ajustesInforme_(d.tipo, periodo);
    try { cacheJSONPut_(kV, outV, 600); } catch (e) { }
    return outV;
  }
  // Descargar en Excel: el archivo de la empresa con los datos, solo valores (sin fórmulas, vínculos ni accesos directos).
  if (d.modo === 'descargar') {
    var rr = informeCacheado_(d.tipo, periodo, function () {
      if (d.tipo === 'planificacion') { var p1 = libroPlanificacion_(periodo); p1.r.avisos = p1.avisos; return p1.r; }
      return libroInforme_(d.tipo, periodo);
    });
    var idd = (String(rr.url).match(/\/d\/([^/]+)/) || [])[1];
    return descargaValores_(idd, rr.nombre.replace(/\.xlsx$/i, ''));
  }
  if (d.modo === 'abrir') {
    var ra = compartirCon_(u, informeCacheado_(d.tipo, periodo, function () {
      if (d.tipo === 'planificacion') { var pl0 = libroPlanificacion_(periodo); pl0.r.avisos = pl0.avisos; return pl0.r; }
      return libroInforme_(d.tipo, periodo);
    }));
    // Si el período se cargó con un Excel histórico, también se puede abrir el original tal cual.
    try { if (typeof originalesHist_ === 'function') { ra.originales = originalesHist_(periodo); if (ra.originales.length) compartirCon_(u, ra.originales[0]); } } catch (e) { }
    return ra;
  }
  if (d.tipo === 'planificacion') {
    var pl = libroPlanificacion_(periodo);
    if (d.para) {
      var para0 = String(d.para).split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
      if (!para0.length) throw new Error('Escribí al menos un correo válido.');
      mandarInforme_(para0, u, 'Planificación ' + nombrePeriodo_(periodo), pl.r, 'Te enviamos la Planificación del período.');
      return { enviado: true, para: para0, avisos: pl.avisos };
    }
    var out = salida_(pl.r); out.avisos = pl.avisos; return out;
  }
  if (d.modo === 'excel') {
    var blob = libroInforme_(d.tipo, periodo);
    if (d.para) {
      var para = String(d.para).split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
      if (!para.length) throw new Error('Escribí al menos un correo válido.');
      mandarInforme_(para, u, blob.getName().replace(/\.xlsx$/, '').replace(/^Delben - /, ''), blob, 'Te enviamos el informe.');
      return { enviado: true, para: para };
    }
    return salida_(blob);
  }
  if (d.tipo === 'facturacion') return { filas: datosFacturacion_(periodo), columnas: COLS_FACT_ };
  if (d.tipo === 'plus') return { filas: datosPlus_(periodo) };
  if (d.tipo === 'licencias') return { filas: datosLicencias_(periodo) };
  var conModelo = !!plantillaId_();
  // STD / Consolidado / RRHH: resumen por persona y servicio
  var nom = {};
  leer_('Servicios').forEach(function (s) { nom[s.Id] = s.Cliente || s.Servicio; });
  var cat = {};
  personalSGI_().forEach(function (p) { cat[p.Legajo] = p.Categoria; });
  var filas = planillaPeriodo_(periodo).filter(function (f) { return f.Nombre || f.Legajo; }).map(function (f) {
    var D = 0, N = 0, est = {};
    for (var i = 0; i < 31; i++) {
      var c = leerCelda_(f[DIAS_COL[i]]);
      if (c.tipo === 'horas') { D += c.d; N += c.n; } else if (c.tipo === 'codigo') est[c.cod] = (est[c.cod] || 0) + 1;
    }
    return { Seccion: f.Seccion, Empresa: f.Empresa, Legajo: f.Legajo, Nombre: f.Nombre, Cat: cat[f.Legajo] || '', Puesto: f.Puesto || (f.Seccion === 'RETEN' ? 'Retén' : f.Seccion === 'EVENTO' ? 'Eventual' : ''),
      Cliente: nom[f.ServicioId] || f.ServicioId, D: D, N: N, Estados: Object.keys(est).map(function (k) { return k + ' ' + est[k]; }).join(', ') };
  });
  if (d.tipo === 'eventos') filas = filas.filter(function (f) { return f.Puesto === 'Eventual' || f.Seccion === 'EVENTO'; });
  if (d.tipo === 'rrhh') filas.sort(function (a, b) { return a.Nombre.localeCompare(b.Nombre); });
  else filas.sort(function (a, b) { return a.Cliente.localeCompare(b.Cliente) || a.Nombre.localeCompare(b.Nombre); });
  return { filas: filas, dias: periodoInfo_(periodo).n, conModelo: conModelo };
}


/* ============================================================
   CONFORMACIONES HORARIAS (formato de las conformaciones de Delben)
   Ciclos: '26-25' (del 26 al 25), '01-31' (mes calendario) y '01-31-22' (mes calendario, se entrega el 22).
   ============================================================ */
var MESES_UP_ = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var DIAS_LARGO_ = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Mes (AAAA-MM) en que termina un período: "2026-08" (26/08 al 25/09) -> "2026-09".
function mesDePeriodo_(periodo) {
  var h = periodoInfo_(periodo).hasta;
  return h.getUTCFullYear() + '-' + ('0' + (h.getUTCMonth() + 1)).slice(-2);
}
function fechasCiclo_(ciclo, mes) {
  var y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  var desde = ciclo === '26-25' ? Date.UTC(y, m - 2, 26) : Date.UTC(y, m - 1, 1);
  var hasta = ciclo === '26-25' ? Date.UTC(y, m - 1, 25) : Date.UTC(y, m, 0);
  var out = [];
  for (var t = desde; t <= hasta; t += 864e5) out.push(new Date(t));
  return out;
}
function periodoDeFecha_(d) {
  var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  if (d.getUTCDate() < 26) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + ('0' + m).slice(-2);
}

// Día por día: contratado, adicionales (eventuales) y realizadas (cobertura), más retén e instrucción.
// Ajustes a mano de las conformaciones de un mes: { servicioId: { dias: { 'AAAA-MM-DD': {cD,cN,rD,rN} }, custodia, bunker } }
function ajustesConf_(mes) {
  var out = {};
  leer_('ConfAjustes').forEach(function (f) { if (f.Mes === mes) { try { out[f.ServicioId] = JSON.parse(f.Datos || '{}'); } catch (e) { } } });
  return out;
}
function conformacionServicio_(serv, mes, planilla, ajuste) {
  if (ajuste === undefined) ajuste = ajustesConf_(mes)[serv.Id] || null;
  var fechas = fechasCiclo_(serv.Ciclo || '26-25', mes);
  var porPer = {};
  var tot = { cD: 0, cN: 0, aD: 0, aN: 0, rD: 0, rN: 0, ret: 0, ins: 0, caidas: 0, demas: 0 };
  var dias = fechas.map(function (d) {
    var p = periodoDeFecha_(d);
    var i = Math.round((d.getTime() - periodoInfo_(p).desde.getTime()) / 864e5);
    if (!porPer[p]) porPer[p] = planilla.filter(function (f) { return f.Periodo === p && f.ServicioId === serv.Id; });
    var c = contratadoDia_(serv, d), x = { fecha: d, cD: c.d, cN: c.n, aD: 0, aN: 0, rD: 0, rN: 0 };
    porPer[p].forEach(function (f) {
      if (noFactura_(f.Nombre)) return;
      var v = leerCelda_(f[DIAS_COL[i]]);
      if (v.tipo !== 'horas') return;
      if (f.Seccion === 'EVENTO') { x.aD += v.d; x.aN += v.n; }
      else if (f.Seccion === 'RETEN') { if (/INSTRUC/i.test(f.Puesto || '')) tot.ins += v.h; else tot.ret += v.h; }
      else { x.rD += v.d; x.rN += v.n; }
    });
    if (sinDiferencia_(serv)) { x.cD = x.rD; x.cN = x.rN; }
    // Lo que administración cambió a mano en la conformación (custodias, horas que no se cobran, etc.)
    var aj = ajuste && ajuste.dias ? ajuste.dias[iso_(d)] : null;
    if (aj) {
      if (aj.cD !== undefined && aj.cD !== '') x.cD = Number(aj.cD) || 0;
      if (aj.cN !== undefined && aj.cN !== '') x.cN = Number(aj.cN) || 0;
      if (aj.rD !== undefined && aj.rD !== '') { x.rD = Number(aj.rD) || 0; x.aD = 0; }
      if (aj.rN !== undefined && aj.rN !== '') { x.rN = Number(aj.rN) || 0; x.aN = 0; }
    }
    var dif = (x.rD + x.rN) - (x.cD + x.cN);
    if (dif < 0) tot.caidas -= dif; else tot.demas += dif;
    ['cD', 'cN', 'aD', 'aN', 'rD', 'rN'].forEach(function (k) { tot[k] += x[k]; });
    return x;
  });
  return { dias: dias, tot: tot };
}

function hojaConformacion_(ss, serv, mes, conf) {
  var sh = ss.insertSheet(nombreHoja_(serv.Servicio));
  var y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  sh.setColumnWidth(1, 82); sh.setColumnWidth(2, 90); sh.setColumnWidths(3, 9, 52);
  sh.getRange(1, 1, 60, 11).setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, 2).merge().setValue(serv.Empresa || '').setBackground('#ff0000').setFontColor('#ffffff').setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2, 1, 2, 11).merge().setValue('Conformación de Horario').setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(4, 8).setValue('Mes:').setFontWeight('bold');
  sh.getRange(4, 9, 1, 2).merge().setValue(MESES_UP_[m - 1]).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(4, 11).setValue(y).setFontWeight('bold');
  sh.getRange(6, 1, 1, 11).merge().setValue(serv.Cliente || serv.Servicio).setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  sh.getRange(7, 1, 1, 5).merge().setValue('CONTRATADO');
  sh.getRange(7, 6, 1, 3).merge().setValue('ADICIONALES');
  sh.getRange(7, 9, 1, 3).merge().setValue('REALIZADAS');
  sh.getRange(8, 1, 1, 11).setValues([['DIA', '', 'TM', 'TN', 'Total', 'TM', 'TN', 'Total', 'TM', 'TN', 'Total']]);
  sh.getRange(7, 1, 2, 11).setHorizontalAlignment('center').setFontFamily('Calibri');
  var vals = [], bgs = [], ws = [];
  conf.dias.forEach(function (x) {
    var w = (x.fecha.getUTCDay() + 6) % 7;
    vals.push([Utilities.formatDate(x.fecha, 'UTC', 'dd/MM/yyyy'), DIAS_LARGO_[w], x.cD, x.cN, x.cD + x.cN, x.aD, x.aN, x.aD + x.aN, x.rD, x.rN, x.rD + x.rN]);
    var b = ['#ffffff', w === 5 ? '#c5e0b4' : w === 6 ? '#ffc000' : '#ffffff'].concat(['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']);
    if (esFeriado_(x.fecha)) b[1] = '#ff8c00';
    bgs.push(b);
    ws.push(['normal', w >= 5 ? 'bold' : 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal']);
  });
  var t = conf.tot;
  vals.push(['Totales', '', t.cD, t.cN, t.cD + t.cN, t.aD, t.aN, t.aD + t.aN, t.rD, t.rN, t.rD + t.rN]);
  bgs.push(vals[0].map(function () { return '#ffffff'; }));
  ws.push(vals[0].map(function () { return 'bold'; }));
  var r = sh.getRange(9, 1, vals.length, 11);
  r.setValues(vals).setBackgrounds(bgs).setFontWeights(ws).setHorizontalAlignment('center');
  sh.getRange(9, 2, vals.length, 1).setHorizontalAlignment('left');
  sh.getRange(6, 1, vals.length + 3, 11).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  var f = 9 + vals.length;
  var horas = function (h) { return Math.round(h) + ':00:00'; };
  sh.getRange(f, 1, 1, 9).merge().setValue('Cantidad de Horas Diurnas a Facturar  Vigilador');
  sh.getRange(f, 10, 1, 2).merge().setValue(horas(t.rD + t.aD));
  sh.getRange(f + 1, 1, 1, 9).merge().setValue('Cantidad de Horas Nocturnas a Facturar Vigilador');
  sh.getRange(f + 1, 10, 1, 2).merge().setValue(horas(t.rN + t.aN));
  sh.getRange(f, 1, 2, 11).setBackground('#ff0000').setFontColor('#ffffff').setFontWeight('bold').setFontSize(12).setHorizontalAlignment('right')
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(f, 10, 2, 2).setHorizontalAlignment('center');
  sh.getRange(f + 9, 8, 1, 4).merge().setValue('Firma y Aclaración').setHorizontalAlignment('center')
    .setBorder(true, null, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.DOTTED);
  sh.setHiddenGridlines(true);
  return sh;
}

function hojaTotalesConformacion_(ss, mes, filas) {
  var sh = ss.insertSheet('Totales');
  var cab = ['Cliente', 'Empresa', 'Contratadas diurnas', 'Contratadas nocturnas', 'Total de horas', 'Realizadas diurnas', 'Realizadas nocturnas',
    'Eventuales / adicional', 'Total de horas a facturar', 'Total de horas caídas'];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true).setHorizontalAlignment('center');
  var vals = filas.map(function (x) {
    var t = x.c.tot;
    return [x.s.Cliente || x.s.Servicio, x.s.Empresa, t.cD, t.cN, t.cD + t.cN, t.rD, t.rN, t.aD + t.aN, t.rD + t.rN + t.aD + t.aN, t.caidas];
  });
  var tot = ['TOTAL', ''];
  for (var c = 2; c < cab.length; c++) tot.push(vals.reduce(function (s, r) { return s + (Number(r[c]) || 0); }, 0));
  vals.push(tot);
  sh.getRange(2, 1, vals.length, cab.length).setValues(vals).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1 + vals.length, 1, 1, cab.length).setBackground(XL.VERDE2).setFontWeight('bold');
  sh.getRange(2, 3, vals.length, cab.length - 2).setHorizontalAlignment('center');
  sh.setColumnWidth(1, 260); sh.setColumnWidths(3, 8, 100);
  sh.setFrozenRows(1);
  return sh;
}

// d: { ciclo, mes, servicioId (opcional: una sola) }
function libroConformacion_(ciclo, mes, servicioId, ids, titulo) {
  var conModelo = libroConformacionModelo_(ciclo, mes, servicioId, ids, titulo);
  if (conModelo) return conModelo;
  var planilla = planillaMes_(mes);
  var servs = leer_('Servicios').filter(function (s) {
    if (servicioId) return s.Id === servicioId;
    if (ids && ids.length) return ids.indexOf(s.Id) >= 0;
    return s.Activo !== 'NO' && (s.Ciclo || '26-25') === ciclo;
  });
  if (!servs.length) throw new Error('No hay servicios con ese ciclo.');
  var etiqueta = { '26-25': 'del 26 al 25', '01-31': 'del 01 al 31', '01-31-22': 'del 22 de cada mes' }[ciclo] || ciclo;
  var y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  var nombre = titulo || ('Conformacion Horaria ' + (servicioId ? servs[0].Servicio : 'Servicios ' + etiqueta) + ' - ' + MESES_UP_[m - 1] + ' ' + y);
  var ss = crearLibro_(nombre);
  var filas = servs.map(function (s) { return { s: s, c: conformacionServicio_(s, mes, planilla) }; });
  if (!servicioId) hojaTotalesConformacion_(ss, mes, filas);
  filas.forEach(function (x) { hojaConformacion_(ss, x.s, mes, x.c); });
  ss.deleteSheet(ss.getSheets()[0]);
  return exportarXlsx_(ss, nombre);
}

function accionConformacion_(u, d) {
  exigir_(u, 'conformacion', false);
  DESTINO_ = 'conformacion';
  // Horas a facturar guardadas del mes
  if (d.modo === 'facturar') return facturarMes_(d.mes);
  if (d.modo === 'ajustes') return { fact: facturarMes_(d.mes), aj: ajustesConf_(d.mes) };
  if (d.modo === 'guardarAjustes') {
    exigir_(u, 'conformacion', true);
    var resto = leer_('ConfAjustes').filter(function (f) { return !(f.Mes === d.mes && f.ServicioId === d.servicioId); });
    var datosAj = { dias: d.dias || {}, custodia: d.custodia || '', bunker: d.bunker || '' };
    if (Object.keys(datosAj.dias).length || datosAj.custodia || datosAj.bunker) resto.push({ Mes: d.mes, ServicioId: d.servicioId, Datos: JSON.stringify(datosAj), Usuario: u.usuario, Fecha: ahora_() });
    reescribir_('ConfAjustes', resto);
    var listaF = leer_('Facturar').filter(function (f) { return !(f.Mes === d.mes && f.ServicioId === d.servicioId); });
    var hd0 = String(d.horasD === undefined || d.horasD === null ? '' : d.horasD).replace(',', '.').trim();
    var hn0 = String(d.horasN === undefined || d.horasN === null ? '' : d.horasN).replace(',', '.').trim();
    if ((hd0 && isNaN(Number(hd0))) || (hn0 && isNaN(Number(hn0)))) throw new Error('Las horas a facturar tienen que ser números.');
    if (hd0 || hn0) listaF.push({ Mes: d.mes, ServicioId: d.servicioId, HorasD: hd0, HorasN: hn0, Usuario: u.usuario, Fecha: ahora_() });
    reescribir_('Facturar', listaF);
    return { fact: facturarMes_(d.mes), aj: ajustesConf_(d.mes) };
  }
  if (d.modo === 'guardarFacturar') {
    exigir_(u, 'conformacion', true);
    var lista = leer_('Facturar').filter(function (f) { return !(f.Mes === d.mes && f.ServicioId === d.servicioId); });
    var hd = String(d.horasD === undefined || d.horasD === null ? '' : d.horasD).replace(',', '.').trim();
    var hn = String(d.horasN === undefined || d.horasN === null ? '' : d.horasN).replace(',', '.').trim();
    if ((hd && isNaN(Number(hd))) || (hn && isNaN(Number(hn)))) throw new Error('Las horas a facturar tienen que ser números.');
    if (hd || hn) lista.push({ Mes: d.mes, ServicioId: d.servicioId, HorasD: hd, HorasN: hn, Usuario: u.usuario, Fecha: ahora_() });
    reescribir_('Facturar', lista);
    return facturarMes_(d.mes);
  }
  // Bajar las elegidas: un Excel por ciclo, con el título que corresponde, sus pestañas, datos y colores.
  if (d.modo === 'descargar') {
    var ids = d.ids || [], porCiclo = {};
    leer_('Servicios').forEach(function (s) { if (ids.indexOf(s.Id) >= 0) (porCiclo[s.Ciclo || '26-25'] = porCiclo[s.Ciclo || '26-25'] || []).push(s.Id); });
    var orden = ['01-31-22', '26-25', '01-31'], y = Number(d.mes.slice(0, 4)), m = Number(d.mes.slice(5, 7)), archivos = [];
    orden.concat(Object.keys(porCiclo).filter(function (c) { return orden.indexOf(c) < 0; })).forEach(function (c) {
      if (!porCiclo[c]) return;
      var titulo = (CONF_TITULO_[c] || 'Conformación Horaria') + ' - ' + MESES_UP_[m - 1] + ' ' + y;
      var r = libroConformacion_(c, d.mes, '', porCiclo[c], titulo);
      // Solo valores: sin fórmulas, vínculos ni accesos directos
      var dv = descargaValores_(r.id, titulo);
      archivos.push({ nombre: dv.nombre, base64: dv.base64, url: r.url, servicios: porCiclo[c].length });
    });
    if (!archivos.length) throw new Error('Elegí al menos una conformación.');
    return { archivos: archivos };
  }
  if (d.modo === 'abrir') {
    var clave = 'conf-' + (d.servicioId || d.ciclo || '26-25');
    return compartirCon_(u, informeCacheado_(clave, d.mes, function () { return libroConformacion_(d.ciclo || '26-25', d.mes, d.servicioId || ''); },
      marcaPeriodo_(periodoAnterior_(d.mes)) + '/' + marcaPeriodo_(d.mes) + '/' + leer_('Servicios').length + '/' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify([facturarMes_(d.mes), ajustesConf_(d.mes)])))));
  }
  var blob = libroConformacion_(d.ciclo || '26-25', d.mes, d.servicioId || '');
  if (d.para) {
    var para = String(d.para).split(/[,; ]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
    if (!para.length) throw new Error('Escribí al menos un correo válido.');
    var que = blob.getName().replace(/\.xlsx$/, '');
    mandarInforme_(para, u, que, blob, 'Te enviamos la conformación horaria.');
    return { enviado: true, para: para };
  }
  return salida_(blob);
}

/* ============================================================
   INJUSTIFICADOS Y LICENCIAS
   ============================================================ */
var CODIGOS_LICENCIA_ = ['INJ', 'LSG', 'ENF', 'ART', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'DV', 'CAS', 'VAC', 'BAJA'];
function datosLicencias_(periodo) {
  var nom = {};
  leer_('Servicios').forEach(function (s) { nom[s.Id] = s.Servicio; });
  var n = periodoInfo_(periodo).n, out = [];
  planillaPeriodo_(periodo).forEach(function (f) {
    if (!(f.Nombre || f.Legajo)) return;
    var porCod = {};
    for (var i = 0; i < n; i++) {
      var c = leerCelda_(f[DIAS_COL[i]]);
      if (c.tipo === 'codigo' && CODIGOS_LICENCIA_.indexOf(c.cod) >= 0) {
        if (!porCod[c.cod]) porCod[c.cod] = [];
        porCod[c.cod].push(ddmm_(fechaDia_(periodo, i)));
      }
    }
    Object.keys(porCod).forEach(function (k) {
      out.push({ Empresa: f.Empresa, Legajo: f.Legajo, Nombre: f.Nombre, Servicio: nom[f.ServicioId] || f.ServicioId, Codigo: k, Dias: porCod[k].length, Fechas: porCod[k].join(', ') });
    });
  });
  out.sort(function (a, b) { return a.Codigo.localeCompare(b.Codigo) || a.Nombre.localeCompare(b.Nombre); });
  return out;
}
function hojaLicencias_(ss, periodo, datos) {
  var sh = ss.insertSheet('Injustificados y Licencias');
  sh.getRange(1, 1).setValue('Injustificados y licencias · ' + nombrePeriodo_(periodo)).setFontSize(14).setFontWeight('bold');
  var cab = ['Código', 'Empresa', 'LP', 'Apellido y Nombre', 'Servicio', 'Días', 'Fechas'];
  sh.getRange(3, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
  if (datos.length) {
    var vals = datos.map(function (d) { return [d.Codigo, d.Empresa, Number(d.Legajo) || d.Legajo, d.Nombre, d.Servicio, d.Dias, d.Fechas]; });
    sh.getRange(4, 1, vals.length, cab.length).setValues(vals).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(4, 1, vals.length, 1).setBackgrounds(datos.map(function (d) { var c = XL_CODIGOS[d.Codigo]; return [c ? c[0] : '#ffffff']; }))
      .setFontColors(datos.map(function (d) { var c = XL_CODIGOS[d.Codigo]; return [c ? c[1] : '#000000']; })).setFontWeight('bold');
  }
  sh.setColumnWidth(4, 240); sh.setColumnWidth(5, 170); sh.setColumnWidth(7, 380);
  return sh;
}


/**
 * FACTURACIÓN: la pestaña "Facturacion" del archivo de Planificación del período (con todos sus totales),
 * hasta la columna Indumentaria, solo con valores. Se guarda en la carpeta Facturacion.
 */
function libroFacturacionNov_(periodo) {
  DESTINO_ = 'planificacion';   // la Planificación completa va a su carpeta (Proyeccion)
  var pl = informeCacheado_('planificacion', periodo, function () { var p0 = libroPlanificacion_(periodo); p0.r.avisos = p0.avisos; return p0.r; });
  var id = (String(pl.url).match(/\/d\/([^/]+)/) || [])[1];
  if (!id) throw new Error('No se pudo armar la Planificación del período.');
  DESTINO_ = 'facturacionNov';
  var nombre = 'Facturación - ' + nombrePeriodo_(periodo);
  var f = DriveApp.getFileById(id).makeCopy(nombre, carpetaSalida_());
  var ss = SpreadsheetApp.openById(f.getId());
  try { ss.setSpreadsheetTimeZone(APP.TZ); } catch (e) { }
  var sh = ss.getSheetByName('Facturacion');
  if (!sh) throw new Error('La Planificación no tiene la pestaña Facturacion.');
  SpreadsheetApp.flush();
  var rg = sh.getDataRange();
  rg.copyTo(rg, { contentsOnly: true });
  soloPestanas_(ss, ['Facturacion']);
  // Columnas: hasta "Indumentaria"
  var W = sh.getMaxColumns(), cab = sh.getRange(1, 1, 5, W).getDisplayValues(), corte = -1;
  for (var r = 0; r < 5 && corte < 0; r++) for (var c = 0; c < W; c++) if (normT_(cab[r][c]) === 'INDUMENTARIA') { corte = c + 1; break; }
  if (corte > 0 && W > corte) sh.deleteColumns(corte + 1, W - corte);
  // Errores que trae el modelo (#NAME?, #REF!, #N/A) quedan en blanco
  var v = sh.getDataRange().getDisplayValues(), malos = [];
  v.forEach(function (fila, i) { fila.forEach(function (x, j) { if (/^#(REF|N\/A|NAME|VALUE|DIV)/.test(x)) malos.push(sh.getRange(i + 1, j + 1).getA1Notation()); }); });
  for (var k = 0; k < malos.length; k += 300) sh.getRangeList(malos.slice(k, k + 300)).clearContent();
  // Filas y columnas marcadas (grilla completa) en todos los datos, hasta Indumentaria
  try {
    var colA = sh.getRange(1, 1, sh.getLastRow(), 1).getDisplayValues(), ini = -1, fin = -1;
    for (var r2 = 0; r2 < colA.length; r2++) { if (normT_(colA[r2][0]) === 'CLIENTE' && ini < 0) ini = r2 + 1; if (ini > 0 && r2 + 1 > ini && String(colA[r2][0]).trim()) fin = r2 + 1; }
    if (ini > 0 && fin > ini) sh.getRange(ini, 1, fin - ini + 1, corte > 0 ? corte : sh.getLastColumn()).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  } catch (e) { Logger.log('Bordes Facturación: ' + e.message); }
  compactarEncabezado_(sh);
  return exportarXlsx_(ss, nombre);
}
