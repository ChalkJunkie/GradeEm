/**
 * Grade’Em – mündliche Noten nach Bewertungsraster
 * Hauptmodul: Zustand, Datenübernahme, Navigation und Bildschirme.
 */
import * as db from './db.js';
import { describeGrade, formatDecimal } from './grades.js';
import { analyzeNameText, extractNames, splitName, nameKey, buildCSV } from './csv.js';
import {
  buildSheet, buildGradeList, gradeListTable, studentName, compareStudents, todayISO, formatDate, klasseOf, weightsText,
} from './sheet-data.js';
import {
  h, icon, toast, openDialog, confirmDialog, promptDialog, offerFile, safeFileName, debounce, uid,
} from './ui.js';
import { openPrintView, buildSheetPages, buildListPages } from './print.js';
import { sheetsToDocxBlob } from './docx-export.js';
import { parseRaster, hashText, rasterLabel } from './raster.js';
import { evaluateRaster, statusOf as rasterStatus, defaultWeights, emptyCrit } from './engine.js';
import { BIOLOGIE_ID, BIOLOGIE_FILE, BIOLOGIE_MD, BUILTIN_INDEX, BUILTIN_RASTER } from './raster-builtin.js';
import { renderRate, studentGrid as gridOf } from './rate-view.js';
import { renderRasterLibrary, renderRasterView, renderRasterEditor, rasterSelect } from './raster-ui.js';

export const APP_VERSION = '1.3.1';
export const APP_NAME = 'Grade’Em';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.de';

/**
 * Weiche Trennstellen für lange Wörter – nur für die Anzeige im Raster, damit
 * schmale Spalten (Hochformat) sauber umbrechen. Der Wortlaut bleibt unverändert.
 */
const DEFAULT_SETTINGS = {
  scale: 'quarter', // Standard für neue Lerngruppen: 'quarter' | 'points' | 'both'
  stepBoth: 'quarter', // Standard-Schrittweite beim Nachschärfen, wenn beide Skalen angezeigt werden
  nameOrder: 'last-first', // Anzeige in Listen
  theme: 'auto',
  lastBackupAt: null,
  defaultRaster: BIOLOGIE_ID, // Raster für neue Lerngruppen
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  groups: [],
  rounds: [],
  assessments: new Map(),
  rasters: new Map(), // id → { id, source, file, text, hash, basedOn }
  versions: new Map(), // hash → { hash, text, model }
  fsIndex: [], // Verzeichnis der Fachschaftsraster (raster/index.json)
  exportSelection: new Map(), // roundId → Set(studentId)
  navDirection: 0,
};

const app = document.getElementById('app');

// ===========================================================================
// Daten laden & speichern
// ===========================================================================

async function loadAll() {
  const [meta, groups, rounds, assessments, rasters, versions] = await Promise.all(
    ['meta', 'groups', 'rounds', 'assessments', 'rasters', 'rasterVersions'].map((x) => db.getAll(x)),
  );
  const s = meta.find((m) => m.key === 'settings');
  state.settings = { ...DEFAULT_SETTINGS, ...(s ? s.value : {}) };
  state.groups = groups.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de', { numeric: true }));
  state.rounds = rounds;
  state.assessments = new Map(assessments.map((a) => [a.id, a]));
  state.rasters = new Map(rasters.map((r) => [r.id, r]));
  state.versions = new Map(versions.map((v) => [v.hash, { hash: v.hash, text: v.text }]));
  await migrate();
  applyTheme();
}

// ===========================================================================
// Datenübernahme aus Version 1.x (festes Biologie-Raster) in das Raster-Modell
// ===========================================================================

const LEGACY_KEYS = ['quality', 'knowledge', 'language'];

function legacyWeights(w) {
  return LEGACY_KEYS.map((k) => (w && Number.isFinite(Number(w[k])) ? Math.max(0, Number(w[k])) : 1));
}

async function migrate() {
  const ops = [];
  const bioHash = hashText(BIOLOGIE_MD);
  const gw = legacyWeights(state.settings.weights);
  for (const g of state.groups) {
    if (!g.rasterId) {
      g.rasterId = BIOLOGIE_ID;
      g.weightsByRaster = { ...(g.weightsByRaster || {}), [BIOLOGIE_ID]: gw };
      ops.push({ store: 'groups', put: g });
    }
  }
  for (const r of state.rounds) {
    if (!r.rasterHash) {
      r.rasterId = BIOLOGIE_ID;
      r.rasterHash = bioHash;
      ops.push({ store: 'rounds', put: r });
    }
  }
  for (const a of state.assessments.values()) {
    if (!Array.isArray(a.crit)) {
      const rows = a.rows || {};
      a.crit = LEGACY_KEYS.map((k) => ({
        sel: ((rows[k] && rows[k].cols) || []).map((x) => x - 1).filter((l) => l >= 0 && l <= 5),
        pts: {},
        comment: (rows[k] && rows[k].comment) || '',
      }));
      a.weights = legacyWeights(a.weights);
      delete a.rows;
      ops.push({ store: 'assessments', put: a });
    }
  }
  if (!state.versions.has(bioHash)) {
    state.versions.set(bioHash, { hash: bioHash, text: BIOLOGIE_MD });
    ops.push({ store: 'rasterVersions', put: { hash: bioHash, text: BIOLOGIE_MD } });
  }
  if (!state.rasters.has(BIOLOGIE_ID)) {
    const rec = { id: BIOLOGIE_ID, source: 'fachschaft', file: BIOLOGIE_FILE, text: BIOLOGIE_MD, hash: bioHash, updatedAt: new Date().toISOString() };
    state.rasters.set(rec.id, rec);
    ops.push({ store: 'rasters', put: rec });
  }
  if (ops.length) await db.batch(ops);
}

// ===========================================================================
// Raster
// ===========================================================================

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

/**
 * Verzeichnis der Fachschaftsraster: mitgelieferte Liste, ergänzt bzw. aktualisiert
 * durch raster/index.json aus dem Repository (falls erreichbar).
 */
async function loadFsIndex() {
  const list = BUILTIN_INDEX.map((e) => ({ ...e }));
  try {
    const res = await fetch('raster/index.json');
    if (res.ok) {
      const remote = await res.json();
      if (Array.isArray(remote)) {
        for (const e of remote) {
          if (!e || typeof e.file !== 'string') continue;
          const i = list.findIndex((x) => x.file === e.file);
          if (i >= 0) list[i] = { ...list[i], ...e };
          else list.push(e);
        }
      }
    }
  } catch {
    /* offline oder nicht erreichbar – mitgelieferte Liste genügt */
  }
  state.fsIndex = list;
}

function versionModel(hash) {
  const v = state.versions.get(hash);
  if (!v) return null;
  if (!v.model) v.model = parseRaster(v.text).raster;
  return v.model;
}

async function storeVersion(text) {
  const hash = hashText(text);
  if (!state.versions.has(hash)) {
    state.versions.set(hash, { hash, text });
    await db.put('rasterVersions', { hash, text });
  }
  return hash;
}

async function saveRasterRecord(rec) {
  rec.updatedAt = new Date().toISOString();
  rec.hash = await storeVersion(rec.text);
  state.rasters.set(rec.id, rec);
  await db.put('rasters', rec);
  return rec;
}

async function deleteRasterRecord(id) {
  state.rasters.delete(id);
  await db.del('rasters', id);
}

function recordModel(rec) {
  return rec ? versionModel(rec.hash) : null;
}

function recordLabel(rec) {
  return rec ? rasterLabel(recordModel(rec)) : '';
}

function ownRasters() {
  return [...state.rasters.values()].filter((r) => r.source === 'eigen').sort((a, b) => recordLabel(a).localeCompare(recordLabel(b), 'de'));
}

const fsFile = (id) => `${id.slice(3)}.md`;

async function loadRasterText(id) {
  const rec = state.rasters.get(id);
  if (id.startsWith('eigen:')) {
    if (!rec) throw new Error('Dieses Raster gibt es nicht mehr.');
    return rec.text;
  }
  if (!id.startsWith('fs:')) throw new Error('Unbekanntes Raster.');
  const file = fsFile(id);
  // 1. aktuelle Fassung aus dem Repository, 2. mitgelieferte Fassung, 3. zuletzt gespeicherte Fassung
  try {
    const t = await fetchText(`raster/${file}`);
    if (parseRaster(t).ok) return t;
  } catch {
    /* nicht erreichbar */
  }
  if (BUILTIN_RASTER[file]) return BUILTIN_RASTER[file];
  if (rec) return rec.text;
  throw new Error(`Die Rasterdatei „raster/${file}“ ist nicht erreichbar. Läuft die App über GitHub Pages, muss im Repository die Datei „.nojekyll“ liegen (siehe README, Abschnitt „Fachschaftsraster im Repository pflegen“).`);
}

