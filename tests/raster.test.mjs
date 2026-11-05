/**
 * Tests für Raster-Einlesen, -Schreiben und die Bewertungs-Engine.  Aufruf:  node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRaster, serializeRaster, noteValue, pointValues, cellParas, hashText } from '../js/raster.js';
import { evaluateRaster, emptyCrit, convertSum, maxSum } from '../js/engine.js';
import { evaluate } from '../js/grades.js';
import { BIOLOGIE_MD } from '../js/raster-builtin.js';

const DIR = new URL('../raster/', import.meta.url);
const load = (f) => parseRaster(readFileSync(new URL(f, DIR), 'utf8'));
const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && !['FORMAT.md', 'KI-PROMPT.md'].includes(f));
const near = (a, b) => Math.abs(a - b) < 1e-9;
const sel = (...arr) => arr.map((s) => ({ sel: Array.isArray(s) ? s : s === null ? [] : [s], pts: {}, comment: '' }));

test('alle mitgelieferten Raster lassen sich fehlerfrei einlesen', () => {
  assert.equal(files.length, 18);
  for (const f of files) {
    const p = load(f);
    assert.deepEqual(p.errors, [], `${f}: ${p.errors.join('; ')}`);
  }
  const idx = JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));
  assert.deepEqual(idx.map((x) => x.file).sort(), [...files].sort());
});

test('eingebaute Biologie-Kopie ist identisch mit raster/biologie.md', () => {
  assert.equal(BIOLOGIE_MD, readFileSync(new URL('biologie.md', DIR), 'utf8'));
});

test('Notenwerte und Punkte', () => {
  assert.equal(noteValue('2+'), 1.75);
  assert.equal(noteValue('1-2'), 1.5);
  assert.equal(noteValue('2,5'), 2.5);
  assert.equal(noteValue('5 bis 6'), 5.5);
  assert.equal(noteValue('6+'), 5.75);
  assert.throws(() => noteValue('gut'));
  assert.deepEqual(pointValues('2 bis 0'), [2, 1, 0]);
  assert.deepEqual(pointValues('15, 14, 13'), [15, 14, 13]);
});

test('Zellen: Absätze, Aufzählung, Fettdruck', () => {
  assert.deepEqual(cellParas('- **a** b\n- c\n\nd e\nf'), [{ text: '**a** b', bullet: true }, { text: 'c', bullet: true }, { text: 'd e f', bullet: false }]);
});

test('Schreiben und erneutes Einlesen ergibt dasselbe Modell (alle Raster)', () => {
  for (const f of files) {
    const a = load(f).raster;
    const again = parseRaster(serializeRaster(a));
    assert.deepEqual(again.errors, [], f);
    assert.deepEqual(again.raster, a, f);
  }
});

test('Biologie: gleiche Noten wie die bisherige Berechnung', () => {
  const r = load('biologie.md').raster;
  const neu = evaluateRaster(r, { crit: sel([1, 2], 1, 0), weights: [1, 1, 1] });
  const alt = evaluate({ rows: { quality: { cols: [2, 3] }, knowledge: { cols: [2] }, language: { cols: [1] } }, weights: { quality: 1, knowledge: 1, language: 1 } });
  assert.ok(near(neu.proposal, alt.proposal));
  assert.equal(neu.complete, true);
  const w = evaluateRaster(r, { crit: sel(0, 3, 3), weights: [2, 1, 1] });
  assert.ok(near(w.proposal, 2.5));
  const part = evaluateRaster(r, { crit: sel(0, null, 2) });
  assert.equal(part.complete, false);
  assert.ok(near(part.proposal, 2));
});

test('Musik: Stufe „5 mangelhaft- 6 ungenügend“ zählt 5,5', () => {
  const r = load('musik.md').raster;
  const ev = evaluateRaster(r, { crit: sel(4, 4, 4, 4, 4, 4) });
  assert.ok(near(ev.proposal, 5.5));
});

test('Chemie: Punktsumme → Note über die Umrechnung', () => {
  const r = load('chemie.md').raster;
  assert.equal(maxSum(r), 18);
  const all3 = evaluateRaster(r, { crit: sel(3, 3, 3, 3, 3, 3) });
  assert.equal(all3.info.sum, 18);
  assert.equal(all3.proposal, 1);
  assert.equal(evaluateRaster(r, { crit: sel(2, 2, 2, 2, 2, 3) }).proposal, 1.5); // 13 → 1-2
  assert.equal(evaluateRaster(r, { crit: sel(2, 2, 2, 1, 1, 1) }).proposal, 2.5); // 9 → 2-3
  const low = convertSum(r, 1, 0);
  assert.equal(low.note, 5);
  assert.match(low.text, /Arbeitsverweigerung/);
  assert.equal(evaluateRaster(r, { crit: sel(3, 3) }).complete, false);
});

test('Kunst: Sterne, Auswahl bei „1-0“, zwei Umrechnungen', () => {
  const r = load('kunst.md').raster;
  assert.equal(r.umrechnungen.length, 2);
  const a = { crit: sel(0, 1, 2) };            // 5 + 4 + 3 = 12 → 2
  assert.equal(evaluateRaster(r, a).proposal, 2);
  const k = { crit: sel(0, 1, 2), umrechnung: 1 }; // Kursstufe: 12 Notenpunkte
  assert.ok(near(evaluateRaster(r, k).proposal, (17 - 12) / 3));
  const z = { crit: sel(4, 4, 4) };            // „1-0“: Standard 1 Stern → 3 → 5
  assert.equal(evaluateRaster(r, z).info.sum, 3);
  z.crit.forEach((c) => { c.pts = { 4: 0 }; }); // jeweils 0 gewählt → 0 → 6
  assert.equal(evaluateRaster(r, z).proposal, 6);
});

test('Geschichte: Matrix-Zelle liefert Notenbereich', () => {
  const r = load('geschichte.md').raster;
  assert.equal(r.matrix.cells.length, 5);
  const ev = evaluateRaster(r, { crit: sel(1, 1) }); // B / II: 2-, 2-3
  assert.deepEqual(ev.info.cell.noten.map((n) => n.label), ['2-', '2-3']);
  assert.ok(near(ev.proposal, 2.375));
  assert.deepEqual(ev.info.cell.punkte, [10, 9]);
  assert.equal(evaluateRaster(r, { crit: sel(0, null) }).complete, false);
  const rel = load('religion.md').raster;
  assert.deepEqual(rel.matrix.cells[1][2].noten.map((n) => n.label), ['3+', '3', '3-']);
});

test('fehlerhafte Raster werden verständlich gemeldet', () => {
  assert.equal(parseRaster('nur Text').ok, false);
  const p = parseRaster('---\ntitel: X\nfach: Y\n---\n## Stufen\n\n| Stufe | Note |\n|---|---|\n| a | gut |\n| b | 2 |\n\n## Kriterium: K\n### c\nText');
  assert.equal(p.ok, false);
  assert.ok(p.errors.some((e) => e.includes('„gut“')));
  assert.ok(p.errors.some((e) => e.includes('Stufe „c“')));
});

test('KI-Antwort mit Codeblock und Vorrede wird erkannt', () => {
  const txt = 'Hier ist die Datei:\n\n```markdown\n' + readFileSync(new URL('ethik.md', DIR), 'utf8') + '```\nViel Erfolg!';
  const p = parseRaster(txt);
  assert.deepEqual(p.errors, []);
  assert.equal(p.raster.kriterien.length, 6);
  assert.equal(hashText('abc'), hashText('abc'));
  assert.notEqual(hashText('abc'), hashText('abd'));
});

test('Hilfsfunktion emptyCrit', () => {
  assert.equal(emptyCrit(load('geschichte.md').raster).length, 2);
  assert.equal(emptyCrit(load('ethik.md').raster).length, 6);
});

test('eingebautes Rasterpaket entspricht dem Ordner raster/ und hat Anzeigenamen', async () => {
  const { BUILTIN_RASTER, BUILTIN_INDEX } = await import('../js/raster-builtin.js');
  assert.deepEqual(Object.keys(BUILTIN_RASTER).sort(), [...files].sort());
  for (const f of files) assert.equal(BUILTIN_RASTER[f], readFileSync(new URL(f, DIR), 'utf8'), f);
  for (const e of BUILTIN_INDEX) {
    assert.match(e.name, /\(ee26\)$/, e.file);
    assert.equal(parseRaster(BUILTIN_RASTER[e.file]).raster.meta.name, e.name);
  }
  assert.equal(new Set(BUILTIN_INDEX.map((e) => e.name)).size, BUILTIN_INDEX.length, 'Namen eindeutig');
});

test('Kriterium aufteilen: Vorschlag, Zuordnung und unveränderte Gewichtsanteile', async () => {
  const { suggestParts, autoAssign, applySplit } = await import('../js/raster-ui.js');
  const r = load('englisch.md').raster;
  const k = r.kriterien[2];
  const parts = suggestParts(k);
  assert.deepEqual(parts, ['Wortschatz', 'Grammatik', 'Aussprache']);
  assert.deepEqual(autoAssign('Gebrauch von Grammatik/Syntax und Lexik', parts), [true, true, false]);
  assert.deepEqual(autoAssign('Aussprache überwiegend unverständlich', parts), [false, false, true]);
  assert.equal(autoAssign('erfüllt die gestellten Aufgaben', parts), null);
  const assign = r.stufen.map((_, si) => cellParas(k.cells[si]).map((p) => autoAssign(p.text, parts) || parts.map(() => true)));
  const crit = (n, ki) => Array.from({ length: n }, (_, i) => ({ sel: [i >= ki ? 2 : 0], pts: {} }));
  const before = evaluateRaster(r, { crit: crit(3, 2) }).proposal;
  applySplit(r, 2, parts, assign);
  assert.deepEqual(r.kriterien.map((x) => x.gewicht), [3, 3, 1, 1, 1]);
  assert.ok(near(evaluateRaster(r, { crit: crit(5, 2) }).proposal, before));
  assert.match(r.kriterien[4].cells[5], /Aussprache überwiegend unverständlich/);
  assert.deepEqual(parseRaster(serializeRaster(r)).errors, []);
});

test('Physik / Mathe 5/6: Sterne, Abschnitt und nicht zählende Kriterien', async () => {
  const { buildSheet, headerFields } = await import('../js/sheet-data.js');
  for (const f of ['physik.md', 'mathe-5-6.md']) {
    const r = load(f).raster;
    assert.equal(r.kriterien.length, 9, f);
    assert.equal(maxSum(r), 20, f);
    assert.match(r.kriterien[4].abschnitt, /^Zusätzliche Rückmeldung zu Mitarbeit und Motivation/);
    assert.deepEqual(r.kriterien.map((k) => k.gewicht), [1, 1, 1, 1, 0, 0, 0, 0, 0]);
    const a = { crit: sel(0, 1, 1, 2, 5, 5, 5, 5, 5) }; // 5 + 4 + 4 + 3 = 16 Sterne → 2 (Rückmeldungen zählen nicht)
    const ev = evaluateRaster(r, a);
    assert.equal(ev.info.sum, 16);
    assert.equal(ev.proposal, 2);
    assert.equal(ev.complete, true);
    assert.equal(evaluateRaster(r, { crit: sel(0, 1, 1, null) }).complete, false);
    const sh = buildSheet({ student: { firstName: 'A', lastName: 'B' }, group: { name: '6a' }, raster: r, assessment: { ...a, date: '2026-11-04' } });
    const hf = Object.fromEntries(headerFields(sh).map((x) => [x.label, x.value]));
    assert.equal(hf['Summe aller Sterne'], '16');
    assert.equal(hf['Ermittelte Note'], '2');
    assert.equal(hf['Datum, Unterschrift'], '04.11.2026');
  }
  assert.match(load('physik.md').raster.meta.titel, /Physikunterricht/);
});

test('Mathe: eine Kriterienspalte mit Notendefinition und Anmerkungen', () => {
  const r = load('mathe.md').raster;
  assert.equal(r.meta.name, 'Mathe (ee26)');
  assert.equal(r.kriterien.length, 1);
  const p = cellParas(r.kriterien[0].cells[1]);
  assert.equal(p[0].text, 'Leistung entspricht den Anforderungen voll');
  assert.equal(p.filter((x) => x.bullet).length, 9);
  assert.deepEqual(r.stufen.map((s) => s.punkte.join(',')), ['15,14,13', '12,11,10', '9,8,7', '6,5,4', '3,2,1', '0']);
  assert.match(r.hinweise, /Beweisführung von untergeordneter Bedeutung/);
});

test('Fachschaftsraster: richtige Fassung online, offline und nach einem App-Update', async () => {
  const { chooseFachschaftText } = await import('../js/raster.js');
  const builtin = readFileSync(new URL('physik.md', DIR), 'utf8');
  const repo = builtin.replace('Physikunterricht', 'Physikunterricht (neu)');
  // online: Repository gewinnt
  assert.equal(chooseFachschaftText({ fetched: repo, record: null, builtin }).text, repo);
  // offline, zuvor aus dem Repository geladen: diese Fassung bleibt
  const rec = { text: repo, origin: 'repo', builtinHash: hashText(builtin) };
  assert.equal(chooseFachschaftText({ fetched: null, record: rec, builtin }).text, repo);
  // offline, App-Update mit neuerer eingebauter Fassung: eingebaute gewinnt
  const newer = builtin.replace('Physikunterricht', 'Physikunterricht (App)');
  assert.equal(chooseFachschaftText({ fetched: null, record: rec, builtin: newer }).text, newer);
  // ungültige Antwort (z. B. 404-Seite) zählt nicht
  assert.equal(chooseFachschaftText({ fetched: '<h1>404</h1>', record: null, builtin }).origin, 'builtin');
  assert.equal(chooseFachschaftText({ fetched: null, record: null, builtin: null }), null);
});

test('Gemeinschaftskunde nutzt den Geographie-Bogen, Mathe 5/6 ohne „(Clas)“', () => {
  const geo = load('geographie.md').raster;
  const gk = load('gemeinschaftskunde.md').raster;
  assert.equal(gk.meta.name, 'Gemeinschaftskunde (ee26)');
  assert.equal(gk.meta.fach, 'Gemeinschaftskunde');
  assert.match(gk.meta.titel, /Fach Gemeinschaftskunde/);
  assert.deepEqual(gk.stufen, geo.stufen);
  assert.deepEqual(gk.kriterien, geo.kriterien);
  assert.equal(gk.hinweise, geo.hinweise);
  assert.doesNotMatch(load('mathe-5-6.md').raster.meta.titel, /Clas/);
});
