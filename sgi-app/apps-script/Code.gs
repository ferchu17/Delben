// DELBEN SGI - Code.gs - Compatible con ADMIN.html
// VERSION_CODE_GS: 2026-08-14-correo-corresponde-v1 (incluye enviarCorreoCorrespondePedido)
var SPREADSHEET_ID = "1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY";

function getSsId() {
  if (SPREADSHEET_ID) return SPREADSHEET_ID;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) SPREADSHEET_ID = ss.getId();
  } catch (e) {
    SPREADSHEET_ID = "1Z06eLpbng51tYcycQlr0fLNI1OYmOpnmQp94YHY_coY";
  }
  return SPREADSHEET_ID;
}

function doGet(e) {
  var view = String((e && e.parameter && e.parameter.view) || 'admin').toLowerCase();
  var fileName;
  if (view === 'sup' || view === 'supervisor') fileName = 'SGI_Sup';
  else if (view === 'diagnostico' || view === 'diag') fileName = 'DIAGNOSTICO';
  else fileName = 'ADMIN';
  var out = HtmlService.createTemplateFromFile(fileName)
    .evaluate()
    .setTitle('Delben SGI')
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  // Acceso directo desde Novedades del Personal (botón SGI): el pase se valida acá, en el servidor,
  // y la página ya llega con el usuario adentro (no depende de leer la dirección desde el navegador).
  try {
    var pase = e && e.parameter ? String(e.parameter.sso || '') : '';
    if (pase) {
      var r = loginSSO(pase);
      out.append('<script>window.__SSO=' + JSON.stringify(r).replace(/</g, '\\u003c') + ';window._ssoProbado=true;</script>');
    }
  } catch (ex) { }
  return out;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getData(sheet) {
  try {
    var id = getSsId();
    var ss = SpreadsheetApp.openById(id);
    var s = ss.getSheetByName(sheet);
    if (!s) {
      var allSheets = ss.getSheets();
      for (var i = 0; i < allSheets.length; i++) {
        var name = allSheets[i].getName().trim().toLowerCase();
        var search = sheet.trim().toLowerCase();
        if (name === search || name.indexOf(search) !== -1) { s = allSheets[i]; break; }
      }
    }
    if (!s) {
  var names = ss.getSheets().map(function(sh){return sh.getName();});
  return [['__SHEET_NOT_FOUND__', 'Available: '+names.join(', ')]];
}
    var data = s.getDataRange().getValues();
    return data.map(function(row) {
      return row.map(function(cell) {
        if (cell instanceof Date) {
          var d = cell.getDate().toString().padStart(2,'0');
          var m = (cell.getMonth()+1).toString().padStart(2,'0');
          var y = cell.getFullYear();
          return y + '-' + m + '-' + d;
        }
        return cell;
      });
    });
  } catch(e) { return [['__ERROR__']]; }
}

// getBatchData - una sola llamada para multiples hojas
function getBatchData(sheetNames) {
  var result = {};
  var ss = SpreadsheetApp.openById(getSsId());
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    result[name] = readSheet(ss, name);
  }
  return result;
}

function readSheet(ss, sheetName) {
  try {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      // fuzzy search
      var all = ss.getSheets();
      for (var i = 0; i < all.length; i++) {
        var n = all[i].getName().trim().toLowerCase();
        var s = sheetName.trim().toLowerCase();
        if (n === s || n.indexOf(s) !== -1) { sheet = all[i]; break; }
      }
    }
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) return [];
    var headers = data[0].map(function(h){ return String(h||'').trim(); });
    return data.slice(1).filter(function(row){
      return row.some(function(c){ return c!==''&&c!==null&&c!==undefined; });
    }).map(function(row){
      var obj = {};
      var headerCount = {};
      headers.forEach(function(h, i){
        if (!h) return;
        // Handle duplicate column names (e.g. two "dni" columns)
        headerCount[h] = (headerCount[h]||0) + 1;
        var key = headerCount[h] > 1 ? h + '_' + headerCount[h] : h;
        var v = row[i];
        // Also expose a normalized alias (lowercase, no accents/spaces/underscores)
        // so columns like "DiasVacaciones" or "Dias Vacaciones" still map to the
        // key the front-end expects ("diasvacaciones"), without touching the
        // original exact-case key used everywhere else.
        var norm = h.toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
          .toLowerCase().replace(/[\s_]+/g,'');
        if (norm && norm !== key && !(norm in obj)) {
          var normVal = v;
          if (v instanceof Date){
            if (!isNaN(v.getTime())){
              normVal = (v.getFullYear() < 1900)
                ? String(v.getHours()).padStart(2,'0')+':'+String(v.getMinutes()).padStart(2,'0')+':'+String(v.getSeconds()).padStart(2,'0')
                : v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
            } else { normVal = ''; }
          }
          obj[norm] = normVal !== undefined ? normVal : '';
        }
        if (v instanceof Date){
          if (isNaN(v.getTime())){ obj[key]=''; return; }
          // Time-only values stored as fractions show year 1899 in Sheets
          if (v.getFullYear() < 1900) {
            obj[key] = String(v.getHours()).padStart(2,'0')+':'+String(v.getMinutes()).padStart(2,'0')+':'+String(v.getSeconds()).padStart(2,'0');
          } else {
            obj[key] = v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0');
          }
        } else { obj[key] = v!==undefined ? v : ''; }
      });
      return obj;
    });
  } catch(e) {
    Logger.log('readSheet ERROR ['+sheetName+']: '+e.message);
    return [];
  }
}

function getDataAsObjects(sheetName) {
  try {
    var rows = getData(sheetName);
    if (!rows || rows.length === 0) return [];
    var headers = rows[0].map(function(h) { return String(h || '').trim(); });
    return rows.slice(1).filter(function(row) {
      return row && row.some(function(cell) { return cell !== '' && cell !== null; });
    }).map(function(row) {
      var obj = {};
      headers.forEach(function(header, idx) {
        if (header) obj[header] = row[idx] !== undefined ? row[idx] : '';
      });
      return obj;
    });
  } catch (e) { return []; }
}

