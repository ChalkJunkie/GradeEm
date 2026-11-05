/**
 * Grade’Em – Berechnung einer Bewertung für ein beliebiges Raster
 * ================================================================
 * Eine Bewertung speichert pro bewertetem Bereich (Kriterium bzw. Matrix-Achse)
 *   crit[i] = { sel: [Stufenindex, …], pts: { Stufenindex: gewählte Punkte }, comment }
 *
 * wertung „mittelwert“: Zeilenwert = Mittel der Notenwerte der markierten Stufen,
 *                       Vorschlag = gewichteter Mittelwert der Zeilen.
 * wertung „summe“:      Zeilenwert = Punkte der markierten Stufe (bei mehreren: Mittel),
 *                       Summe → Note über die gewählte Umrechnungstabelle. Kriterien mit
 *                       Gewicht 0 werden angezeigt, zählen aber nicht zur Summe.
 * typ „matrix“:         crit[0] = gewählte Zeile, crit[1] = gewählte Spalte;
 *                       Vorschlag = Mittel der Noten in der Zelle.
 */
import { pointsToNote, POINTS_MIN, POINTS_MAX } from './grades.js';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

export function critCount(r) {
  return r.meta.typ === 'matrix' ? 2 : r.kriterien.length;
}

export function defaultWeights(r) {
  return r.meta.typ === 'matrix' ? [] : r.kriterien.map((k) => (isNum(k.gewicht) ? k.gewicht : 1));
}

export function emptyCrit(r) {
  return Array.from({ length: critCount(r) }, () => ({ sel: [], pts: {}, comment: '' }));
}

/** Gültige Gewichte für dieses Raster (sonst die Gewichte aus dem Raster). */
export function weightsFor(r, w) {
  return Array.isArray(w) && w.length === r.kriterien.length && w.every((x) => isNum(x) && x >= 0) ? w : defaultWeights(r);
}

/** Punkte einer markierten Stufe (bei mehreren möglichen Werten: gewählter, sonst erster). */
export function pointsOf(r, lvl, c) {
  const opts = (r.stufen[lvl] && r.stufen[lvl].punkte) || [];
  const chosen = c && c.pts ? c.pts[lvl] : undefined;
  if (isNum(chosen) && opts.includes(chosen)) return chosen;
  return opts.length ? opts[0] : 0;
}

/** Höchstmögliche Summe. */
export function maxSum(r) {
  const best = Math.max(0, ...r.stufen.map((st) => (st.punkte.length ? Math.max(...st.punkte) : 0)));
  return best * r.kriterien.filter((k) => k.gewicht !== 0).length;
}

/**
 * Summe → Note über eine Umrechnung.
 * @returns {{note:number|null, text:string, titel:string}}
 */
export function convertSum(r, sum, index = 0) {
  const u = r.umrechnungen[index] || r.umrechnungen[0];
  if (!u) return { note: null, text: '', titel: '' };
  if (u.notenpunkte) {
    const p = Math.min(POINTS_MAX, Math.max(POINTS_MIN, sum));
    return { note: pointsToNote(p), text: `${p} Notenpunkte`, titel: u.titel };
  }
  let row = u.rows.find((x) => sum <= x.von && sum >= x.bis);
  if (!row && u.rows.length) {
    // außerhalb der Tabelle: nächstgelegene Zeile
    row = u.rows.reduce((best, x) => {
      const d = Math.min(Math.abs(sum - x.von), Math.abs(sum - x.bis));
      return !best || d < best.d ? { ...x, d } : best;
    }, null);
  }
  return row ? { note: row.note, text: row.noteText, titel: u.titel } : { note: null, text: '', titel: u.titel };
}

/**
 * Wertet eine Bewertung aus.
 * @param {object} r Raster-Modell
 * @param {object|null} a Bewertung { crit, weights, umrechnung, final }
 * @returns {{rows:(number|null)[], proposal:number|null, complete:boolean, final:number|null,
 *            effective:number|null, adjusted:boolean, info:object}}
 */
export function evaluateRaster(r, a) {
  const crit = (a && Array.isArray(a.crit) && a.crit) || [];
  const final = a && isNum(a.final) ? a.final : null;
  const info = {};
  let rows;
  let proposal = null;
  let complete = false;

  if (r.meta.typ === 'matrix') {
    const z = crit[0] && crit[0].sel && crit[0].sel.length ? crit[0].sel[0] : null;
    const s = crit[1] && crit[1].sel && crit[1].sel.length ? crit[1].sel[0] : null;
    rows = [z, s];
    const cell = z !== null && s !== null && r.matrix.cells[z] ? r.matrix.cells[z][s] : null;
    if (cell && cell.noten.length) {
      proposal = mean(cell.noten.map((n) => n.value));
      info.cell = cell;
      complete = true;
    }
  } else if (r.meta.wertung === 'summe') {
    rows = r.kriterien.map((_, i) => {
      const c = crit[i];
      if (!c || !c.sel || !c.sel.length) return null;
      return mean(c.sel.map((l) => pointsOf(r, l, c)));
    });
    const counted = r.kriterien.map((k) => k.gewicht !== 0);
    const rated = rows.filter((v, i) => counted[i] && isNum(v));
    complete = rated.length === counted.filter(Boolean).length;
    info.max = maxSum(r);
    if (rated.length) {
      const sum = Math.round(rated.reduce((x, y) => x + y, 0) + 1e-9);
      info.sum = sum;
      info.conv = convertSum(r, sum, a && isNum(a.umrechnung) ? a.umrechnung : 0);
      proposal = info.conv.note;
    }
  } else {
    const w = weightsFor(r, a && a.weights);
    rows = r.kriterien.map((_, i) => {
      const c = crit[i];
      if (!c || !c.sel || !c.sel.length) return null;
      const vals = c.sel.map((l) => (r.stufen[l] ? r.stufen[l].note : null)).filter(isNum);
      return vals.length ? mean(vals) : null;
    });
    let sum = 0;
    let wsum = 0;
    complete = true;
    rows.forEach((v, i) => {
      if (!(w[i] > 0)) return;
      if (isNum(v)) {
        sum += v * w[i];
        wsum += w[i];
      } else complete = false;
    });
    if (wsum > 0) proposal = sum / wsum;
    else complete = false;
    info.weights = w;
  }
  return { rows, proposal, complete, final, effective: final !== null ? final : proposal, adjusted: final !== null, info };
}

/** Status: 'done' (vollständig), 'partial' (angefangen), 'open'. */
export function statusOf(r, a) {
  if (!a) return 'open';
  const ev = evaluateRaster(r, a);
  if (ev.complete) return 'done';
  return ev.rows.some((v) => v !== null) ? 'partial' : 'open';
}
