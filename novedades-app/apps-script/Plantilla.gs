/**
 * ============================================================
 * INFORMES CON LAS PLANILLAS DE LA EMPRESA
 * ============================================================
 * Los informes se arman COPIANDO las pestañas originales de la planilla
 * "Planificación" de Delben (STD, Consolidado, 30 Dias, Plus Encargado,
 * Facturacion, Injustificados y Licencias, Enevtos). Así quedan con el mismo
 * formato, colores, celdas combinadas, anchos y formatos condicionales.
 * Solo se reemplazan los datos.
 *
 * Para usarlo:
 *   1. Subir "Planificacion Agosto - Septiembre 2026.xlsm" a Drive y abrirlo
 *      con Archivo > Guardar como Hojas de cálculo de Google.
 *   2. Copiar el ID de esa planilla (lo que está entre /d/ y /edit).
 *   3. Pegarlo en la app: Datos > Planilla modelo de la empresa.
 * ============================================================
 */

var HS_BASE_PERIODO = 208;   // Hs. Normales del período (columna DC del STD)
var COD_ESTADOS_ = ['F', 'YNG', 'INJ', 'LSG', 'ENF', 'ART', 'VAC', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'CAS', 'BAJA']; // CE..CR del STD
// v1.22.10: Días de ausentismo = SUMA(CG:CS) del Consolidado: YNG, INJ, LSG, ENF, ART, VAC, SUS, NAC, MAT, FALL, RES, CAS y BAJA (el franco y el DV no)
// v1.22.12: igual que la columna "Dias de Ausentismo" del Consolidado = SUMA(CH:CS): INJ a BAJA, SIN YNG (CG) ni FCO ni DV.
// Verificado contra los Consolidados de Agosto-Septiembre 2026 (31 días), Febrero-Marzo 2026 (28) y Abril-Mayo 2026.
var COD_AUSENTISMO_ = ['INJ', 'LSG', 'ENF', 'ART', 'VAC', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'CAS', 'BAJA'];
// Horas extras como en la planilla de la empresa (columna CB del Consolidado):
//   Hs. de ausentismo (DC) = días de ausentismo × 208 / días del período (28, 29, 30 o 31)
//   Hs. normales (DD)      = 208 − Hs. de ausentismo
//   Hs. trab. vs nor. (DE) = horas de cobertura (A+B, sin instrucción ni retén) − Hs. normales
//   Hs. extras (CB)        = DE, solo si está entre 0 y 208 (si no, 0)
//   Diferencias (CD)       = (A+B) − 208, solo si está entre −208 y 0 (si no, 0)
function horasExtras_(tot, aus, n) {
  var hsAus = n ? aus * HS_BASE_PERIODO / n : 0, normales = HS_BASE_PERIODO - hsAus, tvn = tot - normales;
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var dif = tot - HS_BASE_PERIODO;
  return { hsAus: r2(hsAus), normales: r2(normales), tvn: r2(tvn), extras: tvn > 0 && tvn < HS_BASE_PERIODO ? r2(tvn) : 0, dif: dif > -HS_BASE_PERIODO && dif < 0 ? r2(dif) : 0 };
}
var DIAS_NOMBRE_ = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Planillas modelo de la empresa (en el Drive de Delben). Se pueden cambiar en Datos.
//  PLANTILLA_ID       -> Planificación (STD, Consolidado, Injustificados y Licencias, Enevtos)
//  PLANTILLA_RRHH_ID  -> Novedades del Personal (lo que va a RR.HH.: STD, 31 Dias, Plus Encargado)
//  PLANTILLA_FACT_ID  -> Horas Contratadas Vs. Realizadas
var MODELOS_POR_DEFECTO = {
  PLANTILLA_ID: '1v3AJzicwpDQ_FBhqvFcUXf4ITZVnG75z',       // Planificacion Agosto - Septiembre 2026.xlsm
  PLANTILLA_RRHH_ID: '10ND-vp52RNzpqtruxKmHZ1un1gULtMBs',  // Novedades del Personal Agosto - Septiembre 2026.xlsx
  PLANTILLA_FACT_ID: '1mflPyATPp4sMnZh2naEvICZbEpsIU3yK'   // Horas Contratadas Vs. Realizadas Septiembre 26.xlsx
};

// ¿El archivo es una planilla de Google (y no un Excel guardado en Drive)?
function esPlanillaGoogle_(id) {
  try { return DriveApp.getFileById(id).getMimeType() === MimeType.GOOGLE_SHEETS; } catch (e) { return false; }
}

function plantillaId_(clave) {
  clave = clave || 'PLANTILLA_ID';
  return String(config_()[clave] || MODELOS_POR_DEFECTO[clave] || '').trim();
}

// Abre la planilla modelo. Si es un Excel (.xlsx / .xlsm) se convierte una vez a planilla de Google y se recuerda.
// Los modelos de la empresa son Excel: se convierten UNA vez a planilla de Google y se recuerda la conversión
// (en las propiedades del proyecto, que no se pisan entre dos usuarios a la vez). Si el modelo cambia, se vuelve a convertir.
function modelo_(clave) {
  var id = plantillaId_(clave);
  if (!id) return null;
  if (esPlanillaGoogle_(id)) return SpreadsheetApp.openById(id);
  var props = PropertiesService.getScriptProperties(), k = 'MOD_' + clave;
  var cambio = '';
  try { cambio = String(DriveApp.getFileById(id).getLastUpdated().getTime()); } catch (e) { }
  var abrir = function () {
    var v = String(props.getProperty(k) || '').split('|');
    if (v[0] === id && v[1] === cambio && v[2]) { try { return SpreadsheetApp.openById(v[2]); } catch (e) { } }
    return null;
  };
  var ya = abrir();
  if (ya) return ya;
  return conTurno_('conv_' + clave, 150, function () {
    ya = abrir();                 // otro usuario lo pudo haber convertido mientras se esperaba
    if (ya) return ya;
    var resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ mimeType: 'application/vnd.google-apps.spreadsheet', name: 'Modelo Novedades - ' + clave })
    });
    if (resp.getResponseCode() !== 200) throw new Error('No se pudo abrir la planilla modelo (' + clave + '). Revisá el ID en Datos.');
    var nuevo = JSON.parse(resp.getContentText()).id;
    // La conversión vieja se manda a la papelera (no se juntan copias)
    var v0 = String(props.getProperty(k) || '').split('|');
    if (v0[2] && v0[2] !== nuevo) { try { DriveApp.getFileById(v0[2]).setTrashed(true); } catch (e) { } }
    props.setProperty(k, id + '|' + cambio + '|' + nuevo);
    try { var f = DriveApp.getFileById(nuevo); carpetaRaiz_().addFile(f); DriveApp.getRootFolder().removeFile(f); } catch (e) { }
    return SpreadsheetApp.openById(nuevo);
  });
}

// "Turno": si otra ejecución ya está haciendo lo mismo (convertir un modelo, armar un informe), se espera a que termine
// en lugar de hacerlo dos veces. No bloquea al resto de la app (guardar planillas sigue andando).
function conTurno_(nombre, segundos, fn) {
  var c = CacheService.getScriptCache(), k = 'turno_' + nombre, fin = Date.now() + segundos * 1000, mio = String(Math.random());
  while (c.get(k) && Date.now() < fin) Utilities.sleep(1500);
  c.put(k, mio, Math.min(21600, segundos + 60));
  try { return fn(); }
  finally { try { if (c.get(k) === mio) c.remove(k); } catch (e) { } }
}
function plantilla_() { return modelo_('PLANTILLA_ID'); }

// Copia una pestaña de la planilla modelo al libro nuevo, con el mismo nombre.
function copiarPestana_(tpl, ss, nombre) {
  var src = tpl.getSheetByName(nombre);
  if (!src) throw new Error('La planilla modelo no tiene la pestaña "' + nombre + '".');
  var sh = src.copyTo(ss);
  sh.setName(nombre);
  return sh;
}

// Borra las fórmulas que apuntan a otras pestañas (quedarían con #REF!).
function limpiarFormulasExternas_(sh) {
  var r = sh.getDataRange(), f = r.getFormulas(), a1 = [];
  for (var i = 0; i < f.length; i++) for (var j = 0; j < f[i].length; j++) {
    if (f[i][j] && f[i][j].indexOf('!') >= 0) a1.push(r.getCell(i + 1, j + 1).getA1Notation());
  }
  for (var k = 0; k < a1.length; k += 400) sh.getRangeList(a1.slice(k, k + 400)).clearContent();
}

// Deja lugar para "cant" filas de datos desde "desde" (agrega filas con el mismo formato si faltan).
function asegurarFilas_(sh, desde, hasta, cant) {
  var hay = hasta - desde + 1;
  if (cant > hay) { sh.insertRowsAfter(hasta - 1, cant - hay); return desde + cant - 1; }
  return hasta;
}