async function ensureRaster(id) {
  const have = state.rasters.get(id);
  if (have) return have;
  const text = await loadRasterText(id);
  const p = parseRaster(text);
  if (!p.ok) throw new Error(`Das Raster enthält Fehler: ${p.errors[0]}`);
  const rec = { id, source: id.startsWith('fs:') ? 'fachschaft' : 'eigen', file: id.startsWith('fs:') ? fsFile(id) : '', text };
  return saveRasterRecord(rec);
}

/** Neue Fassungen der Fachschaftsraster übernehmen (gelten für neue Runden). */
async function refreshFachschaftRasters() {
  for (const rec of [...state.rasters.values()].filter((r) => r.source === 'fachschaft')) {
    try {
      const text = await loadRasterText(rec.id);
      if (hashText(text) !== rec.hash && parseRaster(text).ok) await saveRasterRecord({ ...rec, text });
    } catch {
      /* nicht verfügbar – alte Fassung bleibt */
    }
  }
}

function roundRaster(r) {
  return (r && versionModel(r.rasterHash)) || versionModel(hashText(BIOLOGIE_MD));
}

function groupWeights(g, raster, rasterId) {
  const w = g && g.weightsByRaster && g.weightsByRaster[rasterId];
  return Array.isArray(w) && w.length === raster.kriterien.length ? w : defaultWeights(raster);
}

function groupUmrechnung(g, rasterId) {
  return (g && g.umrechnungByRaster && g.umrechnungByRaster[rasterId]) || 0;
}

const statusFor = (r, a) => rasterStatus(roundRaster(r), a);

/** Anzeigename des Rasters einer Runde (aktueller Name des Rasters, sonst Name der Fassung). */
function roundLabel(r) {
  const rec = r && state.rasters.get(r.rasterId);
  const m = rec && recordModel(rec);
  return (m && m.meta.name) || rasterLabel(roundRaster(r));
}

/** Leere Runde an eine neuere Fassung des Gruppenrasters anpassen. */
async function syncEmptyRound(g, r) {
  const rec = state.rasters.get(g.rasterId);
  if (!rec || (r.rasterId === rec.id && r.rasterHash === rec.hash)) return;
  if ([...state.assessments.values()].some((a) => a.roundId === r.id)) return;
  r.rasterId = rec.id;
  r.rasterHash = rec.hash;
  await saveRound(r);
}

function saveSettings() {
  return db.put('meta', { key: 'settings', value: state.settings });
}

function saveGroup(g) {
  g.updatedAt = new Date().toISOString();
  if (!state.groups.includes(g)) state.groups.push(g);
  return db.put('groups', g);
}

function saveRound(r) {
  if (!state.rounds.includes(r)) state.rounds.push(r);
  return db.put('rounds', r);
}

function saveAssessment(a) {
  a.updatedAt = new Date().toISOString();
  const r = state.rounds.find((x) => x.id === a.roundId);
  a.proposal = evaluateRaster(roundRaster(r), a).proposal; // Vorschlag zusätzlich speichern (getrennt von der Endnote)
  state.assessments.set(a.id, a);
  return db.put('assessments', a);
}

const getGroup = (id) => state.groups.find((g) => g.id === id);
const roundsOf = (gid) => state.rounds.filter((r) => r.groupId === gid).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
const sortedStudents = (g) => [...(g.students || [])].sort(compareStudents);
const countLabel = (n) => `${n} ${n === 1 ? 'Schüli' : 'Schülis'}`;

const assessmentId = (roundId, studentId) => `${roundId}:${studentId}`;
const getAssessment = (roundId, studentId) => state.assessments.get(assessmentId(roundId, studentId)) || null;

function currentRound(g) {
  let r = state.rounds.find((x) => x.id === g.currentRoundId && x.groupId === g.id);
  if (!r) r = roundsOf(g.id)[0] || null;
  return r;
}

function defaultRoundTitle(gid) {
  const d = new Date();
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  let t = m >= 8 ? `1. Halbjahr ${y}/${String(y + 1).slice(2)}` : m === 1 ? `1. Halbjahr ${y - 1}/${String(y).slice(2)}` : `2. Halbjahr ${y - 1}/${String(y).slice(2)}`;
  const existing = new Set(roundsOf(gid).map((r) => r.title));
  if (existing.has(t)) {
    let n = 2;
    while (existing.has(`${t} (${n})`)) n++;
    t = `${t} (${n})`;
  }
  return t;
}

async function createRound(g, title) {
  const rec = await ensureRaster(g.rasterId || state.settings.defaultRaster || BIOLOGIE_ID);
  const r = {
    id: uid('r'), groupId: g.id, title: title || defaultRoundTitle(g.id), createdAt: new Date().toISOString(),
    rasterId: rec.id, rasterHash: rec.hash,
  };
  await saveRound(r);
  g.currentRoundId = r.id;
  await saveGroup(g);
  return r;
}

async function ensureRound(g) {
  return currentRound(g) || createRound(g);
}

const SCALES = ['quarter', 'points', 'both'];
const SCALE_LABELS = { quarter: 'Viertelnoten', points: 'Notenpunkte', both: 'Viertelnoten und Notenpunkte' };

/** Notenskala einer Lerngruppe (Anzeige und Export). */
function displayScale(g) {
  return g && SCALES.includes(g.scale) ? g.scale : state.settings.scale;
}

/** Schrittweite beim Nachschärfen in dieser Lerngruppe. */
function stepScale(g) {
  const s = displayScale(g);
  if (s !== 'both') return s;
  return g && (g.stepBoth === 'quarter' || g.stepBoth === 'points') ? g.stepBoth : state.settings.stepBoth;
}

/**
 * Auswahl „Notenskala“ (+ Schrittweite bei „Beides“) für ein Objekt mit
 * den Feldern scale und stepBoth – Lerngruppe oder Einstellungen.
 */
function scaleControls(target, onChange) {
  const box = h('div');
  function seg(key, options) {
    const el = h('div', { class: 'seg', role: 'group' });
    for (const [v, label] of options) {
      el.append(h('button', { type: 'button', 'aria-pressed': String(target[key] === v), onclick: async () => {
        target[key] = v;
        build();
        if (onChange) await onChange(key, v);
      } }, label));
    }
    return el;
  }
  function build() {
    const parts = [seg('scale', [['quarter', 'Viertelnoten'], ['points', 'Notenpunkte'], ['both', 'Beides']])];
    if (target.scale === 'both') {
      parts.push(h('div', { class: 'field', style: { marginTop: '12px', marginBottom: 0 } },
        h('span', null, 'Nachschärfen in Schritten von'),
        seg('stepBoth', [['quarter', 'einer Viertelnote'], ['points', 'einem Punkt']])));
    }
    box.replaceChildren(...parts);
  }
  if (!SCALES.includes(target.scale)) target.scale = state.settings.scale;
  if (target.stepBoth !== 'quarter' && target.stepBoth !== 'points') target.stepBoth = state.settings.stepBoth;
  build();
  return box;
}

function nameFor(s) {
  return studentName(s, state.settings.nameOrder);
}

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ===========================================================================
// Navigation
// ===========================================================================

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return parts;
}

function go(path, { replace = false } = {}) {
  const url = `#/${path}`;
  if (replace) location.replace(url);
  else location.hash = url;
}

let cleanupView = null;

async function render() {
  if (cleanupView) {
    try { cleanupView(); } catch { /* ignorieren */ }
    cleanupView = null;
  }
  const [a, b, c, d] = route();
  try {
    if (!a) return renderHome();
    if (a === 'einstellungen') return renderSettings();
    if (a === 'raster') {
      if (!b) return renderRasterLibrary(ctx);
      if (b === 'ansehen' && c) return await renderRasterView(ctx, c);
      if (b === 'bearbeiten' && c) return await renderRasterEditor(ctx, c);
    }
    if (a === 'gruppe' && b) {
      const g = getGroup(b);
      if (!g) return go('', { replace: true });
      if (!c) return await renderGroup(g);
      if (c === 'namen') return renderGroupEdit(g);
      if (c === 'export') return await renderExport(g);
      if (c === 'bewerten' && d) return await renderRate(ctx, g, d);
    }
    go('', { replace: true });
  } catch (err) {
    console.error(err);
    app.replaceChildren(h('main', { class: 'main' }, h('div', { class: 'empty' }, h('h2', null, 'Diese Ansicht ließ sich nicht öffnen'), h('p', null, String(err && err.message ? err.message : err)), h('a', { class: 'btn', href: '#/' }, 'Zur Startseite'))));
  }
}

