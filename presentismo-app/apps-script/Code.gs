/*****************************************************************
 * DELBEN · PRESENTISMO DE SERVICIOS
 * Planilla: "Presentismo de Servicios" (cuenta delbensgii@gmail.com)
 * Archivos del proyecto: Code.gs · Index.html · appsscript.json
 *
 * - Vigilador: da el presente con DNI + servicio + hora de entrada y salida.
 *   Si viene de otro servicio, se le pide a qué hora se retiró y se corrige.
 *   Ve solo sus presentes del período actual (26 al 25).
 * - Encargado: informa a día vencido el personal de su servicio (desplegable
 *   con buscador, observación por persona, licencias) y envía el correo al servicio.
 * - Supervisor / Administrador: buscador de presentes de cualquier período,
 *   horas diurnas y nocturnas, descarga y QR de los servicios.
 *
 * Servicios: pestaña "objetivos" de Stock Manager (menos los que terminan en "baja").
 * Usuarios: pestaña "Usuarios y contraseñas" de Stock Manager.
 * Personal: pestaña personal de Stock Manager (gid 1959223792).
 * Personal actual de cada servicio: novedades semanales (planilla "Novedades del Personal - Base").
 *
 * Página pública (sin el cartel de Google): https://ferchu17.github.io/Delben/presentismo/
 * Se arma en GitHub con estos mismos archivos (presentismo-app/apps-script) y habla con doPost.
 *****************************************************************/

const VERSION = '2026-10-23.5'; // tiene que coincidir con la de Index.html

const CFG = {
  PLANILLA_ID: '',           // opcional: ID de la planilla "Presentismo de Servicios" (si queda vacío se usa la vinculada o se crea una)
  URL_PUBLICA: 'https://ferchu17.github.io/Delben/presentismo/', // link de la app y de los QR (abre la APK si está instalada)
  STOCK_MANAGER_ID: '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY',
  PERSONAL_GID: 1959223792,
  HOJA_USUARIOS: 'Usuarios y contraseñas',
  HOJA_OBJETIVOS: 'objetivos',
  NOVEDADES_BASE_ID: '',     // ID de "Novedades del Personal - Base" (compartida con delbensgii como Lector)
  TZ: 'America/Argentina/Buenos_Aires',
  DIURNO_DESDE: 6 * 60,      // horas diurnas de 06 a 21; nocturnas de 21 a 06
  DIURNO_HASTA: 21 * 60,
  DIAS_ATRAS_ENCARGADO: 3,   // el encargado puede informar y anular hasta 3 días atrás
  DIAS_HABITUALES: 45,       // también se toman como personal del servicio los que tuvieron presentes ahí en estos días
  MAX_DIAS_LICENCIA: 90,
  SESION_SEG: 21600,         // 6 h, se renueva con cada uso
  CACHE_SEG: 600,            // personal, servicios y personal actual se releen cada 10 min
  MAIL_PRUEBA: '',           // modo prueba: si se pone un correo, TODOS los mails van solo ahí. Vacío = van a los servicios.
  MAIL_REMITENTE: 'DELBEN Presentismo'
};

const HOJAS = { PRES: 'Presentes', COD: 'Codigos', ENC: 'Encargados', ENV: 'Envios' };

const COLS_PRES = ['ID', 'Fecha', 'Servicio', 'ServicioId', 'DNI', 'Nombre', 'Legajo', 'Empresa', 'Tipo', 'Codigo',
  'Entrada', 'Salida', 'Hs diurnas', 'Hs nocturnas', 'Detalle', 'Observaciones', 'Hora registro', 'Cargado por',
  'Estado', 'Anulado por', 'Motivo anulacion', 'Modificaciones'];
// Columnas (base 1) de Presentes que se escriben por separado
const COL = { SALIDA: 12, ESTADO: 19, MODIF: 22 };

const CODIGOS_INICIALES = [
  ['VAC', 'Vacaciones'], ['ENF', 'Enfermedad'], ['ART', 'Accidente de trabajo (ART)'],
  ['LSG', 'Licencia sin goce'], ['NAC', 'Nacimiento'], ['MAT', 'Maternidad'],
  ['FALL', 'Fallecimiento'], ['CAS', 'Licencia por matrimonio'], ['SUS', 'Suspensión']
];

/* ======================= WEB APP ======================= */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('DELBEN · Presentismo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Puente para la página de GitHub Pages: recibe { fn, args } y llama a la misma función que usa la app.
 * La implementación tiene que estar con "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier persona".
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const fn = String(req.fn || ''), args = Array.isArray(req.args) ? req.args : [];
    const permitidas = {
      getInicio: getInicio, buscarPorDni: buscarPorDni, registrarPresente: registrarPresente, misPresentes: misPresentes,
      login: login, logout: logout, getDatosPanel: getDatosPanel, getDia: getDia, cargarLote: cargarLote,
      getRegistros: getRegistros, anularRegistro: anularRegistro, enviarCorreo: enviarCorreo
    };
    if (!permitidas[fn]) throw new Error('Función no permitida: ' + fn);
    out = { ok: true, result: permitidas[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ============ CONFIGURACIÓN INICIAL (ejecutar desde el editor) ============ */

function configurarPlanilla() {
  const ss = ss_();
  // Si quedó la pestaña Presentes de una versión anterior, se renombra y se crea la nueva.
  prepararPresentes_(ss);
  crearHoja_(ss, HOJAS.COD, ['Codigo', 'Descripcion'], CODIGOS_INICIALES);
  crearHoja_(ss, HOJAS.ENC, ['Usuario', 'Servicios (separados por coma)', 'Observaciones'], []);
  crearHoja_(ss, HOJAS.ENV, ['Fecha envio', 'Servicio', 'Fecha informada', 'Enviado a', 'Usuario', 'Cantidad'], []);

  const servs = getServicios_(true);
  const per = leerPersonal_(true);
  const usu = leerUsuarios_();
  Logger.log('Versión ' + VERSION + ' · Planilla: ' + ss.getName() + ' → ' + ss.getUrl());
  Logger.log('Servicios (objetivos sin "baja"): ' + servs.length + ' · Personal activo: ' + per.length + ' · Usuarios: ' + usu.length);
  usu.filter(u => norm_(u.rol).indexOf('servicio') >= 0).forEach(u => {
    const s = servs.filter(x => norm_(x.nombre) === norm_(u.nombre))[0];
    Logger.log('Usuario de servicio ' + u.usuario + ' → ' + (s ? s.nombre : 'NO coincide con ningún objetivo (revisar el nombre)') +
      ' · correo: ' + (u.correo || 'SIN CORREO'));
  });
  if (CFG.NOVEDADES_BASE_ID) {
    try { Logger.log('Novedades del Personal - Base: ' + SpreadsheetApp.openById(CFG.NOVEDADES_BASE_ID).getName() + ' (OK)'); }
    catch (e) { Logger.log('No se pudo abrir Novedades del Personal - Base: ' + e.message); }
  } else {
    Logger.log('Falta NOVEDADES_BASE_ID: mientras tanto el personal del servicio sale de los presentes de los últimos ' + CFG.DIAS_HABITUALES + ' días.');
  }
  // Pide el permiso de correo en la misma autorización
  Logger.log('Correos que quedan hoy en la cuenta: ' + MailApp.getRemainingDailyQuota());
}

function crearHoja_(ss, nombre, cols, filas) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols])
      .setFontWeight('bold').setBackground('#0b3b3c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    if (filas.length) sh.getRange(2, 1, filas.length, filas[0].length).setValues(filas);
  }
  return sh;
}

