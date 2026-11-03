/**
 * Grade’Em – Bewertungsraster
 * ===========================
 * Einlesen (Markdown → Modell), Prüfen und Schreiben (Modell → Markdown).
 * Das Format ist in raster/FORMAT.md beschrieben.
 *
 * Modell:
 * {
 *   meta: { format, titel, fach, typ: 'kriterien'|'matrix', wertung: 'mittelwert'|'summe',
 *           titel_schuelibogen, untertitel, klassen, stand, schule, herausgeber, quelle,
 *           kopfzeile: string[], schuelibogen: 'vollstaendig'|'kompakt', kommentarspalte,
 *           notendefinitionen: boolean, spalte_kriterien, spalte_stufen, einheit, extra: {} },
 *   stufen:    [{ name, noteText, note, punkteText, punkte: number[], kreuz }],
 *   kriterien: [{ name, gewicht, schuelibogen, erlaeuterung, cells: string[] }],
 *   umrechnungen: [{ titel, notenpunkte: boolean, rows: [{ summeText, von, bis, noteText, note }] }],
 *   zeilen:  { titel, items: [{ key, text }] },          (nur typ: matrix)
 *   spalten: { titel, items: [{ key, text }] },          (nur typ: matrix)
 *   matrix:  { corner, cells: [[{ text, noten: [{label, value}], punkte: number[] }]] },
 *   einleitung, hinweise, fussnoten, freitext: string[]
 * }
 */

export const FORMAT_ID = 'gradeem-raster/1';

const TEND = (() => {
  const m = {};
  for (let g = 1; g <= 5; g++) {
    m[`${g}`] = g;
    m[`${g}-`] = g + 0.25;
    m[`${g}-${g + 1}`] = g + 0.5;
    m[`${g + 1}+`] = g + 0.75;
  }
  m['1+'] = 2 / 3;
  m['6'] = 6;
  return m;
})();

/**
 * Notenwert lesen: „2“, „2,5“, „2+“, „2-“, „1-2“ oder Bereich „5 bis 6“ (→ Mitte).
 * @returns {number} Dezimalnote
 * @throws {Error} bei unbekannter Schreibweise
 */
export function noteValue(s) {
  const t = String(s ?? '').trim();
  const range = t.split(/\s+bis\s+/i);
  if (range.length === 2) return (noteValue(range[0]) + noteValue(range[1])) / 2;
  if (Object.prototype.hasOwnProperty.call(TEND, t)) return TEND[t];
  if (/^\d+([.,]\d+)?$/.test(t)) {
    const v = parseFloat(t.replace(',', '.'));
    if (v >= 0.5 && v <= 6.5) return v;
  }
  throw new Error(`Notenwert „${t}“ nicht erkannt (erlaubt sind z. B. 2, 2,5, 2+, 1-2 oder 5 bis 6)`);
}

/** Wie noteValue, liest aber nur den Anfang („5 / Arbeitsverweigerung …: 6“ → 5). */
function leadingNote(s) {
  const t = String(s ?? '').trim();
  try {
    return noteValue(t);
  } catch {
    const m = t.match(/^(\S+(\s+bis\s+\S+)?)/i);
    if (m) return noteValue(m[1]);
    throw new Error(`Notenwert „${t}“ nicht erkannt`);
  }
}

/**
 * Punkte lesen: „3“, „15, 14, 13“ oder Bereich „2 bis 0“.
 * @returns {number[]} in der angegebenen Reihenfolge (Bereich absteigend)
 */
