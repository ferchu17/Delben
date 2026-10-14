/**
 * ============================================================
 * EXTRAS (v1.19): Ausencias, Presentismo General en planilla de Google,
 * Resumen por objetivo, Vacaciones por zona, Otros supervisores,
 * STD del sector y Consultas.
 * ============================================================
 */

/* ============================================================
   AUSENCIAS (Stock Manager, pestaña "ausencias")
   Una fila por persona y día: id · fecha · persona · legajo · dni · fecha ingreso ·
   antigüedad · objetivo · supervisor · ausencia · observaciones.
   La app agrega lo que falta con las novedades cargadas (ENF, ART, INJ, RES, MAT, SUS,
   FALL, CAS, LSG, NAC) hasta el día de hoy. Lo que agrega la app lleva en
   observaciones "Novedades del Personal" (así, si después se corrige una planilla,
   se vuelve a armar sin duplicar).
   ============================================================ */
var AUS_HOJA_ = 'ausencias';
var AUS_MARCA_ = 'Novedades del Personal';
var AUS_NOMBRE_ = {
  ENF: 'Enfermedad', ART: 'ART', INJ: 'Injustificado', RES: 'Reserva de Puesto', MAT: 'Maternidad', SUS: 'Suspendido',
  FALL: 'Licencia por Fallecimiento', CAS: 'Licencia por Matrimonio', LSG: 'Licencia Sin Goce de Sueldo', NAC: 'Nacimiento'
};

function hojaAusencias_() {
  var sh = SpreadsheetApp.openById(USUARIOS_SGI.SS_ID).getSheetByName(AUS_HOJA_);
  if (!sh) throw new Error('No se encontró la pestaña "' + AUS_HOJA_ + '" en Stock Manager.');
  return sh;
}

// "4 años, 4 meses" (igual que la otra aplicación)
function antiguedadTexto_(ingreso, a) {
  var d = fechaDeTexto_(ingreso);
  if (!d) return '';
  var m = (a.getUTCFullYear() - d.getUTCFullYear()) * 12 + (a.getUTCMonth() - d.getUTCMonth());
  if (a.getUTCDate() < d.getUTCDate()) m--;
  if (m < 0) m = 0;
  return Math.floor(m / 12) + ' años, ' + (m % 12) + ' meses';
}
// "29/11/2018", "2018-11-29" o fecha -> Date (UTC)
function fechaDeTexto_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  var t = String(v).trim(), m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { var y = Number(m[3]); if (y < 100) y += 2000; return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1]))); }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return null;
}

// Ausencias que salen de las novedades cargadas, entre dos fechas (Date UTC). Una por persona y día.
// Supervisor de una fila en un período ya cerrado (de los STD históricos); vacío si no hay dato
function supPer_(periodo, f, s) {
  if (!SUPH_) { try { SUPH_ = supHist_(); } catch (e) { SUPH_ = {}; } }
  var m = SUPH_[periodo]; if (!m) return '';
  return m['L|' + String(f.Legajo || '').trim() + '|' + (normT_(f.Nombre).split(' ')[0] || '')] || m['N|' + normT_(f.Nombre)] || m['O|' + normT_(s.Cliente || s.Servicio)] || '';
}
var SUPH_ = null;
function ausenciasDesdeNovedades_(desde, hasta) {
  var servs = {}; leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  var nomSup = {}; usuariosSinClave_().forEach(function (x) { nomSup[x.Usuario.toLowerCase()] = x.Nombre; });
  var objs = {}; try { objetivosSGI_().forEach(function (o) { objs[String(o.Id)] = o.Nombre; }); } catch (e) { }
  var fichas = fichasSGI_(), out = [], visto = {};
  var p = periodoDeFecha_(desde), pFin = periodoDeFecha_(hasta);
  while (p <= pFin) {
    var info = periodoInfo_(p);
    planillaPeriodo_(p).forEach(function (f) {
      if (!(f.Nombre || f.Legajo)) return;
      for (var i = 0; i < info.n; i++) {
        var fd = fechaDia_(p, i);
        if (fd < desde || fd > hasta) continue;
        var c = leerCelda_(f[DIAS_COL[i]]);
        if (c.tipo !== 'codigo' || !AUS_NOMBRE_[c.cod]) continue;
        var k = iso_(fd) + '|' + (f.Legajo || normT_(f.Nombre));
        if (visto[k]) continue;
        visto[k] = 1;
        var s = servs[f.ServicioId] || {}, ficha = fichaPara_(fichas, f);
        out.push({
          fecha: fd, persona: String(f.Nombre || '').toUpperCase(), legajo: f.Legajo ? Number(f.Legajo) || f.Legajo : '',
          dni: ficha.Dni ? Number(String(ficha.Dni).replace(/\D/g, '')) || ficha.Dni : '', ingreso: fechaDeTexto_(ficha.Ingreso),
          antig: antiguedadTexto_(ficha.Ingreso, fd), objetivo: String(objs[String(s.ObjetivoId || '')] || s.Cliente || s.Servicio || '').toUpperCase(),
          supervisor: supPer_(p, f, s) || nomSup[String(s.Supervisor || '').toLowerCase()] || s.Supervisor || '', ausencia: AUS_NOMBRE_[c.cod], cod: c.cod
        });
      }
    });
    p = sumarMesServ_(p, 1);
  }
  out.sort(function (a, b) { return a.fecha - b.fecha || String(a.persona).localeCompare(String(b.persona)); });
  return out;
}
function sumarMesServ_(p, k) {
  var y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)) - 1 + k;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return y + '-' + ('0' + (m + 1)).slice(-2);
}

/**
 * Pone al día la pestaña "ausencias": desde el día siguiente al último cargado por la otra aplicación
 * hasta hoy, con lo informado en las planillas. No duplica (persona + día + ausencia).
 */
