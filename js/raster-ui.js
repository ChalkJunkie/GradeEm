/**
 * Grade’Em – Rasterverwaltung
 * ===========================
 * Bibliothek (Fachschaftsraster + eigene Raster), Import per Einfügen oder Datei,
 * Vorschau und Editor (Formular für Kriterien-Raster, Textansicht für alle).
 */
import { h, icon, toast, openDialog, confirmDialog, offerFile, safeFileName, debounce, uid } from './ui.js';
import { parseRaster, serializeRaster, rasterLabel, cellParas, EMPTY_TEMPLATE } from './raster.js';
import { richHTML } from './ui.js';
import { rasterOverviewHTML } from './print.js';

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function summary(r) {
  if (!r) return '';
  if (r.meta.typ === 'matrix') return `Matrix ${r.zeilen.items.length} × ${r.spalten.items.length}`;
  return `${r.kriterien.length} ${r.kriterien.length === 1 ? 'Kriterium' : 'Kriterien'} × ${r.stufen.length} Stufen${r.meta.wertung === 'summe' ? ' · Punktsumme' : ''}`;
}

function messages(p) {
  const box = h('div', { class: 'msgs' });
  if (!p) return box;
  for (const e of p.errors) box.append(h('div', { class: 'msg msg--error' }, e));
  for (const w of p.warnings) box.append(h('div', { class: 'msg msg--warn' }, w));
  if (p.ok) box.append(h('div', { class: 'msg msg--ok' }, `Raster ist in Ordnung: ${rasterLabel(p.raster)} · ${summary(p.raster)}`));
  return box;
}

function preview(r) {
  return h('div', { class: 'preview-box', html: rasterOverviewHTML(r) });
}

/** Kopiert den KI-Prompt aus raster/KI-PROMPT.md in die Zwischenablage. */
async function copyPrompt(ctx) {
  let prompt = '';
  try {
    const md = await ctx.fetchText('raster/KI-PROMPT.md');
    const m = md.match(/```text\n([\s\S]*?)\n```/);
    prompt = m ? m[1] : md;
  } catch {
    toast('Der KI-Prompt ist gerade nicht verfügbar.');
    return;
  }
  try {
    await navigator.clipboard.writeText(prompt);
    toast('KI-Prompt kopiert. In den KI-Assistenten einfügen und das Raster anhängen.', { duration: 5000 });
  } catch {
    const ta = h('textarea', { class: 'input code', readonly: true });
    ta.value = prompt;
    openDialog({ title: 'KI-Prompt', wide: true, body: [h('p', { class: 'muted small' }, 'Text markieren und kopieren:'), ta], actions: [{ label: 'Schließen' }] });
  }
}

/** Auswahlliste aller Raster (Fachschaft + eigene). */
export function rasterSelect(ctx, value) {
  const sel = h('select', { class: 'input', 'aria-label': 'Bewertungsraster' });
  const fs = h('optgroup', { label: 'Fachschaftsraster' });
  for (const e of ctx.state.fsIndex) {
    const id = `fs:${e.file.replace(/\.md$/, '')}`;
    fs.append(h('option', { value: id, selected: id === value }, e.name || `${e.fach} – ${e.titel}${e.klassen ? ` (Kl. ${e.klassen})` : ''}`));
  }
  sel.append(fs);
  const own = ctx.ownRasters();
  if (own.length) {
    const og = h('optgroup', { label: 'Eigene Raster' });
    for (const rec of own) og.append(h('option', { value: rec.id, selected: rec.id === value }, `${ctx.recordLabel(rec)} (eigen)`));
    sel.append(og);
  }
  if (value && ![...sel.querySelectorAll('option')].some((o) => o.value === value)) {
    sel.prepend(h('option', { value, selected: true }, ctx.recordLabel(ctx.state.rasters.get(value)) || value));
  }
  return sel;
}

async function saveOwn(ctx, text, { id = null, basedOn = null } = {}) {
  const p = parseRaster(text);
  if (!p.ok) throw new Error(p.errors[0]);
  const rec = {
    id: id || `eigen:${uid()}`,
    source: 'eigen',
    file: '',
    text,
    hash: ctx.hashText(text),
    basedOn: basedOn || (id && ctx.state.rasters.get(id) ? ctx.state.rasters.get(id).basedOn : null),
  };
  await ctx.saveRasterRecord(rec);
  return rec;
}

// ---------------------------------------------------------------------------
// Bibliothek
// ---------------------------------------------------------------------------

