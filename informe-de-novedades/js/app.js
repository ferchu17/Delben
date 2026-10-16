/* ============================================================
   Informe de Novedades — lógica de la aplicación
   ============================================================ */
(function () {
  const CFG = window.APP_CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const DEMO = !CFG.API_URL;

  const S = { usuarios: [], quienesRetiran: [], personal: [], objetivos: [], para: [], cc: [], fotos: [null, null, null, null], pdfCache: {} };

  /* ---------------- utilidades ---------------- */
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const okMail = (m) => { const l = String(m || "").split(/[;,\s]+/).filter(Boolean); return l.length > 0 && l.every((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)); };
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const isoToAr = (iso) => { const p = String(iso).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso; };

  let toastT;
  function toast(msg, err) {
    const t = $("#toast"); if (!t) { console.error(msg); return; } t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), err ? 6000 : 3000);
  }
  function overlay(txt) { const o = $("#overlay"); if (txt) { $("#overlayTxt").textContent = txt; o.hidden = false; } else o.hidden = true; }
  function openModal(html) { $("#modalBody").innerHTML = html; $("#modal").hidden = false; document.body.style.overflow = "hidden"; }
  function closeModal() { $("#modal").hidden = true; $("#modalBody").innerHTML = ""; document.body.style.overflow = ""; }

  /* ---------------- API (Apps Script o demo) ---------------- */
  const DEMO_DB = {
    next: 4,
    items: [
      { id: 1, numero: "0001", fecha: "02/10/2026", de: "Celso Canaveta", para: "Gustavo San Martín", asunto: "Faltante de personal en puesto 3", objetivo: "Planta Norte", informe: "Siendo las 06:15 del día 02/10 en el puesto 3 de Planta Norte, el vigilador de turno no se presentó a cubrir el servicio. Se comunicó con la base y se cubrió con personal de refuerzo.", medidas: "Se cubrió el puesto con personal de refuerzo y se dejó asentado en el libro de novedades.", link: "" },
      { id: 2, numero: "0002", fecha: "07/10/2026", de: "Fernando Jacino", para: "Celso Canaveta; Gustavo San Martín", asunto: "Portón de acceso con falla", objetivo: "Depósito Central", informe: "El portón vehicular de acceso presenta falla en el motor desde las 22:40 del día 06/10. Quedó abierto manualmente.", medidas: "Se dio aviso a mantenimiento y se reforzó la guardia en el acceso.", link: "" },
      { id: 3, numero: "0003", fecha: "12/10/2026", de: "Gustavo San Martín", para: "Fernando Jacino", asunto: "Ronda de control sin novedades", objetivo: "Planta Norte", informe: "Se realizó ronda completa de control a las 14:00. Sin novedades. Se verificaron cierres y luminarias.", medidas: "Sin medidas adicionales.", link: "" }
    ],
    personal: [
      { nombre: "Martínez Juan Carlos", empresa: "KTL Seguridad", legajo: "1021", email: "" },
      { nombre: "Martínez Ana Laura", empresa: "KTL Seguridad", legajo: "1187", email: "" },
      { nombre: "Martínez Pablo", empresa: "Del Ben SRL", legajo: "2045", email: "" },
      { nombre: "Gómez María", empresa: "KTL Seguridad", legajo: "1310", email: "maria@ejemplo.com" },
      { nombre: "San Martín Gustavo", empresa: "KTL Seguridad", legajo: "900", email: "gustavo@ejemplo.com" },
      { nombre: "Jacino Fernando", empresa: "KTL Seguridad", legajo: "801", email: "fjacino@ejemplo.com" }
    ],
    users: [
      { nombre: "Celso Canaveta", email: "celso@ejemplo.com" }, { nombre: "Fernando Jacino", email: "fjacino@ejemplo.com" },
      { nombre: "Gustavo San Martín", email: "gustavo@ejemplo.com" }, { nombre: "María Gómez", email: "" }, { nombre: "Laura Benítez", email: "laura@ejemplo.com" }
    ],
    objetivos: [
      { nombre: "Planta Norte", email: "plantanorte@ejemplo.com" }, { nombre: "Depósito Central", email: "deposito@ejemplo.com" },
      { nombre: "Edificio Corporativo", email: "" }, { nombre: "Barrio Los Álamos", email: "alamos@ejemplo.com" }
    ]
  };

  let listasPromise = null;
  let ultimoCargaListas = 0;
  async function api(action, payload) {
    if (DEMO) return demo(action, payload || {});
    // Listas y número se piden por GET (más simple y rápido desde el celular), cada uno por separado.
    if (action === "listas") {
      if (!listasPromise || Date.now() - ultimoCargaListas > 60000) {
        ultimoCargaListas = Date.now();
        listasPromise = getJSON("listas", 90000).catch((err) => { listasPromise = null; throw err; });
      }
      return listasPromise;
    }
    if (action === "numero") return getJSON("numero", 30000);
    const r = await fetch(CFG.API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action, token: CFG.TOKEN }, payload || {}))
    });
    const raw = await r.text();
    if (!r.ok) throw new Error("Apps Script respondió HTTP " + r.status + ". " + String(raw || "").replace(/\\s+/g, " ").slice(0, 180));
    let j;
    try { j = JSON.parse(raw); }
    catch (_) {
      const muestra = String(raw || "").replace(/\\s+/g, " ").slice(0, 180);
      throw new Error("El backend devolvió HTML en vez de JSON. Revisá que la implementación de Apps Script esté activa y accesible. Respuesta: " + muestra);
    }
    if (!j.ok) throw new Error(j.error || "Error del servidor");
    return j;
  }

  // GET al Apps Script con tiempo límite y un mensaje que dice qué pasó.
  async function getJSON(action, ms) {
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    let response, raw;
    try {
      response = await fetch(CFG.API_URL + "?action=" + action + "&t=" + Date.now(), { method: "GET", cache: "no-store", redirect: "follow", signal: ctl ? ctl.signal : undefined });
      raw = await response.text();
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("El servidor tardó demasiado en responder (más de " + Math.round(ms / 1000) + " s). Tocá Reintentar.");
      throw new Error(navigator.onLine === false ? "El celular no tiene conexión a Internet." : "No se pudo conectar con el servidor (Apps Script). Revisá la conexión y tocá Reintentar.");
    } finally { if (t) clearTimeout(t); }
    if (!response.ok) throw new Error("El Apps Script respondió con error HTTP " + response.status + ". Revisá que la implementación esté activa (Implementar › Gestionar implementaciones).");
    let data;
    try { data = JSON.parse(raw); }
    catch (_) { throw new Error("El Apps Script devolvió una página en vez de datos: suele ser que falta aceptar permisos o publicar la Nueva versión. En el editor ejecutá probarListas y después Implementar › Gestionar implementaciones › Nueva versión."); }
    if (!data.ok) throw new Error("Error del servidor: " + (data.error || "sin detalle"));
    return data;
  }

  async function demo(action, p) {
    await new Promise((r) => setTimeout(r, 350));
    const pad = (n) => String(n).padStart(4, "0");
    if (action === "numero") return { ok: true, siguiente: pad(DEMO_DB.next) };
    if (action === "listas") return { ok: true, usuarios: DEMO_DB.users, quienRetira: DEMO_DB.personal, personal: DEMO_DB.personal, objetivos: DEMO_DB.objetivos, siguiente: pad(DEMO_DB.next), errores: [] };
    if (action === "reservar") {
      const d = p.data, it = { id: DEMO_DB.next, numero: pad(DEMO_DB.next), fecha: d.fecha, de: d.de, para: d.para.join("; "), asunto: d.asunto, objetivo: d.objetivo, informe: d.informe, medidas: d.medidas, link: "" };
      DEMO_DB.items.push(it); DEMO_DB.next++; return { ok: true, id: it.id, numero: it.numero };
    }
    if (action === "finalizar") {
      const it = DEMO_DB.items.find((x) => x.id === p.id); it.pdf = p.pdfBase64; it.link = "https://drive.google.com/demo/" + it.numero;
      return { ok: true, id: it.id, numero: it.numero, url: it.link, enviados: { to: p.to, cc: p.cc } };
    }
    if (action === "buscar") {
      const tk = norm(p.q).split(/\s+/).filter(Boolean);
      const items = DEMO_DB.items.filter((it) => {
        const hay = norm([it.numero, it.fecha, it.de, it.para, it.asunto, it.objetivo, it.informe, it.medidas].join(" "));
        const f = it.fecha.split("/").reverse().join("-");
        return tk.every((t) => hay.includes(t)) && (!p.desde || f >= p.desde) && (!p.hasta || f <= p.hasta);
      }).sort((a, b) => b.id - a.id);
      return { ok: true, items, total: items.length };
    }
    if (action === "pdf") {
      const it = DEMO_DB.items.find((x) => x.id === p.id);
      if (!it.pdf) { const r = await buildPdfFrom(it, []); it.pdf = r.base64; }
      return { ok: true, base64: it.pdf, nombre: "Informe_de_Novedades_" + it.numero + ".pdf", url: it.link || "#" };
    }
    if (action === "reenviar") return { ok: true, enviados: { to: p.to, cc: p.cc } };
    throw new Error("Acción demo desconocida");
  }

  /* ---------------- voz ---------------- */
  let rec = null, recBtn = null, recInput = null;
  function micApagar() {
    if (recBtn) { recBtn.classList.remove("rec"); const sp = $("span", recBtn); if (sp) sp.textContent = "Hablar"; }
    if (recInput) { recInput.el.removeEventListener("input", recInput.fn); }
    rec = null; recBtn = null; recInput = null;
  }
  function stopRec() {
    $$(".mic.rec").forEach((b) => { b.classList.remove("rec"); const sp = $("span", b); if (sp) sp.textContent = "Hablar"; });
    if (rec) { const r = rec; rec = null; try { r.onend = null; r.stop(); } catch (e) {} }
    micApagar();
  }
  // Une dos textos con un solo espacio y mayúscula inicial después de punto.
  function unirTexto(a, b) {
    b = String(b || "").replace(/^\s+|[ \t]+$/g, ""); if (!b) return a;
    if (!a.trim()) return b.charAt(0).toUpperCase() + b.slice(1);
    const limpio = a.replace(/[ \t]+$/, "");
    if (/[.!?]$/.test(limpio) || /\n$/.test(limpio)) b = b.charAt(0).toUpperCase() + b.slice(1);
    if (/^[.,;:?!)]/.test(b) || /\n$/.test(limpio)) return limpio + b;
    return limpio + " " + b;
  }
  // Comandos de voz al final de una frase: "punto", "coma", "punto y aparte", "nueva línea".
  function comandosVoz(t) {
    return t.replace(/\s*\b(punto y aparte|punto aparte)\s*$/i, ".\n").replace(/\s*\b(nueva línea|nuevo renglón|nueva linea)\s*$/i, "\n")
      .replace(/\s+punto y coma\s*$/i, ";").replace(/\s+dos puntos\s*$/i, ":").replace(/\s+coma\s*$/i, ",").replace(/\s+punto\s*$/i, ".");
  }
  // Dictado por voz con el botón 🎤 de la pantalla. Mismo funcionamiento que el 15/10, con diagnóstico visible.
  const ES_WEBVIEW = /; wv\)/.test(navigator.userAgent) || (/Android/.test(navigator.userAgent) && /Version\/[\d.]+/.test(navigator.userAgent) && !/SamsungBrowser/.test(navigator.userAgent));
  const ABRIR_EN_CHROME = "Abrí la app en Chrome: " + location.origin + location.pathname + " (desde Chrome, menú ⋮ › Agregar a pantalla principal, así queda el ícono y el micrófono funciona).";
  // Datos para saber por qué no anda el dictado: modo de la app, permiso y si el micrófono responde.
  async function diagnosticoMic() {
    const d = { mic: "?", permiso: "?" };
    const modo = window.matchMedia && matchMedia("(display-mode: standalone)").matches ? "ícono instalado" : "pestaña del navegador";
    try { if (navigator.permissions) d.permiso = (await navigator.permissions.query({ name: "microphone" })).state; } catch (e) {}
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const st = await Promise.race([navigator.mediaDevices.getUserMedia({ audio: true }), new Promise((_, rej) => setTimeout(() => rej(new Error("sin respuesta")), 8000))]);
        st.getTracks().forEach((t) => t.stop()); d.mic = "ok";
      } catch (e) { d.mic = (e && e.name && e.name !== "Error" ? e.name : (e && e.message) || "error"); }
    } else d.mic = "sin getUserMedia";
    const nav = (navigator.userAgent.match(/(SamsungBrowser|EdgA|OPR|Firefox|Chrome)\/[\d]+/) || ["?"])[0];
    d.texto = modo + " · permiso " + d.permiso + " · micrófono " + d.mic + " · " + nav + (ES_WEBVIEW ? " · WebView" : "");
    return d;
  }
  function toggleMic(btn) {
    if (recBtn === btn) return stopRec();
    stopRec();
    const target = document.getElementById(btn.dataset.target), state = $(`.mic-state[data-for="${btn.dataset.target}"]`);
    const nota = (m, err) => { if (state) { state.textContent = m; state.style.color = err ? "#b42318" : ""; } if (err) toast(m, true); };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    nota("Iniciando micrófono…");
    if (!window.isSecureContext) return nota("El dictado necesita abrir la app con https://. " + ABRIR_EN_CHROME, true);
    if (!SR) return nota(ES_WEBVIEW
      ? "Esta app instalada no trae el dictado de voz de Chrome, por eso el 🎤 de la pantalla no puede andar acá. " + ABRIR_EN_CHROME
      : "Este navegador no tiene dictado de voz. Usá Google Chrome actualizado. " + ABRIR_EN_CHROME, true);

    const r = new SR(); r.lang = "es-AR"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    const base = target.value ? target.value.replace(/\s+$/, "") + " " : "";
    // El navegador vuelve a entregar resultados anteriores en cada evento: se guardan por índice.
    const segmentos = [];
    let eventos = 0, huboTexto = false, fallo = false;
    const vivo = () => { eventos++; };
    r.onstart = () => { vivo(); delete btn.dataset.reintento; nota("🔴 Escuchando… hablá ahora (tocá el botón para terminar)"); };
    r.onaudiostart = () => { vivo(); nota("🔴 Micrófono activo, te escucho…"); };
    r.onspeechstart = () => { vivo(); nota("🔴 Te oigo…"); };
    r.onresult = (ev) => {
      vivo(); huboTexto = true;
      for (let i = 0; i < ev.results.length; i++) segmentos[i] = ev.results[i][0].transcript;
      target.value = (base + segmentos.filter(Boolean).join(" ")).replace(/[ \t]+/g, " ").trimStart();
      target.dispatchEvent(new Event("input", { bubbles: true }));
      if (target.tagName === "TEXTAREA") target.scrollTop = target.scrollHeight;
      nota("🔴 Escuchando… texto recibido");
    };
    r.onerror = (e) => {
      vivo(); fallo = true;
      const messages = {
        "not-allowed": "El micrófono está bloqueado para esta página. En Chrome: tocá el candado 🔒 al lado de la dirección › Permisos › Micrófono › Permitir. Si usás el ícono instalado: Ajustes del celular › Aplicaciones › Chrome › Permisos › Micrófono › Permitir.",
        "service-not-allowed": ES_WEBVIEW ? "Esta app instalada no permite el dictado de voz. " + ABRIR_EN_CHROME : "El servicio de voz de Google está desactivado. Ajustes › Aplicaciones › Google › Permisos › Micrófono › Permitir, y que la app Google esté actualizada.",
        "audio-capture": "No se pudo usar el micrófono: puede estar ocupado por otra app (llamada, grabadora, WhatsApp). Cerrala y volvé a tocar 🎤.",
        "network": "El dictado necesita Internet y no pudo conectar con el servicio de voz de Google. Revisá la conexión.",
        "no-speech": "No se escuchó ninguna voz. Tocá 🎤 Hablar y hablá cerca del celular.",
        "language-not-supported": "El celular no tiene el dictado en español instalado (Ajustes › Google › Voz).",
        "aborted": "Dictado detenido."
      };
      nota(messages[e.error] || ("Error del micrófono: " + e.error), e.error !== "aborted");
    };
    r.onend = () => {
      vivo(); clearTimeout(perro);
      if (rec !== r) return;
      rec = null;
      if (recBtn) { recBtn.classList.remove("rec"); const sp = $("span", recBtn); if (sp) sp.textContent = "Hablar"; }
      recBtn = null;
      if (!fallo) nota(huboTexto ? "Dictado terminado. Tocá 🎤 Hablar para seguir dictando." : "Terminó sin texto. Tocá 🎤 Hablar y hablá enseguida.");
    };
    // Si en 7 segundos no llegó ninguna señal: se prueba el micrófono directo (eso también pide el permiso)
    // y se reintenta el dictado una vez. Si sigue sin responder, se muestra un diagnóstico para enviar.
    const perro = setTimeout(async () => {
      if (rec !== r || eventos) return;
      fallo = true; try { r.abort(); } catch (e) {}
      rec = null; btn.classList.remove("rec"); const sp = $("span", btn); if (sp) sp.textContent = "Hablar"; recBtn = null;
      const d = await diagnosticoMic();
      if (d.mic === "ok" && !btn.dataset.reintento) {
        btn.dataset.reintento = "1"; nota("Micrófono habilitado. Reintentando el dictado…");
        setTimeout(() => toggleMic(btn), 300); return;
      }
      delete btn.dataset.reintento;
      nota((ES_WEBVIEW ? "El dictado no responde dentro de esta app instalada. " + ABRIR_EN_CHROME
        : d.mic === "ok" ? "El micrófono anda pero el servicio de voz de Google no responde. Probá abrir la misma dirección en una pestaña común de Chrome (no desde el ícono) y, si ahí anda, borrá el ícono y volvé a agregarlo desde Chrome › ⋮ › Agregar a pantalla principal."
        : "El micrófono no está disponible para esta página. En Chrome: candado 🔒 › Permisos › Micrófono › Permitir.") +
        "  [Diag: " + d.texto + "]", true);
    }, 7000);
    try { r.start(); }
    catch (e) { clearTimeout(perro); return nota("No se pudo iniciar el dictado (" + (e && e.message || e) + "). Volvé a tocar 🎤.", true); }
    rec = r; recBtn = btn; btn.classList.add("rec"); const sp = $("span", btn); if (sp) sp.textContent = "Escuchando… tocá para parar";
    // Si el permiso ya figura como denegado, se avisa enseguida.
    try { navigator.permissions && navigator.permissions.query({ name: "microphone" }).then((p) => { if (p.state === "denied" && rec === r) nota("El micrófono está bloqueado para esta página. En Chrome: candado 🔒 › Permisos › Micrófono › Permitir.", true); }).catch(() => {}); } catch (e) {}
  }

  /* ---------------- selector de personal y corrector móvil ---------------- */
  // "Apellido Nombre" y "Nombre Apellido" son la misma persona: se compara por conjunto de palabras.
  const claveNombre = (n) => norm(n).split(/[^a-zñ]+/).filter(Boolean).sort().join(" ");
  function emailDeUsuarios(nombre) {
    const k = claveNombre(nombre);
    const u = S.usuarios.find((x) => x && x.nombre && claveNombre(x.nombre) === k);
    return u ? (u.email || "") : "";
  }
  // De / Para / Con copia: salen de la pestaña quienRetira (si falla, de Usuarios para no dejar el formulario vacío).
  function personasDe() {
    const base = S.quienesRetiran.length ? S.quienesRetiran : S.usuarios;
    const vistos = new Set(), out = [];
    base.forEach((p) => {
      if (!p || !p.nombre) return;
      const k = norm(p.nombre) + "|" + (p.legajo || "");
      if (vistos.has(k)) return; vistos.add(k);
      out.push({ nombre: p.nombre, email: p.email || emailDeUsuarios(p.nombre), empresa: p.empresa || "", legajo: p.legajo || "" });
    });
    return out;
  }

  function pintarLista(input, box, opciones, elegir, consulta, detalle) {
    if (!input || !box) return;
    const q = norm(consulta || "");
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = opciones.filter(p => tokens.every(t => norm(p.nombre).includes(t))).slice(0, 10);
    box.innerHTML = matches.length ? matches.map((p,i) =>
      '<button type="button" role="option" aria-selected="false" class="suggestion" data-index="' + i + '"><strong>' + esc(p.nombre) + '</strong>' +
      ([p.legajo ? "Legajo: " + p.legajo : "", p.empresa ? "Empresa: " + p.empresa : ""].filter(Boolean).length
        ? '<small>' + esc([p.legajo ? "Legajo: " + p.legajo : "", p.empresa ? "Empresa: " + p.empresa : ""].filter(Boolean).join(" · ")) + '</small>' : '') + '</button>').join("")
      : '<div class="suggestion-empty">No hay coincidencias. Seguí escribiendo.</div>';
    box.hidden = false;
    const select = (e) => {
      const b = e.target.closest(".suggestion[data-index]");
      if (!b || !box.contains(b)) return;
      e.preventDefault(); e.stopPropagation();
      const p = matches[Number(b.dataset.index)];
      if (!p) return;
      elegir(p); box.hidden = true; box.innerHTML = "";
      if (detalle) detalle.textContent = "Seleccionado: " + p.nombre;
    };
    box.onpointerdown = select; box.onclick = select;
  }

  function mostrarSugerenciasDe() {
    const input = $("#de"), box = $("#sugerenciasDe"), detalle = $("#detalleDe");
    const q = input.value;
    const personas = personasDe();
    const exact = personas.find(p => norm(p.nombre) === norm(q));
    if (exact) { box.hidden = true; box.innerHTML = ""; detalle.textContent = "Seleccionado: " + exact.nombre; return; }
    pintarLista(input, box, personas, p => {
      input.value = p.nombre;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      renderChips("cc");
    }, q, detalle);
  }

  function mostrarSugerenciasObjetivo() {
    const input = $("#objetivo"), box = $("#sugerenciasObjetivo");
    const opciones = S.objetivos.map(o => typeof o === "string" ? {nombre:o} : o).filter(o => o && o.nombre);
    pintarLista(input, box, opciones, p => { input.value = p.nombre; input.dispatchEvent(new Event("change", {bubbles:true})); }, input.value);
  }

  function mostrarSugerenciasDestinatario(kind) {
    const input = $(kind === "para" ? "#inPara" : "#inCc");
    const box = $(kind === "para" ? "#sugerenciasPara" : "#sugerenciasCc");
    pintarLista(input, box, directorio(), p => {
      input.value = p.nombre;
      addChip(kind, input);
    }, input.value);
  }
  /* ---------- personal mencionado en el texto ---------- */
  const tokensNombre = (p) => norm(p.nombre).split(/[^a-zñ]+/).filter(Boolean);
  const detallePersonal = (p) => [p.empresa ? "Empresa: " + p.empresa : "", p.legajo ? "Legajo: " + p.legajo : ""].filter(Boolean).join(" – ");
  // Así queda en el informe: "PEREZ DANIEL, legajo 20, empresa PPQ".
  const textoPersonal = (p) => p.nombre + (p.legajo ? ", legajo " + p.legajo : "") + (p.empresa ? ", empresa " + p.empresa : "");
  // Apellido = primera palabra del nombre (SGI guarda "APELLIDO NOMBRE"); "SAN MARTIN", "DEL VALLE", etc. también por la segunda.
  const PARTICULAS = new Set(["de", "del", "la", "las", "los", "san", "santa", "da", "di", "van", "von", "mc"]);
  function apellidos(p) {
    const t = tokensNombre(p); if (!t.length) return [];
    return PARTICULAS.has(t[0]) && t[1] ? [t[0] + " " + t[1], t[1]] : [t[0]];
  }
  const personalPorApellido = (q) => S.personal.filter((p) => apellidos(p).includes(q));
  // Para no confundir palabras comunes ("puerta", "campo") con apellidos: se pregunta solo si la palabra
  // empieza con mayúscula o viene después de "vigilador", "personal", "señor", "agente", etc.
  const ANTES_DE_NOMBRE = /(vigilador|vigiladora|vigiladores|personal|señor|señora|sr|sra|agente|guardia|compañero|compañera|empleado|empleada|supervisor|supervisora|encargado|encargada|operador|operadora)\.?\s+$/i;
  const pareceNombre = (texto, ini) => /^\p{Lu}/u.test(texto.slice(ini)) || ANTES_DE_NOMBRE.test(texto.slice(Math.max(0, ini - 25), ini));

  function cajaPersonal(campo) {
    let box = document.getElementById("sug-" + campo.id);
    if (!box) {
      box = document.createElement("div"); box.id = "sug-" + campo.id; box.className = "suggestions suggestions-personal"; box.hidden = true; box.setAttribute("role", "listbox");
      const ref = campo.closest(".hl-wrap") || campo; ref.parentNode.insertBefore(box, ref.nextSibling);
    }
    return box;
  }
  function ocultarPersonal(campo) { const b = cajaPersonal(campo); b.hidden = true; b.innerHTML = ""; b.dataset.clave = ""; }

  // Busca en todo el texto el primer apellido del personal que todavía no tiene legajo
  // (lo ya elegido queda "APELLIDO NOMBRE, legajo N, ..." en mayúsculas y no se vuelve a preguntar).
  const ignoradosPorCampo = {};
  function mencionPendiente(v, ignorados) {
    const re = /[\p{L}'’]{3,}/gu; let m;
    while ((m = re.exec(v))) {
      const w = m[0], q = norm(w), ini = m.index, fin = ini + w.length;
      if (ignorados && ignorados.has(ini + "|" + q)) continue;
      if (!pareceNombre(v, ini)) continue;
      if (/^[\p{Lu}'’.\s-]{0,60},\s*legajo\s/u.test(v.slice(ini))) continue;
      let cand = personalPorApellido(q), ini2 = ini;
      const prev = v.slice(0, ini).match(/([\p{L}]+)\s+$/u);          // "San Martin", "Del Valle"
      if (prev && PARTICULAS.has(norm(prev[1]))) { const c2 = personalPorApellido(norm(prev[1]) + " " + q); if (c2.length) { cand = c2; ini2 = ini - prev[0].length; } }
      if (cand.length) return { ini: ini2, fin, palabra: v.slice(ini2, fin), cand, clave: ini + "|" + q };
    }
    return null;
  }
  // Muestra debajo del campo la lista de personas para la mención encontrada.
  function ofrecerPersonal(campo, h) {
    const box = cajaPersonal(campo);
    box.innerHTML = '<div class="sug-head"><span>👤 ¿Qué ' + esc(h.palabra.toUpperCase()) + ' es? Tocá a la persona</span><button type="button" data-no="1">Ninguno</button></div>' +
      h.cand.slice(0, 40).map((p, i) => '<button type="button" role="option" class="suggestion" data-i="' + i + '"><strong>' + esc(p.nombre) + '</strong>' + (detallePersonal(p) ? "<small>" + esc(detallePersonal(p)) + "</small>" : "") + "</button>").join("");
    box.hidden = false;
    try { box.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
    const elegir = (e) => {
      const b = e.target.closest("button"); if (!b || !box.contains(b)) return;
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.no) { (ignoradosPorCampo[campo.id] = ignoradosPorCampo[campo.id] || new Set()).add(h.clave); ocultarPersonal(campo); return sugerirPersonal(campo); }
      const p = h.cand[+b.dataset.i]; if (!p) return;
      const t = textoPersonal(p), v = campo.value, cur = campo.selectionStart == null ? v.length : campo.selectionStart;
      campo.value = v.slice(0, h.ini) + t + v.slice(h.fin);
      const pos = cur >= h.fin ? cur + (t.length - (h.fin - h.ini)) : h.ini + t.length;
      ocultarPersonal(campo); campo.dispatchEvent(new Event("input", { bubbles: true }));
      try { campo.setSelectionRange(pos, pos); } catch (e2) {}
      sugerirPersonal(campo);                                   // si hay otro apellido pendiente, lo ofrece
    };
    // pointerdown: elige antes de que el teclado se cierre y mueva la pantalla
    box.onpointerdown = elegir; box.onclick = (e) => e.preventDefault();
  }
  // Mientras se escribe o se dicta (con el 🎤 del teclado o el de la app): revisa todo el texto,
  // así la lista aparece aunque después de "Pérez" se siga escribiendo.
  function sugerirPersonal(campo) {
    if (!S.personal.length) return ocultarPersonal(campo);
    const h = mencionPendiente(campo.value, ignoradosPorCampo[campo.id]);
    if (!h) return ocultarPersonal(campo);
    const box = cajaPersonal(campo);
    if (!box.hidden && box.dataset.clave === h.clave) return;   // ya está mostrada
    box.dataset.clave = h.clave;
    ofrecerPersonal(campo, h);
  }
  function personalEnDictado(campo) { sugerirPersonal(campo); }
  // Botón "Personal": búsqueda manual con lista (sin teclado complicado).
  function buscarPersonal(id) {
    const campo = $("#" + id); if (!campo) return;
    openModal('<h2 style="margin:0 0 4px;color:var(--green-d)">👤 Buscar personal</h2><p class="hint">Escribí el apellido o el nombre y tocá a la persona para agregarla al texto.</p><input id="bpIn" placeholder="Ej: Martínez" autocomplete="off" autocapitalize="words"><div id="bpList" class="suggestions" style="border:0;box-shadow:none;max-height:50vh"></div>');
    const inp = $("#bpIn"), list = $("#bpList");
    const pintar = () => {
      const tk = norm(inp.value).split(/\s+/).filter(Boolean);
      const r = tk.length ? S.personal.filter((p) => tk.every((t) => norm(p.nombre).includes(t))).slice(0, 30) : [];
      list.innerHTML = r.length ? r.map((p, i) => '<button type="button" class="suggestion" data-i="' + i + '"><strong>' + esc(p.nombre) + "</strong>" + (detallePersonal(p) ? "<small>" + esc(detallePersonal(p)) + "</small>" : "") + "</button>").join("") : (tk.length ? '<div class="suggestion-empty">No hay coincidencias.</div>' : "");
      list.onclick = (e) => {
        const b = e.target.closest(".suggestion[data-i]"); if (!b) return; const p = r[+b.dataset.i]; if (!p) return;
        const t = textoPersonal(p), pos = campo.selectionStart == null ? campo.value.length : campo.selectionStart;
        campo.value = campo.value.slice(0, pos) + (pos && !/\s$/.test(campo.value.slice(0, pos)) ? " " : "") + t + campo.value.slice(pos);
        closeModal(); campo.focus(); campo.dispatchEvent(new Event("input", { bubbles: true }));
      };
    };
    inp.addEventListener("input", pintar); inp.focus();
  }

  // Corrector: antes de revisar la ortografía, por cada apellido del personal que aparece en el texto
  // (y que todavía no tiene legajo) pregunta qué persona es y lo reemplaza por "APELLIDO NOMBRE, legajo N, empresa X".
  function elegirPersonalDelTexto(id, despues) {
    const campo = $("#" + id); if (!campo || !S.personal.length) return despues();
    ocultarPersonal(campo);
    const ignorados = new Set(ignoradosPorCampo[id] || []);
    const siguiente = () => {
      const hallado = mencionPendiente(campo.value, ignorados);
      if (!hallado) { closeModal(); return despues(); }
      const h = hallado;
      openModal('<h2 style="margin:0 0 4px;color:var(--green-d)">👤 ¿Qué ' + esc(h.palabra.toUpperCase()) + ' es?</h2>' +
        '<p class="hint">Tocá a la persona. En el informe queda con legajo y empresa.</p>' +
        '<div class="suggestions" style="position:static;border:0;box-shadow:none;max-height:55vh">' +
        h.cand.slice(0, 40).map((p, i) => '<button type="button" class="suggestion" data-i="' + i + '"><strong>' + esc(p.nombre) + '</strong><small>' + esc(detallePersonal(p)) + '</small></button>').join("") +
        '</div><div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn ghost" id="epNo">No es del personal</button><button type="button" class="btn ghost" id="epFin">Seguir con la ortografía</button></div>');
      $$("#modalBody .suggestion[data-i]").forEach((b) => (b.onclick = () => {
        const p = h.cand[+b.dataset.i], t = textoPersonal(p), val = campo.value;
        campo.value = val.slice(0, h.ini) + t + val.slice(h.fin);
        campo.dispatchEvent(new Event("input", { bubbles: true }));
        siguiente();
      }));
      $("#epNo").onclick = () => { ignorados.add(h.clave); siguiente(); };
      $("#epFin").onclick = () => { closeModal(); despues(); };
    };
    siguiente();
  }

  /* ---------------- destinatarios (chips) ---------------- */
  function directorio() { return personasDe(); }
  function buscarPersona(nombre) { const n = norm(nombre); return directorio().find((p) => norm(p.nombre) === n); }

  function renderChips(kind) {
    const arr = S[kind], box = $(kind === "para" ? "#chipsPara" : "#chipsCc");
    if (!box) { console.error("Falta el contenedor de destinatarios:", kind); return; }
    let html = "";
    if (kind === "cc") {
      const a = autor();
      if (a) html += `<span class="chip lock">${esc(a.nombre)} <em>autor</em></span>`;
    }
    arr.forEach((p, i) => {
      html += `<span class="chip">${esc(p.nombre)}${p.email ? "" : " <em>sin correo</em>"}<button type="button" data-k="${kind}" data-i="${i}" aria-label="Quitar">✕</button></span>`;
    });
    if (!box) { console.error("Falta el contenedor de chips:", kind); return; }
    box.innerHTML = html;
    $$("button", box).forEach((b) => (b.onclick = () => { S[b.dataset.k].splice(+b.dataset.i, 1); renderChips(b.dataset.k); }));
  }
  function addChip(kind, input) {
    let nombre = input.value.replace(/\s+/g, " ").trim();
    if (!nombre) return;
    const max = kind === "para" ? CFG.MAX_PARA : CFG.MAX_CC;
    if (S[kind].length >= max) return toast("Máximo " + max + " personas", true);
    // Clientes u otras personas: se puede escribir "Nombre <correo>" o solo el correo.
    let escrito = "";
    const mm = nombre.match(/^(.*?)\s*<([^>]+)>$/);
    if (mm && okMail(mm[2])) { nombre = mm[1] || mm[2]; escrito = mm[2]; } else if (okMail(nombre)) escrito = nombre;
    if (S[kind].some((p) => norm(p.nombre) === norm(nombre))) { input.value = ""; return; }
    const f = buscarPersona(nombre);
    // Si no está en la lista se agrega igual (cliente): el correo se pide al enviar.
    S[kind].push({ nombre: f ? f.nombre : nombre, email: escrito || (f ? f.email : "") });
    input.value = ""; renderChips(kind);
    const box = $(kind === "para" ? "#sugerenciasPara" : "#sugerenciasCc"); if (box) { box.hidden = true; box.innerHTML = ""; }
  }
  function autor() { const v = norm($("#de").value); if (!v) return null; const q = personasDe().find(p => norm(p.nombre) === v); if (!q) return null; return { nombre: q.nombre, email: q.email || "" }; }

  /* ---------------- fotos ---------------- */
  let slotActivo = null;
  function renderFotos() {
    const box = $("#fotos"); if (!box) { console.error("Falta #fotos en index.html"); return; } box.innerHTML = "";
    S.fotos.forEach((f, i) => {
      const d = document.createElement("div");
      d.className = "slot" + (f ? " full" : "");
      d.innerHTML = f
        ? `<img src="${f.data}" alt="Foto ${i + 1}"><span class="n">Foto ${i + 1}</span><button type="button" class="del" aria-label="Quitar foto">✕</button>`
        : `<span class="plus">＋</span><span>Foto ${i + 1}</span><span style="font-weight:500;font-size:11.5px">📷 sacar / 🖼 elegir</span>`;
      d.onclick = (e) => {
        if (e.target.classList.contains("del")) { S.fotos[i] = null; renderFotos(); return; }
        slotActivo = i;
        openModal('<h2 style="margin:0 0 8px">Agregar fotografía</h2><p class="hint">Elegí cómo querés agregar la imagen.</p><div class="actions" style="flex-direction:column"><button type="button" class="btn send" id="fotoCamara">📷 Sacar foto con la cámara</button><button type="button" class="btn" id="fotoGaleria">🖼 Elegir de galería o archivos</button><button type="button" class="btn ghost" id="fotoCancelar">Cancelar</button></div>');
        $("#fotoCamara").onclick = () => { closeModal(); const fi = $("#cameraInput"); fi.value = ""; fi.click(); };
        $("#fotoGaleria").onclick = () => { closeModal(); const fi = $("#fileInput"); fi.value = ""; fi.multiple = false; fi.click(); };
        $("#fotoCancelar").onclick = () => { slotActivo = null; closeModal(); };
      };
      box.appendChild(d);
    });
    const n = S.fotos.filter(Boolean).length;
    $("#fotoCount").textContent = n + (n === 1 ? " foto" : " fotos");
  }
  function comprimir(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        let w = im.naturalWidth, h = im.naturalHeight, r = Math.min(1, CFG.FOTO_MAX_PX / Math.max(w, h));
        w = Math.round(w * r); h = Math.round(h * r);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url); res({ data: c.toDataURL("image/jpeg", CFG.FOTO_CALIDAD), w, h });
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); };
      im.src = url;
    });
  }
  async function onFiles(files) {
    files = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    overlay("Preparando fotos…");
    try {
      for (let k = 0; k < files.length; k++) {
        const ph = await comprimir(files[k]);
        let idx = k === 0 && slotActivo != null ? slotActivo : S.fotos.findIndex((x) => !x);
        if (idx < 0) { S.fotos.push(null, null, null, null); idx = S.fotos.findIndex((x) => !x); }
        S.fotos[idx] = ph; slotActivo = null;
      }
      renderFotos();
    } catch (e) { toast(e.message, true); }
    overlay();
  }

  /* ---------------- formulario ---------------- */
  function leerForm() {
    const a = autor();
    return {
      fecha: isoToAr($("#fecha").value), de: a ? a.nombre : "", asunto: $("#asunto").value.trim(), objetivo: $("#objetivo").value.trim(),
      informe: $("#informe").value.trim(), medidas: $("#medidas").value.trim()
    };
  }
  function validar(d) {
    if (!d.de) return "Elegí quién redacta el informe (De)";
    if (!personasDe().some(p => norm(p.nombre) === norm(d.de))) return "Elegí un nombre de la lista en el campo De";
    if (!S.para.length) return "Agregá al menos una persona en «Para»";
    if (!d.asunto) return "Falta el asunto";
    if (!d.objetivo) return "Falta el objetivo / servicio";
    if (!d.informe) return "Falta contar la novedad";
    return "";
  }

  // Pide los correos que faltan (uno por persona)
  function pedirCorreos(faltan) {
    return new Promise((resolve) => {
      openModal(`<h2 style="margin:0 0 4px;color:var(--orange)">Faltan correos</h2>
        <p class="hint">Para enviar el informe necesito el correo de:</p>
        ${faltan.map((p, i) => `<div class="row-in"><label for="pc${i}">${esc(p.nombre)}</label><input id="pc${i}" type="email" inputmode="email" placeholder="correo@ejemplo.com"></div>`).join("")}
        <div class="actions"><button class="btn send" id="pcOk">Enviar informe</button><button class="btn ghost" id="pcNo">Cancelar</button></div>`);
      $("#pcOk").onclick = () => {
        for (let i = 0; i < faltan.length; i++) {
          const v = $("#pc" + i).value.trim();
          if (!okMail(v)) { $("#pc" + i).focus(); return toast("Correo inválido para " + faltan[i].nombre, true); }
        }
        faltan.forEach((p, i) => (p.email = $("#pc" + i).value.trim()));
        closeModal(); resolve(true);
      };
      $("#pcNo").onclick = () => { closeModal(); resolve(false); };
    });
  }

  async function buildPdfFrom(d, fotos) {
    return window.buildInformePdf({
      numero: d.numero, fecha: d.fecha, de: d.de, para: String(d.para || "").split(/;\s*/).filter(Boolean),
      asunto: d.asunto, objetivo: d.objetivo, informe: d.informe, medidas: d.medidas, fotos
    }, { logoUrl: CFG.LOGO_PDF });
  }

  async function enviar() {
    stopRec();
    const d = leerForm(), err = validar(d);
    if (err) return toast(err, true);
    const au = autor();
    if ((await Corrector.revisarTodo()) > 0) {
      if (confirm("Hay " + Corrector.pendientes() + " posibles errores de ortografía.\n\nAceptar = revisarlos ahora\nCancelar = enviar así")) { Corrector.abrir(Corrector.primerCampoConErrores()); return; }
    }
    const faltan = [au].concat(S.para, S.cc).filter((p) => p && !okMail(p.email));
    if (faltan.length && !(await pedirCorreos(faltan))) return;

    try {
      overlay("Asignando número…");
      const rs = await api("reservar", { data: Object.assign({}, d, { para: S.para.map((p) => p.nombre) }) });
      overlay("Armando el PDF…");
      const pdf = await window.buildInformePdf({
        numero: rs.numero, fecha: d.fecha, de: d.de, para: S.para.map((p) => p.nombre),
        asunto: d.asunto, objetivo: d.objetivo, informe: d.informe, medidas: d.medidas, fotos: S.fotos.filter(Boolean)
      }, { logoUrl: CFG.LOGO_PDF });
      overlay("Guardando y enviando por correo…");
      const to = [au.email].concat(S.para.map((p) => p.email)).filter(Boolean).filter((email, i, all) => all.indexOf(email) === i);
      const cc = S.cc.map((p) => p.email).filter(Boolean).filter((email, i, all) => all.indexOf(email) === i && to.indexOf(email) < 0);
      const fin = await api("finalizar", { id: rs.id, pdfBase64: pdf.base64, to, cc });
      overlay();
      mostrarExito(fin, pdf, to, cc);
    } catch (e) {
      overlay(); console.error(e);
      toast("No se pudo enviar: " + e.message, true);
    }
  }

  function descargarBlob(blob, nombre) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function mostrarExito(fin, pdf, to, cc) {
    openModal(`<div class="ok-big"><div class="tick">✓</div><h2>¡Informe N° ${esc(fin.numero)} enviado!</h2>
      <p class="hint">Se guardó en la carpeta de informes y se envió en PDF.</p></div>
      <p style="font-size:14px"><b>Para:</b> ${esc(to.join(", "))}<br><b>Copia:</b> ${esc(cc.filter(Boolean).join(", "))}</p>
      <div class="modal-actions"><button class="btn dl" id="okDl">⬇ Descargar PDF</button>
      ${DEMO ? "" : `<a class="btn" style="text-decoration:none;text-align:center" href="${esc(fin.url)}" target="_blank" rel="noopener">📁 Ver en Drive</a>`}
      <button class="btn send" id="okNuevo" style="flex:none">＋ Nuevo informe</button></div>`);
    $("#okDl").onclick = () => descargarBlob(pdf.blob, "Informe_de_Novedades_" + fin.numero + ".pdf");
    $("#okNuevo").onclick = () => { closeModal(); limpiar(true); };
  }

  function limpiar(silencioso) {
    if (!silencioso && !confirm("¿Borrar todo lo cargado?")) return;
    stopRec();
    ["asunto", "objetivo", "informe", "medidas", "inPara", "inCc"].forEach((i) => ($("#" + i).value = ""));
    $("#de").value = ""; S.para = []; S.cc = []; S.fotos = [null, null, null, null];
    $("#fecha").value = hoyISO(); renderChips("para"); renderChips("cc"); renderFotos(); cargarNumero();
    ["informe", "medidas"].forEach((id) => { Corrector.refrescar(id); ocultarPersonal($("#" + id)); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Aviso fijo arriba del formulario (no se va solo como el cartel rojo).
  function avisoCarga(clave, tipo, msg) {
    let box = $("#avisoCarga");
    if (!box) {
      box = document.createElement("div"); box.id = "avisoCarga";
      const ref = $(".paper-head"); if (ref && ref.parentNode) ref.parentNode.insertBefore(box, ref.nextSibling); else document.body.prepend(box);
    }
    avisos[clave] = msg ? { tipo, msg } : null;
    const lista = Object.keys(avisos).filter((k) => avisos[k]);
    box.hidden = !lista.length;
    box.innerHTML = lista.map((k) => '<div class="aviso-carga ' + avisos[k].tipo + '"><span>' + esc(avisos[k].msg) + '</span>' +
      (avisos[k].tipo === "error" ? '<button type="button" class="btn small" data-reintentar="' + k + '">↻ Reintentar</button>' : '') + '</div>').join("");
    $$("button[data-reintentar]", box).forEach((b) => (b.onclick = () => { if (b.dataset.reintentar === "numero") cargarNumero(); else { listasPromise = null; cargarListasUI(); } }));
  }
  const avisos = {};

  // N° de informe: pedido aparte, no frena a los listados (el número definitivo se asigna al enviar igual).
  async function cargarNumero() {
    const el = $("#numInforme"); el.textContent = "····";
    try {
      const r = await api("numero");
      if (!r.siguiente) throw new Error("sin número");                   // Apps Script viejo: lo toma de las listas
      el.textContent = r.siguiente; avisoCarga("numero");
    } catch (e) {
      try { const l = await api("listas"); if (l.siguiente) { el.textContent = l.siguiente; avisoCarga("numero"); return; } } catch (e2) {}
      el.textContent = "—";
      avisoCarga("numero", "error", "No se pudo traer el N° de informe (" + e.message + "). Igual podés cargar el informe: el número se asigna al enviar.");
    }
  }

  async function cargarListasUI() {
    avisoCarga("listas", "info", "Cargando listados (personal, objetivos, destinatarios)…");
    let r;
    try { r = await api("listas"); }
    catch (e) { avisoCarga("listas", "error", "No se pudieron cargar los listados: " + e.message); throw e; }
    S.usuarios = Array.isArray(r.usuarios) ? r.usuarios : [];
    S.quienesRetiran = Array.isArray(r.quienesRetiran || r.quienRetira) ? (r.quienesRetiran || r.quienRetira) : [];
    S.objetivos = Array.isArray(r.objetivos) ? r.objetivos : [];
    S.personal = Array.isArray(r.personal) ? r.personal : [];
    if (r.siguiente && /^[·—-]*$/.test($("#numInforme").textContent.trim())) { $("#numInforme").textContent = r.siguiente; avisoCarga("numero"); }
    try { Corrector.setConocidos(S.quienesRetiran.map((p) => p.nombre).concat(S.personal.map((p) => p.nombre), S.objetivos.map((o) => o.nombre))); } catch (e) { console.error(e); }
    const errs = Array.isArray(r.errores) ? r.errores : [];
    if (errs.length) avisoCarga("listas", "error", "Algunos listados no se pudieron leer: " + errs.join(" | "));
    else avisoCarga("listas");
    const listaObjetivos = $("#dl-objetivos");
    if (listaObjetivos) listaObjetivos.innerHTML = S.objetivos.map((o) => `<option value="${esc(o.nombre)}">`).join("");
    const listaPersonas = $("#dl-personas");
    if (listaPersonas) listaPersonas.innerHTML = directorio().map((p) => `<option value="${esc(p.nombre)}">`).join("");
    renderChips("para"); renderChips("cc");
  }

  let initEnCurso = false, ultimoInit = 0;
  async function recargarAlVolver() {
    if (document.visibilityState !== "visible" || initEnCurso || Date.now() - ultimoInit < 12000) return;
    ultimoInit = Date.now(); initEnCurso = true; listasPromise = null;
    if (/^[·—-]*$/.test($("#numInforme").textContent.trim())) cargarNumero();
    try { await cargarListasUI(); } catch (e) {}
    finally { initEnCurso = false; }
  }

  /* ---------------- buscador ---------------- */
  const COLORES = ["var(--green)", "var(--blue)", "var(--orange)", "var(--violet)", "var(--red)", "var(--teal)"];
  let ultimos = [];
  async function buscar() {
    stopRec();
    const box = $("#resultados"); $("#resumen").textContent = "Buscando…"; box.innerHTML = "";
    try {
      const r = await api("buscar", { q: $("#q").value, desde: $("#desde").value, hasta: $("#hasta").value });
      ultimos = r.items;
      $("#resumen").textContent = r.items.length ? `${r.total} informe${r.total === 1 ? "" : "s"} encontrado${r.total === 1 ? "" : "s"}` : "";
      if (!r.items.length) { box.innerHTML = '<div class="empty">No se encontraron informes 🤷</div>'; return; }
      box.innerHTML = r.items.map((it, i) => `<div class="card" style="--c:${COLORES[i % COLORES.length]}">
        <div class="cn">N° ${esc(it.numero)}</div>
        <div><div class="ca">${esc(it.asunto)}</div><div class="cm">${esc(it.fecha)} · De: ${esc(it.de)} · Para: ${esc(it.para)} · ${esc(it.objetivo)}</div></div>
        <button class="btn" data-i="${i}">Ver</button></div>`).join("");
      $$("button[data-i]", box).forEach((b) => (b.onclick = () => verInforme(ultimos[+b.dataset.i])));
    } catch (e) { $("#resumen").textContent = ""; toast("Error al buscar: " + e.message, true); }
  }

  async function getPdfBlob(it) {
    if (S.pdfCache[it.id]) return S.pdfCache[it.id];
    const r = await api("pdf", { id: it.id });
    const bin = atob(r.base64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const o = { blob: new Blob([u], { type: "application/pdf" }), nombre: r.nombre, url: r.url };
    S.pdfCache[it.id] = o; return o;
  }

  function verInforme(it) {
    const logo = CFG.LOGO_PDF;
    openModal(`<h2 style="margin:0;color:var(--green-d)">Informe N° ${esc(it.numero)}</h2>
      <div class="sheet">
        <div class="sheet-h"><div><img src="${esc(logo)}" alt="KTL"></div><div><b>Gestión Operativa</b><b>Informe de Novedades</b><span>Control de Documentos y Registros</span></div><div><b>Código</b><span>Versión 00</span></div></div>
        <div class="sheet-b">
          <p><b>Fecha:</b> ${esc(it.fecha)}</p><p><b>De:</b> ${esc(it.de)}</p><p><b>Para:</b> ${esc(it.para)}</p>
          <p><b>Asunto:</b> ${esc(it.asunto)}</p><p><b>Objetivo:</b> ${esc(it.objetivo)}</p>
          <div class="sheet-t"><h4>Día, Hora, Lugar del hecho, quien, qué, cómo y por qué:</h4><div>${esc(it.informe)}</div></div>
          <div class="sheet-t"><h4>Medidas Tomadas:</h4><div>${esc(it.medidas)}</div></div>
        </div></div>
      <div class="modal-actions">
        <button class="btn mail" id="vMail">✉ Enviar por correo</button>
        <button class="btn wa" id="vWa">↗ Compartir</button>
        <button class="btn dl" id="vDl">⬇ Descargar</button>
      </div><div id="vPanel"></div>`);

    $("#vDl").onclick = async () => { try { overlay("Preparando PDF…"); const p = await getPdfBlob(it); overlay(); descargarBlob(p.blob, p.nombre); } catch (e) { overlay(); toast(e.message, true); } };

    $("#vWa").onclick = async () => {
      try {
        overlay("Preparando PDF…"); const p = await getPdfBlob(it); overlay();
        const file = new File([p.blob], p.nombre, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Informe de Novedades N° " + it.numero, text: "Informe de Novedades N° " + it.numero + " — " + it.asunto }); return; }
        const txt = "Informe de Novedades N° " + it.numero + " — " + it.asunto + (p.url && p.url !== "#" ? "\n" + p.url : "");
        window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
      } catch (e) { overlay(); if (e.name !== "AbortError") toast(e.message, true); }
    };

    $("#vMail").onclick = () => {
      const pn = $("#vPanel"); const dest = [];
      pn.innerHTML = `<div class="panel"><b>Enviar PDF por correo</b>
        <div class="chips" id="vChips" style="margin-top:8px"></div>
        <div class="chip-add"><input id="vIn" list="dl-personas" placeholder="Nombre o correo"><button class="btn small" id="vAdd">＋</button></div>
        <div id="vMailsNeed"></div>
        <div class="actions"><button class="btn send" id="vSend" style="flex:none">Enviar</button></div></div>`;
      const draw = () => { $("#vChips").innerHTML = dest.map((p, i) => `<span class="chip" style="--c:var(--orange)">${esc(p.nombre)}${p.email ? "" : " <em>sin correo</em>"}<button data-i="${i}">✕</button></span>`).join(""); $$("#vChips button").forEach((b) => (b.onclick = () => { dest.splice(+b.dataset.i, 1); draw(); })); };
      $("#vAdd").onclick = () => {
        const v = $("#vIn").value.trim(); if (!v) return;
        if (okMail(v)) dest.push({ nombre: v, email: v }); else { const f = buscarPersona(v); dest.push({ nombre: f ? f.nombre : v, email: f ? f.email : "" }); }
        $("#vIn").value = ""; draw();
      };
      $("#vSend").onclick = async () => {
        if ($("#vIn").value.trim()) $("#vAdd").click();
        if (!dest.length) return toast("Agregá al menos un destinatario", true);
        const faltan = dest.filter((p) => !okMail(p.email));
        if (faltan.length) {
          $("#vMailsNeed").innerHTML = faltan.map((p, i) => `<div class="row-in"><label>Correo de ${esc(p.nombre)}</label><input type="email" inputmode="email" data-f="${i}" placeholder="correo@ejemplo.com"></div>`).join("");
          const ins = $$("#vMailsNeed input");
          for (let i = 0; i < ins.length; i++) { if (!okMail(ins[i].value)) { ins[i].focus(); return toast("Indicá el correo de " + faltan[i].nombre, true); } faltan[i].email = ins[i].value.trim(); }
        }
        try { overlay("Enviando…"); await api("reenviar", { id: it.id, to: dest.map((p) => p.email), cc: [] }); overlay(); toast("Informe enviado ✔"); pn.innerHTML = ""; }
        catch (e) { overlay(); toast("No se pudo enviar: " + e.message, true); }
      };
    };
  }

  /* ---------------- arranque ---------------- */
  function cambiarTab(t) {
    $$(".tab").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    $("#vista-nuevo").classList.toggle("on", t === "nuevo"); $("#vista-buscar").classList.toggle("on", t === "buscar");
    if (t === "buscar" && !ultimos.length) buscar();
    window.scrollTo({ top: 0 });
  }

  async function init() {
    $("#logoApp").src = CFG.LOGO_APP;
    $("#logoApp").onload = () => { $("#logoApp").style.display = ""; $("#logoTxt").style.display = "none"; };
    if (!DEMO) api("logo").then((r) => { const im = $("#logoApp"); im.style.display = ""; $("#logoTxt").style.display = "none"; im.src = r.src; }).catch(() => {});
    if (DEMO) $("#demoBar").hidden = false;
    $("#fecha").value = hoyISO();
    $$(".tab").forEach((b) => (b.onclick = () => cambiarTab(b.dataset.tab)));
    $$(".mic").forEach((b) => (b.onclick = () => toggleMic(b)));
    $("#cerrarModal").onclick = closeModal; $("#modal").onclick = (e) => { if (e.target.id === "modal") closeModal(); };
    $("#addPara").onclick = () => addChip("para", $("#inPara")); $("#addCc").onclick = () => addChip("cc", $("#inCc"));
    $("#inPara").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChip("para", e.target); } });
    $("#inCc").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addChip("cc", e.target); } });
    $("#inPara").addEventListener("change", (e) => { if (buscarPersona(e.target.value) || okMail(e.target.value)) addChip("para", e.target); });
    $("#inCc").addEventListener("change", (e) => { if (buscarPersona(e.target.value) || okMail(e.target.value)) addChip("cc", e.target); });
    $("#de").addEventListener("input", mostrarSugerenciasDe);
    $("#objetivo").addEventListener("input", mostrarSugerenciasObjetivo);
    $("#objetivo").addEventListener("focus", mostrarSugerenciasObjetivo);
    $("#inPara").addEventListener("input", () => mostrarSugerenciasDestinatario("para"));
    $("#inCc").addEventListener("input", () => mostrarSugerenciasDestinatario("cc"));
    ["informe", "medidas"].forEach((id) => {
      const el = $("#" + id);
      el.addEventListener("input", () => { clearTimeout(el._tPers); el._tPers = setTimeout(() => sugerirPersonal(el), 350); });
      Corrector.attach(el, $('.spell-btn[data-target="' + id + '"]'));
    });
    $$(".pers-btn").forEach((b) => b.addEventListener("click", () => buscarPersonal(b.dataset.target)));
    $("#de").addEventListener("focus", mostrarSugerenciasDe);
    $("#de").addEventListener("change", () => { mostrarSugerenciasDe(); renderChips("cc"); });
    Corrector.init({ toast });
    $$(".spell-btn").forEach((b) => b.addEventListener("click", () => elegirPersonalDelTexto(b.dataset.target, () => Corrector.abrir(b.dataset.target))));
    $("#fileInput").onchange = (e) => { onFiles(e.target.files); e.target.value = ""; };
    $("#cameraInput").onchange = (e) => { onFiles(e.target.files); e.target.value = ""; };
    $("#masFotos").onclick = () => { S.fotos.push(null, null, null, null); renderFotos(); toast("Se agregaron 4 recuadros más"); };
    $("#enviar").onclick = enviar; $("#limpiar").onclick = () => limpiar(false);
    $("#btnBuscar").onclick = buscar; $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
    renderFotos(); renderChips("para"); renderChips("cc");

    cargarListasUI().then(() => { $("#sugerenciasDe").hidden = true; }).catch(() => {});   // el aviso fijo ya muestra el error
    cargarNumero();
    document.addEventListener("visibilitychange", recargarAlVolver);
    window.addEventListener("pageshow", recargarAlVolver);
    window.addEventListener("online", recargarAlVolver);
  }
  document.addEventListener("DOMContentLoaded", init);

  // para pruebas
  window.__app = { S, buildPdfFrom };
})();