function actualizarAusencias_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = hojaAusencias_(), R = sh.getLastRow();
    var v = R > 1 ? sh.getRange(2, 1, R - 1, 11).getValues() : [];
    var maxId = 0, ultOtra = null;
    v.forEach(function (f) {
      maxId = Math.max(maxId, Number(f[0]) || 0);
      var fd = fechaDeTexto_(f[1]);
      if (fd && String(f[10] || '') !== AUS_MARCA_ && (!ultOtra || fd > ultOtra)) ultOtra = fd;
    });
    var hoy = new Date(), hasta = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
    var desde = ultOtra ? new Date(ultOtra.getTime() + 864e5) : new Date(Date.UTC(2023, 3, 26));
    var nuevas = ausenciasDesdeNovedades_(desde, hasta);
    var clave = function (fecha, leg, nom, aus) { return iso_(fecha) + '|' + (String(leg || '').trim() || normT_(nom)) + '|' + normT_(aus); };
    var quiero = {}; nuevas.forEach(function (a) { quiero[clave(a.fecha, a.legajo, a.persona, a.ausencia)] = a; });
    // Lo que ya está (en la ventana) no se vuelve a poner; lo que puso la app y ya no corresponde, se saca.
    var ya = {}, borrar = [];
    v.forEach(function (f, i) {
      var fd = fechaDeTexto_(f[1]);
      if (!fd || fd < desde) return;
      var k = clave(fd, f[3], f[2], f[9]);
      if (String(f[10] || '') === AUS_MARCA_ && !quiero[k]) borrar.push(i + 2);
      else ya[k] = 1;
    });
    borrar.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
    var filas = nuevas.filter(function (a) { return !ya[clave(a.fecha, a.legajo, a.persona, a.ausencia)]; }).map(function (a) {
      var d = a.fecha, fl = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      var ing = a.ingreso ? new Date(a.ingreso.getUTCFullYear(), a.ingreso.getUTCMonth(), a.ingreso.getUTCDate()) : '';
      return [++maxId, fl, a.persona, a.legajo, a.dni, ing, a.antig, a.objetivo, a.supervisor, a.ausencia, AUS_MARCA_];
    });
    if (filas.length) {
      var ini = sh.getLastRow() + 1;
      if (sh.getMaxRows() < ini + filas.length - 1) sh.insertRowsAfter(sh.getMaxRows(), ini + filas.length - 1 - sh.getMaxRows());
      sh.getRange(ini, 1, filas.length, 11).setValues(filas);
      sh.getRange(ini, 2, filas.length, 1).setNumberFormat('dd/MM/yyyy');
      sh.getRange(ini, 6, filas.length, 1).setNumberFormat('dd/MM/yyyy');
    }
    try { CacheService.getScriptCache().remove('ausVista'); } catch (e) { }
    return { agregadas: filas.length, sacadas: borrar.length, desde: iso_(desde), hasta: iso_(hasta) };
  } finally { lock.releaseLock(); }
}

// Lo que muestra la ventana Ausencias (filtros: desde, hasta, supervisor, tipo, texto).
function verAusencias_(d) {
  var v = leerPestanaSM_(AUS_HOJA_) || [];
  var desde = d.desde || '', hasta = d.hasta || '', sup = normT_(d.supervisor || ''), tipo = normT_(d.tipo || ''), toks = normT_(d.texto || '').split(' ').filter(Boolean);
  var filas = [], porTipo = {}, porSup = {}, ultima = '';
  // v1.21.2: el supervisor de cada ausencia es el que tenía ese objetivo / esa persona en ese período (sale de los STD históricos)
  var SH = {}; try { SH = supHist_(); } catch (e) { }
  var supDe = function (f, fd) {
    var m = SH[periodoDeFecha_(fd)];
    if (!m) return f[8];
    return m['L|' + String(f[3] || '').replace(/\.0$/, '').trim() + '|' + (normT_(f[2]).split(' ')[0] || '')] || m['N|' + normT_(f[2])] || m['O|' + normT_(f[7])] || f[8];
  };
  for (var i = 1; i < v.length; i++) {
    var f = v[i], fd = fechaDeTexto_(f[1]);
    if (!fd) continue;
    f = f.slice(); f[8] = supDe(f, fd);
    var fi = iso_(fd);
    if (fi > ultima) ultima = fi;
    if (desde && fi < desde) continue;
    if (hasta && fi > hasta) continue;
    if (sup && normT_(f[8]) !== sup) continue;
    if (tipo && normT_(f[9]) !== tipo) continue;
    if (toks.length) { var k = normT_(f[2] + ' ' + f[3] + ' ' + f[7]); if (!toks.every(function (t) { return k.indexOf(t) >= 0; })) continue; }
    porTipo[f[9]] = (porTipo[f[9]] || 0) + 1;
    porSup[f[8] || 'Sin supervisor'] = (porSup[f[8] || 'Sin supervisor'] || 0) + 1;
    filas.push({ fecha: fi, persona: f[2], legajo: f[3], objetivo: f[7], supervisor: f[8], ausencia: f[9], app: f[10] === AUS_MARCA_ });
  }
  filas.sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || String(a.persona).localeCompare(String(b.persona)); });
  var tipos = {}, sups = {}, primera = '';
  Object.keys(porSup).forEach(function (k) { if (k !== 'Sin supervisor') sups[k] = 1; });
  for (var j = 1; j < v.length; j++) { if (v[j][9]) tipos[v[j][9]] = 1; if (v[j][8]) sups[v[j][8]] = 1; var f0 = fechaDeTexto_(v[j][1]); if (f0 && (!primera || iso_(f0) < primera)) primera = iso_(f0); }
  // Por páginas de 500 (todas las ausencias desde 2023 son más de 15.000)
  var tam = 500, pag = Math.max(0, Number(d.pagina) || 0), paginas = Math.max(1, Math.ceil(filas.length / tam));
  if (pag >= paginas) pag = paginas - 1;
  return { total: filas.length, pagina: pag, paginas: paginas, tam: tam, primera: primera, filas: filas.slice(pag * tam, pag * tam + tam), porTipo: porTipo, porSup: porSup, ultima: ultima,
    tipos: Object.keys(tipos).sort(), supervisores: Object.keys(sups).sort(),
    url: 'https://docs.google.com/spreadsheets/d/' + USUARIOS_SGI.SS_ID + '/edit' };
}

function accionAusencias_(u, d) {
  if (d.modo === 'actualizar') { exigir_(u, 'ausencias', true); return actualizarAusencias_(); }
  exigir_(u, 'ausencias', false);
  return verAusencias_(d);
}

/* ============================================================
   PRESENTISMO GENERAL como planilla de Google
   Se convierte el Excel "Presentismo General.xlsx" a planilla de Google dentro de la carpeta
   "Presentismo General" (una sola vez) y se completa período por período hasta el último
   30/31 días que se pasó a RRHH.
   ============================================================ */
var PRES_CARPETA_ = '1sUfip0lFuAb1A7J_GCCz3-Ik9PujxxWk';
var PRES_EXCEL_ = '1raVe6KWdbWUYokH9jzpR2JgXpu4VGW0d';

function presentismoEnCarpeta_() {
  var id = String(config_().PRESENTISMO_ID || '').trim();
  if (id) {
    try {
      var f = DriveApp.getFileById(id);
      if (!f.isTrashed() && f.getMimeType() === MimeType.GOOGLE_SHEETS) {
        var ps = f.getParents();
        while (ps.hasNext()) if (ps.next().getId() === PRES_CARPETA_) return id;
      }
    } catch (e) { }
  }
  var fs = DriveApp.getFolderById(PRES_CARPETA_).getFilesByType(MimeType.GOOGLE_SHEETS);
  while (fs.hasNext()) { var x = fs.next(); if (/PRESENTISMO GENERAL/i.test(x.getName())) { fijarConfig_('PRESENTISMO_ID', x.getId()); return x.getId(); } }
  return '';
}

// Último período que se pasó a RRHH (archivo de Novedades del Personal / 30-31 días cargado o generado).
function ultimoPeriodoRRHH_() {
  var ult = '';
  try { catalogo_().forEach(function (o) { if (/Novedades del Personal|30\/31/.test(o.Tipo) && o.Periodo > ult) ult = o.Periodo; }); } catch (e) { }
  try {
    var props = PropertiesService.getScriptProperties().getKeys();
    props.forEach(function (k) { var m = k.match(/^INF[456]\|(rrhh|treinta)\|(\d{4}-\d{2})$/); if (m && m[2] > ult) ult = m[2]; });
  } catch (e) { }
  var cerrado = sumarMesServ_(periodoActual_(), -1);
  if (!ult || ult > cerrado) ult = cerrado;
  return ult;
}

