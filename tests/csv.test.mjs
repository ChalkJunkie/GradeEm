/**
 * Tests für CSV-Import und -Export.  Aufruf:  node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectDelimiter, parseCSV, analyzeNameText, splitName, buildCSV, extractNames } from '../js/csv.js';

const names = (text) => analyzeNameText(text).names.map((n) => `${n.lastName}|${n.firstName}`);

test('Trennzeichen erkennen', () => {
  assert.equal(detectDelimiter('Nachname;Vorname\nMüller;Anna\nÖzdemir;Ben'), ';');
  assert.equal(detectDelimiter('Nachname,Vorname\nMüller,Anna'), ',');
  assert.equal(detectDelimiter('Müller\tAnna\nÖzdemir\tBen'), '\t');
  assert.equal(detectDelimiter('Anna Müller\nBen Özdemir'), null);
  assert.equal(detectDelimiter('"Müller, Anna";8b\n"Özdemir, Ben";8b'), ';');
});

test('CSV mit Kopfzeile, Semikolon, getrennte Spalten', () => {
  assert.deepEqual(names('\uFEFFNachname;Vorname;Klasse\r\nMüller;Anna;8b\r\nÖzdemir;Ben;8b\r\n'), ['Müller|Anna', 'Özdemir|Ben']);
  const a = analyzeNameText('Nachname;Vorname;Klasse\nMüller;Anna;8b');
  assert.equal(a.mapping.klasse, 2);
  assert.equal(a.names[0].klasse, '8b');
});

test('CSV mit vertauschten Spalten und Zusatzspalten (Komma)', () => {
  assert.deepEqual(names('Nr,Vorname,Name,Geburtsdatum\n1,Anna,Müller,01.02.2012\n2,Ben,Özdemir,03.04.2012'), ['Müller|Anna', 'Özdemir|Ben']);
  assert.deepEqual(names('first name,last name\nAnna,Müller'), ['Müller|Anna']);
});

test('CSV mit kombiniertem Namen', () => {
  assert.deepEqual(names('Schüler;Klasse\n"Müller, Anna";8b\nBen Özdemir;8b'), ['Müller|Anna', 'Özdemir|Ben']);
  assert.deepEqual(names('Name\nAnna Müller\nClara von Berg'), ['Müller|Anna', 'von Berg|Clara']);
});

test('CSV ohne Kopfzeile: Nummernspalte überspringen', () => {
  assert.deepEqual(names('1;Müller;Anna;8b\n2;Özdemir;Ben;8b'), ['Müller|Anna', 'Özdemir|Ben']);
});

test('Anführungszeichen und eingebettete Trennzeichen', () => {
  assert.deepEqual(parseCSV('"a;b";"c ""d""";e\n', ';'), [['a;b', 'c "d"', 'e']]);
});

test('Eingefügte Liste: ein Name pro Zeile', () => {
  assert.deepEqual(names('Anna Müller\nBen Özdemir\n\nClara von Berg\n'), ['Müller|Anna', 'Özdemir|Ben', 'von Berg|Clara']);
  assert.deepEqual(names('Müller, Anna\nÖzdemir, Ben'), ['Müller|Anna', 'Özdemir|Ben']);
  assert.deepEqual(names('1. Anna Müller\n2. Ben Özdemir'), ['Müller|Anna', 'Özdemir|Ben']);
  assert.deepEqual(names('Müller\tAnna\nÖzdemir\tBen'), ['Müller|Anna', 'Özdemir|Ben']);
  assert.deepEqual(names('Anna-Lena Schmidt-Weber\nMarie Luise Klein'), ['Schmidt-Weber|Anna-Lena', 'Klein|Marie Luise']);
});

test('Namenszerlegung mit Reihenfolge', () => {
  assert.deepEqual(splitName('Müller Anna', 'last-first'), { lastName: 'Müller', firstName: 'Anna' });
  assert.deepEqual(splitName('von Berg Clara', 'last-first'), { lastName: 'von Berg', firstName: 'Clara' });
  assert.deepEqual(splitName('Mehmet', 'first-last'), { firstName: '', lastName: 'Mehmet' });
  const a = analyzeNameText('Müller Anna\nÖzdemir Ben');
  assert.deepEqual(extractNames(a.rows, { ...a.mapping, order: 'last-first' }).map((n) => n.firstName), ['Anna', 'Ben']);
});

test('CSV-Export: BOM, Semikolon, CRLF, Maskierung, Formelschutz', () => {
  const out = buildCSV(['Name', 'Note'], [['Müller, Anna', '2-'], ['Ben "B"', '=1+1'], ['Zeile\numbruch', '1,5']]);
  assert.ok(out.startsWith('\uFEFF'));
  const lines = out.slice(1).split('\r\n');
  assert.equal(lines[0], 'Name;Note');
  assert.equal(lines[1], 'Müller, Anna;2-');
  assert.equal(lines[2], '"Ben ""B""";\'=1+1');
  assert.equal(lines[3], '"Zeile\numbruch";1,5');
  assert.ok(out.endsWith('\r\n'));
});
