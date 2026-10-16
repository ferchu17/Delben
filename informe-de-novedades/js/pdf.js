/* ============================================================
   Generador del PDF "Informe de Novedades" (A4) — réplica del modelo Word.
   - Encabezado con logo KTL en cada página, "Pág. X de N".
   - Texto en renglones rayados como el formulario.
   - Fotos: 4 por hoja, cada una ocupa un cuarto de página.
   Usa pdf-lib (window.PDFLib).
   ============================================================ */
(function () {
  const K = 72 / 25.4;               // mm -> puntos
  const PW = 595.28, PH = 841.89;    // A4 en puntos
  const ML = 20, CW = 170;           // margen izquierdo y ancho útil (mm)
  const HDR_Y = 8, HDR_H = 23;       // caja del encabezado (mm)
  const TOP = 36, BOT = 286;         // zona de contenido (mm)
  const ROW = 6.4;                   // alto de cada renglón (mm)

  function clean(s) {
    return String(s == null ? "" : s)
      .replace(/\r/g, "").replace(/\t/g, "  ")
      .replace(/[^\n -~¡-ÿ–—‘’“”•…€]/g, "");
  }

  function dataUrlToBytes(u) {
    const b = atob(u.slice(u.indexOf("base64,") + 7)), a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return a;
  }
  function bytesToBase64(bytes) {
    let s = ""; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  async function buildInformePdf(d, opts) {
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const logoBytes = new Uint8Array(await (await fetch(opts.logoUrl)).arrayBuffer());
    const logo = await pdf.embedJpg(logoBytes);

    const pages = [];
    let page, y;
    const black = rgb(0, 0, 0);

    const width = (t, size, f) => (f || font).widthOfTextAtSize(t, size) / K;           // mm
    const rect = (pg, x, yy, w, h, th) => pg.drawRectangle({ x: x * K, y: PH - (yy + h) * K, width: w * K, height: h * K, borderColor: black, borderWidth: (th || 0.25) * K });
    const line = (pg, x1, y1, x2, y2, th) => pg.drawLine({ start: { x: x1 * K, y: PH - y1 * K }, end: { x: x2 * K, y: PH - y2 * K }, thickness: (th || 0.25) * K, color: black });
    const text = (pg, t, x, yy, size, o) => {
      o = o || {}; const f = o.bold ? bold : font; t = String(t);
      let xx = x;
      if (o.align === "center") xx = x - width(t, size, f) / 2;
      else if (o.align === "right") xx = x - width(t, size, f);
      pg.drawText(t, { x: xx * K, y: PH - yy * K, size, font: f, color: black });
    };

    // ajuste de línea por palabras, midiendo con la fuente real
    function wrap(txt, maxMm, size) {
      const out = [];
      clean(txt).split("\n").forEach((par) => {
        if (!par.trim()) { out.push(""); return; }
        let cur = "";
        par.split(/\s+/).filter(Boolean).forEach((w) => {
          while (width(w, size) > maxMm) {                  // palabra más larga que el renglón
            let n = w.length; while (n > 1 && width(w.slice(0, n), size) > maxMm) n--;
            if (cur) { out.push(cur); cur = ""; }
            out.push(w.slice(0, n)); w = w.slice(n);
          }
          const t = cur ? cur + " " + w : w;
          if (width(t, size) <= maxMm) cur = t; else { out.push(cur); cur = w; }
        });
        out.push(cur);
      });
      return out;
    }

    // ---- Texto con negrita: personas "APELLIDO NOMBRE, legajo N, empresa X" ----
    const PERSONA = /(?<![\p{L}\d])\p{Lu}[\p{Lu}'’.-]*(?: \p{Lu}[\p{Lu}'’.-]*)*, legajo [^\s,;]+(?:, empresa \p{Lu}[\p{Lu}\d&-]*(?: \p{Lu}[\p{Lu}\d&-]*)*)?/gu;
    const wRun = (r, size) => width(r.t, size, r.b ? bold : font);
    const wWord = (w, size) => w.reduce((a, r) => a + wRun(r, size), 0);
    // Devuelve renglones; cada renglón es una lista de palabras y cada palabra una lista de tramos {t, b}.
    function wrapRich(txt, maxMm, size) {
      const out = [];
      clean(txt).split("\n").forEach((par) => {
        if (!par.trim()) { out.push([]); return; }
        const neg = new Array(par.length).fill(false); let m;
        PERSONA.lastIndex = 0;
        while ((m = PERSONA.exec(par))) for (let k = m.index; k < m.index + m[0].length; k++) neg[k] = true;
        const words = []; const re = /\S+/g; let w;
        while ((w = re.exec(par))) {
          const runs = []; let i = w.index;
          for (const ch of w[0]) { const b = neg[i]; const last = runs[runs.length - 1]; if (last && last.b === b) last.t += ch; else runs.push({ t: ch, b }); i += ch.length; }
          words.push(runs);
        }
        let cur = [], curW = 0; const sp = width(" ", size);
        words.forEach((wd) => {
          let ww = wWord(wd, size);
          if (ww > maxMm) {                                   // palabra más larga que el renglón: se corta por letras
            if (cur.length) { out.push(cur); cur = []; curW = 0; }
            let piece = [], pw = 0;
            wd.forEach((r) => Array.from(r.t).forEach((ch) => {
              const cw = width(ch, size, r.b ? bold : font);
              if (pw + cw > maxMm && piece.length) { out.push([piece]); piece = []; pw = 0; }
              const l = piece[piece.length - 1]; if (l && l.b === r.b) l.t += ch; else piece.push({ t: ch, b: r.b }); pw += cw;
            }));
            wd = piece; ww = pw;
          }
          if (!cur.length) { cur = [wd]; curW = ww; }
          else if (curW + sp + ww <= maxMm) { cur.push(wd); curW += sp + ww; }
          else { out.push(cur); cur = [wd]; curW = ww; }
        });
        out.push(cur);
      });
      return out;
    }
    function textRich(pg, words, x, yy, size) {
      let xx = x; const sp = width(" ", size);
      words.forEach((wd, i) => {
        if (i) xx += sp;
        wd.forEach((r) => { pg.drawText(r.t, { x: xx * K, y: PH - yy * K, size, font: r.b ? bold : font, color: black }); xx += wRun(r, size); });
      });
    }

    const newPage = () => { page = pdf.addPage([PW, PH]); pages.push(page); y = TOP; };
    newPage();

    // ---------- Datos de cabecera (página 1) ----------
    y = 43;
    text(page, "Informe de Novedades N° " + clean(d.numero || ""), ML + 1, y, 10.5);
    y += 8.5;
    const f = String(d.fecha || "").split("/");
    const fechaTxt = f.length === 3 ? f[0] + " / " + f[1] + " / " + f[2] : clean(d.fecha);
    text(page, "Fecha:  " + fechaTxt, ML + CW - 1, y, 10.5, { align: "right" });
    y += 8.5;

    function campo(label, valor) {
      const lw = width(label, 10.5) + 2, vx = ML + 1 + lw, vw = CW - 1 - lw - 1;
      const lines = wrap(String(valor || "").replace(/\n/g, " "), vw, 10.5);
      const arr = lines.length ? lines : [""];
      text(page, label, ML + 1, y, 10.5);
      arr.forEach((ln, i) => {
        if (i > 0) y += 6;
        text(page, ln, vx, y - 0.2, 10.5);
        line(page, vx - 1, y + 1.2, ML + CW - 1, y + 1.2, 0.15);
      });
      y += 8.2;
    }
    campo("De:", d.de);
    campo("Para:", (d.para || []).join("; "));
    campo("Asunto:", d.asunto);
    campo("Objetivo:", d.objetivo);
    y += 1.5;

    // ---------- Renglones ----------
    const ensure = (n) => { if (y + ROW * n > BOT) newPage(); };
    function fila(txt, o) {
      o = o || {};
      if (y + ROW > BOT) newPage();
      rect(page, ML, y, CW, ROW);
      if (Array.isArray(txt)) { if (txt.length) textRich(page, txt, ML + 1.5, y + ROW - 1.9, o.size || 10); }
      else if (txt) text(page, txt, ML + 1.5, y + ROW - 1.9, o.size || 10);
      y += ROW;
    }
    function lineas(texto) {
      const out = wrapRich(texto, CW - 3.5, 10);
      while (out.length && !out[out.length - 1].length) out.pop();
      return out;
    }

    fila("Día, Hora, Lugar del hecho, quien, qué, cómo y por qué:", { size: 10.5 });
    const nov = lineas(d.informe);
    nov.forEach((l) => fila(l));
    // renglones en blanco como el formulario (mínimo 14); si el texto es largo, 3 de aire
    const minNov = 14;
    if (nov.length < minNov) { for (let i = nov.length; i < minNov; i++) fila(""); }
    else { for (let i = 0; i < 3; i++) fila(""); }

    ensure(6);
    fila("Medidas Tomadas:", { size: 12 });
    const med = lineas(d.medidas);
    med.forEach((l) => fila(l));
    for (let i = med.length; i < 8; i++) fila("");

    // ---------- Fotos: 4 por hoja, un cuarto de página cada una ----------
    const fotos = (d.fotos || []).filter(Boolean);
    const GAP = 4, cw = (CW - GAP) / 2, ch = (BOT - TOP - GAP) / 2;
    for (let i = 0; i < fotos.length; i++) {
      if (i % 4 === 0) newPage();
      const k = i % 4, col = k % 2, rw = Math.floor(k / 2);
      const x = ML + col * (cw + GAP), yy = TOP + rw * (ch + GAP);
      rect(page, x, yy, cw, ch);
      const p = fotos[i], pad = 1.5;
      const img = await pdf.embedJpg(dataUrlToBytes(p.data));
      const r = Math.min((cw - 2 * pad) / p.w, (ch - 2 * pad) / p.h), w = p.w * r, h = p.h * r;
      page.drawImage(img, { x: (x + (cw - w) / 2) * K, y: PH - (yy + (ch + h) / 2) * K, width: w * K, height: h * K });
    }

    // ---------- Encabezado + numeración en todas las páginas ----------
    const total = pages.length;
    pages.forEach((pg, idx) => {
      const x0 = ML, y0 = HDR_Y, c1 = 52.5, c2 = 72, rx = x0 + c1 + c2;
      rect(pg, x0, y0, CW, HDR_H);
      line(pg, x0 + c1, y0, x0 + c1, y0 + HDR_H);
      line(pg, rx, y0, rx, y0 + HDR_H);
      line(pg, x0 + c1, y0 + 9.5, rx, y0 + 9.5);
      line(pg, rx, y0 + 9.5, x0 + CW, y0 + 9.5);
      line(pg, rx, y0 + 13.7, x0 + CW, y0 + 13.7);
      line(pg, rx, y0 + 17.9, x0 + CW, y0 + 17.9);
      const lh = 21, lw = lh * (logo.width / logo.height);
      pg.drawImage(logo, { x: (x0 + (c1 - lw) / 2) * K, y: PH - (y0 + (HDR_H + lh) / 2) * K, width: lw * K, height: lh * K });
      const cx = x0 + c1 + c2 / 2, rcx = rx + (CW - c1 - c2) / 2;
      text(pg, "Gestión Operativa", cx, y0 + 6, 8.5, { align: "center", bold: true });
      text(pg, "Informe de Novedades", cx, y0 + 15.2, 8.5, { align: "center", bold: true });
      text(pg, "Control de Documentos y Registros", cx, y0 + 19.6, 8, { align: "center" });
      text(pg, "Código", rcx, y0 + 5.2, 8.5, { align: "center", bold: true });
      text(pg, "Versión 00", rcx, y0 + 12.4, 7.5, { align: "center", bold: true });
      text(pg, "Pág. " + (idx + 1) + " de " + total, rcx, y0 + 21.4, 9, { align: "center" });
    });

    pdf.setTitle("Informe de Novedades N° " + clean(d.numero || ""));
    pdf.setProducer("Informe de Novedades");
    const bytes = await pdf.save();
    return { blob: new Blob([bytes], { type: "application/pdf" }), base64: bytesToBase64(bytes), pages: total };
  }

  window.buildInformePdf = buildInformePdf;
})();
