// ============================================================
//  CONFIGURACIÓN DE LA APP  (única cosa que hay que editar acá)
// ============================================================
window.APP_CONFIG = {
  // URL de la implementación web de Apps Script (termina en /exec).
  // Si queda vacía, la app corre en MODO DEMO (datos de ejemplo, no guarda nada).
  API_URL: "https://script.google.com/macros/s/AKfycbzGboBpezEv9q9yJBRFaSIGfua4NP1sqZCVuzVXDe-hqCkrlN6f8YQnG8Y2S6ZOo4HJVw/exec",

  // Mismo valor que CONFIG.TOKEN en backend/Code.gs (opcional, recomendado).
  TOKEN: "",

  // Cantidad máxima de destinatarios en "Para" y en "Con copia".
  MAX_PARA: 5,
  MAX_CC: 5,

  // Fotos: lado mayor en píxeles y calidad JPEG (más bajo = PDF más liviano)
  FOTO_MAX_PX: 1500,
  FOTO_CALIDAD: 0.8,

  // Logos (rutas relativas dentro de esta carpeta)
  LOGO_APP: "assets/logo_delben.png",   // se ve en la aplicación
  LOGO_PDF: "assets/logo_ktl.jpg"       // sale en el PDF
};
