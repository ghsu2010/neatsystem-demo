// NeatSystem — the umbrella (02-neatsystem.txt). Owns no business data except each user's UI
// preferences (theme, side bar collapsed). It reads every other system through the bus.
import { bus } from '../../core/bus.js';
import { ns } from '../../core/storage.js';
import { actorFor } from '../../core/guard.js';

const b = bus.system('neatsystem', { announces: [] });
const db = ns('neatsystem');

const prefs = () => db.get('prefs', {});
/** Device copy applies before sign-in (NeatSystem 1.3). */
export function deviceTheme() { return (db.get('device', {}) || {}).theme || 'system'; }
export function applyTheme(t) {
  const el = document.documentElement;
  if (t === 'light' || t === 'dark') el.dataset.theme = t; else delete el.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B0D13' : '#F9FAFC');
}
b.share('theme', (uid) => (prefs()[uid] || {}).theme || deviceTheme());
b.share('sidebarCollapsed', () => !!(db.get('device', {}) || {}).sidebar);

b.serve('setTheme', ({ actor, theme }) => {
  if (actor) {
    actorFor(actor, { allowReadOnly: true, allowNoRole: true });
    const p = prefs();
    const old = (p[actor] || {}).theme;
    db.set('prefs', { ...p, [actor]: { ...(p[actor] || {}), theme } });
    b.audit({ actor, action: 'setting', target: actor, field: 'theme', old, new: theme });
  }
  db.set('device', { ...db.get('device', {}), theme });
  applyTheme(theme);
});
b.serve('setSidebar', ({ collapsed }) => { db.set('device', { ...db.get('device', {}), sidebar: !!collapsed }); });

bus.on('user.deleted', ({ uid }) => { const p = { ...prefs() }; delete p[uid]; db.set('prefs', p); });
