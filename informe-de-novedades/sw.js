// Service worker mínimo: hace que la página sea instalable (PWABuilder / Chrome).
// No guarda nada en caché: siempre se usa la última versión publicada en GitHub.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:18px sans-serif;padding:24px">Sin conexión a Internet. Conectate y volvé a abrir la app.</p>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
