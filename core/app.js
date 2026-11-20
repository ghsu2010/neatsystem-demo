// Boot: load every system (each registers its read APIs, requests and listeners on the bus),
// then their screens, then the demo tools; seed on first load; render the NeatSystem shell.
import { html, render, useEffect, useState } from './lib.js';
import { onRefresh } from './refresh.js';
import { startClock, tick } from './clock.js';

// Order matters only for listener registration; data never flows except through the bus.
export const SYSTEMS = [
  ['users', ['index.js', 'ui.js']],
  ['notifications', ['index.js', 'ui.js']],
  ['audit-log', ['index.js', 'ui.js']],
  ['neatsystem', ['index.js']],
  ['coins', ['index.js', 'ui.js']],
  ['attendance', ['index.js', 'ui.js']],
  ['store', ['index.js', 'ui.js']],
  ['leaderboard', ['index.js', 'ui.js']],
  ['countdown', ['index.js', 'ui.js']],
  ['announcements', ['index.js', 'ui.js']],
  ['neathub', ['index.js', 'ui.js']],
  ['trainings', ['index.js', 'ui.js']],
  ['ranks', ['index.js', 'ui.js']],
  ['sunday', ['index.js', 'ui.js']],
];

async function boot() {
  const failed = [];
  for (const [sys, filesList] of SYSTEMS) {
    for (const f of filesList) {
      try { await import(`../systems/${sys}/${f}`); }
      catch (e) { console.error(`failed to load ${sys}/${f}`, e); failed.push(`${sys}/${f}`); }
    }
  }
  await import('../systems/neatsystem/shell.js');
  await import('../systems/neatsystem/pages.js');
  await import('./demo/index.js');
  const { ensureSeeded } = await import('./demo/seed.js');
  await ensureSeeded();
  const { Shell } = await import('../systems/neatsystem/shell.js');
  const { applyTheme, deviceTheme } = await import('../systems/neatsystem/index.js');
  applyTheme(deviceTheme());
  function Root() {
    const [, set] = useState(0);
    useEffect(() => onRefresh(set), []);
    return html`<${Shell}/>`;
  }
  document.getElementById('app').innerHTML = '';
  render(html`<${Root}/>`, document.getElementById('app'));
  startClock();
  tick();
  setTimeout(() => { window.__appReady = true; }, 500);
  if (failed.length) console.warn('Modules that failed to load:', failed);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
