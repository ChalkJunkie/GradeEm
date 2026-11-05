/**
 * Grade’Em – Druckansichten
 * =========================
 * Erzeugt druckfertige Seiten (A4) für
 *   • Schülibögen: 1 pro Seite (A4 quer), 2 pro Seite (A4 hoch), 4 pro Seite (A4 quer, kompakt)
 *   • Notenliste (A4 hoch, mehrere Seiten)
 * und eine Rasterübersicht für die Vorschau in der App.
 *
 * Bogenformen je nach Raster: kompakt (beste/schwächste Beschreibung + Kreuzspalten),
 * vollständig (alle Beschreibungen, Auswahl markiert) und Matrix.
 *
 * Die Druckseite hat keinen Rand (@page margin 0). Dadurch fügt der Browser keine
 * eigene Kopf-/Fußzeile (Adresse, Datum, Uhrzeit, Seitenzahl) hinzu. Den weißen Rand
 * legt jede .page selbst als Innenabstand an; die Notenliste wird dafür von der App
 * selbst auf Seiten verteilt (paginateLists).
 */
import {
  STUDENT_NOTE_LABEL, STUDENT_DEFINITION_LABEL, GRADE_NAMES, DEFINITIONS, FOOTNOTE_TEXT, FOOTNOTE_URL,
} from './rubric.js';
import { cellParas, footnoteList } from './raster.js';
import { pointsOf } from './engine.js';
import { headerFields, sumText, critShort } from './sheet-data.js';
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

/**
 * Seite(n) der Notenliste.
 * @param {object[]} list Ergebnis von buildGradeList()
 * @param {{title, group, klasse, round, printed, scale, weightsNote, raster}} meta
 */
export function buildListPages(list, meta) {
  const r = meta.raster;
  const q = meta.scale !== 'points';
  const p = meta.scale !== 'quarter';
  const summe = r.meta.typ !== 'matrix' && r.meta.wertung === 'summe';
  const n = r.meta.typ === 'matrix' ? 2 : r.kriterien.length;
  const crit = Array.from({ length: n }, (_, i) => `<th>${esc(critShort(r, i))}</th>`).join('');
  const head = `<tr><th>Nr.</th><th class="name" style="width:22%">Name</th><th>Datum</th>${crit}${summe ? '<th>Summe</th>' : ''}<th>berechnet</th>${q ? '<th>Endnote</th>' : ''}${p ? '<th>Punkte</th>' : ''}</tr>`;
  const rows = list.map((x, i) => {
    const calc = x.proposalDecimal ? `${x.proposalDecimal}${q ? ` (${esc(x.proposalQuarter)})` : ` (${x.proposalPoints} P)`}` : '';
    const adj = x.adjusted ? '<span class="adj"> *</span>' : '';
    return `<tr>
      <td>${i + 1}</td><td class="name">${esc(x.name)}</td><td>${esc(x.datum)}</td>
      ${x.rowTexts.map((t) => `<td>${esc(t)}</td>`).join('')}
      ${summe ? `<td>${esc(x.sum)}</td>` : ''}
      <td>${calc}${x.proposalDecimal && !x.complete ? '<span class="adj"> (unvollst.)</span>' : ''}</td>
      ${q ? `<td class="list-final">${esc(x.finalQuarter)}${adj}</td>` : ''}
      ${p ? `<td class="list-final">${x.finalPoints}${q ? '' : adj}</td>` : ''}
    </tr>`;
  }).join('');
  const explain = r.meta.typ === 'matrix'
    ? 'Zeile/Spalte: gewählte Einschätzungen im Raster; berechnet: Mitte des Notenbereichs der Zelle.'
    : summe
      ? `Punkte je Kriterium; Note aus der Summe laut Umrechnungstabelle${meta.weightsNote ? ` (${esc(meta.weightsNote)})` : ''}.`
      : `Zeilenwerte: Mittelwert der markierten Stufen. Berechnete Note: gewichteter Mittelwert (${esc(meta.weightsNote)}).`;
  const html = `<div class="page page--portrait page--list"><div class="list-sheet">
    <h1>${esc(meta.title)}</h1>
    <div class="list-meta">
      <span><b>Lerngruppe:</b> ${esc(meta.group)}</span>
      <span><b>Klasse:</b> ${esc(meta.klasse)}</span>
      <span><b>Runde:</b> ${esc(meta.round)}</span>
      <span><b>Raster:</b> ${esc(r.meta.fach)}</span>
      <span><b>Stand:</b> ${esc(meta.printed)}</span>
    </div>
    <table><thead>${head}</thead><tbody>${rows}</tbody></table>
    <div class="list-foot"><p>${explain} ${p ? 'Punkte = 17 − 3 × Note, gerundet. ' : ''}* = von der Lehrkraft nachgeschärft.</p></div>
  </div></div>`;
  return { orientation: 'portrait', pages: [html] };
}

/**
 * Verteilt eine lange Notenliste auf mehrere Seiten: Zeilen, die nicht mehr auf eine
 * Seite passen, wandern auf eine neue Seite mit wiederholtem Tabellenkopf.
 */
export function paginateLists(root) {
  let page = root.querySelector('.page--list');
  let guard = 0;
  while (page && page.scrollHeight > page.clientHeight + 1 && guard++ < 60) {
    const next = page.cloneNode(true);
    const curBody = page.querySelector('tbody');
    const nextBody = next.querySelector('tbody');
    nextBody.replaceChildren();
    const meta = next.querySelector('.list-meta');
    if (meta) meta.remove();
    const foot = page.querySelector('.list-foot');
    if (foot) foot.remove();
    page.after(next);
    while (page.scrollHeight > page.clientHeight + 1 && curBody.rows.length > 1) {
      nextBody.prepend(curBody.rows[curBody.rows.length - 1]);
    }
    if (!nextBody.rows.length) next.querySelector('table').remove();
    page = next;
  }
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
  paginateLists(pagesBox);
  const overflow = fitSheets(pagesBox);
  const count = pagesBox.querySelectorAll('.page').length;
  info.textContent = (hint || `${count} ${count === 1 ? 'Seite' : 'Seiten'} · A4 ${orientation === 'landscape' ? 'quer' : 'hoch'}. Im Druckdialog über das Teilen-Symbol „In Dateien sichern“ wählen, um ein PDF zu erhalten.`)
    + (overflow ? ` Achtung: ${overflow} ${overflow === 1 ? 'Bogen passt' : 'Bögen passen'} nicht vollständig auf den Platz – bitte eine größere Druckform wählen.` : '');
  if (overflow) info.classList.add('warn');
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