/**
 * Paso a paso (lo llama la app hasta que termina):
 *   1) si todavía no existe, convierte el Excel a planilla de Google en la carpeta;
 *   2) agrega los períodos que faltan (con datos en la app o en el archivo histórico) hasta el último pasado a RRHH.
 */
function migrarPresentismo_() {
  var inicio = Date.now(), id = presentismoEnCarpeta_(), log = [];
  if (!id) {
    // Si ya se empezó a convertir hace poco (Google sigue trabajando aunque la llamada se haya cortado), se espera.
    var props = PropertiesService.getScriptProperties(), ini = Number(props.getProperty('PRES_CONV_INICIO') || 0);
    if (ini && Date.now() - ini < 12 * 60000) {
      return { listo: false, esperar: true, log: ['Google todavía está pasando el Excel a planilla (empezó hace ' + Math.round((Date.now() - ini) / 60000) + ' min). Se vuelve a mirar en un minuto…'] };
    }
    props.setProperty('PRES_CONV_INICIO', String(Date.now()));
    var resp;
    try {
      resp = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + PRES_EXCEL_ + '/copy?supportsAllDrives=true', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ mimeType: 'application/vnd.google-apps.spreadsheet', name: 'Presentismo General', parents: [PRES_CARPETA_] })
      });
    } catch (e) {
      // La llamada se cortó por tiempo: la conversión sigue en Google y el archivo aparece en la carpeta.
      return { listo: false, esperar: true, log: ['El Excel es grande: Google lo sigue pasando a planilla. Se vuelve a mirar en un minuto…'] };
    }
    if (resp.getResponseCode() !== 200) { props.deleteProperty('PRES_CONV_INICIO'); throw new Error('No se pudo pasar el Excel a planilla de Google (' + resp.getResponseCode() + '): ' + resp.getContentText().slice(0, 300)); }
    props.deleteProperty('PRES_CONV_INICIO');
    id = JSON.parse(resp.getContentText()).id;
    fijarConfig_('PRESENTISMO_ID', id);
    borrarIndicePresentismo_();
    log.push('Se pasó el Excel a planilla de Google en la carpeta Presentismo General.');
    return { listo: false, log: log, url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit' };
  }
  try { PropertiesService.getScriptProperties().deleteProperty('PRES_CONV_INICIO'); } catch (e) { }
  var hasta = ultimoPeriodoRRHH_();
  var sh = hojaPresentismo_(), ult = sh.getLastRow(), ya = {};
  if (ult >= PRES_FILA_DATOS) sh.getRange(PRES_FILA_DATOS, 1, ult - PRES_FILA_DATOS + 1, 1).getValues().forEach(function (r) { ya[numeroDeEtiqueta_(r[0])] = 1; });
  var maxYa = Object.keys(ya).reduce(function (m, k) { return Math.max(m, Number(k)); }, 0);
  // Solo los períodos posteriores al último que tiene el Presentismo (lo viejo queda como está en el Excel)
  var faltan = periodosConDatos_().filter(function (p) { var n = numeroPeriodo_(p); return n > maxYa && p <= hasta; });
  for (var i = 0; i < faltan.length && Date.now() - inicio < 200000; i++) {
    try { var r = actualizarPresentismo_(faltan[i]); log.push(r.periodo + ': ' + r.filas + ' filas.'); faltan[i] = null; }
    catch (e) { log.push(nombrePeriodo_(faltan[i]) + ': ' + e.message); faltan[i] = null; }
  }
  var quedan = faltan.filter(Boolean).length;
  return { listo: !quedan, quedan: quedan, log: log, hasta: hasta, nombreHasta: nombrePeriodo_(hasta), url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit' };
}

/* ============================================================
   RESUMEN por objetivo (ver Vistas.gs: datosResumen_)
   ============================================================ */
function accionResumen_(u, d) {
  exigir_(u, 'resumen', false);
  return datosResumen_(d.periodo || periodoActual_());
}

/* ============================================================
   VACACIONES por zona (supervisor): diagramadas (proyección) e informadas (planilla)
   ============================================================ */
function vacacionesPeriodo_(periodo) {
  var servs = {}; leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  var nomSup = {}; usuariosSinClave_().forEach(function (x) { nomSup[x.Usuario.toLowerCase()] = x.Nombre; });
  var n = periodoInfo_(periodo).n;
  var contar = function (filas) {
    var por = {};   // zona -> persona -> {dias, servicios}
    filas.forEach(function (f) {
      if (!(f.Nombre || f.Legajo)) return;
      var dias = 0;
      for (var i = 0; i < n; i++) { var c = leerCelda_(f[DIAS_COL[i]]); if (c.tipo === 'codigo' && c.cod === 'VAC') dias++; }
      if (!dias) return;
      var s = servs[f.ServicioId] || {}, z = String(s.Supervisor || '').toLowerCase() || '(sin zona)';
      var k = f.Legajo ? 'L' + String(f.Legajo).trim() : 'N' + normT_(f.Nombre);
      por[z] = por[z] || {};
      var p = por[z][k] = por[z][k] || { legajo: f.Legajo, nombre: f.Nombre, empresa: f.Empresa, dias: 0, servicios: [] };
      // El mismo vigilador en dos servicios de la zona: los días se cuentan una sola vez (el mayor)
      p.dias = Math.max(p.dias, dias);
      var nom = s.Servicio || f.ServicioId;
      if (p.servicios.indexOf(nom) < 0) p.servicios.push(nom);
    });
    return por;
  };
  var inf = contar(planillaPeriodo_(periodo).filter(function (f) { return f.Seccion !== 'EVENTO'; }));
  var dia = contar(leer_('Proyectado').filter(function (f) { return f.Periodo === periodo && f.Seccion !== 'EVENTO'; }));
  var zonas = {};
  [inf, dia].forEach(function (m) { Object.keys(m).forEach(function (z) { zonas[z] = 1; }); });
  var lista = Object.keys(zonas).map(function (z) {
    var a = inf[z] || {}, b = dia[z] || {};
    var personas = {};
    Object.keys(b).forEach(function (k) { personas[k] = { legajo: b[k].legajo, nombre: b[k].nombre, empresa: b[k].empresa, diagramadas: b[k].dias, informadas: 0, servicios: b[k].servicios }; });
    Object.keys(a).forEach(function (k) {
      personas[k] = personas[k] || { legajo: a[k].legajo, nombre: a[k].nombre, empresa: a[k].empresa, diagramadas: 0, informadas: 0, servicios: a[k].servicios };
      personas[k].informadas = a[k].dias;
    });
    var pl = Object.keys(personas).map(function (k) { return personas[k]; }).sort(function (x, y) { return String(x.nombre).localeCompare(String(y.nombre)); });
    return {
      zona: z, nombre: nomSup[z] || z, personas: pl,
      cantDiag: pl.filter(function (p) { return p.diagramadas; }).length, cantInf: pl.filter(function (p) { return p.informadas; }).length,
      diasDiag: pl.reduce(function (s, p) { return s + p.diagramadas; }, 0), diasInf: pl.reduce(function (s, p) { return s + p.informadas; }, 0)
    };
  }).sort(function (x, y) { return x.nombre.localeCompare(y.nombre); });
  return { periodo: periodo, nombre: nombrePeriodo_(periodo), zonas: lista };
}
function accionVacaciones_(u, d) {
  exigir_(u, 'vacaciones', false);
  var r = vacacionesPeriodo_(d.periodo || periodoActual_());
  r.miZona = String(u.usuario || '').toLowerCase();
  return r;
}