// Planilla de datos: la indicada en CFG.PLANILLA_ID, la vinculada al proyecto,
// o una nueva "Presentismo de Servicios" que se crea la primera vez y queda guardada.
function ss_() {
  if (CFG.PLANILLA_ID) return SpreadsheetApp.openById(CFG.PLANILLA_ID);
  const act = SpreadsheetApp.getActiveSpreadsheet();
  if (act) return act;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PLANILLA_ID');
  if (id) return SpreadsheetApp.openById(id);
  const nueva = SpreadsheetApp.create('Presentismo de Servicios');
  props.setProperty('PLANILLA_ID', nueva.getId());
  return nueva;
}

function hoja_(n) {
  const ss = ss_();
  if (n === HOJAS.PRES) return prepararPresentes_(ss);
  const sh = ss.getSheetByName(n);
  if (!sh) throw new Error('Falta la pestaña "' + n + '". Ejecutá configurarPlanilla() desde el editor.');
  return sh;
}

// Deja la pestaña Presentes con las columnas de esta versión. Si encuentra la de una versión
// anterior (otras columnas o formatos), la renombra y crea una nueva, así no se mezclan los datos.
function prepararPresentes_(ss) {
  let sh = ss.getSheetByName(HOJAS.PRES);
  if (sh && sh.getLastRow() > 0) {
    const enc = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0];
    if (enc.slice(0, COLS_PRES.length).join('|') === COLS_PRES.join('|')) return sh;
    sh.setName('Presentes version anterior ' + Utilities.formatDate(new Date(), CFG.TZ, 'ddMMyy HHmm'));
    sh = null;
  }
  sh = crearHoja_(ss, HOJAS.PRES, COLS_PRES, []);
  sh.getRange('B2:B').setNumberFormat('dd/mm/yyyy');
  sh.getRange('E2:E').setNumberFormat('@');
  sh.getRange('K2:L').setNumberFormat('@');
  sh.getRange('M2:N').setNumberFormat('0.00');
  sh.getRange('Q2:Q').setNumberFormat('dd/mm/yyyy hh:mm');
  return sh;
}

/* ======================= VIGILADOR ======================= */

function getInicio() {
  return { version: VERSION, hoy: hoyStr_(0), servicios: getServicios_() };
}

function buscarPorDni(dni) {
  const d = limpiarDni_(dni);
  if (d.length < 6) throw new Error('El DNI está incompleto.');
  let ms = leerPersonal_().filter(p => p[0] === d);
  if (!ms.length) ms = leerPersonal_(true).filter(p => p[0] === d);
  if (!ms.length) throw new Error('El DNI ' + d + ' no figura en el listado de personal activo. Avisale a tu supervisor.');
  return ms.map(p => ({ nombre: p[1], legajo: p[2], empresa: p[3] }));
}

// d: { servicio, dni, empresa, ent, sal, salidaAnterior }
function registrarPresente(d) {
  const serv = servicioPorNombre_(d.servicio);
  if (!serv) throw new Error('Servicio no válido.');
  const p = persona_(d.dni, d.empresa);
  if (minHHMM_(d.ent) == null || minHHMM_(d.sal) == null) throw new Error('Poné la hora de entrada y la de salida.');
  // El presente es de hoy, salvo que sea un turno que empezó ayer y todavía sigue (ej. 18 a 06 dado a las 02:00)
  const ahora = diaNum_(hoyStr_(0)) * 1440 + minutosAhora_();
  const ivAyer = intervalo_(hoyStr_(-1), d.ent, d.sal);
  const fecha = (ivAyer && ivAyer.fin > diaNum_(hoyStr_(0)) * 1440 && ahora < ivAyer.fin) ? hoyStr_(-1) : hoyStr_(0);
  const it = armarItem_({ serv: serv, p: p, tipo: 'PRESENTE', fecha: fecha, ent: d.ent, sal: d.sal, salidaAnterior: d.salidaAnterior });
  const r = guardar_([[it]], 'AUTOREGISTRO')[0];
  if (r.error) throw new Error(r.error);
  if (r.necesitaSalida) return { necesitaSalida: true, conflicto: r.conflicto };
  return { ok: true, nombre: p[1], servicio: serv.nombre, fecha: fmtDia_(fecha), ent: it.ent, sal: it.sal, hd: it.hd, hn: it.hn };
}

// El vigilador ve solo sus propios presentes del período actual (26 al 25)
function misPresentes(dni) {
  const d = limpiarDni_(dni);
  const ms = buscarPorDni(d);
  const rg = periodoRango_(periodoDe_(hoyStr_(0)));
  const filas = leerRegistros_(hoja_(HOJAS.PRES), 20000)
    .filter(r => r.dni === d && r.estado !== 'ANULADO' && r.fecha >= rg.desde && r.fecha <= rg.hasta)
    .sort((a, b) => (a.fecha + a.ent).localeCompare(b.fecha + b.ent))
    .map(r => ({ fecha: r.fecha, servicio: r.servicio, tipo: r.tipo, codigo: r.codigo, ent: r.ent, sal: r.sal, hd: r.hd, hn: r.hn }));
  return {
    nombre: ms[0].nombre, legajo: ms[0].legajo,
    empresa: ms.map(m => m.empresa).filter(Boolean).join(' / '),
    periodo: fmtDia_(rg.desde) + ' al ' + fmtDia_(rg.hasta),
    filas: filas,
    hd: r2_(filas.reduce((a, x) => a + x.hd, 0)),
    hn: r2_(filas.reduce((a, x) => a + x.hn, 0))
  };
}