// Leer hoja de Control de Flota (hoja externa)
function getExternalData(sheetName) {
  try {
    // Primero intentar en el mismo spreadsheet principal. Se usa la MISMA
    // búsqueda flexible (exacta o por coincidencia parcial, sin mayúsculas)
    // que usa getData().
    var ss = SpreadsheetApp.openById(getSsId());
    var sheet = null;
    var allSheets = ss.getSheets();
    var search = sheetName.trim().toLowerCase();
    for (var i = 0; i < allSheets.length; i++) {
      var n = allSheets[i].getName().trim().toLowerCase();
      if (n === search) { sheet = allSheets[i]; break; }
    }
    if (!sheet) {
      for (var i2 = 0; i2 < allSheets.length; i2++) {
        var n2 = allSheets[i2].getName().trim().toLowerCase();
        if (n2.indexOf(search) !== -1 || search.indexOf(n2) !== -1) { sheet = allSheets[i2]; break; }
      }
    }
    if (sheet) {
      return { rows: _formatearFechasHoras(sheet.getDataRange().getValues(), sheet) };
    }
    // Si no está en el principal, buscar en el externo
    var EXT_SS_ID = '1-kIgthAlnMqTPqWkFrcgndSZCTq9YtfrwuBxCsjXzWU';
    var extSS = SpreadsheetApp.openById(EXT_SS_ID);
    var extSheet = extSS.getSheetByName(sheetName);
    if (!extSheet) {
      // fuzzy en externo
      var extAll = extSS.getSheets();
      for (var j = 0; j < extAll.length; j++) {
        var nExt = extAll[j].getName().trim().toLowerCase();
        if (nExt === search || nExt.indexOf(search) !== -1 || search.indexOf(nExt) !== -1) {
          extSheet = extAll[j]; break;
        }
      }
    }
    if (!extSheet) return { error: 'Hoja "'+sheetName+'" no encontrada' };
    return { rows: _formatearFechasHoras(extSheet.getDataRange().getValues(), extSheet) };
  } catch(e) { return { error: e.message }; }
}

/**
 * Convierte, del lado del servidor, cada celda de tipo Date en un texto ya
 * formateado (DD/MM/AAAA para fechas, HH:mm para horas), usando el huso
 * horario real de la hoja de cálculo (Utilities.formatDate). Se hace acá y
 * no en el navegador porque el puente google.script.run puede perder la
 * hora de un objeto Date cuando viaja dentro de un array de filas — al
 * mandar ya el texto listo, ese problema desaparece de raíz. Se detecta si
 * una columna es "hora" mirando el propio encabezado (fila 1); si no, se
 * decide por el valor: una fecha con año <= 1900 es la fecha "de relleno"
 * que usa Sheets para guardar solo un horario.
 */
function _formatearFechasHoras(rows, sheet) {
  if (!rows || !rows.length) return rows;
  var tz = sheet.getParent() ? sheet.getParent().getSpreadsheetTimeZone() : Session.getScriptTimeZone();
  var headers = rows[0].map(function(h){ return String(h||'').trim().toUpperCase(); });
  var esColHora = headers.map(function(h){ return h === 'HORA'; });
  for (var r = 1; r < rows.length; r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var cell = rows[r][c];
      if (cell instanceof Date) {
        if (esColHora[c] || cell.getFullYear() <= 1900) {
          rows[r][c] = Utilities.formatDate(cell, tz, 'HH:mm');
        } else {
          rows[r][c] = Utilities.formatDate(cell, tz, 'dd/MM/yyyy');
        }
      }
    }
  }
  return rows;
}

function guardarUltimaConexion(usuario, timestamp) {
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var dt = new Date(timestamp);
    var tz = Session.getScriptTimeZone();
    var fecha = Utilities.formatDate(dt, tz, 'dd/MM/yyyy');
    var hora = Utilities.formatDate(dt, tz, 'HH:mm:ss');
    // 1. Update "Usuarios y contrasenas" with last connection time
    var sheet = ss.getSheetByName('Usuarios y contraseñas');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(function(h){ return String(h||'').toLowerCase().trim(); });
      var userCol = headers.indexOf('usuario'); if(userCol<0) userCol=2;
      var connCol = headers.indexOf('ultimaconexion');
      if (connCol < 0) { connCol = data[0].length; sheet.getRange(1, connCol+1).setValue('ultimaConexion'); }
      for (var i=1; i<data.length; i++) {
        if (String(data[i][userCol]||'').toLowerCase().trim() === usuario.toLowerCase().trim()) {
          sheet.getRange(i+1, connCol+1).setValue(timestamp); break;
        }
      }
    }
    // 2. Append to "ultimaconexion" sheet
    var ls = ss.getSheetByName('ultimaconexion');
    if (!ls) {
      ls = ss.insertSheet('ultimaconexion');
      ls.getRange(1,1,1,7).setValues([['ID','Fecha','Hora Ultima Conexion','Hora','Usuario','Que Modifico','Tiempo de Permanencia']]);
    }
    var lastRow = ls.getLastRow();
    var newId = lastRow; // header=row1 so first data ID=1, second=2, etc.
    ls.appendRow([newId, fecha, hora, hora, usuario, 'Login', '-']);
    return true;
  } catch(e) { Logger.log('guardarUltimaConexion: '+e.message); return false; }
}

function getUltimasConexiones() {
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var now = new Date(); var ONLINE_MIN = 60;

    // Helper: format a cell value that may be a Date object from Sheets
    function fmtSheetCell(v, asTime) {
      if (!v && v !== 0) return '';
      if (v instanceof Date) {
        if (isNaN(v.getTime())) return '';
        if (asTime || v.getFullYear() < 1900) {
          // Time-only value (Sheets stores as fraction → year 1899)
          return String(v.getHours()).padStart(2,'0')+':'+String(v.getMinutes()).padStart(2,'0')+':'+String(v.getSeconds()).padStart(2,'0');
        }
        return String(v.getDate()).padStart(2,'0')+'/'+String(v.getMonth()+1).padStart(2,'0')+'/'+v.getFullYear();
      }
      return String(v||'');
    }
    
    // Build last-connection map from 'ultimaconexion' sheet (most reliable)
    var lastConnMap = {};
    var ls = ss.getSheetByName('ultimaconexion');
    var logRows = [];
    if (ls && ls.getLastRow() > 1) {
      var ldata = ls.getDataRange().getValues();
      var lh = ldata[0];
      // Find column indices
      var lhLower = lh.map(function(h){ return String(h||'').toLowerCase().trim(); });
      var userColL = lhLower.indexOf('usuario');
      var fechaColL = lhLower.indexOf('fecha');
      var horaColL = lhLower.indexOf('hora ultima conexion');
      if(horaColL<0) horaColL = lhLower.indexOf('hora');
      // Scan all rows to get last connection per user
      for (var j=1; j<ldata.length; j++) {
        var rowUser = String(ldata[j][userColL>=0?userColL:4]||'').trim().toLowerCase();
        if(!rowUser) continue;
        var rawFecha = ldata[j][fechaColL>=0?fechaColL:1];
        var rawHora  = ldata[j][horaColL>=0?horaColL:2];
        lastConnMap[rowUser] = {
          fecha: fmtSheetCell(rawFecha, false),
          hora:  fmtSheetCell(rawHora, true),
          row: ldata[j]
        };
      }
      // Build log (last 100 entries, newest first)
      for (var k=ldata.length-1; k>=Math.max(1,ldata.length-100); k--) {
        var obj = {};
        for (var m=0;m<lh.length;m++) {
          var cellVal = ldata[k][m];
          var colName = String(lh[m]||'').toLowerCase().trim();
          var isTimeCol = colName.indexOf('hora') >= 0;
          obj[String(lh[m]||'')] = fmtSheetCell(cellVal, isTimeCol);
        }
        logRows.push(obj);
      }
    }
    
    // Get user list from 'Usuarios y contraseñas'
    var usuarios = [];
    var sheet = ss.getSheetByName('Usuarios y contraseñas');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var hdrs = data[0].map(function(h){ return String(h||'').toLowerCase().trim(); });
      var uCol = hdrs.indexOf('usuario'); if(uCol<0) uCol=2;
      var nCol = hdrs.indexOf('nombre'); if(nCol<0) nCol=1;
      var rCol = hdrs.indexOf('rol'); if(rCol<0) rCol=4;
      for (var i=1; i<data.length; i++) {
        if (!data[i][nCol]) continue;
        var uKey = String(data[i][uCol]||'').trim().toLowerCase();
        var connData = lastConnMap[uKey];
        var connStr = connData ? (connData.fecha + ' ' + connData.hora) : '';
        // Parse dd/MM/yyyy HH:mm:ss for online check
        var dt = null;
        if (connData && connData.fecha) {
          var fp = connData.fecha.split('/');
          if(fp.length===3) {
            dt = new Date(fp[2]+'-'+fp[1]+'-'+fp[0]+'T'+(connData.hora||'00:00:00'));
          }
        }
        var diffMin = (dt&&!isNaN(dt.getTime())) ? (now-dt)/60000 : 9999;
        usuarios.push({ 
          nombre: String(data[i][nCol]||''), 
          rol: String(data[i][rCol]||''), 
          ultimaConexion: connStr || 'Sin registro', 
          enLinea: diffMin <= ONLINE_MIN 
        });
      }
    }
    return { usuarios:usuarios, log:logRows };
  } catch(e) { Logger.log('getUltimasConexiones: '+e.message); return {usuarios:[],log:[]}; }
}





