// Per-system storage. Each system gets its own namespace `ns:<system>:<key>` in localStorage
// and its own IndexedDB database `ns:<system>` for uploaded files.
// A system must only ever call ns('<its own name>') / files('<its own name>') (separation rule 1).
import { scheduleRefresh } from './refresh.js';

const cache = new Map();
const dirty = new Set();
let flushTimer = null;

function flush() {
  flushTimer = null;
  for (const k of dirty) {
    try { localStorage.setItem(k, JSON.stringify(cache.get(k))); }
    catch (e) { console.error('storage write failed', k, e); }
  }
  dirty.clear();
}
export function flushNow() { if (flushTimer) clearTimeout(flushTimer); flush(); }
window.addEventListener('beforeunload', flushNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });

export function ns(system) {
  const p = `ns:${system}:`;
  return {
    get(key, def) {
      const k = p + key;
      if (cache.has(k)) return cache.get(k);
      const raw = localStorage.getItem(k);
      let v;
      if (raw == null) v = typeof def === 'function' ? def() : def;
      else { try { v = JSON.parse(raw); } catch { v = typeof def === 'function' ? def() : def; } }
      cache.set(k, v);
      return v;
    },
    set(key, val) {
      const k = p + key;
      cache.set(k, val);
      dirty.add(k);
      if (!flushTimer) flushTimer = setTimeout(flush, 150);
      scheduleRefresh();
      return val;
    },
    /** get → mutate → set in one call */
    update(key, def, fn) {
      const v = this.get(key, def);
      const r = fn(v);
      this.set(key, r === undefined ? v : r);
      return r === undefined ? v : r;
    },
    has(key) { return cache.has(p + key) || localStorage.getItem(p + key) != null; },
  };
}

/** Wipe every namespace (demo reset). */
export function clearAllNamespaces() {
  flushNow();
  cache.clear();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('ns:')) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

// ---------- IndexedDB files, one DB per system ----------
const dbs = new Map();
function openDb(system) {
  if (dbs.has(system)) return dbs.get(system);
  const p = new Promise((res, rej) => {
    const r = indexedDB.open(`ns:${system}`, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  dbs.set(system, p);
  return p;
}
const urlCache = new Map();
export function files(system) {
  const tx = async (mode, fn) => {
    const db = await openDb(system);
    return new Promise((res, rej) => {
      const t = db.transaction('files', mode);
      const req = fn(t.objectStore('files'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    async put(blob, id) {
      id = id || 'f' + Math.random().toString(36).slice(2, 10);
      await tx('readwrite', (s) => s.put(blob, id));
      urlCache.set(system + '/' + id, URL.createObjectURL(blob));
      scheduleRefresh();
      return id;
    },
    async get(id) { return tx('readonly', (s) => s.get(id)); },
    async del(id) { urlCache.delete(system + '/' + id); await tx('readwrite', (s) => s.delete(id)); scheduleRefresh(); },
    /** Synchronous URL if already loaded; otherwise starts loading and returns null. */
    url(id) {
      const k = system + '/' + id;
      if (urlCache.has(k)) return urlCache.get(k);
      urlCache.set(k, null);
      this.get(id).then((b) => { if (b) { urlCache.set(k, URL.createObjectURL(b)); scheduleRefresh(); } });
      return null;
    },
  };
}
export async function clearAllFiles(systems) {
  for (const s of systems) {
    const p = dbs.get(s);
    if (p) { try { (await p).close(); } catch {} dbs.delete(s); }
    await new Promise((res) => { const r = indexedDB.deleteDatabase(`ns:${s}`); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  }
  urlCache.clear();
}