/* ============================================================
   OTROS SUPERVISORES: ver (solo ver) los servicios de las otras zonas
   ============================================================ */
function accionOtrosServicios_(u, d) {
  exigir_(u, 'otrossup', false);
  var periodo = d.periodo || periodoActual_();
  var servs = leer_('Servicios').filter(function (s) { return s.Activo !== 'NO' || d.conBajas; });
  var nomSup = {}; usuariosSinClave_().forEach(function (x) { nomSup[x.Usuario.toLowerCase()] = x.Nombre; });
  var zonas = {};
  servs.forEach(function (s) { var z = String(s.Supervisor || '').toLowerCase(); if (z) zonas[z] = nomSup[z] || s.Supervisor; });
  var out = { periodo: periodo, nombre: nombrePeriodo_(periodo), zonas: Object.keys(zonas).map(function (z) { return { v: z, t: zonas[z] }; }).sort(function (a, b) { return a.t.localeCompare(b.t); }), servicios: [] };
  var zona = String(d.zona || '').toLowerCase(), toks = normT_(d.personal || '').split(' ').filter(Boolean);
  if (!zona && !toks.length) return out;
  var sel = servs.filter(function (s) { return !zona || String(s.Supervisor || '').toLowerCase() === zona; });
  var ids = {}; sel.forEach(function (s) { ids[s.Id] = s; });
  var filas = planillaPeriodo_(periodo).filter(function (f) { return ids[f.ServicioId] && (f.Nombre || f.Legajo); });
  if (toks.length) {
    var conPersona = {};
    filas.forEach(function (f) { var k = normT_(f.Legajo + ' ' + f.Nombre); if (toks.every(function (t) { return k.indexOf(t) >= 0; })) conPersona[f.ServicioId] = 1; });
    sel = sel.filter(function (s) { return conPersona[s.Id]; });
  }
  var n = periodoInfo_(periodo).n, dias = [];
  for (var i = 0; i < n; i++) { var fd = fechaDia_(periodo, i); dias.push({ f: iso_(fd), w: (fd.getUTCDay() + 6) % 7, fer: esFeriado_(fd) ? 1 : 0 }); }
  out.dias = dias;
  out.servicios = sel.map(function (s) {
    var fs = filas.filter(function (f) { return f.ServicioId === s.Id; }).sort(function (a, b) {
      var o = { '': 0, COBERTURA: 0, RETEN: 1, EVENTO: 2 };
      return ((o[a.Seccion] || 0) - (o[b.Seccion] || 0)) || (Number(a.Orden) || 0) - (Number(b.Orden) || 0);
    });
    return { id: s.Id, servicio: s.Servicio, cliente: s.Cliente, empresa: s.Empresa, zona: nomSup[String(s.Supervisor || '').toLowerCase()] || s.Supervisor,
      filas: fs.map(function (f) { return { sec: f.Seccion, leg: f.Legajo, nom: f.Nombre, emp: f.Empresa, pue: f.Puesto, turno: f.Turno || '', d: DIAS_COL.slice(0, n).map(function (c) { return f[c] || ''; }) }; }) };
  });
  return out;
}

/* ============================================================
   STD DEL SECTOR (botón STD en Proyección y Novedades semanales)
   El STD con los servicios de la zona del supervisor.
   ============================================================ */
function accionSTDSector_(u, d) {
  var zona = String((esAdmin_(u) || (d.zona && esMiZona_(u, d.zona))) && d.zona ? d.zona : u.usuario).toLowerCase();
  var periodo = d.periodo || periodoActual_();
  var servs = {}; leer_('Servicios').forEach(function (s) { if (String(s.Supervisor || '').toLowerCase() === zona) servs[s.Id] = 1; });
  if (!esAdmin_(u) && !Object.keys(servs).length) throw new Error('No tenés servicios asignados.');
  FORMATO_FIJO_STD_ = true;   // el STD del sector se ve con el formato de los supervisores (ya viene en la app): no hace falta leer el modelo
  var r = vistaSTD_(periodo, d.tipo || 'std');
  r.filas = r.filas.filter(function (f) { return servs[f.sid]; });
  r.invalidos = (r.invalidos || []).filter(function (x) { return servs[x.ServicioId]; });
  // Totales por día solo del sector
  var tot = { todas: [], servicios: [], reten: [] };
  for (var i = 0; i < r.n; i++) { tot.todas.push([0, 0]); tot.servicios.push([0, 0]); tot.reten.push([0, 0]); }
  r.filas.forEach(function (f) {
    f.dias.forEach(function (dd, i) {
      if (i >= r.n || typeof dd[0] !== 'number') return;
      tot.todas[i][0] += dd[0]; tot.todas[i][1] += dd[1];
      var t = f.reten ? tot.reten : tot.servicios; t[i][0] += dd[0]; t[i][1] += dd[1];
    });
  });
  r.totales = tot; r.sector = zona;
  return r;
}

/* ============================================================
   CONSULTAS: una pregunta (escrita o dictada) sobre cualquier dato.
   Si nombra a una persona y hay varias que coinciden, se devuelven las opciones
   (legajo, empresa y cliente) para elegir; con la persona elegida se arma la respuesta.
   ============================================================ */
