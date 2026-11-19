/**
 * Grade’Em – Aufbereitung der Daten für Schülibögen und Notenliste.
 * Wird von Druckansicht, Word-Export und CSV-Export gemeinsam genutzt.
 */
import {
  describeGrade, formatDecimal, normalizeWeights, roundToQuarter, noteToPoints, pointsToNote, pointsTendency,
} from './grades.js';
import { evaluateRaster, critCount } from './engine.js';

/** Name in der gewünschten Reihenfolge. */
export function studentName(s, order = 'first-last') {
  if (!s) return '';
  const f = (s.firstName || '').trim();
  const l = (s.lastName || '').trim();
  if (order === 'last-first') return f && l ? `${l}, ${f}` : l || f;
  return [f, l].filter(Boolean).join(' ');
}

const PARTICLE_RE = /^((von|van|de|der|den|zu|zur|vom|di|da|del|della|du|la|le|ten|ter)\s+)+/i;

/** Sortierschlüssel des Nachnamens: Namenszusätze wie „von“ bleiben unberücksichtigt (DIN 5007). */
export function sortKey(lastName) {
  return String(lastName || '').replace(PARTICLE_RE, '').trim();
}

/** Sortierung nach Nachname, dann Vorname (deutsche Kollation). */
export function compareStudents(a, b) {
  const c = sortKey(a.lastName).localeCompare(sortKey(b.lastName), 'de', { sensitivity: 'base' });
  if (c) return c;
  return (a.firstName || '').localeCompare(b.firstName || '', 'de', { sensitivity: 'base' });
}

/** Heutiges Datum als ISO-String (lokale Zeit). */
export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** „2026-11-02“ → „02.11.2026“ */
export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** Klassenbezeichnung einer Gruppe. */
export function klasseOf(group) {
  return (group && (group.klasse || group.name)) || '';
}

/** Kurzname eines bewerteten Bereichs (für Tabellenköpfe). */
export function critShort(r, i) {
  if (r.meta.typ === 'matrix') return i === 0 ? 'Zeile' : 'Spalte';
  return r.kriterien[i] ? r.kriterien[i].name : '';
}

/** Anzeige des Werts eines Bereichs: Zeilenwert, Punkte oder Matrix-Kürzel. */
export function rowText(r, ev, i) {
  const v = ev.rows[i];
  if (v === null || v === undefined) return '';
  if (r.meta.typ === 'matrix') {
    const axis = i === 0 ? r.zeilen : r.spalten;
    return axis.items[v] ? axis.items[v].key : '';
  }
  return formatDecimal(v, 2, true);
}

/**
 * Hat der Bogen mindestens einen Kommentar? Nur dann wird die Kommentarspalte gedruckt;
 * ohne Kommentare bekommen die Beschreibungsspalten die ganze Breite.
 */
export function hasComments(s) {
  return Array.isArray(s.crit) && s.crit.some((c) => c && String(c.comment || '').trim() !== '');
}

/**
 * Bogenform eines Schülibogens: 'kompakt' (Kreuzliste mit bester und schwächster
 * Beschreibung) oder 'vollstaendig' (alle Beschreibungen). Matrix-Raster haben eine
 * eigene Form; sonst gilt die Wahl der Lerngruppe, ohne Wahl die Angabe im Raster.
 */
export function sheetForm(raster, choice) {
  if (raster.meta.typ === 'matrix') return 'matrix';
  return choice === 'kompakt' || choice === 'vollstaendig' ? choice : raster.meta.schuelibogen;
}

/**
 * Daten für einen ausgefüllten Schülibogen.
 * @param {string} [form] gewählte Bogenform ('kompakt'|'vollstaendig'), sonst wie im Raster
 */
export function buildSheet({ student, group, round, raster, assessment, scale = 'quarter', form }) {
  const ev = evaluateRaster(raster, assessment);
  const crit = Array.from({ length: critCount(raster) }, (_, i) => {
    const c = assessment && assessment.crit ? assessment.crit[i] : null;
    return {
      sel: c ? [...new Set(c.sel || [])].sort((a, b) => a - b) : [],
      pts: (c && c.pts) || {},
      comment: (c && c.comment) || '',
    };
  });
  return {
    raster,
    form: sheetForm(raster, form),
    ev,
    crit,
    name: studentName(student, 'first-last'),
    klasse: klasseOf(group),
    datum: assessment ? formatDate(assessment.date) : '',
    zeitraum: round ? round.title : '',
    note: ev.effective !== null ? describeGrade(ev.effective, scale).text : '',
  };
}

