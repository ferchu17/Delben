/**
 * DELBEN SGI - Puente API para GitHub Pages
 *
 * Se agrega a una COPIA del proyecto Apps Script del SGI original.
 * No reemplaza Code.gs.
 *
 * El frontend estático de GitHub Pages mantiene la API google.script.run
 * mediante un adaptador y envía:
 *   { fn: "nombreFuncion", args: [...] }
 * por POST a la implementación de Apps Script.
 */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var fn = String(req.fn || '').trim();
    var args = Array.isArray(req.args) ? req.args : [];

    var allowed = {
      getData: true,
      getBatchData: true,
      getDataAsObjects: true,
      getExternalData: true,
      guardarUltimaConexion: true,
      getUltimasConexiones: true,
      appendRowSafe: true,
      updateRow: true,
      deleteRow: true,
      deleteRowsByIds: true,
      appendRowsAutoId: true,
      ensureMovilerosTilde: true,
      setCellByHeader: true,
      upsertRows: true,
      saveSheetData: true,
      saveAllRows: true,
      appendRow: true,
      clearSheet: true,
      loginCheck: true,
      cambiarPassword: true,
      enviarCorreoSalida: true,
      enviarCorreoSalidaMasiva: true,
      enviarCorreoCorrespondePedido: true,
      enviarCorreoPreparacion: true,
      enviarWhatsApp: true,
      getAparienciaConfig: true,
      saveAparienciaConfig: true
    };

    if (!allowed[fn] || typeof this[fn] !== 'function') {
      return _sgiApiJson_({ok:false, error:'Función no permitida o inexistente: '+fn});
    }

    var result = this[fn].apply(this, args);
    return _sgiApiJson_({ok:true, result:result});
  } catch (err) {
    return _sgiApiJson_({
      ok:false,
      error:String(err && err.message ? err.message : err)
    });
  }
}

function _sgiApiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