function topbar({ back, title, subtitle, actions = [], brand = false }) {
  return h('header', { class: 'topbar' },
    back ? h('a', { class: 'btn btn--icon btn--ghost', href: back, 'aria-label': 'Zurück' }, icon('back')) : null,
    brand
      ? h('div', { class: 'brand topbar__title' },
        h('div', { class: 'brand' },
          h('img', { src: 'icons/icon.svg', alt: '' }),
          h('b', null, 'Grade', h('span', null, '’Em')),
          h('span', { class: 'credit' },
            h('span', null, 'vibe coded by Verena Lohmüller & Claude'),
            h('a', { href: LICENSE_URL, target: '_blank', rel: 'noopener license' }, 'CC BY-NC-SA 4.0'))))
      : h('div', { class: 'topbar__title' }, h('h1', null, title), subtitle ? h('small', null, subtitle) : null),
    ...actions,
  );
}

function view(...children) {
  app.replaceChildren(...children);
}

// ===========================================================================
// Startseite: Lerngruppen
// ===========================================================================

function renderHome() {
  document.title = APP_NAME;
  const groups = state.groups;
  const main = h('main', { class: 'main' });

  const lastBackup = state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt) : null;
  const hasData = state.assessments.size > 0;
  if (hasData && (!lastBackup || Date.now() - lastBackup.getTime() > 14 * 864e5)) {
    main.append(h('div', { class: 'notice' },
      h('p', null, lastBackup ? `Letztes Backup am ${formatDate(todayISO(lastBackup))}. Sichere deine Noten regelmäßig als Datei.` : 'Noch kein Backup. Sichere deine Noten als Datei, damit sie bei Geräteverlust nicht verloren gehen.'),
      h('button', { class: 'btn', type: 'button', onclick: exportBackup }, icon('download'), 'Backup sichern')));
  }

  if (!groups.length) {
    main.append(h('div', { class: 'empty' },
      h('img', { src: 'icons/icon.svg', alt: '' }),
      h('h2', null, 'Lege deine erste Lerngruppe an'),
      h('p', null, 'Raster wählen, Namen per CSV-Datei, eingefügter Liste oder einzeln eintragen. Danach tippst du im Raster an, was zutrifft – die Note rechnet Grade’Em aus.'),
      h('div', { class: 'btn-group', style: { justifyContent: 'center' } },
        h('button', { class: 'btn btn--primary btn--big', type: 'button', onclick: newGroupDialog }, icon('plus'), 'Neue Lerngruppe'),
        h('button', { class: 'btn btn--big', type: 'button', onclick: createDemoGroup }, 'Beispielgruppe ausprobieren'))));
  } else {
    const list = h('div', { class: 'group-list' });
    for (const g of groups) {
      const r = currentRound(g);
      const students = g.students || [];
      const done = r ? students.filter((s) => statusFor(r, getAssessment(r.id, s.id)) === 'done').length : 0;
      const pct = students.length ? Math.round((done / students.length) * 100) : 0;
      const fach = r ? roundLabel(r) : '';
      list.append(h('a', { class: 'group-item', href: `#/gruppe/${g.id}` },
        h('span', { class: 'group-item__name' }, g.name || 'Ohne Namen'),
        g.klasse ? h('span', { class: 'group-item__klasse' }, g.klasse) : h('span'),
        h('span', { class: 'group-item__meta' }, `${countLabel(students.length)}${fach ? ` · ${fach}` : ''}${r ? ` · ${r.title} · ${done} von ${students.length} bewertet` : ''}`),
        h('span', { class: 'progress', 'aria-hidden': 'true' }, h('i', { style: { width: `${pct}%` } }))));
    }
    main.append(h('section', { class: 'section' },
      h('div', { class: 'row', style: { marginBottom: '12px' } }, h('h2', { class: 'h2', style: { margin: 0 } }, 'Lerngruppen'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: newGroupDialog }, icon('plus'), 'Neue Lerngruppe')),
      list));
  }
  main.append(h('p', { class: 'muted small', style: { textAlign: 'center', marginTop: '36px' } }, `Alle Daten bleiben auf diesem Gerät. ${APP_NAME} ${APP_VERSION}`));

  view(topbar({
    brand: true,
    actions: [
      h('button', { class: 'btn', type: 'button', onclick: exportBackup, title: 'Alle Daten als Datei sichern' }, icon('download'), h('span', null, 'Backup')),
      h('a', { class: 'btn btn--icon btn--ghost', href: '#/einstellungen', 'aria-label': 'Einstellungen' }, icon('gear')),
    ],
  }), main);
}

function newGroupDialog() {
  const name = h('input', { class: 'input', type: 'text', placeholder: 'z. B. Bio 8b', autocomplete: 'off' });
  const klasse = h('input', { class: 'input', type: 'text', placeholder: 'z. B. 8b', autocomplete: 'off' });
  const rasterSel = rasterSelect(ctx, state.settings.defaultRaster || BIOLOGIE_ID);
  const choice = { scale: state.settings.scale, stepBoth: state.settings.stepBoth };
  openDialog({
    title: 'Neue Lerngruppe',
    body: [
      h('label', { class: 'field' }, h('span', null, 'Name der Lerngruppe'), name),
      h('label', { class: 'field' }, h('span', null, 'Klasse (erscheint auf dem Schülibogen)'), klasse),
      h('label', { class: 'field' }, h('span', null, 'Bewertungsraster'), rasterSel),
      h('div', { class: 'field' }, h('span', null, 'Notenskala'), scaleControls(choice)),
    ],
    actions: [
      { label: 'Abbrechen' },
      {
        label: 'Anlegen',
        kind: 'primary',
        onClick: async () => {
          const n = name.value.trim() || klasse.value.trim();
          if (!n) {
            name.focus();
            toast('Bitte einen Namen eintragen.');
            return false;
          }
          const g = { id: uid('g'), name: n, klasse: klasse.value.trim(), rasterId: rasterSel.value, weightsByRaster: {}, umrechnungByRaster: {}, scale: choice.scale, stepBoth: choice.stepBoth, students: [], createdAt: new Date().toISOString() };
          try {
            await ensureRaster(g.rasterId);
          } catch (e) {
            toast(e.message, { duration: 6000 });
            return false;
          }
          await saveGroup(g);
          await createRound(g);
          go(`gruppe/${g.id}/namen`);
          return true;
        },
      },
    ],
  });
  setTimeout(() => name.focus(), 50);
}

async function createDemoGroup() {
  const names = ['Anna Müller', 'Ben Özdemir', 'Clara von Berg', 'David Nguyen', 'Emma Schulz', 'Finn Weber', 'Greta Hoffmann', 'Hamza Yılmaz', 'Ida Koch', 'Jonas Wagner', 'Lea Fischer', 'Mia Becker'];
  const g = {
    id: uid('g'),
    name: 'Beispiel Bio 8b',
    klasse: '8b',
    rasterId: BIOLOGIE_ID,
    weightsByRaster: {},
    umrechnungByRaster: {},
    scale: state.settings.scale,
    stepBoth: state.settings.stepBoth,
    students: names.map((n) => ({ id: uid('s'), ...splitName(n, 'first-last') })),
    createdAt: new Date().toISOString(),
  };
  await saveGroup(g);
  const r = await createRound(g);
  const st = sortedStudents(g);
  const demo = [[[1], [1, 2], [0]], [[3], [3], [2, 3]], [[0], [0], [1]]];
  for (let i = 0; i < demo.length; i++) {
    const a = newAssessment(r, st[i], g);
    demo[i].forEach((sel, k) => { a.crit[k].sel = sel; });
    await saveAssessment(a);
  }
  go(`gruppe/${g.id}`);
}

// ===========================================================================
// Lerngruppe: Übersicht
// ===========================================================================

