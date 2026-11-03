/**
 * Grade’Em – CSV und Namenslisten
 * ===================================
 * Import: erkennt Trennzeichen (Semikolon, Komma, Tabulator), Kopfzeilen und
 * Namensspalten (Nachname/Vorname getrennt oder kombiniert).
 * Export: Excel-kompatibel (UTF-8 mit BOM, Semikolon, CRLF).
 */

const DELIMS = [';', ',', '\t'];

/** Namenszusätze, die zum Nachnamen gehören (von, van, de …). */
const PARTICLES = new Set(['von', 'van', 'de', 'der', 'den', 'zu', 'zur', 'vom', 'di', 'da', 'del', 'della', 'du', 'la', 'le', 'ten', 'ter', 'al', 'el', 'bin', 'ibn']);

/**
 * Zerlegt CSV-Text in Zeilen und Felder (RFC 4180, Anführungszeichen erlaubt).
 * @param {string} text
 * @param {string|null} delim Trennzeichen; null = jede Zeile ist ein Feld
 * @returns {string[][]}
 */
export function parseCSV(text, delim) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      field = '';
    } else if (delim && ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((f) => f.trim()))
    .filter((r) => r.some((f) => f !== ''));
}

/**
 * Erkennt das Trennzeichen anhand der ersten Zeilen.
 * @param {string} text
 * @returns {string|null} ';' ',' '\t' oder null (eine Spalte)
 */
