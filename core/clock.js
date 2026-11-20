// The app clock. Every system reads time from now(), never from Date directly, so the demo
// date/time override (core/demo/panel.js) moves the whole app.
// Systems run due jobs on the core event `clock.tick` ({now}) — emitted every minute and
// whenever the demo override moves time.
import { bus } from './bus.js';

let offset = 0;
let seedTime = null;
try { offset = Number(localStorage.getItem('ns:demo:clock_offset') || 0) || 0; } catch {}

export function now() { return seedTime ? new Date(seedTime) : new Date(Date.now() + offset); }
export function nowMs() { return now().getTime(); }

/** Demo: jump the app clock to `date` and run whatever is due. */
export function setNow(date) {
  offset = new Date(date).getTime() - Date.now();
  localStorage.setItem('ns:demo:clock_offset', String(offset));
  tick();
}
export function resetClock() { offset = 0; localStorage.removeItem('ns:demo:clock_offset'); tick(); }
export function hasOverride() { return Math.abs(offset) > 60000; }

/** Used only by the demo seed to date seeded activity in the past. */
export function withSeedTime(date, fn) {
  const prev = seedTime;
  seedTime = new Date(date).getTime();
  try { return fn(); } finally { seedTime = prev; }
}

export function tick() { bus.emitCore('clock.tick', { now: now() }); }
let timer = null;
export function startClock() {
  if (timer) return;
  const schedule = () => {
    const ms = 60000 - (Date.now() % 60000) + 50;
    timer = setTimeout(() => { tick(); schedule(); }, ms);
  };
  schedule();
}