async function renderGroup(g) {
  const r = await ensureRound(g);
  await syncEmptyRound(g, r);
  const raster = roundRaster(r);
  document.title = `${g.name} – ${APP_NAME}`;
  const students = sortedStudents(g);
  const rounds = roundsOf(g.id);

  const roundSelect = h('select', { class: 'input', 'aria-label': 'Bewertungsrunde' },
    rounds.map((x) => h('option', { value: x.id, selected: x.id === r.id }, x.title)));
  roundSelect.addEventListener('change', async () => {
    g.currentRoundId = roundSelect.value;
    await saveGroup(g);
    render();
  });

  const counts = { done: 0, partial: 0, open: 0 };
  const grades = [];
  for (const s of students) {
    const a = getAssessment(r.id, s.id);
    const st = statusFor(r, a);
    counts[st]++;
    if (st === 'done') grades.push(evaluateRaster(raster, a).effective);
  }
  const avg = grades.length ? grades.reduce((x, y) => x + y, 0) / grades.length : null;
  const firstOpen = students.find((s) => statusFor(r, getAssessment(r.id, s.id)) !== 'done') || students[0];

  const main = h('main', { class: 'main' },
    h('div', { class: 'round-bar' },
      h('span', { class: 'label' }, 'Bewertungsrunde'),
      roundSelect,
      h('button', { class: 'btn', type: 'button', onclick: async () => {
        try { await createRound(g); toast('Neue Runde angelegt.'); } catch (e) { toast(e.message, { duration: 6000 }); }
        render();
      } }, icon('plus'), 'Neue Runde'),
      h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Runde umbenennen', onclick: async () => {
        const t = await promptDialog({ title: 'Runde umbenennen', label: 'Bezeichnung', value: r.title });
        if (t) { r.title = t; await saveRound(r); render(); }
      } }, icon('edit')),
      rounds.length > 1 ? h('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': 'Runde löschen', onclick: () => deleteRound(g, r) }, icon('trash')) : null),
    h('p', { class: 'muted small', style: { margin: '-6px 0 14px' } }, 'Raster dieser Runde: ', h('a', { href: `#/raster/ansehen/${encodeURIComponent(r.rasterId)}` }, roundLabel(r))),
  );

  if (!students.length) {
    main.append(h('div', { class: 'empty' },
      h('h2', null, 'Noch keine Namen in dieser Lerngruppe'),
      h('p', null, 'Füge Namen per CSV-Datei, eingefügter Liste oder einzeln hinzu.'),
      h('a', { class: 'btn btn--primary btn--big', href: `#/gruppe/${g.id}/namen` }, icon('users'), 'Namen hinzufügen')));
  } else {
    main.append(
      h('div', { class: 'row', style: { marginBottom: '14px' } },
        h('p', { class: 'stats', style: { margin: 0 } },
          h('span', null, h('b', null, counts.done), ' bewertet'),
          h('span', null, h('b', null, counts.partial), ' angefangen'),
          h('span', null, h('b', null, counts.open), ' offen'),
          avg !== null ? h('span', null, 'Durchschnitt ', h('b', null, formatDecimal(avg, 2))) : null),
        h('span', { class: 'spacer' }),
        h('a', { class: 'btn btn--primary btn--big', href: `#/gruppe/${g.id}/bewerten/${firstOpen.id}` }, counts.done === students.length ? 'Bewertungen ansehen' : counts.done || counts.partial ? 'Weiter bewerten' : 'Bewertung starten')),
      gridOf(ctx, g, r, students),
    );
  }

  view(topbar({
    back: '#/',
    title: g.name,
    subtitle: `${g.klasse ? `Klasse ${g.klasse} · ` : ''}${countLabel(students.length)} · ${roundLabel(r)} · ${SCALE_LABELS[displayScale(g)]}`,
    actions: [
      h('a', { class: 'btn', href: `#/gruppe/${g.id}/namen` }, icon('users'), h('span', null, 'Lerngruppe')),
      h('a', { class: 'btn btn--primary', href: `#/gruppe/${g.id}/export` }, icon('share'), h('span', null, 'Export')),
    ],
  }), main);
}

async function deleteRound(g, r) {
  const n = [...state.assessments.values()].filter((a) => a.roundId === r.id).length;
  const ok = await confirmDialog(`„${r.title}“ mit ${n} Bewertungen löschen? Das lässt sich nicht rückgängig machen.`, { title: 'Runde löschen', ok: 'Runde löschen', danger: true });
  if (!ok) return;
  const ops = [{ store: 'rounds', del: r.id }];
  for (const a of state.assessments.values()) {
    if (a.roundId === r.id) {
      ops.push({ store: 'assessments', del: a.id });
      state.assessments.delete(a.id);
    }
  }
  await db.batch(ops);
  state.rounds = state.rounds.filter((x) => x.id !== r.id);
  g.currentRoundId = (roundsOf(g.id)[0] || {}).id || null;
  await saveGroup(g);
  toast('Runde gelöscht.');
  render();
}

// ===========================================================================
// Lerngruppe bearbeiten: Namen
// ===========================================================================

function renderGroupEdit(g) {
  document.title = `Namen – ${g.name}`;
  let mode = 'single';

  const nameIn = h('input', { class: 'input', type: 'text', value: g.name || '', autocomplete: 'off' });
  const klasseIn = h('input', { class: 'input', type: 'text', value: g.klasse || '', autocomplete: 'off' });
  const saveMeta = debounce(async () => {
    g.name = nameIn.value.trim() || g.name;
    g.klasse = klasseIn.value.trim();
    await saveGroup(g);
  }, 400);
  nameIn.addEventListener('input', saveMeta);
  klasseIn.addEventListener('input', saveMeta);
  cleanupView = () => saveMeta.flush();

  // --- Namen hinzufügen ---
  const single = h('input', { class: 'input', type: 'text', placeholder: 'z. B. Anna Müller oder Müller, Anna', autocomplete: 'off', autocapitalize: 'words', enterkeyhint: 'enter' });
  const addSingle = async () => {
    const raw = single.value.trim();
    if (!raw) return;
    single.value = ''; // sofort leeren, damit der nächste Name direkt eingegeben werden kann
    single.focus();
    const n = splitName(raw, 'first-last');
    const added = await addStudents(g, [n]);
    if (added) {
      toast(`${studentName(n)} hinzugefügt.`, { duration: 1500 });
      refreshList();
    } else {
      toast('Dieser Name steht schon in der Liste.');
    }
  };
  single.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSingle();
    }
  });

  const paste = h('textarea', { class: 'input', rows: 8, placeholder: 'Ein Name pro Zeile, z. B.\nAnna Müller\nMüller, Anna\n(auch direkt aus Excel kopiert)' });
  const file = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain', class: 'visually-hidden', id: 'csv-file' });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const text = await readTextFile(f);
    file.value = '';
    importDialog(g, text, f.name, refreshList);
  });

  const panes = {
    single: h('div', { class: 'add-name' }, single, h('button', { class: 'btn btn--primary', type: 'button', onclick: addSingle }, icon('plus'), 'Hinzufügen')),
    paste: h('div', null, paste, h('div', { class: 'row', style: { marginTop: '10px' } },
      h('button', { class: 'btn btn--primary', type: 'button', onclick: () => {
        if (!paste.value.trim()) { toast('Bitte zuerst Namen einfügen.'); return; }
        importDialog(g, paste.value, 'Eingefügte Liste', () => { paste.value = ''; refreshList(); });
      } }, 'Vorschau & übernehmen'))),
    csv: h('div', null,
      h('p', { class: 'muted', style: { marginTop: 0 } }, 'CSV-Datei z. B. aus der Schulverwaltung oder Excel. Komma oder Semikolon, Nachname/Vorname getrennt oder in einer Spalte – die Spalten kannst du in der Vorschau anpassen.'),
      h('label', { class: 'btn btn--primary', for: 'csv-file' }, icon('file'), 'CSV-Datei wählen'), file),
  };
  const paneBox = h('div', { style: { marginTop: '12px' } }, panes.single);
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Eingabeart' });
  for (const [key, label] of [['single', 'Einzeln'], ['paste', 'Liste einfügen'], ['csv', 'CSV-Datei']]) {
    seg.append(h('button', { type: 'button', 'aria-pressed': String(key === mode), onclick: (e) => {
      mode = key;
      seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
      paneBox.replaceChildren(panes[key]);
    } }, label));
  }

  // --- Liste der Namen ---
  const listBox = h('div', { class: 'name-rows' });
  const countEl = h('span', { class: 'muted' });
  function refreshList() {
    const st = sortedStudents(g);
    countEl.textContent = ` (${st.length})`;
    listBox.replaceChildren(...(st.length
      ? [h('div', { class: 'name-row name-row--head', 'aria-hidden': 'true' }, h('span', null, 'Nachname'), h('span', null, 'Vorname'), h('span')), ...st.map((s) => nameRow(g, s, refreshList))]
      : [h('p', { class: 'muted' }, 'Noch keine Namen.')]));
  }
  refreshList();

  const main = h('main', { class: 'main' },
    h('section', { class: 'section panel' },
      h('div', { class: 'map-grid map-grid--wide' },
        h('label', { class: 'field' }, h('span', null, 'Name der Lerngruppe'), nameIn),
        h('label', { class: 'field' }, h('span', null, 'Klasse (für Schülibogen und Notenliste)'), klasseIn)),
      h('div', { class: 'field', style: { marginBottom: 0 } },
        h('span', null, 'Notenskala dieser Lerngruppe (Anzeige, Nachschärfen und Export)'),
        scaleControls(g, async (key) => {
          await saveGroup(g);
          if (key === 'scale') toast(`Notenskala: ${SCALE_LABELS[displayScale(g)]}`, { duration: 1500 });
        }),
        h('p', { class: 'muted small', style: { margin: '8px 0 0' } }, 'Ein Wechsel wirkt sofort auf alle Runden dieser Lerngruppe. Nachgeschärfte Endnoten bleiben erhalten und werden in die neue Skala umgerechnet.'))),
    rasterPanel(g),
    h('section', { class: 'section' }, h('h2', null, 'Namen hinzufügen'), seg, paneBox),
    h('section', { class: 'section' }, h('h2', null, 'Schülis', countEl), listBox),
    h('section', { class: 'section' },
      h('button', { class: 'btn btn--danger', type: 'button', onclick: () => deleteGroup(g) }, icon('trash'), 'Lerngruppe löschen')),
  );

  view(topbar({
    back: `#/gruppe/${g.id}`,
    title: 'Lerngruppe',
    subtitle: g.name,
    actions: [h('a', { class: 'btn btn--primary', href: `#/gruppe/${g.id}` }, 'Fertig')],
  }), main);
}

