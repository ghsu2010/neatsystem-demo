// כלי הדגמה — seeds the install data of every system and the demo activity.
// Install seeds run inside each system (bus request "<system>.seedInstall").
// Demo activity is scripted as real users acting through each system's own requests on the bus,
// with the clock moved into the past, so every cross-system effect happens exactly as in the app.
import { bus } from '../bus.js';
import { withSeedTime } from '../clock.js';
import { quietly } from '../refresh.js';
import { flushNow, clearAllNamespaces } from '../storage.js';
import { DEMO_PEOPLE } from './people.js';

const SEED_VERSION = 5;
const has = (n) => bus.has(n);
const ask = (n, p) => (has(n) ? bus.ask(n, p) : undefined);
export const at = (iso, fn) => withSeedTime(new Date(iso), fn);

export async function ensureSeeded() {
  if (Number(localStorage.getItem('ns:demo:seeded') || 0) === SEED_VERSION) return;
  clearAllNamespaces(); // first load or an older demo seed: start clean
  quietly(() => {
    // 1. install seeds, in dependency order
    ['users', 'notifications', 'audit-log', 'coins', 'trainings', 'ranks', 'attendance', 'store', 'leaderboard', 'countdown', 'announcements', 'neathub', 'sunday']
      .forEach((s) => at('2026-08-01T09:00:00', () => ask(`${s}.seedInstall`, {})));
    // 2. demo people
    seedPeople();
  });
  // 3. demo activity per system (scripts live in core/demo/activity.js)
  const { seedActivity } = await import('./activity.js');
  quietly(() => seedActivity({ ask, at, has }));
  flushNow();
  localStorage.setItem('ns:demo:seeded', String(SEED_VERSION));
  flushNow();
}

function seedPeople() {
  DEMO_PEOPLE.forEach((p) => {
    const created = p.pending ? '2026-11-18T18:20:00' : '2026-08-01T10:00:00';
    at(created, () => ask('users.demoInsert', {
      id: p.id, name_he: p.name_he, google_name: p.google_name, google_email: p.google_email, date_of_birth: p.dob,
      phone: p.phone || '', status: p.pending ? 'pending' : p.alumni ? 'alumni' : 'active', alumni_active: !!p.alumni_active,
      main_team: p.team || null, sub_teams: p.subs || [], role: p.pending ? null : p.role || null, is_admin: !!p.is_admin,
      graduation_year: p.grad || null, created_at: new Date(created).toISOString(),
      approved_at: p.pending ? null : new Date(created).toISOString(), approved_by: p.pending ? null : 'u-mentor1',
      graduated_at: p.alumni ? '2026-06-30T12:00:00.000Z' : null,
      team_history: p.team ? [{ team: p.team, from: '2025-09-01T00:00:00.000Z', to: p.alumni ? '2026-06-30T12:00:00.000Z' : null }] : [],
      favorite_feature: p.fav || '',
    }));
  });
}
