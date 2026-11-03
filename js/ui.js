/**
 * Grade’Em – kleine UI-Hilfen ohne Framework.
 */
import { parseRich } from './rubric.js';

/**
 * Erzeugt ein Element.  h('button', {class:'btn', onclick: fn}, 'Text', child…)
 * Attribute: class, style (Objekt), dataset (Objekt), on<event>, sonstige als Attribut/Property.
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else if (k === 'value' || k === 'checked') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Fügt Text mit **fett**-Auszeichnung als <strong>/Text-Knoten ein. */
export function rich(text) {
  const frag = document.createDocumentFragment();
  for (const part of parseRich(text)) {
    frag.append(part.bold ? h('strong', null, part.text) : document.createTextNode(part.text));
  }
  return frag;
}

/** Mehrere Absätze mit Auszeichnung. */
export function richParas(list) {
  return (Array.isArray(list) ? list : [list]).map((t) => h('p', null, rich(t)));
}

/** HTML-Escaping für Strings in Templates. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Text mit **fett** → HTML-String. */
export function richHTML(text) {
  return parseRich(text).map((p) => (p.bold ? `<strong>${esc(p.text)}</strong>` : esc(p.text))).join('');
}

// ---------------------------------------------------------------------------
// Symbole (Inline-SVG, keine externen Ressourcen)
// ---------------------------------------------------------------------------
const ICONS = {
  back: '<path d="M15 5l-7 7 7 7" />',
  next: '<path d="M9 5l7 7-7 7" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.style.display = 'contents';
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  return span.firstElementChild;
}

// ---------------------------------------------------------------------------
// Hinweise
// ---------------------------------------------------------------------------
export function toast(message, { action, onAction, duration = 3200 } = {}) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: 'toast' }, h('span', null, message));
  if (action) {
    t.append(h('button', { class: 'btn', type: 'button', onclick: () => { onAction && onAction(); t.remove(); } }, action));
  }
  box.append(t);
  if (duration) setTimeout(() => t.remove(), duration);
  return t;
}

// ---------------------------------------------------------------------------
// Dialoge
// ---------------------------------------------------------------------------

/**
 * Öffnet einen modalen Dialog.
 * @param {{title:string, body:Node|Node[], actions:{label, kind, onClick}[], wide?:boolean, onClose?:Function}} o
 * onClick darf false zurückgeben, um den Dialog offen zu halten.
 */
export function openDialog({ title, body, actions = [], wide = false, onClose }) {
  const dlg = h('dialog', { class: `dlg${wide ? ' dlg--wide' : ''}`, 'aria-labelledby': 'dlg-title' });
  const foot = h('div', { class: 'dlg__foot' });
  const close = (result) => {
    dlg.close();
    dlg.remove();
    if (onClose) onClose(result);
  };
  for (const a of actions) {
    const b = h('button', { class: `btn ${a.kind ? `btn--${a.kind}` : ''}`, type: 'button' }, a.label);
    b.addEventListener('click', async () => {
      const r = a.onClick ? await a.onClick(b) : undefined;
      if (r !== false) close(a.value ?? r);
    });
    foot.append(b);
  }
  dlg.append(
    h('div', { class: 'dlg__wrap' },
      h('div', { class: 'dlg__head' }, h('h2', { id: 'dlg-title' }, title)),
      h('div', { class: 'dlg__body' }, body),
      actions.length ? foot : null,
    ),
  );
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close(undefined);
  });
  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}

/** Bestätigung; liefert true/false. */
export function confirmDialog(message, { title = 'Bitte bestätigen', ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  return new Promise((resolve) => {
    openDialog({
      title,
      body: h('p', null, message),
      actions: [
        { label: cancel, value: false },
        { label: ok, kind: danger ? 'danger' : 'primary', value: true },
      ],
      onClose: (r) => resolve(!!r),
    });
  });
}

/** Einfacher Eingabedialog. */
export function promptDialog({ title, label, value = '', ok = 'Speichern', placeholder = '' }) {
  return new Promise((resolve) => {
    const input = h('input', { class: 'input', type: 'text', value, placeholder, autocomplete: 'off' });
    let done = false;
    const { close } = openDialog({
      title,
      body: h('label', { class: 'field' }, h('span', null, label), input),
      actions: [
        { label: 'Abbrechen', onClick: () => { done = true; resolve(null); } },
        { label: ok, kind: 'primary', onClick: () => { done = true; resolve(input.value.trim()); } },
      ],
      onClose: () => { if (!done) resolve(null); },
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        done = true;
        resolve(input.value.trim());
        close();
      }
    });
    setTimeout(() => input.focus(), 50);
  });
}

// ---------------------------------------------------------------------------
// Dateien sichern (iPad: Teilen-Menü → „In Dateien sichern“)
// ---------------------------------------------------------------------------

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 4000);
}

/**
 * Bietet eine fertige Datei zum Sichern an. Auf dem iPad über das Teilen-Menü
 * (frischer Tipp nötig, deshalb ein eigener Dialog), sonst als Download.
 */
export function offerFile(blob, filename, { title = 'Datei ist fertig' } = {}) {
  let file = null;
  try {
    file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  } catch {
    file = null;
  }
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  const sizeKB = Math.max(1, Math.round(blob.size / 1024));
  openDialog({
    title,
    body: [
      h('p', null, h('b', null, filename), h('span', { class: 'muted' }, ` · ${sizeKB} KB`)),
      canShare
        ? h('p', { class: 'muted small' }, '„Teilen / Sichern“ öffnet das Teilen-Menü. Dort „In Dateien sichern“, AirDrop oder Mail wählen.')
        : h('p', { class: 'muted small' }, 'Die Datei wird in den Download-Ordner gespeichert.'),
    ],
    actions: [
      { label: 'Schließen' },
      { label: 'Herunterladen', onClick: () => downloadBlob(blob, filename) },
      canShare
        ? {
          label: 'Teilen / Sichern',
          kind: 'primary',
          onClick: async () => {
            try {
              await navigator.share({ files: [file], title: filename });
            } catch (e) {
              if (e && e.name !== 'AbortError') {
                downloadBlob(blob, filename);
              }
            }
          },
        }
        : null,
    ].filter(Boolean),
  });
}

/** Erzeugt einen dateinamentauglichen Text. */
export function safeFileName(s) {
  return String(s || 'export')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

/** Debounce-Helfer. */
export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
  d.flush = (...args) => {
    if (t) {
      clearTimeout(t);
      t = null;
      fn(...args);
    }
  };
  return d;
}

/** Kurze, sortierbare ID. */
export function uid(prefix = '') {
  const r = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}${Date.now().toString(36)}${r[0].toString(36)}${r[1].toString(36)}`.slice(0, 24);
}