function rasterPanel(g) {
  const r = currentRound(g);
  const raster = roundRaster(r);
  const sel = rasterSelect(ctx, g.rasterId);
  sel.addEventListener('change', () => changeRaster(g, sel.value, sel));
  const parts = [
    h('h2', null, 'Bewertungsraster'),
    h('div', { class: 'row' }, h('div', { style: { flex: '1 1 320px' } }, sel),
      h('a', { class: 'btn', href: `#/raster/ansehen/${encodeURIComponent(r.rasterId)}` }, 'Ansehen'),
      h('a', { class: 'btn', href: '#/raster' }, 'Alle Raster')),
    h('p', { class: 'muted small' }, `Aktuelle Runde „${r.title}“: ${roundLabel(r)}. Jede Runde behält ihr Raster; ein neues Raster gilt ab der nächsten Runde (bzw. sofort, solange die Runde noch keine Bewertungen hat).`),
  ];
  const mittel = raster.meta.typ !== 'matrix' && raster.meta.wertung !== 'summe';
  if (mittel) {
    const w = [...groupWeights(g, raster, r.rasterId)];
    const outs = [];
    const inputs = [];
    const save = async () => {
      g.weightsByRaster = { ...(g.weightsByRaster || {}), [r.rasterId]: [...w] };
      await saveGroup(g);
    };
    const updatePct = () => {
      const total = w.reduce((x, y) => x + (y > 0 ? y : 0), 0) || 1;
      outs.forEach((o, i) => { o.textContent = `${formatDecimal((Math.max(0, w[i]) / total) * 100, 1, true)} %`; });
    };
    const setW = (i, v) => {
      const n = Math.max(0, Math.min(100, Math.round(Number(v) * 2) / 2));
      if (!Number.isFinite(n)) return;
      w[i] = n;
      inputs[i].value = String(n).replace('.', ',');
      updatePct();
      save();
    };
    const rows = raster.kriterien.map((k, i) => {
      const inp = h('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(w[i]).replace('.', ','), 'aria-label': `Gewicht ${k.name}` });
      inp.addEventListener('change', () => setW(i, inp.value.replace(',', '.')));
      inputs[i] = inp;
      outs[i] = h('output');
      return h('div', { class: 'weight-row' }, h('span', null, k.name),
        h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': `${k.name} weniger`, onclick: () => setW(i, w[i] - 1) }, '−'),
        inp,
        h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': `${k.name} mehr`, onclick: () => setW(i, w[i] + 1) }, '+'),
        outs[i]);
    });
    updatePct();
    parts.push(h('h2', { style: { marginTop: '18px' } }, 'Gewichtung der Kriterien'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Relative Gewichte, z. B. 2 : 1 : 1. Gilt für neue Bewertungen dieser Lerngruppe; bereits bewertete Schülis behalten ihre Gewichtung (in der Bewertung lässt sie sich übernehmen).'),
      h('div', { class: 'weights' }, rows),
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn', type: 'button', onclick: () => { defaultWeights(raster).forEach((x, i) => setW(i, x)); } }, 'Wie im Raster')));
  }
  if (raster.meta.typ !== 'matrix' && raster.meta.wertung === 'summe' && raster.umrechnungen.length > 1) {
    const cur = groupUmrechnung(g, r.rasterId);
    const seg = h('div', { class: 'seg', role: 'group' });
    raster.umrechnungen.forEach((u, i) => seg.append(h('button', { type: 'button', 'aria-pressed': String(i === cur), onclick: async () => {
      g.umrechnungByRaster = { ...(g.umrechnungByRaster || {}), [r.rasterId]: i };
      await saveGroup(g);
      const ops = [];
      for (const a of state.assessments.values()) {
        if (a.roundId === r.id) {
          a.umrechnung = i;
          ops.push(saveAssessment(a));
        }
      }
      await Promise.all(ops);
      toast(`Umrechnung: ${u.titel || i + 1}${ops.length ? ' – gilt auch für die bisherigen Bewertungen dieser Runde' : ''}`);
      render();
    } }, u.titel || `Umrechnung ${i + 1}`)));
    parts.push(h('h2', { style: { marginTop: '18px' } }, 'Umrechnung der Punktsumme'), seg);
  }
  return h('section', { class: 'section panel' }, parts);
}

async function changeRaster(g, id, sel) {
  if (id === g.rasterId) return;
  let rec;
  try {
    rec = await ensureRaster(id);
  } catch (e) {
    toast(e.message, { duration: 6000 });
    if (sel) sel.value = g.rasterId;
    return;
  }
  g.rasterId = id;
  await saveGroup(g);
  const r = currentRound(g);
  const hasAss = [...state.assessments.values()].some((a) => a.roundId === r.id);
  if (!hasAss) {
    r.rasterId = rec.id;
    r.rasterHash = rec.hash;
    await saveRound(r);
    toast(`Raster gewechselt: ${recordLabel(rec)}`);
  } else {
    const ok = await confirmDialog(`Die Runde „${r.title}“ enthält schon Bewertungen und behält ihr bisheriges Raster. Das neue Raster gilt ab der nächsten Runde. Jetzt eine neue Runde anlegen?`, { title: 'Raster gewechselt', ok: 'Neue Runde anlegen', cancel: 'Später' });
    if (ok) {
      await createRound(g);
      toast('Neue Runde mit dem neuen Raster angelegt.');
    }
  }
  render();
}

function nameRow(g, s, refresh) {
  const first = h('input', { class: 'input', type: 'text', value: s.firstName || '', 'aria-label': `Vorname von ${studentName(s)}`, placeholder: 'Vorname', autocomplete: 'off' });
  const last = h('input', { class: 'input', type: 'text', value: s.lastName || '', 'aria-label': `Nachname von ${studentName(s)}`, placeholder: 'Nachname', autocomplete: 'off' });
  const save = debounce(async () => {
    s.firstName = first.value.trim();
    s.lastName = last.value.trim();
    await saveGroup(g);
  }, 400);
  first.addEventListener('input', save);
  last.addEventListener('input', save);
  first.addEventListener('blur', () => save.flush());
  last.addEventListener('blur', () => save.flush());
  const del = h('button', { class: 'btn btn--icon btn--danger', type: 'button', 'aria-label': `${studentName(s)} entfernen`, onclick: async () => {
    const has = [...state.assessments.values()].some((a) => a.groupId === g.id && a.studentId === s.id);
    const ok = await confirmDialog(`${studentName(s)} aus der Lerngruppe entfernen?${has ? ' Vorhandene Bewertungen werden ebenfalls gelöscht.' : ''}`, { title: 'Namen entfernen', ok: 'Entfernen', danger: true });
    if (!ok) return;
    g.students = g.students.filter((x) => x.id !== s.id);
    const ops = [];
    for (const a of state.assessments.values()) {
      if (a.groupId === g.id && a.studentId === s.id) {
        ops.push({ store: 'assessments', del: a.id });
        state.assessments.delete(a.id);
      }
    }
    if (ops.length) await db.batch(ops);
    await saveGroup(g);
    refresh();
  } }, icon('trash'));
  return h('div', { class: 'name-row' }, last, first, del);
}

async function addStudents(g, names) {
  const keys = new Set((g.students || []).map(nameKey));
  let n = 0;
  for (const x of names) {
    const s = { id: uid('s'), firstName: (x.firstName || '').trim(), lastName: (x.lastName || '').trim() };
    if (!s.firstName && !s.lastName) continue;
    const k = nameKey(s);
    if (keys.has(k)) continue;
    keys.add(k);
    g.students = [...(g.students || []), s];
    n++;
  }
  if (n) await saveGroup(g);
  return n;
}

async function readTextFile(f) {
  const buf = await f.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('\uFFFD')) {
    // Ältere Excel-Exporte sind oft Windows-1252 kodiert
    try { text = new TextDecoder('windows-1252').decode(buf); } catch { /* bleibt UTF-8 */ }
  }
  return text;
}

function importDialog(g, text, sourceName, onDone) {
  const analysis = analyzeNameText(text);
  const { rows, delim } = analysis;
  const mapping = { ...analysis.mapping };
  if (!rows.length) {
    toast('In der Datei wurden keine Namen gefunden.');
    return;
  }
  const width = Math.max(...rows.map((r) => r.length));
  const existing = new Set((g.students || []).map(nameKey));
  const delimName = { ';': 'Semikolon', ',': 'Komma', '\t': 'Tabulator' }[delim] || 'keines (ein Name pro Zeile)';

  const colLabel = (i) => {
    const head = mapping.hasHeader ? rows[0][i] : '';
    const sample = (mapping.hasHeader ? rows[1] : rows[0]) || [];
    return `Spalte ${i + 1}${head ? ` – ${head}` : sample[i] ? ` (z. B. ${sample[i]})` : ''}`;
  };
  const colSelect = (key) => {
    const sel = h('select', { class: 'input' }, Array.from({ length: width }, (_, i) => h('option', { value: i, selected: mapping[key] === i }, colLabel(i))));
    sel.addEventListener('change', () => { mapping[key] = Number(sel.value); update(); });
    return sel;
  };

  const headerCb = h('input', { type: 'checkbox', checked: mapping.hasHeader });
  headerCb.addEventListener('change', () => { mapping.hasHeader = headerCb.checked; rebuildControls(); update(); });

  const controls = h('div');
  const previewBox = h('div', { style: { maxHeight: '42vh', overflow: 'auto', marginTop: '6px' } });
  const summary = h('p', { class: 'muted small' });
  let klasseCb = null;
  let names = [];
  let okBtn = null;

  function segOf(options, value, onChange) {
    const seg = h('div', { class: 'seg' });
    for (const [v, label] of options) {
      seg.append(h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { onChange(v); rebuildControls(); update(); } }, label));
    }
    return seg;
  }

  function rebuildControls() {
    const parts = [
      h('label', { class: 'check' }, headerCb, 'Erste Zeile ist eine Kopfzeile'),
    ];
    if (width > 1) {
      parts.push(h('div', { class: 'field' }, h('span', null, 'Namen stehen'),
        segOf([['split', 'in zwei Spalten (Nachname / Vorname)'], ['combined', 'in einer Spalte']], mapping.mode, (v) => {
          mapping.mode = v;
          if (v === 'split' && (mapping.last < 0 || mapping.first < 0)) { mapping.last = 0; mapping.first = Math.min(1, width - 1); }
          if (v === 'combined' && mapping.full < 0) mapping.full = 0;
        })));
    }
    if (mapping.mode === 'split') {
      parts.push(h('div', { class: 'map-grid' },
        h('label', { class: 'field' }, h('span', null, 'Nachname'), colSelect('last')),
        h('label', { class: 'field' }, h('span', null, 'Vorname'), colSelect('first'))));
    } else {
      if (width > 1) parts.push(h('label', { class: 'field' }, h('span', null, 'Spalte mit dem Namen'), colSelect('full')));
      parts.push(h('div', { class: 'field' }, h('span', null, 'Reihenfolge bei Namen ohne Komma'),
        segOf([['first-last', 'Vorname Nachname'], ['last-first', 'Nachname Vorname']], mapping.order, (v) => { mapping.order = v; })),
      h('p', { class: 'muted small', style: { marginTop: '-6px' } }, 'Namen mit Komma werden immer als „Nachname, Vorname“ gelesen.'));
    }
    controls.replaceChildren(...parts);
  }

  function update() {
    names = extractNames(rows, mapping);
    const seen = new Set(existing);
    const trs = names.map((n) => {
      const k = nameKey(n);
      const dup = seen.has(k);
      seen.add(k);
      n.dup = dup;
      return h('tr', { class: dup ? 'is-dup' : '' }, h('td', null, n.lastName), h('td', null, n.firstName), h('td', { class: 'muted small' }, dup ? 'schon vorhanden' : ''));
    });
    previewBox.replaceChildren(h('table', { class: 'preview-table' },
      h('thead', null, h('tr', null, h('th', null, 'Nachname'), h('th', null, 'Vorname'), h('th', null, ''))),
      h('tbody', null, trs)));
    const fresh = names.filter((n) => !n.dup).length;
    summary.textContent = `Erkannt: Trennzeichen ${delimName}${mapping.hasHeader ? ', mit Kopfzeile' : ''}. ${names.length} Namen, davon ${fresh} neu.`;
    if (okBtn) {
      okBtn.textContent = fresh ? `${fresh} ${fresh === 1 ? 'Namen' : 'Namen'} übernehmen` : 'Keine neuen Namen';
      okBtn.disabled = !fresh;
    }
    const klassen = [...new Set(names.map((n) => n.klasse).filter(Boolean))];
    if (klassen.length === 1 && !g.klasse && !klasseCb) {
      klasseCb = h('input', { type: 'checkbox', checked: true, dataset: { klasse: klassen[0] } });
      controls.after(h('label', { class: 'check' }, klasseCb, `Klasse „${klassen[0]}“ für die Lerngruppe übernehmen`));
    }
  }

  rebuildControls();
  const { dlg } = openDialog({
    title: `Namen übernehmen: ${sourceName}`,
    wide: true,
    body: [summary, controls, previewBox],
    actions: [
      { label: 'Abbrechen' },
      {
        label: 'Übernehmen',
        kind: 'primary',
        onClick: async () => {
          const n = await addStudents(g, names.filter((x) => !x.dup));
          if (klasseCb && klasseCb.checked) {
            g.klasse = klasseCb.dataset.klasse;
            await saveGroup(g);
          }
          toast(`${n} ${n === 1 ? 'Name' : 'Namen'} übernommen.`);
          if (onDone) onDone();
          if (klasseCb && klasseCb.checked) render();
        },
      },
    ],
  });
  okBtn = dlg.querySelector('.dlg__foot .btn--primary');
  update();
}

