/**
 * Grade’Em – Druckansichten
 * =========================
 * Erzeugt druckfertige Seiten (A4) für
 *   • Schülibögen: 1 pro Seite (A4 quer), 2 pro Seite (A4 hoch), 4 pro Seite (A4 quer, kompakt)
 *   • Notenliste (A4 hoch oder quer, mehrere Seiten; eine oder mehrere Runden)
 * und eine Rasterübersicht für die Vorschau in der App.
 *
 * Bogenformen je nach Raster: kompakt (beste/schwächste Beschreibung + Kreuzspalten),
 * vollständig (alle Beschreibungen, Auswahl markiert) und Matrix.
 *
 * Die Druckseite hat keinen Rand (@page margin 0). Dadurch fügt der Browser keine
 * eigene Kopf-/Fußzeile (Adresse, Datum, Uhrzeit, Seitenzahl) hinzu. Den weißen Rand
 * legt jede .page selbst als Innenabstand an; die Notenliste wird dafür von der App
 * selbst auf Seiten verteilt (layoutLists).
 */
import {
  STUDENT_NOTE_LABEL, STUDENT_DEFINITION_LABEL, GRADE_NAMES, DEFINITIONS, FOOTNOTE_TEXT, FOOTNOTE_URL,
} from './rubric.js';
import { cellParas, footnoteList } from './raster.js';
import { pointsOf } from './engine.js';
import { headerFields, sumText, critShort, criteriaText } from './sheet-data.js';
import { esc, richHTML, h, icon } from './ui.js';

const MM = 96 / 25.4; // CSS-Pixel pro Millimeter

