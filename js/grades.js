/**
 * Grade’Em – Notenberechnung und Umrechnung
 * =============================================
 *
 * Intern rechnet die App mit einer Dezimalnote:
 *   1,0 = sehr gut … 6,0 = ungenügend.
 *
 * Viertelnoten
 *   Die Dezimalnote wird auf die nächste Viertelstufe gerundet und so benannt:
 *     1,00 → "1"     1,25 → "1-"    1,50 → "1-2"   1,75 → "2+"
 *     2,00 → "2"     2,25 → "2-"    2,50 → "2-3"   2,75 → "3+"   … bis 6,00 → "6"
 *   Liegt ein Wert exakt in der Mitte zwischen zwei Stufen (z. B. 2,125),
 *   wird zugunsten der Schülerin / des Schülers gerundet (also 2,0).
 *
 * Notenpunkte (Baden-Württemberg, Oberstufe)
 *   Punkte = 17 − 3 × Note, kaufmännisch gerundet und auf 0 … 15 begrenzt.
 *   Exakte Mitten (z. B. 12,5) werden ebenfalls zugunsten der Schülerin /
 *   des Schülers gerundet (also 13).
 *     15 P ≙ 1+   14 P ≙ 1   13 P ≙ 1-   12 P ≙ 2+   11 P ≙ 2   10 P ≙ 2- …
 *      3 P ≙ 5+    2 P ≙ 5    1 P ≙ 5-    0 P ≙ 6
 *   Rückrichtung: Note = (17 − Punkte) / 3. 15 Punkte entsprechen damit 0,67;
 *   deshalb darf eine in Punkten nachgeschärfte Endnote unter 1,0 liegen.
 *
 * Alle Funktionen sind rein (ohne Seiteneffekte) und werden in tests/ geprüft.
 */

/** Toleranz gegen Rundungsfehler der Gleitkommazahlen. */
const EPS = 1e-9;

export const NOTE_MIN = 1;
export const NOTE_MAX = 6;
/** Kleinste mögliche Dezimalnote (≙ 15 Punkte). */
export const NOTE_MIN_POINTS = 2 / 3;

export const POINTS_MIN = 0;
export const POINTS_MAX = 15;

/** Die drei Zeilen des Rasters (Schlüssel im Datenmodell). */
export const ROW_KEYS = ['quality', 'knowledge', 'language'];

/** Standardgewichtung: jede Zeile gleich (je 1/3). Gewichte sind relativ. */
export const DEFAULT_WEIGHTS = Object.freeze({ quality: 1, knowledge: 1, language: 1 });

function isNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function clamp(x, min, max) {
  return Math.min(max, Math.max(min, x));
}

/**
 * Rundet eine Dezimalnote auf die nächste Viertelstufe (1,0 … 6,0).
 * Exakte Mitten werden zur besseren (kleineren) Note gerundet.
 * @param {number} note Dezimalnote
 * @returns {number|null} z. B. 2.25 – oder null bei ungültiger Eingabe
 */
export function roundToQuarter(note) {
  if (!isNum(note)) return null;
  const c = clamp(note, NOTE_MIN, NOTE_MAX);
  return Math.round(c * 4 - EPS) / 4;
}

/**
 * Bezeichnung einer Viertelnote.
 * @param {number} quarter Wert auf Viertelstufe (wird sicherheitshalber gerundet)
 * @returns {string} z. B. "2-", "2-3", "3+"
 */
export function quarterLabel(quarter) {
  const q = roundToQuarter(quarter);
  if (q === null) return '';
  const whole = Math.floor(q + EPS);
  const frac = Math.round((q - whole) * 4); // 0, 1, 2 oder 3 Viertel
  switch (frac) {
    case 0: return String(whole);
    case 1: return `${whole}-`;
    case 2: return `${whole}-${whole + 1}`;
    default: return `${whole + 1}+`;
  }
}

/**
 * Wandelt eine Dezimalnote in Notenpunkte um: 17 − 3 × Note, gerundet, 0 … 15.
 * Exakte Mitten werden zur höheren Punktzahl (bessere Note) gerundet.
 * @param {number} note Dezimalnote
 * @returns {number|null} ganze Punktzahl
 */
export function noteToPoints(note) {
  if (!isNum(note)) return null;
  const raw = 17 - 3 * note;
  return clamp(Math.round(raw + EPS), POINTS_MIN, POINTS_MAX);
}

/**
 * Wandelt Notenpunkte in eine Dezimalnote um: (17 − Punkte) / 3.
 * @param {number} points 0 … 15
 * @returns {number|null}
 */
export function pointsToNote(points) {
  if (!isNum(points)) return null;
  const p = clamp(Math.round(points), POINTS_MIN, POINTS_MAX);
  return (17 - p) / 3;
}

/**
 * Tendenznote zu einer Punktzahl (15 → "1+", 14 → "1", 13 → "1-", …, 0 → "6").
 * @param {number} points
 * @returns {string}
 */
export function pointsTendency(points) {
  if (!isNum(points)) return '';
  const p = clamp(Math.round(points), POINTS_MIN, POINTS_MAX);
  if (p === 0) return '6';
  const grade = 6 - Math.ceil(p / 3); // 13–15 → 1, 10–12 → 2, …, 1–3 → 5
  const rest = p % 3; // 0 → "+", 2 → "", 1 → "-"
  return `${grade}${rest === 0 ? '+' : rest === 1 ? '-' : ''}`;
}