export function pointValues(s) {
  const t = String(s ?? '').trim();
  if (!t) return [];
  const range = t.split(/\s+bis\s+/i);
  if (range.length === 2) {
    const a = parseInt(range[0], 10);
    const b = parseInt(range[1], 10);
    if (Number.isNaN(a) || Number.isNaN(b)) throw new Error(`Punkte „${t}“ nicht erkannt`);
    const out = [];
    for (let v = Math.max(a, b); v >= Math.min(a, b); v--) out.push(v);
    return out;
  }
  return t.split(/\s*,\s*/).filter(Boolean).map((x) => {
    if (!/^\d+$/.test(x)) throw new Error(`Punkte „${t}“ nicht erkannt (erlaubt sind z. B. 3, „1, 0“ oder „2 bis 0“)`);
    return parseInt(x, 10);
  });
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function parseTable(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (!lines.length) return null;
  const head = splitRow(lines[0]);
  const rows = lines.slice(1).filter((l) => !/^\|?[\s|:-]+\|?$/.test(l)).map(splitRow);
  return { head, rows };
}

const META_ALIASES = {
  schuelerbogen: 'schuelibogen',
  titel_schuelerbogen: 'titel_schuelibogen',
};
const KNOWN_META = ['format', 'typ', 'wertung', 'titel', 'titel_schuelibogen', 'untertitel', 'fach', 'klassen', 'stand',
  'schule', 'herausgeber', 'quelle', 'kopfzeile', 'schuelibogen', 'kommentarspalte', 'notendefinitionen',
  'spalte_kriterien', 'spalte_stufen', 'einheit'];

/** Entfernt Codeblock-Zäune und Text vor dem Kopfbereich (z. B. aus KI-Antworten). */
function cleanSource(text) {
  let s = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const fence = s.match(/```[a-zA-Z]*\n([\s\S]*?)\n```/);
  if (fence && fence[1].includes('---')) s = fence[1].trim();
  if (!s.startsWith('---')) {
    const i = s.search(/(^|\n)---\n\s*(format|titel)\s*:/);
    if (i >= 0) s = s.slice(s.indexOf('---', i)).trim();
  }
  return s;
}

/**
 * Liest ein Raster.
 * @param {string} text Markdown
 * @returns {{ok:boolean, raster:object|null, errors:string[], warnings:string[]}}
 */
export function parseRaster(text) {
  const errors = [];
  const warnings = [];
  const s = cleanSource(text);
  const m = s.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!m) {
    return { ok: false, raster: null, errors: ['Der Kopfbereich fehlt: Die Datei muss mit einer Zeile „---“ beginnen, danach folgen Angaben wie „titel: …“ und wieder eine Zeile „---“.'], warnings };
  }
  const rawMeta = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const mm = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.*)$/);
    if (mm) {
      const key = META_ALIASES[mm[1].toLowerCase()] || mm[1].toLowerCase();
      rawMeta[key] = mm[2].trim();
    } else warnings.push(`Kopfbereich: Zeile „${line.trim()}“ wurde ignoriert.`);
  }
  const meta = {
    format: rawMeta.format || '',
    typ: (rawMeta.typ || 'kriterien').toLowerCase() === 'matrix' ? 'matrix' : 'kriterien',
    wertung: (rawMeta.wertung || 'mittelwert').toLowerCase() === 'summe' ? 'summe' : 'mittelwert',
    titel: rawMeta.titel || '',
    titel_schuelibogen: rawMeta.titel_schuelibogen || '',
    untertitel: rawMeta.untertitel || '',
    fach: rawMeta.fach || '',
    klassen: rawMeta.klassen || '',
    stand: rawMeta.stand || '',
    schule: rawMeta.schule || '',
    herausgeber: rawMeta.herausgeber || '',
    quelle: rawMeta.quelle || '',
    kopfzeile: rawMeta.kopfzeile ? rawMeta.kopfzeile.split('|').map((x) => x.trim()).filter(Boolean) : [],
    schuelibogen: /^kompakt$/i.test(rawMeta.schuelibogen || '') ? 'kompakt' : 'vollstaendig',
    kommentarspalte: rawMeta.kommentarspalte && !/^nein$/i.test(rawMeta.kommentarspalte) ? rawMeta.kommentarspalte : '',
    notendefinitionen: /^(ja|true|1)$/i.test(rawMeta.notendefinitionen || ''),
    spalte_kriterien: rawMeta.spalte_kriterien || '',
    spalte_stufen: rawMeta.spalte_stufen || '',
    einheit: rawMeta.einheit || '',
    extra: {},
  };
  for (const [k, v] of Object.entries(rawMeta)) if (!KNOWN_META.includes(k)) meta.extra[k] = v;
  if (meta.format && meta.format !== FORMAT_ID) warnings.push(`Unbekannte Formatangabe „${meta.format}“ – erwartet wird „${FORMAT_ID}“.`);
  if (!meta.format) warnings.push(`Die Angabe „format: ${FORMAT_ID}“ fehlt im Kopfbereich.`);
  if (!meta.titel) errors.push('Im Kopfbereich fehlt „titel: …“.');
  if (!meta.fach) warnings.push('Im Kopfbereich fehlt „fach: …“.');

  const r = {
    meta, stufen: [], kriterien: [], umrechnungen: [],
    zeilen: { titel: '', items: [] }, spalten: { titel: '', items: [] }, matrix: { corner: '', cells: [] },
    einleitung: '', hinweise: '', fussnoten: '', freitext: [],
  };

  const body = s.slice(m[0].length).replace(/<!--[\s\S]*?-->/g, '');
  const sections = body.split(/^## /m);
  if (sections[0].trim()) warnings.push('Text vor dem ersten Abschnitt („## …“) wurde ignoriert.');
  const pendingCrit = [];
  let matrixTable = null;

  for (const sec of sections.slice(1)) {
    const nl = sec.indexOf('\n');
    const head = (nl < 0 ? sec : sec.slice(0, nl)).trim();
    const rest = nl < 0 ? '' : sec.slice(nl + 1);
    const [hName, ...hTail] = head.split(':');
    const key = hName.trim().toLowerCase();
    const sub = hTail.join(':').trim();
    if (key === 'stufen') {
      const t = parseTable(rest);
      if (!t) { errors.push('Abschnitt „Stufen“: Tabelle fehlt.'); continue; }
      const idx = (name) => t.head.findIndex((h) => h.toLowerCase() === name);
      const iS = idx('stufe');
      const iN = idx('note');
      const iP = idx('punkte');
      const iK = idx('kreuz');
      if (iS < 0) { errors.push('Abschnitt „Stufen“: Die Spalte „Stufe“ fehlt.'); continue; }
      for (const row of t.rows) {
        const st = { name: row[iS] || '', noteText: iN >= 0 ? row[iN] || '' : '', note: null, punkteText: iP >= 0 ? row[iP] || '' : '', punkte: [], kreuz: iK >= 0 ? row[iK] || '' : '' };
        if (!st.name) { errors.push('Abschnitt „Stufen“: Eine Zeile hat keinen Stufennamen.'); continue; }
        if (st.noteText) {
          try { st.note = noteValue(st.noteText); } catch (e) { errors.push(`Stufe „${st.name}“: ${e.message}`); }
        }
        if (st.punkteText) {
          try { st.punkte = pointValues(st.punkteText); } catch (e) { errors.push(`Stufe „${st.name}“: ${e.message}`); }
        }
        r.stufen.push(st);
      }
    } else if (key === 'kriterium') {
      pendingCrit.push({ name: sub, rest });
    } else if (key === 'zeilen' || key === 'spalten') {
      const axis = { titel: sub, items: [] };
      for (const part of rest.split(/^### /m).slice(1)) {
        const i = part.indexOf('\n');
        axis.items.push({ key: (i < 0 ? part : part.slice(0, i)).trim(), text: i < 0 ? '' : part.slice(i + 1).trim() });
      }
      r[key] = axis;
    } else if (key === 'noten') {
      matrixTable = parseTable(rest);
    } else if (key === 'umrechnung') {
      const u = { titel: sub, notenpunkte: false, rows: [] };
      const t = parseTable(rest);
      if (t) {
        for (const row of t.rows) {
          const summeText = row[0] || '';
          const noteText = row[1] || '';
          try {
            const pts = pointValues(summeText);
            u.rows.push({ summeText, von: Math.max(...pts), bis: Math.min(...pts), noteText, note: leadingNote(noteText) });
          } catch (e) { errors.push(`Umrechnung${sub ? ` „${sub}“` : ''}: ${e.message}`); }
        }
      } else if (/summe\s*=\s*notenpunkte/i.test(rest)) {
        u.notenpunkte = true;
      } else {
        errors.push(`Umrechnung${sub ? ` „${sub}“` : ''}: Tabelle oder „Summe = Notenpunkte“ fehlt.`);
      }
      r.umrechnungen.push(u);
    } else if (key === 'einleitung') r.einleitung = rest.trim();
    else if (key === 'hinweise') r.hinweise = rest.trim();
    else if (key === 'fußnoten' || key === 'fussnoten') r.fussnoten = rest.trim();
    else if (key === 'freitextfelder') r.freitext = rest.split('\n').map((l) => l.trim()).filter((l) => /^[-*•]\s+/.test(l)).map((l) => l.replace(/^[-*•]\s+/, ''));
    else warnings.push(`Abschnitt „## ${head}“ ist unbekannt und wurde ignoriert.`);
  }

  // Kriterien erst nach den Stufen auswerten (Reihenfolge im Text egal)
  const names = r.stufen.map((st) => st.name);
  for (const pc of pendingCrit) {
    const k = { name: pc.name, gewicht: 1, schuelibogen: '', erlaeuterung: '', cells: names.map(() => '') };
    if (!k.name) errors.push('Ein Kriterium hat keinen Namen („## Kriterium: Name“).');
    const parts = pc.rest.split(/^### /m);
    for (const line of parts[0].split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const mm = t.match(/^(Gewicht|Schülibogen|Schülerbogen|Erläuterung)\s*:\s*(.*)$/i);
      if (!mm) { warnings.push(`Kriterium „${k.name}“: Zeile „${t}“ vor der ersten Stufe wurde ignoriert.`); continue; }
      const prop = mm[1].toLowerCase();
      if (prop === 'gewicht') {
        const g = parseFloat(mm[2].replace(',', '.'));
        if (Number.isFinite(g) && g >= 0) k.gewicht = g;
        else errors.push(`Kriterium „${k.name}“: Gewicht „${mm[2]}“ ist keine Zahl.`);
      } else if (prop === 'erläuterung') k.erlaeuterung = mm[2];
      else k.schuelibogen = mm[2];
    }
    for (const part of parts.slice(1)) {
      const i = part.indexOf('\n');
      const lvl = (i < 0 ? part : part.slice(0, i)).trim();
      const content = i < 0 ? '' : part.slice(i + 1).trim();
      const si = names.indexOf(lvl);
      if (si < 0) errors.push(`Kriterium „${k.name}“: Stufe „${lvl}“ steht nicht in der Stufentabelle.`);
      else k.cells[si] = content;
    }
    r.kriterien.push(k);
  }

  // Prüfungen je Typ
  if (meta.typ === 'matrix') {
    if (!r.zeilen.items.length) errors.push('Matrix: Abschnitt „## Zeilen“ mit Einträgen „### …“ fehlt.');
    if (!r.spalten.items.length) errors.push('Matrix: Abschnitt „## Spalten“ mit Einträgen „### …“ fehlt.');
    if (!matrixTable) errors.push('Matrix: Abschnitt „## Noten“ mit Tabelle fehlt.');
    else {
      r.matrix.corner = matrixTable.head[0] || '';
      const colKeys = matrixTable.head.slice(1);
      if (colKeys.join('|') !== r.spalten.items.map((x) => x.key).join('|')) errors.push('Matrix: Die Spaltenköpfe der Notentabelle passen nicht zu den Einträgen unter „## Spalten“.');
      const rowKeys = matrixTable.rows.map((row) => row[0]);
      if (rowKeys.join('|') !== r.zeilen.items.map((x) => x.key).join('|')) errors.push('Matrix: Die Zeilen der Notentabelle passen nicht zu den Einträgen unter „## Zeilen“.');
      r.matrix.cells = matrixTable.rows.map((row, ri) => row.slice(1).map((c, ci) => {
        const mm = c.match(/^(.*?)\s*(?:\(([^)]*)\))?\s*$/);
        const cell = { text: c, noten: [], punkte: [] };
        try {
          cell.noten = mm[1].split(/\s*,\s*/).filter(Boolean).map((label) => ({ label, value: noteValue(label) }));
          cell.punkte = mm[2] ? pointValues(mm[2]) : [];
          if (!cell.noten.length) throw new Error('keine Note angegeben');
        } catch (e) { errors.push(`Matrix, Zeile ${rowKeys[ri]}, Spalte ${colKeys[ci]}: ${e.message}`); }
        return cell;
      }));
    }
  } else {
    if (r.stufen.length < 2) errors.push('Abschnitt „## Stufen“ mit mindestens zwei Stufen fehlt.');
    if (!r.kriterien.length) errors.push('Es gibt kein Kriterium („## Kriterium: …“).');
    if (meta.wertung === 'summe') {
      r.stufen.forEach((st) => { if (!st.punkte.length) errors.push(`Stufe „${st.name}“: Bei „wertung: summe“ braucht jede Stufe Punkte.`); });
      if (!r.umrechnungen.length) errors.push('Bei „wertung: summe“ fehlt der Abschnitt „## Umrechnung“.');
    } else {
      r.stufen.forEach((st) => { if (st.note === null && !errors.some((e) => e.includes(`„${st.name}“`))) errors.push(`Stufe „${st.name}“: Notenwert fehlt (Spalte „Note“).`); });
    }
    if (meta.schuelibogen === 'kompakt' && r.stufen.length && !r.stufen.some((st) => st.kreuz)) {
      warnings.push('Kompakter Schülibogen ohne Spalte „Kreuz“: Die Kreuzspalten werden mit den Stufennamen beschriftet.');
    }
  }
  return { ok: errors.length === 0, raster: r, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

/** Zelleninhalt (Markdown) → Absätze [{text, bullet}] (Fettdruck bleibt als **…** erhalten). */
export function cellParas(md) {
  const out = [];
  let para = [];
  const flush = () => {
    if (para.length) out.push({ text: para.join(' '), bullet: false });
    para = [];
  };
  for (const raw of String(md || '').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const b = line.match(/^[-*•]\s+(.*)$/);
    if (b) { flush(); out.push({ text: b[1], bullet: true }); } else para.push(line);
  }
  flush();
  return out;
}

/** Markdown-Absätze ohne Liste (Einleitung, Hinweise) → [{text, bullet}] */
export const textParas = cellParas;

/** Fußnoten-Liste „1. …“ → [{nr, text}] */
export function footnoteList(md) {
  return String(md || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\d+)[.)]\s*(.*)$/);
    return m ? { nr: m[1], text: m[2] } : { nr: '', text: l };
  });
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