function appendRowSafe(sheet,rowData){
  try{var ss=SpreadsheetApp.openById(getSsId());var s=ss.getSheetByName(sheet);
  if(!s){var all=ss.getSheets();for(var j=0;j<all.length;j++){if(all[j].getName().trim().toLowerCase()===sheet.trim().toLowerCase()){s=all[j];break;}}}
  if(!s)return 'error';s.appendRow(rowData);return 'ok';
  }catch(e){Logger.log('appendRowSafe:'+e.message);return 'error';}
}
function updateRow(sheet,id,rowData){
  try{var ss=SpreadsheetApp.openById(getSsId());var s=ss.getSheetByName(sheet);
  if(!s){var all=ss.getSheets();for(var j=0;j<all.length;j++){if(all[j].getName().trim().toLowerCase()===sheet.trim().toLowerCase()){s=all[j];break;}}}
  if(!s)return 'error';
  var data=s.getDataRange().getValues();
  for(var r=1;r<data.length;r++){if(String(data[r][0])===String(id)){s.getRange(r+1,1,1,rowData.length).setValues([rowData]);return 'ok';}}
  s.appendRow(rowData);return 'ok';
  }catch(e){Logger.log('updateRow:'+e.message);return 'error';}
}
function deleteRow(sheet,id){
  try{var ss=SpreadsheetApp.openById(getSsId());var s=ss.getSheetByName(sheet);
  if(!s){var all=ss.getSheets();for(var j=0;j<all.length;j++){if(all[j].getName().trim().toLowerCase()===sheet.trim().toLowerCase()){s=all[j];break;}}}
  if(!s)return 'error';
  var data=s.getDataRange().getValues();
  for(var r=data.length-1;r>=1;r--){if(String(data[r][0])===String(id)){s.deleteRow(r+1);return 'ok';}}
  return 'not_found';
  }catch(e){Logger.log('deleteRow:'+e.message);return 'error';}
}

/**
 * Guarda un conjunto de filas SIN borrar la hoja entera.
 * Para cada fila (por ID, columna A): si ya existe en la hoja, actualiza
 * solo esa fila; si no existe, la agrega al final. Nunca toca ni borra
 * filas que no vengan en "rows" (por ejemplo, filas agregadas por otro
 * usuario/pestaña entre que este cliente cargó los datos y guardó).
 * Reemplaza el viejo saveAllRows (que hacía clearContents + reescritura
 * total, y por eso se perdían o duplicaban datos con más de un usuario).
 */
/**
 * Borra varias filas por ID en una sola llamada (más eficiente que
 * invocar deleteRow repetidas veces desde el cliente).
 */
function deleteRowsByIds(sheet, ids) {
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var s = ss.getSheetByName(sheet);
    if (!s) {
      var all = ss.getSheets();
      for (var j = 0; j < all.length; j++) { if (all[j].getName().trim().toLowerCase() === sheet.trim().toLowerCase()) { s = all[j]; break; } }
    }
    if (!s) return 'error';
    var idSet = {};
    (ids || []).forEach(function (id) { idSet[String(id)] = true; });
    var data = s.getDataRange().getValues();
    for (var r = data.length - 1; r >= 1; r--) {
      if (Object.prototype.hasOwnProperty.call(idSet, String(data[r][0]))) s.deleteRow(r + 1);
    }
    return 'ok';
  } catch (e) {
    Logger.log('deleteRowsByIds:' + e.message);
    return 'error: ' + e.message;
  }
}

/**
 * Agrega una o varias filas a una hoja asignando el ID (columna A) en el
 * propio servidor, tomando el máximo ID REAL de la hoja en ese instante y
 * usando LockService para que dos usuarios guardando al mismo tiempo nunca
 * puedan recibir el mismo ID.
 *
 * Por qué existe: antes el ID se calculaba en el navegador con
 * nextId(DB.xxx) a partir de una copia de la hoja cargada minutos u horas
 * antes (loadSheetLazy sólo carga una vez por sesión). Si dos personas
 * agregaban filas casi al mismo tiempo, podían calcular el mismo "próximo
 * ID"; al guardar, upsertRows() detecta que ese ID "ya existe" y SOBRESCRIBE
 * la fila existente en vez de agregar una nueva, y al borrar por ID
 * (deleteRowsByIds, usado por ej. al confirmar un Retiro) se borra la fila
 * equivocada. Esto generaba pérdida/borrado de filas ajenas sin que nadie
 * las tocara. appendRowsAutoId evita el problema de raíz.
 *
 * rowsArray: array de filas (cada fila es un array de valores, donde el
 * primer elemento -columna A / ID- será sobrescrito por esta función).
 * Devuelve {ok:true, ids:[...]} con los IDs efectivamente asignados, en el
 * mismo orden que rowsArray, para que el cliente pueda sincronizar sus
 * objetos en memoria con lo que realmente quedó en la hoja.
 */