export function renderRasterLibrary(ctx) {
  document.title = `Bewertungsraster – ${ctx.APP_NAME}`;
  const fsList = h('div', { class: 'raster-list' }, ctx.state.fsIndex.map((e) => {
    const id = `fs:${e.file.replace(/\.md$/, '')}`;
    return h('div', { class: 'raster-item' },
      h('div', null, h('b', null, e.name || e.fach), ' ', e.klassen ? h('span', { class: 'badge' }, `Kl. ${e.klassen}`) : null,
        h('div', { class: 'muted' }, e.titel, e.typ === 'matrix' ? ' · Matrix' : e.wertung === 'summe' ? ' · Punktsumme' : '')),
      h('div', { class: 'btn-group' },
        h('a', { class: 'btn', href: `#/raster/ansehen/${encodeURIComponent(id)}` }, 'Ansehen'),
        h('a', { class: 'btn', href: `#/raster/bearbeiten/${encodeURIComponent(`kopie:${id}`)}` }, icon('edit'), 'Als eigenes bearbeiten')));
  }));
  const own = ctx.ownRasters();
  const ownList = own.length
    ? h('div', { class: 'raster-list' }, own.map((rec) => h('div', { class: 'raster-item' },
      h('div', null, h('b', null, ctx.recordLabel(rec)), ' ', h('span', { class: 'badge' }, 'eigen'),
        h('div', { class: 'muted' }, summary(ctx.recordModel(rec)), rec.basedOn ? ` · auf Basis von ${rec.basedOn.replace(/^fs:/, '')}` : '')),
      h('div', { class: 'btn-group' },
        h('a', { class: 'btn', href: `#/raster/ansehen/${encodeURIComponent(rec.id)}` }, 'Ansehen'),
        h('a', { class: 'btn', href: `#/raster/bearbeiten/${encodeURIComponent(rec.id)}` }, icon('edit'), 'Bearbeiten')))))
    : h('p', { class: 'muted' }, 'Noch keine eigenen Raster. Importiere eines oder bearbeite ein Fachschaftsraster als eigene Fassung.');

  const repoNote = h('div');
  const main = h('main', { class: 'main' },
    repoNote,
    h('section', { class: 'section panel' },
      h('h2', null, 'Eigenes Raster hinzufügen'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Am einfachsten mit einer KI: Prompt kopieren, zusammen mit dem Raster (PDF, Word-Datei oder Foto) an einen KI-Assistenten geben, die Antwort kopieren und hier über „Raster importieren“ einfügen. Raster enthalten keine Daten von Schülis.'),
      h('div', { class: 'btn-group' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => importRasterDialog(ctx) }, icon('file'), 'Raster importieren'),
        h('button', { class: 'btn', type: 'button', onclick: () => copyPrompt(ctx) }, 'KI-Prompt kopieren'),
        h('a', { class: 'btn', href: '#/raster/bearbeiten/neu' }, icon('plus'), 'Leeres Raster'))),
    h('section', { class: 'section' }, h('h2', null, 'Eigene Raster'), ownList),
    h('section', { class: 'section' }, h('h2', null, 'Fachschaftsraster'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Diese Raster liegen im Repository im Ordner „raster“ und werden mit jeder neuen Version der App aktualisiert.'),
      fsList),
  );
  ctx.view(ctx.topbar({ title: 'Raster', subtitle: 'Welches Raster gilt, legst du in der Lerngruppe unter „Einrichten“ fest.' }), main);
  // Für die Pflege: Sind die Rasterdateien im Repository abrufbar?
  const probe = ctx.state.fsIndex[0];
  if (probe && navigator.onLine) {
    ctx.fetchText(`raster/${probe.file}`)
      .then((t) => { if (!ctx.parseRaster(t).ok) throw new Error('kein Raster'); })
      .catch(() => {
        repoNote.replaceChildren(h('div', { class: 'notice' }, h('p', null,
          'Hinweis für die Pflege: Die Rasterdateien im Ordner „raster“ sind auf dem Server nicht abrufbar. Grade’Em nutzt deshalb die mitgelieferten Fassungen – das funktioniert. Damit neue oder geänderte Fachschaftsraster aus dem Repository ankommen, muss dort die Datei „.nojekyll“ liegen: Repository öffnen → „Add file“ → „Create new file“ → Name „.nojekyll“ → „Commit changes“.')));
      });
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export function importRasterDialog(ctx) {
  const ta = h('textarea', { class: 'input code', style: { minHeight: '34vh' }, placeholder: 'Rasterdatei (Markdown) hier einfügen – z. B. die komplette Antwort des KI-Assistenten.', spellcheck: 'false' });
  const file = h('input', { type: 'file', accept: '.md,.txt,text/markdown,text/plain', class: 'visually-hidden', id: 'raster-file' });
  const status = h('div');
  const prev = h('div');
  let parsed = null;
  let okBtn = null;
  const check = () => {
    const t = ta.value.trim();
    parsed = t ? parseRaster(t) : null;
    status.replaceChildren(messages(parsed));
    prev.replaceChildren(parsed && parsed.raster && parsed.ok ? preview(parsed.raster) : '');
    if (okBtn) okBtn.disabled = !(parsed && parsed.ok);
  };
  const dcheck = debounce(check, 300);
  ta.addEventListener('input', dcheck);
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    ta.value = await f.text();
    check();
  });
  const { dlg } = openDialog({
    title: 'Raster importieren',
    wide: true,
    body: [
      h('div', { class: 'btn-group', style: { marginBottom: '10px' } },
        h('label', { class: 'btn', for: 'raster-file' }, icon('file'), '.md-Datei wählen'), file,
        h('button', { class: 'btn', type: 'button', onclick: () => copyPrompt(ctx) }, 'KI-Prompt kopieren')),
      ta, status, prev,
    ],
    actions: [
      { label: 'Abbrechen' },
      {
        label: 'Als eigenes Raster speichern',
        kind: 'primary',
        onClick: async () => {
          check();
          if (!parsed || !parsed.ok) return false;
          const rec = await saveOwn(ctx, ta.value.trim());
          toast('Raster gespeichert.');
          ctx.go(`raster/ansehen/${encodeURIComponent(rec.id)}`);
          return true;
        },
      },
    ],
  });
  okBtn = dlg.querySelector('.dlg__foot .btn--primary');
  okBtn.disabled = true;
  setTimeout(() => ta.focus(), 50);
}

// ---------------------------------------------------------------------------
// Vorschau
// ---------------------------------------------------------------------------

export async function renderRasterView(ctx, id) {
  let text;
  try {
    text = await ctx.loadRasterText(id);
  } catch (e) {
    ctx.view(ctx.topbar({ back: '#/raster', title: 'Raster' }), h('main', { class: 'main' }, h('div', { class: 'empty' }, h('h2', null, 'Raster nicht gefunden'), h('p', null, String(e.message || e)))));
    return;
  }
  const p = parseRaster(text);
  const isOwn = id.startsWith('eigen:');
  const users = ctx.state.groups.filter((g) => g.rasterId === id);
  const actions = [];
  if (isOwn) {
    actions.push(h('a', { class: 'btn btn--primary', href: `#/raster/bearbeiten/${encodeURIComponent(id)}` }, icon('edit'), 'Bearbeiten'));
    actions.push(h('button', { class: 'btn', type: 'button', onclick: () => offerFile(new Blob([text], { type: 'text/markdown' }), `${safeFileName(rasterLabel(p.raster) || 'raster')}.md`, { title: 'Rasterdatei ist fertig' }) }, icon('share'), 'Als Datei'));
    actions.push(h('button', { class: 'btn btn--danger', type: 'button', onclick: async () => {
      if (users.length) {
        toast(`Wird noch genutzt von: ${users.map((g) => g.name).join(', ')}. Bitte dort zuerst ein anderes Raster wählen.`, { duration: 6000 });
        return;
      }
      const ok = await confirmDialog('Dieses eigene Raster löschen? Bereits abgeschlossene Bewertungen behalten ihre Fassung.', { title: 'Raster löschen', ok: 'Löschen', danger: true });
      if (!ok) return;
      await ctx.deleteRasterRecord(id);
      toast('Raster gelöscht.');
      ctx.go('raster', { replace: true });
    } }, icon('trash'), 'Löschen'));
  } else {
    actions.push(h('a', { class: 'btn btn--primary', href: `#/raster/bearbeiten/${encodeURIComponent(`kopie:${id}`)}` }, icon('edit'), 'Als eigenes bearbeiten'));
  }
  const main = h('main', { class: 'main' },
    h('div', { class: 'row', style: { marginBottom: '12px' } },
      h('p', { class: 'muted', style: { margin: 0, flex: 1 } }, `${summary(p.raster)}${users.length ? ` · genutzt von: ${users.map((g) => g.name).join(', ')}` : ''}`),
      h('div', { class: 'btn-group' }, actions)),
    p.ok ? null : messages(p),
    p.raster ? preview(p.raster) : null);
  ctx.view(ctx.topbar({ back: '#/raster', title: rasterLabel(p.raster) || 'Raster', subtitle: isOwn ? 'Eigenes Raster' : 'Fachschaftsraster' }), main);
}

// ---------------------------------------------------------------------------
// Kriterium aufteilen
// ---------------------------------------------------------------------------

/** Stichwörter, an denen Aufzählungspunkte einem Teilkriterium zugeordnet werden. */
const SPLIT_KEYWORDS = {
  wortschatz: ['wortschatz', 'lexik', 'vokabel', 'wortwahl', 'wortfeld'],
  grammatik: ['grammati', 'syntax', 'satzbau', 'sprachnorm', 'satzglied'],
  aussprache: ['aussprache', 'intonation', 'betonung'],
  fachsprache: ['fachsprache', 'fachbegriff', 'fachtermini', 'fachvokabular'],
};

function keywordsFor(part) {
  const p = part.toLowerCase();
  for (const [key, list] of Object.entries(SPLIT_KEYWORDS)) {
    if (p.includes(key) || list.some((w) => p.includes(w))) return [key, ...list];
  }
  return p.split(/[^a-zäöüß]+/).filter((w) => w.length > 3).map((w) => w.slice(0, Math.max(4, w.length - 2)));
}

/** Namensvorschlag für die Teile: aus der Erläuterung, fetten Präfixen oder dem Namen. */
export function suggestParts(k) {
  const splitList = (t) => t.split(/\s*(?:,|\/|&|\bund\b)\s*/).map((x) => x.trim()).filter((x) => x.length > 1);
  const erl = (k.erlaeuterung || '').replace(/^\(|\)$/g, '');
  let parts = splitList(erl.includes(' bei ') ? erl.split(' bei ').pop() : erl);
  if (parts.length >= 2) return parts;
  const labels = [];
  k.cells.forEach((c) => cellParas(c).forEach((p) => {
    const m = p.text.match(/^\*\*([^*]{2,40}?)\s*:?\s*\*\*/);
    if (m && !labels.includes(m[1].replace(/:$/, '').trim())) labels.push(m[1].replace(/:$/, '').trim());
  }));
  if (labels.length >= 2) return labels;
  parts = splitList(k.name);
  return parts.length >= 2 ? parts : ['Teil 1', 'Teil 2'];
}

/** Vorläufige Zuordnung eines Aufzählungspunkts zu den Teilen (null = nicht erkannt). */
export function autoAssign(text, parts) {
  const t = text.toLowerCase().replace(/\*\*/g, '');
  const hit = parts.map((p) => keywordsFor(p).some((w) => t.includes(w)));
  return hit.some(Boolean) ? hit : null;
}

/**
 * Teilt Kriterium ki des Modells in mehrere Teilkriterien auf.
 * Bei „mittelwert“ teilen sich die Teile das bisherige Gewicht: Sie erhalten das
 * ursprüngliche Gewicht, alle übrigen Gewichte werden mit der Anzahl der Teile
 * multipliziert – die Anteile an der Note bleiben exakt gleich.
 */
export function applySplit(model, ki, parts, assign) {
  const k = model.kriterien[ki];
  const n = parts.length;
  const items = model.stufen.map((_, si) => cellParas(k.cells[si]));
  const crits = parts.map((name, j) => ({
    name,
    gewicht: k.gewicht,
    schuelibogen: '',
    erlaeuterung: `aus „${k.name}“`,
    cells: model.stufen.map((_, si) => {
      const chosen = items[si].filter((_, ii) => assign[si][ii][j]);
      if (!chosen.length) return '';
      const list = chosen.length > 1 || chosen.some((x) => x.bullet);
      return chosen.map((x) => (list ? `- ${x.text}` : x.text)).join('\n');
    }),
  }));
  if (model.meta.wertung !== 'summe') model.kriterien.forEach((c, i) => { if (i !== ki) c.gewicht *= n; });
  model.kriterien.splice(ki, 1, ...crits);
}

function splitDialog(model, ki, onDone) {
  const k = model.kriterien[ki];
  const items = model.stufen.map((_, si) => cellParas(k.cells[si]));
  let parts = suggestParts(k);
  let assign;
  let unknown;
  const partsIn = h('input', { class: 'input', type: 'text', value: parts.join(', '), 'aria-label': 'Namen der Teile' });
  const note = h('p', { class: 'muted small' });
  const box = h('div');
  const compute = () => {
    unknown = items.map((list) => list.map(() => false));
    assign = items.map((list, si) => list.map((p, ii) => {
      const a = autoAssign(p.text, parts);
      if (!a) {
        unknown[si][ii] = true;
        return parts.map(() => true);
      }
      return a;
    }));
  };
  const draw = () => {
    const weightNote = model.meta.wertung === 'summe'
      ? 'Achtung: Bei Punkte-Rastern erhöht sich dadurch die mögliche Summe – bitte danach die Umrechnung anpassen.'
      : `Die ${parts.length} Teile teilen sich das Gewicht von „${k.name}“. Damit die Anteile an der Note gleich bleiben, werden die Gewichte der übrigen Kriterien mit ${parts.length} multipliziert.`;
    note.textContent = `Jeder Aufzählungspunkt kommt in die angetippten Teile (auch mehrere möglich). Nicht erkannte Punkte sind vorerst allen Teilen zugeordnet. ${weightNote}`;
    box.replaceChildren(...model.stufen.map((st, si) => h('div', { class: 'split-stufe' },
      h('h3', null, st.name),
      items[si].length ? items[si].map((p, ii) => {
        const row = h('div', { class: `split-item${assign[si][ii].some(Boolean) ? '' : ' is-none'}` },
          h('div', { html: `${p.bullet ? '• ' : ''}${richHTML(p.text)}${unknown[si][ii] ? ' <span class="badge">nicht erkannt – bitte prüfen</span>' : ''}${assign[si][ii].some(Boolean) ? '' : ' <span class="badge">wird nicht übernommen</span>'}` }),
          h('div', { class: 'chips split-chips' }, parts.map((name, j) => h('button', {
            class: `chip${assign[si][ii][j] ? ' is-on' : ''}`,
            type: 'button',
            'aria-pressed': String(assign[si][ii][j]),
            onclick: () => { assign[si][ii][j] = !assign[si][ii][j]; unknown[si][ii] = false; draw(); },
          }, name))));
        return row;
      }) : h('p', { class: 'muted small' }, '– leer –'))));
  };
  partsIn.addEventListener('change', () => {
    const next = partsIn.value.split(',').map((x) => x.trim()).filter(Boolean);
    if (next.length < 2) { toast('Bitte mindestens zwei Teile angeben, durch Komma getrennt.'); return; }
    parts = next;
    compute();
    draw();
  });
  compute();
  draw();
  openDialog({
    title: `„${k.name}“ aufteilen`,
    wide: true,
    body: [h('label', { class: 'field' }, h('span', null, 'Teile (durch Komma getrennt)'), partsIn), note, box],
    actions: [
      { label: 'Abbrechen' },
      {
        label: 'Aufteilen',
        kind: 'primary',
        onClick: () => {
          applySplit(model, ki, parts, assign);
          onDone();
          toast(`„${k.name}“ in ${parts.length} Kriterien aufgeteilt.`);
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export async function renderRasterEditor(ctx, param) {
  let id = null;
  let basedOn = null;
  let text;
  if (param === 'neu') text = EMPTY_TEMPLATE;
  else if (param.startsWith('kopie:')) {
    basedOn = param.slice(6);
    text = await ctx.loadRasterText(basedOn);
  } else {
    id = param;
    text = await ctx.loadRasterText(id);
  }
  let p = parseRaster(text);
  let model = p.raster;
  let mode = p.ok && model.meta.typ !== 'matrix' ? 'form' : 'text';
  let dirty = false;
  let recordSoon = () => {};
  let recordNow = () => {};

  const status = h('div');
  const body = h('div');
  const code = h('textarea', { class: 'input code', spellcheck: 'false' });
  const recheck = debounce(() => {
    p = parseRaster(code.value);
    status.replaceChildren(messages(p));
  }, 300);
  code.addEventListener('input', () => { dirty = true; recheck(); recordSoon(); });

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Ansicht' });
  const setMode = (m) => {
    if (m === mode) return;
    if (m === 'form') {
      p = parseRaster(code.value);
      if (!p.ok) {
        status.replaceChildren(messages(p));
        toast('Bitte zuerst die Fehler in der Textansicht beheben.');
        return;
      }
      if (p.raster.meta.typ === 'matrix') {
        toast('Matrix-Raster lassen sich nur in der Textansicht bearbeiten.');
        return;
      }
      model = p.raster;
    } else {
      code.value = serializeRaster(model);
      p = parseRaster(code.value);
    }
    mode = m;
    draw();
    recordNow();
  };
  for (const [m, label] of [['form', 'Formular'], ['text', 'Text']]) {
    seg.append(h('button', { type: 'button', 'aria-pressed': String(m === mode), dataset: { m }, onclick: () => setMode(m) }, label));
  }

  const changed = () => { dirty = true; recordSoon(); };
  const input = (label, value, onInput, opts = {}) => {
    const el = h(opts.area ? 'textarea' : 'input', { class: 'input', type: opts.area ? undefined : 'text', placeholder: opts.placeholder || '', rows: opts.rows });
    el.value = value || '';
    el.addEventListener('input', () => { onInput(el.value); changed(); });
    return h('label', { class: 'field' }, h('span', null, label), el);
  };
  const segOf = (options, value, onPick) => {
    const s = h('div', { class: 'seg' });
    for (const [v, label] of options) {
      s.append(h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { onPick(v); changed(); drawForm(); } }, label));
    }
    return s;
  };

  function drawForm() {
    const m = model.meta;
    const isSum = m.wertung === 'summe';
    const kompakt = m.schuelibogen === 'kompakt';
    const parts = [];
    parts.push(h('section', { class: 'ed-section panel' },
      h('h3', null, 'Allgemein'),
      h('div', { class: 'ed-grid' },
        input('Anzeigename in der App (z. B. Biologie EE26)', m.name, (v) => { m.name = v; }),
        input('Titel', m.titel, (v) => { m.titel = v; }),
        input('Titel auf dem Schülibogen (optional)', m.titel_schuelibogen, (v) => { m.titel_schuelibogen = v; }),
        input('Fach', m.fach, (v) => { m.fach = v; }),
        input('Klassen (optional)', m.klassen, (v) => { m.klassen = v; }, { placeholder: 'z. B. 5-10' }),
        input('Kopfzeile des Bogens', m.kopfzeile.join(' | '), (v) => { m.kopfzeile = v.split('|').map((x) => x.trim()).filter(Boolean); }, { placeholder: 'Name | Klasse | Datum | Note' }),
        input('Kommentarspalte (leer = Kommentare unter der Tabelle)', m.kommentarspalte, (v) => { m.kommentarspalte = v.trim(); })),
      h('div', { class: 'ed-grid', style: { marginTop: '8px' } },
        h('div', { class: 'field' }, h('span', null, 'Wertung'), segOf([['mittelwert', 'Mittelwert der Noten'], ['summe', 'Punkte addieren']], m.wertung, (v) => {
          m.wertung = v;
          if (v === 'summe' && !model.umrechnungen.length) model.umrechnungen.push({ titel: '', notenpunkte: false, rows: [{ summeText: '0', von: 0, bis: 0, noteText: '6', note: 6 }] });
        })),
        h('div', { class: 'field' }, h('span', null, 'Schülibogen'), segOf([['vollstaendig', 'alle Beschreibungen'], ['kompakt', 'kompakt mit Kreuzen']], m.schuelibogen, (v) => { m.schuelibogen = v; })),
        h('label', { class: 'check' }, (() => {
          const cb = h('input', { type: 'checkbox', checked: m.notendefinitionen });
          cb.addEventListener('change', () => { m.notendefinitionen = cb.checked; changed(); });
          return cb;
        })(), 'Notendefinitionen (§5 NVO) anhängen'))));

    // Stufen
    const stRows = model.stufen.map((st, i) => h('div', { class: 'ed-row' },
      (() => { const el = h('input', { class: 'input', type: 'text', value: st.name, 'aria-label': 'Stufe' }); el.addEventListener('input', () => { st.name = el.value; changed(); }); return el; })(),
      (() => {
        const el = h('input', { class: 'input', type: 'text', value: isSum ? st.punkteText : st.noteText, 'aria-label': isSum ? 'Punkte' : 'Note', placeholder: isSum ? 'Punkte' : 'Note' });
        el.addEventListener('input', () => { if (isSum) st.punkteText = el.value; else st.noteText = el.value; changed(); });
        return el;
      })(),
      kompakt ? (() => { const el = h('input', { class: 'input', type: 'text', value: st.kreuz, 'aria-label': 'Kreuz', placeholder: 'Kreuz' }); el.addEventListener('input', () => { st.kreuz = el.value; changed(); }); return el; })() : h('span'),
      h('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': `Stufe ${st.name} entfernen`, onclick: () => {
        if (model.stufen.length <= 2) { toast('Ein Raster braucht mindestens zwei Stufen.'); return; }
        model.stufen.splice(i, 1);
        model.kriterien.forEach((k) => k.cells.splice(i, 1));
        changed();
        drawForm();
      } }, icon('trash'))));
    parts.push(h('section', { class: 'ed-section panel' },
      h('h3', null, 'Stufen (Spalten des Rasters, in der Reihenfolge des Bogens)'),
      h('div', { class: 'ed-row muted small' }, h('span', null, 'Name'), h('span', null, isSum ? 'Punkte (z. B. 3 oder „1, 0“)' : 'Note (z. B. 2, 2+, 5 bis 6)'), h('span', null, kompakt ? 'Kreuz-Beschriftung' : ''), h('span')),
      stRows,
      h('button', { class: 'btn', type: 'button', onclick: () => {
        model.stufen.push({ name: `Stufe ${model.stufen.length + 1}`, noteText: '', note: null, punkteText: '', punkte: [], kreuz: '' });
        model.kriterien.forEach((k) => k.cells.push(''));
        changed();
        drawForm();
      } }, icon('plus'), 'Stufe hinzufügen')));

    // Kriterien
    const crits = model.kriterien.map((k, ki) => h('div', { class: 'ed-crit' },
      h('div', { class: 'ed-grid' },
        input('Kriterium', k.name, (v) => { k.name = v; }),
        input('Erläuterung (optional)', k.erlaeuterung, (v) => { k.erlaeuterung = v; }),
        input('Name auf dem Schülibogen (optional)', k.schuelibogen, (v) => { k.schuelibogen = v; }),
        isSum
          ? h('label', { class: 'check' }, (() => {
            const cb = h('input', { type: 'checkbox', checked: k.gewicht !== 0 });
            cb.addEventListener('change', () => { k.gewicht = cb.checked ? 1 : 0; changed(); });
            return cb;
          })(), 'zählt zur Punktsumme')
          : input('Gewicht (0 = zählt nicht)', String(k.gewicht).replace('.', ','), (v) => { const n = parseFloat(v.replace(',', '.')); k.gewicht = Number.isFinite(n) && n >= 0 ? n : 1; }),
        input('Zwischenüberschrift davor (optional)', k.abschnitt, (v) => { k.abschnitt = v; })),
      h('div', { class: 'ed-cells' }, model.stufen.map((st, si) => input(st.name || `Stufe ${si + 1}`, k.cells[si], (v) => { k.cells[si] = v; }, { area: true, rows: 3, placeholder: 'Beschreibung („- “ für Aufzählung, **fett**)' }))),
      h('div', { class: 'row ed-tools', style: { marginTop: '8px' } },
        h('button', { class: 'btn', type: 'button', disabled: ki === 0, 'aria-label': `${k.name} nach oben`, onclick: () => {
          model.kriterien.splice(ki - 1, 0, model.kriterien.splice(ki, 1)[0]);
          changed();
          drawForm();
        } }, '↑ Nach oben'),
        h('button', { class: 'btn', type: 'button', disabled: ki === model.kriterien.length - 1, 'aria-label': `${k.name} nach unten`, onclick: () => {
          model.kriterien.splice(ki + 1, 0, model.kriterien.splice(ki, 1)[0]);
          changed();
          drawForm();
        } }, '↓ Nach unten'),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const copy = JSON.parse(JSON.stringify(k));
          copy.name = `${k.name} (Kopie)`;
          model.kriterien.splice(ki + 1, 0, copy);
          changed();
          drawForm();
        } }, 'Kopieren'),
        h('button', { class: 'btn', type: 'button', onclick: () => splitDialog(model, ki, () => { changed(); drawForm(); }) }, 'Aufteilen …'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn--danger', type: 'button', onclick: () => {
          if (model.kriterien.length <= 1) { toast('Ein Raster braucht mindestens ein Kriterium.'); return; }
          model.kriterien.splice(ki, 1);
          changed();
          drawForm();
        } }, icon('trash'), 'Entfernen'))));
    parts.push(h('section', { class: 'ed-section' },
      h('h3', null, 'Kriterien'),
      crits,
      h('button', { class: 'btn', type: 'button', onclick: () => {
        model.kriterien.push({ name: 'Neues Kriterium', gewicht: 1, schuelibogen: '', erlaeuterung: '', cells: model.stufen.map(() => '') });
        changed();
        drawForm();
      } }, icon('plus'), 'Kriterium hinzufügen')));

    // Umrechnung
    if (isSum) {
      parts.push(h('section', { class: 'ed-section panel' },
        h('h3', null, 'Umrechnung Summe → Note'),
        model.umrechnungen.map((u, ui) => h('div', { class: 'ed-crit' },
          h('div', { class: 'ed-grid' },
            input('Bezeichnung (z. B. Klasse 5-10)', u.titel, (v) => { u.titel = v; }),
            h('label', { class: 'check' }, (() => {
              const cb = h('input', { type: 'checkbox', checked: u.notenpunkte });
              cb.addEventListener('change', () => { u.notenpunkte = cb.checked; changed(); drawForm(); });
              return cb;
            })(), 'Summe = Notenpunkte')),
          u.notenpunkte ? null : h('div', null,
            u.rows.map((row, ri) => h('div', { class: 'ed-row' },
              (() => { const el = h('input', { class: 'input', type: 'text', value: row.summeText, placeholder: 'Summe, z. B. 15 bis 14' }); el.addEventListener('input', () => { row.summeText = el.value; changed(); }); return el; })(),
              (() => { const el = h('input', { class: 'input', type: 'text', value: row.noteText, placeholder: 'Note' }); el.addEventListener('input', () => { row.noteText = el.value; changed(); }); return el; })(),
              h('span'),
              h('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': 'Zeile entfernen', onclick: () => { u.rows.splice(ri, 1); changed(); drawForm(); } }, icon('trash')))),
            h('button', { class: 'btn', type: 'button', onclick: () => { u.rows.push({ summeText: '', noteText: '' }); changed(); drawForm(); } }, icon('plus'), 'Zeile')),
          h('button', { class: 'btn btn--danger', type: 'button', style: { marginTop: '8px' }, onclick: () => { model.umrechnungen.splice(ui, 1); changed(); drawForm(); } }, 'Umrechnung entfernen'))),
        h('button', { class: 'btn', type: 'button', onclick: () => { model.umrechnungen.push({ titel: '', notenpunkte: false, rows: [] }); changed(); drawForm(); } }, icon('plus'), 'Umrechnung hinzufügen')));
    }

    // Texte
    parts.push(h('section', { class: 'ed-section panel' },
      h('h3', null, 'Texte auf dem Bogen (optional)'),
      h('div', { class: 'ed-grid' },
        input('Einleitung (über dem Raster)', model.einleitung, (v) => { model.einleitung = v; }, { area: true, rows: 3 }),
        input('Hinweise (unter dem Raster)', model.hinweise, (v) => { model.hinweise = v; }, { area: true, rows: 3 }),
        input('Fußnoten (eine pro Zeile, „1. …“)', model.fussnoten, (v) => { model.fussnoten = v; }, { area: true, rows: 3 }),
        input('Freitextfelder (eine Frage pro Zeile)', model.freitext.join('\n'), (v) => { model.freitext = v.split('\n').map((x) => x.trim()).filter(Boolean); }, { area: true, rows: 3 }))));
    body.replaceChildren(...parts);
  }

  function draw() {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === mode)));
    if (mode === 'text') {
      if (!code.value) code.value = model ? serializeRaster(model) : text;
      body.replaceChildren(h('p', { class: 'muted small' }, 'Format siehe raster/FORMAT.md im Repository. Kommentare (<!-- … -->) bleiben in der Textansicht erhalten.'), code);
      status.replaceChildren(messages(parseRaster(code.value)));
    } else {
      status.replaceChildren();
      drawForm();
    }
  }
  code.value = text;
  draw();

  const currentText = () => (mode === 'form' ? serializeRaster(model) : code.value);

  // --- Rückgängig / Wiederholen (mehrere Schritte, solange der Editor offen ist)
  const hist = [currentText()];
  let hpos = 0;
  const undoBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => undo() }, '↶ Rückgängig');
  const redoBtn = h('button', { class: 'btn', type: 'button', disabled: true, onclick: () => redo() }, '↷ Wiederholen');
  const updH = () => {
    undoBtn.disabled = hpos <= 0;
    redoBtn.disabled = hpos >= hist.length - 1;
  };
  recordNow = () => {
    const t = currentText();
    if (t === hist[hpos]) return;
    hist.splice(hpos + 1);
    hist.push(t);
    if (hist.length > 200) hist.shift();
    hpos = hist.length - 1;
    updH();
  };
  recordSoon = debounce(recordNow, 400);
  const applyHist = (t) => {
    if (mode === 'form') {
      model = parseRaster(t).raster;
      drawForm();
    } else {
      code.value = t;
      p = parseRaster(t);
      status.replaceChildren(messages(p));
    }
    dirty = true;
    updH();
  };
  const undo = () => {
    recordSoon.flush();
    if (hpos > 0) applyHist(hist[--hpos]);
  };
  const redo = () => {
    recordSoon.flush();
    if (hpos < hist.length - 1) applyHist(hist[++hpos]);
  };
  const save = async () => {
    const t = currentText().trim();
    const res = parseRaster(t);
    if (!res.ok) {
      status.replaceChildren(messages(res));
      window.scrollTo(0, 0);
      toast('Das Raster enthält noch Fehler.');
      return;
    }
    const rec = await saveOwn(ctx, `${t}\n`, { id, basedOn });
    dirty = false;
    toast('Raster gespeichert. Neue Runden nutzen diese Fassung.');
    ctx.go(`raster/ansehen/${encodeURIComponent(rec.id)}`, { replace: true });
  };
  const showPreview = () => {
    const res = parseRaster(currentText());
    openDialog({ title: 'Vorschau', wide: true, body: [messages(res), res.raster ? preview(res.raster) : ''], actions: [{ label: 'Schließen' }] });
  };
  const back = async () => {
    if (dirty && !(await confirmDialog('Änderungen verwerfen?', { title: 'Editor verlassen', ok: 'Verwerfen', danger: true }))) return;
    dirty = false;
    ctx.go(id ? `raster/ansehen/${encodeURIComponent(id)}` : 'raster');
  };

  const main = h('main', { class: 'main' },
    h('div', { class: 'row ed-bar', style: { marginBottom: '12px' } }, seg, undoBtn, redoBtn, h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: showPreview }, 'Vorschau')),
    status, body);
  ctx.view(ctx.topbar({
    title: id ? 'Raster bearbeiten' : basedOn ? 'Eigene Fassung erstellen' : 'Neues Raster',
    subtitle: rasterLabel(model) || '',
    actions: [
      h('button', { class: 'btn', type: 'button', onclick: back }, 'Abbrechen'),
      h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Speichern'),
    ],
  }), main);
}
