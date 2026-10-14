/* Novedades del Personal - puente para GitHub Pages.
   Hace que la app funcione igual que dentro de Apps Script: cada google.script.run.funcion(...) se manda
   al backend (doPost de Apps Script) y la respuesta vuelve a la app. No cambia nada de la lógica ni de los cálculos. */
(function () {
  'use strict';
  var CLAVE = 'delben_novedades_backend';
  function backend() {
    var u = '';
    try { var q = new URLSearchParams(location.search).get('servidor'); if (q) localStorage.setItem(CLAVE, q); } catch (e) { }
    try { u = localStorage.getItem(CLAVE) || ''; } catch (e) { }
    return String(window.NOVEDADES_BACKEND || u || '').trim();
  }
  function llamar(fn, args, ok, mal, obj) {
    var url = backend();
    if (!url) { var e0 = new Error('Falta configurar la dirección del servidor (Apps Script).'); if (mal) mal(e0, obj); pedirServidor(); return; }
    fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args || [] }) })
      .then(function (r) {
        return r.text().then(function (t) {
          var p; try { p = JSON.parse(t); } catch (e) { throw new Error(/<html/i.test(t) ? 'El servidor pidió iniciar sesión en Google: la implementación de Apps Script tiene que estar con acceso "Cualquier persona".' : 'Respuesta no válida del servidor.'); }
          if (!p || p.ok !== true) throw new Error((p && p.error) || ('HTTP ' + r.status));
          return p.result;
        });
      })
      .then(function (res) { if (ok) ok(res, obj); })
      .catch(function (err) { if (mal) mal(err, obj); else console.error('Novedades ' + fn, err); });
  }
  function runner(ok, mal, obj) {
    var base = {
      withSuccessHandler: function (f) { return runner(typeof f === 'function' ? f : ok, mal, obj); },
      withFailureHandler: function (f) { return runner(ok, typeof f === 'function' ? f : mal, obj); },
      withUserObject: function (o) { return runner(ok, mal, o); }
    };
    return new Proxy(base, { get: function (t, k) { if (k in t) return t[k]; if (k === 'then') return undefined; return function () { llamar(String(k), Array.prototype.slice.call(arguments), ok, mal, obj); }; } });
  }
  // Primera vez sin servidor configurado: se pide la dirección (queda guardada en este navegador)
  function pedirServidor() {
    if (document.getElementById('nvServidor')) return;
    var d = document.createElement('div');
    d.id = 'nvServidor';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(10,30,60,.45);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:system-ui,sans-serif';
    d.innerHTML = '<div style="background:#fff;border-radius:12px;padding:20px 22px;max-width:560px;width:92%">' +
      '<h3 style="margin:0 0 8px">Falta la dirección del servidor</h3><p style="margin:0 0 10px;color:#475569">Pegá la URL de la Aplicación web de Apps Script de Novedades del Personal (termina en <b>/exec</b>).</p>' +
      '<input id="nvUrl" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px" placeholder="https://script.google.com/macros/s/.../exec">' +
      '<div style="text-align:right;margin-top:12px"><button id="nvOk" style="padding:8px 16px;background:#1660c9;color:#fff;border:0;border-radius:6px">Guardar</button></div></div>';
    document.body.appendChild(d);
    document.getElementById('nvOk').onclick = function () {
      var v = document.getElementById('nvUrl').value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/.test(v)) { alert('La URL tiene que ser la de la Aplicación web y terminar en /exec.'); return; }
      try { localStorage.setItem(CLAVE, v); } catch (e) { }
      location.reload();
    };
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = runner(null, null, null);
  window.NOVEDADES_EN_GITHUB = true;
})();
