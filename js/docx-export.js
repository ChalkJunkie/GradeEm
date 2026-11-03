/**
 * Grade’Em – Word-Export (.docx) der ausgefüllten Schülibögen
 * ===========================================================
 * A4 quer, ein Schüli pro Seite. Aufbau wie die Druckansicht:
 * kompakt (beste/schwächste Beschreibung + Kreuzspalten), vollständig (alle
 * Beschreibungen, Auswahl grau hinterlegt mit „X“) oder Matrix.
 *
 * Die docx-Bibliothek (https://docx.js.org, MIT) wird als Parameter übergeben,
 * damit dieselbe Funktion im Browser (vendor/docx.min.js) und in Node-Tests läuft.
 */
import {
  STUDENT_NOTE_LABEL, STUDENT_DEFINITION_LABEL, GRADE_NAMES, DEFINITIONS, FOOTNOTE_TEXT, FOOTNOTE_URL, parseRich,
} from './rubric.js';
import { cellParas, footnoteList } from './raster.js';
import { pointsOf } from './engine.js';
import { headerFields, sumText, critShort } from './sheet-data.js';

const PAGE_W = 16838;
const PAGE_H = 11906;
const MARGIN_X = 720;
const MARGIN_Y = 624;
const CONTENT_W = PAGE_W - 2 * MARGIN_X; // 15398

const FONT = 'Calibri';
const SIZE = 20; // 10 pt
const SIZE_SMALL = 17;
const SIZE_HEAD = 24;
const SIZE_TITLE = 30;

/** Prozentangaben → ganzzahlige DXA-Breiten mit exakter Summe. */
function widths(perc) {
  const total = perc.reduce((a, b) => a + b, 0);
  const out = perc.map((p) => Math.floor((p / total) * CONTENT_W));
  out[out.length - 1] += CONTENT_W - out.reduce((a, b) => a + b, 0);
  return out;
}