var CONS_VACIAS_ = ['QUE', 'QUIEN', 'DONDE', 'CUANDO', 'COMO', 'CUANTO', 'CUANTOS', 'CUANTAS', 'TIENE', 'TUVO', 'ESTA', 'ESTUVO', 'TRABAJA', 'TRABAJO', 'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS',
  'EN', 'A', 'AL', 'Y', 'O', 'POR', 'PARA', 'CON', 'ME', 'MI', 'SE', 'SU', 'SUS', 'UN', 'UNA', 'HORAS', 'HORA', 'DIAS', 'DIA', 'VACACIONES', 'VACACION', 'AUSENCIAS', 'AUSENCIA', 'FALTAS', 'FALTA',
  'SERVICIO', 'SERVICIOS', 'OBJETIVO', 'CLIENTE', 'PERIODO', 'MES', 'ESTE', 'ESTA', 'ESE', 'ESA', 'ULTIMO', 'ULTIMA', 'PASADO', 'ACTUAL', 'DECIME', 'DAME', 'MOSTRAME', 'BUSCAR', 'BUSCA', 'INFO',
  'INFORMACION', 'DATOS', 'VIGILADOR', 'VIGILADORA', 'PERSONA', 'LEGAJO', 'SUPERVISOR', 'ZONA', 'QUIERO', 'SABER', 'HAY', 'ES', 'SON', 'FUE', 'LICENCIA', 'LICENCIAS', 'ENFERMEDAD', 'FRANCO', 'FRANCOS',
  'TRABAJADAS', 'TRABAJADOS', 'EXTRAS', 'PLUS', 'CATEGORIA', 'DNI', 'INGRESO', 'ANTIGUEDAD', 'TELEFONO', 'DIRECCION', 'SEÑOR', 'SENOR', 'SRA', 'SR', 'TODO', 'TODA', 'SOBRE', 'ENERO', 'FEBRERO',
  'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'TURNO', 'NOCHE', 'DIA', 'HOY', 'AYER', 'SEMANA'];

/**
 * v1.22.10: CONSULTAS PASO A PASO. Una vez elegida la persona (y el período), se manda todo lo que se tiene de ella
 * para responder las preguntas siguientes sin volver a buscar: ficha de SGI (ingreso, nacimiento, domicilio...),
 * dónde trabajó en cada período (Presentismo General + la app), todas sus ausencias de Stock Manager
 * (y cuáles se repiten en la misma fecha año tras año) y el detalle del período elegido.
 */
function accionConsultaPersona_(u, d) {
  exigir_(u, 'consultas', false);
  var leg = String(d.legajo || '').trim(), nom = String(d.nombre || '').trim();
  var p = personalSGI_().filter(function (x) { return String(x.Legajo) === leg && (!d.empresa || empClave_(x.Empresa) === empClave_(d.empresa)); })[0] ||
    personalSGI_().filter(function (x) { return String(x.Legajo) === leg; })[0] || { Legajo: leg, Nombre: nom, Empresa: d.empresa || '' };
  var out = { persona: { Legajo: p.Legajo, Nombre: p.Nombre, Empresa: p.Empresa, Estado: p.Estado || '' } };
  try { out.ficha = ACCIONES_.fichaPersona(u, { legajo: leg, empresa: p.Empresa, nombre: p.Nombre }); } catch (e) { out.ficha = {}; }
  // Dónde trabajó, período por período
  var hist = {}, ap = normT_(p.Nombre).split(' ')[0];
  try {
    indicePresentismo_(hojaPresentismo_()).forEach(function (r) {
      if (String(r[1]).replace(/\.0$/, '') !== leg || normT_(r[2]).split(' ')[0] !== ap) return;
      var k = r[0]; (hist[k] = hist[k] || []).indexOf(r[3]) < 0 && hist[k].push(r[3]);
    });
  } catch (e) { Logger.log('Presentismo en consultas: ' + e.message); }
  var servs = {}; leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  try {
    periodosConDatos_().slice(-4).forEach(function (pp) {
      var et = etiquetaPeriodo_(pp);
      planillaPeriodo_(pp).forEach(function (f) {
        if (String(f.Legajo || '').trim() !== leg || normT_(f.Nombre).split(' ')[0] !== ap) return;
        var sv = servs[f.ServicioId] || {}, nm = sv.Cliente || sv.Servicio || f.ServicioId;
        (hist[et] = hist[et] || []).indexOf(nm) < 0 && hist[et].push(nm);
      });
    });
  } catch (e) { }
  out.historial = Object.keys(hist).sort(function (a, b) { return numeroDeEtiqueta_(a) - numeroDeEtiqueta_(b); }).map(function (k) { return { periodo: k, servicios: hist[k] }; });
  // Todas las ausencias (Stock Manager) y las que caen en la misma fecha en distintos años
  var aus = [];
  try {
    var v = leerPestanaSM_(AUS_HOJA_) || [];
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][3]).replace(/\.0$/, '') !== leg) continue;
      var fd = fechaDeTexto_(v[i][1]); if (!fd) continue;
      aus.push({ fecha: iso_(fd), ausencia: String(v[i][9] || ''), objetivo: String(v[i][7] || '') });
    }
  } catch (e) { }
  aus.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var porMD = {};
  aus.forEach(function (a) { var md = a.fecha.slice(5); (porMD[md] = porMD[md] || []).push(a); });
  out.ausencias = aus;
  out.repetidas = Object.keys(porMD).filter(function (md) {
    var anios = {}; porMD[md].forEach(function (a) { anios[a.fecha.slice(0, 4)] = 1; }); return Object.keys(anios).length > 1;
  }).sort().map(function (md) { return { dia: md.slice(3) + '/' + md.slice(0, 2), veces: porMD[md].map(function (a) { return a.fecha; }) }; });
  // Detalle del período (si se eligió uno)
  if (d.periodo && d.periodo !== 'todo') {
    var mios = {}, esAdm = esAdmin_(u) || u.rol === 'CONSULTA';
    leer_('Servicios').forEach(function (s) { if (esAdm || esMiZona_(u, s.Supervisor)) mios[s.Id] = 1; });
    out.periodo = d.periodo; out.nombrePeriodo = nombrePeriodo_(d.periodo);
    out.detalle = resumenPersonaConsulta_(p, d.periodo, mios, esAdm);
  }
  return out;
}

function accionConsulta_(u, d) {
  exigir_(u, 'consultas', false);
  var texto = String(d.texto || ''), t = normT_(texto);
  var periodo = d.periodo || periodoDesdeTexto_(texto) || periodoActual_();
  var toks = t.replace(/[^A-Z0-9Ñ ]/g, ' ').split(' ').filter(function (x) { return x && CONS_VACIAS_.indexOf(x) < 0 && !/^\d{4}$/.test(x); });
  var personal = personalSGI_(), servicios = leer_('Servicios');
  var esAdm = esAdmin_(u) || u.rol === 'CONSULTA';
  var mios = {}; servicios.forEach(function (s) { if (esAdm || esMiZona_(u, s.Supervisor)) mios[s.Id] = 1; });
  // Dónde figura cada legajo en el período (cliente)
  var dondeEsta = {};
  planillaPeriodo_(periodo).forEach(function (f) {
    var k = String(f.Legajo || '').trim() || normT_(f.Nombre);
    var s = servicios.filter(function (x) { return x.Id === f.ServicioId; })[0];
    (dondeEsta[k] = dondeEsta[k] || []).indexOf(s ? s.Servicio : f.ServicioId) < 0 && dondeEsta[k].push(s ? s.Servicio : f.ServicioId);
  });
  // ¿Pregunta por un legajo?
  var leg = String(d.legajo || '') || ((t.match(/LEGAJO\s*(\d+)/) || [])[1] || '');
  var cand = [];
  if (leg) cand = personal.filter(function (p) { return String(p.Legajo) === leg && (!d.empresa || p.Empresa === d.empresa); });
  else if (toks.length) {
    cand = personal.filter(function (p) {
      var k = normT_(p.Nombre + ' ' + p.Legajo);
      return toks.some(function (x) { return x.length > 2 && k.indexOf(x) >= 0; });
    }).map(function (p) {
      var k = normT_(p.Nombre), puntos = toks.filter(function (x) { return k.indexOf(x) >= 0; }).length;
      return { p: p, puntos: puntos };
    }).sort(function (a, b) { return b.puntos - a.puntos || (a.p.Estado === 'Baja') - (b.p.Estado === 'Baja'); });
    if (cand.length) { var mx = cand[0].puntos; cand = cand.filter(function (c) { return c.puntos === mx; }).map(function (c) { return c.p; }); }
  }
  // También puede preguntar por un servicio
  var serv = null;
  if (!leg && toks.length) {
    serv = servicios.filter(function (s) { return mios[s.Id] && toks.every(function (x) { return normT_(s.Cliente + ' ' + s.Servicio).indexOf(x) >= 0; }); })[0] ||
      servicios.filter(function (s) { return mios[s.Id] && (mismoNombre_(s.Cliente, texto) || mismoNombre_(s.Servicio, texto)); })[0] || null;
  }
  if (!cand.length && serv) return { tipo: 'servicio', periodo: periodo, nombrePeriodo: nombrePeriodo_(periodo), servicio: resumenServicioConsulta_(serv, periodo) };
  if (!cand.length) return { tipo: 'nada', periodo: periodo, mensaje: 'No encontré a nadie ni ningún servicio con "' + texto + '". Probá con el apellido, el legajo o el nombre del cliente.' };
  if (cand.length > 1) {
    return { tipo: 'opciones', periodo: periodo, nombrePeriodo: nombrePeriodo_(periodo), texto: texto,
      opciones: cand.slice(0, 40).map(function (p) { return { Legajo: p.Legajo, Nombre: p.Nombre, Empresa: p.Empresa, Estado: p.Estado, Clientes: (dondeEsta[String(p.Legajo)] || []).join(', ') }; }) };
  }
  return { tipo: 'persona', periodo: periodo, nombrePeriodo: nombrePeriodo_(periodo), texto: texto, persona: resumenPersonaConsulta_(cand[0], periodo, mios, esAdm) };
}