function appendRowsAutoId(sheet, rowsArray) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { ok: false, ids: [], error: 'No se pudo obtener el lock: ' + e.message };
  }
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var s = ss.getSheetByName(sheet);
    if (!s) {
      var all = ss.getSheets();
      for (var j = 0; j < all.length; j++) {
        if (all[j].getName().trim().toLowerCase() === sheet.trim().toLowerCase()) { s = all[j]; break; }
      }
    }
    if (!s) return { ok: false, ids: [], error: 'Hoja no encontrada: ' + sheet };
    if (!rowsArray || !rowsArray.length) return { ok: true, ids: [] };

    var lastRow = s.getLastRow();
    var maxId = 0;
    if (lastRow > 1) {
      var idVals = s.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < idVals.length; i++) {
        var v = parseInt(idVals[i][0], 10);
        if (!isNaN(v) && v > maxId) maxId = v;
      }
    }

    var assignedIds = [];
    var numCols = rowsArray[0].length;
    for (var k = 0; k < rowsArray.length; k++) {
      maxId++;
      rowsArray[k][0] = maxId;
      assignedIds.push(maxId);
    }
    s.getRange(s.getLastRow() + 1, 1, rowsArray.length, numCols).setValues(rowsArray);
    return { ok: true, ids: assignedIds };
  } catch (e) {
    Logger.log('appendRowsAutoId: ' + e.message);
    return { ok: false, ids: [], error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Pestaña "Movileros" de Flota Automotriz: la hoja real "Movileros" no fue
 * diseñada para esto, así que se le agrega -si todavía no la tiene- una
 * columna "Tilde" al final de los encabezados (fila 1), sin tocar ni
 * reordenar las columnas existentes. Es idempotente: si ya existe, no hace
 * nada. Devuelve los encabezados actuales para que el cliente arme el
 * formulario con las columnas reales de la hoja.
 */
function ensureMovilerosTilde(sheet) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { ok: false, error: 'No se pudo obtener el lock: ' + e.message }; }
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var s = ss.getSheetByName(sheet);
    if (!s) {
      var all = ss.getSheets();
      for (var j = 0; j < all.length; j++) {
        if (all[j].getName().trim().toLowerCase() === sheet.trim().toLowerCase()) { s = all[j]; break; }
      }
    }
    if (!s) return { ok: false, error: 'Hoja no encontrada: ' + sheet };
    var lastCol = Math.max(1, s.getLastColumn());
    var headers = s.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || ''); });
    var has = headers.some(function (h) { return h.trim().toLowerCase() === 'tilde'; });
    if (!has) {
      s.getRange(1, headers.length + 1).setValue('Tilde');
      headers.push('Tilde');
    }
    return { ok: true, headers: headers };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Actualiza el valor de UNA sola celda, ubicándola por el número de fila
 * real de la hoja (tal como viene en el dato ya cargado, no un índice
 * calculado en el cliente) y por el nombre de la columna (se busca en la
 * fila de encabezados en el momento, no se asume una posición fija). Se
 * usa para el tilde de Movileros: solo toca esa celda, nunca reescribe el
 * resto de la fila, así que no puede pisar cambios que haya hecho otra
 * persona en las demás columnas de esa misma fila mientras tanto.
 */
function setCellByHeader(sheet, rowNumber, headerName, value) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (e) { return { ok: false, error: 'No se pudo obtener el lock: ' + e.message }; }
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var s = ss.getSheetByName(sheet);
    if (!s) {
      var all = ss.getSheets();
      for (var j = 0; j < all.length; j++) {
        if (all[j].getName().trim().toLowerCase() === sheet.trim().toLowerCase()) { s = all[j]; break; }
      }
    }
    if (!s) return { ok: false, error: 'Hoja no encontrada: ' + sheet };
    rowNumber = parseInt(rowNumber, 10);
    if (!rowNumber || rowNumber < 2) return { ok: false, error: 'Número de fila inválido' };
    var lastCol = Math.max(1, s.getLastColumn());
    var headers = s.getRange(1, 1, 1, lastCol).getValues()[0];
    var col = -1;
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === headerName.trim().toLowerCase()) { col = i + 1; break; }
    }
    if (col < 0) return { ok: false, error: 'Columna no encontrada: ' + headerName };
    s.getRange(rowNumber, col).setValue(value);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function upsertRows(sheet, headerRow, rows) {
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var s = ss.getSheetByName(sheet);
    if (!s) {
      var all = ss.getSheets();
      for (var j = 0; j < all.length; j++) { if (all[j].getName().trim().toLowerCase() === sheet.trim().toLowerCase()) { s = all[j]; break; } }
    }
    if (!s) return 'error';
    if (!rows) rows = [];
    var numCols = headerRow.length;

    var lastRow = s.getLastRow();
    if (lastRow < 1) {
      s.getRange(1, 1, 1, numCols).setValues([headerRow]);
      lastRow = 1;
    }

    var idMap = {};
    if (lastRow > 1) {
      var ids = s.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        var idVal = ids[i][0];
        if (idVal !== '' && idVal !== null && idVal !== undefined) idMap[String(idVal)] = i + 2;
      }
    }

    var toAppend = [];
    for (var k = 0; k < rows.length; k++) {
      var row = rows[k];
      var rid = String(row[0]);
      if (Object.prototype.hasOwnProperty.call(idMap, rid)) {
        s.getRange(idMap[rid], 1, 1, numCols).setValues([row]);
      } else {
        toAppend.push(row);
      }
    }
    if (toAppend.length > 0) {
      s.getRange(s.getLastRow() + 1, 1, toAppend.length, numCols).setValues(toAppend);
    }
    return 'ok';
  } catch (e) {
    Logger.log('upsertRows:' + e.message);
    return 'error: ' + e.message;
  }
}
function saveSheetData(sheetName,rowsArray){
  try{var ss=SpreadsheetApp.openById(getSsId());var s=ss.getSheetByName(sheetName);
  if(!s){var all=ss.getSheets();for(var j=0;j<all.length;j++){if(all[j].getName().trim().toLowerCase()===sheetName.trim().toLowerCase()){s=all[j];break;}}}
  if(!s)return 'error_no_sheet';
  s.clearContents();
  if(rowsArray&&rowsArray.length>0)s.getRange(1,1,rowsArray.length,rowsArray[0].length).setValues(rowsArray);
  return 'ok';
  }catch(e){Logger.log('saveSheetData:'+e.message);return 'error';}
}
function saveAllRows(sheet, rows) {
  try {
    var s = SpreadsheetApp.openById(getSsId()).getSheetByName(sheet);
    if (!s) return 'error';
    s.clearContents();
    if (rows && rows.length > 0) s.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    return 'ok';
  } catch(e) { return 'error'; }
}

function appendRow(sheet, row) {
  try {
    var s = SpreadsheetApp.openById(getSsId()).getSheetByName(sheet);
    if (!s) return 'error';
    s.appendRow(row);
    return 'ok';
  } catch(e) { return 'error'; }
}

function clearSheet(sheetName) {
  try {
    var s = SpreadsheetApp.openById(getSsId()).getSheetByName(sheetName);
    if (s) s.clearContents();
    return 'ok';
  } catch(e) { return 'error'; }
}