export function buildSheetsDocument(D, sheets) {
  const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
    VerticalAlign, BorderStyle, PageOrientation, TabStopType, ExternalHyperlink,
    TableLayoutType, SoftHyphen, UnderlineType, ShadingType,
  } = D;

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
  const margins = { top: 45, bottom: 45, left: 80, right: 80 };

  function runs(text, opts = {}) {
    return parseRich(text).map((part) => {
      const children = [];
      part.text.split('\u00AD').forEach((p, i) => {
        if (i > 0) children.push(new SoftHyphen());
        if (p) children.push(p);
      });
      return new TextRun({ children, bold: part.bold || !!opts.bold, size: opts.size || SIZE, font: FONT, italics: !!opts.italics });
    });
  }

  /** Markdown-Zelle → Absätze (Aufzählung mit „• “). */
  function mdParas(md, opts = {}) {
    const ps = cellParas(md);
    if (!ps.length) return [new Paragraph({ children: [] })];
    return ps.map((p, i) => new Paragraph({
      children: p.bullet ? [new TextRun({ text: '• ', size: opts.size || SIZE, font: FONT }), ...runs(p.text, opts)] : runs(p.text, opts),
      alignment: opts.alignment,
      indent: p.bullet ? { left: 160, hanging: 160 } : undefined,
      spacing: { before: 0, after: i < ps.length - 1 ? 40 : 0, line: 252 },
    }));
  }

  function plainParas(text, opts = {}) {
    return String(text || '').split(/\r?\n/).map((l) => new Paragraph({
      children: l ? [new TextRun({ text: l, size: opts.size || SIZE, font: FONT })] : [],
      spacing: { before: 0, after: 0, line: 252 },
    }));
  }

  function cell(children, width, opts = {}) {
    return new TableCell({
      children,
      width: { size: width, type: WidthType.DXA },
      verticalAlign: opts.vAlign || VerticalAlign.TOP,
      margins,
      shading: opts.shade ? { fill: 'D9D9D9', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    });
  }

  const xMark = () => new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'X', bold: true, size: 26, font: FONT })] });

  function labelParas(k, preferStudent = true) {
    const ps = [new Paragraph({ children: runs(`**${(preferStudent && k.schuelibogen) || k.name}**`) })];
    if (k.erlaeuterung) ps.push(new Paragraph({ children: [new TextRun({ text: k.erlaeuterung, size: SIZE_SMALL, font: FONT })] }));
    return ps;
  }

  function headerLine(s) {
    const fields = headerFields(s);
    const n = fields.length;
    const stops = fields.slice(1).map((_, i) => ({ type: TabStopType.LEFT, position: Math.round(6200 + (i * (CONTENT_W - 6200 - 2400)) / Math.max(1, n - 2)) }));
    const children = [];
    fields.forEach((f, i) => {
      if (i > 0) children.push(new TextRun({ text: '\t', size: SIZE_HEAD, font: FONT }));
      children.push(new TextRun({ text: `${f.label}: `, bold: true, size: SIZE_HEAD, font: FONT }));
      const txt = f.value ? ` ${f.value} ` : '';
      children.push(new TextRun({ text: txt + '\u00A0'.repeat(Math.max(0, (f.kind === 'name' ? 30 : 12) - txt.length)), size: SIZE_HEAD, font: FONT, underline: { type: UnderlineType.SINGLE } }));
    });
    return new Paragraph({ tabStops: stops, spacing: { before: 100, after: 160 }, children });
  }

  function kompaktTable(s) {
    const r = s.raster;
    const n = r.stufen.length;
    const comment = r.meta.kommentarspalte;
    const marks = r.stufen.map((st) => (r.stufen.some((x) => x.kreuz) ? st.kreuz : st.name));
    const w = widths(comment ? [10.83, 22.38, ...marks.map(() => 19.48 / n), 16.25, 31.06] : [12, 34, ...marks.map(() => 20 / n), 34]);
    const head = new TableRow({
      tableHeader: true,
      children: [
        cell([new Paragraph({ children: [] })], w[0]),
        cell([new Paragraph({ children: [] })], w[1]),
        ...marks.map((mk, i) => cell([new Paragraph({ alignment: AlignmentType.CENTER, children: mk ? runs(mk) : [] })], w[2 + i], { vAlign: VerticalAlign.CENTER })),
        cell([new Paragraph({ children: [] })], w[2 + n]),
        ...(comment ? [cell([new Paragraph({ children: runs(`**${comment}**`) })], w[3 + n])] : []),
      ],
    });
    const rows = r.kriterien.map((k, i) => {
      const c = s.crit[i];
      return new TableRow({
        cantSplit: true,
        children: [
          cell(labelParas(k), w[0]),
          cell(mdParas(k.cells[0]), w[1]),
          ...r.stufen.map((_, l) => cell([new Paragraph({ alignment: AlignmentType.CENTER, children: c.sel.includes(l) ? [new TextRun({ text: 'X', bold: true, size: 28, font: FONT })] : [] })], w[2 + l], { vAlign: VerticalAlign.CENTER })),
          cell(mdParas(k.cells[n - 1]), w[2 + n]),
          ...(comment ? [cell(plainParas(c.comment), w[3 + n])] : []),
        ],
      });
    });
    return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders, rows: [head, ...rows] });
  }

  function fullTable(s) {
    const r = s.raster;
    const n = r.stufen.length;
    const comment = r.meta.kommentarspalte;
    const cw = (100 - 14 - (comment ? 17 : 0)) / n;
    const w = widths([14, ...r.stufen.map(() => cw), ...(comment ? [17] : [])]);
    const unit = r.meta.einheit || 'P';
    const size = n > 5 ? SIZE_SMALL : SIZE;
    const head = new TableRow({
      tableHeader: true,
      children: [
        cell([new Paragraph({ children: runs(r.meta.spalte_kriterien || '', { size }) })], w[0]),
        ...r.stufen.map((st, i) => cell([new Paragraph({ children: runs(`**${st.name}**`, { size }) })], w[1 + i])),
        ...(comment ? [cell([new Paragraph({ children: runs(`**${comment}**`, { size }) })], w[1 + n])] : []),
      ],
    });
    const rows = r.kriterien.map((k, i) => {
      const c = s.crit[i];
      return new TableRow({
        cantSplit: true,
        children: [
          cell(labelParas(k), w[0]),
          ...r.stufen.map((st, l) => {
            const on = c.sel.includes(l);
            const ps = mdParas(k.cells[l], { size });
            if (on && r.meta.wertung === 'summe' && st.punkte.length > 1) ps.push(new Paragraph({ children: [new TextRun({ text: `(${pointsOf(r, l, c)} ${unit})`, size, font: FONT })] }));
            if (on) ps.push(xMark());
            return cell(ps, w[1 + l], { shade: on });
          }),
          ...(comment ? [cell(plainParas(c.comment, { size }), w[1 + n])] : []),
        ],
      });
    });
    return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders, rows: [head, ...rows] });
  }

  function matrixTable(s) {
    const r = s.raster;
    const z = s.crit[0].sel.length ? s.crit[0].sel[0] : -1;
    const sp = s.crit[1].sel.length ? s.crit[1].sel[0] : -1;
    const n = r.spalten.items.length;
    const w = widths([26, ...r.spalten.items.map(() => 74 / n)]);
    const rows = [];
    if (r.spalten.titel) {
      rows.push(new TableRow({ children: [new TableCell({ columnSpan: n + 1, margins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: runs(`**${r.spalten.titel}**`, { size: SIZE_SMALL }) })] })] }));
    }
    rows.push(new TableRow({
      tableHeader: true,
      children: [
        cell([new Paragraph({ children: runs(`**${r.matrix.corner || r.zeilen.titel || ''}**`, { size: SIZE_SMALL }) })], w[0]),
        ...r.spalten.items.map((it, i) => cell(mdParas(it.text, { size: SIZE_SMALL }), w[1 + i], { shade: i === sp })),
      ],
    }));
    r.zeilen.items.forEach((it, zi) => {
      rows.push(new TableRow({
        cantSplit: true,
        children: [
          cell(mdParas(it.text, { size: SIZE_SMALL }), w[0], { shade: zi === z }),
          ...r.spalten.items.map((_, si) => {
            const c = (r.matrix.cells[zi] || [])[si];
            const on = zi === z && si === sp;
            const ps = [new Paragraph({ alignment: AlignmentType.CENTER, children: c ? [new TextRun({ text: c.noten.map((x) => x.label).join('   '), bold: true, size: 24, font: FONT })] : [] })];
            if (c && c.punkte.length) ps.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.punkte.join('   '), size: SIZE, font: FONT })] }));
            if (on) ps.push(xMark());
            return cell(ps, w[1 + si], { vAlign: VerticalAlign.CENTER, shade: on });
          }),
        ],
      }));
    });
    return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders, rows });
  }

  function defTable() {
    const w = widths([10.83, ...GRADE_NAMES.map(() => 14.86)]);
    return new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: w,
      layout: TableLayoutType.FIXED,
      borders,
      rows: [
        new TableRow({ cantSplit: true, children: [cell([new Paragraph({ children: runs(STUDENT_NOTE_LABEL) })], w[0]), ...GRADE_NAMES.map((g, i) => cell([new Paragraph({ children: runs(g) })], w[i + 1]))] }),
        new TableRow({ cantSplit: true, children: [cell([new Paragraph({ children: runs(STUDENT_DEFINITION_LABEL) })], w[0]), ...DEFINITIONS.map((d, i) => cell([new Paragraph({ children: runs(d) })], w[i + 1]))] }),
      ],
    });
  }

  const gap = () => new Paragraph({ spacing: { before: 0, after: 0 }, children: [] });
  const small = (text, bold = false) => new Paragraph({ spacing: { before: 60, after: 0 }, children: runs(bold ? `**${text}**` : text, { size: SIZE_SMALL }) });

  const children = [];
  sheets.forEach((s, idx) => {
    const r = s.raster;
    const m = r.meta;
    children.push(new Paragraph({ pageBreakBefore: idx > 0, spacing: { before: 0, after: 40 }, children: runs(`**${m.titel_schuelibogen || m.titel}**`, { size: SIZE_TITLE }) }));
    if (m.untertitel) children.push(new Paragraph({ children: runs(m.untertitel, { size: SIZE_SMALL }) }));
    if (r.einleitung) children.push(...mdParas(r.einleitung, { size: SIZE_SMALL }));
    children.push(headerLine(s));
    if (m.typ === 'matrix') children.push(matrixTable(s));
    else if (m.schuelibogen === 'kompakt') children.push(kompaktTable(s));
    else children.push(fullTable(s));
    if (m.typ !== 'matrix' && m.wertung === 'summe') children.push(new Paragraph({ spacing: { before: 100 }, children: runs(`**${sumText(s)}**`) }));
    if (m.typ === 'matrix' || !m.kommentarspalte) {
      s.crit.forEach((c, i) => {
        if (!c.comment) return;
        const name = critShort(r, i);
        children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `Kommentar – ${name}: `, bold: true, size: SIZE, font: FONT }), new TextRun({ text: c.comment.replace(/\n+/g, ' / '), size: SIZE, font: FONT })] }));
      });
    }
    if (r.hinweise) {
      children.push(gap());
      children.push(...mdParas(r.hinweise, { size: SIZE_SMALL }));
    }
    for (const q of r.freitext) {
      children.push(new Paragraph({ spacing: { before: 120 }, children: runs(q) }));
      children.push(new Paragraph({ children: [new TextRun({ text: '_'.repeat(150), size: SIZE, font: FONT, color: '888888' })] }));
      children.push(new Paragraph({ children: [new TextRun({ text: '_'.repeat(150), size: SIZE, font: FONT, color: '888888' })] }));
    }
    if (r.fussnoten) footnoteList(r.fussnoten).forEach((f) => children.push(small(`${f.nr ? `${f.nr} ` : ''}${f.text}`)));
    if (m.notendefinitionen) {
      children.push(gap());
      children.push(defTable());
      children.push(new Paragraph({
        spacing: { before: 100, after: 0 },
        children: [
          new TextRun({ text: FOOTNOTE_TEXT, size: 16, font: FONT }),
          new ExternalHyperlink({ link: FOOTNOTE_URL, children: [new TextRun({ text: FOOTNOTE_URL, size: 16, font: FONT, color: '0563C1', underline: { type: UnderlineType.SINGLE } })] }),
        ],
      }));
    }
  });

  return new Document({
    creator: 'Grade’Em',
    title: sheets[0] ? sheets[0].raster.meta.titel : 'Schülibögen',
    description: 'Mündliche Noten – ausgefüllte Schülibögen',
    styles: { default: { document: { run: { font: FONT, size: SIZE } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_H, height: PAGE_W, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN_Y, bottom: MARGIN_Y, left: MARGIN_X, right: MARGIN_X },
        },
      },
      children,
    }],
  });
}

/** Erzeugt die .docx-Datei als Blob (Browser). */
export async function sheetsToDocxBlob(D, sheets) {
  return D.Packer.toBlob(buildSheetsDocument(D, sheets));
}