/**
 * Zeilenwert = Mittelwert der markierten Spalten (1 … 6).
 * @param {number[]} cols markierte Spalten
 * @returns {number|null} null, wenn nichts markiert ist
 */
export function rowValue(cols) {
  if (!Array.isArray(cols)) return null;
  const valid = cols.filter((c) => isNum(c) && c >= 1 && c <= 6);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Normiert relative Gewichte, sodass ihre Summe 1 ergibt.
 * Ungültige oder negative Gewichte zählen als 0. Sind alle 0, gilt je 1/3.
 * @param {{quality:number, knowledge:number, language:number}} weights
 */
export function normalizeWeights(weights) {
  const w = {};
  let sum = 0;
  for (const k of ROW_KEYS) {
    const v = weights && isNum(Number(weights[k])) ? Math.max(0, Number(weights[k])) : 0;
    w[k] = v;
    sum += v;
  }
  if (sum <= 0) return { quality: 1 / 3, knowledge: 1 / 3, language: 1 / 3 };
  for (const k of ROW_KEYS) w[k] /= sum;
  return w;
}

/**
 * Gewichteter Mittelwert der drei Zeilen.
 * Nicht bewertete Zeilen bleiben unberücksichtigt; die übrigen Gewichte werden
 * neu normiert. `complete` ist true, wenn jede Zeile mit Gewicht > 0 bewertet ist.
 * @param {{quality:number|null, knowledge:number|null, language:number|null}} rowValues
 * @param {object} weights relative Gewichte
 * @returns {{value:number|null, complete:boolean}}
 */
export function weightedGrade(rowValues, weights) {
  // Mit den bereinigten Rohgewichten rechnen (z. B. 1 : 1 : 1), das vermeidet
  // Rundungsrauschen wie 1,9999… statt 2.
  const w = {};
  let total = 0;
  for (const k of ROW_KEYS) {
    const v = weights && isNum(Number(weights[k])) ? Math.max(0, Number(weights[k])) : 0;
    w[k] = v;
    total += v;
  }
  if (total <= 0) for (const k of ROW_KEYS) w[k] = 1;
  let sum = 0;
  let wsum = 0;
  let complete = true;
  for (const k of ROW_KEYS) {
    const v = rowValues ? rowValues[k] : null;
    if (w[k] <= 0) continue;
    if (isNum(v)) {
      sum += v * w[k];
      wsum += w[k];
    } else {
      complete = false;
    }
  }
  if (wsum <= 0) return { value: null, complete: false };
  return { value: sum / wsum, complete };
}

/**
 * Nachschärfen der Note um eine Stufe in der gewählten Skala.
 * @param {number} note aktuelle Dezimalnote (Endnote oder Vorschlag)
 * @param {'quarter'|'points'} scale Schrittweite: Viertelnote oder ganzer Punkt
 * @param {'better'|'worse'} direction
 * @returns {number|null} neue Dezimalnote
 */
export function adjustGrade(note, scale, direction) {
  if (!isNum(note)) return null;
  const better = direction === 'better';
  if (scale === 'points') {
    const p = noteToPoints(note);
    return pointsToNote(clamp(p + (better ? 1 : -1), POINTS_MIN, POINTS_MAX));
  }
  const q = roundToQuarter(note);
  return clamp(q + (better ? -0.25 : 0.25), NOTE_MIN, NOTE_MAX);
}

/**
 * Formatiert eine Zahl mit deutschem Dezimalkomma.
 * @param {number} n
 * @param {number} digits Nachkommastellen
 * @param {boolean} trim überflüssige Nullen am Ende entfernen
 */
export function formatDecimal(n, digits = 2, trim = false) {
  if (!isNum(n)) return '';
  let s = n.toFixed(digits);
  if (trim && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}

/**
 * Darstellung einer Dezimalnote in der gewählten Skala.
 * @param {number|null} note
 * @param {'quarter'|'points'|'both'} scale
 * @returns {{quarter:string, points:number|null, text:string, short:string}}
 */
export function describeGrade(note, scale = 'quarter') {
  if (!isNum(note)) return { quarter: '', points: null, text: '', short: '' };
  const quarter = quarterLabel(roundToQuarter(note));
  const points = noteToPoints(note);
  let text;
  let short;
  if (scale === 'points') {
    text = `${points} ${points === 1 ? 'Punkt' : 'Punkte'}`;
    short = `${points} P`;
  } else if (scale === 'both') {
    text = `${quarter} (${points} ${points === 1 ? 'Punkt' : 'Punkte'})`;
    short = `${quarter} / ${points} P`;
  } else {
    text = quarter;
    short = quarter;
  }
  return { quarter, points, text, short };
}

/**
 * Berechnet alle Kennzahlen einer Bewertung.
 * @param {object} assessment { rows:{quality:{cols:[]},…}, weights, final }
 * @returns {{rows:object, proposal:number|null, complete:boolean, final:number|null, effective:number|null, adjusted:boolean}}
 */
export function evaluate(assessment) {
  const rows = {};
  for (const k of ROW_KEYS) {
    rows[k] = rowValue(assessment && assessment.rows && assessment.rows[k] ? assessment.rows[k].cols : []);
  }
  const weights = (assessment && assessment.weights) || DEFAULT_WEIGHTS;
  const { value, complete } = weightedGrade(rows, weights);
  const final = assessment && isNum(assessment.final) ? assessment.final : null;
  return {
    rows,
    proposal: value,
    complete,
    final,
    effective: final !== null ? final : value,
    adjusted: final !== null,
  };
}