function resumenPersonaConsulta_(p, periodo, mios, esAdm) {
  var ctx = contextoInforme_(periodo), servicios = ctx.servs;
  var filas = planillaPeriodo_(periodo).filter(function (f) { return String(f.Legajo || '').trim() === String(p.Legajo) || (!f.Legajo && normT_(f.Nombre) === normT_(p.Nombre)); });
  var porServicio = filas.map(function (f) {
    var x = estadisticasFila_(f, ctx), s = servicios[f.ServicioId] || {};
    return { servicio: s.Servicio || f.ServicioId, sid: f.ServicioId, puedeAbrir: !!mios[f.ServicioId], supervisor: ctx.nomSup[String(s.Supervisor || '').toLowerCase()] || s.Supervisor || '',
      seccion: f.Seccion || 'COBERTURA', puesto: f.Puesto || '', turno: f.Turno || '', diurnas: x.D + x.iD + x.rD, nocturnas: x.N + x.iN + x.rN, total: x.liq, extras: x.extras,
      trabajados: x.trab, feriados: x.ferTrab, estados: x.est, dias: x.dias.slice(0, ctx.n) };
  });
  var ficha = ctx.fichas[String(p.Legajo)] || {};
  var plus = leer_('Plus').filter(function (x) { return x.Periodo === periodo && String(x.Legajo) === String(p.Legajo); }).map(function (x) { return { funcion: x.Funcion, dias: x.Dias, servicio: (servicios[x.ServicioId] || {}).Servicio || x.ServicioId }; });
  // Ausencias de los últimos 90 días (Stock Manager)
  var aus = [];
  try {
    var v = leerPestanaSM_(AUS_HOJA_) || [], lim = iso_(new Date(Date.now() - 90 * 864e5));
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][3]).replace(/\.0$/, '') !== String(p.Legajo)) continue;
      var fd = fechaDeTexto_(v[i][1]); if (!fd || iso_(fd) < lim) continue;
      aus.push({ fecha: iso_(fd), ausencia: v[i][9], objetivo: v[i][7] });
    }
  } catch (e) { }
  var porTipo = {}; aus.forEach(function (a) { porTipo[a.ausencia] = (porTipo[a.ausencia] || 0) + 1; });
  return {
    Legajo: p.Legajo, Nombre: p.Nombre, Empresa: p.Empresa, Estado: p.Estado, Categoria: ficha.Categoria || p.Categoria || '', Dni: ficha.Dni || p.Dni || '',
    Ingreso: ficha.Ingreso || '', Zona: p.Zona || '', servicios: porServicio, plus: plus,
    total: porServicio.reduce(function (s, x) { return s + x.total; }, 0), vac: porServicio.reduce(function (m, x) { return Math.max(m, x.estados.VAC || 0); }, 0),
    ausencias90: porTipo, ausenciasLista: aus.slice(-30)
  };
}

function resumenServicioConsulta_(s, periodo) {
  var ctx = contextoInforme_(periodo), n = ctx.n, cD = 0, cN = 0;
  for (var i = 0; i < n; i++) { var c = contratadoDia_(s, fechaDia_(periodo, i)); cD += c.d; cN += c.n; }
  var filas = planillaPeriodo_(periodo).filter(function (f) { return f.ServicioId === s.Id && (f.Nombre || f.Legajo); });
  var rD = 0, rN = 0, personas = filas.map(function (f) {
    var x = estadisticasFila_(f, ctx);
    if (f.Seccion !== 'RETEN' && f.Seccion !== 'EVENTO') { rD += x.D; rN += x.N; }
    return { Legajo: f.Legajo, Nombre: f.Nombre, Seccion: f.Seccion || 'COBERTURA', Puesto: f.Puesto || '', total: x.liq, estados: x.est };
  });
  if (sinDiferencia_(s)) { cD = rD; cN = rN; }
  return { id: s.Id, Servicio: s.Servicio, Cliente: s.Cliente, Empresa: s.Empresa, Supervisor: ctx.nomSup[String(s.Supervisor || '').toLowerCase()] || s.Supervisor,
    JO: s.JefeOperaciones || '', Direccion: s.Direccion || '', Ciclo: s.Ciclo, contratadas: { d: cD, n: cN }, realizadas: { d: rD, n: rN }, personas: personas };
}

function periodoActual_() {
  var h = new Date(), y = h.getFullYear(), m = h.getMonth() + 1;
  if (h.getDate() < 26) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + ('0' + m).slice(-2);
}


/* ===================== v1.21 · Feriados nacionales 2026 ===================== */
// Se agregan una sola vez a la hoja Feriados los que falten (nunca se pisa ni se borra lo que ya está cargado).
// Los días no laborables (23/3, 2/4 Jueves Santo, 10/7, 7/12) no se agregan: si corresponde se cargan a mano en Datos.
var FERIADOS_OFICIALES_ = [
  ['2026-01-01', 'Año Nuevo'], ['2026-02-16', 'Carnaval'], ['2026-02-17', 'Carnaval'],
  ['2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia'], ['2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas'],
  ['2026-04-03', 'Viernes Santo'], ['2026-05-01', 'Día del Trabajador'], ['2026-05-25', 'Día de la Revolución de Mayo'],
  ['2026-06-15', 'Paso a la Inmortalidad del Gral. Martín Miguel de Güemes (trasladado)'], ['2026-06-20', 'Paso a la Inmortalidad del Gral. Manuel Belgrano'],
  ['2026-07-09', 'Día de la Independencia'], ['2026-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín'],
  ['2026-10-12', 'Día del Respeto a la Diversidad Cultural'], ['2026-11-23', 'Día de la Soberanía Nacional (trasladado)'],
  ['2026-12-08', 'Inmaculada Concepción de María'], ['2026-12-25', 'Navidad']
];
function asegurarFeriadosOficiales_() {
  var pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('FER_OF_2026') === '1') return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var lista = leer_('Feriados'), hay = {};
    lista.forEach(function (f) { hay[f.Fecha] = 1; });
    var nuevos = FERIADOS_OFICIALES_.filter(function (x) { return !hay[x[0]]; });
    if (nuevos.length) {
      nuevos.forEach(function (x) { lista.push({ Fecha: x[0], Descripcion: x[1] }); });
      lista.sort(function (a, b) { return a.Fecha < b.Fecha ? -1 : 1; });
      reescribir_('Feriados', lista);
      try { FERIADOS_CACHE_ = null; } catch (e) { }
    }
    pr.setProperty('FER_OF_2026', '1');
  } finally { lock.releaseLock(); }
}


