/* ============================================================
   MINUTA OPERATIVA DEL SERVICIO — Backend (Google Apps Script)
   Se publica como "Aplicación web" y la app (GitHub Pages) lo llama
   por POST con JSON. Todo responde JSON.
   Implementar con la cuenta delbensgi@gmail.com para que los correos
   salgan desde esa cuenta.
   ============================================================ */

const CONFIG = {
  // Planilla "Minuta Operativa" (donde se guardan las minutas)
  SS_MINUTA: '1Wn07P83h02NRdnDC0EpLFSrUpMdaSt1M5iMk8s0hmoM',

  // Stock Manager / SGI: usuarios, personal y objetivos
  SS_SGI: '1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY',
  USUARIOS_GID: 310678371,      // id | nombre | usuario | password | rol | correo
  PERSONAL_GID: 1959223792,     // pestaña "personal"
  OBJETIVOS_GID: 1642036355,    // pestaña "objetivos" (dirección, localidad y empresa de cada servicio)

  // Condiciones (códigos de francos y licencias): solo hasta la fila 17
  SS_CODIGOS: '1fZj6ItMB60XCp8tcLhTJQoeOt4ELMku6',
  CODIGOS_GID: 1303783835,
  CODIGOS_ULTIMA_FILA: 17,

  // Carpeta de Drive de las minutas (adentro se crea una subcarpeta por servicio)
  CARPETA_ID: '1CJYCaVoEv5ZfpN-6QIYV-0-Io2MGup01',

  // Usuarios que reciben SIEMPRE copia de todas las minutas (columna "usuario" de Usuarios y contraseñas)
  SIEMPRE_COPIA: ['gsanmartin', 'fjacyno'],
  JEFE_OPERACIONES: 'gsanmartin',

  // Roles que ven y cargan todos los servicios
  ROLES_TODOS: ['administrador', 'visor'],

  // MODO PRUEBA: mientras esté en true, TODOS los correos van solo a CORREO_PRUEBA
  // (el mail dice a quiénes se hubiera enviado). Cuando esté todo bien, poner false.
  MODO_PRUEBA: true,
  CORREO_PRUEBA: 'fjacyno@ktl-seguridad.com',

  REMITENTE: 'Delben - Minuta Operativa',
  ZONA: 'America/Argentina/Buenos_Aires',
  HORAS_SESION: 16
};

// Si la planilla de condiciones no se puede abrir, se usan estos (filas 2 a 17).
const CODIGOS_FIJOS = [
  ['F', 'Franco'], ['FCO', 'Franco'], ['VAC', 'Vacaciones'], ['ENF', 'Enfermedad'], ['ART', 'ART'],
  ['INJ', 'Injustificado'], ['LSG', 'Licencia sin goce de sueldo'], ['DV', 'Día del Vigilador'],
  ['SUS', 'Suspendido'], ['NAC', 'Nacimiento'], ['MAT', 'Maternidad'], ['FALL', 'Licencia por fallecimiento'],
  ['RES', 'Reserva de puesto'], ['CAS', 'Licencia por casamiento'], ['BAJA', 'Baja'], ['PRAC', 'Práctica']
];

const EMPRESAS_SIGLA = {
  'P.P.Q. SA': 'PPQ', 'PPQ': 'PPQ',
  'KONTROL DEFENSA ELECTRONICA S.A.': 'KDE', 'KDE': 'KDE',
  'L E GUYET SERVICIOS DE SEGURIDAD S.R.L.': 'LEGUYET', 'LE GUYET': 'LEGUYET', 'LEGUYET': 'LEGUYET',
  'LEG S.R.L.': 'LEG', 'LEG': 'LEG'
};

// Encabezados de cada pestaña. Si falta alguna columna, se agrega sola al final de la fila 1.
const TABS = {
  Minutas: ['idMinuta', 'fechaCarga', 'fecha', 'dia', 'turno', 'horario', 'idServicio', 'servicio', 'empresa', 'localidad',
    'supervisor', 'jefeOperaciones', 'encargado', 'horaInicio', 'responsableInicio', 'detalleInicio', 'horaFin', 'entregaA',
    'observacionesFinales', 'novedadesRelevantes', 'usuario', 'estado', 'urlPDF', 'idPDF', 'correosEnviados', 'fechaEnvio',
    'guardia', 'tituloInforme'],
  Minuta_Personal: ['idMinuta', 'fecha', 'turno', 'servicio', 'legajo', 'apellidoNombre', 'empresa', 'puesto', 'horaIngreso',
    'horaEgreso', 'horas', 'codigo', 'observacion', 'horasDiurnas', 'horasNocturnas'],
  Minuta_Novedades: ['idMinuta', 'fecha', 'turno', 'servicio', 'hora', 'seccion', 'personal', 'accion', 'detalle', 'resultado'],
  Minuta_Rondines: ['idMinuta', 'fecha', 'turno', 'servicio', 'horaInicio', 'horaReporte', 'vigilador', 'sector', 'resultado',
    'modo', 'horaFin', 'qr'],
  Minuta_Vehiculos: ['idMinuta', 'fecha', 'turno', 'servicio', 'vehiculo', 'dominio', 'kmInicio', 'kmFin', 'kmTotal', 'gnc',
    'combustible', 'vigilador'],
  Minuta_Equipos: ['idMinuta', 'fecha', 'turno', 'servicio', 'equipo', 'estado', 'observaciones'],
  Minuta_Fotos: ['idMinuta', 'fecha', 'servicio', 'nroFoto', 'descripcion', 'urlFoto', 'idArchivo'],
  Config_Servicios: ['idServicio', 'servicio', 'direccion', 'localidad', 'empresa', 'usuario', 'supervisor', 'jefeOperaciones',
    'horarioDiurno', 'horarioNocturno', 'secciones', 'vehiculos', 'equipos', 'correos', 'idCarpeta', 'logoCliente', 'activo'],
  Minuta_Contactos: ['idServicio', 'servicio', 'nombre', 'correo', 'fechaAlta', 'usuario']
};

