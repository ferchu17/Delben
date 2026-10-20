// ============================================================
//  CONFIGURACIÓN DE LA APP  (única cosa que hay que editar acá)
// ============================================================
window.APP_CONFIG = {
  // URL de la implementación web de Apps Script (termina en /exec).
  // Si queda vacía, la app corre en MODO DEMO (datos de ejemplo, no guarda ni envía nada).
  // En modo demo se entra con usuario "demo" / "demo" (servicio) o "admin" / "admin" (administración).
  API_URL: "https://script.google.com/macros/s/AKfycbxhAxhilopxEcSrkeaAbCY7gcS0r2mUhesj-1zsjmzkgxMxrn8YOOEVFnnqj8gCtWJ3LQ/exec",

  // Fotos: lado mayor en píxeles y calidad JPEG (más bajo = PDF y envío más livianos)
  FOTO_MAX_PX: 1400,
  FOTO_CALIDAD: 0.75,
  FOTOS_MAX: 60,      // máximo de fotos por minuta

  // Logos (rutas dentro de esta carpeta)
  LOGO_APP: "assets/logo_delben.png",   // pantalla de ingreso y encabezado de la app
  LOGO_PDF: "assets/logo_ktl.jpg"       // sale en el PDF (arriba a la izquierda)
};