/* ===================== v1.21 · Botón SGI =====================
 * Abre el SGI con un pase de un solo uso (vence en 2 minutos), firmado con una clave que comparten las dos apps.
 * El SGI lo valida con loginSSO (Code.gs del SGI) leyendo la clave de la pestaña oculta SSO_Novedades de Stock Manager, y entra
 * con ese usuario sin pedir la clave. Si se entra al SGI por otro lado, pide usuario y clave como siempre.
 * Solo administración cambia el enlace. Cada usuario ve el botón según su perfil (ventana "SGI" en Usuarios y perfiles)
 * y adentro del SGI tiene los permisos que le da el SGI.
 */
var SGI_URL_DEFECTO_ = 'https://script.google.com/macros/s/AKfycbyc2gJ6TeTk-F3JzmJQ0kFYKqCX1r67VRP_VQhz26JD1HenhaWBcD5JcX4WAwJosWyRgQ/exec';
function sgiSecreto_() {
  var pr = PropertiesService.getScriptProperties(), s = pr.getProperty('SGI_SSO_SECRETO');
  if (!s) { s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); pr.setProperty('SGI_SSO_SECRETO', s); pr.deleteProperty('SGI_SSO_PUBLICADO'); }
  // v1.21.2: la clave queda en la pestaña oculta "SSO_Novedades" de Stock Manager (la planilla del SGI): el SGI la lee sola, no hay que configurar nada.
  if (pr.getProperty('SGI_SSO_PUBLICADO') !== s.slice(0, 8)) {
    var ss = SpreadsheetApp.openById(USUARIOS_SGI.SS_ID), h = ss.getSheetByName('SSO_Novedades');
    if (!h) { h = ss.insertSheet('SSO_Novedades'); try { h.hideSheet(); } catch (e) { } }
    h.getRange('A1').setValue(s);
    h.getRange('A2').setValue('Clave del acceso directo desde Novedades del Personal (botón SGI). No borrar.');
    pr.setProperty('SGI_SSO_PUBLICADO', s.slice(0, 8));
  }
  return s;
}
function sgiUrl_() { return String(config_().SGI_URL || '').trim() || SGI_URL_DEFECTO_; }
function accionSGILink_(u, d) {
  exigir_(u, 'sgi', false);
  var url = sgiUrl_();
  var usuario = Utilities.base64EncodeWebSafe(String(u.usuario), Utilities.Charset.UTF_8).replace(/=+$/, '');
  var vence = String(Date.now() + 2 * 60 * 1000);
  var firma = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(usuario + '.' + vence, sgiSecreto_())).replace(/=+$/, '');
  return { url: url + (url.indexOf('?') >= 0 ? '&' : '?') + 'sso=' + usuario + '.' + vence + '.' + firma };
}
function accionSGIConfig_(u, d) {
  if (!esAdmin_(u)) throw new Error('Solo administración puede cambiar el enlace del SGI.');
  if (d && d.url !== undefined) {
    var url = String(d.url || '').trim();
    if (url && !/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) throw new Error('El enlace tiene que ser el de la app del SGI (https://script.google.com/.../exec).');
    fijarConfig_('SGI_URL', url);
  }
  if (d && d.nuevoSecreto) PropertiesService.getScriptProperties().deleteProperty('SGI_SSO_SECRETO');
  sgiSecreto_();
  return { url: sgiUrl_(), defecto: SGI_URL_DEFECTO_ };
}

/* ============================================================
   v1.23.0: ESTADÍSTICAS (Informes > Estadísticas)
   - Rotación del personal (pestaña "personal" de Stock Manager: ingreso, baja, estado), período por período y por año.
       Dotación inicial = activos el día 26 · Altas = ingresos del período · Bajas = bajas del período
       Rotación % = bajas / dotación promedio × 100 · Índice de rotación % = (altas + bajas) / 2 / dotación promedio × 100
   - Licencias y ausentismo (planillas del período: la app y el archivo histórico, igual que el Consolidado):
       Días programados = días trabajados + días de licencia (INJ, LSG, ENF, ART, VAC, SUS, NAC, MAT, FALL, RES, CAS; BAJA no)
       % de cada tipo = días de ese tipo / días programados × 100 (los francos no cuentan)
   ============================================================ */
// BAJA no se cuenta: son los días después de que la persona se fue (no es una licencia).
var EST_TIPOS_ = ['ENF', 'ART', 'INJ', 'LSG', 'VAC', 'SUS', 'MAT', 'NAC', 'FALL', 'CAS', 'RES'];
var EST_NOMBRES_ = { ENF: 'Enfermedad', ART: 'ART', INJ: 'Injustificada', LSG: 'Lic. sin goce', VAC: 'Vacaciones', SUS: 'Suspensión', MAT: 'Maternidad',
  NAC: 'Nacimiento', FALL: 'Fallecimiento', CAS: 'Matrimonio', RES: 'Reserva de puesto', BAJA: 'Baja' };

function accionEstadisticas_(u, d) {
  if (u.rol === 'SUPERVISOR') throw new Error('Tu perfil no tiene acceso a las estadísticas.');
  exigir_(u, 'informes', false);
  var hasta = d.hasta || periodoActualServidor_(), desde = d.desde || sumarMesServ_(hasta, -11);
  var pers = [];
  for (var p = desde, i = 0; p <= hasta && i < 36; p = sumarMesServ_(p, 1), i++) pers.push(p);
  var emp = d.empresa ? empClave_(d.empresa) : '';
  return { periodos: pers.map(function (p) { return { p: p, nombre: nombrePeriodo_(p) }; }), tipos: EST_TIPOS_, nombres: EST_NOMBRES_,
    rotacion: rotacionPersonal_(pers, emp), licencias: pers.map(function (p) { return licenciasPeriodo_(p, emp); }), empresa: d.empresa || '' };
}

