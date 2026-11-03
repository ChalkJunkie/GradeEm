/**
 * Grade’Em – Bewertungsansicht für beliebige Raster
 * =================================================
 * Kriterien-Raster (Mittelwert oder Punktsumme) und Matrix-Raster.
 */
import { h, icon, openDialog, debounce, esc, richHTML } from './ui.js';
import { describeGrade, adjustGrade, formatDecimal } from './grades.js';
import { evaluateRaster, pointsOf, weightsFor, statusOf } from './engine.js';
import { footnoteList } from './raster.js';
import { DEFINITIONS, GRADE_NAMES, FOOTNOTE_TEXT, FOOTNOTE_URL } from './rubric.js';
import { todayISO, klasseOf, weightsText, rowText } from './sheet-data.js';
import { parasHTML } from './print.js';

/**
 * Weiche Trennstellen für lange Wörter – nur für die Anzeige im Raster, damit
 * schmale Spalten (Hochformat) sauber umbrechen. Der Wortlaut bleibt unverändert.
 */
const DISPLAY_HYPHENS = [
  'Zusammen|hänge', 'fächer|über|greifend', 'Sach|verhalte', 'Unterrichts|einheiten', 'Jahrgangs|stufen',
  'nach|vollzieh|bar', 'Basis|wissen', 'Selbst|ständiges', 'selbst|ständiger', 'experi|menteller',
  'weiter|führender', 'Über|prüfung', 'reprodu|zierbar', 'repro|duktiv', 'Hilfe|stellung', 'Formu|lierung',
  'Fach|sprache', 'Fach|wissen', 'Ver|ständnis', 'Experi|mente', 'Hypo|thesen', 'Ver|netzung', 'behan|delten',
  'Eigen|ständige', 'Grund|zügen', 'anwend|bar', 'abruf|bar', 'Einord|nung', 'erkenn|bar', 'ersicht|lich',
  'Anwen|dung', 'Gedan|ken', 'Verwen|dung', 'aktuel|len', 'aktu|ell', 'weitge|hend', 'verständ|lich',
  'Unterrichts|beteiligung', 'Gruppen|arbeit', 'Problem|stellungen', 'Lösungs|ansätze', 'Lösungs|wege',
  'Kommuni|kation', 'Gesprächs|führung', 'Gesprächs|situationen', 'Unterrichts|situation', 'Fremd|sprache',
  'Reflexions|vermögen', 'Transfer|leistungen', 'Eigen|initiative', 'Problem|bewusstsein', 'Abstraktions|niveau',
  'Übersetzungs|techniken', 'Kasus|endungen', 'Tempus|signale', 'Aus|sprache', 'Wort|schatz', 'Gramma|tik',
];
const HYPH = DISPLAY_HYPHENS.map((w) => [w.replace(/\|/g, ''), w.replace(/\|/g, '\u00AD')]);

function hyph(md) {
  let t = String(md || '');
  for (const [a, b] of HYPH) t = t.split(a).join(b);
  return t;
}

function cellHTML(md) {
  return md && md.trim() ? parasHTML(hyph(md)) : '<p class="cell__empty">–</p>';
}

/** Antippbare Zelle (div mit Tastaturbedienung, damit Unterelemente möglich sind). */
function tapCell(html, pressed, label, onTap) {
  const el = h('div', { class: 'cell', role: 'button', tabindex: '0', 'aria-pressed': String(pressed), 'aria-label': label, html });
  el.addEventListener('click', (e) => {
    if (e.target.closest('.chip')) return;
    onTap();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  });
  return el;
}

/** Schülis als Liste mit Status (Übersicht und Schnellliste). */
export function studentGrid(ctx, g, r, students, currentId = null, onPick = null) {
  const raster = ctx.roundRaster(r);
  const list = h('div', { class: currentId !== null ? 'quick-list' : 'student-list' });
  for (const s of students) {
    const a = ctx.getAssessment(r.id, s.id);
    const st = statusOf(raster, a);
    const ev = evaluateRaster(raster, a);
    const grade = ev.effective !== null ? describeGrade(ev.effective, ctx.displayScale(g)).short : '–';
    const n = ev.rows.length;
    const rowsTxt = a && st !== 'open'
      ? Array.from({ length: n }, (_, i) => rowText(raster, ev, i) || '–').join(' · ') + (ev.info.sum !== undefined ? ` · Σ ${ev.info.sum}` : '')
      : 'noch nicht bewertet';
    const label = { done: 'bewertet', partial: 'angefangen', open: 'offen' }[st];
    const item = h(onPick ? 'button' : 'a', {
      class: `student-item${s.id === currentId ? ' is-current' : ''}`,
      href: onPick ? undefined : `#/gruppe/${g.id}/bewerten/${s.id}`,
      type: onPick ? 'button' : undefined,
      'aria-label': `${ctx.nameFor(s)}, ${label}${ev.effective !== null ? `, Note ${grade}` : ''}`,
    },
    h('span', { class: `dot dot--${st}`, 'aria-hidden': 'true' }),
    h('span', { class: 'student-item__name' }, ctx.nameFor(s), currentId === null ? h('span', { class: 'student-item__rows' }, rowsTxt) : null),
    h('span', { class: 'student-item__grade' }, grade, ev.adjusted ? h('small', null, 'nachgeschärft') : null));
    if (onPick) item.addEventListener('click', () => onPick(s));
    list.append(item);
  }
  return list;
}

