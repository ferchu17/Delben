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
    const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
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
    users: [
      { nombre: "Celso Canaveta", email: "celso@ejemplo.com" }, { nombre: "Fernando Jacino", email: "fjacino@ejemplo.com" },
      { nombre: "Gustavo San Martín", email: "gustavo@ejemplo.com" }, { nombre: "María Gómez", email: "" }, { nombre: "Laura Benítez", email: "laura@ejemplo.com" }
    ],
    objetivos: [
      { nombre: "Planta Norte", email: "plantanorte@ejemplo.com" }, { nombre: "Depósito Central", email: "deposito@ejemplo.com" },
      { nombre: "Edificio Corporativo", email: "" }, { nombre: "Barrio Los Álamos", email: "alamos@ejemplo.com" }
    ]
  };

  async function api(action, payload) {
    if (DEMO) return demo(action, payload || {});
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
    if (action === "listas") return { ok: true, usuarios: DEMO_DB.users, objetivos: DEMO_DB.objetivos, siguiente: pad(DEMO_DB.next) };
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
  let rec = null, recBtn = null;
  function stopRec() { if (rec) { try { rec.onend = null; rec.stop(); } catch (e) {} } if (recBtn) { recBtn.classList.remove("rec"); const sp = $("span", recBtn); if (sp) sp.textContent = "Hablar"; } const st = $(".mic-state"); st.forEach((s) => (s.textContent = "")); rec = null; recBtn = null; }
  function toggleMic(btn) {
    if (recBtn === btn) return stopRec();
    stopRec();
    const target = document.getElementById(btn.dataset.target), state = $(`.mic-state[data-for="${btn.dataset.target}"]`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.isSecureContext) { toast("El dictado requiere una conexión segura HTTPS.", true); if (state) state.textContent = "Abrí la aplicación desde su dirección HTTPS."; return; }
    if (!SR) { toast("Este navegador o la APK no admite dictado integrado. Usá el micrófono 🎤 del teclado para dictar en el campo.", true); if (state) state.textContent = "El reconocimiento de voz no está disponible en este entorno."; return; }
    const r = new SR(); r.lang = "es-AR"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    const base = target.value ? target.value.replace(/\s+$/, "") + " " : "";
    // El navegador vuelve a entregar resultados anteriores en cada evento.
    // Guardarlos por índice evita concatenar dos veces el mismo fragmento.
    const segmentos = [];
    r.onresult = (ev) => {
      for (let i = 0; i < ev.results.length; i++) {
        segmentos[i] = ev.results[i][0].transcript;
      }
      target.value = (base + segmentos.filter(Boolean).join(" ")).replace(/\s+/g, " ").trimStart();
      target.dispatchEvent(new Event("input", { bubbles: true }));
      if (target.tagName === "TEXTAREA") target.scrollTop = target.scrollHeight;
    };
    r.onerror = (e) => {
      const messages = {
        "not-allowed": "Permiso de micrófono denegado. Revisá los permisos del sitio o de la APK.",
        "service-not-allowed": "El servicio de reconocimiento de voz está bloqueado en este dispositivo.",
        "audio-capture": "No se encontró un micrófono disponible.",
        "network": "El reconocimiento de voz necesita conexión a Internet.",
        "no-speech": "No se detectó voz. Tocá Hablar e intentá nuevamente.",
        "language-not-supported": "Este dispositivo no admite dictado en español.",
        "aborted": "Dictado cancelado."
      };
      if (state) state.textContent = messages[e.error] || ("Error de micrófono: " + e.error);
      if (e.error !== "aborted") toast(messages[e.error] || ("Error de micrófono: " + e.error), true);
    };
    r.onend = () => {
      if (rec === r) {
        rec = null;
        if (recBtn) { recBtn.classList.remove("rec"); const sp = $("span", recBtn); if (sp) sp.textContent = "Hablar"; }
        recBtn = null;
        if (state && !state.textContent.startsWith("Error") && !state.textContent.includes("denegado")) state.textContent = "Dictado finalizado.";
      }
    };
    try { r.start(); } catch (e) { toast("No se pudo iniciar el dictado. Volvé a tocar el micrófono.", true); return; }
    rec = r; recBtn = btn; btn.classList.add("rec"); const sp = $("span", btn); if (sp) sp.textContent = "Escuchando… tocá para parar";
    state.textContent = "🔴 Escuchando…";
  }

  /* ---------------- selector de personal y corrector móvil ---------------- */
  function mostrarSugerenciasDe() {
    const input = $("#de"), box = $("#sugerenciasDe"), detalle = $("#detalleDe");
    const q = norm(input.value);
    detalle.textContent = "";
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    const exact = S.quienesRetiran.find(p => norm(p.nombre) === q);
    if (exact) {
      input.value = exact.nombre;
      box.hidden = true; box.innerHTML = "";
      detalle.textContent = "Seleccionado: " + exact.nombre;
      renderChips("cc");
      return;
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = S.quienesRetiran.filter(p => {
      const name = norm(p.nombre);
      return tokens.every(t => name.includes(t));
    }).slice(0, 12);
    box.innerHTML = matches.length
      ? matches.map((p,i) => '<button type="button" role="option" aria-selected="false" class="suggestion" data-index="' + i + '">' + esc(p.nombre) + '</button>').join("")
      : '<div class="suggestion-empty">No hay coincidencias. Probá con otro apellido.</div>';
    box.hidden = false;
    // pointerdown ocurre antes de que el teclado móvil quite el foco del input.
    // Delegar el evento en la caja evita que el toque se pierda en navegadores móviles.
    const elegir = (e) => {
      const b = e.target.closest(".suggestion[data-index]");
      if (!b || !box.contains(b)) return;
      e.preventDefault();
      const chosen = matches[Number(b.dataset.index)];
      if (!chosen) return;
      input.value = chosen.nombre;
      box.hidden = true; box.innerHTML = "";
      detalle.textContent = "Seleccionado: " + chosen.nombre;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      renderChips("cc");
    };
    box.onpointerdown = elegir;
    box.onclick = elegir;
  }

  function mostrarSugerenciasVigilador() {
    const campo = $("#informe"), box = $("#sugerenciasVigilador");
    const cursor = campo.selectionStart;
    const antes = campo.value.slice(0, cursor);
    // Activar solo cuando se escribe "vigilador" seguido de un apellido/nombre.
    const m = antes.match(/\bvigilador(?:a)?\s*[,;:]?\s+([\p{L}][\p{L}\s.'-]*)$/iu);
    if (!m || !S.quienesRetiran.length) { box.hidden = true; box.innerHTML = ""; return; }
    const consulta = norm(m[1]).trim();
    if (consulta.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
    const tokens = consulta.split(/\s+/).filter(Boolean);
    const matches = S.quienesRetiran.filter(p => {
      const nombre = norm(p.nombre);
      return tokens.every(t => nombre.includes(t));
    }).slice(0, 8);
    if (!matches.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = matches.map((p,i) => {
      const datos = [p.legajo ? "Legajo: " + p.legajo : "", p.empresa ? "Empresa: " + p.empresa : ""].filter(Boolean).join(" · ");
      return '<button type="button" role="option" class="suggestion" data-index="' + i + '"><strong>' + esc(p.nombre) + '</strong>' + (datos ? '<small>' + esc(datos) + '</small>' : '') + '</button>';
    }).join("");
    box.hidden = false;
    const elegir = (e) => {
      const b = e.target.closest(".suggestion[data-index]");
      if (!b || !box.contains(b)) return;
      e.preventDefault();
      const p = matches[Number(b.dataset.index)];
      if (!p) return;
      const desde = cursor - m[0].length;
      const empresa = p.empresa ? " · Empresa: " + p.empresa : "";
      const legajo = p.legajo ? " · Legajo: " + p.legajo : "";
      const texto = "vigilador " + p.nombre + (legajo || empresa ? " (" + [p.legajo ? "Legajo: " + p.legajo : "", p.empresa ? "Empresa: " + p.empresa : ""].filter(Boolean).join(" · ") + ")" : "");
      campo.value = campo.value.slice(0, desde) + texto + campo.value.slice(cursor);
      const pos = desde + texto.length;
      campo.focus(); campo.setSelectionRange(pos, pos);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      box.hidden = true; box.innerHTML = "";
    };
    box.onpointerdown = elegir;
    box.onclick = elegir;
  }

  function abrirCorrector(id) {
    const campo = $("#" + id);
    if (!campo) return;
    openModal('<h2>Corrector ortográfico</h2><p class="hint">Revisá el texto en español. Las palabras que el navegador detecte como incorrectas pueden aparecer subrayadas en rojo. Tocá una palabra subrayada para ver las sugerencias del teclado/navegador.</p><textarea id="textoCorrector" lang="es-AR" spellcheck="true" autocorrect="on" autocapitalize="sentences" rows="10"></textarea><div class="actions"><button type="button" class="btn send" id="aplicarCorreccion">Aplicar texto</button><button type="button" class="btn ghost" id="cancelarCorreccion">Cancelar</button></div>');
    const editor = $("#textoCorrector");
    editor.value = campo.value;
    $("#aplicarCorreccion").onclick = () => {
      campo.value = editor.value;
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      closeModal();
      toast("Texto actualizado. Revisá las palabras marcadas antes de enviar.");
    };
    $("#cancelarCorreccion").onclick = closeModal;
    editor.focus();
  }

  /* ---------------- destinatarios (chips) ---------------- */
  function directorio() { return S.usuarios.concat(S.objetivos); }
  function buscarPersona(nombre) { const n = norm(nombre); return directorio().find((p) => norm(p.nombre) === n); }

  function renderChips(kind) {
    const arr = S[kind], box = $(kind === "para" ? "#chipsPara" : "#chipsCc");
    let html = "";
    if (kind === "cc") {
      const a = autor();
      if (a) html += `<span class="chip lock">${esc(a.nombre)} <em>autor</em></span>`;
    }
    arr.forEach((p, i) => {
      html += `<span class="chip">${esc(p.nombre)}${p.email ? "" : " <em>sin correo</em>"}<button type="button" data-k="${kind}" data-i="${i}" aria-label="Quitar">✕</button></span>`;
    });
    box.innerHTML = html;
    $$("button", box).forEach((b) => (b.onclick = () => { S[b.dataset.k].splice(+b.dataset.i, 1); renderChips(b.dataset.k); }));
  }
  function addChip(kind, input) {
    const nombre = input.value.replace(/\s+/g, " ").trim();
    if (!nombre) return;
    const max = kind === "para" ? CFG.MAX_PARA : CFG.MAX_CC;
    if (S[kind].length >= max) return toast("Máximo " + max + " personas", true);
    if (S[kind].some((p) => norm(p.nombre) === norm(nombre))) { input.value = ""; return; }
    const f = buscarPersona(nombre);
    S[kind].push({ nombre: f ? f.nombre : nombre, email: f ? f.email : "" });
    input.value = ""; renderChips(kind);
  }
  function autor() { const v = norm($("#de").value); if (!v) return null; const q = S.quienesRetiran.find(p => norm(p.nombre) === v); if (!q) return null; const u = S.usuarios.find(p => norm(p.nombre) === v); return { nombre: q.nombre, email: (u && u.email) || q.email || "" }; }

  /* ---------------- fotos ---------------- */
  let slotActivo = null;
  function renderFotos() {
    const box = $("#fotos"); box.innerHTML = "";
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
    if (!S.quienesRetiran.some(p => norm(p.nombre) === norm(d.de))) return "Elegí un nombre de la lista «quien retira» en el campo De";
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cargarNumero() {
    try { const r = await api("listas"); $("#numInforme").textContent = r.siguiente || "—"; } catch (e) {}
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
    $("#inPara").addEventListener("change", (e) => { if (buscarPersona(e.target.value)) addChip("para", e.target); });
    $("#inCc").addEventListener("change", (e) => { if (buscarPersona(e.target.value)) addChip("cc", e.target); });
    $("#de").addEventListener("input", mostrarSugerenciasDe);
    $("#informe").addEventListener("input", mostrarSugerenciasVigilador);
    $("#de").addEventListener("focus", mostrarSugerenciasDe);
    $("#de").addEventListener("change", () => { mostrarSugerenciasDe(); renderChips("cc"); });
    $$(".spell-btn").forEach((b) => b.addEventListener("click", () => abrirCorrector(b.dataset.target)));
    $("#fileInput").onchange = (e) => { onFiles(e.target.files); e.target.value = ""; };
    $("#cameraInput").onchange = (e) => { onFiles(e.target.files); e.target.value = ""; };
    $("#masFotos").onclick = () => { S.fotos.push(null, null, null, null); renderFotos(); toast("Se agregaron 4 recuadros más"); };
    $("#enviar").onclick = enviar; $("#limpiar").onclick = () => limpiar(false);
    $("#btnBuscar").onclick = buscar; $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
    renderFotos(); renderChips("para"); renderChips("cc");

    try {
      const r = await api("listas");
      S.usuarios = r.usuarios || []; S.quienesRetiran = r.quienesRetiran || r.quienRetira || []; S.objetivos = r.objetivos || [];
      $("#numInforme").textContent = r.siguiente || "—";
      $("#sugerenciasDe").hidden = true;
      $("#dl-objetivos").innerHTML = S.objetivos.map((o) => `<option value="${esc(o.nombre)}">`).join("");
      $("#dl-personas").innerHTML = directorio().map((p) => `<option value="${esc(p.nombre)}">`).join("");
    } catch (e) { toast("No se pudieron cargar las listas: " + e.message, true); }
  }
  document.addEventListener("DOMContentLoaded", init);

  // para pruebas
  window.__app = { S, buildPdfFrom };
})();
