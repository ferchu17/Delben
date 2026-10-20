/* ============================================================
   MINUTA OPERATIVA DEL SERVICIO — App (GitHub Pages)
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const DEMO = !CFG.API_URL;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const CLAVE_TOKEN = "minuta_op_token";

  const S = { token: "", ses: null, serv: null, m: null, fotos: [], ultimoPdf: null };

  /* ----------------------- almacenamiento local (con try/catch) ----------------------- */
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ----------------------- avisos ----------------------- */
  let tToast = null;
  function toast(msg, err) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, err ? 6000 : 3200);
  }
  function overlay(txt) { const o = $("#overlay"); if (!txt) { o.hidden = true; return; } $("#ovTxt").textContent = txt; o.hidden = false; }
  function openModal(html) { $("#modalBox").innerHTML = html; $("#modal").hidden = false; $("#modal").scrollTop = 0; }
  function closeModal() { $("#modal").hidden = true; $("#modalBox").innerHTML = ""; }

  /* ----------------------- API ----------------------- */
  async function api(action, payload, ms) {
    if (DEMO) return demo(action, payload || {});
    const body = Object.assign({ action: action, token: S.token }, payload || {});
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms || 60000) : null;
    let r, raw;
    try {
      r = await fetch(CFG.API_URL, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      raw = await r.text();
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("El servidor tardó demasiado en responder. Probá de nuevo.");
      throw new Error(navigator.onLine === false ? "No hay conexión a Internet." : "No se pudo conectar con el servidor. Revisá la conexión.");
    } finally { if (t) clearTimeout(t); }
    let d;
    try { d = JSON.parse(raw); } catch (_) { throw new Error("El servidor devolvió una respuesta inválida (revisá la implementación del Apps Script)."); }
    if (!d.ok) {
      if (d.sesionVencida) { salir(true); }
      throw new Error(d.error || "Error del servidor");
    }
    return d;
  }

  /* ----------------------- fechas y horas ----------------------- */
  const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const isoAtxt = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; };
  const diaDe = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? DIAS[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] : ""; };
  const ahora = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  function aMin(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "").trim()); if (!m) return null; const h = +m[1], mi = +m[2]; return h > 23 || mi > 59 ? null : h * 60 + mi; }
  // Hora diurna: 06:00 a 21:00 · Nocturna: 21:00 a 06:00
  function calcHoras(ing, egr) {
    const s = aMin(ing); let e = aMin(egr);
    if (s == null || e == null) return null;
    if (e <= s) e += 1440;
    let d = 0, n = 0;
    for (let t = s; t < e; t++) { const h = t % 1440; if (h >= 360 && h < 1260) d++; else n++; }
    return { total: (e - s) / 60, d: d / 60, n: n / 60 };
  }
  const fmtH = (x) => String(Math.round(x * 100) / 100).replace(".", ",");

  /* ----------------------- modelo de la minuta ----------------------- */
  const PUESTOS = ["Encargado", "Jefe de servicio", "Vigilador", "Guardia", "Móvil", "Movilero", "CCTV", "Operador/a CCTV", "Bunker", "Puesto 1", "Puesto 2", "Puesto 3", "Retén", "Refuerzo"];
  const ESTADOS_EQ = ["En condiciones", "Con novedad", "Fuera de servicio", "No se utilizó"];
  const MODOS = ["Caminando", "En móvil", "En Melex", "En bicicleta", "Vehículo eléctrico", "Caminando y móvil"];
  const COMBUSTIBLE = ["Reserva", "1/4", "1/2", "3/4", "Lleno", "Carga eléctrica 25%", "Carga eléctrica 50%", "Carga eléctrica 75%", "Carga eléctrica 100%"];
  const TXT_INICIO = "Siendo la hora indicada, tomo servicio de guardia con los elementos asignados al puesto y novedades que anteceden; demás existencias sin novedad.";
  const TXT_CIERRE = "Siendo la hora indicada, finalizo servicio de guardia con los elementos asignados al puesto y novedades que anteceden; demás existencias sin novedad. Quedo a su entera disposición por cualquier consulta.";

  function turnoHorario(turno) { return turno === "Nocturno" ? S.serv.horarioNocturno : S.serv.horarioDiurno; }
  const sumarDias = (iso, n) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); const d = new Date(+m[1], +m[2] - 1, +m[3] + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  // sig: { fecha, turno } para arrancar la minuta del turno siguiente después de enviar una
  function minutaNueva(sig) {
    const h = new Date().getHours();
    let turno = h >= 6 && h < 18 ? "Diurno" : "Nocturno";
    // De madrugada, la minuta es la del turno noche que empezó el día anterior
    let fecha = hoyISO();
    if (h < 6) fecha = sumarDias(fecha, -1);
    if (sig) { turno = sig.turno; fecha = sig.fecha; }
    const horario = turnoHorario(turno);
    const [hi, hf] = String(horario).split(/\s*a\s*/);
    return {
      fecha: fecha, turno: turno, horario: horario, guardia: "",
      encargado: { nombre: "", legajo: "", empresa: "" },
      personal: [{ nombre: "", legajo: "", empresa: "", puesto: "Encargado", ingreso: hi || "", egreso: hf || "", observacion: "" }],
      ausentes: [],
      vehiculos: vehiculosIniciales(),
      supervisorUsuario: S.serv.supervisor.usuario || "",
      equipos: (S.serv.equipos || []).map((e) => ({ equipo: e, estado: "En condiciones", observaciones: "Sin novedad" })),
      horaInicio: hi || "", responsableInicio: "", detalleInicio: TXT_INICIO,
      novedades: [], rondines: [], relevantes: [""],
      horaFin: hf || "", entregaA: "", observacionesFinales: TXT_CIERRE, recibe: ""
    };
  }
  /* ----------------------- flota (patentes) ----------------------- */
  const dom = (x) => String(x || "").toUpperCase().replace(/[\s.-]/g, "");
  const flota = () => (S.ses && S.ses.flota) || [];
  const enFlota = (d) => flota().find((v) => v.dominio === dom(d));
  function nombreVehiculo(v) {
    const marca = String(v.marca || "").trim(), modelo = String(v.modelo || "").trim();
    return norm(modelo).indexOf(norm(marca).split(" ")[0]) === 0 ? modelo : (marca + " " + modelo).trim();
  }
  const datosVehiculo = (v) => [v.color, v.anio, v.empresa].filter(Boolean).join(" · ");
  // Vehículos de la flota que están en este servicio (columna ubicación)
  function flotaDelServicio() {
    const sn = norm(S.serv.servicio);
    return flota().filter((v) => { const u = norm(v.ubicacion); if (!u) return false; const pal = u.split(" ").filter((w) => w.length > 3 && w !== "barrio"); return pal.length && pal.every((w) => sn.indexOf(w) >= 0); });
  }
  function vehiculosIniciales() {
    const lista = (S.serv.vehiculos || []).map((v) => ({ vehiculo: v.vehiculo, dominio: v.dominio }));
    flotaDelServicio().forEach((f) => { if (!lista.some((v) => dom(v.dominio) === f.dominio)) lista.unshift({ vehiculo: nombreVehiculo(f), dominio: f.dominio }); });
    return lista.map((v) => {
      const f = enFlota(v.dominio);
      return { vehiculo: f ? nombreVehiculo(f) : v.vehiculo, dominio: f ? f.dominio : v.dominio, datos: f ? datosVehiculo(f) : "", kmInicio: "", kmFin: "", combustible: "", vigilador: "" };
    });
  }

  const claveBorrador = () => "minuta_op_borrador_" + (S.ses ? S.ses.usuario.usuario : "") + "_" + (S.serv ? S.serv.idServicio : "");
  // Las fotos del borrador van a IndexedDB (localStorage tiene un límite de ~5 MB y no entran muchas fotos)
  const IDB = {
    db: null,
    abrir() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((ok) => {
        try {
          const r = indexedDB.open("minuta_operativa", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("kv");
          r.onsuccess = () => { this.db = r.result; ok(this.db); };
          r.onerror = () => ok(null);
        } catch (e) { ok(null); }
      });
    },
    async set(k, v) { const db = await this.abrir(); if (!db) return; try { db.transaction("kv", "readwrite").objectStore("kv").put(v, k); } catch (e) {} },
    async get(k) { const db = await this.abrir(); if (!db) return null; return new Promise((ok) => { try { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch (e) { ok(null); } }); },
    async del(k) { const db = await this.abrir(); if (!db) return; try { db.transaction("kv", "readwrite").objectStore("kv").delete(k); } catch (e) {} }
  };
  let tBorr = null;
  function guardarBorrador() {
    clearTimeout(tBorr);
    tBorr = setTimeout(() => {
      LS.set(claveBorrador(), JSON.stringify({ m: S.m, t: Date.now() }));
      IDB.set(claveBorrador() + "_fotos", S.fotos);
    }, 400);
  }
  function borrarBorrador() { LS.del(claveBorrador()); IDB.del(claveBorrador() + "_fotos"); }

  /* ----------------------- ingreso ----------------------- */
  function ver(v) { $("#vLogin").hidden = v !== "login"; $("#vApp").hidden = v !== "app"; $("#cargando").hidden = true; }

  async function arrancar() {
    ["#logoLogin", "#logoTop", "#logoSplash"].forEach((s) => { $(s).src = CFG.LOGO_APP; });
    $("#lDemo").hidden = !DEMO; $("#demoBar").hidden = !DEMO;
    S.token = LS.get(CLAVE_TOKEN) || "";
    if (!S.token) { ver("login"); return; }
    try { S.ses = await api("inicio", {}, 90000); if (S.ses.token) { S.token = S.ses.token; LS.set(CLAVE_TOKEN, S.token); } entrarApp(); }
    catch (e) { if (S.token) { LS.del(CLAVE_TOKEN); S.token = ""; } ver("login"); $("#lError").textContent = e.message; }
  }

  $("#fLogin").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const u = $("#lUsuario").value.trim(), p = $("#lClave").value;
    $("#lError").textContent = ""; $("#lEntrar").disabled = true; $("#lEntrar").textContent = "Ingresando…";
    try {
      const r = await api("login", { usuario: u, password: p }, 90000);
      S.token = r.token; LS.set(CLAVE_TOKEN, r.token); S.ses = r; $("#lClave").value = "";
      entrarApp();
    } catch (e) { $("#lError").textContent = e.message; }
    finally { $("#lEntrar").disabled = false; $("#lEntrar").textContent = "Ingresar"; }
  });
  $("#lVer").onclick = () => { const i = $("#lClave"); i.type = i.type === "password" ? "text" : "password"; };
  $("#bSalir").onclick = () => salir(false);
  function salir(vencida) {
    LS.del(CLAVE_TOKEN); LS.del("minuta_op_vista"); S.token = ""; S.ses = null; S.serv = null; closeModal(); overlay();
    ver("login"); if (vencida) $("#lError").textContent = "La sesión venció. Volvé a ingresar.";
  }

  function entrarApp() {
    const u = S.ses.usuario;
    $("#topUsuario").textContent = u.nombre + " · " + u.rol;
    $("#pruebaBar").hidden = !S.ses.modoPrueba;
    $("#pruebaBar").textContent = "MODO PRUEBA · los correos solo le llegan a " + (S.ses.correoPrueba || "Fernando");
    ver("app");
    // El usuario del servicio entra directo a su servicio. Supervisores, administradores y visores solo ven los informes.
    const carga = !!S.ses.cargaMinutas;
    $('.tab[data-tab="nueva"]').hidden = !carga;
    $('.tab[data-tab="presentes"]').hidden = carga;
    $("#servCard").hidden = !carga;
    if (carga) { S.serv = S.ses.servicios[0]; pintarServicio(); cargarBorradorOnueva(); }
    prepararPresentes();
    const qs = $("#qServ");
    qs.innerHTML = '<option value="">Todos mis servicios</option>' + S.ses.servicios.map((s) => `<option value="${esc(s.idServicio)}">${esc(s.servicio)}</option>`).join("");
    $("#qServWrap").hidden = S.ses.servicios.length < 2;
    // Vuelve a la pestaña donde estaba (o la que pide el link: ?vista=presentes)
    const pedida = (new URLSearchParams(location.search).get("vista") || "").toLowerCase();
    const guardada = LS.get("minuta_op_vista");
    const vista = [pedida, guardada].find((v) => v && !$('.tab[data-tab="' + v + '"]').hidden) || (carga ? "nueva" : "informes");
    if (vista !== "nueva") $('.tab[data-tab="' + vista + '"]').click();
  }

  function pintarServicio() {
    const s = S.serv;
    const img = s.logoCliente ? `<img class="serv-logo" src="${esc(s.logoCliente)}" alt="" onerror="this.remove()">` : `<img class="serv-logo" src="${esc(CFG.LOGO_PDF)}" alt="">`;
    const logo = `<div class="serv-logo-box">${img}${s.logoTexto ? `<div class="serv-logo-txt">${esc(s.logoTexto)}</div>` : ""}</div>`;
    $("#servCard").innerHTML = `${logo}
      <div class="serv-info">
        <div class="serv-nom">${esc(s.servicio)}</div>
        <div class="serv-dir">📍 ${esc([s.direccion, s.localidad].filter(Boolean).join(" · "))}</div>
        <div class="pills">
          ${s.empresa ? `<span class="pill o">🏢 ${esc(s.empresa)}</span>` : ""}
          <span class="pill">👮 Supervisor: ${esc(s.supervisor.nombre || "—")}</span>
          <span class="pill v">⭐ Jefe de Operaciones: ${esc(s.jefeOperaciones || "—")}</span>
        </div>
      </div>`;
  }

  async function cargarBorradorOnueva() {
    const raw = LS.get(claveBorrador());
    let b = null; try { b = raw ? JSON.parse(raw) : null; } catch (e) {}
    const av = $("#borradorAviso");
    if (b && b.m) {
      S.m = b.m; S.fotos = (await IDB.get(claveBorrador() + "_fotos")) || b.fotos || [];
      if (S.m.supervisorUsuario === undefined) S.m.supervisorUsuario = S.serv.supervisor.usuario || "";
      av.innerHTML = `📝 Seguís con la minuta que venías cargando (último cambio: ${new Date(b.t).toLocaleString("es-AR")}). Se envía cuando termina la guardia.`;
      av.hidden = false;
    } else { S.m = minutaNueva(); S.fotos = []; av.hidden = true; }
    pintarForm();
    // Vuelve a donde estaba en la pantalla
    const y = +LS.get("minuta_op_scroll") || 0;
    if (y && $("#vista-nueva").classList.contains("on")) setTimeout(() => window.scrollTo(0, y), 50);
  }
  let tScroll = null;
  window.addEventListener("scroll", () => { clearTimeout(tScroll); tScroll = setTimeout(() => { if ($("#vista-nueva").classList.contains("on")) LS.set("minuta_op_scroll", String(Math.round(window.scrollY))); }, 300); }, { passive: true });

  /* ----------------------- pestañas ----------------------- */
  $$(".tab").forEach((b) => b.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.toggle("on", x === b));
    $$(".view").forEach((v) => v.classList.toggle("on", v.id === "vista-" + b.dataset.tab));
    if (b.dataset.tab === "informes" && !$("#resultados").dataset.ok) iniciarBusqueda();
    if (b.dataset.tab === "presentes" && !$("#pResultados").dataset.ok) iniciarPresentes();
    LS.set("minuta_op_vista", b.dataset.tab);
    window.scrollTo(0, 0);
  }));

  /* ----------------------- autocompletar personal ----------------------- */
  function buscarPersonal(q, prefer) {
    const t = norm(q).split(" ").filter(Boolean);
    if (!t.length) return (prefer || []).slice(0, 30);
    const match = (p) => { const h = norm(p.n + " " + p.l + " " + p.e); return t.every((x) => h.indexOf(x) >= 0); };
    const pre = (prefer || []).filter(match);
    const ya = new Set(pre.map((p) => p.n + "|" + p.l));
    return pre.concat(S.ses.personal.filter((p) => match(p) && !ya.has(p.n + "|" + p.l))).slice(0, 40);
  }
  const enServicio = () => S.m.personal.filter((p) => p.nombre).map((p) => ({ n: p.nombre, l: p.legajo, e: p.empresa }));

  // input: elemento; onPick(p) al elegir; opts.prefer() devuelve lista sugerida primero; opts.libre permite texto libre
  function autocompletar(input, onPick, opts) {
    opts = opts || {};
    const box = document.createElement("div"); box.className = "ac-list"; box.hidden = true;
    input.parentNode.classList.add("ac"); input.parentNode.appendChild(box);
    input.setAttribute("autocomplete", "off");
    let items = [], sel = -1;
    const pintar = () => {
      items = opts.buscar ? opts.buscar(input.value) : buscarPersonal(input.value, opts.prefer ? opts.prefer() : null);
      if (!items.length || document.activeElement !== input) { box.hidden = true; return; }
      const fila = opts.render || ((p) => `<span class="ac-n">${esc(p.n)}</span><span class="ac-m"><span class="leg">Leg. ${esc(p.l)}</span><span class="emp ${esc(p.e)}">${esc(p.e || "—")}</span></span>`);
      box.innerHTML = items.map((p, i) => `<div class="ac-it${i === sel ? " sel" : ""}" data-i="${i}">${fila(p)}</div>`).join("");
      box.hidden = false;
    };
    const elegir = (i) => { const p = items[i]; if (!p) return; input.value = opts.valor ? opts.valor(p) : p.n; box.hidden = true; onPick(p); };
    input.addEventListener("input", () => { sel = -1; pintar(); if (opts.libre) opts.libre(input.value); });
    input.addEventListener("focus", pintar);
    input.addEventListener("blur", () => setTimeout(() => { box.hidden = true; }, 180));
    input.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); pintar(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); pintar(); e.preventDefault(); }
      else if (e.key === "Enter" && sel >= 0) { elegir(sel); e.preventDefault(); }
    });
    box.addEventListener("mousedown", (e) => { const it = e.target.closest(".ac-it"); if (it) { e.preventDefault(); elegir(+it.dataset.i); } });
  }
  // Campos de persona dentro de filas (movilero, vigilador, personal de una novedad): guardan nombre, legajo y empresa
  const chipK = (o, k) => chipPersona({ legajo: o[k + "Leg"], empresa: o[k + "Emp"] });
  function personasFila(cont, arr) {
    $$("input.per2", cont).forEach((inp) => {
      const i = +inp.closest("[data-i]").dataset.i, k = inp.dataset.k, chip = inp.parentNode.querySelector(".sel-per");
      autocompletar(inp, (p) => {
        arr[i][k] = p.n; arr[i][k + "Leg"] = p.l; arr[i][k + "Emp"] = p.e;
        if (chip) chip.innerHTML = chipPersona({ legajo: p.l, empresa: p.e }); guardarBorrador();
      }, { prefer: enServicio, libre: () => { arr[i][k + "Leg"] = ""; arr[i][k + "Emp"] = ""; if (chip) chip.innerHTML = ""; } });
    });
  }
  const chipPersona = (p) => p && p.legajo ? `<span class="leg">Leg. ${esc(p.legajo)}</span><span class="emp ${esc(p.empresa)}">${esc(p.empresa || "—")}</span>` : "";

  /* ----------------------- formulario ----------------------- */
  const opts = (arr, v) => arr.map((x) => `<option${x === v ? " selected" : ""}>${esc(x)}</option>`).join("");
  const optsVacio = (arr, v) => `<option value=""></option>` + opts(arr, v);

  function pintarForm() {
    const m = S.m, s = S.serv;
    $("#form").innerHTML = `
    <section class="card c-blue">
      <h2 class="ct"><span class="ico">📋</span>Datos generales</h2>
      <div class="grid4">
        <label class="f">Fecha <span class="req">*</span><input type="date" id="fFecha" value="${esc(m.fecha)}"></label>
        <label class="f">Día<input id="fDia" readonly value="${esc(diaDe(m.fecha))}"></label>
        <label class="f">Turno <span class="req">*</span><select id="fTurno">${opts(["Diurno", "Nocturno"], m.turno)}</select></label>
        <label class="f">Horario<input id="fHorario" value="${esc(m.horario)}" placeholder="19:00 a 07:00"></label>
        <label class="f span2">Guardia / puesto que informa <small>(opcional)</small><input id="fGuardia" list="dlGuardia" value="${esc(m.guardia)}" placeholder="Ej: Guardia principal, Puesto 1, Bunker"></label>
        <label class="f span2">Jefe de servicio / Encargado que hace el informe <span class="req">*</span>
          <input id="fEncargado" value="${esc(m.encargado.nombre)}" placeholder="Escribí apellido o legajo y elegilo de la lista">
          <div class="sel-per" id="fEncChip">${chipPersona(m.encargado)}</div>
        </label>
        <label class="f span2">Supervisor <span class="req">*</span><select id="fSup"><option value="">Elegí el supervisor…</option>${(S.ses.supervisores || []).map((x) => `<option value="${esc(x.usuario)}"${x.usuario === m.supervisorUsuario ? " selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>
        <label class="f span2">Jefe de Operaciones<input readonly value="${esc(s.jefeOperaciones || "")}"></label>
      </div>
      <datalist id="dlGuardia">${["Guardia principal", "Guardia de ingreso", "Puesto 1", "Puesto 2", "Puesto 3", "Bunker", "CCTV"].map((x) => `<option value="${esc(x)}">`).join("")}</datalist>
    </section>

    <section class="card c-green">
      <h2 class="ct"><span class="ico">👥</span>Personal en servicio <small>· horas diurnas 06 a 21 · nocturnas 21 a 06</small></h2>
      <div class="rows" id="lPersonal"></div>
      <div class="tot" id="totPersonal"></div>
      <button class="add" data-add="personal">＋ Agregar persona</button>
    </section>

    <section class="card c-amber">
      <h2 class="ct"><span class="ico">🏖️</span>Francos y licencias</h2>
      <div class="rows" id="lAusentes"></div>
      <button class="add" data-add="ausentes">＋ Agregar franco / licencia</button>
    </section>

    <section class="card c-teal">
      <h2 class="ct"><span class="ico">🚙</span>Vehículos</h2>
      <div class="rows" id="lVehiculos"></div>
      <button class="add" data-add="vehiculos">＋ Agregar vehículo</button>
    </section>

    <section class="card c-violet">
      <h2 class="ct"><span class="ico">📻</span>Estado de equipos</h2>
      <div class="rows" id="lEquipos"></div>
      <button class="add" data-add="equipos">＋ Agregar equipo</button>
    </section>

    <section class="card c-indigo">
      <h2 class="ct"><span class="ico">🟢</span>Inicio de turno</h2>
      <div class="grid3">
        <label class="f">Hora de toma de servicio<input type="time" id="fHoraInicio" value="${esc(m.horaInicio)}"></label>
        <label class="f span2">Responsable<input id="fRespInicio" value="${esc(m.responsableInicio)}" placeholder="Quién toma el servicio"><div class="sel-per" id="fRespChip">${chipK(m, "responsableInicio")}</div></label>
        <label class="f span3">Detalle<textarea id="fDetInicio" rows="2">${esc(m.detalleInicio)}</textarea></label>
      </div>
    </section>

    <section class="card c-orange">
      <h2 class="ct"><span class="ico">🕒</span>Registro de novedades <small>· con hora</small></h2>
      <div class="rows" id="lNovedades"></div>
      <button class="add" data-add="novedades">＋ Agregar novedad</button>
    </section>

    <section class="card c-cyan">
      <h2 class="ct"><span class="ico">🚶</span>Recorridas / rondines</h2>
      <div class="rows" id="lRondines"></div>
      <button class="add" data-add="rondines">＋ Agregar recorrida</button>
    </section>

    <section class="card c-red">
      <h2 class="ct"><span class="ico">⚠️</span>Novedades relevantes / anomalías <small>· van destacadas en el mail</small></h2>
      <div id="lRelevantes"></div>
      <button class="add" data-add="relevantes">＋ Agregar anomalía</button>
    </section>

    <section class="card c-pink">
      <h2 class="ct"><span class="ico">📷</span>Registro fotográfico <small id="fotosCant"></small></h2>
      <div class="fotos" id="lFotos"></div>
      <input type="file" id="inCamara" accept="image/*" capture="environment" hidden>
      <input type="file" id="inArchivos" accept="image/*" multiple hidden>
    </section>

    <section class="card c-navy">
      <h2 class="ct"><span class="ico">🏁</span>Cierre de turno y firmas</h2>
      <div class="grid3">
        <label class="f">Hora de finalización<input type="time" id="fHoraFin" value="${esc(m.horaFin)}"></label>
        <label class="f span2">Se entrega la guardia a<input id="fEntregaA" value="${esc(m.entregaA)}" placeholder="Nombre de quien recibe"><div class="sel-per" id="fEntChip">${chipK(m, "entregaA")}</div></label>
        <label class="f span3">Observaciones finales<textarea id="fObsFin" rows="3">${esc(m.observacionesFinales)}</textarea></label>
      </div>
    </section>`;

    // Datos generales
    const on = (id, ev, fn) => { const el = $(id); el.addEventListener(ev, () => { fn(el.value); guardarBorrador(); }); };
    on("#fFecha", "change", (v) => { m.fecha = v; $("#fDia").value = diaDe(v); });
    on("#fTurno", "change", (v) => {
      const [vi, vf] = String(m.horario).split(/\s*a\s*/);
      m.turno = v; m.horario = turnoHorario(v); $("#fHorario").value = m.horario;
      const [hi, hf] = String(m.horario).split(/\s*a\s*/);
      // El personal que tenía el horario del turno anterior pasa al nuevo
      m.personal.forEach((p) => { if (!p.ingreso || p.ingreso === vi) p.ingreso = hi || p.ingreso; if (!p.egreso || p.egreso === vf) p.egreso = hf || p.egreso; });
      pintarPersonal();
      if (hi) { m.horaInicio = hi; $("#fHoraInicio").value = hi; }
      if (hf) { m.horaFin = hf; $("#fHoraFin").value = hf; }
    });
    on("#fHorario", "input", (v) => { m.horario = v; });
    on("#fGuardia", "input", (v) => { m.guardia = v; });
    on("#fHoraInicio", "change", (v) => { m.horaInicio = v; });
    on("#fRespInicio", "input", (v) => { m.responsableInicio = v; m.responsableInicioLeg = ""; m.responsableInicioEmp = ""; $("#fRespChip").innerHTML = ""; });
    on("#fSup", "change", (v) => { m.supervisorUsuario = v; });
    on("#fDetInicio", "input", (v) => { m.detalleInicio = v; });
    on("#fHoraFin", "change", (v) => { m.horaFin = v; });
    on("#fEntregaA", "input", (v) => { m.entregaA = v; m.entregaALeg = ""; m.entregaAEmp = ""; $("#fEntChip").innerHTML = ""; });
    on("#fObsFin", "input", (v) => { m.observacionesFinales = v; });
    autocompletar($("#fEncargado"), (p) => {
      m.encargado = { nombre: p.n, legajo: p.l, empresa: p.e };
      $("#fEncChip").innerHTML = chipPersona(m.encargado);
      if (!m.responsableInicio) { Object.assign(m, { responsableInicio: p.n, responsableInicioLeg: p.l, responsableInicioEmp: p.e }); $("#fRespInicio").value = p.n; $("#fRespChip").innerHTML = chipK(m, "responsableInicio"); }
      const enc = m.personal.find((x) => /encargado|jefe/i.test(x.puesto) && !x.nombre);
      if (enc) { enc.nombre = p.n; enc.legajo = p.l; enc.empresa = p.e; pintarPersonal(); }
      guardarBorrador();
    }, { prefer: enServicio, libre: () => { m.encargado = { nombre: "", legajo: "", empresa: "" }; $("#fEncChip").innerHTML = ""; } });
    autocompletar($("#fRespInicio"), (p) => { Object.assign(m, { responsableInicio: p.n, responsableInicioLeg: p.l, responsableInicioEmp: p.e }); $("#fRespChip").innerHTML = chipK(m, "responsableInicio"); guardarBorrador(); }, { prefer: enServicio });
    autocompletar($("#fEntregaA"), (p) => { Object.assign(m, { entregaA: p.n, entregaALeg: p.l, entregaAEmp: p.e }); $("#fEntChip").innerHTML = chipK(m, "entregaA"); guardarBorrador(); }, { prefer: () => [] });

    $$("#form [data-add]").forEach((b) => b.addEventListener("click", () => agregar(b.dataset.add)));
    pintarPersonal(); pintarAusentes(); pintarVehiculos(); pintarEquipos(); pintarNovedades(); pintarRondines(); pintarRelevantes(); pintarFotos();
  }

  function agregar(k) {
    const m = S.m, ult = m.personal[m.personal.length - 1] || {};
    const nuevos = {
      personal: { nombre: "", legajo: "", empresa: "", puesto: "Vigilador", ingreso: ult.ingreso || "", egreso: ult.egreso || "", observacion: "" },
      ausentes: { nombre: "", legajo: "", empresa: "", codigo: "F", observacion: "" },
      vehiculos: { vehiculo: "", dominio: "", datos: "", kmInicio: "", kmFin: "", combustible: "", vigilador: "" },
      equipos: { equipo: "", estado: "En condiciones", observaciones: "Sin novedad" },
      novedades: { hora: ahora(), seccion: (S.serv.secciones || [])[0] || "", personal: "", accion: "", detalle: "", resultado: "Sin novedad" },
      rondines: { inicio: ahora(), reporte: "", vigilador: "", sector: "", resultado: "Sin novedad", modo: "Caminando", fin: "", qr: false },
      relevantes: ""
    };
    m[k].push(nuevos[k]);
    guardarBorrador();
    ({ personal: pintarPersonal, ausentes: pintarAusentes, vehiculos: pintarVehiculos, equipos: pintarEquipos, novedades: pintarNovedades, rondines: pintarRondines, relevantes: pintarRelevantes })[k]();
    const cont = { personal: "#lPersonal", ausentes: "#lAusentes", vehiculos: "#lVehiculos", equipos: "#lEquipos", novedades: "#lNovedades", rondines: "#lRondines", relevantes: "#lRelevantes" }[k];
    const last = $(cont).lastElementChild; if (last) { const i = last.querySelector("input,textarea,select"); if (i) i.focus(); }
  }

  // Liga los campos [data-k] de cada fila al array del modelo
  function ligar(cont, arr, repintar, extra) {
    $$("[data-k]", cont).forEach((el) => {
      const i = +el.closest("[data-i]").dataset.i, k = el.dataset.k;
      const ev = el.tagName === "SELECT" || el.type === "checkbox" || el.type === "time" ? "change" : "input";
      el.addEventListener(ev, () => {
        arr[i][k] = el.type === "checkbox" ? el.checked : el.value;
        if (extra) extra(i, k, el);
        guardarBorrador();
      });
    });
    $$("[data-del]", cont).forEach((b) => b.addEventListener("click", () => {
      const i = +b.closest("[data-i]").dataset.i;
      arr.splice(i, 1); guardarBorrador(); repintar();
    }));
  }
  const cabFila = (n, titulo) => `<div class="rowh"><span class="rown">${n}</span><b style="font-size:13.5px">${esc(titulo || "")}</b><button class="rowx" data-del type="button">✕ Quitar</button></div>`;

  function horasHtml(p) {
    const h = calcHoras(p.ingreso, p.egreso);
    if (!h) return `<span class="hint">Poné ingreso y egreso para calcular las horas</span>`;
    return `<span class="hb t">⏱ ${fmtH(h.total)} h</span><span class="hb d">☀️ Diurnas ${fmtH(h.d)}</span><span class="hb n">🌙 Nocturnas ${fmtH(h.n)}</span>`;
  }
  function totalesPersonal() {
    let t = 0, d = 0, n = 0;
    S.m.personal.forEach((p) => { const h = calcHoras(p.ingreso, p.egreso); if (h) { t += h.total; d += h.d; n += h.n; } });
    $("#totPersonal").innerHTML = S.m.personal.length ? `<span>Total del turno:</span><span class="hb t">${fmtH(t)} h</span><span class="hb d">☀️ ${fmtH(d)}</span><span class="hb n">🌙 ${fmtH(n)}</span>` : "";
  }

  function pintarPersonal() {
    const cont = $("#lPersonal"), arr = S.m.personal;
    cont.innerHTML = arr.map((p, i) => `<div class="rowc" data-i="${i}">${cabFila(i + 1, p.puesto)}
      <div class="grid4">
        <label class="f span2">Apellido y nombre<input data-k="nombre" class="per" value="${esc(p.nombre)}" placeholder="Apellido o legajo…"><div class="sel-per">${chipPersona(p)}</div></label>
        <label class="f span2">Puesto<input data-k="puesto" list="dlPuestos" value="${esc(p.puesto)}"></label>
        <label class="f">Ingreso<input type="time" data-k="ingreso" value="${esc(p.ingreso)}"></label>
        <label class="f">Egreso<input type="time" data-k="egreso" value="${esc(p.egreso)}"></label>
        <label class="f span2">Observación<input data-k="observacion" value="${esc(p.observacion)}" placeholder="Ej: Guardia, refuerzo, llegó tarde…"></label>
      </div>
      <div class="horas">${horasHtml(p)}</div></div>`).join("") +
      `<datalist id="dlPuestos">${PUESTOS.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
    ligar(cont, arr, pintarPersonal, (i, k, el) => {
      if (k === "nombre") { arr[i].legajo = ""; arr[i].empresa = ""; el.parentNode.querySelector(".sel-per").innerHTML = ""; }
      if (k === "ingreso" || k === "egreso") { el.closest(".rowc").querySelector(".horas").innerHTML = horasHtml(arr[i]); totalesPersonal(); }
      if (k === "puesto") el.closest(".rowc").querySelector(".rowh b").textContent = el.value;
    });
    $$("input.per", cont).forEach((inp) => {
      const i = +inp.closest("[data-i]").dataset.i;
      autocompletar(inp, (p) => {
        Object.assign(arr[i], { nombre: p.n, legajo: p.l, empresa: p.e });
        inp.parentNode.querySelector(".sel-per").innerHTML = chipPersona(arr[i]); guardarBorrador();
      });
    });
    totalesPersonal();
  }

  function pintarAusentes() {
    const cont = $("#lAusentes"), arr = S.m.ausentes, cods = S.ses.codigos || [];
    cont.innerHTML = arr.length ? arr.map((p, i) => `<div class="rowc" data-i="${i}">${cabFila(i + 1)}
      <div class="grid4">
        <label class="f span2">Apellido y nombre<input data-k="nombre" class="per" value="${esc(p.nombre)}" placeholder="Apellido o legajo…"><div class="sel-per">${chipPersona(p)}</div></label>
        <label class="f">Condición<select data-k="codigo">${cods.map((c) => `<option value="${esc(c.codigo)}"${c.codigo === p.codigo ? " selected" : ""}>${esc(c.codigo + " · " + c.descripcion)}</option>`).join("")}</select></label>
        <label class="f">Observación<input data-k="observacion" value="${esc(p.observacion)}"></label>
      </div></div>`).join("") : `<div class="hint">Sin francos ni licencias cargados.</div>`;
    ligar(cont, arr, pintarAusentes, (i, k, el) => { if (k === "nombre") { arr[i].legajo = ""; arr[i].empresa = ""; el.parentNode.querySelector(".sel-per").innerHTML = ""; } });
    $$("input.per", cont).forEach((inp) => {
      const i = +inp.closest("[data-i]").dataset.i;
      autocompletar(inp, (p) => { Object.assign(arr[i], { nombre: p.n, legajo: p.l, empresa: p.e }); inp.parentNode.querySelector(".sel-per").innerHTML = chipPersona(arr[i]); guardarBorrador(); });
    });
  }

  // Km: acepta 141708, 141.708 o 141708,5
  const numKm = (x) => { const t = String(x == null ? "" : x).replace(/[^\d,]/g, "").replace(",", "."); return t ? parseFloat(t) : NaN; };
  const kmTotal = (v) => { const a = numKm(v.kmInicio), b = numKm(v.kmFin); return isFinite(a) && isFinite(b) && b >= a ? Math.round((b - a) * 10) / 10 : ""; };
  const kmTxt = (v) => { const a = numKm(v.kmInicio), b = numKm(v.kmFin); if (isFinite(a) && isFinite(b) && b < a) return "⚠️ Km fin menor que Km inicio"; const t = kmTotal(v); return t === "" ? "" : t.toLocaleString("es-AR") + " km"; };
  function buscarFlota(q) {
    const t = norm(q).replace(/[\s.-]/g, ""), propios = flotaDelServicio().map((v) => v.dominio);
    const lista = flota().filter((v) => !t || norm(v.dominio + nombreVehiculo(v) + v.color).replace(/[\s.-]/g, "").indexOf(t) >= 0);
    lista.sort((a, b) => (propios.indexOf(b.dominio) >= 0) - (propios.indexOf(a.dominio) >= 0) || a.dominio.localeCompare(b.dominio));
    return lista.slice(0, 30);
  }
  function pintarVehiculos() {
    const cont = $("#lVehiculos"), arr = S.m.vehiculos;
    cont.innerHTML = arr.length ? arr.map((v, i) => `<div class="rowc" data-i="${i}">${cabFila(i + 1, [v.dominio, v.vehiculo].filter(Boolean).join(" · "))}
      <div class="grid4">
        <label class="f">Patente / N°<input data-k="dominio" class="dom" value="${esc(v.dominio)}" placeholder="Escribí la patente" autocapitalize="characters"><div class="sel-per veh-datos">${esc(v.datos || "")}</div></label>
        <label class="f span3">Vehículo<input data-k="vehiculo" value="${esc(v.vehiculo)}" placeholder="Se completa con la patente"></label>
        <label class="f">Km inicio<input data-k="kmInicio" inputmode="numeric" value="${esc(v.kmInicio)}"></label>
        <label class="f">Km fin<input data-k="kmFin" inputmode="numeric" value="${esc(v.kmFin)}"></label>
        <label class="f">Recorrido total<input class="kmt" readonly value="${esc(kmTxt(v))}"></label>
        <label class="f">Combustible / carga<select data-k="combustible">${optsVacio(COMBUSTIBLE, v.combustible)}</select></label>
        <label class="f span4">Movilero<input data-k="vigilador" class="per2" value="${esc(v.vigilador)}" placeholder="Apellido o legajo…"><div class="sel-per">${chipK(v, "vigilador")}</div></label>
      </div></div>`).join("") : `<div class="hint">Sin vehículos.</div>`;
    const titulo = (el, v) => { el.closest(".rowc").querySelector(".rowh b").textContent = [v.dominio, v.vehiculo].filter(Boolean).join(" · "); };
    ligar(cont, arr, pintarVehiculos, (i, k, el) => {
      if (k === "kmInicio" || k === "kmFin") el.closest(".rowc").querySelector(".kmt").value = kmTxt(arr[i]);
      if (k === "dominio") {
        const f = enFlota(el.value);
        arr[i].datos = f ? datosVehiculo(f) : "";
        if (f) { arr[i].dominio = f.dominio; arr[i].vehiculo = nombreVehiculo(f); el.closest(".rowc").querySelector('[data-k="vehiculo"]').value = arr[i].vehiculo; }
        el.parentNode.querySelector(".veh-datos").textContent = arr[i].datos;
      }
      if (k === "dominio" || k === "vehiculo") titulo(el, arr[i]);
    });
    $$("input.dom", cont).forEach((inp) => {
      const i = +inp.closest("[data-i]").dataset.i;
      autocompletar(inp, (f) => {
        Object.assign(arr[i], { dominio: f.dominio, vehiculo: nombreVehiculo(f), datos: datosVehiculo(f) });
        const row = inp.closest(".rowc");
        row.querySelector('[data-k="vehiculo"]').value = arr[i].vehiculo; row.querySelector(".veh-datos").textContent = arr[i].datos;
        titulo(inp, arr[i]); guardarBorrador();
      }, { buscar: buscarFlota, valor: (f) => f.dominio,
        render: (f) => `<span class="ac-n">${esc(f.dominio)} <small style="font-weight:600">${esc(nombreVehiculo(f))}</small></span><span class="ac-m">${esc(datosVehiculo(f))}</span>` });
    });
    personasFila(cont, arr);
  }

  function pintarEquipos() {
    const cont = $("#lEquipos"), arr = S.m.equipos;
    cont.innerHTML = arr.length ? arr.map((q, i) => `<div class="rowc" data-i="${i}">${cabFila(i + 1)}
      <div class="grid4">
        <label class="f">Equipo<input data-k="equipo" value="${esc(q.equipo)}"></label>
        <label class="f">Estado<select data-k="estado">${opts(ESTADOS_EQ, q.estado)}</select></label>
        <label class="f span2">Observaciones<input data-k="observaciones" value="${esc(q.observaciones)}"></label>
      </div></div>`).join("") : `<div class="hint">Sin equipos.</div>`;
    ligar(cont, arr, pintarEquipos);
  }

  function pintarNovedades() {
    const cont = $("#lNovedades"), arr = S.m.novedades, secs = (S.serv.secciones || []).concat(["Otra"]);
    cont.innerHTML = arr.length ? arr.map((n, i) => `<div class="rowc" data-i="${i}">${cabFila(i + 1, n.hora ? n.hora + " hs" : "")}
      <div class="grid4">
        <label class="f">Hora<input type="time" data-k="hora" value="${esc(n.hora)}"></label>
        <label class="f">Sección<select data-k="seccion">${opts(secs.indexOf(n.seccion) < 0 && n.seccion ? secs.concat([n.seccion]) : secs, n.seccion)}</select></label>
        <label class="f">Personal<input data-k="personal" class="per2" value="${esc(n.personal)}" placeholder="Quién"><div class="sel-per">${chipK(n, "personal")}</div></label>
        <label class="f">Acción / evento<input data-k="accion" value="${esc(n.accion)}" placeholder="Ej: Ingreso, recorrido, cierre"></label>
        <label class="f span3">Detalle<textarea data-k="detalle" rows="2" placeholder="Qué pasó">${esc(n.detalle)}</textarea></label>
        <label class="f">Resultado<input data-k="resultado" value="${esc(n.resultado)}"></label>
      </div></div>`).join("") : `<div class="hint">Todavía no hay novedades. Tocá “Agregar novedad” (la hora se completa sola).</div>`;
    ligar(cont, arr, pintarNovedades, (i, k, el) => { if (k === "hora") el.closest(".rowc").querySelector(".rowh b").textContent = el.value ? el.value + " hs" : ""; });
    personasFila(cont, arr);
  }

  function pintarRondines() {
    const cont = $("#lRondines"), arr = S.m.rondines;
    cont.innerHTML = arr.length ? arr.map((r, i) => `<div class="rowc" data-i="${i}">${cabFila(i + 1)}
      <div class="grid4">
        <label class="f">Hora inicio<input type="time" data-k="inicio" value="${esc(r.inicio)}"></label>
        <label class="f">Hora de reporte<input type="time" data-k="reporte" value="${esc(r.reporte)}"></label>
        <label class="f">Hora fin<input type="time" data-k="fin" value="${esc(r.fin)}"></label>
        <label class="f">Modo<select data-k="modo">${opts(MODOS, r.modo)}</select></label>
        <label class="f span2">Vigilador<input data-k="vigilador" class="per2" value="${esc(r.vigilador)}" placeholder="Apellido o legajo…"><div class="sel-per">${chipK(r, "vigilador")}</div></label>
        <label class="f span2">Sector / lote<input data-k="sector" value="${esc(r.sector)}" placeholder="Ej: Perímetro, Lote 23, Todo el barrio"></label>
        <label class="f span3">Resultado<input data-k="resultado" value="${esc(r.resultado)}"></label>
        <label class="chk"><input type="checkbox" data-k="qr"${r.qr ? " checked" : ""}> Con marcación QR</label>
      </div></div>`).join("") : `<div class="hint">Sin recorridas cargadas.</div>`;
    ligar(cont, arr, pintarRondines);
    personasFila(cont, arr);
  }

  function pintarRelevantes() {
    const cont = $("#lRelevantes"), arr = S.m.relevantes;
    cont.innerHTML = arr.map((t, i) => `<div class="li-row" data-i="${i}"><input data-k="v" value="${esc(t)}" placeholder="Ej: Reflector quemado en ingreso puesto 2"><button class="rowx" data-del type="button">✕</button></div>`).join("");
    $$("[data-k]", cont).forEach((el) => el.addEventListener("input", () => { arr[+el.closest("[data-i]").dataset.i] = el.value; guardarBorrador(); }));
    $$("[data-del]", cont).forEach((b) => b.addEventListener("click", () => { arr.splice(+b.closest("[data-i]").dataset.i, 1); guardarBorrador(); pintarRelevantes(); }));
  }

  /* ----------------------- fotos ----------------------- */
  function pintarFotos() {
    const cont = $("#lFotos");
    cont.innerHTML = S.fotos.map((f, i) => `<div class="foto" data-i="${i}"><img src="${f.src}" alt=""><button type="button" data-del aria-label="Quitar">✕</button>
      <input data-k="d" value="${esc(f.descripcion)}" placeholder="Descripción de la foto"></div>`).join("") +
      (S.fotos.length < (CFG.FOTOS_MAX || 60) ? `<label class="foto-add" for="inCamara"><span>📷</span>Sacar foto<small class="hint">con la cámara del celular</small></label>
        <label class="foto-add adj" for="inArchivos"><span>📎</span>Adjuntar archivos<small class="hint">fotos de la galería o de la PC · podés elegir varias</small></label>` : "");
    $("#fotosCant").textContent = S.fotos.length ? "· " + S.fotos.length + " foto" + (S.fotos.length > 1 ? "s" : "") : "";
    $$("[data-k]", cont).forEach((el) => el.addEventListener("input", () => { S.fotos[+el.closest("[data-i]").dataset.i].descripcion = el.value; guardarBorrador(); }));
    $$("[data-del]", cont).forEach((b) => b.addEventListener("click", () => { S.fotos.splice(+b.closest("[data-i]").dataset.i, 1); guardarBorrador(); pintarFotos(); }));
    $("#inCamara").onchange = $("#inArchivos").onchange = async (e) => {
      const files = Array.from(e.target.files || []); e.target.value = "";
      if (!files.length) return;
      overlay("Preparando fotos…");
      for (const f of files) {
        if (S.fotos.length >= (CFG.FOTOS_MAX || 60)) { toast("Máximo " + CFG.FOTOS_MAX + " fotos por minuta.", true); break; }
        if (f.type && !/^image\//.test(f.type)) { toast("“" + f.name + "” no es una imagen: solo se pueden adjuntar fotos.", true); continue; }
        try { S.fotos.push({ src: await comprimir(f), descripcion: "" }); } catch (err) { toast("No se pudo leer “" + f.name + "”.", true); }
      }
      overlay(); guardarBorrador(); pintarFotos();
    };
  }
  function comprimir(file) {
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const max = CFG.FOTO_MAX_PX || 1400, k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", CFG.FOTO_CALIDAD || 0.75));
      };
      im.onerror = () => { URL.revokeObjectURL(url); mal(new Error("imagen")); };
      im.src = url;
    });
  }

  /* ----------------------- validar, armar datos ----------------------- */
  function titulo() {
    const f = isoAtxt(S.m.fecha).replace(/\//g, "-");
    return S.serv.servicio + " " + f + " " + S.m.turno + (S.m.guardia ? " - " + S.m.guardia : "");
  }
  function validar() {
    const m = S.m, err = [];
    if (!m.fecha) err.push("Falta la fecha.");
    if (!m.turno) err.push("Falta el turno.");
    if (!m.encargado.nombre) err.push("Elegí el jefe de servicio / encargado de la lista.");
    if (!m.supervisorUsuario) err.push("Elegí el supervisor.");
    m.vehiculos.forEach((v, i) => { if (/⚠️/.test(kmTxt(v))) err.push("Vehículo " + (i + 1) + ": el Km fin es menor que el Km inicio."); });
    const pers = m.personal.filter((p) => p.nombre.trim());
    if (!pers.length) err.push("Cargá al menos una persona en servicio.");
    m.personal.forEach((p, i) => {
      if (!p.nombre.trim()) return;
      if (!p.legajo) err.push("Personal " + (i + 1) + ": elegí a " + p.nombre + " de la lista (para que quede el legajo).");
      if (!calcHoras(p.ingreso, p.egreso)) err.push("Personal " + (i + 1) + ": falta ingreso o egreso.");
    });
    m.ausentes.forEach((p, i) => { if (p.nombre.trim() && !p.legajo) err.push("Francos " + (i + 1) + ": elegí a " + p.nombre + " de la lista."); });
    if (!m.horaInicio) err.push("Falta la hora de toma de servicio.");
    return err;
  }
  function datosParaGuardar() {
    const m = S.m, s = S.serv;
    return {
      idServicio: s.idServicio, servicio: s.servicio, direccion: s.direccion, localidad: s.localidad, empresa: s.empresa,
      fecha: isoAtxt(m.fecha), dia: diaDe(m.fecha), turno: m.turno, horario: m.horario, guardia: m.guardia.trim(), titulo: titulo(),
      supervisor: ((S.ses.supervisores || []).find((x) => x.usuario === m.supervisorUsuario) || s.supervisor).nombre, supervisorUsuario: m.supervisorUsuario,
      jefeOperaciones: s.jefeOperaciones, encargado: m.encargado,
      personal: m.personal.filter((p) => p.nombre.trim()).map((p) => { const h = calcHoras(p.ingreso, p.egreso) || { total: 0, d: 0, n: 0 }; return Object.assign({}, p, { horas: fmtH(h.total), diurnas: fmtH(h.d), nocturnas: fmtH(h.n) }); }),
      ausentes: m.ausentes.filter((p) => p.nombre.trim()).map((p) => Object.assign({}, p, { descripcion: ((S.ses.codigos || []).find((c) => c.codigo === p.codigo) || {}).descripcion || p.codigo })),
      vehiculos: m.vehiculos.filter((v) => v.vehiculo || v.dominio).map((v) => Object.assign({}, v, { kmTotal: kmTotal(v) })),
      equipos: m.equipos.filter((q) => q.equipo),
      horaInicio: m.horaInicio, responsableInicio: m.responsableInicio, responsableInicioLeg: m.responsableInicioLeg || "", responsableInicioEmp: m.responsableInicioEmp || "", detalleInicio: m.detalleInicio,
      novedades: m.novedades.filter((n) => n.detalle || n.accion).sort((a, b) => ordHora(a.hora) - ordHora(b.hora)),
      rondines: m.rondines.filter((r) => r.vigilador || r.sector || r.resultado).sort((a, b) => ordHora(a.inicio) - ordHora(b.inicio)),
      relevantes: m.relevantes.map((x) => x.trim()).filter(Boolean),
      horaFin: m.horaFin, entregaA: m.entregaA, entregaALeg: m.entregaALeg || "", entregaAEmp: m.entregaAEmp || "", observacionesFinales: m.observacionesFinales
    };
  }
  // Ordena horas dentro del turno (en el nocturno, las 01:00 van después de las 23:00)
  function ordHora(h) {
    const v = aMin(h); if (v == null) return 99999;
    const ini = aMin(S.m.horaInicio || String(S.m.horario).split(/\s*a\s*/)[0]) || 0;
    return v < ini - 60 ? v + 1440 : v;
  }

  /* ----------------------- guardar y enviar ----------------------- */
  const CC = { lista: [], nuevos: [] };
  $("#bGuardar").addEventListener("click", () => {
    const err = validar();
    if (err.length) { openModal(`<h2>⚠️ Falta completar</h2><ul>${err.map((e) => `<li>${esc(e)}</li>`).join("")}</ul><div class="row-end"><button class="btn" id="mOk">Entendido</button></div>`); $("#mOk").onclick = closeModal; return; }
    CC.lista = []; CC.nuevos = [];
    modalEnvio();
  });

  function modalEnvio() {
    const s = S.serv, ses = S.ses, m = S.m;
    const sup = (ses.supervisores || []).find((x) => x.usuario === m.supervisorUsuario);
    const fijos = [ses.usuario.nombre + " (el servicio)"].concat(sup ? [sup.nombre + " (supervisor)"] : []).concat(ses.fijos.map((p) => p.nombre));
    const contactos = s.contactos || [];
    openModal(`<h2>📨 Guardar y enviar la minuta</h2>
      <div class="hint"><b>${esc(titulo())}</b></div>
      <div class="sec-m">Le llega siempre a</div>
      <div class="chips">${fijos.map((x) => `<span class="chip lock">🔒 ${esc(x)}</span>`).join("")}</div>
      <div class="sec-m">Además, a <small class="hint">(intendente, auditor, cliente… · tocá para elegir)</small></div>
      <div class="chips" id="mGuardados"></div>
      <div class="chips" id="mChips"></div>
      <div class="grid3">
        <label class="f">Nombre<span class="ac"><input id="mNom" placeholder="Ej: Juan Pérez (intendente)" autocomplete="off"><div class="ac-list" id="mAc" hidden></div></span></label>
        <label class="f">Correo<input id="mMail" type="email" placeholder="correo@cliente.com" autocomplete="off"></label>
        <div style="display:flex;align-items:flex-end"><button class="btn teal" id="mAdd" type="button" style="width:100%">＋ Agregar</button></div>
      </div>
      <div class="hint">Los contactos nuevos quedan guardados para este servicio: la próxima vez aparecen arriba para elegirlos.</div>
      ${ses.modoPrueba ? `<div class="aviso">🧪 <b>Modo prueba:</b> el correo solo le llega a ${esc(ses.correoPrueba)}. El mail dice a quiénes se hubiera enviado.</div>` : ""}
      <div class="warn">🔒 Una vez guardada, la minuta no se puede modificar.</div>
      <div class="row-end"><button class="btn ghost" id="mCancel">Cancelar</button><button class="btn big" id="mEnviar">✅ Guardar y enviar</button></div>`);
    const elegido = (c) => CC.lista.some((x) => x.correo === norm(c.correo));
    const pintarGuardados = () => {
      $("#mGuardados").innerHTML = contactos.map((c, i) => `<button type="button" class="chip pick${elegido(c) ? " on" : ""}" data-g="${i}">${elegido(c) ? "✔" : "＋"} ${esc(c.nombre || c.correo)}</button>`).join("") || `<span class="hint">Todavía no hay contactos guardados para este servicio.</span>`;
      $$("#mGuardados [data-g]").forEach((b) => b.onclick = () => {
        const c = contactos[+b.dataset.g];
        if (elegido(c)) CC.lista = CC.lista.filter((x) => x.correo !== norm(c.correo)); else CC.lista.push({ nombre: c.nombre, correo: norm(c.correo) });
        pintarGuardados(); pintarChips();
      });
    };
    const pintarChips = () => {
      const nuevos = CC.lista.filter((c) => !contactos.some((x) => norm(x.correo) === c.correo));
      $("#mChips").innerHTML = nuevos.map((c) => `<span class="chip">${esc(c.nombre ? c.nombre + " · " : "")}${esc(c.correo)}<button data-q="${esc(c.correo)}" type="button">✕</button></span>`).join("");
      $$("#mChips [data-q]").forEach((b) => b.onclick = () => { CC.lista = CC.lista.filter((x) => x.correo !== b.dataset.q); CC.nuevos = CC.nuevos.filter((x) => x.correo !== b.dataset.q); pintarChips(); });
    };
    pintarGuardados(); pintarChips();
    const nom = $("#mNom"), mail = $("#mMail"), ac = $("#mAc");
    const sugerir = () => {
      const q = norm(nom.value); const it = contactos.filter((c) => !q || norm(c.nombre + " " + c.correo).indexOf(q) >= 0).slice(0, 20);
      if (!it.length || document.activeElement !== nom) { ac.hidden = true; return; }
      ac.innerHTML = it.map((c, i) => `<div class="ac-it" data-i="${i}"><span class="ac-n">${esc(c.nombre)}</span><span class="ac-m">${esc(c.correo)}</span></div>`).join(""); ac.hidden = false;
      ac.onmousedown = (e) => { const d = e.target.closest(".ac-it"); if (!d) return; e.preventDefault(); const c = it[+d.dataset.i]; nom.value = c.nombre; mail.value = c.correo; ac.hidden = true; agregarCc(); };
    };
    nom.addEventListener("input", sugerir); nom.addEventListener("focus", sugerir); nom.addEventListener("blur", () => setTimeout(() => { ac.hidden = true; }, 180));
    const agregarCc = () => {
      const correo = mail.value.trim().toLowerCase(), nombre = nom.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { toast("Poné un correo válido.", true); mail.focus(); return; }
      if (!CC.lista.some((c) => c.correo === correo)) CC.lista.push({ nombre: nombre, correo: correo });
      if (!contactos.some((x) => norm(x.correo) === correo) && !CC.nuevos.some((x) => x.correo === correo)) CC.nuevos.push({ nombre: nombre, correo: correo });
      nom.value = ""; mail.value = ""; pintarGuardados(); pintarChips();
    };
    $("#mAdd").onclick = agregarCc;
    mail.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); agregarCc(); } });
    $("#mCancel").onclick = closeModal;
    $("#mEnviar").onclick = () => { if (mail.value.trim()) { agregarCc(); if (mail.value.trim()) return; } enviar(m.supervisorUsuario); };
  }

  async function enviar(supUsuario) {
    const d = datosParaGuardar();
    closeModal();
    try {
      overlay("Armando el PDF…");
      const pdf = await window.MinutaPDF.build(d, S.fotos, { logoKtl: CFG.LOGO_PDF, logoCliente: S.serv.logoCliente || "", logoTexto: S.serv.logoTexto || "" });
      overlay("Guardando y enviando… (no cierres la app)");
      const fotos = S.fotos.map((f) => ({ descripcion: f.descripcion, b64: f.src.slice(f.src.indexOf("base64,") + 7) }));
      const r = await api("guardar", { data: d, pdfBase64: pdf.base64, fotos: fotos, supervisorTurno: supUsuario, cc: CC.lista.map((c) => c.correo), contactosNuevos: CC.nuevos }, 300000);
      // contactos nuevos quedan disponibles enseguida
      CC.nuevos.forEach((c) => { if (!S.serv.contactos.some((x) => norm(x.correo) === norm(c.correo))) S.serv.contactos.push(c); });
      // La guardia sigue: queda lista la minuta del turno siguiente (sin cerrar sesión)
      const sig = S.m.turno === "Diurno" ? { turno: "Nocturno", fecha: S.m.fecha } : { turno: "Diurno", fecha: sumarDias(S.m.fecha, 1) };
      borrarBorrador();
      S.m = minutaNueva(sig); S.fotos = []; $("#borradorAviso").hidden = true; pintarForm(); LS.set("minuta_op_scroll", "0"); window.scrollTo(0, 0);
      S.ultimoPdf = { blob: pdf.blob, nombre: r.titulo + ".pdf" };
      overlay();
      openModal(`<div class="ok-big"><div class="tick${r.errorCorreo ? " warn-t" : ""}">${r.errorCorreo ? "!" : "✓"}</div><h2>${r.errorCorreo ? "Minuta guardada, pero el correo no salió" : "¡Minuta guardada y enviada!"}</h2>
        <p class="hint">${esc(r.titulo)} · N° ${esc(r.idMinuta)}</p></div>
        ${r.errorCorreo ? `<div class="warn">El PDF y los datos quedaron guardados. Error del correo: ${esc(r.errorCorreo)}<br>Podés reintentar el envío ahora o después desde 📂 Informes.</div>` : ""}
        ${r.prueba && !r.errorCorreo ? `<div class="aviso">🧪 <b>Modo prueba:</b> el correo solo se envió a ${esc(r.enviadoA)}.</div>` : ""}
        <p style="font-size:13.5px">${r.prueba ? "<b>Cuando se active, va a ir a:</b><br>" : ""}<b>Para:</b> ${esc((r.to || []).join(", "))}<br><b>Copia:</b> ${esc((r.cc || []).join(", "))}</p>
        <div class="aviso">📝 Ya quedó abierta la minuta nueva del turno <b>${esc(sig.turno)}</b> (${esc(isoAtxt(sig.fecha))}) para seguir cargando.</div>
        <div class="row-end">${r.errorCorreo ? `<button class="btn orange" id="okRe">🔁 Reintentar envío</button>` : ""}<button class="btn ghost" id="okDl">⬇ Descargar</button><button class="btn teal" id="okVer">📄 Ver PDF</button><button class="btn big" id="okNueva">📝 Seguir</button></div>`);
      $("#okDl").onclick = () => descargar(S.ultimoPdf.blob, S.ultimoPdf.nombre);
      $("#okVer").onclick = () => verPdf(S.ultimoPdf.blob, r.titulo);
      $("#okNueva").onclick = closeModal;
      if ($("#okRe")) $("#okRe").onclick = () => reintentarCorreo(r.idMinuta);
      $("#resultados").dataset.ok = ""; $("#pResultados").dataset.ok = "";
    } catch (e) {
      overlay(); console.error(e);
      openModal(`<h2>❌ No se pudo guardar</h2><p>${esc(e.message)}</p><p class="hint">La minuta sigue cargada en el celular: revisá la conexión y volvé a tocar “Guardar y enviar”.</p><div class="row-end"><button class="btn" id="mOk">Entendido</button></div>`);
      $("#mOk").onclick = closeModal;
    }
  }

  $("#bLimpiar").addEventListener("click", () => {
    openModal(`<h2>🗑 Empezar de nuevo</h2><p>Se borra todo lo que cargaste en esta minuta (no afecta las minutas ya enviadas).</p>
      <div class="row-end"><button class="btn ghost" id="mNo">Cancelar</button><button class="btn red" id="mSi">Borrar y empezar</button></div>`);
    $("#mNo").onclick = closeModal;
    $("#mSi").onclick = () => { borrarBorrador(); S.m = minutaNueva(); S.fotos = []; $("#borradorAviso").hidden = true; closeModal(); pintarForm(); window.scrollTo(0, 0); };
  });

  /* ----------------------- PDF: ver y descargar ----------------------- */
  function descargar(blob, nombre) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  let pdfjsCarga = null;
  function cargarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsCarga) pdfjsCarga = new Promise((ok, mal) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; ok(window.pdfjsLib); };
      sc.onerror = () => { pdfjsCarga = null; mal(new Error("No se pudo cargar el visor de PDF (revisá la conexión).")); };
      document.head.appendChild(sc);
    });
    return pdfjsCarga;
  }
  // El PDF se muestra dentro de la app (en la APK de Android no se abren PDF en el navegador)
  async function verPdf(blob, tit) {
    openModal(`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><h2 style="margin:0;font-size:17px">📄 ${esc(tit)}</h2>
      <span style="display:flex;gap:6px"><button class="btn small ghost" id="pdfDl">⬇</button><button class="btn small" id="pdfVolver">Cerrar</button></span></div>
      <div id="pdfPaginas" style="display:flex;flex-direction:column;gap:10px"><p class="hint">Abriendo PDF…</p></div>`);
    $("#pdfVolver").onclick = closeModal;
    $("#pdfDl").onclick = () => descargar(blob, tit + ".pdf");
    try {
      const lib = await cargarPdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const cont = $("#pdfPaginas"); if (!cont) return; cont.innerHTML = "";
      const ancho = Math.max(280, cont.clientWidth || 340);
      for (let n = 1; n <= doc.numPages; n++) {
        const pag = await doc.getPage(n), v1 = pag.getViewport({ scale: 1 });
        const vp = pag.getViewport({ scale: (ancho / v1.width) * Math.min(2, window.devicePixelRatio || 1) });
        const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height; cont.appendChild(cv);
        await pag.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      }
    } catch (e) { const c = $("#pdfPaginas"); if (c) c.innerHTML = `<p class="hint">${esc(e.message || e)}</p>`; }
  }
  async function pdfDeMinuta(id) {
    const r = await api("pdf", { id: id }, 90000);
    const b = atob(r.base64), u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return { blob: new Blob([u], { type: "application/pdf" }), nombre: r.nombre };
  }

  /* ----------------------- informes / buscador ----------------------- */
  function iniciarBusqueda() {
    const d = new Date(); d.setDate(d.getDate() - 30);
    if (!$("#qDesde").value) $("#qDesde").value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (!$("#qHasta").value) $("#qHasta").value = hoyISO();
    if (!$("#qServ").value && S.ses.servicios.length > 1 && S.serv) $("#qServ").value = S.serv.idServicio;
    buscar();
  }
  $("#bBuscar").addEventListener("click", buscar);
  $("#qTexto").addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });

  async function buscar() {
    const q = $("#qTexto").value.trim();
    $("#resultados").innerHTML = `<div class="hint center"><div class="spin"></div>Buscando…</div>`; $("#resumenBusqueda").textContent = "";
    try {
      const r = await api("buscar", { q: q, desde: $("#qDesde").value, hasta: $("#qHasta").value, idServicio: S.ses.servicios.length > 1 ? $("#qServ").value : "" }, 90000);
      $("#resultados").dataset.ok = "1";
      $("#resumenBusqueda").textContent = r.total ? (r.total + " minuta" + (r.total > 1 ? "s" : "") + (r.total > r.items.length ? " (se muestran las " + r.items.length + " más nuevas)" : "")) : "";
      if (!r.items.length) { $("#resultados").innerHTML = `<div class="card c-navy center">No se encontraron minutas con esos datos.</div>`; return; }
      const toks = norm(q).split(" ").filter(Boolean);
      const marcar = (t) => { let h = esc(t); toks.forEach((k) => { if (k.length > 1) h = h.replace(new RegExp("(" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>"); }); return h; };
      $("#resultados").innerHTML = r.items.map((it, i) => `<div class="res ${esc(it.turno)}" data-i="${i}">
        <div class="res-top"><span class="res-f">${esc((it.dia ? it.dia + " " : "") + it.fecha)}</span><span class="tb ${esc(it.turno)}">${it.turno === "Nocturno" ? "🌙" : "☀️"} ${esc(it.turno)}</span>
          ${it.guardia ? `<span class="pill">${esc(it.guardia)}</span>` : ""}<span class="hint">N° ${esc(it.id)}</span>${it.sinCorreo ? `<span class="tb err">✉️ Correo no enviado</span>` : ""}</div>
        <div class="res-s">${S.ses.servicios.length > 1 ? "<b>" + esc(it.servicio) + "</b> · " : ""}Encargado: ${esc(it.encargado || "—")} · Supervisor: ${esc(it.supervisor || "—")}</div>
        ${it.relevantes ? `<div class="res-rel">⚠️ ${esc(it.relevantes)}</div>` : ""}
        ${it.coincide ? `<div class="res-co">🔎 ${marcar(it.coincide)}</div>` : ""}
        <div class="res-a"><button class="btn small teal" data-a="ver">📄 Ver PDF</button><button class="btn small ghost" data-a="dl">⬇ Descargar</button><button class="btn small orange" data-a="re">📨 Reenviar</button>${it.sinCorreo ? `<button class="btn small red" data-a="ri">🔁 Reintentar envío</button>` : ""}</div>
      </div>`).join("");
      $$("#resultados .res").forEach((el) => {
        const it = r.items[+el.dataset.i];
        el.querySelector('[data-a="ver"]').onclick = async () => { try { overlay("Abriendo PDF…"); const p = await pdfDeMinuta(it.id); overlay(); verPdf(p.blob, it.titulo || p.nombre.replace(/\.pdf$/i, "")); } catch (e) { overlay(); toast(e.message, true); } };
        el.querySelector('[data-a="dl"]').onclick = async () => { try { overlay("Preparando PDF…"); const p = await pdfDeMinuta(it.id); overlay(); descargar(p.blob, p.nombre); } catch (e) { overlay(); toast(e.message, true); } };
        el.querySelector('[data-a="re"]').onclick = () => reenviar(it);
        if (el.querySelector('[data-a="ri"]')) el.querySelector('[data-a="ri"]').onclick = () => reintentarCorreo(it.id);
      });
    } catch (e) { $("#resultados").innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
  }

  async function reintentarCorreo(id) {
    try {
      overlay("Enviando…");
      const r = await api("reintentarCorreo", { id: id }, 120000);
      overlay(); closeModal();
      toast(r.prueba ? "Modo prueba: se envió a " + r.enviadoA : "Enviada a " + r.to.concat(r.cc).join(", "));
      if ($("#resultados").dataset.ok) buscar();
    } catch (e) { overlay(); toast("No se pudo enviar: " + e.message, true); }
  }

  function reenviar(it) {
    const serv = S.ses.servicios.find((s) => String(s.idServicio) === String(it.idServicio)) || S.serv;
    const cont = (serv.contactos || []);
    openModal(`<h2>📨 Reenviar minuta</h2><div class="hint"><b>${esc(it.titulo || it.fecha)}</b></div>
      <label class="f" style="margin-top:10px">Correos <small>(separados por coma)</small><input id="rTo" placeholder="correo@cliente.com"></label>
      ${cont.length ? `<div class="sec-m">Contactos guardados</div><div class="chips">${cont.map((c, i) => `<button type="button" class="chip" data-c="${i}">＋ ${esc(c.nombre || c.correo)}</button>`).join("")}</div>` : ""}
      <div class="row-end"><button class="btn ghost" id="rNo">Cancelar</button><button class="btn orange" id="rSi">Reenviar</button></div>`);
    $$("[data-c]").forEach((b) => b.onclick = () => { const c = cont[+b.dataset.c], i = $("#rTo"); i.value = (i.value.trim() ? i.value.trim().replace(/,$/, "") + ", " : "") + c.correo; });
    $("#rNo").onclick = closeModal;
    $("#rSi").onclick = async () => {
      const to = $("#rTo").value.split(/[,;\s]+/).filter(Boolean);
      if (!to.length) { toast("Poné al menos un correo.", true); return; }
      try { overlay("Enviando…"); const r = await api("reenviar", { id: it.id, to: to }, 90000); overlay(); closeModal(); toast(r.prueba ? "Modo prueba: se envió solo a " + r.enviadoA : "Reenviada a " + r.to.join(", ")); }
      catch (e) { overlay(); toast(e.message, true); }
    };
  }

  /* ----------------------- presentes de los servicios (supervisores y administración) ----------------------- */
  const EMPRESAS = ["PPQ", "KDE", "LEG", "LEGUYET"];
  let PRES = [];
  function prepararPresentes() {
    if (S.ses.cargaMinutas) return;
    $("#pServ").innerHTML = '<option value="">Todos</option>' + S.ses.servicios.map((s) => `<option value="${esc(s.idServicio)}">${esc(s.servicio)}</option>`).join("");
    $("#pEmp").innerHTML = '<option value="">Todas</option>' + EMPRESAS.map((e) => `<option>${e}</option>`).join("");
  }
  function iniciarPresentes() {
    const d = new Date(); d.setDate(d.getDate() - 7);
    if (!$("#pDesde").value) $("#pDesde").value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (!$("#pHasta").value) $("#pHasta").value = hoyISO();
    buscarPresentes();
  }
  $("#pBuscar").addEventListener("click", buscarPresentes);
  $("#pTexto").addEventListener("keydown", (e) => { if (e.key === "Enter") buscarPresentes(); });
  ["#pServ", "#pEmp", "#pTurno", "#pTodos"].forEach((id) => $(id).addEventListener("change", buscarPresentes));
  async function buscarPresentes() {
    $("#pResultados").innerHTML = `<div class="hint center"><div class="spin"></div>Buscando…</div>`; $("#pResumen").textContent = "";
    try {
      const r = await api("presentes", { q: $("#pTexto").value.trim(), desde: $("#pDesde").value, hasta: $("#pHasta").value, idServicio: $("#pServ").value,
        empresa: $("#pEmp").value, turno: $("#pTurno").value, soloPresentes: !$("#pTodos").checked }, 120000);
      PRES = r.items; $("#pResultados").dataset.ok = "1";
      let h = 0, hd = 0, hn = 0;
      const num = (x) => parseFloat(String(x || "0").replace(",", ".")) || 0;
      PRES.forEach((p) => { h += num(p.horas); hd += num(p.diurnas); hn += num(p.nocturnas); });
      const personas = new Set(PRES.map((p) => p.legajo + "|" + p.empresa)).size;
      $("#pResumen").innerHTML = r.total ? `<b>${r.total}</b> registro${r.total > 1 ? "s" : ""} · <b>${personas}</b> persona${personas > 1 ? "s" : ""} · <b>${fmtH(h)}</b> h (☀️ ${fmtH(hd)} · 🌙 ${fmtH(hn)})` + (r.total > PRES.length ? ` · se muestran ${PRES.length}` : "") : "";
      if (!PRES.length) { $("#pResultados").innerHTML = `<div class="card c-navy center">No hay presentes informados con esos datos.</div>`; return; }
      $("#pResultados").innerHTML = `<div class="tabla-wrap"><table class="tabla"><thead><tr><th>Fecha</th><th>Turno</th><th>Servicio</th><th>Legajo</th><th>Apellido y nombre</th><th>Emp.</th><th>Puesto</th><th>Ingreso</th><th>Egreso</th><th>Horas</th><th>☀️</th><th>🌙</th><th>Cód. / Obs.</th></tr></thead><tbody>` +
        PRES.map((p) => `<tr${p.codigo && !p.ingreso ? ' class="aus"' : ""}><td>${esc(p.fecha)}</td><td>${p.turno === "Nocturno" ? "🌙" : "☀️"} ${esc(p.turno)}</td><td>${esc(p.servicio)}</td><td class="c">${esc(p.legajo)}</td><td><b>${esc(p.nombre)}</b></td>
          <td class="c"><span class="emp ${esc(p.empresa)}">${esc(p.empresa)}</span></td><td>${esc(p.puesto)}</td><td class="c">${esc(p.ingreso)}</td><td class="c">${esc(p.egreso)}</td>
          <td class="c"><b>${esc(p.horas)}</b></td><td class="c">${esc(p.diurnas)}</td><td class="c">${esc(p.nocturnas)}</td><td>${esc([p.codigo, p.observacion].filter(Boolean).join(" · "))}</td></tr>`).join("") +
        `</tbody></table></div>`;
    } catch (e) { $("#pResultados").innerHTML = `<div class="warn">${esc(e.message)}</div>`; }
  }
  $("#pExcel").addEventListener("click", () => {
    if (!PRES.length) { toast("Primero buscá los presentes.", true); return; }
    const cols = [["fecha", "Fecha"], ["dia", "Día"], ["turno", "Turno"], ["servicio", "Servicio"], ["legajo", "Legajo"], ["nombre", "Apellido y nombre"], ["empresa", "Empresa"], ["puesto", "Puesto"],
      ["ingreso", "Ingreso"], ["egreso", "Egreso"], ["horas", "Horas"], ["diurnas", "Horas diurnas"], ["nocturnas", "Horas nocturnas"], ["codigo", "Código"], ["observacion", "Observación"], ["id", "N° minuta"]];
    const cel = (v) => { const t = String(v == null ? "" : v); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const csv = "﻿" + cols.map((c) => c[1]).join(";") + "\n" + PRES.map((p) => cols.map((c) => cel(p[c[0]])).join(";")).join("\n");
    descargar(new Blob([csv], { type: "text/csv;charset=utf-8" }), "Presentes de los servicios " + $("#pDesde").value + " a " + $("#pHasta").value + ".csv");
  });

  /* ----------------------- MODO DEMO ----------------------- */
  const DEMO_DB = {
    minutas: [],
    inicio: {
      ok: true,
      usuario: { nombre: "BARRIO SAN FRANCISCO", usuario: "demo", rol: "Servicios", correo: "guardia@ejemplo.com" },
      cargaMinutas: true, modoPrueba: true, correoPrueba: "fjacyno@ktl-seguridad.com",
      servicios: [
        { idServicio: "SFR", servicio: "BARRIO SAN FRANCISCO", direccion: "Aristóbulo del Valle 5155, Dique Luján", localidad: "Benavídez", empresa: "PPQ",
          supervisor: { nombre: "Gerardo Vica", usuario: "gvica", correo: "" }, jefeOperaciones: "Gustavo San Martin", horarioDiurno: "07:00 a 19:00", horarioNocturno: "19:00 a 07:00",
          secciones: ["Novedades de CCTV", "Supervisores de KTL", "Llamados de AVVN", "Activación de doble validación y portones", "Otras novedades del servicio"],
          vehiculos: [{ vehiculo: "Fiat Strada", dominio: "OOL-102" }, { vehiculo: "Vehículo eléctrico", dominio: "4066" }],
          equipos: ["Vehículo eléctrico", "Celulares", "Equipos HT", "PC / CCTV"], logoCliente: "assets/logos/san-francisco.png", logoTexto: "",
          contactos: [{ nombre: "Juan Pérez (Administración)", correo: "juan.perez@ejemplo.com" }] }
      ],
      flota: [{ dominio: "OOL102", marca: "FIAT", modelo: "Fiat Strada Adv. 1.6", anio: "2015", color: "ROJO", empresa: "KDE", ubicacion: "SAN FRANCISCO" },
        { dominio: "AF055YL", marca: "TOYOTA", modelo: "Toyota Etios 4P XL", anio: "2021", color: "BLANCO", empresa: "LEGUYET", ubicacion: "FINCAS DE IRAOLA 2" },
        { dominio: "AF937GI", marca: "FIAT", modelo: "Fiat Cronos 1.3 Like", anio: "2023", color: "BLANCO", empresa: "PPQ", ubicacion: "GERARDO VICA" }],
      supervisores: [{ nombre: "Gerardo Vica", usuario: "gvica" }, { nombre: "Sergio Carabetta", usuario: "scarabetta" }, { nombre: "Daniel Cruz", usuario: "dcruz" }, { nombre: "Carlos Sandoval", usuario: "csandoval" }],
      fijos: [{ nombre: "Gustavo San Martin" }, { nombre: "Fernando Jacyno" }],
      personal: [
        { n: "SELTZER EMMANUEL SEBASTIAN", l: "310", e: "PPQ" }, { n: "ALDERETE ANDRES ALFONSO", l: "98", e: "PPQ" }, { n: "FLORES SEBASTIAN", l: "234", e: "PPQ" },
        { n: "CASTRO CARLOS", l: "88", e: "PPQ" }, { n: "FERNANDEZ ESTEFANIA", l: "302", e: "PPQ" }, { n: "DIAZ GERMAN", l: "289", e: "PPQ" },
        { n: "ARES EDUARDO MARCELO", l: "2248", e: "KDE" }, { n: "GIMENEZ MARTIN", l: "2233", e: "KDE" }, { n: "COMAN CRISTIAN", l: "1667", e: "KDE" },
        { n: "PAEZ CRISTIAN", l: "2275", e: "KDE" }, { n: "CABRAL SEBASTIAN ALBERTO", l: "1743", e: "KDE" }, { n: "CANDAL VERONICA", l: "210", e: "PPQ" },
        { n: "PEREZ DANIEL", l: "20", e: "PPQ" }, { n: "PEREZ ALEJO AGUSTIN", l: "2273", e: "KDE" }, { n: "ACOSTA CESAR ALBERTO", l: "545", e: "LEG" }, { n: "OSORIO FABIO DIONISIO", l: "70", e: "LEGUYET" }
      ],
      codigos: [["F", "Franco"], ["FCO", "Franco"], ["VAC", "Vacaciones"], ["ENF", "Enfermedad"], ["ART", "ART"], ["INJ", "Injustificado"], ["LSG", "Licencia sin goce de sueldo"], ["DV", "Día del Vigilador"],
        ["SUS", "Suspendido"], ["NAC", "Nacimiento"], ["MAT", "Maternidad"], ["FALL", "Licencia por fallecimiento"], ["RES", "Reserva de puesto"], ["CAS", "Licencia por casamiento"], ["BAJA", "Baja"], ["PRAC", "Práctica"]].map((c) => ({ codigo: c[0], descripcion: c[1] }))
    }
  };
  async function demo(action, p) {
    await new Promise((r) => setTimeout(r, 300));
    if (action === "login") {
      if (p.usuario === "admin" && p.password === "admin") { DEMO_DB.rol = "admin"; return Object.assign({ token: "admin" }, DEMO_DB.inicio, { cargaMinutas: false, usuario: { nombre: "Administración (demo)", usuario: "admin", rol: "Administrador" } }); }
      if (p.usuario !== "demo" || p.password !== "demo") throw new Error("En modo demo: usuario demo / demo (servicio) o admin / admin (administración).");
      DEMO_DB.rol = "servicio"; return Object.assign({ token: "demo" }, DEMO_DB.inicio);
    }
    if (action === "inicio") return S.token === "admin" ? Object.assign({}, DEMO_DB.inicio, { cargaMinutas: false, usuario: { nombre: "Administración (demo)", usuario: "admin", rol: "Administrador" } }) : DEMO_DB.inicio;
    if (action === "presentes") {
      const t = norm(p.q).split(" ").filter(Boolean), out = [];
      DEMO_DB.minutas.forEach((x) => (x.d.personal.concat(p.soloPresentes ? [] : x.d.ausentes)).forEach((q) => {
        const it = { id: x.id, fecha: x.d.fecha, dia: x.d.dia, turno: x.d.turno, servicio: x.d.servicio, legajo: q.legajo, nombre: q.nombre, empresa: q.empresa, puesto: q.puesto,
          ingreso: q.ingreso || "", egreso: q.egreso || "", horas: q.horas || "", diurnas: q.diurnas || "", nocturnas: q.nocturnas || "", codigo: q.codigo || "", observacion: q.observacion || "" };
        if (p.empresa && it.empresa !== p.empresa) return; if (p.turno && it.turno !== p.turno) return;
        const h = norm(Object.values(it).join(" ")); if (t.every((k) => h.indexOf(k) >= 0)) out.push(it);
      }));
      return { ok: true, items: out, total: out.length };
    }
    if (action === "reintentarCorreo") return { ok: true, prueba: true, enviadoA: "fjacyno@ktl-seguridad.com", to: [], cc: [] };
    if (action === "guardar") {
      const id = "MO-" + String(DEMO_DB.minutas.length + 1).padStart(6, "0");
      const b = atob(p.pdfBase64), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      DEMO_DB.minutas.push({ id: id, d: p.data, pdf: u });
      return { ok: true, idMinuta: id, titulo: p.data.titulo, prueba: true, enviadoA: "fjacyno@ktl-seguridad.com", to: ["(demo) supervisor de turno"], cc: ["(demo) Gustavo San Martin", "(demo) Fernando"].concat(p.cc || []) };
    }
    if (action === "buscar") {
      const t = norm(p.q).split(" ").filter(Boolean);
      const items = DEMO_DB.minutas.filter((x) => { const h = norm(JSON.stringify(x.d)); return t.every((k) => h.indexOf(k) >= 0); })
        .map((x) => ({ sinCorreo: false, id: x.id, fecha: x.d.fecha, dia: x.d.dia, turno: x.d.turno, guardia: x.d.guardia, servicio: x.d.servicio, idServicio: x.d.idServicio, encargado: x.d.encargado.nombre, supervisor: x.d.supervisor, relevantes: x.d.relevantes.join(" | "), titulo: x.d.titulo }))
        .reverse();
      return { ok: true, items: items, total: items.length };
    }
    if (action === "pdf") {
      const x = DEMO_DB.minutas.find((y) => y.id === p.id); let s = ""; for (let i = 0; i < x.pdf.length; i += 0x8000) s += String.fromCharCode.apply(null, x.pdf.subarray(i, i + 0x8000));
      return { ok: true, base64: btoa(s), nombre: x.d.titulo + ".pdf" };
    }
    if (action === "reenviar") return { ok: true, to: p.to, prueba: true, enviadoA: "fjacyno@ktl-seguridad.com" };
    throw new Error("Acción demo desconocida");
  }

  arrancar();
})();