function quickList(ctx, g, r, current) {
  const students = ctx.sortedStudents(g);
  let close = null;
  const grid = studentGrid(ctx, g, r, students, current.id, (s) => {
    if (close) close();
    ctx.go(`gruppe/${g.id}/bewerten/${s.id}`, { replace: true });
  });
  const d = openDialog({ title: `${g.name} – ${r.title}`, wide: true, body: grid, actions: [{ label: 'Schließen' }] });
  close = d.close;
}

function infoPanel(raster) {
  const parts = [];
  if (raster.einleitung) parts.push(parasHTML(raster.einleitung));
  if (raster.hinweise) parts.push(parasHTML(raster.hinweise));
  if (raster.fussnoten) parts.push(footnoteList(raster.fussnoten).map((f) => `<p class="small">${f.nr ? `<sup>${esc(f.nr)}</sup> ` : ''}${richHTML(f.text)}</p>`).join(''));
  if (raster.meta.notendefinitionen) {
    parts.push(`<p><b>Notendefinitionen nach §5 Notenbildungsverordnung</b></p>${DEFINITIONS.map((d, i) => `<p class="small">${richHTML(GRADE_NAMES[i])}: ${esc(d)}</p>`).join('')}<p class="small muted">${esc(FOOTNOTE_TEXT.replace(/^\* /, ''))}<a href="${esc(FOOTNOTE_URL)}" target="_blank" rel="noopener">${esc(FOOTNOTE_URL)}</a></p>`);
  }
  if (!parts.length) return null;
  return h('details', { class: 'raster-info' }, h('summary', null, 'Hinweise zum Raster'), h('div', { class: 'panel', html: parts.join('') }));
}

/**
 * Bewertungsansicht.
 */
