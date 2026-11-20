// UI refresh scheduler. Any data write schedules one batched re-render of the app.
// Preact diffs with stable keys, so only changed rows/values update in the DOM (Design 10.4).
const subs = new Set();
let pending = false;
let paused = 0;
export let version = 0;

export function scheduleRefresh() {
  if (pending || paused) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    version++;
    subs.forEach((fn) => fn(version));
  });
}
export function onRefresh(fn) { subs.add(fn); return () => subs.delete(fn); }
/** Run fn without scheduling renders (used while seeding). */
export function quietly(fn) {
  paused++;
  try { return fn(); } finally { paused--; }
}
