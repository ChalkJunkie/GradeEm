/**
 * Tests der Notenumrechnung.  Aufruf:  node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundToQuarter, quarterLabel, noteToPoints, pointsToNote, pointsTendency, rowValue,
  weightedGrade, normalizeWeights, adjustGrade, describeGrade, formatDecimal, evaluate,
} from '../js/grades.js';

test('Viertelnoten: Rundung auf die nächste Viertelstufe', () => {
  const cases = [
    [1.0, 1.0], [1.1, 1.0], [1.13, 1.25], [1.2, 1.25], [1.37, 1.25], [1.38, 1.5],
    [2.17, 2.25], [2.333, 2.25], [2.4, 2.5], [2.62, 2.5], [2.63, 2.75], [5.9, 6.0],
    [0.5, 1.0], [7, 6.0],
  ];
  for (const [inp, out] of cases) assert.equal(roundToQuarter(inp), out, `${inp} → ${out}`);
});

test('Viertelnoten: exakte Mitte zugunsten der Schülerin/des Schülers', () => {
  assert.equal(roundToQuarter(1.125), 1.0);
  assert.equal(roundToQuarter(2.375), 2.25);
  assert.equal(roundToQuarter(3.625), 3.5);
  assert.equal(roundToQuarter(0.1 + 0.2 + 1.825), 2.0); // Gleitkomma-Rauschen an der Mitte
  assert.equal(roundToQuarter(2.1251), 2.25);
});

test('Viertelnoten: Bezeichnungen', () => {
  const labels = {
    1: '1', 1.25: '1-', 1.5: '1-2', 1.75: '2+', 2: '2', 2.25: '2-', 2.5: '2-3', 2.75: '3+',
    3: '3', 3.25: '3-', 3.5: '3-4', 3.75: '4+', 4: '4', 4.25: '4-', 4.5: '4-5', 4.75: '5+',
    5: '5', 5.25: '5-', 5.5: '5-6', 5.75: '6+', 6: '6',
  };
  for (const [v, l] of Object.entries(labels)) assert.equal(quarterLabel(Number(v)), l, `${v} → ${l}`);
});

test('Notenpunkte: Punkte = 17 − 3 × Note, gerundet, 0–15', () => {
  const cases = [
    [1.0, 14], [1.25, 13], [1.5, 13], [1.667, 12], [1.75, 12], [2.0, 11], [2.25, 10], [2.5, 10],
    [2.75, 9], [3.0, 8], [3.5, 7], [4.0, 5], [4.5, 4], [5.0, 2], [5.5, 1], [5.667, 0], [6.0, 0],
    [0.667, 15], [0.5, 15],
  ];
  for (const [n, p] of cases) assert.equal(noteToPoints(n), p, `${n} → ${p}`);
});

test('Notenpunkte: Rückrechnung und Tendenznoten', () => {
  const tend = ['6', '5-', '5', '5+', '4-', '4', '4+', '3-', '3', '3+', '2-', '2', '2+', '1-', '1', '1+'];
  for (let p = 0; p <= 15; p++) {
    assert.equal(pointsTendency(p), tend[p], `${p} P → ${tend[p]}`);
    assert.equal(noteToPoints(pointsToNote(p)), p, `Hin- und Rückrechnung ${p} P`);
  }
  assert.equal(pointsToNote(14), 1);
  assert.equal(pointsToNote(11), 2);
  assert.equal(pointsToNote(2), 5);
});

test('Zeilenwert: Mittelwert der markierten Spalten', () => {
  assert.equal(rowValue([2]), 2);
  assert.equal(rowValue([2, 3]), 2.5);
  assert.equal(rowValue([1, 2, 4]), 7 / 3);
  assert.equal(rowValue([]), null);
  assert.equal(rowValue(undefined), null);
});

test('Gewichteter Mittelwert', () => {
  const w = { quality: 1, knowledge: 1, language: 1 };
  assert.deepEqual(weightedGrade({ quality: 2, knowledge: 3, language: 1 }, w), { value: 2, complete: true });
  const r = weightedGrade({ quality: 2, knowledge: 3, language: 1 }, { quality: 2, knowledge: 1, language: 1 });
  assert.equal(r.value, 2);
  assert.equal(weightedGrade({ quality: 1, knowledge: 4, language: 4 }, { quality: 2, knowledge: 1, language: 1 }).value, 2.5);
  // unvollständig: nur bewertete Zeilen, neu normiert
  assert.deepEqual(weightedGrade({ quality: 2, knowledge: null, language: 4 }, w), { value: 3, complete: false });
  // Gewicht 0: Zeile zählt nicht und muss nicht bewertet sein
  assert.deepEqual(weightedGrade({ quality: 2, knowledge: null, language: 4 }, { quality: 1, knowledge: 0, language: 1 }), { value: 3, complete: true });
  assert.deepEqual(normalizeWeights({ quality: 0, knowledge: 0, language: 0 }), { quality: 1 / 3, knowledge: 1 / 3, language: 1 / 3 });
});

test('Nachschärfen in Viertelschritten und ganzen Punkten', () => {
  assert.equal(adjustGrade(2.17, 'quarter', 'better'), 2.0); // 2,17 → 2- (2,25) → besser: 2
  assert.equal(adjustGrade(2.17, 'quarter', 'worse'), 2.5);
  assert.equal(adjustGrade(1.0, 'quarter', 'better'), 1.0); // Untergrenze
  assert.equal(adjustGrade(6.0, 'quarter', 'worse'), 6.0); // Obergrenze
  assert.equal(noteToPoints(adjustGrade(2.0, 'points', 'better')), 12);
  assert.equal(noteToPoints(adjustGrade(2.0, 'points', 'worse')), 10);
  assert.equal(noteToPoints(adjustGrade(1.0, 'points', 'better')), 15); // 15 P ≙ 1+
  assert.equal(noteToPoints(adjustGrade(pointsToNote(15), 'points', 'better')), 15);
  assert.equal(noteToPoints(adjustGrade(pointsToNote(0), 'points', 'worse')), 0);
});

test('Darstellung und deutsches Dezimalkomma', () => {
  assert.equal(describeGrade(2.17, 'quarter').text, '2-');
  assert.equal(describeGrade(2.17, 'points').text, '10 Punkte');
  assert.equal(describeGrade(2.17, 'both').text, '2- (10 Punkte)');
  assert.equal(describeGrade(5.5, 'points').text, '1 Punkt');
  assert.equal(formatDecimal(2.1666, 2), '2,17');
  assert.equal(formatDecimal(1.5, 2, true), '1,5');
  assert.equal(formatDecimal(2, 2, true), '2');
});

test('Gesamtbewertung: Vorschlag und Endnote getrennt', () => {
  const a = {
    weights: { quality: 1, knowledge: 1, language: 1 },
    rows: { quality: { cols: [2, 3] }, knowledge: { cols: [2] }, language: { cols: [1] } },
    final: null,
  };
  let ev = evaluate(a);
  assert.equal(ev.rows.quality, 2.5);
  assert.ok(Math.abs(ev.proposal - 11 / 6) < 1e-12);
  assert.equal(ev.complete, true);
  assert.equal(ev.adjusted, false);
  assert.equal(describeGrade(ev.effective, 'both').text, '2+ (12 Punkte)');
  a.final = 1.5;
  ev = evaluate(a);
  assert.equal(ev.adjusted, true);
  assert.equal(ev.effective, 1.5);
  assert.ok(Math.abs(ev.proposal - 11 / 6) < 1e-12, 'Vorschlag bleibt erhalten');
});