/** Felder der Kopfzeile mit eingetragenen Werten. */
export function headerFields(sheet) {
  const labels = sheet.raster.meta.kopfzeile.length ? sheet.raster.meta.kopfzeile : ['Name', 'Klasse', 'Datum', 'Note'];
  return labels.map((label) => {
    const l = label.toLowerCase();
    let value = '';
    let kind = 'other';
    if (/selbst/.test(l)) kind = 'self';
    else if (/summe/.test(l)) { value = sheet.ev.info.sum !== undefined ? String(sheet.ev.info.sum) : ''; kind = 'summe'; }
    else if (/name|schüler|schüli/.test(l)) { value = sheet.name; kind = 'name'; }
    else if (/klasse|kurs|lerngruppe/.test(l)) { value = sheet.klasse; kind = 'klasse'; }
    else if (/zeitraum/.test(l)) { value = sheet.zeitraum; kind = 'zeitraum'; }
    else if (/note/.test(l)) {
      value = /datum/.test(l) ? [sheet.note, sheet.datum ? `(${sheet.datum})` : ''].filter(Boolean).join(' ') : sheet.note;
      kind = 'note';
    } else if (/datum/.test(l)) { value = sheet.datum; kind = 'datum'; }
    return { label, value, kind };
  });
}

/** Summenzeile bei Punkte-Rastern, z. B. „Summe: 12 / 15 Sterne → Note 2“. */
export function sumText(sheet) {
  const { info } = sheet.ev;
  const unit = sheet.raster.meta.einheit || 'Punkte';
  if (info.sum === undefined) return `Summe: – / ${info.max} ${unit}`;
  const conv = info.conv && info.conv.text ? ` → ${info.conv.titel ? `${info.conv.titel}: ` : ''}${/notenpunkte/i.test(info.conv.text) ? info.conv.text : `Note ${info.conv.text}`}` : '';
  return `Summe: ${info.sum} / ${info.max} ${unit}${conv}`;
}

/**
 * Zeilen der Notenliste.
 */
export function buildGradeList({ students, group, raster, assessmentsByStudent, nameOrder = 'last-first' }) {
  return students.map((s) => {
    const a = assessmentsByStudent.get(s.id) || null;
    const ev = evaluateRaster(raster, a);
    const prop = describeGrade(ev.proposal, 'both');
    const fin = describeGrade(ev.effective, 'both');
    return {
      student: s,
      name: studentName(s, nameOrder),
      klasse: klasseOf(group),
      datum: a ? formatDate(a.date) : '',
      rowTexts: Array.from({ length: critCount(raster) }, (_, i) => rowText(raster, ev, i)),
      sum: ev.info.sum !== undefined ? ev.info.sum : '',
      complete: ev.complete,
      adjusted: ev.adjusted,
      proposalDecimal: ev.proposal === null ? '' : formatDecimal(ev.proposal, 2),
      proposalQuarter: prop.quarter,
      proposalPoints: prop.points === null ? '' : prop.points,
      finalQuarter: fin.quarter,
      finalPoints: fin.points === null ? '' : fin.points,
      weights: a && Array.isArray(a.weights) ? a.weights : null,
    };
  });
}

/** Schreibweisen für das Übertragen der Endnote in eine andere Notenverwaltung (z. B. TeacherTool). */
export const TRANSFER_NOTATIONS = [['dezimal', 'Dezimal'], ['tendenz', 'Tendenz'], ['punkte', 'Notenpunkte']];

/**
 * Endnote für das Abtippen in einer anderen App.
 * Die Endnote ist die Note, die auch auf dem Schülibogen steht: bei der Skala
 * „Notenpunkte“ der Punktwert, sonst die Viertelnote.
 *  • dezimal: exakt, z. B. 1-2 → „1,5“
 *  • tendenz: nächste Tendenz der Noten 1+ … 6 (15 P ≙ 1+ … 0 P ≙ 6); Zwischenwerte wie 1-2
 *    werden zugunsten der Schülis gerundet (→ 1-)
 *  • punkte: Notenpunkte 15 … 0
 * @returns {{main: string, base: string, source: string}|null} null ohne Endnote;
 *   base = Endnote als Zahl (Schlüssel, um spätere Änderungen zu erkennen), source = Schreibweise in Grade’Em
 */
export function transferGrade(effective, notation, scale = 'quarter') {
  if (typeof effective !== 'number' || !Number.isFinite(effective)) return null;
  const base = scale === 'points' ? pointsToNote(noteToPoints(effective)) : roundToQuarter(effective);
  const points = noteToPoints(base);
  let main;
  if (notation === 'tendenz') main = pointsTendency(points);
  else if (notation === 'punkte') main = String(points);
  else main = formatDecimal(base, 2, true);
  return { main, base: base.toFixed(3), source: describeGrade(effective, scale).short };
}

/** Spalten der Endnote je nach Notenskala. */
export function finalLabels(scale) {
  const out = [];
  if (scale !== 'points') out.push('Endnote (Viertelnote)');
  if (scale !== 'quarter') out.push('Endnote (Punkte)');
  return out;
}

/** Werte der Endnote einer Listenzeile passend zu finalLabels(). */
export function finalValues(x, scale) {
  const out = [];
  if (scale !== 'points') out.push(x.finalQuarter);
  if (scale !== 'quarter') out.push(x.finalPoints);
  return out;
}

/** Werte der Kriterien als lesbarer Text, z. B. „Fachwissen 2 · Fachsprache 2,5“. */
export function criteriaText(raster, x) {
  const parts = x.rowTexts.map((t, i) => (t ? `${critShort(raster, i)} ${t}` : '')).filter(Boolean);
  if (x.sum !== '' && x.sum !== undefined) parts.push(`Summe ${x.sum}`);
  return parts.join(' · ');
}