/* ======================= LOGIN / SESIÓN ======================= */

function login(usuario, pass, modo) {
  const ul = String(usuario || '').trim().toLowerCase();
  const u = leerUsuarios_().filter(x => x.usuario.toLowerCase() === ul && x.pass === String(pass))[0];
  if (!u) throw new Error('Usuario o contraseña incorrectos.');
  const r = norm_(u.rol);
  const rol = r.indexOf('admin') >= 0 ? 'admin' : (r.indexOf('super') >= 0 ? 'supervisor' : 'encargado');
  if (modo === 'supervisor' && rol === 'encargado') {
    throw new Error('Tu usuario es de encargado. Volvé al inicio e ingresá con "Ingresar como encargado".');
  }
  let servicios = [];
  if (rol === 'encargado') {
    servicios = serviciosDeUsuario_(u).map(s => s.nombre);
    if (!servicios.length) {
      throw new Error('Tu usuario no tiene ningún servicio asignado. Un usuario de servicio tiene que tener el mismo nombre que el objetivo en Stock Manager; otros usuarios se asignan en la pestaña Encargados de la planilla.');
    }
  }
  const token = Utilities.getUuid();
  const ses = { usuario: u.usuario, nombre: u.nombre, rol: rol, servicios: servicios };
  CacheService.getScriptCache().put('ses_' + token, JSON.stringify(ses), CFG.SESION_SEG);
  return { token: token };
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('ses_' + token);
  return true;
}

function sesion_(token) {
  const c = CacheService.getScriptCache();
  const s = token ? c.get('ses_' + token) : null;
  if (!s) throw new Error('SESION_VENCIDA');
  c.put('ses_' + token, s, CFG.SESION_SEG);
  return JSON.parse(s);
}

function serviciosPermitidos_(ses) {
  const todos = getServicios_();
  if (ses.rol === 'encargado') return todos.filter(s => ses.servicios.indexOf(s.nombre) >= 0);
  return todos;
}

function serviciosDeUsuario_(u) {
  const servs = getServicios_();
  const ul = u.usuario.toLowerCase();
  const out = {};
  if (norm_(u.rol).indexOf('servicio') >= 0) {
    servs.forEach(s => { if (norm_(s.nombre) === norm_(u.nombre)) out[s.nombre] = s; });
  }
  encargadosHoja_().filter(e => e.usuario === ul).forEach(e => e.servicios.forEach(n => {
    const s = servs.filter(x => norm_(x.nombre) === norm_(n))[0];
    if (s) out[s.nombre] = s;
  }));
  return Object.keys(out).map(k => out[k]);
}

/* ======================= PANEL ======================= */

function getDatosPanel(token) {
  const ses = sesion_(token);
  const per = periodoDe_(hoyStr_(0));
  const periodos = [];
  let p = per;
  for (let i = 0; i < 18; i++) {
    const rg = periodoRango_(p);
    periodos.push({ p: p, desde: rg.desde, hasta: rg.hasta, label: fmtDia_(rg.desde) + ' al ' + fmtDia_(rg.hasta) });
    p = periodoAnterior_(p);
  }
  return {
    usuario: ses.usuario, nombre: ses.nombre, rol: ses.rol,
    hoy: hoyStr_(0), ayer: hoyStr_(-1), limiteEncargado: hoyStr_(-CFG.DIAS_ATRAS_ENCARGADO),
    servicios: serviciosPermitidos_(ses),
    codigos: getCodigos_(),
    periodos: periodos,
    puedeDescargar: ses.rol !== 'encargado',
    urlApp: ses.rol !== 'encargado' ? (CFG.URL_PUBLICA || ScriptApp.getService().getUrl()) : '',
    personal: leerPersonal_()
  };
}

// Todo lo que necesita la pantalla del encargado en una sola llamada:
// personal actual del servicio + lo ya informado ese día
function getDia(token, servicio, fecha) {
  const ses = sesion_(token);
  const serv = serviciosPermitidos_(ses).filter(s => s.nombre === servicio)[0];
  if (!serv) throw new Error('No tenés permiso sobre ese servicio.');
  return { actual: personalActual_(serv), dia: diaServicio_(serv.nombre, fecha) };
}

function diaServicio_(servicio, fecha) {
  const filas = leerRegistros_(hoja_(HOJAS.PRES), fecha >= hoyStr_(-120) ? 15000 : null)
    .filter(r => r.servicio === servicio && r.fecha === fecha);
  const act = filas.filter(x => x.estado !== 'ANULADO');
  return {
    filas: filas.map(limpiarFila_),
    tot: {
      hd: r2_(act.reduce((a, x) => a + x.hd, 0)), hn: r2_(act.reduce((a, x) => a + x.hn, 0)),
      pres: act.filter(x => x.tipo === 'PRESENTE').length, lic: act.filter(x => x.tipo === 'LICENCIA').length,
      anul: filas.length - act.length
    }
  };
}

// DNIs del personal actual del servicio (novedades semanales + presentes recientes)
function getPersonalServicio(token, servicio) {
  const ses = sesion_(token);
  const serv = serviciosPermitidos_(ses).filter(s => s.nombre === servicio)[0];
  if (!serv) return [];
  return personalActual_(serv);
}

