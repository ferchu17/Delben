/* ============================================================
   Informe de Novedades — lógica de la aplicación
   ============================================================ */
(function () {
  const CFG = window.APP_CONFIG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const DEMO = !CFG.API_URL;

  const S = { usuarios: [], quienesRetiran: [], objetivos: [], para: [], cc: [], fotos: [null, null, null, null], pdfCache: {} };

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
    // La carga inicial de listas usa GET: la API publica ya expone ?action=listas
    // y así evitamos que un POST cross-origin impida inicializar toda la pantalla.
    if (action === "listas") {
      if (!listasPromise || Date.now() - ultimoCargaListas > 60000) {
        ultimoCargaListas = Date.now();
        listasPromise = fetch(CFG.API_URL + "?action=listas", { method: "GET", cache: "no-store", redirect: "follow" })
          .then(async (response) => {
            const raw = await response.text();
            if (!response.ok) throw new Error("Apps Script respondió HTTP " + response.status + ". " + String(raw || "").replace(/\\s+/g, " ").slice(0, 180));
            let data;
            try { data = JSON.parse(raw); } catch (_) { throw new Error("El backend no devolvió JSON válido (HTTP " + response.status + ")."); }
            if (!data.ok) throw new Error(data.error || "Error del servidor");
            return data;
          }).catch((err) => { listasPromise = null; throw err; });
      }
      return listasPromise;
    }
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

  async function demo(action, p) {
    await new Promise((r) => setTimeout(r, 350));
    const pad = (n) => String(n).padStart(4, "0");
    if (action === "listas") return { ok: true, usuarios: DEMO_DB.users, quienRetira: DEMO_DB.personal, objetivos: DEMO_DB.objetivos, siguiente: pad(DEMO_DB.next), errores: [] };
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
    micApagar(); $$(".mic-state").forEach((s) => (s.textContent = ""));
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
  async function toggleMic(btn) {
    if (recBtn === btn) return stopRec();
    stopRec();
    const target = document.getElementById(btn.dataset.target), state = $(`.mic-state[data-for="${btn.dataset.target}"]`);
    const nota = (m) => { if (state) state.textContent = m; };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.isSecureContext) { toast("El dictado requiere una conexión segura HTTPS.", true); nota("Abrí la aplicación desde su dirección HTTPS."); return; }
    if (!SR) { toast("Este navegador o la app no admite dictado integrado. Usá el micrófono 🎤 del teclado para dictar en el campo.", true); nota("Sin dictado integrado: tocá el campo y usá el 🎤 del teclado del celular."); return; }

    // 1) Pedir permiso de micrófono de forma explícita (en apps instaladas es lo que dispara el permiso de Android).
    btn.classList.add("rec"); nota("Pidiendo acceso al micrófono…");
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // En apps instaladas el pedido de permiso puede quedar colgado: se espera 3 s y se sigue igual.
        const pedido = navigator.mediaDevices.getUserMedia({ audio: true });
        const colgado = Symbol("colgado");
        const st = await Promise.race([pedido, new Promise((r) => setTimeout(() => r(colgado), 3000))]);
        if (st === colgado) { pedido.then((x) => x.getTracks().forEach((t) => t.stop())).catch(() => {}); nota("El permiso no responde en esta app; probando el dictado igual…"); }
        else { st.getTracks().forEach((t) => t.stop()); await new Promise((r) => setTimeout(r, 250)); }
      }
      catch (e) {
        btn.classList.remove("rec");
        const m = (e && e.name === "NotFoundError") ? "No se encontró un micrófono." : "Esta pantalla no tiene permiso para usar el micrófono. Habilitalo en Ajustes › Aplicaciones › (esta app o Chrome) › Permisos › Micrófono. Mientras tanto usá el 🎤 del teclado.";
        nota(m); toast(m, true); return;
      }
    }

    // 2) Reconocimiento por frases; se reinicia solo hasta que toques de nuevo.
    const idiomas = ["es-AR", "es-419", "es-ES"]; let li = 0, vacios = 0, frases = 0, ultimo = "iniciando", fatal = false;
    let base = target.value;
    const r = new SR(); r.lang = idiomas[li]; r.continuous = false; r.interimResults = true; r.maxAlternatives = 1;
    let eventos = 0;
    const perro = setTimeout(() => { if (rec === r && eventos === 0) { fatal = true; try { r.abort(); } catch (e) {} micApagar(); try { target.focus(); } catch (e) {} nota("El dictado integrado no responde en esta app (no llegó ningún evento). Ya te dejé el cursor en el campo: tocá el 🎤 del teclado del celular."); toast("El dictado integrado no responde en esta app. Usá el 🎤 del teclado.", true); } }, 8000);
    const diag = () => { nota("🔴 Escuchando (" + r.lang + ")… frases: " + frases + " · " + ultimo); };
    r.onaudiostart = () => { eventos++; ultimo = "micrófono activo"; diag(); };
    r.onspeechstart = () => { eventos++; vacios = 0; ultimo = "te oigo"; diag(); };
    r.onstart = () => { eventos++; };
    r.onnomatch = () => { eventos++; ultimo = "no entendí, repetí"; diag(); };
    r.onresult = (ev) => {
      eventos++;
      let fin = "", parcial = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) fin += t; else parcial += t; }
      vacios = 0;
      if (fin.trim()) { base = unirTexto(base, comandosVoz(fin.trim())); target.value = base; frases++; ultimo = "texto recibido"; }
      else { target.value = unirTexto(base, parcial); ultimo = "escribiendo…"; }
      try { target.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { console.error(e); }
      if (target.tagName === "TEXTAREA") target.scrollTop = target.scrollHeight;
      if (fin.trim() && (target.id === "informe" || target.id === "medidas")) { try { personalEnDictado(target, fin); } catch (e) { console.error(e); } }
      diag();
    };
    r.onerror = (e) => {
      eventos++;
      const messages = {
        "not-allowed": "Permiso de micrófono denegado. Habilitalo en Ajustes › Aplicaciones › Permisos › Micrófono.",
        "service-not-allowed": "El servicio de reconocimiento de voz está bloqueado o desactivado en este celular (revisá Ajustes › Aplicaciones › Google › Permisos). Usá el 🎤 del teclado.",
        "audio-capture": "No se encontró un micrófono disponible.",
        "network": "El dictado no pudo conectar con el servicio de voz. Revisá la conexión o usá el 🎤 del teclado.",
        "language-not-supported": "Este celular no admite dictado en ese idioma."
      };
      if (e.error === "no-speech" || e.error === "aborted") { ultimo = e.error === "no-speech" ? "no se oyó voz" : "reiniciando"; vacios++; return; }
      if (e.error === "language-not-supported" && li < idiomas.length - 1) { li++; r.lang = idiomas[li]; return; }
      fatal = true; nota(messages[e.error] || ("Error de micrófono: " + e.error)); toast(messages[e.error] || ("Error de micrófono: " + e.error), true);
    };
    r.onend = () => {
      eventos++; clearTimeout(perro);
      if (rec !== r) return;
      if (!fatal) {
        if (vacios >= 3 && li < idiomas.length - 1 && frases === 0) { li++; r.lang = idiomas[li]; vacios = 0; }       // otra variante de español
        if (vacios >= 6 && frases === 0) { fatal = true; nota("No llegó ningún texto. El dictado integrado no responde en este celular o app: tocá el campo y usá el 🎤 del teclado."); }
        else { diag(); setTimeout(() => { if (rec !== r) return; try { r.start(); } catch (e) { micApagar(); } }, 250); return; }
      }
      const msg = state ? state.textContent : "";
      micApagar(); nota(fatal ? msg : "Dictado finalizado.");
    };
    // si escribís con el teclado mientras dictás, se conserva lo escrito
    const fn = (ev) => { if (ev.isTrusted) base = target.value; };
    target.addEventListener("input", fn); recInput = { el: target, fn };
    try { r.start(); } catch (e) { toast("No se pudo iniciar el dictado. Volvé a tocar el micrófono.", true); recInput = null; target.removeEventListener("input", fn); btn.classList.remove("rec"); return; }
    rec = r; recBtn = btn; btn.classList.add("rec"); const sp = $("span", btn); if (sp) sp.textContent = "Escuchando… tocá para parar";
    diag();
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
  const textoPersonal = (p) => p.nombre + (detallePersonal(p) ? " (" + detallePersonal(p) + ")" : "");

  function cajaPersonal(campo) {
    let box = document.getElementById("sug-" + campo.id);
    if (!box) {
      box = document.createElement("div"); box.id = "sug-" + campo.id; box.className = "suggestions suggestions-personal"; box.hidden = true; box.setAttribute("role", "listbox");
      const ref = campo.closest(".hl-wrap") || campo; ref.parentNode.insertBefore(box, ref.nextSibling);
    }
    return box;
  }
  function ocultarPersonal(campo) { const b = cajaPersonal(campo); b.hidden = true; b.innerHTML = ""; }

  // Muestra al personal que coincide con la palabra [ini, fin) del campo.
  function ofrecerPersonal(campo, ini, fin) {
    const box = cajaPersonal(campo), pers = S.quienesRetiran;
    const palabra = campo.value.slice(ini, fin), q = norm(palabra);
    if (!pers.length || q.length < 3) return ocultarPersonal(campo);
    const cap = /^\p{Lu}/u.test(palabra);
    // Palabra completa igual a un apellido/nombre (4+ letras) o, si empieza con mayúscula, prefijo.
    const coinc = pers.filter((p) => tokensNombre(p).some((t) => (q.length >= 4 && t === q) || (cap && t.startsWith(q)))).slice(0, 8);
    if (!coinc.length) return ocultarPersonal(campo);
    box.innerHTML = '<div class="sug-head"><span>👤 ¿De quién hablás? Tocá a la persona</span><button type="button" data-no="1">Ninguno</button></div>' +
      coinc.map((p, i) => '<button type="button" role="option" class="suggestion" data-i="' + i + '"><strong>' + esc(p.nombre) + '</strong>' + (detallePersonal(p) ? "<small>" + esc(detallePersonal(p)) + "</small>" : "") + "</button>").join("");
    box.hidden = false;
    const elegir = (e) => {
      const b = e.target.closest("button"); if (!b || !box.contains(b)) return;
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.no) return ocultarPersonal(campo);
      const p = coinc[+b.dataset.i]; if (!p) return;
      const t = textoPersonal(p), v = campo.value;
      campo.value = v.slice(0, ini) + t + v.slice(fin);
      const pos = ini + t.length; campo.focus(); campo.setSelectionRange(pos, pos);
      ocultarPersonal(campo); campo.dispatchEvent(new Event("input", { bubbles: true }));
    };
    box.onclick = elegir;
  }
  // Mientras se escribe: mira la palabra que está justo antes del cursor.
  function sugerirPersonal(campo) {
    const cur = campo.selectionStart, m = campo.value.slice(0, cur).match(/([\p{L}'’-]{3,})$/u);
    if (!m) return ocultarPersonal(campo);
    ofrecerPersonal(campo, cur - m[1].length, cur);
  }
  // Al dictar: busca en la frase recién dicha un apellido del personal.
  function personalEnDictado(campo, frase) {
    const pals = String(frase).match(/[\p{L}'’-]{4,}/gu) || [];
    const set = new Set(); S.quienesRetiran.forEach((p) => tokensNombre(p).forEach((t) => { if (t.length >= 4) set.add(t); }));
    const hallada = pals.find((w) => set.has(norm(w)));
    if (!hallada) return;
    const v = campo.value, i = v.toLowerCase().lastIndexOf(hallada.toLowerCase());
    if (i >= 0) ofrecerPersonal(campo, i, i + hallada.length);
  }
  // Botón "Personal": búsqueda manual con lista (sin teclado complicado).
  function buscarPersonal(id) {
    const campo = $("#" + id); if (!campo) return;
    openModal('<h2 style="margin:0 0 4px;color:var(--green-d)">👤 Buscar personal</h2><p class="hint">Escribí el apellido o el nombre y tocá a la persona para agregarla al texto.</p><input id="bpIn" placeholder="Ej: Martínez" autocomplete="off" autocapitalize="words"><div id="bpList" class="suggestions" style="border:0;box-shadow:none;max-height:50vh"></div>');
    const inp = $("#bpIn"), list = $("#bpList");
    const pintar = () => {
      const tk = norm(inp.value).split(/\s+/).filter(Boolean);
      const r = tk.length ? S.quienesRetiran.filter((p) => tk.every((t) => norm(p.nombre).includes(t))).slice(0, 12) : [];
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

  async function cargarNumero() {
    try { const r = await api("listas"); $("#numInforme").textContent = r.siguiente || "—"; }
    catch (e) { $("#numInforme").textContent = "—"; }
  }

  async function cargarListasUI() {
    const r = await api("listas");
    S.usuarios = Array.isArray(r.usuarios) ? r.usuarios : [];
    S.quienesRetiran = Array.isArray(r.quienesRetiran || r.quienRetira) ? (r.quienesRetiran || r.quienRetira) : [];
    S.objetivos = Array.isArray(r.objetivos) ? r.objetivos : [];
    $("#numInforme").textContent = r.siguiente || "—";
    Corrector.setConocidos(S.quienesRetiran.map((p) => p.nombre).concat(S.objetivos.map((o) => o.nombre)));
    if (Array.isArray(r.errores) && r.errores.length) toast("Aviso del servidor: " + r.errores.join(" | "), true);
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
    try { await cargarListasUI(); }
    catch (e) { toast("No se pudieron actualizar las listas: " + e.message, true); }
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
      el.addEventListener("input", (ev) => { if (ev.isTrusted) sugerirPersonal(el); });
      Corrector.attach(el, $('.spell-btn[data-target="' + id + '"]'));
    });
    $$(".pers-btn").forEach((b) => b.addEventListener("click", () => buscarPersonal(b.dataset.target)));
    $("#de").addEventListener("focus", mostrarSugerenciasDe);
    $("#de").addEventListener("change", () => { mostrarSugerenciasDe(); renderChips("cc"); });
    Corrector.init({ toast });
    $$(".spell-btn").forEach((b) => b.addEventListener("click", () => Corrector.abrir(b.dataset.target)));
    $("#fileInput").onchange = (e) => { onFiles(e.target.files); e.target.value = ""; };
    $("#cameraInput").onchange = (e) => { onFiles(e.target.files); e.target.value = ""; };
    $("#masFotos").onclick = () => { S.fotos.push(null, null, null, null); renderFotos(); toast("Se agregaron 4 recuadros más"); };
    $("#enviar").onclick = enviar; $("#limpiar").onclick = () => limpiar(false);
    $("#btnBuscar").onclick = buscar; $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
    renderFotos(); renderChips("para"); renderChips("cc");

    cargarListasUI().then(() => { $("#sugerenciasDe").hidden = true; }).catch(e => toast("No se pudieron cargar las listas: " + e.message, true));
    document.addEventListener("visibilitychange", recargarAlVolver);
    window.addEventListener("pageshow", recargarAlVolver);
    window.addEventListener("online", recargarAlVolver);
  }
  document.addEventListener("DOMContentLoaded", init);

  // para pruebas
  window.__app = { S, buildPdfFrom };
})();