function edad_(fecha) {
  var d = parseFechaSGI_(fecha);
  if (!d) return '';
  var h = new Date(), m = (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
  if (h.getDate() < d.getDate()) m--;
  return Math.floor(m / 12) + ' años, ' + (m % 12) + ' meses';
}
function parseFechaSGI_(v) {
  var s = String(v || '').trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

// Datos completos de SGI por legajo (DNI, CUIL, ingreso, nacimiento).
function fichasSGI_() {
  var c = cacheJSONGet_('fichasSGI2');
  if (c) return c;
  var r = fichasSGILeer_();
  cacheJSONPut_('fichasSGI2', r, 600);
  return r;
}
function fichasSGILeer_() {
  var vals = leerPestanaSM_(PERSONAL_SGI.HOJA);
  var enc = vals[0].map(function (t) { return String(t).trim().toLowerCase(); });
  var c = function (n) { return enc.indexOf(n); };
  var out = {};
  vals.slice(1).forEach(function (f) {
    var leg = String(f[c('legajo')] || '').trim().replace(/\.0$/, '');
    if (!leg) return;
    var emp = c('empresa') >= 0 ? String(f[c('empresa')] || '').trim() : '';
    var o = { Dni: f[c('dni')] || '', Cuil: f[c('cuil')] || '', Ingreso: f[c('ingreso')] || '', Nacimiento: f[c('nacimiento')] || '',
      Categoria: f[c('categoria')] || '', Supervisor: f[c('supervisor')] || '', Empresa: EMPRESAS_SGI[emp] || emp,
      Nombre: c('nombre') >= 0 ? String(f[c('nombre')] || '').trim().toUpperCase() : '',
      Baja: c('estado') >= 0 && /baja/i.test(String(f[c('estado')] || '')) };
    // v1.21.2: el mismo legajo puede estar en varias empresas: se guarda también por legajo + empresa y por nombre
    if (!out[leg] || (out[leg].Baja && !o.Baja)) out[leg] = o;
    out[leg + '|' + empClave_(o.Empresa)] = o;
    (out.__lista = out.__lista || []).push(o);
  });
  return out;
}
/**
 * Mismo nombre: palabra por palabra. Cuando hay nombres repetidos, en uno de los dos el segundo nombre
 * figura solo con la inicial y un punto ("DIAZ CLAUDIO VICTOR G."): la inicial coincide con el nombre que empieza
 * con esa letra. Si uno de los dos tiene menos palabras, se comparan las que tiene.
 */
function mismaPersonaNombre_(a, b) {
  var ta = String(a || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z. ]/g, ' ').split(/\s+/).filter(Boolean);
  var tb = String(b || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z. ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!ta.length || !tb.length) return false;
  var n = Math.min(ta.length, tb.length);
  if (n < 2) return false;
  for (var i = 0; i < n; i++) {
    var x = ta[i].replace(/\.$/, ''), y = tb[i].replace(/\.$/, '');
    if (x === y) continue;
    var ini = (/\.$/.test(ta[i]) || x.length === 1) ? x : (/\.$/.test(tb[i]) || y.length === 1) ? y : '';
    if (ini && ini.length === 1 && (x.charAt(0) === ini && y.charAt(0) === ini)) continue;
    return false;
  }
  return true;
}
// Sigla de empresa para comparar (LEG / LE GUYET / LEGUYET...)
function empClave_(e) {
  var t = normT_(e).replace(/[^A-Z]/g, '');
  if (/^(LEGUYET|LEGUYETSERVICIOS)/.test(t)) return 'LEGUYET';
  if (/^LEG/.test(t)) return 'LEG';
  if (/^(PPQ|KDE|KTL)/.test(t)) return t.slice(0, 3);
  if (/KONTROL/.test(t)) return 'KDE';
  return t;
}
// Ficha de SGI de una fila (legajo + empresa; si no, por nombre; si no, solo legajo)
function fichaPara_(fichas, f) {
  if (!fichas || !f) return {};
  var leg = String(f.Legajo || '').trim().replace(/\.0$/, ''), emp = f.Empresa ? empClave_(f.Empresa) : '';
  if (leg && emp && fichas[leg + '|' + emp]) return fichas[leg + '|' + emp];
  // Por nombre, solo dentro de la misma empresa y solo si hay una única persona que coincide (los nombres se repiten entre empresas)
  if (f.Nombre && fichas.__lista) {
    var cand = fichas.__lista.filter(function (o) { return (!emp || empClave_(o.Empresa) === emp) && mismaPersonaNombre_(o.Nombre, f.Nombre); });
    if (cand.length > 1) { var act = cand.filter(function (o) { return !o.Baja; }); if (act.length === 1) cand = act; }
    if (cand.length === 1) return cand[0];
  }
  if (leg && !emp) return fichas[leg] || {};
  return {};
}

/**
 * Una fila con el diseño del STD (columnas A a DR):
 * A Empresa · B Orden · C Legajo · D Apellido y Nombre · E Cat. · F Puesto · G Cliente ·
 * H..BQ cada día D y N · BR..CC horas · CE..CR estados · CT feriados trab. · CV DV ·
 * CX días trabajados · CY total de días · DA días de ausentismo · DB hs. de ausentismo ·
 * DC hs. normales · DD hs. trab. vs normales · DF relación · DH..DR datos del objetivo y de la persona.
 */
function filaSTD_(f, ctx) {
  var serv = ctx.servs[f.ServicioId] || {}, ficha = fichaPara_(ctx.fichas, f);
  var n = ctx.n, row = [f.Empresa, f.Orden ? Number(f.Orden) : '', f.Legajo ? Number(f.Legajo) || f.Legajo : '', f.Nombre,
    ficha.Categoria || '', f.Puesto || (f.Seccion === 'RETEN' ? 'Retén' : f.Seccion === 'EVENTO' ? 'Eventual' : ''), serv.Cliente || serv.Servicio || ''];
  var D = 0, N = 0, iD = 0, iN = 0, rD = 0, rN = 0, est = {}, trab = 0, ferTrab = 0, aus = 0;
  var instr = /INSTRUC/i.test(f.Puesto || '');
  for (var i = 0; i < 31; i++) {
    if (i >= n) { row.push('', ''); continue; }
    var c = leerCelda_(f[DIAS_COL[i]]);
    if (c.tipo === 'horas') {
      row.push(c.d, c.n); trab++;
      if (esFeriado_(fechaDia_(ctx.periodo, i))) ferTrab++;
      if (f.Seccion === 'RETEN') { if (instr) { iD += c.d; iN += c.n; } else { rD += c.d; rN += c.n; } }
      else { D += c.d; N += c.n; }
    } else if (c.tipo === 'codigo') {
      row.push(c.cod, 0);
      var k = c.cod === 'FCO' ? 'F' : c.cod;
      est[k] = (est[k] || 0) + 1;
      if (COD_AUSENTISMO_.indexOf(c.cod) >= 0) aus++;
    } else row.push('', '');
  }
  var tot = D + N, de = iD + iN + rD + rN, liq = tot + de;
  var he = horasExtras_(tot, aus, n);   // v1.22.10: mismas fórmulas que el Consolidado
  var tdias = trab + Object.keys(est).reduce(function (a, k) { return a + (k === 'DV' ? 0 : est[k]); }, 0);
  row.push(D, N, tot, iD, iN, rD, rN, de, liq, he.extras, N + iN + rN, he.dif, '');
  COD_ESTADOS_.forEach(function (k) { row.push(est[k] || 0); });
  row.push('', ferTrab, '', est.DV || 0, '', trab, tdias, '', aus, he.hsAus, he.normales, he.tvn, '', Math.round(liq / HS_BASE_PERIODO * 10000) / 10000, '');
  row.push(serv.Direccion || '', serv.Jurisdiccion || '', ctx.nomSup[String(serv.Supervisor || '').toLowerCase()] || '', serv.JefeOperaciones || '',
    f.Nombre, f.Legajo ? Number(f.Legajo) || f.Legajo : '', ficha.Dni ? Number(ficha.Dni) || ficha.Dni : '', edad_(ficha.Nacimiento), ficha.Cuil || '',
    ficha.Ingreso || '', edad_(ficha.Ingreso));
  return row; // 122 columnas (A..DR)
}

function contextoInforme_(periodo) {
  var servs = {};
  leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  var nomSup = {};
  usuariosSinClave_().forEach(function (x) { nomSup[x.Usuario.toLowerCase()] = x.Nombre; });
  return { periodo: periodo, n: periodoInfo_(periodo).n, servs: servs, nomSup: nomSup, fichas: fichasSGI_() };
}

// Encabezado de fechas (fila de fechas y fila de días) desde la columna col0, cada día ocupa 2 columnas.
function encabezadoFechas_(sh, filaFecha, filaDia, col0, periodo) {
  var n = periodoInfo_(periodo).n, fechas = [], dias = [];
  for (var i = 0; i < 31; i++) {
    if (i < n) {
      var d = fechaDia_(periodo, i);
      fechas.push(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), '');
      dias.push(DIAS_NOMBRE_[(d.getUTCDay() + 6) % 7], '');
    } else { fechas.push('', ''); dias.push('', ''); }
  }
  sh.getRange(filaFecha, col0, 1, 62).setValues([fechas]);
  sh.getRange(filaDia, col0, 1, 62).setValues([dias]);
}

function filasDelPeriodo_(periodo, filtro) {
  var orden = {};
  leer_('Servicios').forEach(function (s, k) { orden[s.Id] = k; });
  return planillaPeriodo_(periodo).filter(function (f) { return (f.Nombre || f.Legajo) && (!filtro || filtro(f)); })
    .sort(function (a, b) { return (orden[a.ServicioId] - orden[b.ServicioId]) || (a.Seccion === b.Seccion ? Number(a.Orden) - Number(b.Orden) : (a.Seccion < b.Seccion ? -1 : 1)); });
}

// Muestra los días del período y oculta los que no existen (períodos de 28, 29 o 30 días).
function ajustarColumnasDias_(sh, diasCols, n) {
  diasCols.forEach(function (dc, i) {
    try { if (i < n) sh.showColumns(dc + 1, 2); else sh.hideColumns(dc + 1, 2); } catch (e) { }
  });
}

/* ---------------- STD, 30/31 Días y Consolidado (por títulos de columna) ---------------- */
function normT_(v) {
  return String(v === null || v === undefined ? '' : v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n]+/g, ' ').replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

// v1.22.9: es nuevo ingreso si su fecha de ingreso (SGI) cae dentro del período (o hasta 10 días antes de que empiece).
// Quien ya trabajaba y pasa a instrucción en otro servicio no es nuevo.
function nuevoIngreso_(f, ctx) {
  ctx._ni = ctx._ni || {};
  var k = (f.Legajo || '') + '|' + f.Nombre;
  if (ctx._ni[k] !== undefined) return ctx._ni[k];
  var ficha = {}; try { ficha = fichaPara_(ctx.fichas, f) || {}; } catch (e) { }
  var m = String(ficha.Ingreso || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/), es = false;
  if (m) {
    var d = m[1] ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Date.UTC(+m[4], +m[5] - 1, +m[6]);
    var info = periodoInfo_(ctx.periodo);
    es = d >= info.desde.getTime() - 10 * 864e5 && d <= info.hasta.getTime();
  }
  return (ctx._ni[k] = es);
}
// Calcula todo lo de una fila (persona en un servicio) con las reglas del STD.
function estadisticasFila_(f, ctx) {
  var x = { D: 0, N: 0, iD: 0, iN: 0, rD: 0, rN: 0, est: {}, trab: 0, ferTrab: 0, aus: 0, dias: [] };
  var instr = /INSTRUC/i.test(f.Puesto || '');
  for (var i = 0; i < 31; i++) {
    if (i >= ctx.n) { x.dias.push(['', '']); continue; }
    var c = leerCelda_(f[DIAS_COL[i]]);
    // v1.22.10: YNG (nuevo ingreso): el día de instrucción de quien ingresó a la empresa en este período va como YNG
    // (como en la planilla: se cuenta en YNG y en ausentismo, no como horas ni como día trabajado)
    if (c.tipo === 'horas' && f.Seccion === 'RETEN' && instr && nuevoIngreso_(f, ctx)) { c = { tipo: 'codigo', cod: 'YNG' }; }
    if (c.tipo === 'horas') {
      x.dias.push([c.d, c.n]); x.trab++;
      var fd0 = fechaDia_(ctx.periodo, i);
      if (esFeriado_(fd0)) x.ferTrab++;
      // v1.22.9: el 25 de abril (Día del Vigilador) el que trabaja suma 1 en la columna DV (se le paga ese día)
      if (fd0.getUTCMonth() === 3 && fd0.getUTCDate() === 25) x.est.DV = (x.est.DV || 0) + 1;
      if (f.Seccion === 'RETEN') { if (instr) { x.iD += c.d; x.iN += c.n; } else { x.rD += c.d; x.rN += c.n; } }
      else { x.D += c.d; x.N += c.n; }
    } else if (c.tipo === 'codigo') {
      x.dias.push([c.cod, 0]);
      var k = c.cod === 'F' ? 'FCO' : c.cod;
      x.est[k] = (x.est[k] || 0) + 1;
      if (COD_AUSENTISMO_.indexOf(c.cod) >= 0) x.aus++;
    } else x.dias.push(['', '']);
  }
  x.tot = x.D + x.N; x.de = x.iD + x.iN + x.rD + x.rN; x.liq = x.tot + x.de;
  // v1.22.10: mismas fórmulas que el Consolidado de la empresa (ver horasExtras_)
  var he = horasExtras_(x.tot, x.aus, ctx.n);
  x.hsAus = he.hsAus; x.normales = he.normales; x.trabVsNor = he.tvn; x.extras = he.extras; x.dif = he.dif;
  x.noc = x.N + x.iN + x.rN;
  // Total de días (CZ) = francos + estados + días trabajados
  x.tdias = x.trab + Object.keys(x.est).reduce(function (a, k) { return a + (k === 'DV' ? 0 : x.est[k]); }, 0);
  x.ratio = Math.round(x.liq / HS_BASE_PERIODO * 10000) / 10000;   // Productividad (DG) = Total a liquidar / 208
  return x;
}

/**
 * Llena una pestaña con el diseño del STD buscando cada columna por su título
 * (Empresa, Orden, Legajo, Apellido y Nombre, días D/N, A, B, ABC, Instrucción (D), Reten (E), DE,
 * Total Horas a Liquidar, Total Hs. Extras, Total Hs. Noc., Diferencias, FCO..BAJA, Feriad. Trab., DV,
 * Dias Trabajados, Total de Dias, Dias de Ausentismo, Hs. de Ausentismo, Hs. Normales, Hs Trab. vs Nor.,
 * Domicilio del Objetivo, Juridiccion, Supervisor, JO, DNI, Edad, CUIL, Fecha de Ingreso, Antigüedad).
 * Así sirve para cualquier versión de la planilla de la empresa.
 */
