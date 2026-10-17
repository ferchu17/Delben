/* Instructivos interactivos DELBEN — motor común.
   Cada instructivo define window.GUIA y carga este archivo:
   GUIA = { app, sub, icono (Font Awesome), c1, c2, abrir (link de la app), apk (opcional),
            roles: [ { id, nombre, pasos: [ { t, html, tel: { cont, tabs, on, titulo, quien, oscuro } } ], faq: [[preg, resp]], quiz: [{p, o:[], c}] } ] } */
(function () {
  'use strict';
  const G = window.GUIA;
  document.documentElement.style.setProperty('--c1', G.c1 || '#1d4f9f');
  document.documentElement.style.setProperty('--c2', G.c2 || '#163d7a');
  document.title = 'Instructivo - ' + G.app;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Teléfono simulado
  window.TEL = function (t) {
    t = t || {};
    const tabs = t.tabs ? '<div class="tabs">' + t.tabs.map(x => '<i class="' + (x === t.on ? 'on' : '') + '">' + esc(x) + '</i>').join('') + '</div>' : '';
    return '<div class="tel' + (t.oscuro ? ' oscuro' : '') + '">' +
      (t.sinBarra ? '' : '<div class="bar"><span class="mi"><i class="' + esc(G.icono) + '"></i></span><div><b>' + esc(t.titulo || G.app) + '</b><span>' + esc(t.quien || '') + '</span></div>' + (t.salir === false ? '' : '<span class="s">' + esc(t.salir || 'Salir') + '</span>') + '</div>') +
      tabs + '<div class="cont">' + (t.cont || '') + '</div></div>';
  };

  // Estructura de la página
  document.body.innerHTML =
    '<header class="top"><span class="ic"><i class="' + esc(G.icono) + '"></i></span>' +
    '<div class="t"><b>Instructivo: ' + esc(G.app) + '</b><span>' + esc(G.sub || 'DELBEN · Sistema de Gestión Integral') + '</span></div>' +
    '<div class="acc"><button class="wsp" onclick="compartirGuia()"><i class="fa-brands fa-whatsapp"></i> <span class="txt">Compartir</span></button>' +
    (G.abrir ? '<a href="' + esc(G.abrir) + '"><i class="fa-solid fa-arrow-up-right-from-square"></i> <span class="txt">Abrir la app</span></a>' : '') +
    '<a href="../instructivos/"><i class="fa-solid fa-book"></i> <span class="txt">Instructivos</span></a></div></header>' +
    (G.roles.length > 1 ? '<div class="roles">' + G.roles.map(r => '<button id="rol-' + r.id + '" onclick="elegirRol(\'' + r.id + '\')">' + esc(r.nombre) + '</button>').join('') + '</div>' : '') +
    '<main><div class="layout"><nav class="indice" id="indice"></nav><section><div class="barra"><div id="prog"></div></div><div id="paso"></div></section></div></main>';
  if (G.roles.length <= 1) document.documentElement.style.setProperty('--rolesH', '0');

  let R = G.roles[0], I = 0;
  const vistos = {};
  G.roles.forEach(r => { vistos[r.id] = new Set(); });

  window.elegirRol = function (id) {
    R = G.roles.find(r => r.id === id) || G.roles[0]; I = 0;
    G.roles.forEach(r => { const b = $('rol-' + r.id); if (b) b.classList.toggle('on', r === R); });
    try { history.replaceState(null, '', '#' + R.id); } catch (e) { }
    pintar();
  };
  window.irPaso = function (i) { I = i; pintar(); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  function pintar() {
    const P = R.pasos, extra = (R.faq && R.faq.length ? 1 : 0) + (R.quiz && R.quiz.length ? 1 : 0), total = P.length + extra;
    vistos[R.id].add(I);
    const items = P.map(p => p.t).concat(R.faq && R.faq.length ? ['Preguntas frecuentes'] : []).concat(R.quiz && R.quiz.length ? ['Autoevaluación'] : []);
    $('indice').innerHTML = '<h3>' + esc(R.nombre) + '</h3>' + items.map((t, i) => {
      const ok = vistos[R.id].has(i) && i !== I;
      return '<button class="' + (i === I ? 'on ' : '') + (ok ? 'ok' : '') + '" onclick="irPaso(' + i + ')"><span class="n">' + (ok ? '✓' : i + 1) + '</span>' + esc(t) + '</button>';
    }).join('');
    const act = document.querySelector('.indice button.on'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
    $('prog').style.width = Math.round(vistos[R.id].size / total * 100) + '%';
    const nav = '<div class="nav"><button class="btn gris" ' + (I === 0 ? 'disabled' : '') + ' onclick="irPaso(' + (I - 1) + ')">← Anterior</button>' +
      '<span style="color:var(--gris);font-size:13px">' + (I + 1) + ' de ' + total + '</span>' +
      (I < total - 1 ? '<button class="btn" onclick="irPaso(' + (I + 1) + ')">Siguiente →</button>' :
        (G.abrir ? '<a class="btn verde" href="' + esc(G.abrir) + '">Abrir la app</a>' : '<a class="btn verde" href="../instructivos/">Instructivos</a>')) + '</div>';
    const el = $('paso');
    if (I < P.length) {
      const p = P[I];
      const tel = p.tel ? TEL(p.tel) : '';
      el.innerHTML = '<div class="paso' + (tel ? '' : ' sola') + '"><div><div class="num">Paso ' + (I + 1) + '</div><h2>' + esc(p.t) + '</h2>' + p.html + (p.extra ? p.extra() : '') + nav + '</div>' + (tel ? '<div>' + tel + '</div>' : '') + '</div>';
      if (p.init) p.init();
    } else if (I === P.length && R.faq && R.faq.length) {
      el.innerHTML = '<div class="paso sola"><div><div class="num">Ayuda</div><h2>Preguntas frecuentes</h2><div class="faq">' +
        R.faq.map(x => '<details><summary>' + esc(x[0]) + '</summary><p>' + x[1] + '</p></details>').join('') + '</div>' + nav + '</div></div>';
    } else {
      el.innerHTML = '<div class="paso sola"><div class="quiz"><div class="num">Para terminar</div><h2>Autoevaluación</h2><p>Tocá la respuesta correcta.</p>' +
        R.quiz.map((q, i) => '<div style="margin:14px 0"><b>' + (i + 1) + '. ' + esc(q.p) + '</b>' + q.o.map((o, j) => '<button class="op" onclick="responder(this,' + i + ',' + j + ')">' + esc(o) + '</button>').join('') + '<div id="qr' + i + '" style="font-weight:700"></div></div>').join('') + nav + '</div></div>';
    }
  }
  window.responder = function (b, i, j) {
    const ok = R.quiz[i].c === j;
    b.parentNode.querySelectorAll('.op').forEach(x => x.classList.remove('bien', 'mal'));
    b.classList.add(ok ? 'bien' : 'mal');
    $('qr' + i).innerHTML = ok ? '<span style="color:var(--verde)">¡Correcto!</span>' : '<span style="color:var(--rojo)">Probá otra vez.</span>';
  };
  window.compartirGuia = function () {
    const url = location.href.split('#')[0] + (G.roles.length > 1 ? '#' + R.id : '');
    let txt = '*Instructivo: ' + G.app + '* - DELBEN\n\nCómo usar la app, paso a paso:\n' + url;
    if (G.abrir) txt += '\n\nAbrir la app:\n' + new URL(G.abrir, location.href).href;
    if (G.apk) txt += '\n\nDescargar la app (Android):\n' + new URL(G.apk, location.href).href;
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  };

  const h = location.hash.replace('#', '');
  elegirRol(G.roles.some(r => r.id === h) ? h : G.roles[0].id);
})();