export async function renderRate(ctx, g, studentId) {
  const r = await ctx.ensureRound(g);
  const raster = ctx.roundRaster(r);
  const students = ctx.sortedStudents(g);
  const idx = students.findIndex((s) => s.id === studentId);
  if (idx < 0) return ctx.go(`gruppe/${g.id}`, { replace: true });
  const s = students[idx];
  document.title = `${ctx.nameFor(s)} – ${ctx.APP_NAME}`;
  const isMatrix = raster.meta.typ === 'matrix';
  const isSum = !isMatrix && raster.meta.wertung === 'summe';
  const unit = raster.meta.einheit || 'P';

  let a = ctx.getAssessment(r.id, s.id);
  const draft = a || ctx.newAssessment(r, s, g);
  const need = isMatrix ? 2 : raster.kriterien.length;
  if (!Array.isArray(draft.crit)) draft.crit = [];
  while (draft.crit.length < need) draft.crit.push({ sel: [], pts: {}, comment: '' });
  draft.crit.forEach((c) => { if (!Array.isArray(c.sel)) c.sel = []; if (!c.pts) c.pts = {}; });
  const persist = debounce(() => { ctx.saveAssessment(draft); }, 250);
  const ensure = () => {
    if (!a) {
      a = draft;
      ctx.state.assessments.set(a.id, a);
    }
    persist();
  };

  const goTo = (i, dir) => {
    if (i < 0 || i >= students.length) return;
    persist.flush();
    ctx.state.navDirection = dir;
    ctx.go(`gruppe/${g.id}/bewerten/${students[i].id}`, { replace: true });
  };
  const prev = () => goTo(idx - 1, -1);
  const next = () => goTo(idx + 1, 1);

  // --- Kopf ---
  const dateIn = h('input', { class: 'input', type: 'date', value: draft.date || todayISO(), 'aria-label': 'Datum' });
  dateIn.addEventListener('change', () => { draft.date = dateIn.value || todayISO(); ensure(); });
  const groupW = ctx.groupWeights(g, raster, r.rasterId);
  const weightsDiffer = a && !isMatrix && !isSum && JSON.stringify(weightsFor(raster, a.weights)) !== JSON.stringify(groupW);
  const head = h('div', { class: 'rate-head' },
    h('div', { class: 'meta' },
      h('span', null, `Klasse ${klasseOf(g) || '–'}`),
      h('label', { class: 'row', style: { gap: '6px' } }, h('span', null, 'Datum'), dateIn),
      h('span', null, r.title),
      h('span', { class: 'badge' }, raster.meta.fach || 'Raster')),
    h('span', { class: 'spacer' }),
    weightsDiffer ? h('span', { class: 'muted small' }, `Gewichtung dieser Bewertung: ${weightsText(raster, a.weights)} `,
      h('button', { class: 'btn', type: 'button', style: { minHeight: '40px' }, onclick: () => {
        draft.weights = [...groupW];
        ensure();
        persist.flush();
        ctx.render();
      } }, 'Aktuelle übernehmen')) : null);

  const valueEls = [];
  const blocks = [];
  let hintText;

  const crit = draft.crit;
  const commentField = (i, label) => {
    const ta = h('textarea', { class: 'input', rows: 2, placeholder: `Kommentar zu „${label}“ (optional)`, 'aria-label': `Kommentar ${label}` });
    ta.value = crit[i].comment || '';
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.max(52, ta.scrollHeight + 2)}px`; };
    ta.addEventListener('input', () => { crit[i].comment = ta.value; grow(); ensure(); });
    requestAnimationFrame(grow);
    return ta;
  };

  let gridHead = null;
  let mxResult = null;

  if (!isMatrix) {
    const n = raster.stufen.length;
    hintText = isSum
      ? 'Pro Kriterium die zutreffende Stufe antippen; die Punkte werden addiert. Wischen wechselt zur nächsten Person.'
      : 'Zutreffende Beschreibung antippen. Bei gemischter Leistung mehrere Zellen einer Zeile wählen – der Zeilenwert ist dann der Mittelwert. Wischen wechselt zur nächsten Person.';
    gridHead = h('div', { class: 'grid-head', 'aria-hidden': 'true' },
      h('span', { class: 'grid-head__corner' }),
      raster.stufen.map((st) => h('span', null, st.name, h('small', null, isSum ? `${st.punkteText} ${unit}` : st.noteText && st.noteText !== st.name ? `Note ${st.noteText}` : ''))));
    raster.kriterien.forEach((k, i) => {
      const c = crit[i];
      const valueEl = h('span', { class: 'crit__value' });
      valueEls[i] = valueEl;
      const cellsBox = h('div', { class: 'crit__cells', role: 'group', 'aria-label': k.name });
      const drawCells = () => {
        cellsBox.replaceChildren(...raster.stufen.map((st, l) => {
          const on = c.sel.includes(l);
          const el = tapCell(cellHTML(k.cells[l]), on, `${k.name}, ${st.name}`, () => {
            if (isSum) c.sel = on ? [] : [l];
            else {
              const set = new Set(c.sel);
              if (set.has(l)) set.delete(l);
              else set.add(l);
              c.sel = [...set].sort((x, y) => x - y);
            }
            ensure();
            drawCells();
            updateNumbers();
          });
          if (on && isSum && st.punkte.length > 1) {
            const cur = pointsOf(raster, l, c);
            el.append(h('div', { class: 'chips' }, st.punkte.map((p) => h('button', {
              class: `chip${p === cur ? ' is-on' : ''}`,
              type: 'button',
              'aria-label': `${p} ${unit}`,
              onclick: (e) => {
                e.stopPropagation();
                c.pts = { ...(c.pts || {}), [l]: p };
                ensure();
                drawCells();
                updateNumbers();
              },
            }, String(p)))));
          }
          return el;
        }));
      };
      drawCells();
      blocks.push(h('section', { class: 'crit' },
        h('div', { class: 'crit__label' }, h('h2', null, k.name, k.erlaeuterung ? h('span', { class: 'erl' }, k.erlaeuterung) : null), valueEl),
        cellsBox,
        commentField(i, k.schuelibogen || k.name)));
    });
  } else {
    hintText = 'Zuerst die passende Zeile, dann die passende Spalte antippen. Die Zelle liefert den Notenbereich; tippe die passende Note an. Wischen wechselt zur nächsten Person.';
    const axisBlock = (ai, axis, title) => {
      const c = crit[ai];
      const valueEl = h('span', { class: 'crit__value' });
      valueEls[ai] = valueEl;
      const box = h('div', { class: ai === 0 ? 'mx-rows' : 'crit__cells', role: 'group', 'aria-label': title });
      if (ai === 1) box.style.setProperty('--n', axis.items.length);
      const draw = () => {
        box.replaceChildren(...axis.items.map((it, l) => {
          const on = c.sel.includes(l);
          return tapCell(`<span class="mx-key">${esc(it.key)}</span><div>${cellHTML(it.text)}</div>`, on, `${title}: ${it.key}`, () => {
            c.sel = on ? [] : [l];
            ensure();
            draw();
            updateNumbers();
          });
        }));
      };
      draw();
      return h('section', { class: 'crit crit--stack' },
        h('div', { class: 'crit__label' }, h('h2', null, title), valueEl),
        box,
        commentField(ai, title));
    };
    blocks.push(axisBlock(0, raster.zeilen, raster.zeilen.titel || 'Zeile wählen'));
    blocks.push(axisBlock(1, raster.spalten, raster.spalten.titel || 'Spalte wählen'));
    mxResult = h('div', { class: 'mx-result', 'aria-live': 'polite' });
    blocks.push(mxResult);
  }

  // --- Fußleiste ---
  const scale = ctx.displayScale(g);
  const step = ctx.stepScale(g);
  const propBig = h('b');
  const propSmall = h('em');
  const finalBig = h('b');
  const finalSmall = h('small');
  const finalBox = h('div', { class: 'final__value', 'aria-live': 'polite' }, finalBig, finalSmall);
  const btnWorse = h('button', { class: 'btn', type: 'button', 'aria-label': 'Note verschlechtern' }, '−');
  const btnBetter = h('button', { class: 'btn', type: 'button', 'aria-label': 'Note verbessern' }, '+');
  const btnReset = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Auf berechneten Wert zurücksetzen', title: 'Auf berechneten Wert zurücksetzen' }, icon('reset'));
  const setFinal = (nv) => {
    const ev = evaluateRaster(raster, draft);
    const same = nv === null || describeGrade(nv, scale).short === describeGrade(ev.proposal, scale).short;
    draft.final = same ? null : nv;
    draft.finalScale = same ? null : step;
    ensure();
    updateNumbers();
  };
  const adjust = (dir) => {
    const ev = evaluateRaster(raster, draft);
    if (ev.proposal === null) return;
    setFinal(adjustGrade(ev.effective, step, dir));
  };
  btnBetter.addEventListener('click', () => adjust('better'));
  btnWorse.addEventListener('click', () => adjust('worse'));
  btnReset.addEventListener('click', () => setFinal(null));

  function updateNumbers() {
    const ev = evaluateRaster(raster, draft);
    if (isMatrix) {
      [raster.zeilen, raster.spalten].forEach((axis, i) => {
        const v = ev.rows[i];
        valueEls[i].replaceChildren(v === null ? 'nicht gewählt' : h('span', null, 'gewählt ', h('b', null, axis.items[v].key)));
      });
      const cell = ev.info.cell;
      if (!cell) mxResult.replaceChildren(h('p', { class: 'muted' }, 'Wähle eine Zeile und eine Spalte – dann erscheint hier der Notenbereich der Zelle.'));
      else {
        mxResult.replaceChildren(
          h('p', null, h('b', null, `Zelle ${raster.zeilen.items[ev.rows[0]].key} / ${raster.spalten.items[ev.rows[1]].key}`), cell.punkte.length ? ` · Punkte laut Raster: ${cell.punkte.join(', ')}` : ''),
          h('p', { class: 'small muted' }, 'Passende Note antippen:'),
          h('div', { class: 'chips' }, cell.noten.map((nt) => h('button', {
            class: `chip${ev.effective !== null && Math.abs(ev.effective - nt.value) < 1e-9 && ev.adjusted ? ' is-on' : ''}`,
            type: 'button',
            onclick: () => {
              draft.final = nt.value;
              draft.finalScale = 'quarter';
              ensure();
              updateNumbers();
            },
          }, nt.label))));
      }
    } else {
      raster.kriterien.forEach((k, i) => {
        const v = ev.rows[i];
        if (isSum) valueEls[i].replaceChildren(v === null ? 'nicht bewertet' : h('span', null, h('b', null, formatDecimal(v, 2, true)), ` ${unit}`));
        else {
          const w = ev.info.weights || [];
          const total = w.reduce((x, y) => x + (y > 0 ? y : 0), 0) || 1;
          valueEls[i].replaceChildren(
            v === null ? 'nicht bewertet' : h('span', null, 'Zeilenwert ', h('b', null, formatDecimal(v, 2, true))),
            h('span', null, ` · ${formatDecimal(((w[i] || 0) / total) * 100, 0)} %`));
        }
      });
    }
    if (ev.proposal === null) {
      propBig.textContent = '–';
      propSmall.textContent = isSum && ev.info.sum !== undefined ? `Summe ${ev.info.sum} / ${ev.info.max}` : isMatrix ? 'Zeile und Spalte wählen' : 'Zellen antippen';
      finalBig.textContent = '–';
      finalSmall.textContent = 'Endnote';
    } else {
      const p = describeGrade(ev.proposal, scale);
      propBig.textContent = scale === 'points' ? `${p.points} P` : p.quarter + (scale === 'both' ? ` / ${p.points} P` : '');
      const extra = isSum ? `Summe ${ev.info.sum} / ${ev.info.max}` : formatDecimal(ev.proposal, 2);
      propSmall.textContent = `${extra}${ev.complete ? '' : ' · vorläufig'}`;
      const f = describeGrade(ev.effective, scale);
      finalBig.textContent = scale === 'points' ? String(f.points) : f.quarter;
      finalSmall.textContent = scale === 'points' ? `Punkte${ev.adjusted ? ' · nachgeschärft' : ''}` : scale === 'both' ? `${f.points} Punkte${ev.adjusted ? ' · nachgeschärft' : ''}` : ev.adjusted ? 'nachgeschärft' : 'Endnote';
    }
    finalBox.classList.toggle('is-adjusted', ev.adjusted);
    const none = ev.proposal === null;
    btnBetter.disabled = none;
    btnWorse.disabled = none;
    btnReset.disabled = !ev.adjusted;
  }

  const last = idx === students.length - 1;
  const btnPrev = h('button', { class: 'btn btn--big', type: 'button', disabled: idx === 0, 'aria-label': 'Vorheriges Schüli', onclick: prev }, icon('back'));
  const btnNext = h('button', { class: 'btn btn--primary btn--big', type: 'button', onclick: () => (last ? ctx.go(`gruppe/${g.id}`) : next()) }, last ? 'Fertig' : 'Weiter', last ? null : icon('next'));
  const gradebar = h('footer', { class: 'gradebar' },
    h('div', { class: 'gradebar__inner' },
      h('div', { class: 'proposal' }, h('span', null, 'Vorschlag'), propBig, propSmall),
      h('div', { class: 'final' },
        h('div', { class: 'stepper' }, btnWorse, h('span', null, 'schlechter')),
        finalBox,
        h('div', { class: 'stepper' }, btnBetter, h('span', null, 'besser')),
        btnReset),
      h('div', { class: 'nav-btns' }, btnPrev, btnNext)));

  const main = h('main', { class: `main swipe-area${ctx.state.navDirection > 0 ? ' slide-in-left' : ctx.state.navDirection < 0 ? ' slide-in-right' : ''}` },
    head, h('p', { class: 'muted small', style: { margin: '0 0 4px' } }, hintText), gridHead, ...blocks, infoPanel(raster));
  if (!isMatrix) main.style.setProperty('--n', raster.stufen.length);
  ctx.state.navDirection = 0;

  // --- Wischgeste ---
  let sx = 0;
  let sy = 0;
  let st0 = 0;
  let tracking = false;
  main.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('input, textarea, select, details, .chip')) { tracking = false; return; }
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    st0 = Date.now();
    tracking = true;
  }, { passive: true });
  main.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > 1.8 * Math.abs(dy) && Date.now() - st0 < 700) {
      if (dx < 0) next();
      else prev();
    }
  }, { passive: true });

  function onKey(e) {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  }
  document.addEventListener('keydown', onKey);
  ctx.setCleanup(() => {
    persist.flush();
    document.removeEventListener('keydown', onKey);
  });

  ctx.view(ctx.topbar({
    back: `#/gruppe/${g.id}`,
    title: ctx.nameFor(s),
    subtitle: `${g.name} · ${idx + 1} von ${students.length}`,
    actions: [
      h('span', { class: 'pos' }, `${idx + 1} / ${students.length}`),
      h('button', { class: 'btn', type: 'button', onclick: () => quickList(ctx, g, r, s) }, icon('list'), h('span', null, 'Liste')),
    ],
  }), main, gradebar);
  updateNumbers();
  window.scrollTo(0, 0);
}