async function deleteGroup(g) {
  const ok = await confirmDialog(`„${g.name}“ mit allen Runden und Bewertungen löschen? Das lässt sich nicht rückgängig machen.`, { title: 'Lerngruppe löschen', ok: 'Endgültig löschen', danger: true });
  if (!ok) return;
  const ops = [{ store: 'groups', del: g.id }];
  for (const r of state.rounds.filter((x) => x.groupId === g.id)) ops.push({ store: 'rounds', del: r.id });
  for (const a of state.assessments.values()) {
    if (a.groupId === g.id) {
      ops.push({ store: 'assessments', del: a.id });
      state.assessments.delete(a.id);
    }
  }
  await db.batch(ops);
  state.groups = state.groups.filter((x) => x.id !== g.id);
  state.rounds = state.rounds.filter((x) => x.groupId !== g.id);
  toast('Lerngruppe gelöscht.');
  go('', { replace: true });
}

// ===========================================================================
// Bewerten
// ===========================================================================

function newAssessment(r, s, g) {
  const raster = roundRaster(r);
  const grp = g || getGroup(r.groupId);
  const mittel = raster.meta.typ !== 'matrix' && raster.meta.wertung !== 'summe';
  return {
    id: assessmentId(r.id, s.id),
    roundId: r.id,
    groupId: r.groupId,
    studentId: s.id,
    date: todayISO(),
    crit: emptyCrit(raster),
    weights: mittel ? [...groupWeights(grp, raster, r.rasterId)] : null, // Gewichtung wird mit der Bewertung gespeichert
    umrechnung: groupUmrechnung(grp, r.rasterId),
    proposal: null,
    final: null,
    finalScale: null,
    createdAt: new Date().toISOString(),
  };
}

// ===========================================================================
// Export
// ===========================================================================

