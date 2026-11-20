// The bus: the only way systems talk to each other (prompt section 3).
//
//  * Read APIs   — b.share('balance', fn)   → others call bus.read('coins.balance', ...)
//  * Requests    — b.serve('charge', fn)    → others call bus.ask('coins.charge', payload)
//                  The owning system checks and writes its own data, and returns the result.
//  * Events      — b.emit('coins.changed', payload) (must be declared in `announces`)
//                  bus.on('coins.changed', fn) (each system subscribes to its "Listens to").
//
// Each system gets a scoped handle with bus.system(name, {announces}) so it can only register
// names under its own prefix and only emit the events its spec says it announces.
import { scheduleRefresh } from './refresh.js';

const apis = new Map();
const handlers = new Map();
const listeners = new Map();
const declared = new Map(); // system -> Set(events)
const trace = [];

function log(kind, name, from) {
  trace.push({ kind, name, from, at: Date.now() });
  if (trace.length > 300) trace.shift();
}

export const bus = {
  /** Call another system's read API. */
  read(name, ...args) {
    const fn = apis.get(name);
    if (!fn) throw new Error(`bus: no read API "${name}"`);
    return fn(...args);
  },
  has(name) { return apis.has(name) || handlers.has(name); },
  /** Ask another system to act. Returns whatever the owner returns (or throws AppError). */
  ask(name, payload) {
    const fn = handlers.get(name);
    if (!fn) throw new Error(`bus: no request handler "${name}"`);
    log('ask', name);
    return fn(payload || {});
  },
  /** Subscribe to an event. */
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(fn);
    return () => listeners.set(event, listeners.get(event).filter((f) => f !== fn));
  },
  /** Core-only events (clock.tick). */
  emitCore(event, payload) { dispatch(event, payload, 'core'); },
  trace() { return trace.slice(); },
  declared() { return declared; },

  /** Scoped handle for one system. */
  system(sys, { announces = [] } = {}) {
    declared.set(sys, new Set(announces));
    return {
      name: sys,
      share(name, fn) { apis.set(`${sys}.${name}`, fn); },
      serve(name, fn) { handlers.set(`${sys}.${name}`, fn); },
      emit(event, payload) {
        if (!declared.get(sys).has(event)) throw new Error(`bus: ${sys} does not announce "${event}"`);
        dispatch(event, payload, sys);
      },
      read: bus.read, ask: bus.ask, on: bus.on, has: bus.has,
      /** Write to the Audit log (Audit log 1). */
      audit(entry) {
        if (!handlers.has('audit-log.write')) return;
        bus.ask('audit-log.write', { system: sys, ...entry });
      },
      /** Send a notification through Notifications (Notifications 1). */
      notify(uids, type, text, link, opts = {}) {
        if (!handlers.has('notifications.notify')) return;
        const list = (Array.isArray(uids) ? uids : [uids]).filter(Boolean);
        if (!list.length) return;
        bus.ask('notifications.notify', { system: sys, uids: list, type, text, link, ...opts });
      },
    };
  },
};

function dispatch(event, payload, from) {
  log('emit', event, from);
  const ls = listeners.get(event) || [];
  for (const fn of ls) {
    try { fn(payload || {}); }
    catch (e) { console.error(`listener for ${event} failed`, e); }
  }
  scheduleRefresh();
}

window.__bus = bus; // handy for debugging in the console