const SECCIONES_BASE = ['Supervisión KTL', 'Novedades de CCTV', 'Ingresos y egresos', 'Otras novedades del servicio'];

// Logo de cada cliente según el nombre del servicio (archivos en assets/logos/ del GitHub).
// Para un cliente nuevo: subir el logo y agregar una línea acá.
const LOGOS = [
  [/arauco/, 'assets/logos/arauco.png'],
  [/raizen/, 'assets/logos/raizen.png'],
  [/san francisco/, 'assets/logos/san-francisco.png'],
  [/fincas/, 'assets/logos/fincas-de-iraola-2.png'],
  [/laguna grande/, 'assets/logos/laguna-grande.png'],
  [/ailinco/, 'assets/logos/ailinco.png']
];
function logoPorNombre_(nombre) {
  const n = norm_(nombre);
  const x = LOGOS.find(l => l[0].test(n));
  return x ? x[1] : '';
}

// Texto debajo del logo: en Arauco va la planta (Vicente López, Zárate, Oasis, Misiones…)
const PLANTAS = { 'vicente lopez': 'Vicente López', 'zarate': 'Zárate', 'oasis': 'Oasis', 'misiones': 'Misiones' };
function textoLogo_(nombre) {
  const n = norm_(nombre);
  if (!/arauco/.test(n)) return '';
  const resto = n.replace(/arauco/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!resto) return '';
  return PLANTAS[resto] || resto.replace(/\b\w/g, c => c.toUpperCase());
}

/* ======================= Entradas web ======================= */

function doGet() {
  return json_({ ok: true, msg: 'API Minuta Operativa funcionando', version: '2026-10-20' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json_({ ok: false, error: 'La petición llegó vacía.' });
    const req = JSON.parse(e.postData.contents);
    switch (req.action) {
      case 'login':     return json_(login_(req));
      case 'inicio':    return json_(inicio_(sesion_(req.token)));
      case 'guardar':   return json_(guardar_(sesion_(req.token), req));
      case 'buscar':    return json_(buscar_(sesion_(req.token), req));
      case 'pdf':       return json_(pdf_(sesion_(req.token), req));
      case 'reenviar':  return json_(reenviar_(sesion_(req.token), req));
      default:          return json_({ ok: false, error: 'Acción desconocida: ' + String(req.action || '') });
    }
  } catch (err) {
    const m = String(err && err.message || err);
    return json_({ ok: false, error: m, sesionVencida: /SESION_VENCIDA/.test(m) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= Utilidades ======================= */

function norm_(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function hoy_(fmt) { return Utilities.formatDate(new Date(), CONFIG.ZONA, fmt || 'dd/MM/yyyy HH:mm'); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function lista_(s) { return String(s || '').split(/\s*[;\n]\s*/).map(x => x.trim()).filter(Boolean); }
function emails_(arr) {
  return [].concat.apply([], (arr || []).map(s => String(s || '').split(/[;,\s]+/)))
    .map(s => s.trim().toLowerCase()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    .filter((s, i, a) => a.indexOf(s) === i);
}

function hojaGid_(ssId, gid) {
  const ss = SpreadsheetApp.openById(ssId);
  const sh = ss.getSheets().find(s => s.getSheetId() === Number(gid));
  if (!sh) throw new Error('No se encontró la pestaña con gid ' + gid);
  return sh;
}

function ssMinuta_() { return SpreadsheetApp.openById(CONFIG.SS_MINUTA); }

// Devuelve la pestaña con los encabezados completos (agrega los que falten al final).
function tab_(nombre) {
  const ss = ssMinuta_();
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  const quiero = TABS[nombre];
  const lastCol = Math.max(1, sh.getLastColumn());
  const actual = sh.getLastRow() ? sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h).trim()) : [];
  const faltan = quiero.filter(h => actual.indexOf(h) < 0);
  if (faltan.length) {
    let col = actual.filter(String).length ? actual.length + 1 : 1;
    if (!actual.filter(String).length) { col = 1; }
    if (sh.getMaxColumns() < col + faltan.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), col + faltan.length - 1 - sh.getMaxColumns());
    sh.getRange(1, col, 1, faltan.length).setValues([faltan]).setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function encabezados_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(h => String(h).trim());
}

// Lee una pestaña como lista de objetos {encabezado: valor}
function leerObjetos_(nombre) {
  const sh = tab_(nombre);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const head = encabezados_(sh);
  return sh.getRange(2, 1, last - 1, head.length).getDisplayValues().map(r => {
    const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i]; }); return o;
  });
}

// Agrega filas (objetos) respetando el orden real de las columnas de la hoja
function agregarFilas_(nombre, objetos) {
  if (!objetos.length) return;
  const sh = tab_(nombre);
  const head = encabezados_(sh);
  const filas = objetos.map(o => head.map(h => (o[h] == null ? '' : o[h])));
  const desde = sh.getLastRow() + 1;
  const rango = sh.getRange(desde, 1, filas.length, head.length);
  rango.setNumberFormat('@');
  rango.setValues(filas);
}

/* ======================= Sesión ======================= */

function secreto_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SECRETO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRETO', s); }
  return s;
}
function b64_(s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); }
function firma_(txt) { return b64_(Utilities.computeHmacSha256Signature(txt, secreto_())); }

function crearToken_(usuario) {
  const cuerpo = b64_(JSON.stringify({ u: usuario, x: Date.now() + CONFIG.HORAS_SESION * 3600 * 1000 }));
  return cuerpo + '.' + firma_(cuerpo);
}

function sesion_(token) {
  const p = String(token || '').split('.');
  if (p.length !== 2 || firma_(p[0]) !== p[1]) throw new Error('SESION_VENCIDA: volvé a ingresar.');
  let d;
  try { d = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0])).getDataAsString()); }
  catch (e) { throw new Error('SESION_VENCIDA: volvé a ingresar.'); }
  if (!d.x || d.x < Date.now()) throw new Error('SESION_VENCIDA: la sesión venció, volvé a ingresar.');
  const u = usuarios_().find(x => x.usuario === d.u);
  if (!u) throw new Error('SESION_VENCIDA: el usuario ya no existe.');
  return u;
}