function table(head, rows) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** Modell → Markdown (Kommentare <!-- --> gehen dabei verloren). */
export function serializeRaster(r) {
  const m = r.meta;
  const fm = ['---', `format: ${FORMAT_ID}`];
  const put = (k, v) => { if (v !== undefined && v !== null && v !== '' && v !== false) fm.push(`${k}: ${v}`); };
  if (m.typ === 'matrix') put('typ', 'matrix');
  if (m.typ !== 'matrix' && m.wertung === 'summe') put('wertung', 'summe');
  put('titel', m.titel);
  put('titel_schuelibogen', m.titel_schuelibogen);
  put('untertitel', m.untertitel);
  put('fach', m.fach);
  put('klassen', m.klassen);
  put('stand', m.stand);
  put('schule', m.schule);
  put('herausgeber', m.herausgeber);
  put('quelle', m.quelle);
  if (m.kopfzeile && m.kopfzeile.length) put('kopfzeile', m.kopfzeile.join(' | '));
  if (m.schuelibogen === 'kompakt') put('schuelibogen', 'kompakt');
  put('kommentarspalte', m.kommentarspalte);
  if (m.notendefinitionen) put('notendefinitionen', 'ja');
  put('spalte_kriterien', m.spalte_kriterien);
  put('spalte_stufen', m.spalte_stufen);
  put('einheit', m.einheit);
  for (const [k, v] of Object.entries(m.extra || {})) put(k, v);
  fm.push('---');
  const secs = [];
  if (r.einleitung) secs.push(`## Einleitung\n\n${r.einleitung}`);
  if (m.typ === 'matrix') {
    for (const [name, axis] of [['Zeilen', r.zeilen], ['Spalten', r.spalten]]) {
      secs.push(`## ${name}${axis.titel ? `: ${axis.titel}` : ''}`);
      for (const it of axis.items) secs.push(`### ${it.key}${it.text ? `\n${it.text}` : ''}`);
    }
    const rows = r.zeilen.items.map((z, zi) => [z.key, ...r.spalten.items.map((_, si) => {
      const c = (r.matrix.cells[zi] || [])[si];
      if (!c) return '';
      if (!c.noten || !c.noten.length) return c.text || '';
      return `${c.noten.map((n) => n.label).join(', ')}${c.punkte && c.punkte.length ? ` (${c.punkte.join(', ')})` : ''}`;
    })]);
    secs.push(`## Noten\n\n${table([r.matrix.corner || '', ...r.spalten.items.map((s) => s.key)], rows)}`);
  } else {
    const hasNote = m.wertung !== 'summe' || r.stufen.some((st) => st.noteText);
    const hasP = r.stufen.some((st) => st.punkteText);
    const hasK = r.stufen.some((st) => st.kreuz);
    const head = ['Stufe', ...(hasNote ? ['Note'] : []), ...(hasP ? ['Punkte'] : []), ...(hasK ? ['Kreuz'] : [])];
    const rows = r.stufen.map((st) => [st.name, ...(hasNote ? [st.noteText] : []), ...(hasP ? [st.punkteText] : []), ...(hasK ? [st.kreuz] : [])]);
    secs.push(`## Stufen\n\n${table(head, rows)}`);
    for (const k of r.kriterien) {
      const props = [];
      if (k.erlaeuterung) props.push(`Erläuterung: ${k.erlaeuterung}`);
      if (k.schuelibogen) props.push(`Schülibogen: ${k.schuelibogen}`);
      if (m.wertung !== 'summe') props.push(`Gewicht: ${String(k.gewicht ?? 1).replace('.', ',')}`);
      const parts = [`## Kriterium: ${k.name}`];
      if (props.length) parts.push(props.join('\n'));
      r.stufen.forEach((st, i) => parts.push(`### ${st.name}${k.cells[i] ? `\n${k.cells[i]}` : ''}`));
      secs.push(parts.join('\n\n'));
    }
    for (const u of r.umrechnungen) {
      const title = `## Umrechnung${u.titel ? `: ${u.titel}` : ''}`;
      secs.push(u.notenpunkte ? `${title}\n\nSumme = Notenpunkte` : `${title}\n\n${table(['Summe', 'Note'], u.rows.map((x) => [x.summeText, x.noteText]))}`);
    }
  }
  if (r.hinweise) secs.push(`## Hinweise\n\n${r.hinweise}`);
  if (r.fussnoten) secs.push(`## Fußnoten\n\n${r.fussnoten}`);
  if (r.freitext && r.freitext.length) secs.push(`## Freitextfelder\n\n${r.freitext.map((f) => `- ${f}`).join('\n')}`);
  return `${fm.join('\n')}\n\n${secs.join('\n\n')}\n`;
}