var AJUSTES_STD_ = null;
function llenarPestanaSTD_(sh, periodo, filas, colANombre) {
  var ctx = contextoInforme_(periodo);
  var W = sh.getMaxColumns(), cab = sh.getRange(1, 1, 10, W).getValues();
  var hdr = -1;
  for (var r = 4; r < 10 && hdr < 0; r++) for (var c = 0; c < W; c++) if (normT_(cab[r][c]) === 'APELLIDO Y NOMBRE') { hdr = r; break; }
  if (hdr < 0) throw new Error('La pestaña "' + sh.getName() + '" no tiene el título "Apellido y Nombre".');
  var fF = hdr - 2, fS = hdr - 1; // filas de fechas y de días de la semana
  var col = {}, dos = {}, diasCols = [];
  for (var c2 = 0; c2 < W; c2++) {
    var h = normT_(cab[hdr][c2]), h6 = normT_(cab[fF][c2]), h7 = normT_(cab[fS][c2]);
    if (h === 'D' && normT_(cab[hdr][c2 + 1]) === 'N' && diasCols.length < 31 && !col.A) diasCols.push(c2);
    [h6, h7].forEach(function (t) { if (t && col[t] === undefined) col[t] = c2; });
    if (h) { if (col[h] === undefined) col[h] = c2; else if (dos[h] === undefined) dos[h] = c2; }
    if (h6 === 'A' && col.A === undefined) col.A = c2;
  }
  var busca = function (pref) { var k = Object.keys(col).filter(function (t) { return t.indexOf(pref) === 0; })[0]; return k ? col[k] : undefined; };
  var C = {
    emp: col.EMPRESA, ord: col.ORDEN, leg: col.LEGAJO, nom: col['APELLIDO Y NOMBRE'], cat: col.CAT, pue: col.PUESTO, cli: col.CLIENTE,
    A: col.A, B: col.B, ABC: col.ABC, iD: busca('INSTRUCCION'), rD: busca('RETEN'), DE: col.DE, liq: busca('TOTAL HORAS'),
    ext: busca('TOTAL HS EXTRA'), noc: busca('TOTAL HS NOC'), dif: col.DIFERENCIAS !== undefined && col.DIFERENCIAS > (col.A || 0) ? col.DIFERENCIAS : undefined,
    fer: busca('FERIAD'), trab: busca('DIAS TRABAJADO'), tdias: busca('TOTAL DE DIAS'), aus: busca('DIAS DE AUSENT'), hsAus: busca('HS DE AUSENT'),
    norm: busca('HS NORMALES'), tvn: busca('HS TRAB'), dom: busca('DOMICILIO'), jur: busca('JURIDICCION'), sup: col.SUPERVISOR, jo: col.JO,
    nom2: dos['APELLIDO Y NOMBRE'], leg2: dos.LEGAJO, dni: col.DNI, edad: col.EDAD, cuil: col.CUIL, ing: busca('FECHA DE INGRESO'), ant: busca('ANTIGUEDAD')
  };
  // Diferencias de horas: la que está en la fila de títulos de horas (debajo de "Horas")
  for (var cc = (C.A || 0); cc < W; cc++) if (normT_(cab[fS][cc]) === 'DIFERENCIAS') { C.dif = cc; break; }
  var codCols = {};
  ['FCO', 'YNG', 'INJ', 'LSG', 'ENF', 'ART', 'VAC', 'DV', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'CAS', 'BAJA'].forEach(function (k) {
    for (var c3 = (C.A || 0); c3 < W; c3++) if (normT_(cab[fS][c3]) === k) { codCols[k] = c3; break; }
  });
  var numCol = (C.emp > 0 && !normT_(cab[hdr][0])) ? 0 : -1; // primera columna sin título: N° o nombre

  // Filas de datos: desde la fila siguiente a los títulos hasta antes de "Horas Realizadas" (si está).
  var desde = hdr + 2, maxR = sh.getMaxRows();
  var colAB = sh.getRange(desde, 1, maxR - desde + 1, 2).getValues(), filaTot = -1;
  for (var q = 0; q < colAB.length; q++) if (/HORAS REALIZ/i.test(String(colAB[q][0]) + ' ' + String(colAB[q][1]))) { filaTot = desde + q; break; }
  var hasta = filaTot > 0 ? filaTot - 3 : maxR;
  if (filas.length > hasta - desde + 1) {
    var faltan = filas.length - (hasta - desde + 1);
    sh.insertRowsAfter(hasta - 1, faltan); hasta += faltan; if (filaTot > 0) filaTot += faltan;
  }
  // v1.22.10: fórmulas de la primera fila de datos del modelo (se vuelven a poner en cada fila, como en la planilla de la empresa)
  var formR1C1 = sh.getRange(desde, 1, 1, W).getFormulasR1C1()[0], ajAplicados = [];
  sh.getRange(desde, 1, hasta - desde + 1, W).clearContent();
  var put = function (row, c, v) { if (c !== undefined && c >= 0 && c < W) row[c] = v; };
  var sumD = [], sumN = [];
  for (var z = 0; z < 31; z++) { sumD.push(0); sumN.push(0); }
  var vals = filas.map(function (f, k) {
    var x = estadisticasFila_(f, ctx), row = [], ficha = fichaPara_(ctx.fichas, f), serv = ctx.servs[f.ServicioId] || {};
    for (var w = 0; w < W; w++) row.push('');
    var leg = f.Legajo ? Number(f.Legajo) || f.Legajo : '';
    if (numCol === 0) row[0] = colANombre ? f.Nombre : k + 1;
    put(row, C.emp, f.Empresa); put(row, C.ord, f.Orden ? Number(f.Orden) : k + 1); put(row, C.leg, leg); put(row, C.nom, f.Nombre);
    put(row, C.cat, ficha.Categoria || ''); put(row, C.pue, f.Puesto || (f.Seccion === 'RETEN' ? 'Retén' : f.Seccion === 'EVENTO' ? 'Eventual' : ''));
    put(row, C.cli, serv.Cliente || serv.Servicio || '');
    diasCols.forEach(function (dc, i) {
      row[dc] = x.dias[i][0]; row[dc + 1] = x.dias[i][1];
      if (typeof x.dias[i][0] === 'number') { sumD[i] += x.dias[i][0]; sumN[i] += x.dias[i][1]; }
    });
    put(row, C.A, x.D); put(row, C.B, x.N); put(row, C.ABC, x.tot);
    if (C.iD !== undefined) { row[C.iD] = x.iD; row[C.iD + 1] = x.iN; }
    if (C.rD !== undefined) { row[C.rD] = x.rD; row[C.rD + 1] = x.rN; }
    put(row, C.DE, x.de); put(row, C.liq, x.liq); put(row, C.ext, x.extras); put(row, C.noc, x.noc); put(row, C.dif, x.dif);
    Object.keys(codCols).forEach(function (k2) { row[codCols[k2]] = x.est[k2] || 0; });
    put(row, C.fer, x.ferTrab); put(row, C.trab, x.trab); put(row, C.tdias, x.tdias); put(row, C.aus, x.aus); put(row, C.hsAus, x.hsAus);
    put(row, C.norm, x.normales); put(row, C.tvn, x.trabVsNor);
    put(row, C.dom, serv.Direccion || ''); put(row, C.jur, serv.Jurisdiccion || ''); put(row, C.sup, ctx.nomSup[String(serv.Supervisor || '').toLowerCase()] || '');
    put(row, C.jo, serv.JefeOperaciones || ''); put(row, C.nom2, f.Nombre); put(row, C.leg2, leg);
    put(row, C.dni, ficha.Dni ? Number(ficha.Dni) || ficha.Dni : ''); put(row, C.edad, edad_(ficha.Nacimiento)); put(row, C.cuil, ficha.Cuil || '');
    put(row, C.ing, ficha.Ingreso || ''); put(row, C.ant, edad_(ficha.Ingreso));
    if (AJUSTES_STD_) {
      var fk = claveFilaInf_(f);
      for (var w2 = 0; w2 < W; w2++) {
        var a = AJUSTES_STD_[fk + '#' + w2];
        if (a !== undefined) { row[w2] = /^-?\d+([.,]\d+)?$/.test(String(a).trim()) ? Number(String(a).trim().replace(',', '.')) : a; ajAplicados.push([k, w2, row[w2]]); }
      }
    }
    return row;
  });
  AJUSTES_STD_ = null;
  if (vals.length) sh.getRange(desde, 1, vals.length, W).setValues(vals);
  try { if (vals.length) ponerFormulasSTD_(sh, formR1C1, desde, vals.length, W, diasCols, ctx, cab, hdr, Object.keys(C).map(function (k) { return C[k]; }).concat(Object.keys(codCols).map(function (k) { return codCols[k]; })).concat(numCol === 0 ? [0] : [])); } catch (e) { Logger.log('Fórmulas del ' + sh.getName() + ': ' + e.message); }
  // lo modificado a mano por administración manda sobre la fórmula
  ajAplicados.forEach(function (x) { sh.getRange(desde + x[0], x[1] + 1).setValue(x[2]); });
  // Encabezado: período, fechas y días
  for (var r4 = 0; r4 < 4; r4++) for (var c4 = 0; c4 < Math.min(W, 12); c4++) {
    if (normT_(cab[r4][c4]) === 'PERIODO') sh.getRange(r4 + 2, c4 + 1).setValue(nombrePeriodo_(periodo));
  }
  var fechas = sh.getRange(fF + 1, 1, 2, W).getValues();
  diasCols.forEach(function (dc, i) {
    if (i < ctx.n) {
      var d = fechaDia_(periodo, i);
      fechas[0][dc] = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      fechas[1][dc] = DIAS_NOMBRE_[(d.getUTCDay() + 6) % 7];
    } else { fechas[0][dc] = ''; fechas[1][dc] = ''; }
  });
  sh.getRange(fF + 1, 1, 2, W).setValues(fechas);
  // Totales de abajo ("Horas Realizadas"): D y N por día, y debajo D+N
  if (filaTot > 0) {
    var t1 = sh.getRange(filaTot, 1, 2, W).getValues();
    diasCols.forEach(function (dc, i) { t1[0][dc] = i < ctx.n ? sumD[i] : ''; t1[0][dc + 1] = i < ctx.n ? sumN[i] : ''; t1[1][dc] = i < ctx.n ? sumD[i] + sumN[i] : ''; });
    sh.getRange(filaTot, 1, 2, W).setValues(t1);
  }
  ajustarColumnasDias_(sh, diasCols, ctx.n);
  limpiarFormulasExternas_(sh);
  return sh;
}

/**
 * v1.22.10: las fórmulas propias de la pestaña (Consolidado, 30/31 días): totales A/B/ABC, DE, total a liquidar,
 * horas extras (CB), nocturnas, diferencias, cantidad de cada estado, días trabajados, total de días, ausentismo,
 * hs. normales, hs. trab. vs normales, productividad... Se copian del modelo en todas las filas (R1C1, así se ajustan solas).
 * No se ponen las que traen datos de otras pestañas (servicios, Personal, Facturacion): esas van con su valor.
 * Las columnas "Feriado 1..5" apuntan a los días feriados de ESTE período; DW2 / DV2 = 208 / días del período.
 */
function ponerFormulasSTD_(sh, f1, desde, nFilas, W, diasCols, ctx, cab, hdr, llenas) {
  var colsDe = function (fx, c) {   // columnas (0-based) que usa una fórmula R1C1
    var out = [], m, rx = /R(\[-?\d+\]|\d+)?C(\[(-?\d+)\]|(\d+))?/g;
    while ((m = rx.exec(fx))) { if (m[3] !== undefined) out.push(c + Number(m[3])); else if (m[4] !== undefined) out.push(Number(m[4]) - 1); else out.push(c); }
    return out;
  };
  // "externa": la columna del modelo trae datos de otra pestaña y la app no la llena (las que llena la app, como los días, no cuentan)
  var ext = {}, lle = {};
  (llenas || []).forEach(function (c) { if (c !== undefined && c !== null) lle[c] = 1; });
  diasCols.forEach(function (c) { lle[c] = 1; lle[c + 1] = 1; });
  f1.forEach(function (fx, c) { if (fx && fx.indexOf('!') >= 0 && !lle[c]) ext[c] = 1; });
  // columnas "Feriado n" (encabezado) y la columna de suma de cada día (SUM(RC[a]:RC[b]) sobre el D y N de ese día)
  var ferCols = [];
  for (var c0 = 0; c0 < W; c0++) if (/^FERIADO \d$/.test(normT_(cab[hdr][c0]))) ferCols.push(c0);
  var sumaDia = {};
  f1.forEach(function (fx, c) {
    var m = String(fx || '').match(/^=SUM\(RC\[(-?\d+)\]:RC\[(-?\d+)\]\)$/);
    if (m) { var a = c + Number(m[1]); var i = diasCols.indexOf(a); if (i >= 0 && c + Number(m[2]) === a + 1) sumaDia[i] = c; }
  });
  var usar = [];
  f1.forEach(function (fx, c) {
    if (!fx || ext[c] || lle[c] && fx.indexOf('!') >= 0 || ferCols.indexOf(c) >= 0) return;
    if (diasCols.indexOf(c) >= 0 || diasCols.indexOf(c - 1) >= 0) return;            // los días van con su valor
    if (normT_((cab[hdr - 1] || [])[c]) === 'DV') return;                                // Día del Vigilador: lo calcula la app (25 de abril)
    var refs = colsDe(fx, c);
    if (refs.some(function (r) { return ext[r]; })) return;                              // depende de otra pestaña (ej.: edad / antigüedad)
    usar.push(c);
  });
  // feriados del período -> columnas Feriado 1..5
  var fer = [];
  for (var i = 0; i < ctx.n; i++) if (esFeriado_(fechaDia_(ctx.periodo, i)) && sumaDia[i] !== undefined) fer.push(sumaDia[i]);
  var ferF = ferCols.map(function (fc, k) { return fer[k] !== undefined ? '=+RC[' + (fer[k] - fc) + ']' : ''; });
  // valores de base: DW2 / DV2 (208 / días) y DW3 / DV3 (208), los que usan las fórmulas con $2 y $3
  var base2 = {};
  usar.forEach(function (c) { var rx = /R[23]C(\[(-?\d+)\]|(\d+))/g, m; while ((m = rx.exec(f1[c]))) base2[m[3] !== undefined ? Number(m[3]) : c + Number(m[2]) + 1] = 1; });
  Object.keys(base2).forEach(function (cc) { sh.getRange(2, Number(cc)).setValue(HS_BASE_PERIODO / ctx.n); sh.getRange(3, Number(cc)).setValue(HS_BASE_PERIODO); });
  // formato sin ceros (la fórmula que da 0 se ve vacía, como pidió la empresa)
  var nf0 = sh.getRange(desde, 1, 1, W).getNumberFormats()[0];
  var sinCero = function (f) { f = String(f || 'General'); if (f.indexOf(';') >= 0 || f === '@') return f; return f + ';-' + f + ';'; };
  // se escriben por tramos de columnas seguidas
  var todas = usar.concat(ferCols).sort(function (a, b) { return a - b; });
  var k = 0;
  while (k < todas.length) {
    var ini = todas[k], fin = ini;
    while (k + 1 < todas.length && todas[k + 1] === fin + 1) { k++; fin = todas[k]; }
    var bloque = [];
    for (var r = 0; r < nFilas; r++) {
      var fila = [];
      for (var cc2 = ini; cc2 <= fin; cc2++) { var fi = ferCols.indexOf(cc2); fila.push(fi >= 0 ? ferF[fi] : f1[cc2]); }
      bloque.push(fila);
    }
    var rgB = sh.getRange(desde, ini + 1, nFilas, fin - ini + 1);
    rgB.setFormulasR1C1(bloque);
    var fmts = []; for (var r2 = 0; r2 < nFilas; r2++) { var ff = []; for (var c3 = ini; c3 <= fin; c3++) ff.push(sinCero(nf0[c3])); fmts.push(ff); }
    try { rgB.setNumberFormats(fmts); } catch (e) { }
    k++;
  }
}

