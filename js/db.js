/**
 * Grade’Em – lokale Datenhaltung (IndexedDB)
 * ==============================================
 * Alle Daten bleiben auf dem Gerät. Stores:
 *   meta        { key, value }            Einstellungen u. Ä.
 *   groups      { id, name, klasse, students:[{id, firstName, lastName}], currentRoundId, … }
 *   rounds      { id, groupId, title, createdAt }
 *   assessments { id = roundId + ':' + studentId, roundId, groupId, studentId, date,
 *                 crit:[{sel:[], pts:{}, comment:''}, …], weights:[…], umrechnung, proposal, final, finalScale, updatedAt }
 *   rasters        { id ('fs:<datei>' oder 'eigen:<id>'), source, file, text, hash, basedOn, updatedAt }
 *   rasterVersions { hash, text }   unveränderliche Fassungen, auf die sich Runden beziehen
 */

// Interner Name bleibt „tardigrader“, damit bestehende Daten nach der Umbenennung erhalten bleiben.
const DB_NAME = 'tardigrader';
const DB_VERSION = 2;
export const STORES = ['meta', 'groups', 'rounds', 'assessments', 'rasters', 'rasterVersions'];

let dbPromise = null;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaktion abgebrochen'));
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('groups')) db.createObjectStore('groups', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('rounds')) {
        const s = db.createObjectStore('rounds', { keyPath: 'id' });
        s.createIndex('groupId', 'groupId');
      }
      if (!db.objectStoreNames.contains('rasters')) db.createObjectStore('rasters', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('rasterVersions')) db.createObjectStore('rasterVersions', { keyPath: 'hash' });
      if (!db.objectStoreNames.contains('assessments')) {
        const s = db.createObjectStore('assessments', { keyPath: 'id' });
        s.createIndex('roundId', 'roundId');
        s.createIndex('groupId', 'groupId');
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Die Datenbank ist in einem anderen Tab geöffnet.'));
  });
  return dbPromise;
}

export async function getAll(store) {
  const db = await openDB();
  return req(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await openDB();
  return req(db.transaction(store).objectStore(store).get(key));
}

export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value);
  return txDone(tx);
}

export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return txDone(tx);
}

/** Mehrere Schreib-/Löschvorgänge in einer Transaktion. ops: [{store, put}|{store, del}] */
export async function batch(ops) {
  const db = await openDB();
  const names = [...new Set(ops.map((o) => o.store))];
  if (!names.length) return;
  const tx = db.transaction(names, 'readwrite');
  for (const o of ops) {
    const s = tx.objectStore(o.store);
    if ('put' in o) s.put(o.put);
    else s.delete(o.del);
  }
  return txDone(tx);
}

/** Löscht alles und schreibt die übergebenen Daten (für Backup-Import „Ersetzen“). */
export async function replaceAll(data) {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) tx.objectStore(name).clear();
  for (const name of STORES) {
    for (const item of data[name] || []) tx.objectStore(name).put(item);
  }
  return txDone(tx);
}

/** Fügt Daten hinzu bzw. überschreibt gleiche IDs (Backup-Import „Zusammenführen“). */
export async function mergeAll(data) {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) {
    for (const item of data[name] || []) tx.objectStore(name).put(item);
  }
  return txDone(tx);
}

export async function dumpAll() {
  const out = {};
  for (const name of STORES) out[name] = await getAll(name);
  return out;
}

export async function clearAll() {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) tx.objectStore(name).clear();
  return txDone(tx);
}