async function renderExport(g) {
  const r = await ensureRound(g);
  const raster = roundRaster(r);
  document.title = `Export – ${g.name}`;
  const students = sortedStudents(g);
  const byStudent = new Map(students.map((s) => [s.id, getAssessment(r.id, s.id)]));
  const doneIds = students.filter((s) => statusFor(r, byStudent.get(s.id)) === 'done').map((s) => s.id);

  let sel = state.exportSelection.get(r.id);
  if (!sel) {
    sel = new Set(doneIds.length ? doneIds : students.map((s) => s.id));
    state.exportSelection.set(r.id, sel);
  }

  const countEl = h('b');
  const boxes = [];
  const pick = h('div', { class: 'pick-list' }, students.map((s) => {
    const cb = h('input', { type: 'checkbox', checked: sel.has(s.id) });
    cb.addEventListener('change', () => {
      if (cb.checked) sel.add(s.id);
      else sel.delete(s.id);
      updateCount();
    });
    boxes.push([s.id, cb]);
    const st = statusFor(r, byStudent.get(s.id));
    return h('label', { class: 'check' }, cb, h('span', null, nameFor(s), st !== 'done' ? h('span', { class: 'muted small' }, st === 'partial' ? ' (angefangen)' : ' (offen)') : null));
  }));
  function setAll(ids) {
    sel.clear();
    ids.forEach((id) => sel.add(id));
    boxes.forEach(([id, cb]) => { cb.checked = sel.has(id); });
    updateCount();
  }
  function updateCount() {
    countEl.textContent = `${sel.size} von ${students.length}`;
  }
  updateCount();

  const chosen = () => students.filter((s) => sel.has(s.id));
  const need = () => {
    if (!sel.size) {
      toast('Bitte mindestens ein Schüli auswählen.');
      return false;
    }
    return true;
  };
  const scale = displayScale(g);
  const sheetsFor = () => chosen().map((s) => buildSheet({ student: s, group: g, round: r, raster, assessment: byStudent.get(s.id), scale }));
  const baseName = safeFileName(`${klasseOf(g) || g.name}_${r.title}`);
  const scaleName = { quarter: 'Viertelnoten', points: 'Notenpunkten', both: 'Viertelnoten und Notenpunkten' }[scale];
  const listFor = () => buildGradeList({ students: chosen(), group: g, raster, assessmentsByStudent: byStudent, nameOrder: 'last-first' });

  const exportCSV = () => {
    if (!need()) return;
    const { header, rows } = gradeListTable(listFor(), scale, raster);
    const blob = new Blob([buildCSV(header, rows)], { type: 'text/csv;charset=utf-8' });
    offerFile(blob, `Notenliste_${baseName}.csv`, { title: 'Notenliste (CSV) ist fertig' });
  };
  const exportListPDF = () => {
    if (!need()) return;
    const list = listFor();
    let weightsNote = '';
    if (raster.meta.typ !== 'matrix' && raster.meta.wertung === 'summe') {
      const u = raster.umrechnungen[groupUmrechnung(g, r.rasterId)] || raster.umrechnungen[0];
      weightsNote = u && u.titel ? `Umrechnung: ${u.titel}` : '';
    } else if (raster.meta.typ !== 'matrix') {
      const ws = [...new Set(list.map((x) => weightsText(raster, x.weights)).filter(Boolean))];
      weightsNote = `Gewichtung: ${ws.length ? ws.join(' bzw. ') : weightsText(raster, groupWeights(g, raster, r.rasterId))}`;
    }
    const { orientation, pages } = buildListPages(list, {
      title: 'Notenliste – mündliche Noten',
      group: g.name,
      klasse: klasseOf(g),
      round: r.title,
      printed: formatDate(todayISO()),
      scale,
      weightsNote,
      raster,
    });
    openPrintView({ title: `Notenliste ${g.name}`, orientation, pages, onClose: render });
  };
  const exportSheetsPrint = (perPage) => {
    if (!need()) return;
    const { orientation, pages } = buildSheetPages(sheetsFor(), perPage);
    openPrintView({
      title: perPage === 1 ? 'Schülibögen' : `Schülibögen, ${perPage} pro Seite`,
      orientation,
      pages,
      onClose: render,
      hint: perPage === 4 ? 'Kompaktfassung ohne Zusatztexte, damit die Schrift lesbar bleibt. Entlang der gestrichelten Linien schneiden.' : perPage === 2 ? 'Zwei Bögen auf A4 hoch – entlang der gestrichelten Linie schneiden (A5).' : undefined,
    });
  };
  const exportDocx = async (btn) => {
    if (!need()) return;
    if (!window.docx) {
      toast('Die Word-Bibliothek ist noch nicht geladen. Bitte kurz warten und erneut tippen.');
      return;
    }
    btn.disabled = true;
    try {
      const blob = await sheetsToDocxBlob(window.docx, sheetsFor());
      offerFile(blob, `Schuelibogen_${baseName}.docx`, { title: 'Word-Datei ist fertig' });
    } catch (err) {
      console.error(err);
      toast(`Word-Export fehlgeschlagen: ${err.message || err}`);
    } finally {
      btn.disabled = false;
    }
  };

  let perPage = 2;
  const multiSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Bögen pro Seite' });
  for (const n of [2, 4]) {
    multiSeg.append(h('button', { type: 'button', 'aria-pressed': String(n === perPage), onclick: (e) => {
      perPage = n;
      multiSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
    } }, `${n} pro Seite`));
  }

  const main = h('main', { class: 'main' },
    h('section', { class: 'section panel' },
      h('div', { class: 'row' },
        h('h2', { class: 'h2', style: { margin: 0 } }, 'Auswahl: ', countEl),
        h('span', { class: 'spacer' }),
        h('div', { class: 'btn-group' },
          h('button', { class: 'btn', type: 'button', onclick: () => setAll(students.map((s) => s.id)) }, 'Alle'),
          h('button', { class: 'btn', type: 'button', onclick: () => setAll(doneIds) }, 'Nur bewertete'),
          h('button', { class: 'btn', type: 'button', onclick: () => setAll([]) }, 'Keine'))),
      pick),
    h('p', { class: 'muted small' }, `Raster: ${roundLabel(r)}. Noten erscheinen in ${scaleName} – einstellbar für diese Lerngruppe unter `,
      h('a', { href: `#/gruppe/${g.id}/namen` }, 'Lerngruppe'), `. Runde: ${r.title}.`),
    h('div', { class: 'export-grid' },
      h('section', { class: 'panel export-card' },
        h('h3', null, 'Notenliste'),
        h('p', null, 'Name, Werte je Kriterium, berechnete Note, Endnote, Klasse und Datum.'),
        h('div', { class: 'btn-group' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: exportCSV }, icon('file'), 'CSV für Excel'),
          h('button', { class: 'btn', type: 'button', onclick: exportListPDF }, icon('print'), 'PDF / Drucken'))),
      h('section', { class: 'panel export-card' },
        h('h3', null, 'Schülibögen'),
        h('p', null, 'Ausgefüllter Bogen nach dem Raster, ein Schüli pro Seite (A4 quer).'),
        h('div', { class: 'btn-group' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => exportSheetsPrint(1) }, icon('print'), 'PDF / Drucken'),
          h('button', { class: 'btn', type: 'button', onclick: (e) => exportDocx(e.currentTarget) }, icon('file'), 'Word (.docx)'))),
      h('section', { class: 'panel export-card' },
        h('h3', null, 'Mehrfachdruck'),
        h('p', null, 'Verkleinerte Bögen mit Schnittlinien, z. B. zum Anheften an eine Klassenarbeit.'),
        multiSeg,
        h('div', { class: 'btn-group' },
          h('button', { class: 'btn btn--primary', type: 'button', onclick: () => exportSheetsPrint(perPage) }, icon('print'), 'Druckansicht öffnen')))),
  );

  view(topbar({ back: `#/gruppe/${g.id}`, title: 'Exportieren', subtitle: `${g.name} · ${r.title}` }), main);
}

// ===========================================================================
// Einstellungen
// ===========================================================================