function informeSTD_(tpl, ss, periodo, nombrePestana, porApellido) {
  var sh = copiarPestana_(tpl, ss, nombrePestana);
  // v1.22.9: lo modificado a mano en Informes también va en el Excel
  var tn = normT_(nombrePestana);
  AJUSTES_STD_ = ajustesInforme_(/CONSOLIDADO/.test(tn) ? 'consolidado' : /DIAS/.test(tn) ? 'treinta' : 'std', periodo);
  var filas = filasDelPeriodo_(periodo, function (f) { return f.Seccion !== 'EVENTO'; });
  if (porApellido) filas.sort(function (a, b) { return String(a.Nombre).localeCompare(String(b.Nombre)); });
  return llenarPestanaSTD_(sh, periodo, filas, nombrePestana === 'Consolidado');
}

/* ---------------- Plus Encargado ---------------- */
function llenarPlus_(sh, periodo) {
  var datos = datosPlus_(periodo);
  var W = Math.min(sh.getMaxColumns(), 11), cab = sh.getRange(1, 1, 6, W).getValues(), hdr = 2;
  for (var r = 0; r < 6; r++) if (cab[r].some(function (v) { return normT_(v) === 'LP'; })) { hdr = r; break; }
  var desde = hdr + 2;
  var vals = datos.map(function (d) { return [d.Empresa, Number(d.Legajo) || d.Legajo, d.Nombre, d.Servicio, d.Dias, d.Plata || '']; });
  var ult = asegurarFilas_(sh, desde, sh.getMaxRows(), vals.length + 1);
  sh.getRange(desde, 1, ult - desde + 1, 6).clearContent();
  if (vals.length) sh.getRange(desde, 1, vals.length, 6).setValues(vals);
  var t = desde + vals.length;
  sh.getRange(t, 4, 1, 3).setValues([['Total', '=SUM(E' + desde + ':E' + (t - 1) + ')', '=SUM(F' + desde + ':F' + (t - 1) + ')']]);
  limpiarFormulasExternas_(sh);
  return sh;
}
function informePlus_(tpl, ss, periodo) {
  return llenarPlus_(copiarPestana_(tpl, ss, 'Plus Encargado'), periodo);
}

/* ---------------- Horas Contratadas Vs. Realizadas (bloques por empresa) ---------------- */
var EMPRESA_EQUIV_ = { KTL: 'KDE', 'LE GUYET': 'LEGUYET', LEGUYET: 'LEGUYET' };
function informeFacturacion_(tpl, ss, periodo) {
  var fact = modelo_('PLANTILLA_FACT_ID');
  if (!fact) throw new Error('Falta la planilla modelo de Horas Contratadas vs. Realizadas.');
  var hojas = fact.getSheets(), sh = null;
  hojas.forEach(function (h, k) {
    var c = h.copyTo(ss); c.setName(h.getName());
    if (h.isSheetHidden()) c.hideSheet();
    if (k === 0) sh = c;
  });
  return llenarFacturacion_(sh, periodo);
}
function llenarFacturacion_(sh, periodo) {
  var datos = datosFacturacion_(periodo);
  var emp = function (e) { var k = normT_(e); return normT_(EMPRESA_EQUIV_[k] || k).replace(/\s/g, ''); };
  var maxR = sh.getMaxRows(), vals = sh.getRange(1, 1, maxR, 13).getValues(), forms = sh.getRange(1, 1, maxR, 13).getFormulas();
  // Bloques: filas seguidas con empresa en B, cerradas por una fila de subtotal (fórmulas)
  var bloques = [], cur = null;
  for (var r = 3; r < maxR; r++) {
    var b = String(vals[r][1] || '').trim(), esSub = forms[r].slice(2).some(function (f) { return f; });
    if (normT_(vals[r][0]).indexOf('TOTAL GENERAL') === 0) break;
    if (b && !esSub) { if (!cur) { cur = { emp: emp(b), nombre: b, desde: r + 1, hasta: r + 1 }; bloques.push(cur); } else cur.hasta = r + 1; }
    else if (esSub && cur) { cur.sub = r + 1; cur = null; }
  }
  var porEmp = {};
  datos.forEach(function (d) {
    var k = emp(d.Empresa);
    if (!bloques.some(function (bl) { return bl.emp === k; })) k = bloques.length ? bloques[0].emp : k;
    (porEmp[k] = porEmp[k] || []).push(d);
  });
  // De abajo hacia arriba, para no correr las filas de los bloques que faltan
  bloques.slice().reverse().forEach(function (bl) {
    var l = porEmp[bl.emp] || [], hay = bl.hasta - bl.desde + 1, need = Math.max(1, l.length);
    if (need > hay) sh.insertRowsAfter(bl.desde, need - hay);
    else if (need < hay) sh.deleteRows(bl.desde + need, hay - need);
    var filas = l.map(function (d) {
      var f1 = d.RealD + (d.Eventuales ? 0 : 0), g1 = d.RealN;
      return [d.Cliente, bl.nombre, d.ContrD, d.ContrN, d.ContrD + d.ContrN, d.RealD, d.RealN, d.Eventuales, d.RealD + d.RealN, d.NoCubiertas, d.Reten, d.Instruccion, d.RetInst];
    });
    sh.getRange(bl.desde, 1, need, 13).clearContent();
    if (filas.length) sh.getRange(bl.desde, 1, filas.length, 13).setValues(filas);
  });
  limpiarFormulasExternas_(sh);
  return sh;
}

/* ---------------- Injustificados y Licencias / Eventos (formato de pestaña de servicio) ---------------- */
function informeGrilla_(tpl, ss, periodo, nombrePestana, filas, titulo) {
  return llenarGrilla_(copiarPestana_(tpl, ss, nombrePestana), periodo, filas, titulo);
}
function llenarGrilla_(sh, periodo, filas, titulo) {
  var ctx = contextoInforme_(periodo);
  sh.getRange('H2').setValue(nombrePeriodo_(periodo));
  sh.getRange('B5').setValue(titulo);
  encabezadoFechas_(sh, 8, 9, 7, periodo);
  var dc0 = []; for (var z = 0; z < 31; z++) dc0.push(6 + 2 * z);
  ajustarColumnasDias_(sh, dc0, ctx.n);
  // Las filas de personas van desde la 11 hasta la fila anterior a "Horas Realizadas" / "Horas Contratadas".
  var colB = sh.getRange(11, 2, sh.getMaxRows() - 10, 1).getValues();
  var fin = 11;
  while (fin - 11 < colB.length && !/HORAS/i.test(String(colB[fin - 11][0]))) fin++;
  fin = Math.max(11, fin - 2);
  var hay = fin - 10;
  if (filas.length > hay) { sh.insertRowsAfter(fin - 1, filas.length - hay); fin += filas.length - hay; }
  var vals = filas.map(function (f, k) {
    var ficha = fichaPara_(ctx.fichas, f), serv = ctx.servs[f.ServicioId] || {};
    var row = [f.Empresa, k + 1, f.Legajo ? Number(f.Legajo) || f.Legajo : '', ficha.Categoria || '', f.Nombre,
      (f.Puesto || '') + (serv.Servicio ? ' · ' + serv.Servicio : '')];
    for (var i = 0; i < 31; i++) {
      var c = i < ctx.n ? leerCelda_(f[DIAS_COL[i]]) : { tipo: 'vacio' };
      if (c.tipo === 'horas') row.push(c.d, c.n); else if (c.tipo === 'codigo') row.push(c.cod, ''); else row.push('', '');
    }
    return row;
  });
  sh.getRange(11, 1, fin - 10, 68).clearContent();
  if (vals.length) sh.getRange(11, 1, vals.length, 68).setValues(vals);
  limpiarFormulasExternas_(sh);
  return sh;
}

/* ---------------- pestaña Datos (período, fechas y días) ---------------- */
function llenarDatos_(sh, periodo) {
  var R = Math.min(sh.getMaxRows(), 60), W = Math.min(sh.getMaxColumns(), 4);
  var v = sh.getRange(1, 1, R, W).getValues(), n = periodoInfo_(periodo).n;
  for (var r = 0; r < R; r++) {
    if (normT_(v[r][1]) === 'PERIODO') sh.getRange(r + 1, 3).setValue(nombrePeriodo_(periodo));
  }
  // Fila 8 en adelante: N° · fecha · día (como en la planilla original)
  var fil = [];
  for (var i = 0; i < 31; i++) {
    if (i < n) { var d = fechaDia_(periodo, i); fil.push([i + 1, new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), DIAS_NOMBRE_[(d.getUTCDay() + 6) % 7]]); }
    else fil.push(['', '', '']);
  }
  if (sh.getMaxRows() >= 38) sh.getRange(8, 1, 31, 3).setValues(fil);
  limpiarFormulasExternas_(sh);
}

/* ---------------- armado ---------------- */
// Deja en el libro solo las pestañas pedidas (las demás se borran).
function soloPestanas_(ss, quedan) {
  var hojas = ss.getSheets();
  hojas.forEach(function (h) { if (quedan.indexOf(h.getName()) < 0 && ss.getSheets().length > 1) ss.deleteSheet(h); });
}

/**
 * Cada informe es una COPIA COMPLETA del archivo de la empresa (mismo formato, pestañas,
 * colores, anchos, fórmulas propias), con los datos del período cargados.
 */
function n0_(periodo) { return periodoInfo_(periodo).n; }
function libroInformePlantilla_(tipo, periodo) {
  var nombres = { stdsup: 'STD', std: 'STD', consolidado: 'Consolidado', treinta: n0_(periodo) + ' Días', plus: 'Plus Encargado', facturacion: 'Horas Contratadas Vs. Realizadas',
    rrhh: 'Novedades del Personal', licencias: 'Injustificados y Licencias', eventos: 'Eventos' };
  var nombre = (tipo === 'rrhh' ? 'Novedades del Personal ' : 'Delben - ' + nombres[tipo] + ' - ') + nombrePeriodo_(periodo);
  var n = periodoInfo_(periodo).n;
  var filas = filasDelPeriodo_(periodo, function (f) { return f.Seccion !== 'EVENTO'; });
  var porApe = filas.slice().sort(function (a, b) { return String(a.Nombre).localeCompare(String(b.Nombre)); });
  var ss;
  // v1.21 · STD con el formato que mandan los supervisores (pestaña STD de la Planificación)
  if (tipo === 'stdsup') {
    ss = copiaModelo_('PLANTILLA_ID', nombre);
    if (!ss) return null;
    if (ss.getSheetByName('STD')) {
      soloPestanas_(ss, ['STD']);
      var shS = ss.getSheetByName('STD');
      try { compactarEncabezado_(shS); } catch (e) { }
      llenarPestanaSTD2_(shS, datosSTD_(periodo, 'std'), false);
      return exportarXlsx_(ss, nombre);
    }
    try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (e) { }
    tipo = 'std';
  }
  // STD y 30/31 días: con el archivo que va a RRHH (Novedades del Personal), igual al que se manda.
  if (tipo === 'std' || tipo === 'treinta') {
    ss = copiaModelo_('PLANTILLA_RRHH_ID', nombre);
    if (!ss) return null;
    var pRR = tipo === 'std' ? (ss.getSheetByName('STD') ? 'STD' : '') : (ss.getSheets().map(function (h) { return h.getName(); }).filter(function (x) { return /^\d+\s*DIAS/i.test(x); })[0] || '');
    if (pRR) {
      soloPestanas_(ss, [pRR]);
      var shR = ss.getSheetByName(pRR);
      llenarPestanaSTD2_(shR, datosSTD_(periodo, tipo), false);
      if (tipo === 'treinta') shR.setName(n + ' Dias');
      return exportarXlsx_(ss, nombre);
    }
    try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (e) { }
  }
  if (tipo === 'rrhh' || tipo === 'plus') {
    ss = copiaModelo_('PLANTILLA_RRHH_ID', nombre);
    if (!ss) return null;
    if (tipo === 'plus') soloPestanas_(ss, ['Plus Encargado']);
    ss.getSheets().forEach(function (sh) {
      var nom = sh.getName();
      if (/\d+\s*dias/i.test(nom)) sh.setName(nom.replace(/\d+(\s*dias)/i, n + '$1'));
      if (/^DATOS$/i.test(nom)) llenarDatos_(sh, periodo);
      else if (/PLUS/i.test(nom)) llenarPlus_(sh, periodo);
      else if (/DIAS/i.test(nom)) llenarPestanaSTD2_(sh, datosSTD_(periodo, 'treinta'), false);
      else if (/STD/i.test(nom)) llenarPestanaSTD2_(sh, datosSTD_(periodo, 'std'), false);
    });
  } else if (tipo === 'facturacion') {
    ss = copiaModelo_('PLANTILLA_FACT_ID', nombre + ' (' + mesDePeriodo_(periodo) + ')');
    if (!ss) return null;
    llenarFacturacion_(ss.getSheets()[0], periodo);
  } else {
    ss = copiaModelo_('PLANTILLA_ID', nombre);
    if (!ss) return null;
    var pest = { std: 'STD', consolidado: 'Consolidado', treinta: '30 Dias', licencias: 'Injustificados y Licencias', eventos: 'Enevtos' }[tipo];
    if (!pest) throw new Error('Informe desconocido.');
    if (tipo === 'treinta') pest = (ss.getSheets().map(function (h) { return h.getName(); }).filter(function (x) { return /^\d+\s*DIAS/i.test(x); })[0]) || pest;
    soloPestanas_(ss, [pest]);
    var sh = ss.getSheetByName(pest);
    if (!sh) throw new Error('La planilla modelo no tiene la pestaña "' + pest + '".');
    if (tipo === 'std') llenarPestanaSTD2_(sh, datosSTD_(periodo, 'std'), false);
    else if (tipo === 'consolidado') llenarPestanaSTD2_(sh, datosSTD_(periodo, 'consolidado'), true);
    else if (tipo === 'treinta') { llenarPestanaSTD2_(sh, datosSTD_(periodo, 'treinta'), false); sh.setName(n + ' Dias'); }
    else if (tipo === 'licencias') {
      var cods = ['INJ', 'LSG', 'ENF', 'ART', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'DV', 'CAS', 'VAC', 'BAJA'];
      llenarGrilla_(sh, periodo, filas.filter(function (f) {
        return DIAS_COL.some(function (c) { var x = leerCelda_(f[c]); return x.tipo === 'codigo' && cods.indexOf(x.cod) >= 0; });
      }), 'INJUSTIFICADOS / LICENCIAS');
    } else llenarGrilla_(sh, periodo, filasDelPeriodo_(periodo, function (f) { return f.Seccion === 'EVENTO'; }), 'EVENTOS');
  }
  return exportarXlsx_(ss, nombre);
}