// Alias para compatibilidad
function loginCheck(usuario, password) {
  try {
    var rows = getData('Usuarios y contraseñas');
    if (!rows || rows.length < 2) return {ok:false, error:'Sin datos de usuarios'};
    var headers = rows[0].map(function(h){return String(h||'').trim().toLowerCase();});
    var uCol = headers.indexOf('usuario'); if(uCol<0) uCol=2;
    var pCol = headers.indexOf('password'); if(pCol<0) pCol=3;
    var nCol = headers.indexOf('nombre'); if(nCol<0) nCol=1;
    var rCol = headers.indexOf('rol'); if(rCol<0) rCol=4;
    var u = String(usuario||'').trim().toLowerCase();
    var p = String(password||'').trim();
    for (var i=1; i<rows.length; i++) {
      if (!rows[i][nCol]) continue;
      var rowU = String(rows[i][uCol]||'').trim().toLowerCase();
      var rowP = String(rows[i][pCol]||'').trim().replace(/\.0$/,'');
      if (rowU===u && rowP===p) {
        try { guardarUltimaConexion(u, new Date().toISOString()); } catch(ex) {}
        return {ok:true, nombre:String(rows[i][nCol]||''), rol:String(rows[i][rCol]||''), usuario:u};
      }
    }
    return {ok:false, error:'Usuario o contrasena incorrectos'};
  } catch(e) { return {ok:false, error:e.message}; }
}


function cambiarPassword(usuario, passActual, passNueva, nuevoUsuario) {
  try {
    var ss = SpreadsheetApp.openById(getSsId());
    var sheet = ss.getSheetByName('Usuarios y contraseñas');
    if (!sheet) return {ok:false, error:'Hoja no encontrada'};
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){ return String(h||'').trim().toLowerCase(); });
    var uCol = headers.indexOf('usuario'); if(uCol<0) uCol=2;
    var pCol = headers.indexOf('password');
    if(pCol<0) pCol = headers.indexOf('contraseña');
    if(pCol<0) pCol = headers.indexOf('contrasena');
    if(pCol<0) pCol=3;
    var u = String(usuario||'').trim().toLowerCase();
    for (var i=1; i<data.length; i++) {
      if (String(data[i][uCol]||'').trim().toLowerCase() === u) {
        var currentPass = String(data[i][pCol]||'').trim();
        if (currentPass !== String(passActual||'').trim()) {
          return {ok:false, error:'La contraseña actual es incorrecta'};
        }
        if (passNueva && passNueva !== passActual) {
          sheet.getRange(i+1, pCol+1).setValue(passNueva);
        }
        if (nuevoUsuario && nuevoUsuario.trim()) {
          sheet.getRange(i+1, uCol+1).setValue(nuevoUsuario.trim().toLowerCase());
        }
        return {ok:true};
      }
    }
    return {ok:false, error:'Usuario no encontrado'};
  } catch(e) { return {ok:false, error:e.message}; }
}
/**
 * Envia correo de confirmacion de retiro al usuario que registro la salida.
 * Busca el correo en la hoja 'Usuarios y contraseñas' por nombre.
 * @param {Object} datos - {fecha, objetivo, cantidad, codigo, items, asignado, legajo, empresa, dni}
 * @param {string} nombreQuienRetira - nombre del que retiro, para buscar el correo
 */

/**
 * Busca el correo de un usuario por nombre en múltiples hojas.
 * Usa matching flexible (contiene, sin mayúsculas).
 */


/**
 * Envia correo de confirmacion de retiro.
 * Llamado desde JS1 guardarSalidaConServicio.
 * @param {Object} datos - {fecha, objetivo, cantidad, codigo, items, asignado, legajo, empresa, dni}
 * @param {string} nombreDestinatario - nombre del que retiro o asignado
 */