/** Kurzer Prüfwert eines Textes (FNV-1a, 32 Bit, hexadezimal). */
export function hashText(text) {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Anzeigename eines Rasters. */
export function rasterLabel(r) {
  if (!r) return '';
  const m = r.meta || r;
  return [m.fach, m.titel].filter(Boolean).join(' – ');
}

/** Anzahl der „Zeilen“, die bewertet werden (Kriterien bzw. die zwei Achsen der Matrix). */
export function critCount(r) {
  return r.meta.typ === 'matrix' ? 2 : r.kriterien.length;
}

/** Name des i-ten bewerteten Bereichs. */
export function critName(r, i) {
  if (r.meta.typ === 'matrix') return i === 0 ? (r.zeilen.titel || 'Zeile') : (r.spalten.titel || 'Spalte');
  return r.kriterien[i] ? r.kriterien[i].name : '';
}

/** Leeres Raster als Vorlage für „Neues Raster“. */
export const EMPTY_TEMPLATE = `---
format: ${FORMAT_ID}
titel: Kriterien zur mündlichen Note
fach: Mein Fach
kommentarspalte: Kommentar
notendefinitionen: ja
---

## Stufen

| Stufe | Note |
|---|---|
| sehr gut | 1 |
| gut | 2 |
| befriedigend | 3 |
| ausreichend | 4 |
| mangelhaft | 5 |
| ungenügend | 6 |

## Kriterium: Qualität der Beiträge
Gewicht: 1

### sehr gut
Beschreibung für „sehr gut“

### gut

### befriedigend

### ausreichend

### mangelhaft

### ungenügend

## Kriterium: Fachsprache
Gewicht: 1

### sehr gut
Beschreibung für „sehr gut“

### gut

### befriedigend

### ausreichend

### mangelhaft

### ungenügend
`;