/* ============================================================
   CONFORMACIONES HORARIAS con los archivos de la empresa
   (Conformacion Horaria Servicios del 26 al 25 / del 01 al 31 / del 22 de Cada Mes)
   ============================================================ */
var CONF_MODELO_CLAVE = { '26-25': 'CONF_26_25_ID', '01-31': 'CONF_01_31_ID', '01-31-22': 'CONF_22_ID' };
MODELOS_POR_DEFECTO.CONF_26_25_ID = '1Blg4hlu-HvPyDbuoSyihKHcQARbCHXks';
MODELOS_POR_DEFECTO.CONF_01_31_ID = '1O4y7Ki7oWiI7xTTdn6Pt3wp9z6h4_zq8';
MODELOS_POR_DEFECTO.CONF_22_ID = '1nEzrvP6dvscYQsYfph5oph3vl_cao_TT';

// Llena una pestaña de servicio de la conformación (A fecha, B día, C/D contratado, I/J realizadas; el resto son sus fórmulas).
// Las empresas son LEG, LEGUYET, PPQ y KDE. El modelo trae la regla de color de "KTL" (nombre comercial del grupo):
// se agrega la misma regla para "KDE", con los mismos colores, para que la celda de la empresa se vea igual.
function reglaEmpresaKDE_(sh) {
  try {
    var reglas = sh.getConditionalFormatRules(), ktl = null, hay = false;
    reglas.forEach(function (r) {
      var b = r.getBooleanCondition(); if (!b) return;
      var v = String((b.getCriteriaValues() || [])[0] || '').toUpperCase();
      if (b.getCriteriaType() === SpreadsheetApp.BooleanCriteria.TEXT_CONTAINS && v === 'KTL') ktl = r;
      if (b.getCriteriaType() === SpreadsheetApp.BooleanCriteria.TEXT_CONTAINS && v === 'KDE') hay = true;
    });
    if (!ktl || hay) return;
    var b2 = ktl.getBooleanCondition(), nb = SpreadsheetApp.newConditionalFormatRule().whenTextContains('KDE').setRanges(ktl.getRanges());
    if (b2.getBackgroundObject && b2.getBackgroundObject()) nb.setBackgroundObject(b2.getBackgroundObject()); else if (b2.getBackground()) nb.setBackground(b2.getBackground());
    if (b2.getFontColorObject && b2.getFontColorObject()) nb.setFontColorObject(b2.getFontColorObject()); else if (b2.getFontColor()) nb.setFontColor(b2.getFontColor());
    if (b2.getBold() !== null) nb.setBold(b2.getBold());
    if (b2.getItalic() !== null) nb.setItalic(b2.getItalic());
    reglas.push(nb.build());
    sh.setConditionalFormatRules(reglas);
  } catch (e) { Logger.log('Regla KDE: ' + e.message); }
}

function llenarConformacion_(sh, serv, mes, conf, facturar) {
  var R = sh.getMaxRows(), colA = sh.getRange(1, 1, R, 1).getValues();
  var tot = -1;
  for (var r = 8; r < R; r++) if (normT_(colA[r][0]) === 'TOTALES') { tot = r + 1; break; }
  if (tot < 0) throw new Error('La pestaña "' + sh.getName() + '" no tiene la fila Totales.');
  var desde = 9, hay = tot - desde, n = conf.dias.length;
  if (n > hay) { sh.insertRowsBefore(tot, n - hay); tot += n - hay; }
  else if (n < hay) { sh.deleteRows(desde + n, hay - n); tot -= hay - n; }
  var y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  sh.getRange('A1').setValue(serv.Empresa || '');
  sh.getRange('I4').setValue(MESES_UP_[m - 1]); sh.getRange('K4').setValue(y);
  sh.getRange('A6').setValue(serv.Cliente || serv.Servicio);
  var vals = [], f1 = [], f2 = [];
  conf.dias.forEach(function (x, k) {
    var r2 = desde + k;
    // El día feriado dice "Feriado" (así el Excel lo pinta de azul, con su propia regla de colores).
    vals.push([new Date(x.fecha.getUTCFullYear(), x.fecha.getUTCMonth(), x.fecha.getUTCDate()), esFeriado_(x.fecha) ? 'Feriado' : DIAS_LARGO_[(x.fecha.getUTCDay() + 6) % 7], x.cD, x.cN]);
    // Adicionales = realizadas - contratadas, solo si da positivo (si da negativo no se pone)
    f1.push(['=+D' + r2 + '+C' + r2, '=MAX(0,I' + r2 + '-C' + r2 + ')', '=MAX(0,J' + r2 + '-D' + r2 + ')', '=+G' + r2 + '+F' + r2]);
    f2.push([x.rD + x.aD, x.rN + x.aN, '=+J' + r2 + '+I' + r2]);
  });
  // Mismo formato de fila para las filas agregadas
  if (n > 1) sh.getRange(desde, 1, 1, 11).copyTo(sh.getRange(desde + 1, 1, n - 1, 11), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange(desde, 1, n, 4).setValues(vals);
  sh.getRange(desde, 5, n, 4).setFormulas(f1);
  sh.getRange(desde, 9, n, 3).setValues(f2);
  // Sábado, Domingo y Feriado los pinta el propio archivo (formato condicional del modelo): no se toca el color.
  reglaEmpresaKDE_(sh);
  var colsT = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  sh.getRange(tot, 3, 1, 9).setFormulas([colsT.map(function (c) { return '=SUM(' + c + desde + ':' + c + (tot - 1) + ')'; })]);
  // Horas a facturar: las que se cargaron en la app (ventana de la conformación) o, si no, las realizadas.
  var hD = facturar && facturar.d !== '' ? Number(facturar.d) : null, hN = facturar && facturar.n !== '' ? Number(facturar.n) : null;
  if (hD !== null && !isNaN(hD)) sh.getRange(tot + 1, 10).setValue(hD / 24); else sh.getRange(tot + 1, 10).setFormula('=I' + tot + '/24');
  if (hN !== null && !isNaN(hN)) sh.getRange(tot + 2, 10).setValue(hN / 24); else sh.getRange(tot + 2, 10).setFormula('=J' + tot + '/24');
  return tot;
}

// Título de cada archivo de conformación, según el ciclo del servicio (sale del listado de Servicios).
var CONF_TITULO_ = { '01-31-22': 'Conformación Horaria del 22 de cada mes', '26-25': 'Conformación Horaria del 26 de cada mes', '01-31': 'Conformación Horaria de fin de mes' };

// Horas a facturar guardadas de un mes: { servicioId: { d, n } }
function facturarMes_(mes) {
  var out = {};
  leer_('Facturar').forEach(function (f) { if (f.Mes === mes) out[f.ServicioId] = { d: f.HorasD, n: f.HorasN, por: f.Usuario, fecha: f.Fecha }; });
  return out;
}

/**
 * Conformación con el archivo modelo de la empresa (mismas pestañas, colores y fórmulas).
 *   ciclo: '26-25' | '01-31' | '01-31-22'
 *   servicioId: una sola (opcional) · ids: lista de servicios elegidos (opcional)
 */
function libroConformacionModelo_(ciclo, mes, servicioId, ids, titulo) {
  var planilla = planillaMes_(mes);
  var servs = leer_('Servicios').filter(function (s) {
    if (servicioId) return s.Id === servicioId;
    if (ids && ids.length) return ids.indexOf(s.Id) >= 0 && (s.Ciclo || '26-25') === ciclo;
    return s.Activo !== 'NO' && (s.Ciclo || '26-25') === ciclo;
  });
  if (!servs.length) throw new Error('No hay servicios con ese ciclo.');
  if (servicioId) ciclo = servs[0].Ciclo || '26-25';
  var y = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7));
  var nombre = titulo || ((servicioId ? 'Conformación Horaria ' + servs[0].Servicio : (CONF_TITULO_[ciclo] || 'Conformación Horaria')) + ' - ' + MESES_UP_[m - 1] + ' ' + y);
  var ss = copiaModelo_(CONF_MODELO_CLAVE[ciclo] || 'CONF_26_25_ID', nombre);
  if (!ss) return null;
  var fact = facturarMes_(mes), ajustes = ajustesConf_(mes);
  var hojas = ss.getSheets();
  var totales = hojas.filter(function (h) { return normT_(h.getName()) === 'TOTALES'; })[0];
  var modelos = hojas.filter(function (h) { return h !== totales; });
  if (!modelos.length) throw new Error('La conformación modelo no tiene pestañas de servicio.');
  var clave = function (t) { return normT_(t).replace(/[^A-Z0-9]/g, ''); };
  // Empresa de cada pestaña modelo (de la pestaña Totales o de la celda A1), para copiar la de la misma empresa (mismos colores).
  var empTab = {};
  if (totales) {
    var tv = totales.getDataRange().getValues(), tf = totales.getDataRange().getFormulas(), cEmp = -1;
    for (var r0 = 0; r0 < Math.min(tv.length, 8) && cEmp < 0; r0++) for (var c0 = 0; c0 < tv[r0].length; c0++) if (normT_(tv[r0][c0]) === 'EMPRESA') { cEmp = c0; break; }
    if (cEmp >= 0) tf.forEach(function (fila, r) {
      var mm = fila.join(' ').match(/'((?:[^']|'')+)'!|=\+?([A-Za-z0-9_]+)!/);
      if (mm) empTab[clave((mm[1] || mm[2] || '').replace(/''/g, "'"))] = normT_(tv[r][cEmp]);
    });
  }
  modelos.forEach(function (h) { var a1 = normT_(h.getRange('A1').getValue()); if (a1 && !empTab[clave(h.getName())]) empTab[clave(h.getName())] = a1; });
  // 1) A cada servicio le toca su pestaña (si el modelo la tiene) o una copia de una pestaña de su misma empresa.
  var usadas = {}, asign = [];
  servs.forEach(function (s) {
    var sh = modelos.filter(function (h) { return !usadas[h.getName()] && (clave(h.getName()) === clave(s.Servicio) || clave(h.getName()) === clave(s.Cliente) || (typeof mismoNombre_ === 'function' && (mismoNombre_(h.getName(), s.Cliente) || mismoNombre_(h.getName(), s.Servicio)))); })[0];
    if (sh) usadas[sh.getName()] = 1;
    asign.push({ s: s, sh: sh || null });
  });
  asign.forEach(function (a) {
    if (a.sh) return;
    var emp = normT_(a.s.Empresa), tpl = modelos.filter(function (h) { return empTab[clave(h.getName())] === emp; })[0] || modelos[0];
    var copia = tpl.copyTo(ss), nom = nombreHoja_(a.s.Servicio).slice(0, 90), k = 2;
    while (ss.getSheetByName(nom)) nom = nombreHoja_(a.s.Servicio).slice(0, 85) + ' ' + (k++);
    copia.setName(nom);
    a.sh = copia; usadas[nom] = 1;
  });
  // 2) Se llenan las pestañas de los servicios.
  var filasTot = asign.map(function (a) {
    var conf = conformacionServicio_(a.s, mes, planilla, ajustes[a.s.Id] || null);
    var tot = llenarConformacion_(a.sh, a.s, mes, conf, fact[a.s.Id]);
    return { s: a.s, hoja: a.sh.getName(), tot: tot, aj: ajustes[a.s.Id] || {} };
  });
  // Orden de las pestañas igual al listado (Totales primero).
  filasTot.forEach(function (x, k) { var h = ss.getSheetByName(x.hoja); ss.setActiveSheet(h); ss.moveActiveSheet(k + (totales ? 2 : 1)); });
  if (totales && !servicioId) llenarTotalesConf_(totales, filasTot, ss);
  // 3) Recién ahora se borran las pestañas del modelo que no se usan (antes, Totales las necesita como molde).
  modelos.forEach(function (h) { if (!usadas[h.getName()] && ss.getSheets().length > 1) ss.deleteSheet(h); });
  if (totales && servicioId && ss.getSheets().length > 1) ss.deleteSheet(totales);
  if (totales && !servicioId) { ss.setActiveSheet(totales); ss.moveActiveSheet(1); }
  return exportarXlsx_(ss, nombre);
}