function enviarCorreoSalida(datos, correoDestinatario) {
  try {
    Logger.log('enviarCorreoSalida: enviando a ' + correoDestinatario);
    if (!correoDestinatario || correoDestinatario.indexOf('@') < 0) {
      return {ok: false, msg: 'Correo inválido: ' + correoDestinatario};
    }
    var quien = datos.quien || datos.asignado || '';
    var fecha = datos.fecha || '';
    var rows = [
      ['Objetivo',   datos.objetivo   || ''],
      ['Cantidad',   String(datos.cantidad || '')],
      ['Código',     datos.codigo     || ''],
      ['Ítems',      datos.items      || ''],
      ['Asignado A', datos.asignado   || ''],
      ['Legajo',     datos.legajo     || ''],
      ['Empresa',    datos.empresa    || ''],
      ['DNI',        datos.dni        || '']
    ];
    var filas = rows.map(function(row) {
      return '<tr><td style="padding:8px 12px;background:#f0f4f8;font-weight:600;border:1px solid #d1d5db;white-space:nowrap;width:140px">' +
             row[0] + '</td><td style="padding:8px 12px;border:1px solid #d1d5db">' + row[1] + '</td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;margin:0">' +
      '<div style="max-width:580px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">' +
      '<div style="background:#1e3a5f;padding:18px 24px">' +
      '<h1 style="color:#fff;margin:0;font-size:1.2rem">DELBEN SGI — Registro de Retiro</h1></div>' +
      '<div style="padding:24px">' +
      '<p style="color:#374151;font-size:1rem;margin:0 0 16px">' +
      'Usted <strong>&quot;' + quien + '&quot;</strong> retiró de oficina el día <strong>' + fecha + '</strong>, los siguientes ítems:' +
      '</p>' +
      '<table style="width:100%;border-collapse:collapse">' + filas + '</table>' +
      '<p style="color:#dc2626;font-weight:bold;font-size:1rem;margin:16px 0 0">Controlar lo retirado de Oficina</p>' +
      '<p style="margin-top:20px;color:#6b7280;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px">' +
      'Correo generado automáticamente — DELBEN SGI. Por favor no responda este mensaje.</p>' +
      '</div></div></body></html>';
    MailApp.sendEmail({
      to: correoDestinatario,
      subject: 'DELBEN SGI - No Responda Este Correo',
      htmlBody: html,
      name: 'DELBEN SGI'
    });
    Logger.log('Correo enviado OK a ' + correoDestinatario);
    // Enviar WhatsApp si hay teléfono
    if (datos.telefonoDestinatario) {
      var waMensaje = 'DELBEN SGI: Usted "' + quien + '" retiró de oficina el día ' + fecha + ': ' + (datos.items || datos.codigo || '') + '.';
      enviarWhatsApp(datos.telefonoDestinatario, waMensaje);
    }
    return {ok: true, msg: 'Correo enviado a ' + correoDestinatario};
  } catch(e) {
    Logger.log('Error enviarCorreoSalida: ' + e.toString());
    return {ok: false, msg: 'Error: ' + e.toString()};
  }
}

function enviarCorreoSalidaMasiva(datos, correoDestinatario) {
  try {
    Logger.log('enviarCorreoSalidaMasiva: enviando a ' + correoDestinatario);
    if (!correoDestinatario || correoDestinatario.indexOf('@') < 0) {
      return {ok: false, msg: 'Correo inválido: ' + correoDestinatario};
    }
    var filas = datos.filas || [];
    var quien = datos.quien || (filas.length ? filas[0].quien : '');
    var fecha = datos.fecha || (filas.length ? filas[0].fecha : '');
    var thead = '<tr>' +
      '<th style="padding:8px 10px;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-align:left">Objetivo</th>' +
      '<th style="padding:8px 10px;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-align:center">Cant</th>' +
      '<th style="padding:8px 10px;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-align:left">Código</th>' +
      '<th style="padding:8px 10px;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-align:left">Ítems</th>' +
      '<th style="padding:8px 10px;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-align:left">Asignado A</th>' +
      '<th style="padding:8px 10px;background:#1e3a5f;color:#fff;border:1px solid #1e3a5f;text-align:left">Empresa</th>' +
      '</tr>';
    var tbodyRows = filas.map(function(rec, idx) {
      var bg = (idx % 2 === 0) ? '#f0f4f8' : '#ffffff';
      return '<tr style="background:' + bg + '">' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.objetivo || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db;text-align:center">' + (rec.cantidad || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.codigo || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.items || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.asignado || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.empresa || '') + '</td>' +
        '</tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;margin:0">' +
      '<div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">' +
      '<div style="background:#1e3a5f;padding:18px 24px">' +
      '<h1 style="color:#fff;margin:0;font-size:1.2rem">DELBEN SGI — Registro de Retiro</h1></div>' +
      '<div style="padding:24px">' +
      '<p style="color:#374151;font-size:1rem;margin:0 0 16px">' +
      'Usted <strong>&quot;' + quien + '&quot;</strong> retiró de oficina el día <strong>' + fecha + '</strong>, los siguientes ítems:' +
      '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead>' + thead + '</thead><tbody>' + tbodyRows + '</tbody></table>' +
      '<p style="color:#dc2626;font-weight:bold;font-size:1rem;margin:16px 0 0">Controlar lo retirado de Oficina</p>' +
      '<p style="margin-top:20px;color:#6b7280;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px">' +
      'Correo generado automáticamente — DELBEN SGI. Por favor no responda este mensaje.</p>' +
      '</div></div></body></html>';
    MailApp.sendEmail({
      to: correoDestinatario,
      subject: 'DELBEN SGI - No Responda Este Correo',
      htmlBody: html,
      name: 'DELBEN SGI'
    });
    Logger.log('Correo masivo enviado OK a ' + correoDestinatario);
    // Enviar WhatsApp si hay teléfono
    if (datos.telefonoDestinatario) {
      var itemsWA = filas.map(function(r){return r.items||r.codigo||'';}).filter(Boolean).join(', ');
      if (itemsWA.length > 80) itemsWA = itemsWA.substring(0, 77) + '...';
      var waMensaje = 'DELBEN SGI: Usted "' + quien + '" retiró de oficina el día ' + fecha + ': ' + itemsWA + '.';
      enviarWhatsApp(datos.telefonoDestinatario, waMensaje);
    }
    return {ok: true, msg: 'Correo enviado a ' + correoDestinatario};
  } catch(e) {
    Logger.log('Error enviarCorreoSalidaMasiva: ' + e.toString());
    return {ok: false, msg: 'Error: ' + e.toString()};
  }
}

/**
 * Envia correo de AVISO de preparación de indumentaria (antes del retiro real).
 * Llamado desde JS2 guardarPreparacionIndumentaria.
 * @param {Object} datos - {quien, filas:[{cantidad,codigo,items,asignado,legajo,dni,objetivo}]}
 * @param {string} correoDestinatario
 */
/**
 * Correo que se envía al Supervisor que hizo la solicitud en "Solicitud de
 * Indumentaria" cuando el Administrador/Coordinador marca la fila como
 * "Corresponde" o "No corresponde", con el detalle de observaciones.
 */
function enviarCorreoCorrespondePedido(datos, correoDestinatario) {
  try {
    Logger.log('enviarCorreoCorrespondePedido: enviando a ' + correoDestinatario);
    if (!correoDestinatario || correoDestinatario.indexOf('@') < 0) {
      return {ok: false, msg: 'Correo inválido: ' + correoDestinatario};
    }
    var corresponde = String(datos.corresponde || '');
    var esOk = corresponde.toLowerCase().indexOf('no') !== 0 && corresponde.toLowerCase().indexOf('no ') < 0 && corresponde.toLowerCase().indexOf('no corresponde') < 0;
    // Determinación simple y explícita (evita falsos positivos con "no"):
    esOk = corresponde.toLowerCase().replace(/\s+/g, '') .indexOf('nocorresponde') < 0;
    var color = esOk ? '#15803d' : '#b91c1c';
    var tituloEstado = esOk ? 'CORRESPONDE' : 'NO CORRESPONDE';
    var rows = [
      ['Personal',       datos.personal      || ''],
      ['Legajo',         datos.legajo        || ''],
      ['DNI',            datos.dni           || ''],
      ['Empresa',        datos.empresa       || ''],
      ['Cantidad',       String(datos.cantidad || '')],
      ['Código',         datos.codigo        || ''],
      ['Ítems',          datos.items         || ''],
      ['Fecha Solicitud',datos.fecha         || '']
    ];
    var filas = rows.map(function(row) {
      return '<tr><td style="padding:8px 12px;background:#f0f4f8;font-weight:600;border:1px solid #d1d5db;white-space:nowrap;width:150px">' +
             row[0] + '</td><td style="padding:8px 12px;border:1px solid #d1d5db">' + row[1] + '</td></tr>';
    }).join('');
    var obsHtml = datos.observaciones
      ? '<p style="color:#374151;font-size:.95rem;margin:16px 0 0"><strong>Observaciones:</strong><br>' + String(datos.observaciones).replace(/\n/g,'<br>') + '</p>'
      : '';
    var html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;margin:0">' +
      '<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">' +
      '<div style="background:' + color + ';padding:18px 24px">' +
      '<h1 style="color:#fff;margin:0;font-size:1.2rem">DELBEN SGI — Solicitud de Indumentaria</h1></div>' +
      '<div style="padding:24px">' +
      '<p style="color:#374151;font-size:1rem;margin:0 0 12px">' +
      'Estimado/a <strong>' + (datos.supervisor || '') + '</strong>, le informamos que la siguiente solicitud fue clasificada como:</p>' +
      '<p style="text-align:center;margin:0 0 16px"><span style="display:inline-block;background:' + color + ';color:#fff;font-weight:bold;font-size:1.05rem;padding:8px 20px;border-radius:20px;letter-spacing:.5px">' + tituloEstado + '</span></p>' +
      '<table style="width:100%;border-collapse:collapse">' + filas + '</table>' +
      obsHtml +
      '<p style="margin-top:20px;color:#6b7280;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px">' +
      'Correo generado automáticamente — DELBEN SGI. Por favor no responda este mensaje.</p>' +
      '</div></div></body></html>';
    MailApp.sendEmail({
      to: correoDestinatario,
      subject: 'DELBEN SGI - Solicitud de Indumentaria: ' + tituloEstado,
      htmlBody: html,
      name: 'DELBEN SGI'
    });
    Logger.log('Correo enviado OK a ' + correoDestinatario);
    return {ok: true, msg: 'Correo enviado a ' + correoDestinatario};
  } catch (e) {
    Logger.log('Error enviarCorreoCorrespondePedido: ' + e.toString());
    return {ok: false, msg: 'Error: ' + e.toString()};
  }
}

function enviarCorreoPreparacion(datos, correoDestinatario) {
  try {
    Logger.log('enviarCorreoPreparacion: enviando a ' + correoDestinatario);
    if (!correoDestinatario || correoDestinatario.indexOf('@') < 0) {
      return {ok: false, msg: 'Correo inválido: ' + correoDestinatario};
    }
    var filas = datos.filas || [];
    var quien = datos.quien || (filas.length ? filas[0].quien : '');
    var thead = '<tr>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:center">Cantidad</th>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:left">Código</th>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:left">Ítems</th>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:left">Nombre y Apellido</th>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:left">LP</th>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:left">DNI</th>' +
      '<th style="padding:8px 10px;background:#15803d;color:#fff;border:1px solid #15803d;text-align:left">Objetivo</th>' +
      '</tr>';
    var tbodyRows = filas.map(function(rec, idx) {
      var bg = (idx % 2 === 0) ? '#f0f4f8' : '#ffffff';
      return '<tr style="background:' + bg + '">' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db;text-align:center">' + (rec.cantidad || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.codigo || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.items || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.asignado || rec.quien || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.legajo || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.dni || '') + '</td>' +
        '<td style="padding:7px 10px;border:1px solid #d1d5db">' + (rec.objetivo || '') + '</td>' +
        '</tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;margin:0">' +
      '<div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">' +
      '<div style="background:#15803d;padding:18px 24px">' +
      '<h1 style="color:#fff;margin:0;font-size:1.2rem">DELBEN SGI — Indumentaria en Preparación</h1></div>' +
      '<div style="padding:24px">' +
      '<p style="color:#374151;font-size:1rem;margin:0 0 16px">' +
      'Estimado/a <strong>' + quien + '</strong>, EL ENVÍO DE ESTE CORREO ES PARA INFORMAR DE QUE SE ESTA PREPARANDO LOS SIGUIENTES ÍTEMS, RECIBIRÁ CORREO PARA RETIRAR:' +
      '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead>' + thead + '</thead><tbody>' + tbodyRows + '</tbody></table>' +
      '<p style="margin-top:20px;color:#6b7280;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px">' +
      'Correo generado automáticamente — DELBEN SGI. Por favor no responda este mensaje.</p>' +
      '</div></div></body></html>';
    MailApp.sendEmail({
      to: correoDestinatario,
      subject: 'DELBEN SGI - Indumentaria lista para retirar',
      htmlBody: html,
      name: 'DELBEN SGI'
    });
    Logger.log('Correo de preparación enviado OK a ' + correoDestinatario);
    return {ok: true, msg: 'Correo enviado a ' + correoDestinatario};
  } catch(e) {
    Logger.log('Error enviarCorreoPreparacion: ' + e.toString());
    return {ok: false, msg: 'Error: ' + e.toString()};
  }
}

function enviarWhatsApp(telefono, mensaje) {
  try {
    // telefono debe tener formato internacional sin + (ej: 5491112345678)
    telefono = String(telefono || '').replace(/[^0-9]/g, '');
    if (!telefono || telefono.length < 10) {
      Logger.log('enviarWhatsApp: teléfono inválido: ' + telefono);
      return {ok: false, msg: 'Teléfono inválido'};
    }
    // WhatsApp Business API via Meta (Cloud API)
    // Configurar WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en PropertiesService
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('WHATSAPP_TOKEN');
    var phoneId = props.getProperty('WHATSAPP_PHONE_ID');
    if (!token || !phoneId) {
      Logger.log('enviarWhatsApp: WHATSAPP_TOKEN o WHATSAPP_PHONE_ID no configurados');
      return {ok: false, msg: 'Token o Phone ID de WhatsApp no configurados en Script Properties'};
    }
    var url = 'https://graph.facebook.com/v18.0/' + phoneId + '/messages';
    var payload = {
      messaging_product: 'whatsapp',
      to: telefono,
      type: 'text',
      text: { body: mensaje }
    };
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    Logger.log('WhatsApp response: ' + code + ' - ' + response.getContentText());
    if (code === 200) {
      return {ok: true, msg: 'WhatsApp enviado a ' + telefono};
    } else {
      return {ok: false, msg: 'Error WhatsApp: ' + response.getContentText()};
    }
  } catch(e) {
    Logger.log('Error enviarWhatsApp: ' + e.toString());
    return {ok: false, msg: 'Error: ' + e.toString()};
  }
}

// ===== APARIENCIA (colores y tipografía globales/por pantalla) =====
// Se guarda como un único JSON en la celda A1 de una hoja "Apariencia"
// (se crea sola la primera vez que el Administrador guarda algo). Es una
// sola configuración para toda la organización, no por usuario.
function getAparienciaConfig() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Apariencia');
    if (!sh) return '';
    var val = sh.getRange('A1').getValue();
    return val ? String(val) : '';
  } catch (e) {
    Logger.log('getAparienciaConfig error: ' + e.message);
    return '';
  }
}
function saveAparienciaConfig(json) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Apariencia');
    if (!sh) {
      sh = ss.insertSheet('Apariencia');
      sh.getRange('B1').setValue('No editar manualmente: esta hoja guarda la configuración de la pestaña "Apariencia" (colores y tipografía) en formato JSON, en la celda A1.');
      sh.hideSheet();
    }
    sh.getRange('A1').setValue(json || '{}');
    return 'ok';
  } catch (e) {
    Logger.log('saveAparienciaConfig error: ' + e.message);
    return 'error: ' + e.message;
  }
}


// ===================================================================
// CARGOS FIRMADOS Y DEVOLUCIONES (solo lectura)
// Lee la planilla de la app "Cargos del Personal" (pestañas CargosFirmados y
// devolucion). No escribe ni modifica nada: solo devuelve los registros
// agrupados por número para mostrarlos en Gestión de Personal.
// ===================================================================
var CARGOSAPP_SS_ID = '1ssAnwYukpM1RFD3LQP4nYZ8YzOyw-X6fJEg36NObEU4';

var _CAP_COLS = [
  { key: 'id', names: ['id'] },
  { key: 'fecha', names: ['fecha'] },
  { key: 'nombre', names: ['apellido y nombre', 'nombre y apellido', 'apellido nombre', 'nombre'] },
  { key: 'legajo', names: ['legajo', 'lp'] },
  { key: 'empresa', names: ['empresa'] },
  { key: 'dni', names: ['dni'] },
  { key: 'objetivo', names: ['objetivo', 'servicio'] },
  { key: 'cantidad', names: ['cantidad'] },
  { key: 'codigo', names: ['codigo'] },
  { key: 'item', names: ['items', 'item', 'elemento'] },
  { key: 'observaciones', names: ['observaciones'] },
  { key: 'pdf', names: ['pdf'] },
  { key: 'supervisor', names: ['supervisor'] },
  { key: 'dnisup', names: ['dni supervisor'] }
];

function _capNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function _capHoja(ss, tipo) {
  var buscar = tipo === 'devolucion' ? ['devolucion', 'devoluciones'] : ['cargosfirmados'];
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) {
    if (buscar.indexOf(_capNorm(hojas[i].getName()).replace(/ /g, '')) >= 0) return hojas[i];
  }
  return null;
}

function _capFechaIso(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

/** Convierte el enlace de Drive guardado en la planilla en uno que abre el PDF directo. */
function _capPdf(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  var m = u.match(/\/d\/([\w-]{15,})/) || u.match(/[?&]id=([\w-]{15,})/);
  return m ? 'https://drive.google.com/uc?export=view&id=' + m[1] : u;
}

/**
 * tipo = 'cargo' (pestaña CargosFirmados) o 'devolucion' (pestaña devolucion).
 * Devuelve { ok:true, registros:[...] } o { ok:false, error:'...' }.
 */
function getCargosFirmadosSGI(tipo) {
  try {
    tipo = String(tipo || 'cargo') === 'devolucion' ? 'devolucion' : 'cargo';
    var ss = SpreadsheetApp.openById(CARGOSAPP_SS_ID);
    var sh = _capHoja(ss, tipo);
    if (!sh) {
      return { ok: true, registros: [], aviso: tipo === 'devolucion'
        ? 'Todavía no hay devoluciones registradas.' : 'No se encontró la pestaña CargosFirmados.' };
    }
    var lastR = sh.getLastRow(), lastC = sh.getLastColumn();
    if (lastR < 2 || lastC < 1) return { ok: true, registros: [] };

    var vals = sh.getRange(1, 1, lastR, lastC).getValues();
    var heads = vals[0].map(_capNorm);
    var col = {};
    _CAP_COLS.forEach(function (d, pos) {
      var idx = -1;
      for (var n = 0; n < d.names.length && idx < 0; n++) idx = heads.indexOf(_capNorm(d.names[n]));
      col[d.key] = idx >= 0 ? idx : pos;
    });
    var tz = ss.getSpreadsheetTimeZone();
    var g = function (r, k) { return col[k] < r.length ? r[col[k]] : ''; };

    var grupos = {}, orden = [];
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      var id = String(g(r, 'id')).trim();
      if (!id && !String(g(r, 'nombre')).trim() && !String(g(r, 'dni')).trim() && !String(g(r, 'item')).trim()) continue;
      var iso = _capFechaIso(g(r, 'fecha'), tz);
      var clave = id ? 'id:' + id : 'sin:' + iso + '|' + String(g(r, 'dni')).replace(/\D/g, '') + '|' + String(g(r, 'objetivo')).trim();
      if (!grupos[clave]) {
        grupos[clave] = {
          key: tipo + ':' + (id || ('f' + i)),
          id: id,
          fechaIso: iso,
          fecha: iso ? iso.split('-').reverse().join('/') : '',
          nombre: String(g(r, 'nombre') || ''),
          lp: String(g(r, 'legajo') || ''),
          empresa: String(g(r, 'empresa') || ''),
          dni: String(g(r, 'dni') || ''),
          objetivo: String(g(r, 'objetivo') || ''),
          observaciones: String(g(r, 'observaciones') || ''),
          pdf: _capPdf(g(r, 'pdf')),
          supervisor: String(g(r, 'supervisor') || ''),
          dniSup: String(g(r, 'dnisup') || ''),
          fila: i,
          items: []
        };
        orden.push(clave);
      }
      var gr = grupos[clave];
      if (!gr.pdf && String(g(r, 'pdf') || '').trim()) gr.pdf = _capPdf(g(r, 'pdf'));
      gr.items.push({ cantidad: String(g(r, 'cantidad')), codigo: String(g(r, 'codigo') || ''), item: String(g(r, 'item') || '') });
    }

    var res = orden.map(function (k) { return grupos[k]; });
    res.sort(function (a, b) {
      if (a.fechaIso !== b.fechaIso) return a.fechaIso < b.fechaIso ? 1 : -1;
      var na = parseInt(a.id, 10), nb = parseInt(b.id, 10);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return nb - na;
      return b.fila - a.fila;
    });
    return { ok: true, registros: res };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}


// ==============================================================
// ACCESO DIRECTO DESDE "NOVEDADES DEL PERSONAL" (botón SGI)
// Novedades abre el SGI con ?sso=usuario.vence.firma (un solo uso, vence a los 2 minutos).
// La firma usa una clave que Novedades guarda en la pestaña oculta "SSO_Novedades" de esta planilla
// (celda A1): no hay que configurar nada a mano. Si se entra por el enlace normal, pide usuario y clave.
// ==============================================================
function loginSSO(pase) {
  try {
    var p = String(pase || '').split('.');
    if (p.length !== 3) return { ok: false, error: 'Acceso directo inválido.' };
    var vence = Number(p[1]);
    if (!vence || Date.now() > vence) return { ok: false, error: 'El acceso directo venció: volvé a tocar el botón SGI en Novedades del Personal.' };
    var ss = SpreadsheetApp.openById(getSsId()), h = ss.getSheetByName('SSO_Novedades');
    var secreto = h ? String(h.getRange('A1').getValue() || '').trim() : '';
    if (!secreto) return { ok: false, error: 'Falta la clave del acceso directo: abrí Novedades del Personal una vez como administración.' };
    var firma = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p[0] + '.' + p[1], secreto)).replace(/=+$/, '');
    if (firma !== p[2]) return { ok: false, error: 'Acceso directo inválido.' };
    var cache = CacheService.getScriptCache(), k = 'sso_usado_' + p[2].slice(0, 40);
    if (cache.get(k)) return { ok: false, error: 'Ese acceso directo ya se usó: volvé a tocar el botón SGI.' };
    cache.put(k, '1', 600);
    var b64 = p[0] + '===='.slice(0, (4 - p[0].length % 4) % 4);
    var usuario = Utilities.newBlob(Utilities.base64DecodeWebSafe(b64)).getDataAsString('UTF-8').trim().toLowerCase();
    var rows = getData('Usuarios y contraseñas');
    if (!rows || rows.length < 2) return { ok: false, error: 'Sin datos de usuarios' };
    var headers = rows[0].map(function (x) { return String(x || '').trim().toLowerCase(); });
    var uCol = headers.indexOf('usuario'); if (uCol < 0) uCol = 2;
    var nCol = headers.indexOf('nombre'); if (nCol < 0) nCol = 1;
    var rCol = headers.indexOf('rol'); if (rCol < 0) rCol = 4;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][uCol] || '').trim().toLowerCase() === usuario) {
        try { guardarUltimaConexion(usuario, new Date().toISOString()); } catch (ex) { }
        return { ok: true, nombre: String(rows[i][nCol] || ''), rol: String(rows[i][rCol] || ''), usuario: usuario };
      }
    }
    return { ok: false, error: 'El usuario no está en el SGI.' };
  } catch (e) { return { ok: false, error: e.message }; }
}