/**
 * Kopf und Zeilen für den CSV-Export der Notenliste einer Runde.
 * @param {{criteria?: boolean}} opt criteria=false: nur Name, Klasse und Endnote
 */
export function gradeListTable(list, scale, raster, { criteria = true } = {}) {
  if (!criteria) {
    return {
      header: ['Name', 'Klasse', ...finalLabels(scale), 'Nachgeschärft'],
      rows: list.map((r) => [r.name, r.klasse, ...finalValues(r, scale), r.adjusted ? 'ja' : 'nein']),
    };
  }
  const q = scale !== 'points';
  const p = scale !== 'quarter';
  const n = critCount(raster);
  const summe = raster.meta.typ !== 'matrix' && raster.meta.wertung === 'summe';
  const header = ['Name', 'Klasse', 'Datum', ...Array.from({ length: n }, (_, i) => critShort(raster, i))];
  if (summe) header.push('Summe');
  header.push('Berechnete Note (dezimal)');
  if (q) header.push('Berechnete Note (Viertelnote)');
  if (p) header.push('Berechnete Note (Punkte)');
  header.push(...finalLabels(scale));
  header.push('Nachgeschärft', 'Vollständig bewertet');
  const rows = list.map((r) => {
    const row = [r.name, r.klasse, r.datum, ...r.rowTexts];
    if (summe) row.push(r.sum);
    row.push(r.proposalDecimal);
    if (q) row.push(r.proposalQuarter);
    if (p) row.push(r.proposalPoints);
    row.push(...finalValues(r, scale));
    row.push(r.adjusted ? 'ja' : 'nein', r.complete ? 'ja' : 'nein');
    return row;
  });
  return { header, rows };
}

/**
 * CSV-Tabelle über mehrere Runden.
 * @param {{title: string, raster: object, list: object[]}[]} rounds je Runde die Liste aus
 *   buildGradeList() – alle Listen enthalten dieselben Schülis in derselben Reihenfolge
 * @param {{criteria?: boolean, arrange?: 'klasse'|'schueli'}} opt
 *   klasse: eine Zeile je Schüli, Spalten je Runde; schueli: eine Zeile je Schüli und Runde
 */
export function roundsTable(rounds, scale, { criteria = false, arrange = 'klasse' } = {}) {
  const first = rounds[0] ? rounds[0].list : [];
  if (arrange === 'schueli') {
    const header = ['Name', 'Klasse', 'Runde', 'Raster', 'Datum'];
    if (criteria) header.push('Kriterien', 'Berechnete Note (dezimal)');
    header.push(...finalLabels(scale), 'Nachgeschärft');
    const rows = [];
    first.forEach((_, i) => {
      for (const rd of rounds) {
        const x = rd.list[i];
        const row = [x.name, x.klasse, rd.title, rd.rasterName || '', x.datum];
        if (criteria) row.push(criteriaText(rd.raster, x), x.proposalDecimal);
        row.push(...finalValues(x, scale), x.adjusted ? 'ja' : 'nein');
        rows.push(row);
      }
    });
    return { header, rows };
  }
  const header = ['Name', 'Klasse'];
  for (const rd of rounds) {
    const t = rd.title;
    if (criteria) {
      const n = critCount(rd.raster);
      header.push(`${t}: Datum`, ...Array.from({ length: n }, (_, i) => `${t}: ${critShort(rd.raster, i)}`));
      if (rd.raster.meta.typ !== 'matrix' && rd.raster.meta.wertung === 'summe') header.push(`${t}: Summe`);
      header.push(`${t}: Berechnete Note (dezimal)`);
    }
    header.push(...finalLabels(scale).map((l) => `${t}: ${l}`));
  }
  const rows = first.map((x0, i) => {
    const row = [x0.name, x0.klasse];
    for (const rd of rounds) {
      const x = rd.list[i];
      if (criteria) {
        row.push(x.datum, ...x.rowTexts);
        if (rd.raster.meta.typ !== 'matrix' && rd.raster.meta.wertung === 'summe') row.push(x.sum);
        row.push(x.proposalDecimal);
      }
      row.push(...finalValues(x, scale));
    }
    return row;
  });
  return { header, rows };
}

/** Lesbare Gewichtung, z. B. „Qualität der Beiträge 50 %, Fachwissen 25 %, …“. */
export function weightsText(raster, weights) {
  if (raster.meta.typ === 'matrix' || raster.meta.wertung === 'summe') return '';
  const arr = Array.isArray(weights) && weights.length === raster.kriterien.length ? weights : raster.kriterien.map((k) => k.gewicht);
  const obj = {};
  arr.forEach((w, i) => { obj[i] = w; });
  const sum = arr.reduce((a, b) => a + (b > 0 ? b : 0), 0) || 1;
  return raster.kriterien.map((k, i) => `${k.name} ${formatDecimal((Math.max(0, arr[i]) / sum) * 100, 1, true)} %`).join(', ');
}

export { normalizeWeights };