// Rotación con la pestaña "personal" de Stock Manager
function rotacionPersonal_(pers, emp) {
  var vals = leerPestanaSM_(PERSONAL_SGI.HOJA) || [[]];
  var enc = vals[0].map(function (t) { return String(t).trim().toLowerCase(); }), c = function (n) { return enc.indexOf(n); };
  var gente = [], sinFecha = 0;
  vals.slice(1).forEach(function (f) {
    if (!String(f[c('nombre')] || '').trim()) return;
    var e = EMPRESAS_SGI[String(f[c('empresa')] || '').trim()] || String(f[c('empresa')] || '').trim();
    if (emp && empClave_(e) !== emp) return;
    var ing = fechaDeTexto_(f[c('ingreso')]), baja = c('baja') >= 0 ? fechaDeTexto_(f[c('baja')]) : null;
    var esBaja = /baja/i.test(String(f[c('estado')] || ''));
    if (esBaja && !baja) sinFecha++;
    gente.push({ ing: ing, baja: baja, esBaja: esBaja, cat: String(f[c('categoria')] || '').trim(), nombre: String(f[c('nombre')] || '').trim() });
  });
  var activoEl = function (x, dia) { return (!x.ing || x.ing <= dia) && !(x.baja && x.baja < dia) && !(x.esBaja && !x.baja); };
  var porPer = pers.map(function (p) {
    var inf = periodoInfo_(p), fin1 = new Date(inf.hasta.getTime() + 864e5);
    var ini = 0, fin = 0, altas = 0, bajas = 0, listaB = [];
    gente.forEach(function (x) {
      if (activoEl(x, inf.desde)) ini++;
      if (activoEl(x, fin1)) fin++;
      if (x.ing && x.ing >= inf.desde && x.ing <= inf.hasta) altas++;
      if (x.baja && x.baja >= inf.desde && x.baja <= inf.hasta) { bajas++; if (listaB.length < 60) listaB.push(x.nombre); }
    });
    var prom = (ini + fin) / 2;
    return { p: p, ini: ini, fin: fin, altas: altas, bajas: bajas, prom: prom, rot: prom ? Math.round(bajas / prom * 1000) / 10 : 0,
      indice: prom ? Math.round((altas + bajas) / 2 / prom * 1000) / 10 : 0, nombresBajas: listaB };
  });
  // Por año (períodos del 26/12 al 25/12: el año es el del cierre)
  var anios = {};
  porPer.forEach(function (x) {
    var a = String(sumarMesServ_(x.p, 1)).slice(0, 4), o = anios[a] = anios[a] || { anio: a, altas: 0, bajas: 0, proms: [], n: 0 };
    o.altas += x.altas; o.bajas += x.bajas; o.proms.push(x.prom); o.n++;
  });
  var porAnio = Object.keys(anios).sort().map(function (a) {
    var o = anios[a], prom = o.proms.reduce(function (s, v) { return s + v; }, 0) / (o.proms.length || 1);
    return { anio: a, periodos: o.n, altas: o.altas, bajas: o.bajas, prom: Math.round(prom * 10) / 10,
      rot: prom ? Math.round(o.bajas / prom * 1000) / 10 : 0, indice: prom ? Math.round((o.altas + o.bajas) / 2 / prom * 1000) / 10 : 0 };
  });
  return { porPeriodo: porPer, porAnio: porAnio, bajasSinFecha: sinFecha };
}

// Licencias de un período, contadas desde las planillas (se guarda en caché: los períodos cerrados no cambian)
function licenciasPeriodo_(p, emp) {
  var actual = p >= sumarMesServ_(periodoActualServidor_(), -1);
  var ck = 'estLic|' + p + '|' + emp + '|' + (actual ? versionHoja_('Planilla') || '' : 'h');
  var ya = cacheJSONGet_(ck);
  if (ya) return ya;
  var n = periodoInfo_(p).n, servs = {};
  leer_('Servicios').forEach(function (s) { servs[s.Id] = s; });
  var tot = { trab: 0, horas: 0, prog: 0, franco: 0 }, tipos = {}, porServ = {}, personas = {}, conLic = {};
  EST_TIPOS_.forEach(function (k) { tipos[k] = 0; });
  planillaPeriodo_(p).forEach(function (f) {
    if (!f.Nombre && !f.Legajo) return;
    if (emp && empClave_(f.Empresa) !== emp) return;
    var key = (String(f.Legajo || '').trim() || normT_(f.Nombre)), s = servs[f.ServicioId] || {};
    var nomS = s.Cliente || s.Servicio || f.ServicioId;
    var ps = porServ[nomS] = porServ[nomS] || { servicio: nomS, trab: 0, prog: 0, aus: 0, tipos: {} };
    personas[key] = 1;
    for (var i = 0; i < n; i++) {
      var cel = leerCelda_(f[DIAS_COL[i]]);
      if (cel.tipo === 'horas') { tot.trab++; tot.prog++; tot.horas += cel.h; ps.trab++; ps.prog++; }
      else if (cel.tipo === 'codigo') {
        var k = cel.cod === 'FCO' ? 'F' : cel.cod;
        if (k === 'F') { tot.franco++; continue; }
        if (tipos[k] === undefined) continue;
        tipos[k]++; tot.prog++; ps.prog++; ps.aus++; ps.tipos[k] = (ps.tipos[k] || 0) + 1;
        (conLic[k] = conLic[k] || {})[key] = 1;
      }
    }
  });
  var pct = function (v, b) { return b ? Math.round(v / b * 10000) / 100 : 0; };
  var aus = EST_TIPOS_.reduce(function (a, k) { return a + tipos[k]; }, 0);
  var out = { p: p, personas: Object.keys(personas).length, trab: tot.trab, horas: Math.round(tot.horas), prog: tot.prog, aus: aus, pctAus: pct(aus, tot.prog),
    pctSinVac: pct(aus - tipos.VAC, tot.prog),
    tipos: tipos, pct: {}, personasCon: {},
    servicios: Object.keys(porServ).map(function (k) { var x = porServ[k]; x.pct = pct(x.aus, x.prog); return x; })
      .filter(function (x) { return x.prog; }).sort(function (a, b) { return b.pct - a.pct; }).slice(0, 40) };
  EST_TIPOS_.forEach(function (k) { out.pct[k] = pct(tipos[k], tot.prog); out.personasCon[k] = Object.keys(conLic[k] || {}).length; });
  cacheJSONPut_(ck, out, actual ? 600 : 21600);
  return out;
}

/* ============================================================
   v1.23.0: PROYECCIÓN DE SERVICIO NUEVO (solo administración): se guardan las simulaciones
   ============================================================ */
function accionSimulaciones_(u, d) {
  if (!esAdmin_(u)) throw new Error('Solo administración.');
  var lista = leer_('Simulaciones');
  if (d.modo === 'guardar') {
    var id = d.id || ('SIM' + Date.now());
    var reg = { Id: id, Nombre: String(d.nombre || 'Sin nombre'), Datos: JSON.stringify(d.datos || {}), Usuario: u.usuario, Fecha: ahora_() };
    var hay = false;
    lista = lista.map(function (x) { if (x.Id === id) { hay = true; return reg; } return x; });
    if (!hay) lista.push(reg);
    reescribir_('Simulaciones', lista);
    return { id: id };
  }
  if (d.modo === 'borrar') { reescribir_('Simulaciones', lista.filter(function (x) { return x.Id !== d.id; })); return true; }
  if (d.modo === 'abrir') { var x = lista.filter(function (y) { return y.Id === d.id; })[0]; if (!x) throw new Error('No se encontró.'); return { id: x.Id, nombre: x.Nombre, datos: JSON.parse(x.Datos || '{}') }; }
  return lista.map(function (x) { return { id: x.Id, nombre: x.Nombre, usuario: x.Usuario, fecha: x.Fecha }; }).reverse();
}
