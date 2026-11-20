// Connection state: the real navigator.onLine, or the demo "offline" switch (core/demo/panel.js).
// No offline mode: when offline every write fails with "דרוש חיבור לאינטרנט" and nothing is queued.
import { scheduleRefresh } from './refresh.js';

let demoOffline = false;
try { demoOffline = JSON.parse(localStorage.getItem('ns:demo:offline') || 'false'); } catch {}

export function isOnline() { return navigator.onLine && !demoOffline; }
export function setDemoOffline(v) {
  demoOffline = !!v;
  localStorage.setItem('ns:demo:offline', JSON.stringify(demoOffline));
  scheduleRefresh();
}
export function isDemoOffline() { return demoOffline; }
window.addEventListener('online', scheduleRefresh);
window.addEventListener('offline', scheduleRefresh);
