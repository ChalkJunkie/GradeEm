/**
 * Grade’Em – Übertragungsansicht
 * ==============================
 * Zeigt die Endnoten einer Runde groß und in der Schreibweise einer anderen Notenverwaltung
 * (z. B. TeacherTool), damit man sie dort schnell eintippen kann – am iPad im Split View
 * nebeneinander. Ein Tipp auf eine Zeile hakt sie als übertragen ab. Der Haken merkt sich die
 * Note; ändert sie sich danach, wird die Zeile als geändert markiert.
 */
import { h, icon, confirmDialog } from './ui.js';
import { evaluateRaster } from './engine.js';
import { TRANSFER_NOTATIONS, transferGrade, compareStudents } from './sheet-data.js';

const NOTATION_HINT = {
  dezimal: 'In der TeacherTool-Notenspalte die Ein-/Ausgabeform „Dezimal“ wählen. Viertelnoten bleiben dann exakt erhalten.',
  tendenz: 'Für das Notensystem „Noten 1–6 mit Tendenzen“. Viertelnoten wie 1-2 werden zugunsten der Schülis auf die nächste Tendenz gerundet.',
  punkte: 'Für ein Notensystem mit Notenpunkten (15 bis 0).',
};

const byFirstName = (a, b) => (a.firstName || '').localeCompare(b.firstName || '', 'de', { sensitivity: 'base' })
  || (a.lastName || '').localeCompare(b.lastName || '', 'de', { sensitivity: 'base' });

// Haken je Runde: Schüli-ID → Endnote beim Abhaken. Bleibt im Browser, auch nach einem Neuladen.
const marksKey = (roundId) => `gradeem-transfer:${roundId}`;

function loadMarks(roundId) {
  try {
    const v = JSON.parse(localStorage.getItem(marksKey(roundId)) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveMarks(roundId, marks) {
  try {
    localStorage.setItem(marksKey(roundId), JSON.stringify(marks));
  } catch { /* ohne Speicher gelten die Haken nur für diese Ansicht */ }
}

export async function renderTransfer(ctx, g) {
  const first = await ctx.ensureRound(g);
  document.title = `Übertragen – ${g.name}`;
  const rounds = ctx.roundsOf(g.id);
  const scale = ctx.displayScale(g);
  let round = ctx.state.rounds.find((x) => x.id === g.currentRoundId && x.groupId === g.id) || first;
  let notation = g.transferNotation || (scale === 'points' ? 'punkte' : 'dezimal');
  let sortBy = g.transferSort === 'vorname' ? 'vorname' : 'nachname';
  let marks = loadMarks(round.id);

  const list = h('div', { class: 'transfer-list' });
  const progress = h('p', { class: 'transfer-progress', role: 'status' });
  const hint = h('p', { class: 'muted small', style: { margin: '8px 0 0' } });

  function entries() {
    const raster = ctx.roundRaster(round);
    const students = [...(g.students || [])].sort(sortBy === 'vorname' ? byFirstName : compareStudents);
    return students.map((s) => {
      const a = ctx.getAssessment(round.id, s.id);
      const status = ctx.statusFor(round, a);
      const eff = a ? evaluateRaster(raster, a).effective : null;
      return { s, status, tg: eff === null || eff === undefined ? null : transferGrade(eff, notation, scale) };
    });
  }

  function draw() {
    const rows = entries();
    let done = 0;
    let withGrade = 0;
    list.replaceChildren(...rows.map(({ s, status, tg }) => {
      const name = ctx.nameFor(s);
      if (!tg) {
        return h('div', { class: 'transfer-row is-open' },
          h('span', { class: 'transfer-row__check', 'aria-hidden': 'true' }),
          h('span', { class: 'transfer-row__name' }, name, h('small', null, status === 'partial' ? 'angefangen, noch keine Endnote' : 'noch nicht bewertet')),
          h('span', { class: 'transfer-row__grade' }, '–'));
      }
      withGrade++;
      const mark = marks[s.id];
      const isDone = mark === tg.base;
      const changed = mark !== undefined && !isDone;
      if (isDone) done++;
      const note = changed ? 'Note hat sich seit dem Abhaken geändert' : tg.source !== tg.main ? `Grade’Em: ${tg.source}` : '';
      const btn = h('button', {
        class: `transfer-row${isDone ? ' is-done' : ''}${changed ? ' is-changed' : ''}`,
        type: 'button',
        'aria-pressed': String(isDone),
        'aria-label': `${name}, Note ${tg.main}, ${isDone ? 'übertragen' : changed ? 'geändert, noch einmal übertragen' : 'noch nicht übertragen'}`,
        onclick: () => {
          if (isDone) delete marks[s.id];
          else marks[s.id] = tg.base;
          saveMarks(round.id, marks);
          draw();
        },
      },
      h('span', { class: 'transfer-row__check', 'aria-hidden': 'true' }, isDone ? icon('check') : null),
      h('span', { class: 'transfer-row__name' }, name, note ? h('small', null, note) : null),
      h('span', { class: 'transfer-row__grade' }, tg.main));
      return btn;
    }));
    progress.textContent = withGrade
      ? `${done} von ${withGrade} übertragen${rows.length > withGrade ? ` · ${rows.length - withGrade} ohne Endnote` : ''}`
      : 'In dieser Runde gibt es noch keine Endnoten.';
    hint.textContent = NOTATION_HINT[notation];
  }

  const seg = (options, value, onPick) => {
    const el = h('div', { class: 'seg', role: 'group' });
    for (const [v, label] of options) {
      el.append(h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: (e) => {
        el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        onPick(v);
      } }, label));
    }
    return el;
  };

  const roundSel = h('select', { class: 'input', 'aria-label': 'Runde' },
    rounds.map((x) => h('option', { value: x.id, selected: x.id === round.id }, x.title)));
  roundSel.addEventListener('change', () => {
    round = ctx.state.rounds.find((x) => x.id === roundSel.value) || round;
    marks = loadMarks(round.id);
    draw();
  });

  const opts = h('section', { class: 'section panel transfer-opts' },
    rounds.length > 1 ? h('div', { class: 'field' }, h('span', null, 'Runde'), roundSel) : null,
    h('div', { class: 'field' }, h('span', null, 'Schreibweise der Noten'),
      seg(TRANSFER_NOTATIONS, notation, async (v) => {
        notation = v;
        g.transferNotation = v;
        draw();
        await ctx.saveGroup(g);
      }),
      hint),
    h('div', { class: 'field' }, h('span', null, 'Reihenfolge der Schülis'),
      seg([['nachname', 'nach Nachname'], ['vorname', 'nach Vorname']], sortBy, async (v) => {
        sortBy = v;
        g.transferSort = v;
        draw();
        await ctx.saveGroup(g);
      })));

  const main = h('main', { class: 'main' },
    h('p', { class: 'muted', style: { marginTop: 0 } }, 'Tippe die Noten in dieser Reihenfolge in TeacherTool ein. Auf dem iPad passen beide Apps im Split View nebeneinander. Ein Tipp auf eine Zeile hakt sie ab.'),
    opts,
    h('div', { class: 'row transfer-bar' },
      progress,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: async () => {
        const ok = await confirmDialog('Alle Haken dieser Runde entfernen? Die Noten selbst bleiben unverändert.', { title: 'Haken zurücksetzen', ok: 'Zurücksetzen' });
        if (!ok) return;
        marks = {};
        saveMarks(round.id, marks);
        draw();
      } }, icon('reset'), 'Haken zurücksetzen')),
    list);
  draw();
  ctx.view(...ctx.groupHead(g, 'export'), main);
}