export function detectDelimiter(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .slice(0, 30);
  if (!lines.length) return null;
  let best = null;
  let bestScore = 0;
  for (const d of DELIMS) {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    const withDelim = counts.filter((c) => c > 0).length;
    if (!withDelim) continue;
    // Anteil der Zeilen mit Trennzeichen, Bonus für gleichbleibende Feldzahl
    const mode = mostFrequent(counts.filter((c) => c > 0));
    const consistent = counts.filter((c) => c === mode).length;
    const score = withDelim / lines.length + consistent / lines.length + (d === ';' ? 0.01 : d === '\t' ? 0.005 : 0);
    if (withDelim / lines.length >= 0.6 && score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

function countOutsideQuotes(line, d) {
  let n = 0;
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (!q && ch === d) n++;
  }
  return n;
}

function mostFrequent(arr) {
  const m = new Map();
  let best = arr[0];
  let bestN = 0;
  for (const v of arr) {
    const n = (m.get(v) || 0) + 1;
    m.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s_.:/*-]+/g, ' ')
    .trim();
}

const RE_FIRST = /^(vorname|vornamen|rufname|first ?name|given ?name|firstname|givenname)$/;
const RE_LAST = /^(nachname|familienname|zuname|name|last ?name|lastname|surname|family ?name)$/;
const RE_FULL = /^(schüler|schueler|schüler ?in|schüler ?innen|schülerin|schülername|schuelername|vollständiger name|voller name|full ?name|kind|teilnehmer|teilnehmer ?in|student|lernende|name)$/;
const RE_CLASS = /^(klasse|kl|class|lerngruppe|kurs)$/;

/**
 * Schlägt eine Spaltenzuordnung vor.
 * @param {string[][]} rows
 * @returns {{hasHeader:boolean, mode:'split'|'combined', last:number, first:number, full:number, klasse:number, order:'first-last'|'last-first'}}
 */
export function guessMapping(rows) {
  const res = { hasHeader: false, mode: 'combined', last: -1, first: -1, full: 0, klasse: -1, order: 'first-last' };
  if (!rows.length) return res;
  const head = rows[0].map(norm);
  const iFirst = head.findIndex((h) => RE_FIRST.test(h));
  const iLast = head.findIndex((h, i) => i !== iFirst && RE_LAST.test(h));
  const iFull = head.findIndex((h) => RE_FULL.test(h));
  const iClass = head.findIndex((h) => RE_CLASS.test(h));
  if (iFirst >= 0 || iLast >= 0 || iFull >= 0) {
    res.hasHeader = true;
    res.klasse = iClass;
    if (iFirst >= 0 && iLast >= 0) {
      Object.assign(res, { mode: 'split', first: iFirst, last: iLast });
    } else if (iFirst >= 0 && iFull >= 0 && iFull !== iFirst) {
      Object.assign(res, { mode: 'split', first: iFirst, last: iFull });
    } else {
      const idx = iFull >= 0 ? iFull : iLast >= 0 ? iLast : iFirst;
      Object.assign(res, { mode: 'combined', full: idx });
    }
    const body = rows.slice(1);
    if (res.mode === 'combined') res.order = guessOrder(body.map((r) => r[res.full] || ''));
    return res;
  }
  // Keine Kopfzeile: Textspalten suchen (Nummern, Daten, Klassen überspringen)
  const width = Math.max(...rows.map((r) => r.length));
  const textCols = [];
  for (let c = 0; c < width; c++) {
    const vals = rows.map((r) => r[c] || '').filter(Boolean);
    if (!vals.length) continue;
    const texty = vals.filter((v) => /[A-Za-zÄÖÜäöüßÀ-ž]{2,}/.test(v) && !/^\d/.test(v)).length;
    const classy = vals.filter((v) => /^(\d{1,2}\s?[a-zA-Z]{0,2}|J\s?[12]|K\s?[12]|EF|Q[12])$/.test(v)).length;
    if (texty / vals.length >= 0.8 && classy / vals.length < 0.5) textCols.push(c);
  }
  if (textCols.length >= 2) {
    const a = textCols[0];
    const b = textCols[1];
    // Zwei Spalten: Standard Nachname | Vorname (wie in Schulverwaltungs-Exporten)
    Object.assign(res, { mode: 'split', last: a, first: b });
  } else {
    const idx = textCols.length ? textCols[0] : 0;
    Object.assign(res, { mode: 'combined', full: idx });
    res.order = guessOrder(rows.map((r) => r[idx] || ''));
  }
  return res;
}

/** Bei kombinierten Namen ohne Komma ist „Vorname Nachname“ der Standard. */
function guessOrder() {
  return 'first-last';
}

/**
 * Zerlegt einen kombinierten Namen.
 *  „Müller, Anna“       → Nachname Müller, Vorname Anna
 *  „Anna Müller“         → (first-last) Vorname Anna, Nachname Müller
 *  „Anna von Berg“       → Vorname Anna, Nachname von Berg
 *  „Müller Anna“         → (last-first) Nachname Müller, Vorname Anna
 * @param {string} raw
 * @param {'first-last'|'last-first'} order
 * @returns {{firstName:string, lastName:string}}
 */
export function splitName(raw, order = 'first-last') {
  let s = String(raw || '')
    .replace(/^\s*\d+\s*[.):]\s+/, '') // Nummerierung „1. “ / „1) “
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return { firstName: '', lastName: '' };
  if (s.includes(',')) {
    const [last, ...rest] = s.split(',');
    return { lastName: last.trim(), firstName: rest.join(',').trim() };
  }
  const t = s.split(' ');
  if (t.length === 1) return { firstName: '', lastName: t[0] };
  if (order === 'last-first') {
    let i = 0;
    while (i < t.length - 1 && PARTICLES.has(t[i].toLowerCase())) i++;
    return { lastName: t.slice(0, i + 1).join(' '), firstName: t.slice(i + 1).join(' ') };
  }
  let i = t.length - 1;
  while (i > 1 && PARTICLES.has(t[i - 1].toLowerCase())) i--;
  return { firstName: t.slice(0, i).join(' '), lastName: t.slice(i).join(' ') };
}

/**
 * Wendet eine Spaltenzuordnung an.
 * @param {string[][]} rows
 * @param {object} mapping aus guessMapping (ggf. vom Nutzer geändert)
 * @returns {{firstName:string, lastName:string, klasse:string}[]}
 */
export function extractNames(rows, mapping) {
  const body = mapping.hasHeader ? rows.slice(1) : rows;
  const out = [];
  for (const r of body) {
    let firstName;
    let lastName;
    if (mapping.mode === 'split') {
      firstName = (r[mapping.first] || '').trim();
      lastName = (r[mapping.last] || '').trim();
    } else {
      ({ firstName, lastName } = splitName(r[mapping.full] || '', mapping.order));
    }
    if (!firstName && !lastName) continue;
    out.push({ firstName, lastName, klasse: mapping.klasse >= 0 ? (r[mapping.klasse] || '').trim() : '' });
  }
  return out;
}

/**
 * Komplettanalyse eines eingefügten Textes oder einer CSV-Datei.
 * @param {string} text
 */
export function analyzeNameText(text) {
  const delim = detectDelimiter(text);
  const rows = parseCSV(text, delim);
  const mapping = guessMapping(rows);
  return { delim, rows, mapping, names: extractNames(rows, mapping) };
}

/** Vergleichsschlüssel zum Erkennen doppelter Namen. */
export function nameKey(n) {
  return `${(n.lastName || '').toLocaleLowerCase('de')}|${(n.firstName || '').toLocaleLowerCase('de')}`.replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function csvField(v) {
  let s = v === null || v === undefined ? '' : String(v);
  // Schutz vor Formel-Ausführung in Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Baut eine Excel-kompatible CSV-Datei (UTF-8 mit BOM, Semikolon, CRLF).
 * @param {string[]} header
 * @param {Array<Array<string|number>>} rows
 * @returns {string}
 */
export function buildCSV(header, rows) {
  const lines = [header, ...rows].map((r) => r.map(csvField).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
