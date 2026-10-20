/* ============================================================
   PDF "Minuta Operativa del Servicio" (A4) con pdf-lib.
   Junta los tres modelos: datos generales, personal, francos,
   vehículos, equipos, inicio, novedades, rondines, anomalías,
   fotos, cierre y firmas. Encabezado y pie en cada hoja.
   ============================================================ */
(function () {
  const K = 72 / 25.4;                 // mm -> puntos
  const PW = 595.28, PH = 841.89;      // A4
  const ML = 12, CW = 186;             // margen izq. y ancho útil (mm)
  const TOP = 36, BOT = 283;           // zona de contenido (mm)

  const HEX = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const COL = {
    navy: "#1F3864", blue: "#1E88E5", green: "#20A464", amber: "#D48806", teal: "#0E9AA7", violet: "#7B4BB7",
    indigo: "#3949AB", orange: "#EF6C00", cyan: "#00838F", red: "#D32F2F", pink: "#C2185B", ink: "#1B2A3A",
    muted: "#5D6B7A", line: "#C9D1DC", zebra: "#F5F7FA", white: "#FFFFFF"
  };

  // Helvetica estándar (WinAnsi): se sacan emojis y caracteres que no imprime
  const clean = (s) => String(s == null ? "" : s).replace(/\r/g, "").replace(/\t/g, "  ").replace(/[^\n -~¡-ÿ–—‘’“”•…€]/g, "");

  function b64ToBytes(b64) { const b = atob(b64), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function bytesToB64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
  async function embedImg(pdf, bytes) {
    if (!bytes) return null;
    try { return bytes[0] === 0x89 && bytes[1] === 0x50 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); } catch (e) { return null; }
  }
  async function traer(url) { if (!url) return null; try { const r = await fetch(url); if (!r.ok) return null; return new Uint8Array(await r.arrayBuffer()); } catch (e) { return null; } }

  async function build(d, fotos, opts) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setTitle(clean(d.titulo)); pdf.setAuthor("DelBen - Minuta Operativa"); pdf.setCreator("DelBen SGI");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const obli = await pdf.embedFont(StandardFonts.HelveticaOblique);
    const logoK = await embedImg(pdf, await traer(opts.logoKtl));
    const logoC = await embedImg(pdf, await traer(opts.logoCliente));
    const C = (h) => rgb.apply(null, HEX(h));
    const mix = (h, a) => { const c = HEX(h); return rgb(1 - (1 - c[0]) * a, 1 - (1 - c[1]) * a, 1 - (1 - c[2]) * a); };

    const pages = [];
    let pg, y;

    const W = (t, size, f) => (f || font).widthOfTextAtSize(clean(t), size) / K;
    const rect = (x, yy, w, h, o) => pg.drawRectangle(Object.assign({ x: x * K, y: PH - (yy + h) * K, width: w * K, height: h * K }, o));
    const line = (x1, y1, x2, y2, th, col) => pg.drawLine({ start: { x: x1 * K, y: PH - y1 * K }, end: { x: x2 * K, y: PH - y2 * K }, thickness: (th || 0.25) * K, color: col || C(COL.line) });
    const text = (t, x, yy, size, o) => {
      o = o || {}; const f = o.f || font; t = clean(t);
      let xx = x; if (o.align === "center") xx = x - W(t, size, f) / 2; else if (o.align === "right") xx = x - W(t, size, f);
      pg.drawText(t, { x: xx * K, y: PH - yy * K, size: size, font: f, color: o.color || C(COL.ink) });
    };
    function wrap(t, maxMm, size, f) {
      const out = [];
      clean(t).split("\n").forEach((par) => {
        if (!par.trim()) { out.push(""); return; }
        let cur = "";
        par.split(/\s+/).forEach((w) => {
          while (W(w, size, f) > maxMm) {              // palabra muy larga: se corta
            let k = w.length; while (k > 1 && W(w.slice(0, k), size, f) > maxMm) k--;
            if (cur) { out.push(cur); cur = ""; }
            out.push(w.slice(0, k)); w = w.slice(k);
          }
          const prueba = cur ? cur + " " + w : w;
          if (W(prueba, size, f) <= maxMm) cur = prueba; else { if (cur) out.push(cur); cur = w; }
        });
        if (cur) out.push(cur);
      });
      return out.length ? out : [""];
    }
    const fit = (img, maxW, maxH) => { const r = Math.min(maxW / img.width, maxH / img.height); return { w: img.width * r, h: img.height * r }; };

    function encabezado() {
      // logos
      if (logoK) { const s = fit(logoK, 34 * K, 17 * K); pg.drawImage(logoK, { x: ML * K, y: PH - 8 * K - s.h, width: s.w, height: s.h }); }
      if (logoC) {
        const sub = clean(opts.logoTexto || "").toUpperCase();
        const s = fit(logoC, 40 * K, (sub ? 13 : 19) * K);
        pg.drawImage(logoC, { x: (ML + CW) * K - s.w, y: PH - 7 * K - s.h, width: s.w, height: s.h });
        if (sub) text(sub, ML + CW - s.w / K / 2, 7 + s.h / K + 4.2, 8.5, { align: "center", f: bold, color: C("#6C635A") });
      }
      const cx = ML + CW / 2;
      text("DTO. OPERACIONES", cx, 7.5, 6.5, { align: "center", f: bold, color: C(COL.muted) });
      text("MINUTA OPERATIVA DEL SERVICIO", cx, 13.5, 13, { align: "center", f: bold, color: C(COL.navy) });
      text(d.servicio, cx, 19.5, 10, { align: "center", f: bold, color: C(COL.orange) });
      text([d.dia, d.fecha, "Turno " + d.turno, d.horario ? "(" + d.horario + ")" : "", d.guardia ? "· " + d.guardia : ""].filter(Boolean).join("  "), cx, 24.5, 8.5, { align: "center", color: C(COL.muted) });
      // franja de colores
      const cols = [COL.amber, COL.orange, COL.red, COL.violet, COL.blue, COL.teal, COL.green];
      const sw = CW / cols.length;
      cols.forEach((c, i) => rect(ML + i * sw, 28.5, sw + 0.1, 1.6, { color: C(c) }));
    }
    function nuevaPagina() { pg = pdf.addPage([PW, PH]); pages.push(pg); encabezado(); y = TOP; }
    function lugar(h) { if (y + h > BOT) { nuevaPagina(); return true; } return false; }

    function titulo(t, color, cont) {
      lugar(15);
      rect(ML, y, CW, 6.8, { color: C(color) });
      rect(ML, y, 2.2, 6.8, { color: C(COL.navy), opacity: 0.35 });
      text((cont ? t + " (continuación)" : t).toUpperCase(), ML + 4.5, y + 4.8, 9.5, { f: bold, color: C(COL.white) });
      y += 8.6;
    }

    // Tabla con cortes de página (repite título y encabezados)
    function tabla(tit, color, cols, filas, o) {
      o = o || {};
      if (!filas.length) { if (o.vacio) { titulo(tit, color); text(o.vacio, ML + 2, y + 3.5, 8.5, { f: obli, color: C(COL.muted) }); y += 7; } return; }
      const fs = o.fs || 8.3, lh = fs * 0.43, pad = 1.4;
      const cab = () => {
        let x = ML; const hh = 6.2;
        rect(ML, y, CW, hh, { color: mix(color, 0.16) });
        cols.forEach((c) => { text(c.t, c.align === "center" ? x + c.w / 2 : x + pad, y + 4.2, 7.6, { f: bold, color: C(color), align: c.align === "center" ? "center" : undefined }); x += c.w; });
        line(ML, y + hh, ML + CW, y + hh, 0.4, C(color));
        y += hh;
      };
      titulo(tit, color); cab();
      filas.forEach((f, ri) => {
        const celdas = cols.map((c, ci) => wrap(f[ci], c.w - pad * 2, fs, c.bold ? bold : font));
        const h = Math.max.apply(null, celdas.map((l) => l.length)) * lh + pad * 2 + 0.6;
        if (y + h > BOT) { nuevaPagina(); titulo(tit, color, true); cab(); }
        if (f.resalta) rect(ML, y, CW, h, { color: mix(f.resalta, 0.1) });
        else if (ri % 2) rect(ML, y, CW, h, { color: C(COL.zebra) });
        let x = ML;
        celdas.forEach((ls, ci) => {
          const c = cols[ci];
          ls.forEach((l, li) => text(l, c.align === "center" ? x + c.w / 2 : x + pad, y + pad + lh * (li + 1) - 0.4, fs, { f: c.bold ? bold : font, align: c.align === "center" ? "center" : undefined, color: c.color ? C(c.color) : undefined }));
          x += c.w;
        });
        line(ML, y + h, ML + CW, y + h);
        y += h;
      });
      y += 3.5;
    }

    function claveValor(tit, color, pares) {
      titulo(tit, color);
      const colW = CW / 2, lw = 30, fs = 8.6;
      for (let i = 0; i < pares.length; i += 2) {
        const fila = [pares[i], pares[i + 1]].filter(Boolean);
        const alturas = fila.map((p) => wrap(p[1] || "-", colW - lw - 3, fs, bold).length * 3.7 + 2.6);
        const h = Math.max.apply(null, alturas);
        lugar(h);
        fila.forEach((p, k) => {
          const x = ML + k * colW;
          rect(x, y, lw, h, { color: mix(color, 0.12) });
          text(p[0], x + 1.6, y + 4.3, 7.6, { f: bold, color: C(color) });
          wrap(p[1] || "-", colW - lw - 3, fs, bold).forEach((l, li) => text(l, x + lw + 1.8, y + 4.3 + li * 3.7, fs, { f: bold }));
        });
        line(ML, y + h, ML + CW, y + h);
        y += h;
      }
      y += 3.5;
    }

    function parrafo(etq, txt, color) {
      const ls = wrap(txt || "-", CW - 4, 8.8);
      lugar(Math.min(ls.length, 3) * 4 + 6);
      if (etq) { text(etq, ML + 1, y + 3.6, 8, { f: bold, color: C(color || COL.navy) }); y += 5; }
      ls.forEach((l) => { lugar(4.2); text(l, ML + 2, y + 3.4, 8.8); y += 4.1; });
      y += 2.5;
    }

    const persona = (p) => p.nombre + (p.legajo ? "  (Leg. " + p.legajo + (p.empresa ? " · " + p.empresa : "") + ")" : "");

    /* ------------------------- contenido ------------------------- */
    nuevaPagina();

    claveValor("Datos generales", COL.blue, [
      ["Objetivo", d.servicio], ["Empresa", d.empresa],
      ["Dirección", [d.direccion, d.localidad].filter(Boolean).join(" - ")], ["Fecha", (d.dia ? d.dia + " " : "") + d.fecha],
      ["Turno", d.turno], ["Horario", d.horario],
      ["Supervisor", d.supervisor], ["Jefe de Operaciones", d.jefeOperaciones],
      ["Encargado / Jefe", persona(d.encargado)], ["Guardia", d.guardia || "-"]
    ]);

    const tot = d.personal.reduce((a, p) => { a.t += parseFloat(String(p.horas).replace(",", ".")) || 0; a.d += parseFloat(String(p.diurnas).replace(",", ".")) || 0; a.n += parseFloat(String(p.nocturnas).replace(",", ".")) || 0; return a; }, { t: 0, d: 0, n: 0 });
    const f2 = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
    const filasPers = d.personal.map((p) => [p.legajo, p.nombre, p.empresa, p.puesto, p.ingreso, p.egreso, p.horas, p.diurnas, p.nocturnas, p.observacion]);
    const filaTot = ["", "TOTAL DEL TURNO", "", "", "", "", f2(tot.t), f2(tot.d), f2(tot.n), ""]; filaTot.resalta = COL.green;
    tabla("Personal en servicio", COL.green, [
      { t: "Legajo", w: 13, align: "center" }, { t: "Apellido y nombre", w: 44, bold: true }, { t: "Emp.", w: 14, align: "center" }, { t: "Puesto", w: 21 },
      { t: "Ingreso", w: 13, align: "center" }, { t: "Egreso", w: 13, align: "center" }, { t: "Horas", w: 11, align: "center", bold: true },
      { t: "Diurn.", w: 11, align: "center" }, { t: "Noct.", w: 11, align: "center" }, { t: "Observación", w: 35 }
    ], filasPers.concat(d.personal.length > 1 ? [filaTot] : []));
    if (d.personal.length) { text("Horas diurnas: 06:00 a 21:00 hs  ·  Horas nocturnas: 21:00 a 06:00 hs", ML + 1, y - 1, 7, { f: obli, color: C(COL.muted) }); y += 3; }

    tabla("Francos y licencias", COL.amber, [
      { t: "Legajo", w: 16, align: "center" }, { t: "Apellido y nombre", w: 60, bold: true }, { t: "Empresa", w: 18, align: "center" },
      { t: "Condición", w: 44 }, { t: "Observación", w: 48 }
    ], d.ausentes.map((p) => [p.legajo, p.nombre, p.empresa, p.codigo + " - " + p.descripcion, p.observacion]));

    tabla("Vehículos", COL.teal, [
      { t: "Vehículo", w: 30, bold: true }, { t: "Dominio / N°", w: 22, align: "center" }, { t: "Km inicio", w: 20, align: "center" }, { t: "Km fin", w: 20, align: "center" },
      { t: "Total", w: 16, align: "center" }, { t: "GNC", w: 12, align: "center" }, { t: "Combustible", w: 26, align: "center" }, { t: "Vigilador", w: 40 }
    ], d.vehiculos.map((v) => [v.vehiculo, v.dominio, v.kmInicio, v.kmFin, v.kmTotal === "" ? "" : v.kmTotal + " km", v.gnc, v.combustible, v.vigilador]));

    tabla("Estado de equipos", COL.violet, [{ t: "Equipo", w: 56, bold: true }, { t: "Estado", w: 40 }, { t: "Observaciones", w: 90 }],
      d.equipos.map((q) => { const r = [q.equipo, q.estado, q.observaciones]; if (q.estado && q.estado !== "En condiciones") r.resalta = COL.red; return r; }));

    titulo("Inicio de turno", COL.indigo);
    claveValorSimple([["Hora de toma de servicio", d.horaInicio ? d.horaInicio + " hs" : "-"], ["Responsable", d.responsableInicio || "-"]], COL.indigo);
    parrafo("Detalle", d.detalleInicio, COL.indigo);

    // Novedades agrupadas por sección, en orden de hora
    const secciones = [];
    d.novedades.forEach((n) => { let g = secciones.find((s) => s.n === n.seccion); if (!g) { g = { n: n.seccion, l: [] }; secciones.push(g); } g.l.push(n); });
    if (!secciones.length) tabla("Registro de novedades", COL.orange, [], [], { vacio: "Sin novedades registradas." });
    secciones.forEach((s) => tabla(s.n || "Registro de novedades", COL.orange, [
      { t: "Hora", w: 14, align: "center", bold: true }, { t: "Personal", w: 34 }, { t: "Acción / evento", w: 32 }, { t: "Detalle", w: 76 }, { t: "Resultado", w: 30 }
    ], s.l.map((n) => [n.hora, n.personal, n.accion, n.detalle, n.resultado])));

    tabla("Recorridas / rondines", COL.cyan, [
      { t: "Inicio", w: 13, align: "center", bold: true }, { t: "Reporte", w: 14, align: "center" }, { t: "Vigilador", w: 34 }, { t: "Sector", w: 28 },
      { t: "Resultado", w: 52 }, { t: "Modo", w: 22 }, { t: "QR", w: 9, align: "center" }, { t: "Fin", w: 14, align: "center" }
    ], d.rondines.map((r) => [r.inicio, r.reporte, r.vigilador, r.sector, r.resultado, r.modo, r.qr ? "Sí" : "", r.fin]));

    // Anomalías
    if (d.relevantes.length) {
      titulo("Novedades relevantes / anomalías", COL.red);
      d.relevantes.forEach((t) => {
        const ls = wrap(t, CW - 10, 9, bold);
        const h = ls.length * 4.1 + 2.6;
        lugar(h);
        rect(ML, y, CW, h, { color: mix(COL.red, 0.08) });
        rect(ML, y, 1.4, h, { color: C(COL.red) });
        text("•", ML + 3.5, y + 4.3, 10, { f: bold, color: C(COL.red) });
        ls.forEach((l, i) => text(l, ML + 7, y + 4.3 + i * 4.1, 9, { f: bold, color: C("#8E1C14") }));
        y += h + 1.2;
      });
      y += 2.5;
    }

    // Fotos: 2 por fila
    const fotosOk = [];
    for (const f of fotos || []) {
      const img = await embedImg(pdf, b64ToBytes(f.src.slice(f.src.indexOf("base64,") + 7)));
      if (img) fotosOk.push({ img: img, desc: f.descripcion });
    }
    if (fotosOk.length) {
      titulo("Registro fotográfico", COL.pink);
      const cw = (CW - 6) / 2, ih = 66;
      for (let i = 0; i < fotosOk.length; i += 2) {
        const par = fotosOk.slice(i, i + 2);
        const capH = Math.max.apply(null, par.map((p) => wrap((i + par.indexOf(p) + 1) + ". " + (p.desc || ""), cw - 2, 8).length)) * 3.6 + 2;
        if (lugar(ih + capH + 4)) titulo("Registro fotográfico", COL.pink, true);
        par.forEach((p, k) => {
          const x = ML + k * (cw + 6);
          rect(x, y, cw, ih, { color: C(COL.zebra), borderColor: C(COL.line), borderWidth: 0.3 * K });
          const s = fit(p.img, (cw - 2) * K, (ih - 2) * K);
          pg.drawImage(p.img, { x: x * K + (cw * K - s.w) / 2, y: PH - (y + ih / 2) * K - s.h / 2, width: s.w, height: s.h });
          wrap((i + k + 1) + ". " + (p.desc || ""), cw - 2, 8).forEach((l, li) => text(l, x + 1, y + ih + 3.6 + li * 3.6, 8, { f: li ? font : bold, color: C(COL.muted) }));
        });
        y += ih + capH + 4;
      }
      y += 1;
    }

    // Cierre
    titulo("Cierre de turno", COL.navy);
    claveValorSimple([["Hora de finalización", d.horaFin ? d.horaFin + " hs" : "-"], ["Se entrega la guardia a", d.entregaA || "-"]], COL.navy);
    parrafo("Observaciones finales", d.observacionesFinales, COL.navy);

    // Firmas
    lugar(30);
    y += 12;
    const fw = 70;
    [[ML + 8, "Encargado de turno", d.encargado.nombre], [ML + CW - 8 - fw, "Recibe el turno", d.entregaA]].forEach((f) => {
      line(f[0], y, f[0] + fw, y, 0.4, C(COL.ink));
      text(f[2] || " ", f[0] + fw / 2, y + 4.5, 8.8, { align: "center", f: bold });
      text(f[1], f[0] + fw / 2, y + 8.6, 7.6, { align: "center", color: C(COL.muted) });
    });
    y += 12;

    function claveValorSimple(pares, color) {
      const colW = CW / pares.length, h = 7;
      lugar(h);
      pares.forEach((p, k) => {
        const x = ML + k * colW, lw = Math.min(colW * 0.48, W(p[0], 7.6, bold) + 4);
        rect(x, y, lw, h, { color: mix(color, 0.12) });
        text(p[0], x + 1.6, y + 4.6, 7.6, { f: bold, color: C(color) });
        text(wrap(p[1], colW - lw - 3, 8.8, bold)[0], x + lw + 1.8, y + 4.6, 8.8, { f: bold });
      });
      line(ML, y + h, ML + CW, y + h);
      y += h + 2.5;
    }

    // Pie de página
    const n = pages.length;
    pages.forEach((p, i) => {
      pg = p;
      line(ML, 288, ML + CW, 288, 0.3);
      text("DelBen · Sistema de Gestión Integral", ML, 292, 7, { color: C(COL.muted) });
      text(clean(d.titulo), ML + CW / 2, 292, 7, { align: "center", color: C(COL.muted) });
      text("Pág. " + (i + 1) + " de " + n, ML + CW, 292, 7, { align: "right", f: bold, color: C(COL.navy) });
    });

    const bytes = await pdf.save();
    return { bytes: bytes, base64: bytesToB64(bytes), blob: new Blob([bytes], { type: "application/pdf" }) };
  }

  window.MinutaPDF = { build: build };
})();
