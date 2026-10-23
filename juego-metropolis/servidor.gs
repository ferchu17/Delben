/**
 * Metrópolis Infinita — servidor para jugar en línea
 * Realizado por Fernando Jacyno · 10/2026
 *
 * Qué hace: cuentas con usuario y contraseña, guardado de partidas en la nube (Drive),
 * lista de jugadores, visitas, mercado de productos entre jugadores y regalos de plata.
 *
 * Cómo se instala (una sola vez):
 *  1. Crear una planilla de Google nueva (por ejemplo "Metrópolis Infinita - Servidor").
 *  2. Extensiones › Apps Script. Borrar lo que haya y pegar este archivo completo.
 *  3. Implementar › Nueva implementación › Tipo: Aplicación web.
 *     Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 *  4. Autorizar los permisos (planilla y Drive) y copiar el link que termina en /exec.
 *  5. En el juego: Menú › Juego en línea › pegar el link › Guardar y probar.
 *     (O pegarlo en SERVIDOR_POR_DEFECTO dentro del juego para que todos lo tengan solo.)
 *  Cada vez que se cambie este archivo hay que hacer Implementar › Gestionar implementaciones › Editar › Nueva versión.
 *
 * Las hojas Usuarios, Ofertas y Buzon se crean solas la primera vez.
 */

const HOJAS = {
  Usuarios: ['usuario', 'sal', 'hash', 'token', 'estado', 'poblacion', 'plata', 'tamano', 'actualizado', 'archivoId', 'creado'],
  Ofertas:  ['id', 'vendedor', 'recurso', 'cantidad', 'precio', 'estado', 'comprador', 'fecha'],
  Buzon:    ['id', 'para', 'tipo', 'recurso', 'cantidad', 'monto', 'de', 'fecha', 'entregado']
};
const CARPETA = 'Metrópolis Infinita - Partidas';
const RECURSOS = ['food', 'ore', 'oil', 'wood', 'goods', 'steel', 'fuel', 'furn', 'pfood', 'cars', 'elec'];