/** Markdown-Absätze/Aufzählungen → HTML */
export function parasHTML(md) {
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((t) => `<li>${richHTML(t)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const p of cellParas(md)) {
    if (p.bullet) list.push(p.text);
    else {
      flush();
      out.push(`<p>${richHTML(p.text)}</p>`);
    }
  }
  flush();
  return out.join('');
}

const cols = (arr) => `<colgroup>${arr.map((w) => `<col style="width:${w.toFixed(2)}%">`).join('')}</colgroup>`;

function headHTML(s) {
  const fields = headerFields(s);
  return `<div class="sheet__head">${fields.map((f) => `<span class="f f--${f.kind}"><b>${esc(f.label)}:</b><span class="v">${esc(f.value)}</span></span>`).join('')}</div>`;
}

function kompaktTable(s) {
  const r = s.raster;
  const n = r.stufen.length;
  const commentLabel = r.meta.kommentarspalte;
  const marks = r.stufen.map((st) => (r.stufen.some((x) => x.kreuz) ? st.kreuz : st.name));
  const w = commentLabel
    ? [10.83, 22.38, ...marks.map(() => 19.48 / n), 16.25, 31.06]
    : [12, 34, ...marks.map(() => 20 / n), 34];
  const head = `<tr><th></th><th></th>${marks.map((m) => `<th class="mark">${esc(m)}</th>`).join('')}<th></th>${commentLabel ? `<th>${richHTML(`**${commentLabel}**`)}</th>` : ''}</tr>`;
  const body = r.kriterien.map((k, i) => {
    const c = s.crit[i];
    const label = k.schuelibogen || k.name;
    const sec = k.abschnitt ? `<tr><th class="section" colspan="${n + 3 + (commentLabel ? 1 : 0)}">${esc(k.abschnitt)}</th></tr>` : '';
    return `${sec}<tr><td>${richHTML(`**${label}**`)}${k.erlaeuterung ? `<div class="erl">${esc(k.erlaeuterung)}</div>` : ''}</td>
      <td>${parasHTML(k.cells[0])}</td>
      ${r.stufen.map((_, l) => `<td class="mark">${c.sel.includes(l) ? 'X' : ''}</td>`).join('')}
      <td>${parasHTML(k.cells[n - 1])}</td>
      ${commentLabel ? `<td class="comment">${esc(c.comment)}</td>` : ''}</tr>`;
  }).join('');
  return `<table class="sheet__crit">${cols(w)}<thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function fullTable(s, { preview = false } = {}) {
  const r = s.raster;
  const n = r.stufen.length;
  const commentLabel = preview ? '' : r.meta.kommentarspalte;
  const labelW = 14;
  const commentW = commentLabel ? 17 : 0;
  const cellW = (100 - labelW - commentW) / n;
  const w = [labelW, ...r.stufen.map(() => cellW), ...(commentLabel ? [commentW] : [])];
  const unit = r.meta.einheit || 'P';
  const head = `<tr><th>${esc(r.meta.spalte_kriterien || '')}</th>${r.stufen.map((st) => `<th>${esc(st.name)}</th>`).join('')}${commentLabel ? `<th>${richHTML(`**${commentLabel}**`)}</th>` : ''}</tr>`;
  const body = r.kriterien.map((k, i) => {
    const c = s.crit ? s.crit[i] : { sel: [], pts: {}, comment: '' };
    const label = preview ? k.name : k.schuelibogen || k.name;
    const cells = r.stufen.map((st, l) => {
      const on = c.sel.includes(l);
      const pts = on && r.meta.wertung === 'summe' && st.punkte.length > 1 ? `<span class="pts">(${pointsOf(r, l, c)} ${esc(unit)})</span>` : '';
      return `<td class="${on ? 'sel' : ''}">${parasHTML(k.cells[l])}${pts}</td>`;
    }).join('');
    const sec = k.abschnitt ? `<tr><th class="section" colspan="${n + 1 + (commentLabel ? 1 : 0)}">${esc(k.abschnitt)}</th></tr>` : '';
    return `${sec}<tr><td>${richHTML(`**${label}**`)}${k.erlaeuterung ? `<div class="erl">${esc(k.erlaeuterung)}</div>` : ''}${r.meta.wertung === 'summe' && k.gewicht === 0 && !preview ? '<div class="erl">zählt nicht zur Summe</div>' : ''}</td>${cells}${commentLabel ? `<td class="comment">${esc(c.comment)}</td>` : ''}</tr>`;
  }).join('');
  return `<table class="sheet__crit sheet__crit--full">${cols(w)}<thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function matrixTable(s) {
  const r = s.raster;
  const z = s.crit && s.crit[0].sel.length ? s.crit[0].sel[0] : -1;
  const sp = s.crit && s.crit[1].sel.length ? s.crit[1].sel[0] : -1;
  const n = r.spalten.items.length;
  const w = [26, ...r.spalten.items.map(() => 74 / n)];
  const corner = r.matrix.corner || r.zeilen.titel || '';
  const axis = r.spalten.titel ? `<tr><th class="axis" colspan="${n + 1}">${esc(r.spalten.titel)}</th></tr>` : '';
  const head = `<tr><th class="corner">${esc(corner)}</th>${r.spalten.items.map((it, i) => `<th class="${i === sp ? 'sel-axis' : ''}">${parasHTML(it.text)}</th>`).join('')}</tr>`;
  const body = r.zeilen.items.map((it, zi) => `<tr><td class="${zi === z ? 'sel-axis' : ''}">${parasHTML(it.text)}</td>${r.spalten.items.map((_, si) => {
    const c = (r.matrix.cells[zi] || [])[si];
    const txt = c ? `<span class="grades">${esc(c.noten.map((x) => x.label).join('  '))}</span>${c.punkte.length ? `<span class="points">${esc(c.punkte.join('  '))}</span>` : ''}` : '';
    return `<td class="mx${zi === z && si === sp ? ' sel' : ''}">${txt}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="sheet__crit sheet__crit--matrix">${cols(w)}<thead>${axis}${head}</thead><tbody>${body}</tbody></table>`;
}

function commentsHTML(s) {
  const r = s.raster;
  if (r.meta.typ !== 'matrix' && r.meta.kommentarspalte) return '';
  const items = s.crit.map((c, i) => (c.comment ? `<p><b>${esc(critShort(r, i) === 'Zeile' || critShort(r, i) === 'Spalte' ? `Kommentar (${critShort(r, i)})` : `Kommentar – ${critShort(r, i)}`)}:</b> ${esc(c.comment)}</p>` : '')).filter(Boolean);
  return items.length ? `<div class="sheet__comments">${items.join('')}</div>` : '';
}

function definitionsHTML() {
  return `<table class="sheet__defs">${cols([10.83, ...GRADE_NAMES.map(() => 14.86)])}
      <tr><td>${richHTML(STUDENT_NOTE_LABEL)}</td>${GRADE_NAMES.map((g) => `<td>${richHTML(g)}</td>`).join('')}</tr>
      <tr><td>${richHTML(STUDENT_DEFINITION_LABEL)}</td>${DEFINITIONS.map((d) => `<td>${richHTML(d)}</td>`).join('')}</tr>
    </table>
    <p class="sheet__foot">${esc(FOOTNOTE_TEXT)}<a href="${esc(FOOTNOTE_URL)}">${esc(FOOTNOTE_URL)}</a></p>`;
}

/**
 * HTML eines ausgefüllten Schülibogens.
 * @param {object} s Ergebnis von buildSheet()
 * @param {{variant?:'full'|'half'|'compact'}} opt
 */
export function sheetHTML(s, { variant = 'full' } = {}) {
  const r = s.raster;
  const m = r.meta;
  const compact = variant === 'compact';
  const parts = [`<div class="sheet__title">${esc(m.titel_schuelibogen || m.titel)}</div>`];
  if (m.untertitel) parts.push(`<div class="sheet__sub">${esc(m.untertitel)}</div>`);
  if (!compact && r.einleitung) parts.push(`<div class="sheet__intro">${parasHTML(r.einleitung)}</div>`);
  parts.push(headHTML(s));
  if (m.typ === 'matrix') parts.push(matrixTable(s));
  else if (m.schuelibogen === 'kompakt') parts.push(kompaktTable(s));
  else parts.push(fullTable(s));
  if (m.typ !== 'matrix' && m.wertung === 'summe') parts.push(`<p class="sheet__sum">${esc(sumText(s))}</p>`);
  parts.push(commentsHTML(s));
  if (!compact) {
    if (r.hinweise) parts.push(`<div class="sheet__notes">${parasHTML(r.hinweise)}</div>`);
    if (r.freitext.length) parts.push(`<div class="sheet__free">${r.freitext.map((q) => `<div class="q"><p>${richHTML(q)}</p><div class="line"></div><div class="line"></div></div>`).join('')}</div>`);
    if (r.fussnoten) parts.push(`<div class="sheet__fn">${footnoteList(r.fussnoten).map((f) => `<p>${f.nr ? `<sup>${esc(f.nr)}</sup> ` : ''}${richHTML(f.text)}</p>`).join('')}</div>`);
    if (m.notendefinitionen) parts.push(definitionsHTML());
  }
  return `<div class="sheet${compact ? ' sheet--compact' : ''}">${parts.join('')}</div>`;
}

/** Übersicht eines Rasters (ohne Bewertung) für die Vorschau in der App. */
export function rasterOverviewHTML(r) {
  const s = { raster: r, crit: Array.from({ length: r.meta.typ === 'matrix' ? 2 : r.kriterien.length }, () => ({ sel: [], pts: {}, comment: '' })) };
  const m = r.meta;
  const parts = [`<div class="sheet__title">${esc(m.titel)}</div>`];
  if (m.untertitel) parts.push(`<div class="sheet__sub">${esc(m.untertitel)}</div>`);
  if (r.einleitung) parts.push(`<div class="sheet__intro">${parasHTML(r.einleitung)}</div>`);
  if (m.typ === 'matrix') parts.push(matrixTable(s));
  else {
    parts.push(fullTable(s, { preview: true }));
    const vals = r.stufen.map((st) => `${esc(st.name)}: ${m.wertung === 'summe' ? `${esc(st.punkteText)} ${esc(m.einheit || 'P')}` : `Note ${esc(st.noteText)}`}`).join(' · ');
    parts.push(`<p class="sheet__sum">${vals}</p>`);
    if (m.wertung === 'summe') {
      for (const u of r.umrechnungen) {
        parts.push(`<p class="sheet__sum"><b>Umrechnung${u.titel ? ` ${esc(u.titel)}` : ''}:</b> ${u.notenpunkte ? 'Summe = Notenpunkte' : u.rows.map((x) => `${esc(x.summeText)} → ${esc(x.noteText)}`).join(' · ')}</p>`);
      }
    } else {
      parts.push(`<p class="sheet__sum"><b>Gewichtung:</b> ${r.kriterien.map((k) => `${esc(k.name)} ${String(k.gewicht).replace('.', ',')}`).join(' · ')}</p>`);
    }
  }
  if (r.hinweise) parts.push(`<div class="sheet__notes">${parasHTML(r.hinweise)}</div>`);
  if (r.freitext.length) parts.push(`<div class="sheet__notes"><p><b>Freitextfelder:</b> ${r.freitext.map((q) => richHTML(q)).join(' · ')}</p></div>`);
  if (r.fussnoten) parts.push(`<div class="sheet__fn">${footnoteList(r.fussnoten).map((f) => `<p>${f.nr ? `<sup>${esc(f.nr)}</sup> ` : ''}${richHTML(f.text)}</p>`).join('')}</div>`);
  return `<div class="sheet sheet--preview">${parts.join('')}</div>`;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Ausgangsschriftgrößen je Layout (pt); bei Platzmangel wird automatisch verkleinert. */
const BASE_FS = { 1: 10.5, 2: 7.8, 4: 7.2 };

/**
 * Seiten für Schülibögen.
 * @param {object[]} sheets
 * @param {1|2|4} perPage
 */
export function buildSheetPages(sheets, perPage = 1) {
  const fs = BASE_FS[perPage] || BASE_FS[1];
  if (perPage === 2) {
    return {
      orientation: 'portrait',
      pages: chunk(sheets, 2).map((group) => `<div class="page page--portrait"><div class="slots slots--2">
        ${group.map((s) => `<div class="slot" data-fs="${fs}">${sheetHTML(s, { variant: 'half' })}</div>`).join('')}
        ${group.length < 2 ? '<div class="slot"></div>' : ''}
        <span class="cutmark" aria-hidden="true">✂</span></div></div>`),
    };
  }
  if (perPage === 4) {
    return {
      orientation: 'landscape',
      pages: chunk(sheets, 4).map((group) => {
        const slots = group.map((s) => `<div class="slot" data-fs="${fs}">${sheetHTML(s, { variant: 'compact' })}</div>`);
        while (slots.length < 4) slots.push('<div class="slot"></div>');
        return `<div class="page page--landscape"><div class="slots slots--4">${slots.join('')}
          <span class="cutmark cutmark--h" aria-hidden="true">✂</span><span class="cutmark cutmark--v" aria-hidden="true">✂</span></div></div>`;
      }),
    };
  }
  return {
    orientation: 'landscape',
    pages: sheets.map((s) => `<div class="page page--landscape" data-fs="${fs}">${sheetHTML(s)}</div>`),
  };
}

// ---------------------------------------------------------------------------
// Notenliste
// ---------------------------------------------------------------------------

/** Ab dieser Spaltenzahl wird die Notenliste quer gedruckt. */
const LIST_PORTRAIT_MAX_COLS = 11;

const isSumme = (r) => r.meta.typ !== 'matrix' && r.meta.wertung === 'summe';
const critN = (r) => (r.meta.typ === 'matrix' ? 2 : r.kriterien.length);

function finalHeadCells(scale) {
  return `${scale !== 'points' ? '<th>Endnote</th>' : ''}${scale !== 'quarter' ? '<th>Punkte</th>' : ''}`;
}

function finalCells(x, scale, extra = '') {
  const q = scale !== 'points';
  const p = scale !== 'quarter';
  const adj = x.adjusted ? '<span class="adj"> *</span>' : '';
  return `${q ? `<td class="list-final">${esc(x.finalQuarter)}${adj}</td>` : ''}${p ? `<td class="list-final">${esc(x.finalPoints)}${q ? '' : adj}</td>` : ''}${extra}`;
}

/** Erklärung unter einer Tabelle mit Kriterien. */
function explainText(r, weightsNote) {
  if (r.meta.typ === 'matrix') return 'Zeile/Spalte: gewählte Einschätzungen im Raster; berechnet: Mitte des Notenbereichs der Zelle.';
  if (isSumme(r)) return `Punkte je Kriterium; Note aus der Summe laut Umrechnungstabelle${weightsNote ? ` (${esc(weightsNote)})` : ''}.`;
  return `Zeilenwerte: Mittelwert der markierten Stufen. Berechnete Note: gewichteter Mittelwert${weightsNote ? ` (${esc(weightsNote)})` : ''}.`;
}

/** Tabelle einer Runde mit allen Kriterien. */
function roundTableHTML(list, r, scale) {
  const q = scale !== 'points';
  const summe = isSumme(r);
  const n = critN(r);
  const crit = Array.from({ length: n }, (_, i) => `<th class="kcol">${esc(critShort(r, i))}</th>`).join('');
  const head = `<tr><th>Nr.</th><th class="name">Name</th><th>Datum</th>${crit}${summe ? '<th>Summe</th>' : ''}<th>berechnet</th>${finalHeadCells(scale)}</tr>`;
  const rows = list.map((x, i) => {
    const calc = x.proposalDecimal ? `${x.proposalDecimal}${q ? ` (${esc(x.proposalQuarter)})` : ` (${x.proposalPoints} P)`}` : '';
    return `<tr><td>${i + 1}</td><td class="name">${esc(x.name)}</td><td>${esc(x.datum)}</td>
      ${x.rowTexts.map((t) => `<td>${esc(t)}</td>`).join('')}
      ${summe ? `<td>${esc(x.sum)}</td>` : ''}
      <td>${calc}${x.proposalDecimal && !x.complete ? '<span class="adj"> (unvollst.)</span>' : ''}</td>
      ${finalCells(x, scale)}</tr>`;
  }).join('');
  const cols = 3 + n + (summe ? 1 : 0) + 1 + (q ? 1 : 0) + (scale !== 'quarter' ? 1 : 0);
  return { html: `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`, cols };
}

/** Übersicht nur mit Endnoten: eine Zeile je Schüli, Spalten je Runde. */
function overviewTableHTML(rounds, scale) {
  const k = (scale !== 'points' ? 1 : 0) + (scale !== 'quarter' ? 1 : 0);
  const multi = rounds.length > 1;
  let head;
  if (!multi) {
    head = `<tr><th>Nr.</th><th class="name">Name</th>${finalHeadCells(scale)}</tr>`;
  } else {
    const top = rounds.map((rd) => `<th colspan="${k}">${esc(rd.title)}${rd.showRaster ? `<span class="sub">${esc(rd.rasterName)}</span>` : ''}</th>`).join('');
    head = `<tr><th rowspan="${k > 1 ? 2 : 1}">Nr.</th><th class="name" rowspan="${k > 1 ? 2 : 1}">Name</th>${top}</tr>`;
    if (k > 1) head += `<tr>${rounds.map(() => finalHeadCells(scale)).join('')}</tr>`;
  }
  const first = rounds[0].list;
  const rows = first.map((x0, i) => `<tr><td>${i + 1}</td><td class="name">${esc(x0.name)}</td>${rounds.map((rd) => finalCells(rd.list[i], scale)).join('')}</tr>`).join('');
  return { html: `<table><thead>${head}</thead><tbody>${rows}</tbody></table>`, cols: 2 + rounds.length * k };
}

/** Ein Block je Schüli: eine Zeile je Runde. */
function studentBlocksHTML(rounds, scale, criteria) {
  const first = rounds[0].list;
  const k = (scale !== 'points' ? 1 : 0) + (scale !== 'quarter' ? 1 : 0);
  const widths = criteria ? [17, 12, null, 9, ...Array(k).fill(8)] : [40, 20, ...Array(k).fill(40 / k)];
  const colgroup = `<colgroup>${widths.map((w) => (w ? `<col style="width:${w}%">` : '<col>')).join('')}</colgroup>`;
  const head = `<tr><th class="name">Runde</th><th>Datum</th>${criteria ? '<th class="name">Kriterien</th><th>berechnet</th>' : ''}${finalHeadCells(scale)}</tr>`;
  return first.map((x0, i) => {
    const rows = rounds.map((rd) => {
      const x = rd.list[i];
      return `<tr><td class="rd">${esc(rd.title)}${rd.showRaster ? `<span class="sub">${esc(rd.rasterName)}</span>` : ''}</td><td>${esc(x.datum)}</td>
        ${criteria ? `<td class="name crit-text">${esc(criteriaText(rd.raster, x))}</td><td>${esc(x.proposalDecimal)}</td>` : ''}
        ${finalCells(x, scale)}</tr>`;
    }).join('');
    return `<section class="list-block" data-keep="1"><h2>${esc(x0.name)}</h2><table>${colgroup}<thead>${head}</thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
}

function listPage({ orientation, meta, blocks, foot }) {
  const metaSpans = [
    ['Lerngruppe', meta.group],
    ['Klasse', meta.klasse],
    [meta.roundsLabel.includes(',') ? 'Runden' : 'Runde', meta.roundsLabel],
    ['Raster', meta.rasterLabel],
    ['Stand', meta.printed],
  ].filter(([, v]) => v).map(([k, v]) => `<span><b>${k}:</b> ${esc(v)}</span>`).join('');
  const run = `${meta.title} · ${meta.group} (Fortsetzung)`;
  return `<div class="page page--${orientation} page--list" data-run="${esc(run)}"><div class="list-sheet">
    <h1>${esc(meta.title)}</h1>
    <div class="list-meta">${metaSpans}</div>
    ${blocks}
    <div class="list-foot"><p>${foot}</p></div>
  </div></div>`;
}

const footText = (scale, extra = '') => `${extra ? `${extra} ` : ''}${scale !== 'quarter' ? 'Punkte = 17 − 3 × Note, gerundet. ' : ''}* = von der Lehrkraft nachgeschärft.`;

/**
 * Seite(n) der Notenliste einer Runde mit allen Kriterien.
 * @param {object[]} list Ergebnis von buildGradeList()
 * @param {{title, group, klasse, round, printed, scale, weightsNote, raster}} meta
 */
export function buildListPages(list, meta) {
  const r = meta.raster;
  const t = roundTableHTML(list, r, meta.scale);
  const orientation = t.cols > LIST_PORTRAIT_MAX_COLS ? 'landscape' : 'portrait';
  return {
    orientation,
    pages: [listPage({
      orientation,
      meta: { ...meta, roundsLabel: meta.round, rasterLabel: r.meta.fach },
      blocks: `<section class="list-block">${t.html}</section>`,
      foot: footText(meta.scale, explainText(r, meta.weightsNote)),
    })],
  };
}

/**
 * Notenliste über eine oder mehrere Runden.
 * @param {{title: string, raster: object, rasterName: string, weightsNote: string, list: object[]}[]} rounds
 *   je Runde die Liste aus buildGradeList(), alle mit denselben Schülis in derselben Reihenfolge
 * @param {{criteria: boolean, arrange: 'klasse'|'schueli', scale: string, title, group, klasse, printed}} opt
 */
export function buildRoundsPages(rounds, opt) {
  const { scale, criteria, arrange } = opt;
  const names = [...new Set(rounds.map((rd) => rd.rasterName))];
  const showRaster = names.length > 1;
  const rds = rounds.map((rd) => ({ ...rd, showRaster }));
  const meta = { ...opt, roundsLabel: rds.map((rd) => rd.title).join(', '), rasterLabel: showRaster ? '' : names[0] };
  let blocks;
  let cols;
  let foot;
  if (arrange === 'schueli' && rds.length > 1) {
    blocks = studentBlocksHTML(rds, scale, criteria);
    cols = 2 + (criteria ? 2 : 0) + (scale === 'both' ? 2 : 1);
    foot = footText(scale, criteria ? 'Kriterien: Zeilenwerte bzw. Punkte je Kriterium; berechnet: Note laut Raster vor dem Nachschärfen.' : '');
  } else if (criteria) {
    const tables = rds.map((rd) => ({ rd, t: roundTableHTML(rd.list, rd.raster, scale) }));
    cols = Math.max(...tables.map((x) => x.t.cols));
    blocks = tables.map(({ rd, t }) => `<section class="list-block">${rds.length > 1 ? `<h2>${esc(rd.title)}<span class="sub">${esc(rd.rasterName)}</span></h2>` : ''}${t.html}<p class="list-note">${explainText(rd.raster, rd.weightsNote)}</p></section>`).join('');
    foot = footText(scale);
  } else {
    const t = overviewTableHTML(rds, scale);
    cols = t.cols;
    blocks = `<section class="list-block">${t.html}</section>`;
    foot = footText(scale);
  }
  const orientation = cols > LIST_PORTRAIT_MAX_COLS ? 'landscape' : 'portrait';
  return { orientation, pages: [listPage({ orientation, meta, blocks, foot })] };
}

const LIST_FS = 10;
const LIST_MIN_FS = 6.5;

/** Verkleinert die Schrift der Notenliste, bis jede Tabelle in die Seitenbreite passt. */
function fitListWidth(page) {
  const sheet = page.querySelector('.list-sheet');
  if (!sheet) return true;
  let fs = LIST_FS;
  const wide = () => {
    const w = sheet.getBoundingClientRect().width;
    return sheet.scrollWidth > sheet.clientWidth + 1 || [...sheet.querySelectorAll('table')].some((t) => t.getBoundingClientRect().width > w + 1);
  };
  sheet.style.setProperty('--list-fs', `${fs}pt`);
  while (wide() && fs > LIST_MIN_FS) {
    fs -= 0.5;
    sheet.style.setProperty('--list-fs', `${fs}pt`);
  }
  return !wide();
}

function contentBox(page) {
  const cs = getComputedStyle(page);
  const rect = page.getBoundingClientRect();
  return { top: rect.top + parseFloat(cs.paddingTop), bottom: rect.bottom - parseFloat(cs.paddingBottom) };
}

/** Neue, leere Folgeseite mit kurzer Kopfzeile. */
function nextListPage(page, fid) {
  const next = page.cloneNode(false);
  next.dataset.flow = fid;
  const sheet = page.querySelector('.list-sheet').cloneNode(false);
  next.append(sheet);
  const run = document.createElement('div');
  run.className = 'list-run';
  run.textContent = page.dataset.run || '';
  sheet.append(run);
  page.after(next);
  return next;
}

/** Entfernt alles, was in einem Block nach der Tabelle steht. */
function dropAfterTable(table) {
  let n = table.nextElementSibling;
  while (n) {
    const x = n.nextElementSibling;
    n.remove();
    n = x;
  }
}

/**
 * Verteilt eine Notenliste auf so viele Seiten wie nötig. Tabellen werden zwischen
 * Zeilen geteilt (Kopf wird wiederholt), Blöcke je Schüli bleiben möglichst zusammen.
 * Jede Seite wird so lange nachgeprüft, bis sie passt – auch wenn sich nach dem Teilen
 * die Spaltenbreiten und damit die Zeilenhöhen ändern.
 * @returns {boolean} true, wenn alles vollständig auf die Seiten passt
 */
function flowList(first, fid) {
  first.dataset.flow = fid;
  first.querySelectorAll('.list-block').forEach((x, i) => { x.dataset.bid = String(i); });
  let page = first;
  for (let guard = 0; page && guard < 800; guard++) {
    const sheet = page.querySelector('.list-sheet');
    const box = contentBox(page);
    const limit = box.bottom + 0.5;
    const kids = [...sheet.children];
    const k = kids.findIndex((c) => c.getBoundingClientRect().bottom > limit);
    if (k < 0) {
      const nx = page.nextElementSibling;
      page = nx && nx.dataset.flow === fid ? nx : null;
      continue;
    }
    const c = kids[k];
    const hasBlockBefore = kids.slice(0, k).some((x) => x.classList.contains('list-block'));
    const isBlock = c.classList.contains('list-block');
    if (!isBlock && !hasBlockBefore) return false;
    let next = page.nextElementSibling;
    if (!(next && next.dataset.flow === fid)) next = nextListPage(page, fid);
    const nsheet = next.querySelector('.list-sheet');
    const run = nsheet.querySelector(':scope > .list-run');
    const anchor = run ? run.nextElementSibling : nsheet.firstElementChild;
    const cont = anchor && isBlock && anchor.dataset.bid === c.dataset.bid ? anchor : null;
    const rest = kids.slice(k + 1);
    const insert = (els, before) => els.forEach((e) => nsheet.insertBefore(e, before));
    if (!isBlock) {
      insert([c, ...rest], anchor);
      continue;
    }
    const table = c.querySelector('table');
    const rows = table && table.tBodies[0] ? [...table.tBodies[0].rows] : [];
    const idx = rows.findIndex((r) => r.getBoundingClientRect().bottom > limit);
    const freshAvail = box.bottom - box.top - 8 * MM;
    const keepWhole = c.dataset.keep && hasBlockBefore && c.getBoundingClientRect().height <= freshAvail;
    if (keepWhole || (idx === 0 && hasBlockBefore)) {
      if (cont) {
        // Der Anfang des Blocks rückt zu seiner Fortsetzung auf die nächste Seite
        cont.querySelector('table').tBodies[0].prepend(...rows);
        const mark = cont.querySelector('h2 .cont');
        if (mark) mark.remove();
        cont.classList.remove('is-cont');
        c.remove();
        insert(rest, cont.nextElementSibling);
      } else {
        insert([c, ...rest], anchor);
      }
    } else if (idx > 0) {
      const moving = rows.slice(idx);
      if (cont) {
        cont.querySelector('table').tBodies[0].prepend(...moving);
        insert(rest, cont.nextElementSibling);
      } else {
        const clone = c.cloneNode(true);
        clone.classList.add('is-cont');
        clone.querySelector('table').tBodies[0].replaceChildren(...moving);
        dropAfterTable(table);
        const h2 = clone.querySelector('h2');
        if (h2) h2.insertAdjacentHTML('beforeend', '<span class="sub cont">Fortsetzung</span>');
        insert([clone, ...rest], anchor);
      }
    } else if (idx < 0 && table && table.nextElementSibling) {
      // Alle Zeilen passen, nur der Text unter der Tabelle nicht
      const clone = c.cloneNode(true);
      clone.querySelectorAll('h2, table').forEach((x) => x.remove());
      dropAfterTable(table);
      insert([clone, ...rest], anchor);
    } else {
      return false; // eine einzelne Zeile ist höher als eine ganze Seite
    }
  }
  return !page;
}

/**
 * Bereitet alle Notenlisten in der Vorschau für den Druck vor: Breite anpassen,
 * auf Seiten verteilen, Seitenzahlen setzen.
 * @returns {number} Anzahl der Seiten, auf denen trotzdem etwas nicht passt
 */
export function layoutLists(root) {
  const firsts = [...root.querySelectorAll('.page--list')];
  if (!firsts.length) return 0;
  let bad = 0;
  firsts.forEach((page, i) => {
    if (!fitListWidth(page)) bad++;
    if (!flowList(page, `list${i}`)) bad++;
  });
  const all = [...root.querySelectorAll('.page--list')];
  if (all.length > 1) {
    all.forEach((p, i) => {
      const n = document.createElement('div');
      n.className = 'list-pageno';
      n.textContent = `Seite ${i + 1} von ${all.length}`;
      p.append(n);
    });
  }
  for (const p of all) {
    const sheet = p.querySelector('.list-sheet');
    if (p.scrollWidth > p.clientWidth + 1 || p.scrollHeight > p.clientHeight + 1 || sheet.scrollWidth > sheet.clientWidth + 1) bad++;
  }
  return bad;
}

/**
 * Verkleinert die Schrift eines Bogens schrittweise, bis er in seinen Rahmen passt.
 * @returns {number} Anzahl der Bögen, die auch verkleinert nicht vollständig passen
 */
export function fitSheets(root) {
  let overflow = 0;
  root.querySelectorAll('[data-fs]').forEach((box) => {
    const sheet = box.classList.contains('sheet') ? box : box.querySelector('.sheet');
    if (!sheet) return;
    const base = parseFloat(box.dataset.fs) || 10;
    let fs = base;
    sheet.style.setProperty('--fs', `${fs}pt`);
    let guard = 0;
    while (sheet.scrollHeight > sheet.clientHeight + 1 && fs > base * 0.55 && guard < 50) {
      fs -= base * 0.025;
      sheet.style.setProperty('--fs', `${fs.toFixed(2)}pt`);
      guard++;
    }
    if (sheet.scrollHeight > sheet.clientHeight + 1) overflow++;
  });
  return overflow;
}

/**
 * Öffnet die Druckvorschau.
 */
export function openPrintView({ title, orientation, pages, onClose, hint }) {
  const root = document.getElementById('print-root');
  const pageStyle = document.getElementById('page-style');
  pageStyle.textContent = `@page { size: A4 ${orientation}; margin: 0; }`;
  root.innerHTML = '';
  const close = () => {
    root.hidden = true;
    root.innerHTML = '';
    document.body.classList.remove('is-printing');
    window.removeEventListener('resize', onResize);
    if (onClose) onClose();
  };
  const pagesBox = h('div', { class: 'print-pages', html: pages.join('') });
  const info = h('p');
  const toolbar = h('div', { class: 'print-toolbar' },
    h('button', { class: 'btn', type: 'button', onclick: close }, icon('back'), 'Zurück'),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: '1 1 260px', minWidth: '0' } },
      h('b', null, title),
      info),
    h('button', { class: 'btn btn--primary btn--big', type: 'button', onclick: () => window.print() }, icon('print'), 'Drucken / PDF'),
  );
  root.append(toolbar, pagesBox);
  root.hidden = false;
  document.body.classList.add('is-printing');
  window.scrollTo(0, 0);

  pagesBox.style.setProperty('--preview-zoom', '1');
  const listOverflow = layoutLists(pagesBox);
  const overflow = fitSheets(pagesBox);
  const count = pagesBox.querySelectorAll('.page').length;
  info.textContent = (hint || `${count} ${count === 1 ? 'Seite' : 'Seiten'} · A4 ${orientation === 'landscape' ? 'quer' : 'hoch'}. Im Druckdialog über das Teilen-Symbol „In Dateien sichern“ wählen, um ein PDF zu erhalten.`)
    + (overflow ? ` Achtung: ${overflow} ${overflow === 1 ? 'Bogen passt' : 'Bögen passen'} nicht vollständig auf den Platz – bitte eine größere Druckform wählen.` : '')
    + (listOverflow ? ' Achtung: Die Notenliste passt nicht vollständig auf die Seiten. Bitte weniger Runden oder „Nur Endnote“ wählen.' : '');
  if (overflow || listOverflow) info.classList.add('warn');
  const pageWidthMM = orientation === 'landscape' ? 297 : 210;
  function onResize() {
    const avail = Math.max(320, window.innerWidth - 24);
    const zoom = Math.min(1, avail / (pageWidthMM * MM));
    pagesBox.style.setProperty('--preview-zoom', zoom.toFixed(3));
  }
  onResize();
  window.addEventListener('resize', onResize);
  return { close };
}