// Pestaña Totales: se usan las filas del propio modelo (fórmulas y colores alternados) y se cambia solo la pestaña a la que apuntan.
function llenarTotalesConf_(totales, filasTot, ss) {
  var R = totales.getLastRow(), W = Math.max(1, Math.min(totales.getLastColumn(), 26));
  var v = totales.getRange(1, 1, R, W).getValues(), f = totales.getRange(1, 1, R, W).getFormulas();
  var hdr = -1, cCli = -1, cEmp = -1;
  for (var r = 0; r < Math.min(R, 8); r++) for (var c = 0; c < W; c++) {
    var t = normT_(v[r][c]);
    if (t === 'CLIENTE' || t === 'SERVICIO') { hdr = r; cCli = c; }
    if (t === 'EMPRESA') { cEmp = c; if (hdr < 0) hdr = r; }
  }
  if (cCli < 0) cCli = cEmp > 0 ? cEmp - 1 : 0;
  var datos = [];
  for (var r2 = hdr + 1; r2 < R; r2++) {
    if (f[r2].some(function (x) { return /!/.test(x); })) datos.push(r2);
    else if (datos.length) break;
  }
  if (!datos.length) return;
  var ini = datos[0] + 1, hay = datos.length, need = filasTot.length;
  var t0 = ini, f0 = f[datos[0]], v0 = v[datos[0]];
  // Fila "Totales" de la pestaña a la que apunta la fila molde (las referencias se corren lo mismo para cada servicio).
  var tTot = 0;
  try {
    var mm = f0.join(' ').match(/'((?:[^']|'')+)'!|([A-Za-z0-9_\.]+)!/);
    var shT = mm && ss ? ss.getSheetByName((mm[1] || mm[2]).replace(/''/g, "'")) : null;
    if (shT) { var colA = shT.getRange(1, 1, shT.getMaxRows(), 1).getValues(); for (var q = 8; q < colA.length; q++) if (normT_(colA[q][0]) === 'TOTALES') { tTot = q + 1; break; } }
  } catch (e) { tTot = 0; }
  var bg0 = totales.getRange(t0, 1, 1, W).getBackgrounds()[0];
  var bg1 = hay > 1 ? totales.getRange(t0 + 1, 1, 1, W).getBackgrounds()[0] : bg0;
  if (need > hay) totales.insertRowsAfter(ini, need - hay);          // dentro del rango: las sumas de abajo se agrandan solas
  else if (need < hay) totales.deleteRows(ini + need, hay - need);
  if (need > 1) totales.getRange(t0, 1, 1, W).copyTo(totales.getRange(ini + 1, 1, need - 1, W), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  var hojaRef = function (h) { return "'" + h.replace(/'/g, "''") + "'"; };
  // Corre las referencias de la misma fila (=+D4+C4 -> =+D7+C7) sin tocar lo que está entre comillas (nombres de pestañas).
  var correrFila = function (fo, fila) {
    return fo.split(/('(?:[^']|'')*')/).map(function (seg, i) {
      if (i % 2 === 1) return seg;
      return seg.replace(/(^|[^A-Za-z0-9_!'$\.])(\$?[A-Z]{1,2})(\$?)(\d+)(?![\d(!A-Za-z_])/g, function (all, pre, col, d, row) { return Number(row) === t0 ? pre + col + d + fila : all; });
    }).join('');
  };
  // Columnas que se completan a mano (Custodia / Custodio, Bunker): van los valores cargados en la app
  var cCus = -1, cBun = -1;
  for (var hr = Math.max(0, hdr); hr <= Math.min(R - 1, hdr + 1); hr++) for (var hc = 0; hc < W; hc++) {
    var ht = normT_(v[hr][hc]);
    if (cCus < 0 && /CUSTOD/.test(ht)) cCus = hc;
    if (cBun < 0 && /BUNKER/.test(ht)) cBun = hc;
  }
  var celdas = [], fondos = [];
  filasTot.forEach(function (x, k) {
    var fila = ini + k, out = [];
    for (var c = 0; c < W; c++) {
      if (c === cCli) { out.push(x.s.Cliente || x.s.Servicio); continue; }
      if (c === cEmp) { out.push(x.s.Empresa || ''); continue; }
      var fo = f0[c];
      // Lo escrito a mano en el renglón molde (por ejemplo =465*2 o 176 de Custodio/Bunker) no se repite: queda vacío para completar.
      if (fo && !/[A-Z]{1,2}\$?\d+/.test(fo.replace(/'(?:[^']|'')*'/g, ''))) fo = '';
      if (fo) {
        fo = correrFila(fo, fila).replace(/('(?:[^']|'')+'|[A-Za-z0-9_\.]+)!(\$?[A-Z]{1,2})\$?(\d+)/g, function (_, h, col, row) {
          return hojaRef(x.hoja) + '!' + col + (tTot ? x.tot + (Number(row) - tTot) : x.tot);
        });
        out.push(fo);
      } else if (typeof v0[c] === 'number' && c < cCli) out.push(k + 1);   // número de orden
      else out.push(typeof v0[c] === 'number' ? '' : (v0[c] === '' || f0[c] ? '' : v0[c]));
    }
    if (cCus >= 0) out[cCus] = x.aj && x.aj.custodia !== undefined && x.aj.custodia !== '' ? Number(String(x.aj.custodia).replace(',', '.')) || '' : '';
    if (cBun >= 0) out[cBun] = x.aj && x.aj.bunker !== undefined && x.aj.bunker !== '' ? Number(String(x.aj.bunker).replace(',', '.')) || '' : '';
    celdas.push(out);
    fondos.push(k % 2 ? bg1 : bg0);
  });
  totales.getRange(ini, 1, need, W).setValues(celdas);   // los textos que empiezan con "=" quedan como fórmulas
  totales.getRange(ini, 1, need, W).setBackgrounds(fondos);
  // Sumas de abajo: que tomen todas las filas (si el modelo tenía una sola fila de servicio, no se agrandan solas).
  var fin = ini + need - 1, abajo = Math.min(4, totales.getMaxRows() - fin);
  if (abajo > 0) {
    var rg = totales.getRange(fin + 1, 1, abajo, W), fs = rg.getFormulas(), cambio = false;
    fs = fs.map(function (fila) {
      return fila.map(function (fo) {
        if (!fo) return fo;
        var nf = fo.replace(/(\$?[A-Z]{1,2}\$?)(\d+):(\$?[A-Z]{1,2}\$?)(\d+)/g, function (all, c1, a, c2, b) {
          return Number(a) === ini && Number(b) >= ini && Number(b) < fin ? c1 + a + ':' + c2 + fin : all;
        });
        if (nf !== fo) cambio = true;
        return nf;
      });
    });
    if (cambio) fs.forEach(function (fila, k) { fila.forEach(function (fo, c) { if (fo) totales.getRange(fin + 1 + k, c + 1).setFormula(fo); }); });
  }
}

/* ============================================================
   PLANIFICACIÓN COMPLETA (copia del archivo de la empresa)
   ============================================================
   Se copia el archivo "Planificación" entero y SOLO se escriben las celdas de carga:
     - Datos: período y la lista de días.
     - Personal: el personal de SGI (las columnas de fórmulas e indumentaria quedan como están).
     - Cada pestaña de servicio: personas, puesto y los días D/N de Cobertura y de Instrucción/Retén,
       y la fila "Horas Contratadas" de cada día.
     - STD y 30/31 Dias (en el original se pegan como valores), Plus Encargado,
       Injustificados y Licencias, Enevtos.
   Todo lo demás (Facturacion, Consolidado, totales, diferencias, fórmulas) se calcula solo
   con las fórmulas del propio archivo, igual que en Excel.
   ============================================================ */

// Pestañas de servicio: tienen "Apellido y Nombre" en la fila 10 (columna E).
function pestanasServicio_(ss) {
  return ss.getSheets().filter(function (sh) {
    try { return normT_(sh.getRange('E10').getValue()) === 'APELLIDO Y NOMBRE' && !/INJUSTIF|ENEVTOS|EVENTOS/i.test(sh.getName()); } catch (e) { return false; }
  });
}

// Busca la pestaña de cada servicio de la app: por el campo Pestaña del servicio, por el nombre de la pestaña o por el cliente (celda B5).
function mapaPestanas_(ss, servicios) {
  var tabs = pestanasServicio_(ss).map(function (sh) { return { sh: sh, nom: sh.getName(), cli: String(sh.getRange('B5').getDisplayValue() || '') }; });
  var k = function (t) { return normT_(t).replace(/[^A-Z0-9]/g, ''); };
  var usadas = {}, mapa = {};
  servicios.forEach(function (s) {
    var cand = tabs.filter(function (t) { return !usadas[t.nom] && s.Pestana && k(t.nom) === k(s.Pestana); })[0] ||
      tabs.filter(function (t) { return !usadas[t.nom] && (k(t.nom) === k(s.Servicio) || k(t.cli) === k(s.Cliente) || k(t.cli) === k(s.Servicio)); })[0] ||
      tabs.filter(function (t) { return !usadas[t.nom] && k(t.cli) && (k(s.Cliente).indexOf(k(t.cli)) >= 0 || k(t.cli).indexOf(k(s.Cliente)) >= 0); })[0];
    if (cand) { usadas[cand.nom] = 1; mapa[s.Id] = cand.sh; }
  });
  return { mapa: mapa, sinUsar: tabs.filter(function (t) { return !usadas[t.nom]; }).map(function (t) { return t.sh; }) };
}

// Escribe una sección (cobertura o retén) de una pestaña de servicio.
function llenarSeccionTab_(sh, hdr, filas, ctx, diasCols) {
  var R = sh.getMaxRows(), colB = sh.getRange(hdr + 1, 2, Math.min(80, R - hdr), 1).getValues();
  var k = 0; while (k < colB.length && typeof colB[k][0] === 'number') k++;
  var desde = hdr + 1, hay = k;
  if (!hay) return 0;
  if (filas.length > hay) {
    var extra = filas.length - hay;
    sh.insertRowsAfter(desde, extra);                       // dentro del rango: los SUM de abajo se agrandan solos
    sh.getRange(desde, 1, 1, sh.getMaxColumns()).copyTo(sh.getRange(desde + 1, 1, extra, sh.getMaxColumns()));
    hay = filas.length;
    var ord = []; for (var o = 0; o < hay; o++) ord.push([o + 1]);
    sh.getRange(desde, 2, hay, 1).setValues(ord);
  }
  var ef = [], dias = [];
  for (var i = 0; i < hay; i++) {
    var f = filas[i];
    ef.push(f ? [f.Nombre, f.Puesto || (f.Seccion === 'RETEN' ? 'Reten' : '')] : ['', '']);
    var x = f ? estadisticasFila_(f, ctx) : null, row = [];
    diasCols.forEach(function (dc, j) { row.push(x ? x.dias[j][0] : '', x ? (x.dias[j][1] === 0 ? '' : x.dias[j][1]) : ''); });
    dias.push(row);
  }
  sh.getRange(desde, 5, hay, 2).setValues(ef);
  // Los días van en pares D/N seguidos desde la primera columna "D"
  sh.getRange(desde, diasCols[0] + 1, hay, diasCols.length * 2).setValues(dias);
  return hay;
}

function llenarTabServicio_(sh, serv, filas, ctx) {
  var W = Math.min(sh.getMaxColumns(), 120), R = sh.getMaxRows();
  var colsBE = sh.getRange(1, 2, R, 4).getValues(); // B..E
  var hdrs = [], filaContr = -1;
  for (var r = 0; r < R; r++) {
    if (normT_(colsBE[r][3]) === 'APELLIDO Y NOMBRE') hdrs.push(r + 1);
    if (filaContr < 0 && /^HORAS CONTRATADA/.test(normT_(colsBE[r][0]))) filaContr = r + 1;
  }
  if (!hdrs.length) return;
  var h1 = sh.getRange(hdrs[0], 1, 1, W).getValues()[0], diasCols = [];
  for (var c = 0; c < W - 1 && diasCols.length < 31; c++) if (normT_(h1[c]) === 'D' && normT_(h1[c + 1]) === 'N') diasCols.push(c);
  if (!diasCols.length) return;
  var cob = filas.filter(function (f) { return f.Seccion !== 'RETEN' && f.Seccion !== 'EVENTO'; });
  var ret = filas.filter(function (f) { return f.Seccion === 'RETEN'; });
  // Primero la sección de abajo (así no se corren las filas de la de arriba)
  if (hdrs[1]) llenarSeccionTab_(sh, hdrs[1], ret, ctx, diasCols);
  llenarSeccionTab_(sh, hdrs[0], cob, ctx, diasCols);
  // Horas contratadas de cada día
  if (filaContr > 0 && serv) {
    // la fila puede haberse corrido si se agregaron filas de cobertura
    var colB2 = sh.getRange(1, 2, sh.getMaxRows(), 1).getValues();
    for (var q = hdrs[0]; q < colB2.length; q++) if (/^HORAS CONTRATADA/.test(normT_(colB2[q][0]))) { filaContr = q + 1; break; }
    var cr = [];
    diasCols.forEach(function (dc, j) {
      if (j >= ctx.n) { cr.push('', ''); return; }
      var ct = contratadoDia_(serv, fechaDia_(ctx.periodo, j));
      if (sinDiferencia_(serv)) {   // v1.22.8: contratado = realizado
        ct = { d: 0, n: 0 };
        cob.forEach(function (f) { var c = leerCelda_(f[DIAS_COL[j]]); if (c.tipo === 'horas') { ct.d += c.d; ct.n += c.n; } });
      }
      cr.push(ct.d, ct.n);
    });
    sh.getRange(filaContr, diasCols[0] + 1, 1, cr.length).setValues([cr]);
  }
  ajustarColumnasDias_(sh, diasCols, ctx.n);
}

// Pestaña Personal de la Planificación: A..I y O desde SGI; fórmulas J..N; indumentaria se conserva por legajo.
// Pestaña Personal de la Planificación: el listado de SGI, conservando lo que el modelo ya tenía de cada legajo
// (categoría, indumentaria y demás columnas de la derecha). Así funcionan las búsquedas (Empresa, Legajo, Cat.) de las pestañas de servicio.
function llenarPersonalPlan_(sh) {
  var W = sh.getMaxColumns(), R = sh.getMaxRows();
  var hdr = sh.getRange(1, 1, 3, Math.min(W, 5)).getValues(), fh = -1;
  for (var r = 0; r < 3; r++) if (normT_(hdr[r][0]).indexOf('APELLIDO') === 0) { fh = r + 1; break; }
  if (fh < 0) return;
  var ini = fh + 1, viejo = R >= ini ? sh.getRange(ini, 1, R - ini + 1, W).getValues() : [], porLeg = {};
  viejo.forEach(function (row) { var l = String(row[1] || '').replace(/\.0$/, '').trim(); if (l) porLeg[l] = row; });
  var fichas = fichasSGI_(), lista = personalSGI_(), vistos = {};
  var fecha = function (t) { var d = parseFechaSGI_(t); return d || (t || ''); };
  var filas = lista.map(function (p) {
    var leg = String(p.Legajo || '').trim(), fi = fichas[leg] || {}, ant = porLeg[leg], row = new Array(W).fill('');
    vistos[leg] = 1;
    if (ant) for (var j = 0; j < W; j++) row[j] = ant[j];
    row[0] = String(p.Nombre || '').toUpperCase(); row[1] = Number(leg) || leg; row[2] = p.Empresa || (ant ? ant[2] : '');
    var cat = String(fi.Categoria || '').trim();
    if (!ant || !ant[3]) row[3] = normT_(cat) === 'BAJA' ? '' : cat;      // la categoría del modelo no se cambia
    row[4] = p.Estado === 'Baja' ? 'BAJA' : 'Activo';
    if (fi.Cuil) row[5] = fi.Cuil;
    if (fi.Dni) row[6] = Number(fi.Dni) || fi.Dni;
    if (fi.Nacimiento) row[7] = fecha(fi.Nacimiento);
    if (fi.Ingreso) row[8] = fecha(fi.Ingreso);
    return row;
  });
  // Los que estaban en el modelo y ya no figuran en SGI se conservan (pueden aparecer en períodos viejos)
  Object.keys(porLeg).forEach(function (l) { if (!vistos[l]) filas.push(porLeg[l]); });
  filas.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });
  filas.forEach(function (row, i) {
    var rr = ini + i;
    if (W > 13) {
      row[9] = '=TODAY()'; row[10] = '=IFERROR(DATEDIF(H' + rr + ',J' + rr + ',"y"),"")'; row[11] = '=IFERROR(DATEDIF(H' + rr + ',J' + rr + ',"YM"),"")';
      row[12] = '=IFERROR(DATEDIF(I' + rr + ',J' + rr + ',"y"),"")'; row[13] = '=IFERROR(DATEDIF(I' + rr + ',J' + rr + ',"YM"),"")';
    }
  });
  if (!filas.length) throw new Error('El listado de personal de SGI vino vacío: no se tocó la pestaña Personal.');
  if (filas.length > R - ini + 1) sh.insertRowsAfter(R, filas.length - (R - ini + 1));
  sh.getRange(ini, 1, sh.getMaxRows() - ini + 1, W).clearContent();
  sh.getRange(ini, 1, filas.length, W).setValues(filas);
}

