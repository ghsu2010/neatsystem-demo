# NeatSystem — demo (Neat Team #1943)

A static web app (no backend, no build step) built from the 15 specs in `specs/00-ALL-SPECS.txt`
(version 4, 19.11.2026). Hebrew, right-to-left, mobile-first, light and dark themes, installable.

**Live demo (installable from Chrome):** https://ghsu2010.github.io/neatsystem-demo/

## Run it

From this folder:

```
npx serve .
```

Then open the address it prints (usually http://localhost:3000). Any static file server works
(for example `python -m http.server 8000`). The app must be served over http(s) — opening
`index.html` from the file system won't load ES modules.

The first load seeds the demo data (a few seconds); later loads are instant. Data lives in your
browser (localStorage + IndexedDB). "איפוס נתוני הדגמה" in About (avatar menu → אודות) wipes it and
seeds again.

Needs internet for the CDNs: Preact + htm (unpkg), Lucide icons (unpkg) and the Rubik font (Google Fonts).

## Share it with testers

- **One file to send:** `dist/NeatSystem-demo.html` — the whole demo in one file. Testers open it by
  double-clicking (Chrome or Edge recommended; needs internet for fonts/icons). Each tester's data stays in
  their own browser. Rebuild it after code changes with `python tools/build-single.py`.
- **Install as a web app:** an app can only be installed from an https site. Upload the contents of
  `dist/NeatSystem-webapp.zip` (or this folder) to any static host — for example drag the unzipped folder onto
  Netlify Drop or push it to GitHub Pages — open the address, then use the browser's "Install app" /
  "Add to Home Screen". The hosted `dist/NeatSystem-demo.html` can be installed the same way.

## Demo tools ("כלי הדגמה", all in `core/demo/`)

- **"כניסה כ…"** replaces Google sign-in: pick any demo user, grouped by role.
  **"חשבון Google חדש"** asks for a made-up email and name and runs the real sign-up flow
  (welcome form → waiting screen → approval in Users management → אישור משתמשים).
- **Flask button in the top bar** → switch user + testing panel:
  - date/time override (+יום / +שבוע / any date). Moving forward runs whatever is due: leaderboard
    resets, countdown changes, the 1 September grade change (ranks recalculate), Trainings reminders,
    poll closing, Sunday deadline notifications, trash purge, 90-day notification cleanup.
  - "מצב לא מקוון" switch: shows the offline banner and blocks every write ("דרוש חיבור לאינטרנט").
- **"איפוס נתוני הדגמה"** in About.

Good accounts to start with: **אורית שחר** (Mentor), **תמר אלון** (Admin + Captain), **מאיה לוי**
(Lead, שרטוט — 32-meeting streak, equipped cosmetics, pending approvals), **אלון מזרחי** (Member),
**הילה דהן** (blocked only by grade), **עומר ביטון** (CNC rank, holds a freeze), **נועם רביבו**
(alumnus, read-only), **ענבל טננבאום** (alumnus, active), **רז יוסף** (no role).

## Folders

```
index.html            app shell: loads core/app.js
manifest.webmanifest  PWA manifest ("Neat Team"); sw.js is a no-cache service worker (no offline mode)
assets/               logos (drop the official files here — see assets/README.md), temporary PWA icons
specs/                the specs (single combined file)
core/                 shared code only — no business data
  bus.js              the bus (below)
  storage.js          per-system storage: ns('<system>') → localStorage "ns:<system>:…", files('<system>') → IndexedDB "ns:<system>"
  guard.js, errors.js actor lookup + Hebrew errors used by every write function
  clock.js, net.js    app clock (demo override) and online state (demo offline switch)
  router.js           hash router (#/home, #/sunday/board/<id>, …)
  registry.js         where systems plug in routes, management sections, tab badges and widgets
  tokens.css, components.css, ui.js, overlay.js, pickers.js, people.js, richtext.js, drag.js, icons.js, color.js, format.js
  demo/               כלי הדגמה: sign-in-as, testing panel, reset, demo people, demo cosmetics, demo activity seed
systems/<name>/       one folder per system: index.js (data + rules + bus registrations) and ui.js (+ helpers)
  users  neatsystem  sunday  trainings  ranks  coins  store  attendance  leaderboard
  countdown  announcements  neathub  notifications  audit-log
```

Every system follows the same pattern:

1. `index.js` creates its scoped bus handle: `const b = bus.system('coins', { announces: ['coins.changed'] })`.
2. It keeps its data only in `ns('coins')` (and `files('coins')` for uploads).
3. It registers its **read APIs** (`b.share('balance', fn)`), its **requests** (`b.serve('charge', fn)`),
   and its **listeners** (`bus.on('task.approved', fn)`).
4. Every write function starts with `actorFor(actorId)` (Users' role flags) and then applies the
   system's own permission rules — the UI hiding a button is never the only check.
5. Every change calls `b.audit({...})` (→ Audit log) and notifications go through `b.notify(...)` (→ Notifications).
6. `ui.js` registers the system's screens (`addRoute`), its management sections (`addManagement`),
   its tab badge (`addTabBadge`) and any widgets other screens embed (`addWidget`).

## The bus (`core/bus.js`)

Systems never import each other and never touch another system's storage. They talk only through the bus:

| Kind | Owner registers | Others call |
| --- | --- | --- |
| Read API ("Shares") | `b.share('balance', (uid) => …)` | `bus.read('coins.balance', uid)` |
| Request ("asks … to act") | `b.serve('charge', ({uid, amount}) => …)` | `bus.ask('coins.charge', {...})` |
| Event ("Announces" / "Listens to") | `b.emit('task.approved', {...})` (must be declared) | `bus.on('task.approved', fn)` |

`bus.system(name, { announces })` scopes a handle: a system can only register names under its own
prefix and can only emit the events its spec says it announces. Requests are synchronous, so two
purchases can never overspend (Coins 5). `window.__bus` is exposed for debugging in the console
(e.g. `__bus.read('coins.balance', 'u-maya')`).

Examples of cross-system flows:

- Sunday item → בוצע → lead approves → `task.approved` per assignee → Coins writes ledger lines →
  `coins.changed` → Notifications; Leaderboard reads `coins.earned` live.
- Trainings approval → `milestone.approved` → Coins pays; Ranks recalculates → `rank.changed`,
  rank-up moment queued (shown by NeatSystem via `ranks.pendingCelebration`).
- Store "הקפאת רצף" → asks `coins.charge` → emits `freeze.bought` → Attendance adds a freeze; an
  absence later uses it (`freeze.used`).
- Users `user.deleted` → every system erases its own data for that user.

## UI composition

NeatSystem owns the shell (top bar, navigation, Home, profile, directory, settings, MoneyTeam, the
management entry). Cards and buttons that belong to other systems are widgets those systems register
(e.g. `countdown.home`, `leaderboard.home`, `coins.profileAction`, `store.wishlistCard`,
`ranks.profileCard`); NeatSystem places them. "ניהול" shows only the management groups of the systems
that belong to the current tab (NeatSystem 9).

See `ASSUMPTIONS.md` for every decision and Hebrew string not given by the specs, and `CHECKLIST.md`
for the final check.
