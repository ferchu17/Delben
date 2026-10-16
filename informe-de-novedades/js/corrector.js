/* ============================================================
   Corrector ortográfico en español (Argentina) para los campos de texto.
   - Motor: LanguageTool (api.languagetool.org), variante es-AR (si no existe, es).
   - Subraya en rojo (ondulado) los errores, sobre el propio campo.
   - Panel táctil tipo Word: error por error, sugerencias grandes, ignorar, etc.
   - Sin conexión o con límite de uso: vuelve al corrector nativo del teléfono.
   ============================================================ */
(function () {
  const URL_LT = "https://api.languagetool.org/v2/check";
  const KEY = "informe_dic_propio_v1";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const SALTAR = /^(STYLE|REDUNDANCY|TYPOGRAPHY|PLAIN_ENGLISH|WIKIPEDIA|COLLOQUIALISMS|PUNCTUATION_PARAGRAPH_END)$/;

  let toast = (m) => console.log(m);
  let alAgregar = null;                // avisa al servidor: la palabra queda para todos los supervisores
  // Palabras del trabajo de seguridad y del habla argentina que el corrector no tiene que marcar.
  const BASE = ("vigilador vigiladora vigiladores vigiladoras legajo legajos garita garitas rondin rondín rondines " +
    "relevo relevos relevar relevó franco francos franquero franqueros presentismo cobertura coberturas refuerzo refuerzos " +
    "reten retén retenes encargado encargada supervisor supervisora monitoreo monitorista handy handys borrador " +
    "novedad novedades objetivo objetivos puesto puestos portería porteria recorrida recorridas ronda rondas " +
    "celular whatsapp mail mails email patrullero patrulla comisaría comisaria denuncia " +
    "ingresó egresó ingresante egresante acta actas libro libros minuta minutas planilla planillas " +
    "laburo laburar remis remís colectivo boliche quilombo pibe pibes changarín bondi").split(/\s+/);
  let propio = new Set(BASE.map((w) => String(w).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  try { JSON.parse(localStorage.getItem(KEY) || "[]").forEach((w) => propio.add(w)); } catch (e) {}
  let conocidos = new Set();          // apellidos y nombres de las listas: no se marcan
  let idioma = "es-AR";
  let pausadoHasta = 0;
  const campos = {};                  // id -> estado

  function setConocidos(nombres) {
    conocidos = new Set();
    (nombres || []).forEach((n) => norm(n).split(/[^a-zñ]+/).filter((t) => t.length > 2).forEach((t) => conocidos.add(t)));
  }

  /* ---------- armado del campo con capa de subrayado ---------- */
  function attach(el, btn) {
    if (!el || campos[el.id]) return;
    const wrap = document.createElement("div"); wrap.className = "hl-wrap";
    const back = document.createElement("div"); back.className = "hl-back"; back.setAttribute("aria-hidden", "true");
    el.parentNode.insertBefore(wrap, el); wrap.appendChild(back); wrap.appendChild(el);
    el.classList.add("hl-text"); el.spellcheck = false;          // el subrayado lo hacemos nosotros
    const f = { el, back, btn, errs: [], snap: "", timer: null, silencio: false, nativo: false };
    campos[el.id] = f;
    const crecer = () => { el.style.height = "auto"; el.style.height = Math.max(el.scrollHeight + 2, 120) + "px"; };
    f.crecer = crecer;
    el.addEventListener("input", () => { crecer(); marcar(f); if (!f.silencio) programar(f); });
    el.addEventListener("click", () => { // tocar una palabra subrayada abre el panel en ese error
      if (el.value !== f.snap) return;
      const p = el.selectionStart, i = f.errs.findIndex((e) => p >= e.start && p <= e.start + e.len);
      if (i >= 0 && el.selectionStart === el.selectionEnd) abrir(el.id, i);
    });
    crecer(); marcar(f); etiqueta(f);
  }

  function marcar(f) {
    const v = f.el.value; let rangos = [];
    if (v === f.snap) rangos = f.errs.map((e) => [e.start, e.start + e.len]);
    else {
      new Set(f.errs.filter((e) => !/\s/.test(e.word)).map((e) => e.word)).forEach((w) => {
        const re = new RegExp("(^|[^\\p{L}])(" + escRe(w) + ")(?=$|[^\\p{L}])", "gu"); let m;
        while ((m = re.exec(v))) rangos.push([m.index + m[1].length, m.index + m[1].length + w.length]);
      });
    }
    rangos.sort((a, b) => a[0] - b[0]);
    let html = "", pos = 0;
    rangos.forEach(([a, b]) => { if (a < pos) return; html += esc(v.slice(pos, a)) + '<span class="err">' + esc(v.slice(a, b)) + "</span>"; pos = b; });
    html += esc(v.slice(pos)) + "​";
    f.back.innerHTML = html;
    etiqueta(f, rangos.length);
  }

  function etiqueta(f, n) {
    if (!f.btn) return;
    n = n == null ? f.errs.length : n;
    f.btn.innerHTML = "ABC ✓ Corregir" + (n ? ' <span class="badge-err">' + n + "</span>" : "");
  }

  /* ---------- consulta a LanguageTool ---------- */
  function programar(f) { clearTimeout(f.timer); f.timer = setTimeout(() => revisar(f), 1100); }

  async function llamar(texto) {
    for (let intento = 0; intento < 2; intento++) {
      const r = await fetch(URL_LT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ text: texto, language: idioma }) });
      if (r.status === 429) { pausadoHasta = Date.now() + 40000; throw new Error("limite"); }
      if (r.status === 400 && idioma !== "es") { idioma = "es"; continue; }    // la variante es-AR no está disponible
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }
    throw new Error("idioma");
  }

  function interpretar(texto, data) {
    const errs = [];
    (data.matches || []).forEach((m) => {
      const w = texto.substr(m.offset, m.length), cat = (m.rule && m.rule.category && m.rule.category.id) || "", id = (m.rule && m.rule.id) || "";
      if (SALTAR.test(cat) || !w.trim() || m.length > 60) return;
      const typo = /TYPOS/.test(cat) || /MORFOLOGIK|SPELL|HUNSPELL/i.test(id);
      if (typo) {
        if (propio.has(norm(w)) || /^\p{Lu}{2,}$/u.test(w) || /\d/.test(w)) return;
        const toks = w.split(/[^\p{L}]+/).filter(Boolean);
        if (toks.length && toks.every((t) => conocidos.has(norm(t)))) return;     // apellidos del personal
      } else if (!(m.replacements && m.replacements.length)) return;
      errs.push({ start: m.offset, len: m.length, word: w, msg: m.shortMessage || m.message || "", sug: (m.replacements || []).slice(0, 6).map((x) => x.value), typo });
    });
    return errs.sort((a, b) => a.start - b.start);
  }

  async function revisar(f, forzar) {
    const v = f.el.value;
    if (!v.trim()) { f.errs = []; f.snap = v; marcar(f); return f.errs; }
    if (v === f.snap && !forzar) return f.errs;
    if (Date.now() < pausadoHasta) { nativo(f, true); return f.errs; }
    try {
      const data = await llamar(v);
      f.errs = interpretar(v, data); f.snap = v; nativo(f, false);
    } catch (e) {
      nativo(f, true);                                  // sin Internet o con límite: corrector del teléfono
      return f.errs;
    }
    if (f.el.value !== v) programar(f);
    marcar(f);
    return f.errs;
  }

  function nativo(f, si) { if (f.nativo === si) return; f.nativo = si; f.el.spellcheck = si; }

  /* ---------- panel tipo Word ---------- */
  let hoja = null;
  function abrirHoja() {
    if (hoja) return hoja;
    hoja = document.createElement("div"); hoja.className = "cs"; hoja.hidden = true;
    hoja.innerHTML = '<div class="cs-box" role="dialog" aria-modal="true" aria-label="Corrector ortográfico"></div>';
    document.body.appendChild(hoja);
    return hoja;
  }
  function cerrar() { if (!hoja) return; hoja.hidden = true; document.body.style.overflow = ""; Object.values(campos).forEach((f) => { f.silencio = false; programar(f); }); }

  async function abrir(id, desde) {
    const f = campos[id]; if (!f) return;
    clearTimeout(f.timer);
    if (!f.el.value.trim()) { toast("No hay texto para revisar"); return; }
    abrirHoja().hidden = false; document.body.style.overflow = "hidden";
    hoja.firstChild.innerHTML = '<div class="cs-wait"><div class="spin"></div><p>Revisando ortografía…</p></div>';
    await revisar(f, true);
    if (f.nativo) {
      hoja.hidden = true; document.body.style.overflow = "";
      toast("No pude conectar con el corrector en español. Dejé activo el corrector del teléfono: tocá las palabras subrayadas.", true); return;
    }
    if (!f.errs.length) { hoja.hidden = true; document.body.style.overflow = ""; toast("Sin errores de ortografía ✔"); return; }
    f.silencio = true;
    paso(f, Math.min(desde || 0, f.errs.length - 1));
  }

  function contexto(v, e) {
    const a = Math.max(0, e.start - 70), b = Math.min(v.length, e.start + e.len + 70);
    return (a > 0 ? "…" : "") + esc(v.slice(a, e.start)) + "<mark>" + esc(v.slice(e.start, e.start + e.len)) + "</mark>" + esc(v.slice(e.start + e.len, b)) + (b < v.length ? "…" : "");
  }

  function paso(f, i) {
    const box = hoja.firstChild, n = f.errs.length;
    if (!n) {
      box.innerHTML = '<div class="cs-top"><b>Corrector</b><button class="cs-x" id="csX" aria-label="Cerrar">✕</button></div><div class="cs-fin"><div class="tick">✓</div><h3>Revisión terminada</h3><p>No quedan errores por corregir.</p><button class="btn send" id="csOk">Listo</button></div>';
      box.querySelector("#csOk").onclick = box.querySelector("#csX").onclick = () => { f.el.dispatchEvent(new Event("input", { bubbles: true })); cerrar(); };
      return;
    }
    i = (i + n) % n;
    const e = f.errs[i], v = f.el.value;
    box.innerHTML =
      '<div class="cs-top"><b>Corrector · español (Argentina)</b><span class="cs-n">' + (i + 1) + " de " + n + '</span><button class="cs-x" id="csX" aria-label="Cerrar">✕</button></div>' +
      '<div class="cs-ctx">' + contexto(v, e) + "</div>" +
      '<div class="cs-msg">' + esc(e.msg || (e.typo ? "Palabra mal escrita" : "Revisá esta parte")) + "</div>" +
      '<div class="cs-sug">' + (e.sug.length ? e.sug.map((s, k) => '<button type="button" data-k="' + k + '">' + esc(s) + "</button>").join("") : '<div class="cs-nosug">Sin sugerencias. Escribila vos abajo.</div>') + "</div>" +
      '<div class="cs-manual"><input id="csIn" value="' + esc(e.word) + '" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="btn small" id="csCambiar">Cambiar</button></div>' +
      '<div class="cs-act"><button type="button" id="csPrev">◀ Anterior</button><button type="button" id="csIgn">Ignorar</button><button type="button" id="csSig">➕ Agregar al diccionario</button><button type="button" id="csNext">Siguiente ▶</button></div>';

    const aplicar = (txt) => {
      const nv = v.slice(0, e.start) + txt + v.slice(e.start + e.len), d = txt.length - e.len;
      f.el.value = nv; f.snap = nv;
      f.errs.splice(i, 1); f.errs.forEach((x, k) => { if (k >= i) x.start += d; });
      f.crecer(); marcar(f);
      paso(f, i);
    };
    box.querySelectorAll(".cs-sug button").forEach((b) => (b.onclick = () => aplicar(e.sug[+b.dataset.k])));
    box.querySelector("#csCambiar").onclick = () => { const t = box.querySelector("#csIn").value; if (t && t !== e.word) aplicar(t); else paso(f, i + 1); };
    box.querySelector("#csIgn").onclick = () => { f.errs.splice(i, 1); marcar(f); paso(f, i); };
    box.querySelector("#csSig").onclick = () => {
      const k = norm(e.word); propio.add(k); try { localStorage.setItem(KEY, JSON.stringify(Array.from(propio))); } catch (x) {}
      if (alAgregar) { try { alAgregar(e.word); } catch (x) {} }
      toast("“" + e.word + "” se agregó al diccionario de todos los supervisores");
      Object.values(campos).forEach((c) => { c.errs = c.errs.filter((x) => norm(x.word) !== k); marcar(c); });
      paso(f, i);
    };
    box.querySelector("#csPrev").onclick = () => paso(f, i - 1);
    box.querySelector("#csNext").onclick = () => paso(f, i + 1);
    box.querySelector("#csX").onclick = cerrar;
  }

  window.Corrector = {
    init(opts) { if (opts && opts.toast) toast = opts.toast; if (opts && opts.agregar) alAgregar = opts.agregar; },
    // Palabras que agregaron los supervisores (vienen del servidor): no se marcan más.
    setDiccionario(lista) {
      (lista || []).forEach((w) => { const k = norm(w); if (k) propio.add(k); });
      Object.values(campos).forEach((c) => { c.errs = c.errs.filter((x) => !(x.typo && propio.has(norm(x.word)))); marcar(c); });
    },
    attach, setConocidos, abrir,
    pendientes() { return Object.values(campos).reduce((s, f) => s + (f.el.value === f.snap ? f.errs.length : 0), 0); },
    refrescar(id) { const f = campos[id]; if (f) { f.crecer(); marcar(f); programar(f); } },
    async revisarTodo() { for (const f of Object.values(campos)) { clearTimeout(f.timer); await revisar(f, true); } return this.pendientes(); },
    primerCampoConErrores() { const f = Object.values(campos).find((x) => x.errs.length); return f ? f.el.id : null; }
  };
})();