function doGet() {
  return salida({ ok: true, app: 'Metrópolis Infinita', mensaje: 'Servidor funcionando' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return salida({ ok: false, error: 'Pedido inválido' }); }
  const accion = ACCIONES[req.action];
  if (!accion) return salida({ ok: false, error: 'Acción desconocida' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    return salida(Object.assign({ ok: true }, accion(req) || {}));
  } catch (err) {
    return salida({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

const ACCIONES = {
  ping: () => ({ jugadores: Math.max(0, hoja('Usuarios').getLastRow() - 1) }),

  register: (r) => {
    const usuario = limpiarUsuario(r.user);
    if ((r.pass || '').length < 4) throw new Error('La contraseña tiene que tener al menos 4 caracteres');
    if (buscarUsuario(usuario)) throw new Error('Ese usuario ya existe. Elegí otro o ingresá.');
    const sal = Utilities.getUuid().slice(0, 12);
    const token = Utilities.getUuid();
    hoja('Usuarios').appendRow([usuario, sal, hashear(sal, r.pass), token, '', 0, 0, 0, new Date(), '', new Date()]);
    return { user: usuario, token };
  },

  login: (r) => {
    const u = buscarUsuario(limpiarUsuario(r.user));
    if (!u || u.datos.hash !== hashear(u.datos.sal, r.pass || '')) throw new Error('Usuario o contraseña incorrectos');
    const token = Utilities.getUuid();
    escribir('Usuarios', u.fila, 'token', token);
    return { user: u.datos.usuario, token };
  },

  save: (r) => {
    const u = autenticar(r);
    const nombre = 'metropolis_' + u.datos.usuario.toLowerCase().replace(/[^a-z0-9ñ]+/g, '_') + '.json';
    let archivo = null;
    if (u.datos.archivoId) { try { archivo = DriveApp.getFileById(u.datos.archivoId); } catch (e) { archivo = null; } }
    if (archivo) archivo.setContent(r.data);
    else { archivo = carpeta().createFile(nombre, r.data, 'application/json'); escribir('Usuarios', u.fila, 'archivoId', archivo.getId()); }
    const m = r.meta || {};
    escribir('Usuarios', u.fila, 'estado', String(m.estado || '').slice(0, 40));
    escribir('Usuarios', u.fila, 'poblacion', Number(m.pop) || 0);
    escribir('Usuarios', u.fila, 'plata', Number(m.plata) || 0);
    escribir('Usuarios', u.fila, 'tamano', Number(m.size) || 0);
    escribir('Usuarios', u.fila, 'actualizado', new Date());
    return {};
  },

  load: (r) => {
    const u = autenticar(r);
    return { data: leerPartida(u.datos.archivoId) };
  },

  visit: (r) => {
    autenticar(r);
    const t = buscarUsuario(limpiarUsuario(r.target));
    if (!t) throw new Error('No existe ese jugador');
    return { data: leerPartida(t.datos.archivoId) };
  },

  players: (r) => {
    autenticar(r);
    return { players: filas('Usuarios').map(f => ({ usuario: f.usuario, estado: f.estado, poblacion: Number(f.poblacion) || 0, actualizado: f.actualizado })) };
  },

  offers: (r) => {
    autenticar(r);
    return { offers: filas('Ofertas').filter(f => f.estado === 'abierta').map(f => ({ id: String(f.id), vendedor: f.vendedor, recurso: f.recurso, cantidad: Number(f.cantidad), precio: Number(f.precio) })) };
  },

  offer: (r) => {
    const u = autenticar(r);
    if (RECURSOS.indexOf(r.res) < 0) throw new Error('Producto inválido');
    const cantidad = Math.round(Number(r.qty)), precio = Math.round(Number(r.price));
    if (!(cantidad > 0) || !(precio > 0)) throw new Error('Cantidad y precio tienen que ser mayores a cero');
    const id = 'o' + Utilities.getUuid().slice(0, 8);
    hoja('Ofertas').appendRow([id, u.datos.usuario, r.res, cantidad, precio, 'abierta', '', new Date()]);
    return { id };
  },

  buy: (r) => {
    const u = autenticar(r);
    const o = buscarFila('Ofertas', 'id', String(r.id));
    if (!o || o.datos.estado !== 'abierta') throw new Error('Esa oferta ya no está disponible');
    if (o.datos.vendedor.toLowerCase() === u.datos.usuario.toLowerCase()) throw new Error('No podés comprar tu propia oferta');
    const cantidad = Number(o.datos.cantidad), total = cantidad * Number(o.datos.precio);
    escribir('Ofertas', o.fila, 'estado', 'vendida');
    escribir('Ofertas', o.fila, 'comprador', u.datos.usuario);
    buzon(o.datos.vendedor, 'pago', o.datos.recurso, cantidad, total, u.datos.usuario);
    return { recurso: o.datos.recurso, cantidad, total };
  },

  cancel: (r) => {
    const u = autenticar(r);
    const o = buscarFila('Ofertas', 'id', String(r.id));
    if (!o || o.datos.estado !== 'abierta') throw new Error('Esa oferta ya no está abierta');
    if (o.datos.vendedor.toLowerCase() !== u.datos.usuario.toLowerCase()) throw new Error('Solo podés cancelar tus ofertas');
    escribir('Ofertas', o.fila, 'estado', 'cancelada');
    buzon(u.datos.usuario, 'mercaderia', o.datos.recurso, Number(o.datos.cantidad), 0, u.datos.usuario);
    return {};
  },

  gift: (r) => {
    const u = autenticar(r);
    const t = buscarUsuario(limpiarUsuario(r.to));
    if (!t) throw new Error('No existe ese jugador');
    const monto = Math.round(Number(r.amount));
    if (!(monto > 0)) throw new Error('El monto tiene que ser mayor a cero');
    buzon(t.datos.usuario, 'plata', '', 0, monto, u.datos.usuario);
    return {};
  },

  inbox: (r) => {
    const u = autenticar(r);
    const sh = hoja('Buzon'), datos = sh.getDataRange().getValues(), cab = datos[0], items = [];
    const iPara = cab.indexOf('para'), iEnt = cab.indexOf('entregado');
    for (let k = 1; k < datos.length; k++) {
      const f = datos[k];
      if (String(f[iPara]).toLowerCase() === u.datos.usuario.toLowerCase() && f[iEnt] !== true && f[iEnt] !== 'SI') {
        const o = {}; cab.forEach((c, j) => o[c] = f[j]);
        items.push({ tipo: o.tipo, recurso: o.recurso, cantidad: Number(o.cantidad) || 0, monto: Number(o.monto) || 0, de: o.de });
        sh.getRange(k + 1, iEnt + 1).setValue('SI');
      }
    }
    return { items };
  }
};

/* ---------- ayudas ---------- */
function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function libro() { return SpreadsheetApp.getActiveSpreadsheet(); }
function hoja(nombre) {
  let sh = libro().getSheetByName(nombre);
  if (!sh) { sh = libro().insertSheet(nombre); sh.appendRow(HOJAS[nombre]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HOJAS[nombre].length).setFontWeight('bold'); }
  return sh;
}
function filas(nombre) {
  const d = hoja(nombre).getDataRange().getValues(), cab = d[0];
  return d.slice(1).map(f => { const o = {}; cab.forEach((c, j) => o[c] = f[j]); return o; });
}
function buscarFila(nombre, col, valor) {
  const d = hoja(nombre).getDataRange().getValues(), cab = d[0], j = cab.indexOf(col);
  for (let k = 1; k < d.length; k++) {
    if (String(d[k][j]).toLowerCase() === String(valor).toLowerCase()) { const o = {}; cab.forEach((c, x) => o[c] = d[k][x]); return { fila: k + 1, datos: o }; }
  }
  return null;
}
function escribir(nombre, fila, col, valor) { const sh = hoja(nombre), j = HOJAS[nombre].indexOf(col); sh.getRange(fila, j + 1).setValue(valor); }
function buscarUsuario(usuario) { return buscarFila('Usuarios', 'usuario', usuario); }
function limpiarUsuario(u) {
  u = String(u || '').trim();
  if (!/^[\wñÑáéíóúÁÉÍÓÚ .-]{3,20}$/.test(u)) throw new Error('El usuario tiene que tener entre 3 y 20 letras o números');
  return u;
}
function hashear(sal, pass) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '|' + pass, Utilities.Charset.UTF_8);
  return b.map(x => ('0' + (x & 255).toString(16)).slice(-2)).join('');
}
function autenticar(r) {
  const u = buscarUsuario(limpiarUsuario(r.user));
  if (!u || !r.token || u.datos.token !== r.token) throw new Error('Tu sesión venció. Volvé a ingresar con tu usuario.');
  return u;
}
function carpeta() { const it = DriveApp.getFoldersByName(CARPETA); return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA); }
function leerPartida(id) { if (!id) return null; try { return DriveApp.getFileById(id).getBlob().getDataAsString(); } catch (e) { return null; } }
function buzon(para, tipo, recurso, cantidad, monto, de) { hoja('Buzon').appendRow(['b' + Utilities.getUuid().slice(0, 8), para, tipo, recurso, cantidad, monto, de, new Date(), 'NO']); }