/**
 * opts: { servicios: [ids] (solo esas pestañas, pasadas a valores), extra: function(ss) }
 * Devuelve { r: salida, avisos: [] }
 */
function libroPlanificacion_(periodo, opts) {
  opts = opts || {};
  var nombre = opts.nombre || ('Planificacion ' + nombrePeriodo_(periodo));
  var ss = copiaModelo_('PLANTILLA_ID', nombre);
  if (!ss) throw new Error('Falta la planilla modelo de Planificación (Datos > Planillas modelo).');
  var avisos = [], ctx = contextoInforme_(periodo);
  var datos = ss.getSheetByName('Datos'); if (datos) llenarDatos_(datos, periodo);
  var pers = ss.getSheetByName('Personal'); if (pers) { try { llenarPersonalPlan_(pers); } catch (e) { avisos.push('Personal: ' + e.message); } }
  var todas = filasDelPeriodo_(periodo);
  var servicios = leer_('Servicios').filter(function (s) {
    return opts.servicios ? opts.servicios.indexOf(s.Id) >= 0 : (s.Activo !== 'NO' || todas.some(function (f) { return f.ServicioId === s.Id; }));
  });
  var m = mapaPestanas_(ss, servicios);
  servicios.forEach(function (s) {
    var sh = m.mapa[s.Id];
    if (!sh) { avisos.push('Sin pestaña en la Planificación: ' + s.Servicio + ' (poné el nombre de la pestaña en Servicios).'); return; }
    try { llenarTabServicio_(sh, s, todas.filter(function (f) { return f.ServicioId === s.Id; }), ctx); compactarEncabezado_(sh); }
    catch (e) { avisos.push(sh.getName() + ': ' + e.message); }
  });
  // Pestañas de servicios que la app no tiene: quedan sin personas (se conserva su formato y su contratado)
  if (!opts.servicios) m.sinUsar.forEach(function (sh) { try { llenarTabServicio_(sh, null, [], ctx); } catch (e) { } });
  var sinEv = todas.filter(function (f) { return f.Seccion !== 'EVENTO'; });
  var porApe = sinEv.slice().sort(function (a, b) { return String(a.Nombre).localeCompare(String(b.Nombre)); });
  ss.getSheets().forEach(function (sh) {
    var nom = sh.getName();
    try {
      if (/^STD$/i.test(nom)) {
        var dStd = datosSTD_(periodo, 'std');
        if (opts.servicios) dStd.items = dStd.items.filter(function (it) { return opts.servicios.indexOf(it.f.ServicioId) >= 0; });
        llenarPestanaSTD2_(sh, dStd, false);
      }
      else if (/^CONSOLIDADO$/i.test(nom) && !opts.servicios) llenarPestanaSTD2_(sh, datosSTD_(periodo, 'consolidado'), true);
      else if (/^\d+\s*DIAS/i.test(nom)) { llenarPestanaSTD2_(sh, datosSTD_(periodo, 'treinta'), false); sh.setName(nom.replace(/^\d+/, ctx.n)); }
      else if (/^PLUS/i.test(nom)) llenarPlus_(sh, periodo);
      else if (/^INJUSTIF/i.test(nom)) {
        var cods = ['INJ', 'LSG', 'ENF', 'ART', 'SUS', 'NAC', 'MAT', 'FALL', 'RES', 'DV', 'CAS', 'VAC', 'BAJA'];
        llenarGrilla_(sh, periodo, sinEv.filter(function (f) { return DIAS_COL.some(function (c) { var x = leerCelda_(f[c]); return x.tipo === 'codigo' && cods.indexOf(x.cod) >= 0; }); }), 'INJUSTIFICADOS / LICENCIAS');
      } else if (/^ENEVTOS|^EVENTOS/i.test(nom)) llenarGrilla_(sh, periodo, todas.filter(function (f) { return f.Seccion === 'EVENTO'; }), 'EVENTOS');
    } catch (e) { avisos.push(nom + ': ' + e.message); }
  });
  var fac = ss.getSheetByName('Facturacion'); if (fac) compactarEncabezado_(fac);
  SpreadsheetApp.flush();
  if (opts.servicios) {
    // Archivo para un servicio o una zona: las pestañas que quedan pasan a valores (para que no dependan de las borradas)
    var quedan = opts.servicios.map(function (id) { return m.mapa[id]; }).filter(Boolean).map(function (sh) { return sh.getName(); });
    if (opts.conSTD) quedan.push('STD');
    ss.getSheets().forEach(function (sh) {
      if (quedan.indexOf(sh.getName()) >= 0) { var rg = sh.getDataRange(); rg.copyTo(rg, { contentsOnly: true }); }
    });
    soloPestanas_(ss, quedan);
    if (opts.extra) opts.extra(ss);
  }
  return { r: exportarXlsx_(ss, nombre), avisos: avisos };
}

/* ============================================================
   FICHA DE UNA PERSONA EN UN PERÍODO (administración)
   Todo lo de la persona en el período, día por día y unificado (todos sus servicios),
   con los mismos cálculos del STD (horas a liquidar, extras, estados, feriados trabajados).
   ============================================================ */
