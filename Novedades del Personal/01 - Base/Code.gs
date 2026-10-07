function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CFG.APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

function obtenerEstadoSistema() {
  return {
    ok: true,
    nombre: CFG.APP_TITLE,
    version: CFG.APP_VERSION,
    zonaHoraria: CFG.TIMEZONE
  };
}
