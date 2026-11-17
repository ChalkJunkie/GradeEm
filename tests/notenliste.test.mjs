/**
 * Tests für die Notenliste: Inhalt (mit Kriterien / nur Endnote) und mehrere Runden.
 * Aufruf:  node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRaster } from '../js/raster.js';
import { buildGradeList, gradeListTable, roundsTable, criteriaText } from '../js/sheet-data.js';

const load = (f) => parseRaster(readFileSync(new URL(`../raster/${f}`, import.meta.url), 'utf8')).raster;
const bio = load('biologie.md');
const phy = load('physik.md');
const students = [
  { id: 'a', firstName: 'Anna', lastName: 'Müller' },
  { id: 'b', firstName: 'Ben', lastName: 'Özdemir' },
];
const ass = (raster, sel) => ({ crit: (raster.meta.typ === 'matrix' ? [0, 1] : raster.kriterien).map(() => ({ sel: [sel], pts: {}, comment: '' })), date: '2026-11-15' });
const listOf = (raster, map) => buildGradeList({ students, group: { klasse: '8b' }, raster, assessmentsByStudent: new Map(Object.entries(map)) });

test('Notenliste einer Runde: nur Endnote', () => {
  const list = listOf(bio, { a: ass(bio, 1) });
  const { header, rows } = gradeListTable(list, 'quarter', bio, { criteria: false });
  assert.deepEqual(header, ['Name', 'Klasse', 'Endnote (Viertelnote)', 'Nachgeschärft']);
  assert.deepEqual(rows[0], ['Müller, Anna', '8b', '2', 'nein']);
  assert.deepEqual(rows[1], ['Özdemir, Ben', '8b', '', 'nein']);
});

test('Notenliste einer Runde: mit Kriterien enthält jedes Kriterium', () => {
  const list = listOf(bio, { a: ass(bio, 1) });
  const { header } = gradeListTable(list, 'both', bio);
  for (const k of bio.kriterien) assert.ok(header.includes(k.name), k.name);
  assert.ok(header.includes('Endnote (Viertelnote)') && header.includes('Endnote (Punkte)'));
});

test('Mehrere Runden pro Klasse: eine Zeile je Schüli, Spalten je Runde', () => {
  const rounds = [
    { title: 'R1', raster: bio, rasterName: 'Biologie (ee26)', list: listOf(bio, { a: ass(bio, 0), b: ass(bio, 2) }) },
    { title: 'R2', raster: phy, rasterName: 'Physik (ee26)', list: listOf(phy, { a: ass(phy, 0) }) },
  ];
  const end = roundsTable(rounds, 'quarter', { criteria: false, arrange: 'klasse' });
  assert.deepEqual(end.header, ['Name', 'Klasse', 'R1: Endnote (Viertelnote)', 'R2: Endnote (Viertelnote)']);
  assert.equal(end.rows.length, 2);
  assert.equal(end.rows[0][2], '1');
  assert.equal(end.rows[1][3], '');
  const krit = roundsTable(rounds, 'quarter', { criteria: true, arrange: 'klasse' });
  assert.ok(krit.header.includes(`R1: ${bio.kriterien[0].name}`));
  assert.ok(krit.header.includes(`R2: ${phy.kriterien[8].name}`));
  assert.ok(krit.header.includes('R2: Summe'));
  krit.rows.forEach((r) => assert.equal(r.length, krit.header.length));
});

test('Mehrere Runden pro Schüli: eine Zeile je Schüli und Runde', () => {
  const rounds = [
    { title: 'R1', raster: bio, rasterName: 'Biologie (ee26)', list: listOf(bio, { a: ass(bio, 0) }) },
    { title: 'R2', raster: bio, rasterName: 'Biologie (ee26)', list: listOf(bio, { a: ass(bio, 3) }) },
  ];
  const t = roundsTable(rounds, 'points', { criteria: true, arrange: 'schueli' });
  assert.deepEqual(t.header, ['Name', 'Klasse', 'Runde', 'Raster', 'Datum', 'Kriterien', 'Berechnete Note (dezimal)', 'Endnote (Punkte)', 'Nachgeschärft']);
  assert.deepEqual(t.rows.map((r) => `${r[0]}|${r[2]}`), ['Müller, Anna|R1', 'Müller, Anna|R2', 'Özdemir, Ben|R1', 'Özdemir, Ben|R2']);
  assert.equal(t.rows[0][5], criteriaText(bio, rounds[0].list[0]));
  assert.match(t.rows[0][5], new RegExp(`^${bio.kriterien[0].name} 1`));
});

test('Bogenform: Wahl der Lerngruppe vor der Angabe im Raster', async () => {
  const { sheetForm, buildSheet } = await import('../js/sheet-data.js');
  assert.equal(bio.meta.schuelibogen, 'kompakt');
  assert.equal(sheetForm(bio), 'kompakt');
  assert.equal(sheetForm(bio, 'vollstaendig'), 'vollstaendig');
  assert.equal(sheetForm(bio, 'unsinn'), 'kompakt');
  assert.equal(sheetForm(load('geschichte.md'), 'kompakt'), 'matrix');
  const s = buildSheet({ student: students[0], group: { klasse: '8b' }, round: { title: 'R' }, raster: bio, assessment: ass(bio, 1), form: 'vollstaendig' });
  assert.equal(s.form, 'vollstaendig');
});

test('Kommentarspalte nur auf Bögen mit Kommentar', async () => {
  const { hasComments, buildSheet } = await import('../js/sheet-data.js');
  const mk = (comments) => buildSheet({ student: students[0], group: { klasse: '8b' }, round: { title: 'R' }, raster: bio, assessment: { crit: bio.kriterien.map((_, i) => ({ sel: [1], pts: {}, comment: comments[i] || '' })), date: '2026-11-15' } });
  assert.equal(hasComments(mk([])), false);
  assert.equal(hasComments(mk(['', '   ', ''])), false); // nur Leerzeichen zählt nicht
  assert.equal(hasComments(mk(['', 'gut', ''])), true);
  assert.equal(hasComments({ crit: [] }), false);
});
