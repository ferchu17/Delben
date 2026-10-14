/**
 * DELBEN SGI - Puente para la página publicada en GitHub Pages (https://ferchu17.github.io/Delben/sgi/).
 * La página manda { fn, args } y acá se llama a la misma función del servidor que usa el SGI desde Apps Script.
 * Así el SGI se abre desde GitHub, sin el cartel de Google, y el link no cambia aunque se publiquen versiones nuevas.
 *
 * IMPORTANTE: este archivo reemplaza a SGI_GitHub_API.gs (si el proyecto lo tiene, borralo: acá está todo lo que hacía,
 * incluida la subida de fotos). Un proyecto de Apps Script solo puede tener un doPost.
 * La implementación tiene que estar con "Ejecutar como: Yo" y "Quién tiene acceso: Cualquier persona".
 */
var PUENTE_NO_PERMITIDAS_ = { doGet: 1, doPost: 1, include: 1 };

function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = String(req.fn || '').trim(), args = Array.isArray(req.args) ? req.args : [];
    var G = (typeof globalThis !== 'undefined') ? globalThis : this;
    // Solo funciones del servidor del SGI (las que terminan en _ son internas y no se pueden llamar desde afuera)
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(fn) || PUENTE_NO_PERMITIDAS_[fn] || typeof G[fn] !== 'function') throw new Error('Función no permitida o inexistente: ' + fn);
    out = { ok: true, result: G[fn].apply(null, args) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// Subida de fotos a Drive (la usaba SGI_GitHub_API.gs)
function uploadFotosDrive(folderId, fotosData) {
  var folder = DriveApp.getFolderById(String(folderId));
  var lista = Array.isArray(fotosData) ? fotosData : [], urls = [];
  lista.forEach(function (foto, idx) {
    if (!foto || !foto.base64) return;
    var bytes = Utilities.base64Decode(String(foto.base64));
    var blob = Utilities.newBlob(bytes, String(foto.mimeType || 'application/octet-stream'), String(foto.name || ('foto_' + (idx + 1))));
    urls.push(folder.createFile(blob).getUrl());
  });
  return urls;
}

// Key de Gemini para el asistente de IA: se guarda en Configuración del proyecto > Propiedades de la secuencia
// de comandos > GEMINI_KEY (así no queda escrita en el código, que está publicado en GitHub).
function getGeminiKey() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_KEY') || '';
}