// d: { servicio, fecha, items: [{ dni, empresa, tipo, codigo, ent, sal, hasta, obs, salidaAnterior }] }
// Devuelve un resultado por item: { i, ok } | { i, error } | { i, necesitaSalida, conflicto }
function cargarLote(token, d) {
  const ses = sesion_(token);
  const serv = serviciosPermitidos_(ses).filter(s => s.nombre === d.servicio)[0];
  if (!serv) throw new Error('No tenés permiso para informar en ese servicio.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha))) throw new Error('Fecha no válida.');
  if (ses.rol === 'encargado' && d.fecha < hoyStr_(-CFG.DIAS_ATRAS_ENCARGADO)) {
    throw new Error('Solo podés informar hasta ' + CFG.DIAS_ATRAS_ENCARGADO + ' días atrás. Para fechas anteriores, pedíselo al supervisor.');
  }
  const codigos = getCodigos_();
  const grupos = [], mapa = [], previos = [];
  (d.items || []).forEach((x, i) => {
    try {
      const p = persona_(x.dni, x.empresa);
      if (x.tipo === 'LICENCIA') {
        const cod = codigos.filter(c => c[0] === x.codigo)[0];
        if (!cod) throw new Error('Elegí el tipo de licencia.');
        const hasta = (x.hasta && x.hasta >= d.fecha) ? x.hasta : d.fecha;
        const dias = diasEntre_(d.fecha, hasta) + 1;
        if (dias > CFG.MAX_DIAS_LICENCIA) throw new Error('La licencia no puede superar ' + CFG.MAX_DIAS_LICENCIA + ' días por carga.');
        const detalle = dias > 1 ? 'Del ' + fmtDia_(d.fecha) + ' al ' + fmtDia_(hasta) : '';
        const g = [];
        for (let k = 0; k < dias; k++) {
          g.push(armarItem_({ serv: serv, p: p, tipo: 'LICENCIA', fecha: sumarDias_(d.fecha, k), codigo: cod[0], obs: x.obs, detalle: detalle }));
        }
        grupos.push(g);
      } else {
        if (d.fecha > hoyStr_(0)) throw new Error('No se puede informar un presente de una fecha futura.');
        grupos.push([armarItem_({ serv: serv, p: p, tipo: 'PRESENTE', fecha: d.fecha, ent: x.ent, sal: x.sal, obs: x.obs, salidaAnterior: x.salidaAnterior })]);
      }
      mapa.push(i);
    } catch (e) {
      previos.push({ i: i, error: e.message });
    }
  });
  const res = grupos.length ? guardar_(grupos, ses.usuario) : [];
  return {
    res: previos.concat(res.map(r => Object.assign({}, r, { i: mapa[r.idx] }))),
    dia: diaServicio_(serv.nombre, d.fecha)   // lo informado ese día, para no hacer otra llamada
  };
}

// f: { desde, hasta, servicio, texto }
function getRegistros(token, f) {
  const ses = sesion_(token);
  f = f || {};
  const permit = serviciosPermitidos_(ses).map(s => s.nombre);
  const desde = f.desde || hoyStr_(0);
  const hasta = f.hasta || desde;
  const q = norm_(f.texto || '');
  const filas = leerRegistros_(hoja_(HOJAS.PRES)).filter(r =>
    r.fecha >= desde && r.fecha <= hasta &&
    (ses.rol !== 'encargado' || permit.indexOf(r.servicio) >= 0) &&
    (!f.servicio || r.servicio === f.servicio) &&
    (!q || norm_(r.nombre).indexOf(q) >= 0 || r.dni.indexOf(q) >= 0 || norm_(r.servicio).indexOf(q) >= 0 || norm_(r.empresa).indexOf(q) >= 0)
  );
  filas.sort((a, b) => (a.fecha + a.servicio + a.ent + a.nombre).localeCompare(b.fecha + b.servicio + b.ent + b.nombre));
  const act = filas.filter(x => x.estado !== 'ANULADO');
  return {
    total: filas.length,
    filas: filas.slice(0, 4000).map(limpiarFila_),
    tot: {
      hd: r2_(act.reduce((a, x) => a + x.hd, 0)),
      hn: r2_(act.reduce((a, x) => a + x.hn, 0)),
      pres: act.filter(x => x.tipo === 'PRESENTE').length,
      lic: act.filter(x => x.tipo === 'LICENCIA').length,
      anul: filas.length - act.length
    }
  };
}

function anularRegistro(token, id, motivo) {
  const ses = sesion_(token);
  motivo = String(motivo || '').trim();
  if (!motivo) throw new Error('Escribí el motivo de la anulación.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('El sistema está ocupado, probá de nuevo en unos segundos.');
  try {
    const sh = hoja_(HOJAS.PRES);
    const cel = sh.getRange('A:A').createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (!cel) throw new Error('No se encontró el registro.');
    const fila = cel.getRow();
    const r = filaObj_(sh.getRange(fila, 1, 1, COLS_PRES.length).getValues()[0], fila);
    if (r.estado === 'ANULADO') throw new Error('Ese registro ya estaba anulado.');
    if (ses.rol === 'encargado') {
      if (ses.servicios.indexOf(r.servicio) < 0) throw new Error('No tenés permiso sobre ese servicio.');
      if (r.fecha < hoyStr_(-CFG.DIAS_ATRAS_ENCARGADO)) throw new Error('Solo podés anular registros de los últimos ' + CFG.DIAS_ATRAS_ENCARGADO + ' días. Pedíselo al supervisor.');
    }
    sh.getRange(fila, COL.ESTADO, 1, 3).setValues([[
      'ANULADO',
      ses.usuario + ' · ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm'),
      motivo.slice(0, 300)
    ]]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return true;
}

// Manda al correo del servicio el listado de presentes de una fecha
function enviarCorreo(token, servicio, fecha) {
  const ses = sesion_(token);
  const serv = serviciosPermitidos_(ses).filter(s => s.nombre === servicio)[0];
  if (!serv) throw new Error('No tenés permiso sobre ese servicio.');
  const regs = leerRegistros_(hoja_(HOJAS.PRES), 20000)
    .filter(r => r.servicio === serv.nombre && r.fecha === fecha && r.estado !== 'ANULADO')
    .sort((a, b) => (a.tipo + a.ent + a.nombre).localeCompare(b.tipo + b.ent + b.nombre));
  if (!regs.length) throw new Error('No hay presentes informados el ' + fmtDia_(fecha) + ' en ' + serv.nombre + '.');
  const destinos = correosServicio_(serv.nombre);
  const prueba = String(CFG.MAIL_PRUEBA || '').trim();
  if (!destinos.length && !prueba) throw new Error('El servicio no tiene correo cargado en "Usuarios y contraseñas" de Stock Manager.');
  const para = prueba || destinos.join(',');
  const hd = r2_(regs.reduce((a, x) => a + x.hd, 0)), hn = r2_(regs.reduce((a, x) => a + x.hn, 0));
  const td = 'style="border:1px solid #d5e4e2;padding:6px 8px;font-size:13px"';
  const th = 'style="border:1px solid #0b3b3c;background:#0b3b3c;color:#fff;padding:6px 8px;font-size:13px;text-align:left"';
  const filas = regs.map(r => '<tr><td ' + td + '>' + escH_(r.nombre) + '</td><td ' + td + '>' + escH_(r.dni) + '</td><td ' + td + '>' + escH_(r.empresa) + '</td><td ' + td + '>' +
    (r.tipo === 'LICENCIA' ? 'Licencia ' + escH_(r.codigo) : 'Presente') + '</td><td ' + td + '>' + escH_(r.ent) + '</td><td ' + td + '>' + escH_(r.sal) + '</td><td ' + td + '>' +
    fmtH_(r.hd) + '</td><td ' + td + '>' + fmtH_(r.hn) + '</td><td ' + td + '>' + escH_(r.obs) + '</td></tr>').join('');
  const html = '<div style="font-family:Arial,sans-serif;color:#10201f">' +
    (prueba ? '<p style="background:#fff7ed;color:#b45309;padding:8px;border-radius:6px"><b>PRUEBA:</b> este correo iría a ' + escH_(destinos.join(', ') || '(el servicio no tiene correo cargado)') + '</p>' : '') +
    '<h2 style="color:#0b3b3c;margin:0 0 4px">Presentes ' + escH_(serv.nombre) + '</h2>' +
    '<p style="margin:0 0 12px">Fecha: <b>' + fmtDia_(fecha) + '</b> · Informado por ' + escH_(ses.nombre) + '</p>' +
    '<table style="border-collapse:collapse"><tr><th ' + th + '>Nombre</th><th ' + th + '>DNI</th><th ' + th + '>Empresa</th><th ' + th + '>Tipo</th><th ' + th + '>Entrada</th><th ' + th + '>Salida</th><th ' + th + '>Hs diurnas</th><th ' + th + '>Hs nocturnas</th><th ' + th + '>Observaciones</th></tr>' +
    filas + '<tr><td ' + td + ' colspan="6"><b>Total</b></td><td ' + td + '><b>' + fmtH_(hd) + '</b></td><td ' + td + '><b>' + fmtH_(hn) + '</b></td><td ' + td + '></td></tr></table>' +
    '<p style="color:#5b6b6a;font-size:12px;margin-top:14px">DELBEN · Sistema de Gestión Integral</p></div>';
  MailApp.sendEmail({
    to: para,
    subject: (prueba ? '[PRUEBA] ' : '') + 'Delben - Presentes ' + serv.nombre + ' - ' + fmtDia_(fecha),
    htmlBody: html,
    name: CFG.MAIL_REMITENTE
  });
  try {
    hoja_(HOJAS.ENV).appendRow([new Date(), serv.nombre, aFecha_(fecha), para, ses.usuario, regs.length]);
  } catch (e) { /* el registro del envío no frena el correo */ }
  return { para: para, prueba: !!prueba, destinos: destinos.join(', '), cantidad: regs.length };
}

/* ======================= GUARDADO Y CONTROLES ======================= */

function armarItem_(o) {
  const it = {
    fecha: o.fecha, servicio: o.serv.nombre, sid: o.serv.id,
    dni: o.p[0], nombre: o.p[1], legajo: o.p[2], empresa: o.p[3],
    tipo: o.tipo, codigo: o.codigo || '', ent: '', sal: '', hd: 0, hn: 0,
    detalle: o.detalle || '', obs: String(o.obs || '').trim().slice(0, 500),
    salidaAnterior: o.salidaAnterior || ''
  };
  if (o.tipo === 'LICENCIA') {
    const b = diaNum_(o.fecha) * 1440;
    it.ini = b; it.fin = b + 1440;
  } else {
    const iv = intervalo_(o.fecha, o.ent, o.sal);
    if (!iv) throw new Error('Completá la hora de entrada y la de salida.');
    it.ent = hhmm_(o.ent); it.sal = hhmm_(o.sal);
    it.ini = iv.ini; it.fin = iv.fin;
    const h = horasDN_(it.ent, it.sal);
    it.hd = h.d; it.hn = h.n;
  }
  return it;
}

// grupos: [[item, ...], ...] (una licencia de varios días es un grupo: se guarda entera o nada)
function guardar_(grupos, por) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('El sistema está ocupado, probá de nuevo en unos segundos.');
  try {
    const sh = hoja_(HOJAS.PRES);
    const regs = leerRegistros_(sh, 8000);
    const res = [], filas = [], ahora = new Date();
    grupos.forEach((g, idx) => {
      try {
        let ajuste = null;
        g.forEach(it => {
          const conf = conflictos_(regs, it);
          if (!conf.length) return;
          const c = conf[0];
          // Traslado: viene de otro turno que empezó antes → se corrige la hora en que se retiró
          const traslado = g.length === 1 && it.tipo === 'PRESENTE' && conf.length === 1 && c.tipo === 'PRESENTE' && c.ini < it.ini && c.fila;
          if (!traslado) throw new Error(msgConflicto_(it, c));
          ajuste = { c: c, it: it };
        });
        if (ajuste && !ajuste.it.salidaAnterior) {
          res.push({ idx: idx, necesitaSalida: true, conflicto: { servicio: ajuste.c.servicio, fecha: ajuste.c.fecha, ent: ajuste.c.ent, sal: ajuste.c.sal } });
          return;
        }
        if (ajuste) ajustarSalida_(sh, ajuste.c, ajuste.it.salidaAnterior, ajuste.it.ini, por);
        g.forEach(it => {
          const row = [nuevoId_(), aFecha_(it.fecha), it.servicio, it.sid, it.dni, it.nombre, it.legajo, it.empresa,
            it.tipo, it.codigo, it.ent, it.sal, it.hd, it.hn, it.detalle, it.obs, ahora, por, 'ACTIVO', '', '', ''];
          filas.push(row);
          regs.push(filaObj_(row, 0));
        });
        res.push({ idx: idx, ok: true, dias: g.length });
      } catch (e) {
        res.push({ idx: idx, error: e.message });
      }
    });
    if (filas.length) {
      const ini = sh.getLastRow() + 1;
      sh.getRange(ini, 5, filas.length, 1).setNumberFormat('@');
      sh.getRange(ini, 11, filas.length, 2).setNumberFormat('@');
      sh.getRange(ini, 1, filas.length, COLS_PRES.length).setValues(filas);
    }
    SpreadsheetApp.flush();
    return res;
  } finally {
    lock.releaseLock();
  }
}

// Una persona no puede estar en dos lugares a la vez ni tener presente y licencia el mismo día
function conflictos_(regs, n) {
  return regs.filter(x => x.dni === n.dni && x.estado !== 'ANULADO' && (
    (x.tipo === 'LICENCIA' || n.tipo === 'LICENCIA') ? x.fecha === n.fecha : (x.ini < n.fin && n.ini < x.fin)
  ));
}

function msgConflicto_(it, c) {
  if (c.tipo === 'LICENCIA') return it.nombre + ' tiene licencia (' + c.codigo + ') el ' + fmtDia_(c.fecha) + '.';
  if (it.tipo === 'LICENCIA') return it.nombre + ' tiene presente el ' + fmtDia_(c.fecha) + ' en ' + c.servicio + '. Anulalo antes de cargar la licencia.';
  return it.nombre + ' ya tiene presente el ' + fmtDia_(c.fecha) + ' en ' + c.servicio + ' de ' + c.ent + ' a ' + c.sal + ' (cargado por ' + c.por + ').';
}

// Corrige la salida del turno anterior cuando el vigilador pasa a otro servicio
function ajustarSalida_(sh, c, salida, nuevoIni, por) {
  if (minHHMM_(salida) == null) throw new Error('La hora en que se retiró no es válida.');
  const iv = intervalo_(c.fecha, c.ent, salida);
  if (!iv || iv.fin > nuevoIni) {
    throw new Error('La hora en que se retiró de ' + c.servicio + ' tiene que ser igual o anterior a la nueva hora de entrada.');
  }
  const sal = hhmm_(salida);
  const h = horasDN_(c.ent, sal);
  sh.getRange(c.fila, COL.SALIDA, 1, 3).setValues([[sal, h.d, h.n]]);
  const ant = String(sh.getRange(c.fila, COL.MODIF).getValue() || '');
  sh.getRange(c.fila, COL.MODIF).setValue((ant ? ant + ' | ' : '') + 'Salida ' + c.sal + ' → ' + sal + ' por traslado · ' + por + ' · ' +
    Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm'));
  c.sal = sal; c.fin = iv.fin; c.hd = h.d; c.hn = h.n;
}

function leerRegistros_(sh, ultimas) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const desde = ultimas ? Math.max(2, last - ultimas + 1) : 2;
  return sh.getRange(desde, 1, last - desde + 1, COLS_PRES.length).getValues().map((r, i) => filaObj_(r, desde + i));
}

function filaObj_(r, fila) {
  const o = {
    fila: fila, id: String(r[0]), fecha: fechaStr_(r[1]), servicio: String(r[2]), sid: String(r[3]),
    dni: limpiarDni_(r[4]), nombre: String(r[5]), legajo: String(r[6]), empresa: String(r[7]),
    tipo: String(r[8]), codigo: String(r[9]), ent: hhmm_(r[10]), sal: hhmm_(r[11]),
    hd: num_(r[12]), hn: num_(r[13]), detalle: String(r[14]), obs: String(r[15]),
    hora: r[16] instanceof Date ? Utilities.formatDate(r[16], CFG.TZ, 'dd/MM/yyyy HH:mm') : String(r[16]),
    por: String(r[17]), estado: String(r[18] || 'ACTIVO'), anuladoPor: String(r[19]), motivo: String(r[20]), modif: String(r[21] || '')
  };
  if (o.tipo === 'LICENCIA') {
    const b = diaNum_(o.fecha) * 1440;
    o.ini = b; o.fin = b + 1440;
    o.hd = 0; o.hn = 0;
  } else {
    const iv = intervalo_(o.fecha, o.ent, o.sal);
    o.ini = iv ? iv.ini : NaN; o.fin = iv ? iv.fin : NaN;
    // Las horas se calculan siempre desde la entrada y la salida (diurnas 06 a 21, nocturnas 21 a 06)
    if (iv) { const h = horasDN_(o.ent, o.sal); o.hd = h.d; o.hn = h.n; }
  }
  return o;
}

function limpiarFila_(r) {
  return {
    id: r.id, fecha: r.fecha, servicio: r.servicio, dni: r.dni, nombre: r.nombre, legajo: r.legajo, empresa: r.empresa,
    tipo: r.tipo, codigo: r.codigo, ent: r.ent, sal: r.sal, hd: r.hd, hn: r.hn, detalle: r.detalle, obs: r.obs,
    hora: r.hora, por: r.por, estado: r.estado, anuladoPor: r.anuladoPor, motivo: r.motivo, modif: r.modif
  };
}

function persona_(dni, empresa) {
  const d = limpiarDni_(dni);
  let ms = leerPersonal_().filter(p => p[0] === d);
  if (!ms.length) ms = leerPersonal_(true).filter(p => p[0] === d);
  if (!ms.length) throw new Error('El DNI ' + d + ' no figura en el listado de personal activo.');
  if (empresa) {
    const e = ms.filter(p => p[3] === empresa);
    if (e.length) ms = e;
  }
  return ms[0];
}

/* ======================= DATOS DE STOCK MANAGER Y NOVEDADES ======================= */

// Servicios = pestaña objetivos de Stock Manager, menos los que terminan en "baja"
function getServicios_(forzar) {
  if (!forzar) { const c = cacheGet_('servicios'); if (c) return c; }
  const sh = SpreadsheetApp.openById(CFG.STOCK_MANAGER_ID).getSheetByName(CFG.HOJA_OBJETIVOS);
  if (!sh) throw new Error('No encuentro la pestaña "' + CFG.HOJA_OBJETIVOS + '" en Stock Manager.');
  const v = sh.getDataRange().getDisplayValues();
  const h = v[0].map(x => norm_(x));
  const iId = h.indexOf('id'), iNom = h.indexOf('nombre');
  if (iNom < 0) throw new Error('La pestaña objetivos no tiene la columna nombre.');
  const out = [], vistos = {};
  v.slice(1).forEach(r => {
    const nombre = String(r[iNom]).trim();
    if (!nombre || /\bbaja\s*$/i.test(nombre) || vistos[norm_(nombre)]) return;
    vistos[norm_(nombre)] = 1;
    out.push({ id: iId >= 0 ? String(r[iId]).trim() : nombre, nombre: nombre });
  });
  out.sort((a, b) => a.nombre.localeCompare(b.nombre));
  cachePut_('servicios', out, CFG.CACHE_SEG);
  return out;
}

function servicioPorNombre_(n) {
  return getServicios_().filter(s => s.nombre === n || s.id === String(n))[0] || null;
}

function getCodigos_() {
  const sh = ss_().getSheetByName(HOJAS.COD);
  const v = sh ? sh.getDataRange().getDisplayValues().slice(1) : CODIGOS_INICIALES;
  return v.filter(r => String(r[0]).trim()).map(r => [String(r[0]).trim().toUpperCase(), String(r[1]).trim()]);
}

function encargadosHoja_() {
  const sh = ss_().getSheetByName(HOJAS.ENC);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({ usuario: String(r[0]).trim().toLowerCase(), servicios: String(r[1]).split(/[,;\n]+/).map(x => x.trim()).filter(Boolean) }));
}

// Devuelve [dni, nombre, legajo, empresa] del personal que no está de BAJA
function leerPersonal_(forzar) {
  if (!forzar) {
    const c = cacheGet_('personal');
    if (c) return c;
  }
  const ss = SpreadsheetApp.openById(CFG.STOCK_MANAGER_ID);
  const sh = ss.getSheets().filter(s => s.getSheetId() === CFG.PERSONAL_GID)[0];
  if (!sh) throw new Error('No encuentro la pestaña de personal en Stock Manager.');
  const v = sh.getDataRange().getDisplayValues();
  let hr = -1;
  for (let i = 0; i < Math.min(10, v.length); i++) {
    if (v[i].some(c => /dni|documento/i.test(c))) { hr = i; break; }
  }
  if (hr < 0) throw new Error('La pestaña de personal no tiene una columna DNI.');
  const h = v[hr].map(x => norm_(x));
  const col = (exactos, contiene) => {
    let i = h.findIndex(x => exactos.indexOf(x) >= 0);
    if (i < 0 && contiene) i = h.findIndex(x => contiene.some(k => x.indexOf(k) >= 0));
    return i;
  };
  const iDni = col(['dni'], ['dni', 'documento']);
  const iNom = col(['apellido y nombre', 'nombre y apellido', 'nombre', 'nombres'], ['nombre']);
  const iApe = col(['apellido', 'apellidos'], null);
  const iLeg = col(['legajo', 'leg'], ['legajo']);
  const iEmp = col(['empresa'], ['empresa']);
  const iEst = col(['estado'], ['estado']);
  const out = [];
  for (let i = hr + 1; i < v.length; i++) {
    const r = v[i];
    const dni = limpiarDni_(r[iDni]);
    if (!dni || /^9{7,}$/.test(dni)) continue;
    if (iEst >= 0 && /baja/i.test(r[iEst])) continue;
    let nombre = iNom >= 0 ? String(r[iNom]).trim() : '';
    if (iApe >= 0 && iApe !== iNom) nombre = (String(r[iApe]).trim() + ' ' + nombre).trim();
    out.push([dni, nombre.toUpperCase(), iLeg >= 0 ? String(r[iLeg]).trim() : '', iEmp >= 0 ? String(r[iEmp]).trim() : '']);
  }
  out.sort((a, b) => a[1].localeCompare(b[1]));
  cachePut_('personal', out, CFG.CACHE_SEG);
  return out;
}

function leerUsuarios_() {
  const sh = SpreadsheetApp.openById(CFG.STOCK_MANAGER_ID).getSheetByName(CFG.HOJA_USUARIOS);
  if (!sh) throw new Error('No encuentro la pestaña "' + CFG.HOJA_USUARIOS + '" en Stock Manager.');
  const v = sh.getDataRange().getDisplayValues();
  const h = v[0].map(x => norm_(x));
  const f = keys => h.findIndex(x => keys.some(k => x.indexOf(k) >= 0));
  const iU = f(['usuario']), iP = f(['password', 'contrasena', 'clave']), iR = f(['rol', 'perfil']);
  const iN = h.indexOf('nombre') >= 0 ? h.indexOf('nombre') : f(['nombre']);
  const iC = f(['correo', 'mail']);
  if (iU < 0 || iP < 0) throw new Error('La pestaña de usuarios no tiene columnas usuario / password.');
  return v.slice(1).filter(r => String(r[iU]).trim()).map(r => ({
    usuario: String(r[iU]).trim(),
    pass: String(r[iP]),
    rol: iR >= 0 ? String(r[iR]).trim() : '',
    nombre: iN >= 0 && String(r[iN]).trim() ? String(r[iN]).trim() : String(r[iU]).trim(),
    correo: iC >= 0 ? String(r[iC]).trim() : ''
  }));
}

// Correos del servicio = columna correo del usuario con rol Servicios que tiene el mismo nombre
function correosServicio_(nombreServicio) {
  const out = [];
  leerUsuarios_().filter(u => norm_(u.rol).indexOf('servicio') >= 0 && norm_(u.nombre) === norm_(nombreServicio))
    .forEach(u => String(u.correo).split(/[;,\s]+/).forEach(c => { c = c.trim(); if (/@/.test(c) && out.indexOf(c) < 0) out.push(c); }));
  return out;
}

// Personal actual del servicio: el de la planilla de novedades semanales del período actual
// (o el anterior si todavía no hay nada) + los que tuvieron presentes ahí en los últimos días.
function personalActual_(serv) {
  const key = 'act_' + serv.id;
  const c = cacheGet_(key);
  if (c) return c;
  const set = {};
  if (CFG.NOVEDADES_BASE_ID) {
    try {
      const ss = SpreadsheetApp.openById(CFG.NOVEDADES_BASE_ID);
      const sv = ss.getSheetByName('Servicios').getDataRange().getDisplayValues();
      const hs = sv[0];
      const iId = hs.indexOf('Id'), iObj = hs.indexOf('ObjetivoId'), iCli = hs.indexOf('Cliente'), iSer = hs.indexOf('Servicio');
      const ids = {};
      sv.slice(1).forEach(r => {
        if ((iObj >= 0 && String(r[iObj]).trim() === serv.id) ||
          (iCli >= 0 && norm_(r[iCli]) === norm_(serv.nombre)) ||
          (iSer >= 0 && norm_(r[iSer]) === norm_(serv.nombre))) ids[String(r[iId]).trim()] = 1;
      });
      const pl = ss.getSheetByName('Planilla');
      const last = pl ? pl.getLastRow() : 0;
      if (last > 1 && Object.keys(ids).length) {
        const hp = pl.getRange(1, 1, 1, pl.getLastColumn()).getDisplayValues()[0];
        const iP = hp.indexOf('Periodo'), iS = hp.indexOf('ServicioId'), iL = hp.indexOf('Legajo'), iN = hp.indexOf('Nombre');
        const v = pl.getRange(2, 1, last - 1, Math.max(iP, iS, iL, iN) + 1).getDisplayValues();
        const per = periodoDe_(hoyStr_(0));
        let filas = v.filter(r => ids[String(r[iS]).trim()] && r[iP] === per);
        if (!filas.length) filas = v.filter(r => ids[String(r[iS]).trim()] && r[iP] === periodoAnterior_(per));
        const pers = leerPersonal_();
        filas.forEach(r => {
          const nom = norm_(r[iN]), leg = String(r[iL]).trim();
          let m = pers.filter(p => norm_(p[1]) === nom);
          if (m.length > 1 && leg) { const ml = m.filter(p => p[2] === leg); if (ml.length) m = ml; }
          if (!m.length && leg) m = pers.filter(p => p[2] === leg && norm_(p[1]).split(' ')[0] === nom.split(' ')[0]);
          m.forEach(p => set[p[0]] = 1);
        });
      }
    } catch (e) {
      Logger.log('Novedades del Personal - Base: ' + e.message);
    }
  }
  const desde = hoyStr_(-CFG.DIAS_HABITUALES);
  leerRegistros_(hoja_(HOJAS.PRES), 10000).forEach(r => {
    if (r.servicio === serv.nombre && r.fecha >= desde && r.estado !== 'ANULADO') set[r.dni] = 1;
  });
  const out = Object.keys(set);
  cachePut_(key, out, CFG.CACHE_SEG);
  return out;
}

/* ======================= HORARIOS, PERÍODOS Y FECHAS ======================= */

function minHHMM_(s) {
  const m = String(s == null ? '' : s).trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function hhmm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'HH:mm');
  const m = minHHMM_(v);
  return m == null ? '' : ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
}