function fichaPersona_(periodo, legajo, nombre) {
  var ctx = contextoInforme_(periodo), leg = String(legajo || '').trim(), nom = normT_(nombre || '');
  var es = function (f) {
    if (leg && String(f.Legajo || '').trim() === leg) return true;
    return nom && normT_(f.Nombre) === nom && (!leg || !f.Legajo);
  };
  var filas = planillaPeriodo_(periodo).filter(es);
  var dias = [];
  for (var i = 0; i < ctx.n; i++) {
    var fd = fechaDia_(periodo, i);
    dias.push({ fecha: iso_(fd), dia: DIAS_NOMBRE_[(fd.getUTCDay() + 6) % 7], feriado: esFeriado_(fd) || '', items: [] });
  }
  var S = { D: 0, N: 0, iD: 0, iN: 0, rD: 0, rN: 0, est: {} }, servicios = [], empresa = '', nombreReal = nombre;
  filas.forEach(function (f) {
    var s = ctx.servs[f.ServicioId] || {}, x = estadisticasFila_(f, ctx);
    empresa = empresa || f.Empresa; nombreReal = f.Nombre || nombreReal; leg = leg || f.Legajo;
    var puesto = f.Puesto || (f.Seccion === 'RETEN' ? 'Retén' : f.Seccion === 'EVENTO' ? 'Eventual' : '');
    servicios.push({ servicio: s.Servicio || f.ServicioId, cliente: s.Cliente || '', puesto: puesto, seccion: f.Seccion, supervisor: ctx.nomSup[String(s.Supervisor || '').toLowerCase()] || s.Supervisor || '',
      D: x.D, N: x.N, iD: x.iD, iN: x.iN, rD: x.rD, rN: x.rN });
    ['D', 'N', 'iD', 'iN', 'rD', 'rN'].forEach(function (k) { S[k] += x[k]; });
    for (var j = 0; j < ctx.n; j++) {
      var v = f[DIAS_COL[j]];
      if (!v) continue;
      var c = leerCelda_(v);
      dias[j].items.push({ servicio: s.Servicio || '', puesto: puesto, seccion: f.Seccion, valor: valorBase_(v), nota: notaDe_(v),
        tipo: c.tipo, d: c.tipo === 'horas' ? c.d : 0, n: c.tipo === 'horas' ? c.n : 0, color: c.color || '' });
    }
  });
  // Resumen unificado (un día cuenta una vez aunque haya trabajado en dos servicios)
  var trab = 0, ferTrab = 0, aus = 0, sinDato = 0;
  dias.forEach(function (d) {
    var horas = d.items.some(function (x) { return x.tipo === 'horas'; });
    if (horas) { trab++; if (d.feriado) ferTrab++; }
    if (!d.items.length) sinDato++;
    d.items.forEach(function (x) {
      if (x.tipo !== 'codigo') return;
      var k = x.valor === 'F' ? 'FCO' : x.valor;
      S.est[k] = (S.est[k] || 0) + 1;
      if (COD_AUSENTISMO_.indexOf(x.valor) >= 0) aus++;
    });
  });
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var tot = S.D + S.N, de = S.iD + S.iN + S.rD + S.rN, liq = tot + de;
  var he = horasExtras_(tot, aus, ctx.n), normales = he.normales;   // v1.22.10: como el Consolidado
  var ficha = ctx.fichas[leg] || {}, sgi = (personalSGI_().filter(function (p) { return String(p.Legajo) === String(leg); })[0]) || {};
  var plus = leer_('Plus').filter(function (p) { return p.Periodo === periodo && (leg ? String(p.Legajo) === String(leg) : normT_(p.Nombre) === nom); })
    .map(function (p) { return { funcion: p.Funcion, dias: p.Dias, servicio: (ctx.servs[p.ServicioId] || {}).Servicio || '', obs: p.Observaciones }; });
  var info = periodoInfo_(periodo);
  return {
    persona: { Nombre: nombreReal || sgi.Nombre || nombre, Legajo: leg, Empresa: empresa || sgi.Empresa || '', Categoria: ficha.Categoria || sgi.Categoria || '', Estado: sgi.Estado || '',
      Dni: ficha.Dni || '', Cuil: ficha.Cuil || '', Ingreso: ficha.Ingreso || '' },
    periodo: periodo, nombrePeriodo: nombrePeriodo_(periodo), desde: iso_(info.desde), hasta: iso_(info.hasta),
    dias: dias, servicios: servicios, plus: plus,
    resumen: { diurnas: r2(S.D), nocturnas: r2(S.N), total: r2(tot), instrD: r2(S.iD), instrN: r2(S.iN), retenD: r2(S.rD), retenN: r2(S.rN), de: r2(de),
      liquidar: r2(liq), normales: r2(normales), extras: he.extras, nocturnasTot: r2(S.N + S.iN + S.rN), diferencia: he.dif,
      hsAusentismo: he.hsAus, trabVsNor: he.tvn, productividad: Math.round(liq / HS_BASE_PERIODO * 10000) / 10000,
      trabajados: trab, feriadosTrab: ferTrab, ausentismo: aus, sinDato: sinDato,
      totalDias: trab + Object.keys(S.est).reduce(function (a, k) { return a + (k === 'DV' ? 0 : S.est[k]); }, 0), diasPeriodo: ctx.n, estados: S.est, base: HS_BASE_PERIODO }
  };
}

// La ficha en PDF (el HTML lo arma la app, igual al que se ve en pantalla).
function fichaPdf_(html, nombre) {
  var doc = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1d2a3a;margin:18px}h1{font-size:16px;margin:0 0 4px}h2{font-size:12px;margin:12px 0 4px}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d1dc;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eef2f7}' +
    '.n{text-align:right}.fin{background:#f3f7e9}.fer{color:#0b3fd6;font-weight:bold}.k{font-weight:bold}.grid{display:block}.dato{display:inline-block;margin:0 14px 4px 0}' +
    '.noche{background:#d9d9d9}.tarde{background:#ddebf7}.cod{font-weight:bold}.sub{color:#55606e}' +
    '</style></head><body>' + html + '</body></html>';
  var pdf = Utilities.newBlob(doc, 'text/html', 'ficha.html').getAs('application/pdf');
  var n = String(nombre || 'Ficha').replace(/[\\/:*?"<>|]/g, ' ') + '.pdf';
  return { nombre: n, base64: Utilities.base64Encode(pdf.getBytes()) };
}

/* ============================================================
   CONTROL DE CIERRE DEL PERÍODO (antes de pasar las novedades a RRHH)
   El STD, el Consolidado y el 30/31 días salen de las mismas planillas: se controla
   el personal informado contra el listado de personal de SGI.
   ============================================================ */
function controlCierre_(periodo) {
  var n = periodoInfo_(periodo).n, servs = {};
  leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  var pl = planillaPeriodo_(periodo).filter(function (f) { return f.Nombre || f.Legajo; });
  // v1.22.7: el legajo se repite entre empresas (el 70 de LE GUYET no es el 70 de PPQ): la persona se busca por
  // legajo + empresa, después por legajo + nombre; nunca solo por legajo si hay más de uno con ese número.
  var personal = personalSGI_(), porLeg = {}, porNom = {};
  personal.forEach(function (p) { var l = String(p.Legajo).trim(); (porLeg[l] = porLeg[l] || []).push(p); porNom[normT_(p.Nombre)] = p; });
  var buscar = function (g) {
    var c = g.Legajo ? (porLeg[String(g.Legajo).trim()] || []) : [];
    var e = g.Empresa ? empClave_(g.Empresa) : '';
    var x = e && c.filter(function (p) { return empClave_(p.Empresa) === e; });
    if (x && x.length === 1) return x[0];
    if (x && x.length > 1) { var y = x.filter(function (p) { return mismaPersonaNombre_(p.Nombre, g.Nombre) || normT_(p.Nombre) === normT_(g.Nombre); }); return y[0] || x[0]; }
    var n = c.filter(function (p) { return mismaPersonaNombre_(p.Nombre, g.Nombre) || normT_(p.Nombre) === normT_(g.Nombre); });
    if (n.length) return n[0];
    if (c.length === 1 && !e) return c[0];
    // Por nombre (sin legajo, o con el legajo de otra persona)
    var pn = porNom[normT_(g.Nombre)];
    return pn && (!e || empClave_(pn.Empresa) === e || !g.Legajo) ? pn : (c.length === 1 ? c[0] : null);
  };
  var gente = {};
  pl.forEach(function (f) {
    var k = f.Legajo ? 'L' + String(f.Legajo).trim() + '|' + (f.Empresa ? empClave_(f.Empresa) : normT_(f.Nombre).split(' ')[0]) : 'N' + normT_(f.Nombre);
    var g = gente[k] = gente[k] || { Legajo: f.Legajo, Nombre: f.Nombre, Empresa: f.Empresa, servicios: [], dias: [] };
    g.servicios.push((servs[f.ServicioId] || {}).Servicio || f.ServicioId);
    for (var i = 0; i < n; i++) {
      var v = f[DIAS_COL[i]];
      if (!v) continue;
      var c = leerCelda_(v);
      (g.dias[i] = g.dias[i] || []).push({ c: c, serv: (servs[f.ServicioId] || {}).Servicio || '' });
    }
  });
  var ddmm = function (i) { var d = fechaDia_(periodo, i); return ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2); };
  var out = { noEnListado: [], empresaDistinta: [], bajaConHoras: [], sinInformar: [], diasSinDato: [], dobleCarga: [], informados: 0 };
  Object.keys(gente).forEach(function (k) {
    var g = gente[k], p = buscar(g);
    if (p) g.p = p;
    out.informados++;
    var base = { Legajo: g.Legajo, Nombre: g.Nombre, Empresa: g.Empresa, Servicios: g.servicios.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') };
    if (!p) out.noEnListado.push(Object.assign({ Detalle: g.Legajo ? 'El legajo ' + g.Legajo + (g.Empresa ? ' de ' + g.Empresa : '') + ' no está en el listado' : 'Sin legajo' + (porNom[normT_(g.Nombre)] ? ' (en el listado figura con legajo ' + porNom[normT_(g.Nombre)].Legajo + ')' : '') }, base));
    else {
      if (p.Empresa && g.Empresa && empClave_(p.Empresa) !== empClave_(g.Empresa)) out.empresaDistinta.push(Object.assign({ Detalle: 'En la planilla: ' + g.Empresa + ' · En el listado: ' + p.Empresa }, base));
      // v1.22.7: "De baja y con horas" solo en el período en curso (en los anteriores ya no se corrige nada)
      var conHoras = g.dias.some(function (d) { return d && d.some(function (x) { return x.c.tipo === 'horas'; }); });
      if (p.Estado === 'Baja' && conHoras && periodo === periodoActualServidor_()) out.bajaConHoras.push(Object.assign({ Detalle: 'Figura de baja en el listado y tiene horas en el período' }, base));
    }
    var vacios = [];
    for (var i = 0; i < n; i++) if (!g.dias[i] || !g.dias[i].length) vacios.push(ddmm(i));
    if (vacios.length) out.diasSinDato.push(Object.assign({ Detalle: vacios.length + ' día' + (vacios.length === 1 ? '' : 's') + ' sin dato: ' + vacios.slice(0, 12).join(', ') + (vacios.length > 12 ? '…' : '') }, base));
    var dobles = [];
    for (var j = 0; j < n; j++) {
      var h = (g.dias[j] || []).filter(function (x) { return x.c.tipo === 'horas'; });
      var tot = h.reduce(function (a, x) { return a + x.c.h; }, 0);
      if (h.length > 1 && tot > 24) dobles.push(ddmm(j) + ' (' + tot + ' hs: ' + h.map(function (x) { return x.serv; }).join(' + ') + ')');
    }
    if (dobles.length) out.dobleCarga.push(Object.assign({ Detalle: dobles.slice(0, 6).join(' · ') + (dobles.length > 6 ? '…' : '') }, base));
  });
  var informados = [];
  Object.keys(gente).forEach(function (k) { if (gente[k].p) informados.push(gente[k].p); });
  personal.forEach(function (p) {
    if (p.Estado === 'Baja' || informados.indexOf(p) >= 0) return;
    out.sinInformar.push({ Legajo: p.Legajo, Nombre: p.Nombre, Empresa: p.Empresa, Servicios: '', Detalle: 'Activo en el listado y no figura en ninguna planilla del período' });
  });
  out.periodo = periodo; out.nombrePeriodo = nombrePeriodo_(periodo); out.activosListado = personal.filter(function (p) { return p.Estado !== 'Baja'; }).length;
  out.conDatos = pl.length > 0;
  return out;
}

/* ============================================================
   v1.23.1: PROYECCIÓN DE SERVICIO NUEVO -> Excel con el formato de la Planificación
   Se usa una pestaña de servicio del modelo como molde y se llena con las filas y el contratado de la proyección.
   ============================================================ */
function accionSimExcel_(u, d) {
  if (!esAdmin_(u)) throw new Error('Solo administración.');
  var periodo = d.periodo, nomServ = String(d.nombre || 'Servicio nuevo').trim();
  var nombre = 'Proyección - ' + nomServ + ' - ' + nombrePeriodo_(periodo);
  var ss = copiaModelo_('PLANTILLA_ID', nombre);
  if (!ss) throw new Error('Falta la planilla modelo de Planificación (Datos > Planillas modelo).');
  var ctx = contextoInforme_(periodo);
  var datos = ss.getSheetByName('Datos'); if (datos) llenarDatos_(datos, periodo);
  var tabs = pestanasServicio_(ss);
  if (!tabs.length) throw new Error('El modelo de Planificación no tiene pestañas de servicio para usar de molde.');
  var sh = tabs[0];
  var serv = {}; Object.keys(d.serv || {}).forEach(function (k) { serv[k] = d.serv[k]; });
  serv.Id = 'SIM'; serv.SinDiferencia = 'NO';
  // horas contratadas de cada día: las de la proyección (también las cambiadas a mano)
  if (!CONTR_DIA_) CONTR_DIA_ = {};
  Object.keys(d.contr || {}).forEach(function (iso) { var c = d.contr[iso] || {}; CONTR_DIA_['SIM|' + iso] = { d: Number(c.d) || 0, n: Number(c.n) || 0 }; });
  var filas = (d.filas || []).map(function (f, k) {
    var o = {}; HOJAS.Planilla.forEach(function (c) { o[c] = f[c] === undefined || f[c] === null ? '' : String(f[c]); });
    o.Periodo = periodo; o.ServicioId = 'SIM'; o.Seccion = o.Seccion || 'COBERTURA'; o.Orden = o.Orden || String(k + 1);
    return o;
  });
  // las líneas de teléfono del molde no son de este servicio
  try { sh.getRange(56, 6, 10, 1).clearContent(); } catch (e) { }
  llenarTabServicio_(sh, serv, filas, ctx);
  try { compactarEncabezado_(sh); } catch (e) { }
  SpreadsheetApp.flush();
  var rg = sh.getDataRange(); rg.copyTo(rg, { contentsOnly: true });
  try {
    sh.getRange('B5').setValue(nomServ.toUpperCase());
    sh.getRange('E1').setValue(serv.Empresa || '');
    sh.getRange('E4').setValue('');
  } catch (e) { }
  try { sh.setName(nomServ.replace(/[\[\]\*\?\/\\:]/g, ' ').slice(0, 90) || 'Proyección'); } catch (e) { }
  soloPestanas_(ss, [sh.getName()]);
  return salida_(exportarXlsx_(ss, nombre));
}
