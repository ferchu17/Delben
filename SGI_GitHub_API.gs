/**
 * DELBEN SGI - Puente API para GitHub Pages
 *
 * Este archivo se agrega a una COPIA del proyecto Apps Script del SGI original.
 * No reemplaza Code.gs.
 */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var fn = String(req.fn || '').trim();
    var args = Array.isArray(req.args) ? req.args : [];

    var handlers = {
      getData:getData,
      getBatchData:getBatchData,
      getDataAsObjects:getDataAsObjects,
      getExternalData:getExternalData,
      guardarUltimaConexion:guardarUltimaConexion,
      getUltimasConexiones:getUltimasConexiones,
      appendRowSafe:appendRowSafe,
      updateRow:updateRow,
      deleteRow:deleteRow,
      deleteRowsByIds:deleteRowsByIds,
      appendRowsAutoId:appendRowsAutoId,
      ensureMovilerosTilde:ensureMovilerosTilde,
      setCellByHeader:setCellByHeader,
      upsertRows:upsertRows,
      saveSheetData:saveSheetData,
      saveAllRows:saveAllRows,
      appendRow:appendRow,
      clearSheet:clearSheet,
      loginCheck:loginCheck,
      cambiarPassword:cambiarPassword,
      enviarCorreoSalida:enviarCorreoSalida,
      enviarCorreoSalidaMasiva:enviarCorreoSalidaMasiva,
      enviarCorreoCorrespondePedido:enviarCorreoCorrespondePedido,
      enviarCorreoPreparacion:enviarCorreoPreparacion,
      enviarWhatsApp:enviarWhatsApp,
      getAparienciaConfig:getAparienciaConfig,
      saveAparienciaConfig:saveAparienciaConfig,
      uploadFotosDrive:uploadFotosDrive
    };

    if (!handlers[fn]) {
      return _sgiApiJson_({ok:false,error:'Función no permitida o inexistente: '+fn});
    }

    var result = handlers[fn].apply(null,args);
    return _sgiApiJson_({ok:true,result:result});
  } catch (err) {
    return _sgiApiJson_({
      ok:false,
      error:String(err && err.message ? err.message : err)
    });
  }
}

/**
 * Sube fotos recibidas como objetos {base64,mimeType,name} a una carpeta de Drive
 * y devuelve sus URLs. Es compatible con la llamada existente de Control de Móviles.
 */
function uploadFotosDrive(folderId, fotosData) {
  var folder = DriveApp.getFolderById(String(folderId));
  var lista = Array.isArray(fotosData) ? fotosData : [];
  var urls = [];

  lista.forEach(function(foto, idx) {
    if (!foto || !foto.base64) return;

    var bytes = Utilities.base64Decode(String(foto.base64));
    var mime = String(foto.mimeType || 'application/octet-stream');
    var name = String(foto.name || ('foto_' + (idx + 1)));

    var blob = Utilities.newBlob(bytes, mime, name);
    var file = folder.createFile(blob);
    urls.push(file.getUrl());
  });

  return urls;
}

function _sgiApiJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