// Intervalo absoluto en minutos; si la salida es menor o igual a la entrada, termina al día siguiente
function intervalo_(fecha, ent, sal) {
  const a = minHHMM_(ent), b0 = minHHMM_(sal);
  if (a == null || b0 == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return null;
  const b = b0 <= a ? b0 + 1440 : b0;
  const base = diaNum_(fecha) * 1440;
  return { ini: base + a, fin: base + b };
}

// Horas diurnas (06 a 21) y nocturnas (21 a 06) de un horario
function horasDN_(ent, sal) {
  const a = minHHMM_(ent);
  let b = minHHMM_(sal);
  if (a == null || b == null) return { d: 0, n: 0 };
  if (b <= a) b += 1440;
  let d = 0;
  [0, 1440].forEach(dia => {
    const i = Math.max(a, dia + CFG.DIURNO_DESDE), f = Math.min(b, dia + CFG.DIURNO_HASTA);
    if (f > i) d += f - i;
  });
  return { d: r2_(d / 60), n: r2_((b - a - d) / 60) };
}

// Período del 26 al 25: "2026-09" = 26/09/2026 al 25/10/2026 (igual que Novedades del Personal)
function periodoDe_(f) {
  const p = String(f).split('-');
  let y = +p[0], m = +p[1];
  if (+p[2] < 26) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + ('0' + m).slice(-2);
}
function periodoRango_(per) {
  const p = String(per).split('-');
  const y = +p[0], m = +p[1];
  let y2 = y, m2 = m + 1;
  if (m2 > 12) { m2 = 1; y2++; }
  return { desde: y + '-' + ('0' + m).slice(-2) + '-26', hasta: y2 + '-' + ('0' + m2).slice(-2) + '-25' };
}
function periodoAnterior_(per) {
  const p = String(per).split('-');
  let y = +p[0], m = +p[1] - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + ('0' + m).slice(-2);
}

function hoyStr_(off) { return Utilities.formatDate(new Date(Date.now() + (off || 0) * 864e5), CFG.TZ, 'yyyy-MM-dd'); }
function diaNum_(s) { const p = String(s).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
function sumarDias_(s, n) { return Utilities.formatDate(new Date((diaNum_(s) + n) * 864e5), 'UTC', 'yyyy-MM-dd'); }
function diasEntre_(a, b) { return diaNum_(b) - diaNum_(a); }
function fmtDia_(s) { const p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(s); }
function aFecha_(s) { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function fechaStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return String(v);
}
function minutosAhora_() {
  const t = Utilities.formatDate(new Date(Date.now()), CFG.TZ, 'HH:mm').split(':');
  return (+t[0]) * 60 + (+t[1]);
}
function nuevoId_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase(); }
function limpiarDni_(v) { return String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, ''); }
function norm_(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function num_(v) {
  if (v instanceof Date) return r2_((v.getTime() - Date.UTC(1899, 11, 30)) / 864e5);
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function r2_(n) { return Math.round(n * 100) / 100; }
function fmtH_(n) { return String(r2_(n)).replace('.', ','); }
function escH_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ======================= CACHÉ (en partes, por el límite de 100 KB) ======================= */

function cachePut_(key, obj, seg) {
  const c = CacheService.getScriptCache();
  const s = JSON.stringify(obj);
  const size = 45000, o = {};
  let n = 0;
  for (let i = 0; i < s.length; i += size) { o[key + '_' + n] = s.substr(i, size); n++; }
  o[key + '_n'] = String(n);
  try { c.putAll(o, seg); } catch (e) { /* si no entra en caché se relee la próxima vez */ }
}

function cacheGet_(key) {
  const c = CacheService.getScriptCache();
  const n = +c.get(key + '_n');
  if (!n) return null;
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const m = c.getAll(keys);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (m[keys[i]] == null) return null;
    s += m[keys[i]];
  }
  try { return JSON.parse(s); } catch (e) { return null; }
}