function renderSettings() {
  document.title = `Einstellungen – ${APP_NAME}`;
  const S = state.settings;

  function segSetting(key, options, after) {
    const seg = h('div', { class: 'seg', role: 'group' });
    for (const [v, label] of options) {
      seg.append(h('button', { type: 'button', 'aria-pressed': String(S[key] === v), onclick: async (e) => {
        S[key] = v;
        seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        await saveSettings();
        if (after) after(v);
      } }, label));
    }
    return seg;
  }

  const defSel = rasterSelect(ctx, S.defaultRaster || BIOLOGIE_ID);
  defSel.addEventListener('change', async () => {
    S.defaultRaster = defSel.value;
    await saveSettings();
    toast('Standardraster gespeichert.');
  });

  const backupInfo = S.lastBackupAt ? `Letztes Backup: ${formatDate(todayISO(new Date(S.lastBackupAt)))}` : 'Noch kein Backup erstellt.';
  const backupFile = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'backup-file' });
  backupFile.addEventListener('change', async () => {
    const f = backupFile.files && backupFile.files[0];
    backupFile.value = '';
    if (f) importBackup(f);
  });

  const persistInfo = h('span', { class: 'muted small' });
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then((p) => {
      persistInfo.textContent = p ? 'Der Browser hat dauerhaften Speicher zugesagt.' : 'Speicher ist nicht als dauerhaft markiert – regelmäßige Backups sind wichtig.';
    });
  }

  const main = h('main', { class: 'main', style: { maxWidth: '860px' } },
    h('section', { class: 'section panel' },
      h('h2', null, 'Bewertungsraster'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Fachschaftsraster ansehen, eigene Raster importieren (z. B. mit Hilfe einer KI) oder bearbeiten. Welches Raster gilt, legst du pro Lerngruppe fest; Gewichtungen ebenfalls dort.'),
      h('div', { class: 'btn-group', style: { marginBottom: '12px' } }, h('a', { class: 'btn btn--primary', href: '#/raster' }, 'Raster verwalten')),
      h('label', { class: 'field' }, h('span', null, 'Standardraster für neue Lerngruppen'), defSel)),
    h('section', { class: 'section panel' },
      h('h2', null, 'Notenskala für neue Lerngruppen'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Jede Lerngruppe hat ihre eigene Skala – einstellbar beim Anlegen und unter „Lerngruppe“. Hier legst du fest, womit neue Lerngruppen starten.'),
      scaleControls(S, () => saveSettings()),
      h('p', { class: 'muted small' }, 'Viertelnoten: 1 / 1- / 1-2 / 2+ / 2 … Notenpunkte: 17 − 3 × Note, gerundet (15 P ≙ 1+, 14 P ≙ 1, 13 P ≙ 1- …). Exakte Mitten werden zugunsten des Schülis gerundet.')),
    h('section', { class: 'section panel' },
      h('h2', null, 'Namen in Listen'),
      segSetting('nameOrder', [['last-first', 'Nachname, Vorname'], ['first-last', 'Vorname Nachname']])),
    h('section', { class: 'section panel' },
      h('h2', null, 'Darstellung'),
      segSetting('theme', [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']], applyTheme)),
    h('section', { class: 'section panel' },
      h('h2', null, 'Datensicherung'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Alle Daten liegen nur auf diesem Gerät. Das Backup ist eine JSON-Datei mit allen Lerngruppen, Runden, Bewertungen, eigenen Rastern und Einstellungen – für die Sicherung und den Gerätewechsel.'),
      h('div', { class: 'btn-group' },
        h('button', { class: 'btn btn--primary', type: 'button', onclick: exportBackup }, icon('download'), 'Backup exportieren'),
        h('label', { class: 'btn', for: 'backup-file' }, icon('file'), 'Backup importieren'), backupFile),
      h('p', { class: 'small' }, backupInfo, ' ', persistInfo)),
    h('section', { class: 'section panel' },
      h('h2', null, 'Alle Daten löschen'),
      h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Entfernt alle Lerngruppen, Bewertungen, eigenen Raster und Einstellungen von diesem Gerät.'),
      h('button', { class: 'btn btn--danger', type: 'button', onclick: wipeAll }, icon('trash'), 'Alle Daten löschen')),
    h('p', { class: 'muted small', style: { textAlign: 'center' } },
      `${APP_NAME} ${APP_VERSION} · funktioniert offline · kein Server, kein Tracking · vibe coded by Verena Lohmüller & Claude · Lizenz CC BY-NC-SA 4.0. Enthält docx (MIT) und Atkinson Hyperlegible (SIL OFL).`),
  );
  view(topbar({ back: '#/', title: 'Einstellungen' }), main);
}

async function exportBackup() {
  // Zeitpunkt vorher speichern, damit er auch im Backup selbst steht
  state.settings.lastBackupAt = new Date().toISOString();
  await saveSettings();
  const data = await db.dumpAll();
  const payload = {
    app: 'GradeEm',
    format: 1,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  offerFile(blob, `GradeEm-Backup_${todayISO()}.json`, { title: 'Backup ist fertig' });
}

function validateBackup(data) {
  if (!data || !['GradeEm', 'TardiGrader'].includes(data.app) || !Array.isArray(data.groups) || !Array.isArray(data.assessments)) {
    throw new Error('Das ist keine Grade’Em-Backup-Datei.');
  }
  for (const k of db.STORES) {
    if (data[k] !== undefined && !Array.isArray(data[k])) throw new Error(`Ungültiger Abschnitt „${k}“.`);
  }
  for (const gr of data.groups) {
    if (!gr || typeof gr.id !== 'string' || !Array.isArray(gr.students || [])) throw new Error('Ungültige Lerngruppe im Backup.');
  }
  for (const a of data.assessments) {
    if (!a || typeof a.id !== 'string' || typeof a.roundId !== 'string') throw new Error('Ungültige Bewertung im Backup.');
  }
  return {
    meta: data.meta || [],
    groups: data.groups,
    rounds: data.rounds || [],
    assessments: data.assessments,
    rasters: data.rasters || [],
    rasterVersions: data.rasterVersions || [],
  };
}

async function importBackup(f) {
  let data;
  try {
    data = validateBackup(JSON.parse(await f.text()));
  } catch (err) {
    toast(`Import nicht möglich: ${err.message}`, { duration: 6000 });
    return;
  }
  const when = data && f.lastModified ? formatDate(todayISO(new Date(f.lastModified))) : '';
  openDialog({
    title: 'Backup importieren',
    body: [
      h('p', null, `${f.name}${when ? ` (${when})` : ''}: ${data.groups.length} Lerngruppen, ${data.rounds.length} Runden, ${data.assessments.length} Bewertungen.`),
      h('p', { class: 'muted small' }, '„Zusammenführen“ ergänzt die Daten auf diesem Gerät (gleiche Einträge werden überschrieben). „Ersetzen“ löscht zuerst alles auf diesem Gerät.'),
    ],
    actions: [
      { label: 'Abbrechen' },
      { label: 'Zusammenführen', onClick: async () => { await db.mergeAll(data); await afterImport('Backup zusammengeführt.'); } },
      {
        label: 'Ersetzen',
        kind: 'danger',
        onClick: async () => {
          const ok = await confirmDialog('Alle Daten auf diesem Gerät werden durch das Backup ersetzt.', { title: 'Wirklich ersetzen?', ok: 'Ersetzen', danger: true });
          if (!ok) return;
          await db.replaceAll(data);
          await afterImport('Backup eingespielt.');
        },
      },
    ],
  });
}

async function afterImport(msg) {
  await loadAll();
  toast(msg);
  go('', { replace: true });
  render();
}

async function wipeAll() {
  const ok = await confirmDialog('Wirklich alle Lerngruppen, Bewertungen und Einstellungen löschen? Ohne Backup sind sie verloren.', { title: 'Alle Daten löschen', ok: 'Alles löschen', danger: true });
  if (!ok) return;
  await db.clearAll();
  await loadAll();
  toast('Alle Daten gelöscht.');
  go('', { replace: true });
  render();
}

// ===========================================================================
// Start
// ===========================================================================

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let updateRequested = false;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (w) => {
      toast('Eine neue Version ist bereit.', {
        action: 'Neu laden',
        duration: 0,
        onAction: () => {
          updateRequested = true;
          w.postMessage({ type: 'SKIP_WAITING' });
        },
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w);
      });
    });
  }).catch((e) => console.warn('Service Worker:', e));
  // Nur nach einem bestätigten Update neu laden – nicht beim ersten Einrichten.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

async function start() {
  try {
    await loadAll();
  } catch (err) {
    app.replaceChildren(h('main', { class: 'main' }, h('div', { class: 'empty' },
      h('h2', null, 'Der lokale Speicher ist nicht verfügbar'),
      h('p', null, `Grade’Em braucht IndexedDB. Im privaten Modus von Safari ist sie eingeschränkt. (${err.message || err})`))));
    return;
  }
  await loadFsIndex();
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  window.addEventListener('hashchange', render);
  render();
  registerServiceWorker();
  refreshFachschaftRasters();
}

/** Gemeinsamer Zugriff für die Ansichten in rate-view.js und raster-ui.js. */
const ctx = {
  state,
  APP_NAME,
  go,
  render,
  view,
  topbar,
  setCleanup: (fn) => { cleanupView = fn; },
  getAssessment,
  saveAssessment,
  ensureRound,
  roundRaster,
  newAssessment,
  sortedStudents,
  nameFor,
  displayScale,
  stepScale,
  groupWeights,
  fetchText,
  loadRasterText,
  parseRaster,
  saveRasterRecord,
  deleteRasterRecord,
  ownRasters,
  recordLabel,
  recordModel,
  hashText,
};

start();

// Für Tests im Browser
window.__gradeem = { state, APP_VERSION, ctx };
