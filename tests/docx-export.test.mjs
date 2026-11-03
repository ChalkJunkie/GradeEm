/**
 * Erzeugt eine Beispiel-Word-Datei mit derselben Exportfunktion wie die App –
 * je ein Bogen für verschiedene Rasterarten.
 * Aufruf:  node tests/docx-export.test.mjs [ausgabe.docx]      (benötigt: npm i docx)
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { buildSheetsDocument } from '../js/docx-export.js';
import { buildSheet } from '../js/sheet-data.js';
import { parseRaster } from '../js/raster.js';

const require = createRequire(import.meta.url);
let D;
try { D = require('docx'); } catch { D = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/docx'); }

const R = (f) => parseRaster(readFileSync(new URL(`../raster/${f}`, import.meta.url), 'utf8')).raster;
const group = { name: 'Bio 8b', klasse: '8b' };
const round = { title: '1. Halbjahr 2026/27' };
const a = (crit, extra = {}) => ({ date: '2026-11-03', crit: crit.map(([sel, comment = '', pts = {}]) => ({ sel, comment, pts })), ...extra });
const sheets = [
  buildSheet({ student: { firstName: 'Anna', lastName: 'Müller' }, group, round, raster: R('biologie.md'), assessment: a([[[1, 2], 'Gute Fragen zur Fotosynthese.'], [[1]], [[0]]], { weights: [1, 1, 1] }), scale: 'both' }),
  buildSheet({ student: { firstName: 'Ben', lastName: 'Özdemir' }, group, round, raster: R('musik.md'), assessment: a([[[0]], [[1], 'Häufig, aber oft erst spät in der Stunde.'], [[1]], [[2]], [[0]], [[1]]]), scale: 'quarter' }),
  buildSheet({ student: { firstName: 'Clara', lastName: 'von Berg' }, group, round, raster: R('chemie.md'), assessment: a([[[3]], [[2]], [[2]], [[3]], [[1]], [[2]]]), scale: 'points' }),
  buildSheet({ student: { firstName: 'David', lastName: 'Nguyen' }, group, round, raster: R('geschichte.md'), assessment: a([[[1], 'Sichere Quellenarbeit.'], [[1]]], { final: 2.25 }), scale: 'quarter' }),
  buildSheet({ student: { firstName: 'Emma', lastName: 'Schulz' }, group, round, raster: R('ethik.md'), assessment: a([[[0]], [[1]], [[1]], [[2]], [[1]], [[0]]]), scale: 'both' }),
];
const out = process.argv[2] || 'beispiel-schuelibogen.docx';
const buf = await D.Packer.toBuffer(buildSheetsDocument(D, sheets));
writeFileSync(out, buf);
console.log(`OK: ${out} (${buf.length} Bytes, ${sheets.length} Bögen)`);
for (const s of sheets) console.log(' ', s.raster.meta.fach.padEnd(12), s.name.padEnd(16), '| Note:', s.note || '–');