/* ======================= Datos de SGI ======================= */

// Usuarios (sin contraseñas, salvo para validar el login)
function usuarios_(conClave) {
  const vals = hojaGid_(CONFIG.SS_SGI, CONFIG.USUARIOS_GID).getDataRange().getDisplayValues();
  if (vals.length < 2) return [];
  const h = vals[0].map(x => norm_(x));
  const c = n => h.indexOf(n);
  const iN = c('nombre') >= 0 ? c('nombre') : 1, iU = c('usuario') >= 0 ? c('usuario') : 2;
  const iP = c('password') >= 0 ? c('password') : 3, iR = c('rol') >= 0 ? c('rol') : 4, iM = c('correo') >= 0 ? c('correo') : 5;
  return vals.slice(1).filter(r => String(r[iU] || '').trim()).map(r => {
    const o = {
      nombre: String(r[iN] || '').trim(), usuario: String(r[iU] || '').trim().toLowerCase(),
      rol: String(r[iR] || '').trim(), correo: String(r[iM] || '').trim()
    };
    if (conClave) o.password = String(r[iP] || '').trim().replace(/\.0$/, '');
    return o;
  });
}

function personal_() {
  const cache = CacheService.getScriptCache();
  try {
    const n = Number(cache.get('mo_pers_n') || 0);
    if (n > 0) {
      const partes = cache.getAll(Array.from({ length: n }, (_, i) => 'mo_pers_' + i));
      if (Object.keys(partes).length === n) return JSON.parse(Array.from({ length: n }, (_, i) => partes['mo_pers_' + i]).join(''));
    }
  } catch (e) {}
  const vals = hojaGid_(CONFIG.SS_SGI, CONFIG.PERSONAL_GID).getDataRange().getDisplayValues();
  const h = vals[0].map(x => norm_(x));
  const iE = h.indexOf('estado'), iN = h.indexOf('nombre'), iL = h.indexOf('legajo'), iEmp = h.indexOf('empresa'),
    iCat = h.indexOf('categoria'), iM = h.indexOf('correo');
  const lista = [];
  vals.slice(1).forEach(r => {
    const nombre = String(r[iN] || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const legajo = String(r[iL] || '').trim();
    if (!nombre || !legajo) return;
    if (iE >= 0 && /^baja/.test(norm_(r[iE]))) return;
    const emp = String(r[iEmp] || '').trim();
    lista.push({ n: nombre, l: legajo, e: EMPRESAS_SIGLA[emp.toUpperCase()] || emp, c: iCat >= 0 ? String(r[iCat] || '').trim() : '', m: iM >= 0 ? String(r[iM] || '').trim() : '' });
  });
  lista.sort((a, b) => a.n.localeCompare(b.n, 'es'));
  try {
    const txt = JSON.stringify(lista), TAM = 90000, obj = {};
    let i = 0;
    for (let k = 0; k < txt.length; k += TAM, i++) obj['mo_pers_' + i] = txt.slice(k, k + TAM);
    obj.mo_pers_n = String(i);
    cache.putAll(obj, 900);
  } catch (e) {}
  return lista;
}

function codigos_() {
  try {
    const vals = hojaGid_(CONFIG.SS_CODIGOS, CONFIG.CODIGOS_GID).getRange(2, 1, CONFIG.CODIGOS_ULTIMA_FILA - 1, 2).getDisplayValues();
    const out = vals.filter(r => String(r[0]).trim()).map(r => ({ codigo: String(r[0]).trim(), descripcion: String(r[1]).trim() }));
    if (out.length) return out;
  } catch (e) { console.warn('Códigos: se usan los fijos (' + e.message + ')'); }
  return CODIGOS_FIJOS.map(r => ({ codigo: r[0], descripcion: r[1] }));
}

/* ======================= Servicios ======================= */

function servicios_() {
  return leerObjetos_('Config_Servicios')
    .filter(s => s.servicio && !/^(no|n|false|0|inactivo)$/i.test(String(s.activo || 'SI').trim()))
    .map(s => ({
      idServicio: s.idServicio || s.servicio, servicio: s.servicio, direccion: s.direccion, localidad: s.localidad,
      empresa: s.empresa, usuario: String(s.usuario || '').toLowerCase().trim(), supervisor: s.supervisor,
      jefeOperaciones: s.jefeOperaciones, horarioDiurno: s.horarioDiurno || '07:00 a 19:00',
      horarioNocturno: s.horarioNocturno || '19:00 a 07:00',
      secciones: lista_(s.secciones).length ? lista_(s.secciones) : SECCIONES_BASE,
      vehiculos: lista_(s.vehiculos).map(v => { const p = v.split('|'); return { vehiculo: (p[0] || '').trim(), dominio: (p[1] || '').trim() }; }),
      equipos: lista_(s.equipos), correos: s.correos, idCarpeta: s.idCarpeta,
      logoCliente: s.logoCliente || logoPorNombre_(s.servicio),
      logoTexto: textoLogo_(s.servicio)
    }));
}

// Objetivos de SGI (para completar dirección, localidad y empresa de un servicio nuevo)
function objetivo_(nombre) {
  try {
    const vals = hojaGid_(CONFIG.SS_SGI, CONFIG.OBJETIVOS_GID).getDataRange().getDisplayValues();
    const h = vals[0].map(x => norm_(x)), n = norm_(nombre);
    const iN = h.indexOf('nombre'), iD = h.indexOf('dir'), iL = h.indexOf('localidad'), iE = h.indexOf('empresa');
    const r = vals.slice(1).find(x => norm_(x[iN]) === n) || vals.slice(1).find(x => norm_(x[iN]) && (n.indexOf(norm_(x[iN])) >= 0 || norm_(x[iN]).indexOf(n) >= 0));
    if (!r) return {};
    const emp = String(r[iE] || '').trim();
    return { direccion: r[iD], localidad: r[iL], empresa: EMPRESAS_SIGLA[emp.toUpperCase()] || emp };
  } catch (e) { return {}; }
}

// El servicio de un usuario con rol "Servicios": el nombre del servicio es el nombre del usuario en SGI.
// Si todavía no está en Config_Servicios, se agrega solo (con los datos de objetivos).
function servicioPropio_(u) {
  if (norm_(u.rol) !== 'servicios') return null;
  const todos = servicios_();
  let s = todos.find(x => x.usuario && lista_(x.usuario.replace(/,/g, ';')).indexOf(u.usuario) >= 0);
  if (!s) {
    const o = objetivo_(u.nombre);
    agregarFilas_('Config_Servicios', [{
      idServicio: u.usuario.toUpperCase(), servicio: u.nombre, direccion: o.direccion || '', localidad: o.localidad || '',
      empresa: o.empresa || '', usuario: u.usuario, supervisor: '', jefeOperaciones: CONFIG.JEFE_OPERACIONES,
      horarioDiurno: '07:00 a 19:00', horarioNocturno: '19:00 a 07:00', secciones: SECCIONES_BASE.join('; '),
      equipos: 'Celulares; Equipos HT', activo: 'SI'
    }]);
    s = servicios_().find(x => x.usuario === u.usuario);
  }
  return s || null;
}

// Servicios que puede ver/cargar cada usuario
// - Rol Servicios: solo su servicio (carga minutas y ve sus informes).
// - Supervisor: los servicios donde figura como supervisor (solo informes).
// - Administrador / Visor: todos (solo informes).
function serviciosDe_(u) {
  const rol = norm_(u.rol);
  if (rol === 'servicios') { const s = servicioPropio_(u); return s ? [s] : []; }
  const todos = servicios_();
  if (CONFIG.ROLES_TODOS.indexOf(rol) >= 0) return todos;
  return todos.filter(s => rol === 'supervisor' && norm_(s.supervisor) && (norm_(s.supervisor) === u.usuario || norm_(s.supervisor) === norm_(u.nombre)));
}

// Persona de Usuarios a partir de un usuario o un nombre
function persona_(valor, us) {
  const v = norm_(valor);
  if (!v) return null;
  return (us || usuarios_()).find(x => x.usuario === v || norm_(x.nombre) === v) || null;
}

/* ======================= Login e inicio ======================= */

function login_(req) {
  const u = String(req.usuario || '').trim().toLowerCase();
  const p = String(req.password || '').trim();
  if (!u || !p) return { ok: false, error: 'Completá usuario y contraseña.' };
  const x = usuarios_(true).find(r => r.usuario === u && r.password === p);
  if (!x) return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  delete x.password;
  if (!serviciosDe_(x).length) return { ok: false, error: 'Tu usuario no tiene servicios asignados en la Minuta Operativa. Avisale a Fernando.' };
  const r = inicio_(x);
  r.token = crearToken_(x.usuario);
  return r;
}

function inicio_(u) {
  const us = usuarios_();
  const servs = serviciosDe_(u);
  const contactos = leerObjetos_('Minuta_Contactos');
  const sup = us.filter(x => norm_(x.rol) === 'supervisor').map(x => ({ nombre: x.nombre, usuario: x.usuario, correo: x.correo }));
  const fijos = CONFIG.SIEMPRE_COPIA.map(k => persona_(k, us)).filter(Boolean).map(x => ({ nombre: x.nombre, correo: x.correo }));
  const jefe = persona_(CONFIG.JEFE_OPERACIONES, us);
  return {
    ok: true,
    usuario: { nombre: u.nombre, usuario: u.usuario, rol: u.rol, correo: u.correo },
    cargaMinutas: norm_(u.rol) === 'servicios',
    modoPrueba: !!CONFIG.MODO_PRUEBA, correoPrueba: CONFIG.MODO_PRUEBA ? CONFIG.CORREO_PRUEBA : '',
    servicios: servs.map(s => {
      const ps = persona_(s.supervisor, us), pj = persona_(s.jefeOperaciones, us) || jefe;
      return {
        idServicio: s.idServicio, servicio: s.servicio, direccion: s.direccion, localidad: s.localidad, empresa: s.empresa,
        supervisor: ps ? { nombre: ps.nombre, usuario: ps.usuario, correo: ps.correo } : { nombre: s.supervisor || '', usuario: '', correo: '' },
        jefeOperaciones: pj ? pj.nombre : (s.jefeOperaciones || ''),
        horarioDiurno: s.horarioDiurno, horarioNocturno: s.horarioNocturno, secciones: s.secciones,
        vehiculos: s.vehiculos, equipos: s.equipos, logoCliente: s.logoCliente || '', logoTexto: s.logoTexto || '',
        contactos: contactos.filter(c => String(c.idServicio) === String(s.idServicio) && c.correo).map(c => ({ nombre: c.nombre, correo: c.correo }))
      };
    }),
    supervisores: sup,
    fijos: fijos,
    personal: personal_().map(p => ({ n: p.n, l: p.l, e: p.e, c: p.c })),   // sin correos
    codigos: codigos_()
  };
}

/* ======================= Guardar y enviar ======================= */

function carpetaServicio_(s) {
  if (s.idCarpeta) { try { return DriveApp.getFolderById(s.idCarpeta); } catch (e) {} }
  let raiz;
  try { raiz = DriveApp.getFolderById(CONFIG.CARPETA_ID); }
  catch (e) { throw new Error('No se puede abrir la carpeta de minutas en Drive (' + e.message + '). Verificá que esté compartida con la cuenta que implementó el script.'); }
  const it = raiz.getFoldersByName(s.servicio);
  return it.hasNext() ? it.next() : raiz.createFolder(s.servicio);
}

function subcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function nuevoId_() {
  const sh = tab_('Minutas');
  const last = sh.getLastRow();
  let max = 0;
  if (last > 1) {
    const head = encabezados_(sh), c = head.indexOf('idMinuta') + 1;
    sh.getRange(2, c, last - 1, 1).getDisplayValues().forEach(r => { max = Math.max(max, parseInt(String(r[0]).replace(/\D/g, ''), 10) || 0); });
  }
  return 'MO-' + ('00000' + (max + 1)).slice(-6);
}

function guardar_(u, req) {
  const d = req.data || {};
  const s = norm_(u.rol) === 'servicios' ? servicioPropio_(u) : null;
  if (!s || String(s.idServicio) !== String(d.idServicio)) throw new Error('Las minutas se cargan entrando con el usuario del servicio.');
  if (!d.fecha || !d.turno) throw new Error('Faltan la fecha o el turno.');
  if (!req.pdfBase64) throw new Error('No llegó el PDF.');

  const us = usuarios_();
  const titulo = String(d.titulo || (s.servicio + ' ' + d.fecha.replace(/\//g, '-') + ' ' + d.turno)).replace(/[\\/:*?"<>|]/g, '-');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let id;
  try {
    id = nuevoId_();
    // Fila "reservada" para que nadie más tome el mismo número
    agregarFilas_('Minutas', [{ idMinuta: id, fechaCarga: hoy_(), fecha: d.fecha, turno: d.turno, idServicio: s.idServicio, servicio: s.servicio, usuario: u.usuario, estado: 'GUARDANDO' }]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }

  // PDF y fotos en Drive
  const carpeta = carpetaServicio_(s);
  let nombrePdf = titulo + '.pdf';
  if (carpeta.getFilesByName(nombrePdf).hasNext()) nombrePdf = titulo + ' (' + id + ').pdf';
  const pdfFile = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(req.pdfBase64), 'application/pdf', nombrePdf));

  const fotos = (req.fotos || []).filter(f => f && f.b64);
  const filasFotos = [];
  if (fotos.length) {
    const cf = subcarpeta_(subcarpeta_(carpeta, 'Fotos'), titulo + ' ' + id);
    fotos.forEach((f, i) => {
      const file = cf.createFile(Utilities.newBlob(Utilities.base64Decode(f.b64), 'image/jpeg', ('0' + (i + 1)).slice(-2) + '.jpg'));
      filasFotos.push({ idMinuta: id, fecha: d.fecha, servicio: s.servicio, nroFoto: i + 1, descripcion: f.descripcion || '', urlFoto: file.getUrl(), idArchivo: file.getId() });
    });
  }

  // Detalle en las pestañas
  const base = { idMinuta: id, fecha: d.fecha, turno: d.turno, servicio: s.servicio };
  agregarFilas_('Minuta_Personal', (d.personal || []).map(p => Object.assign({}, base, {
    legajo: p.legajo, apellidoNombre: p.nombre, empresa: p.empresa, puesto: p.puesto, horaIngreso: p.ingreso, horaEgreso: p.egreso,
    horas: p.horas, horasDiurnas: p.diurnas, horasNocturnas: p.nocturnas, codigo: p.codigo || '', observacion: p.observacion
  })).concat((d.ausentes || []).map(p => Object.assign({}, base, {
    legajo: p.legajo, apellidoNombre: p.nombre, empresa: p.empresa, puesto: p.puesto || '', codigo: p.codigo, observacion: p.observacion
  }))));
  agregarFilas_('Minuta_Novedades', (d.novedades || []).map(n => Object.assign({}, base, {
    hora: n.hora, seccion: n.seccion, personal: n.personal, accion: n.accion, detalle: n.detalle, resultado: n.resultado
  })));
  agregarFilas_('Minuta_Rondines', (d.rondines || []).map(r => Object.assign({}, base, {
    horaInicio: r.inicio, horaReporte: r.reporte, vigilador: r.vigilador, sector: r.sector, resultado: r.resultado, modo: r.modo, horaFin: r.fin, qr: r.qr ? 'SI' : 'NO'
  })));
  agregarFilas_('Minuta_Vehiculos', (d.vehiculos || []).map(v => Object.assign({}, base, {
    vehiculo: v.vehiculo, dominio: v.dominio, kmInicio: v.kmInicio, kmFin: v.kmFin, kmTotal: v.kmTotal, gnc: v.gnc, combustible: v.combustible, vigilador: v.vigilador
  })));
  agregarFilas_('Minuta_Equipos', (d.equipos || []).map(q => Object.assign({}, base, { equipo: q.equipo, estado: q.estado, observaciones: q.observaciones })));
  agregarFilas_('Minuta_Fotos', filasFotos);

  // Contactos nuevos del servicio (cliente, etc.)
  const yaCont = leerObjetos_('Minuta_Contactos').filter(c => String(c.idServicio) === String(s.idServicio)).map(c => norm_(c.correo));
  const nuevos = (req.contactosNuevos || []).filter(c => c && emails_([c.correo]).length && yaCont.indexOf(norm_(c.correo)) < 0);
  agregarFilas_('Minuta_Contactos', nuevos.map(c => ({ idServicio: s.idServicio, servicio: s.servicio, nombre: String(c.nombre || '').trim(), correo: emails_([c.correo])[0], fechaAlta: hoy_(), usuario: u.usuario })));

  // Correo
  const dest = destinatarios_(u, s, d, req, us);
  const env = enviar_(s, d, titulo, id, pdfFile.getBlob().setName(nombrePdf), dest.to, dest.cc);

  // Completa la fila de la minuta
  const sh = tab_('Minutas'), head = encabezados_(sh);
  const fila = filaDe_(sh, id);
  const sup = persona_(s.supervisor, us);
  const datos = {
    idMinuta: id, fechaCarga: hoy_(), fecha: d.fecha, dia: d.dia, turno: d.turno, horario: d.horario, idServicio: s.idServicio,
    servicio: s.servicio, empresa: s.empresa, localidad: s.localidad, supervisor: d.supervisor || (sup ? sup.nombre : s.supervisor),
    jefeOperaciones: d.jefeOperaciones, encargado: d.encargado ? d.encargado.nombre : '', horaInicio: d.horaInicio,
    responsableInicio: d.responsableInicio, detalleInicio: d.detalleInicio, horaFin: d.horaFin, entregaA: d.entregaA,
    observacionesFinales: d.observacionesFinales, novedadesRelevantes: (d.relevantes || []).join(' | '), usuario: u.usuario,
    estado: env.prueba ? 'ENVIADO (PRUEBA)' : 'ENVIADO', urlPDF: pdfFile.getUrl(), idPDF: pdfFile.getId(),
    correosEnviados: (env.prueba ? 'PRUEBA → ' + env.enviadoA + ' | hubiera ido a: ' : '') + dest.to.concat(dest.cc).join('; '),
    fechaEnvio: hoy_(), guardia: d.guardia, tituloInforme: titulo
  };
  const rango = sh.getRange(fila, 1, 1, head.length);
  rango.setNumberFormat('@');
  rango.setValues([head.map(h => (datos[h] == null ? '' : datos[h]))]);

  return { ok: true, idMinuta: id, titulo: titulo, url: pdfFile.getUrl(), to: dest.to, cc: dest.cc, prueba: env.prueba, enviadoA: env.enviadoA };
}

function filaDe_(sh, id) {
  const head = encabezados_(sh), c = head.indexOf('idMinuta') + 1;
  const ids = sh.getRange(2, c, Math.max(1, sh.getLastRow() - 1), 1).getDisplayValues();
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(id)) return i + 2;
  throw new Error('No se encontró la minuta ' + id);
}

// Para: supervisor de turno elegido, el que hace el informe y el correo del servicio.
// Copia: Gustavo San Martín, Fernando, supervisor del servicio, correos fijos del servicio y los que agreguen (cliente, nocturno…).
function destinatarios_(u, s, d, req, us) {
  const to = [], cc = [];
  const supTurno = persona_(req.supervisorTurno, us);
  if (supTurno) to.push(supTurno.correo);
  if (d.encargado && d.encargado.legajo) {
    const p = personal_().find(x => x.l === String(d.encargado.legajo) && x.n === String(d.encargado.nombre || '').toUpperCase());
    if (p && p.m) to.push(p.m);
  }
  to.push(u.correo);
  CONFIG.SIEMPRE_COPIA.forEach(k => { const p = persona_(k, us); if (p) cc.push(p.correo); });
  const supServ = persona_(s.supervisor, us);
  if (supServ) cc.push(supServ.correo);
  cc.push(s.correos);
  (req.cc || []).forEach(x => cc.push(x));
  const T = emails_(to);
  const C = emails_(cc).filter(x => T.indexOf(x) < 0);
  if (!T.length && !C.length) throw new Error('No hay destinatarios con correo válido.');
  return T.length ? { to: T, cc: C } : { to: C.slice(0, 1), cc: C.slice(1) };
}

function enviar_(s, d, titulo, id, blob, to, cc) {
  const prueba = !!CONFIG.MODO_PRUEBA;
  const fila = (k, v) => v ? '<tr><td style="padding:4px 14px 4px 0;color:#5b6b70">' + k + '</td><td><b>' + esc_(v) + '</b></td></tr>' : '';
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:600px;border:1px solid #dfe5ee;border-radius:14px;overflow:hidden">' +
    '<div style="background:#1F3864;color:#fff;padding:16px 22px"><div style="font-size:12px;letter-spacing:1px;opacity:.85">DELBEN · SISTEMA DE GESTIÓN INTEGRAL</div>' +
    '<div style="font-size:20px;font-weight:bold;margin-top:4px">Minuta Operativa del Servicio</div></div>' +
    '<div style="height:5px;background:linear-gradient(90deg,#f5a623,#e94e3c,#7b4bb7,#1e88e5,#20a464)"></div>' +
    (prueba ? '<div style="background:#fff3cd;color:#7a4b00;padding:10px 22px;font-size:13px"><b>MODO PRUEBA</b> · este correo solo te llega a vos.<br>' +
      '<b>Hubiera ido a:</b> ' + esc_(to.join(', ')) + (cc.length ? '<br><b>Con copia a:</b> ' + esc_(cc.join(', ')) : '') + '</div>' : '') +
    '<div style="padding:18px 22px;color:#1b2a3a"><table style="font-size:14px;border-collapse:collapse">' +
    fila('Servicio', s.servicio) + fila('Fecha', (d.dia ? d.dia + ' ' : '') + d.fecha) + fila('Turno', d.turno + (d.horario ? ' (' + d.horario + ')' : '')) +
    fila('Guardia', d.guardia) + fila('Encargado', d.encargado && d.encargado.nombre) + fila('N° de minuta', id) + '</table>' +
    ((d.relevantes || []).length ? '<p style="margin:14px 0 4px;color:#c62828;font-weight:bold">Novedades relevantes</p><ul style="margin:0;padding-left:18px">' +
      d.relevantes.map(x => '<li>' + esc_(x) + '</li>').join('') + '</ul>' : '') +
    '<p style="margin-top:16px;color:#5b6b70;font-size:13px">La minuta completa va adjunta en PDF.</p></div></div>';
  MailApp.sendEmail({
    to: prueba ? CONFIG.CORREO_PRUEBA : to.join(','), cc: prueba ? '' : cc.join(','), name: CONFIG.REMITENTE,
    subject: (prueba ? '[PRUEBA] ' : '') + 'Delben - Minuta Operativa - ' + titulo,
    htmlBody: html, attachments: [blob]
  });
  return { prueba: prueba, enviadoA: prueba ? CONFIG.CORREO_PRUEBA : to.concat(cc).join(', ') };
}

/* ======================= Buscador ======================= */

function fechaNum_(t) {
  const m = String(t).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}

function buscar_(u, req) {
  const permitidos = serviciosDe_(u).map(s => String(s.idServicio));
  const filtroServ = req.idServicio ? [String(req.idServicio)] : permitidos;
  const minutas = leerObjetos_('Minutas').filter(m => m.idMinuta && m.estado !== 'GUARDANDO' &&
    permitidos.indexOf(String(m.idServicio)) >= 0 && filtroServ.indexOf(String(m.idServicio)) >= 0);
  const desde = req.desde ? Number(String(req.desde).replace(/-/g, '')) : 0;
  const hasta = req.hasta ? Number(String(req.hasta).replace(/-/g, '')) : 99999999;
  const enRango = minutas.filter(m => { const f = fechaNum_(m.fecha); return !f || (f >= desde && f <= hasta); });
  if (!enRango.length) return { ok: true, items: [], total: 0 };

  const ids = {}; enRango.forEach(m => { ids[m.idMinuta] = []; });
  const juntar = (tab, campos) => leerObjetos_(tab).forEach(r => { if (ids[r.idMinuta]) ids[r.idMinuta].push(campos.map(c => r[c]).join(' ')); });
  juntar('Minuta_Personal', ['legajo', 'apellidoNombre', 'empresa', 'puesto', 'codigo', 'observacion']);
  juntar('Minuta_Novedades', ['hora', 'seccion', 'personal', 'accion', 'detalle', 'resultado']);
  juntar('Minuta_Rondines', ['vigilador', 'sector', 'resultado', 'modo']);
  juntar('Minuta_Vehiculos', ['vehiculo', 'dominio', 'vigilador']);
  juntar('Minuta_Equipos', ['equipo', 'estado', 'observaciones']);
  juntar('Minuta_Fotos', ['descripcion']);

  const tokens = norm_(req.q || '').split(' ').filter(Boolean);
  const items = [];
  enRango.forEach(m => {
    const texto = norm_([m.idMinuta, m.fecha, m.dia, m.turno, m.guardia, m.servicio, m.supervisor, m.encargado, m.detalleInicio,
      m.entregaA, m.observacionesFinales, m.novedadesRelevantes].concat(ids[m.idMinuta]).join(' '));
    if (!tokens.every(t => texto.indexOf(t) >= 0)) return;
    let coincide = '';
    if (tokens.length) {
      const linea = ids[m.idMinuta].find(x => tokens.some(t => norm_(x).indexOf(t) >= 0));
      coincide = linea ? String(linea).replace(/\s+/g, ' ').trim().slice(0, 160) : '';
    }
    items.push({
      id: m.idMinuta, fecha: m.fecha, dia: m.dia, turno: m.turno, guardia: m.guardia, servicio: m.servicio, idServicio: m.idServicio,
      encargado: m.encargado, supervisor: m.supervisor, relevantes: m.novedadesRelevantes, titulo: m.tituloInforme, coincide: coincide,
      enviados: m.correosEnviados, tienePdf: !!m.idPDF
    });
  });
  items.sort((a, b) => (fechaNum_(b.fecha) - fechaNum_(a.fecha)) || (b.id > a.id ? 1 : -1));
  return { ok: true, items: items.slice(0, 200), total: items.length };
}

function minutaPermitida_(u, id) {
  const m = leerObjetos_('Minutas').find(x => x.idMinuta === String(id));
  if (!m) throw new Error('No se encontró la minuta ' + id);
  if (serviciosDe_(u).map(s => String(s.idServicio)).indexOf(String(m.idServicio)) < 0) throw new Error('No tenés permiso para ver esa minuta.');
  if (!m.idPDF) throw new Error('Esa minuta no tiene PDF.');
  return m;
}

function pdf_(u, req) {
  const m = minutaPermitida_(u, req.id);
  const f = DriveApp.getFileById(m.idPDF);
  return { ok: true, base64: Utilities.base64Encode(f.getBlob().getBytes()), nombre: f.getName() };
}

function reenviar_(u, req) {
  const m = minutaPermitida_(u, req.id);
  const to = emails_(req.to || []);
  if (!to.length) throw new Error('Poné al menos un correo válido.');
  const f = DriveApp.getFileById(m.idPDF);
  const s = { servicio: m.servicio };
  const env = enviar_(s, { fecha: m.fecha, dia: m.dia, turno: m.turno, horario: m.horario, guardia: m.guardia, encargado: { nombre: m.encargado }, relevantes: lista_(String(m.novedadesRelevantes || '').replace(/ \| /g, ';')) },
    m.tituloInforme || f.getName().replace(/\.pdf$/i, ''), m.idMinuta, f.getBlob(), to, []);
  const sh = tab_('Minutas'), head = encabezados_(sh), fila = filaDe_(sh, m.idMinuta), c = head.indexOf('correosEnviados') + 1;
  sh.getRange(fila, c).setValue(String(m.correosEnviados || '') + ' || Reenviado ' + hoy_() + ' por ' + u.usuario + ': ' + to.join('; ') + (env.prueba ? ' (PRUEBA → ' + env.enviadoA + ')' : ''));
  return { ok: true, to: to, prueba: env.prueba, enviadoA: env.enviadoA };
}

/* ======================= Puesta en marcha =======================
   Ejecutar UNA VEZ desde el editor: crea las pestañas que falten,
   completa encabezados y carga los servicios iniciales en
   Config_Servicios (solo si está vacía). */

function prepararPlanilla() {
  Object.keys(TABS).forEach(tab_);
  const sh = tab_('Config_Servicios');
  if (sh.getLastRow() < 2) {
    const S = 'Supervisores de KTL', C = 'Novedades de CCTV', O = 'Otras novedades del servicio';
    agregarFilas_('Config_Servicios', [
      { idServicio: 'SFRANCISCO', servicio: 'BARRIO SAN FRANCISCO', direccion: 'Aristóbulo del Valle 5155, B1622DEA, Dique Luján', localidad: 'Benavídez',
        empresa: 'PPQ', usuario: 'sfrancisco', supervisor: 'gvica', jefeOperaciones: 'gsanmartin', horarioDiurno: '07:00 a 19:00', horarioNocturno: '19:00 a 07:00',
        secciones: [C, S, 'Llamados de AVVN', 'Activación de doble validación y portones', O].join('; '),
        vehiculos: 'Fiat Strada|OOL-102; Vehículo eléctrico|4066', equipos: 'Vehículo eléctrico; Celulares; Equipos HT; PC / CCTV',
        activo: 'SI' },
      { idServicio: 'LAGUNA', servicio: 'BARRIO LAGUNA GRANDE', direccion: 'Italia 4800', localidad: 'Benavídez', empresa: 'PPQ', usuario: 'laguna',
        supervisor: 'gvica', jefeOperaciones: 'gsanmartin', horarioDiurno: '07:00 a 19:00', horarioNocturno: '19:00 a 07:00',
        secciones: [S, 'Limpieza y mantenimiento', 'Cierres y aperturas', O].join('; '),
        vehiculos: 'Melex|', equipos: 'Vehículo eléctrico Melex; Bicicleta eléctrica; Celulares; PC 1 y 2; Equipos HT', activo: 'SI' },
      { idServicio: 'FINCAS', servicio: 'FINCAS DE IRAOLA 2', direccion: 'Calle 63 2260', localidad: 'Berazategui', empresa: 'KDE', usuario: 'fincas',
        supervisor: 'scarabetta', jefeOperaciones: 'gsanmartin', horarioDiurno: '06:00 a 18:00', horarioNocturno: '18:00 a 06:00',
        secciones: ['Supervisor de KTL', C, 'Ingresos adicionales policiales', 'Ingreso de visitas y servicios médicos', 'Ingreso de vigiladores', O].join('; '),
        vehiculos: 'Toyota|AF-055-YL; Melex|4123', equipos: 'Melex; Celulares; Equipos HT; Generador', activo: 'SI' },
      { idServicio: 'AZARATE', servicio: 'ARAUCO ZARATE', direccion: 'Camino de la Costa Brava', localidad: 'Zárate', empresa: 'KDE', usuario: 'azarate',
        supervisor: 'gvica', jefeOperaciones: 'gsanmartin', horarioDiurno: '07:00 a 19:00', horarioNocturno: '19:00 a 07:00', secciones: [S, O].join('; '), activo: 'SI' },
      { idServicio: 'RAIZEN', servicio: 'RAIZEN DOCK SUD SUPERVISORES', direccion: 'Sgto. Ponce 2318', localidad: 'Dock Sud', empresa: 'PPQ', usuario: 'raizen',
        supervisor: '', jefeOperaciones: 'gsanmartin', horarioDiurno: '07:00 a 19:00', horarioNocturno: '19:00 a 07:00', secciones: [S, O].join('; '), activo: 'SI' }
    ]);
  }
  Logger.log('Planilla lista. Servicios: ' + servicios_().map(s => s.servicio + ' (' + s.usuario + ')').join(', '));
}

// Prueba de lectura: ejecutala y mirá el registro.
function probar() {
  Logger.log('Usuarios: ' + usuarios_().map(u => u.usuario + '/' + u.rol).join(', '));
  Logger.log('Personal activo: ' + personal_().length);
  Logger.log('Códigos: ' + codigos_().map(c => c.codigo).join(', '));
  Logger.log('Servicios: ' + servicios_().map(s => s.servicio).join(', '));
  Logger.log('MODO PRUEBA: ' + (CONFIG.MODO_PRUEBA ? 'SÍ, los correos van solo a ' + CONFIG.CORREO_PRUEBA : 'NO, los correos van a los destinatarios reales'));
  try { Logger.log('Carpeta: ' + DriveApp.getFolderById(CONFIG.CARPETA_ID).getName()); } catch (e) { Logger.log('NO se puede abrir la carpeta: ' + e.message); }
  Logger.log('Cupo de correos hoy: ' + MailApp.getRemainingDailyQuota());
}
