/**
 * Tests für die Übertragungsansicht (Endnote in anderer Schreibweise).  Aufruf:  node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transferGrade, TRANSFER_NOTATIONS } from '../js/sheet-data.js';

const t = (eff, notation, scale) => transferGrade(eff, notation, scale);

test('Dezimal: Viertelnoten bleiben exakt, mit Komma', () => {
  assert.equal(t(1.5, 'dezimal').main, '1,5');
  assert.equal(t(1.25, 'dezimal').main, '1,25');
  assert.equal(t(2, 'dezimal').main, '2');
  assert.equal(t(2.33, 'dezimal').main, '2,25'); // wie auf dem Schülibogen: Viertelnote
  assert.equal(t(6, 'dezimal').main, '6');
});

test('Tendenz: nächste Tendenz 1+ … 6, Mitten zugunsten der Schülis', () => {
  assert.equal(t(1, 'tendenz').main, '1');
  assert.equal(t(1.25, 'tendenz').main, '1-');
  assert.equal(t(1.5, 'tendenz').main, '1-'); // 1-2 → 1-
  assert.equal(t(1.75, 'tendenz').main, '2+');
  assert.equal(t(2.5, 'tendenz').main, '2-'); // 2-3 → 2-
  assert.equal(t(3.75, 'tendenz').main, '4+');
  assert.equal(t(5, 'tendenz').main, '5');
  assert.equal(t(6, 'tendenz').main, '6');
});

test('Notenpunkte: 17 − 3 × Note', () => {
  assert.equal(t(1, 'punkte').main, '14');
  assert.equal(t(1.75, 'punkte').main, '12');
  assert.equal(t(3.75, 'punkte').main, '6');
  assert.equal(t(6, 'punkte').main, '0');
});

test('Skala Notenpunkte: Endnote ist der Punktwert, auch unter 1,0', () => {
  const x = t(2 / 3, 'dezimal', 'points'); // 15 Punkte
  assert.equal(x.main, '0,67');
  assert.equal(t(2 / 3, 'tendenz', 'points').main, '1+');
  assert.equal(t(2 / 3, 'punkte', 'points').main, '15');
  assert.equal(x.source, '15 P');
});

test('Quelle zeigt die Schreibweise in Grade’Em, base erkennt Änderungen', () => {
  assert.equal(t(1.5, 'tendenz').source, '1-2');
  assert.equal(t(1.75, 'dezimal').base, t(1.75, 'punkte').base); // unabhängig von der Schreibweise
  assert.notEqual(t(1.75, 'dezimal').base, t(2, 'dezimal').base);
});

test('Ohne Endnote keine Übertragung', () => {
  assert.equal(t(null, 'dezimal'), null);
  assert.equal(t(undefined, 'tendenz'), null);
  assert.equal(t(NaN, 'punkte'), null);
});

test('Drei Schreibweisen zur Auswahl', () => {
  assert.deepEqual(TRANSFER_NOTATIONS.map((x) => x[0]), ['dezimal', 'tendenz', 'punkte']);
});
