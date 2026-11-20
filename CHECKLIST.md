# CHECKLIST — final check (20.11.2026)

How it was checked: in the browser at 360 px and 1440 px, signed in as Mentor (אורית), Admin+Captain (תמר),
Lead (מאיה, איתי), Members (אלון, עומר, הילה), read-only alumnus (נועם), active alumnus (ענבל) and no-role (רז).
An automated pass opened every route and every management section for 9 roles with zero runtime errors.
Permission rules, cross-system flows, the demo clock and deletion were exercised through the bus (results below).
✅ = done and checked · ❌ = missing or partial (note says what).

## Separation rules (prompt 3)

| Check | Result |
| --- | --- |
| Each system keeps data only in `ns('<itself>')` / `files('<itself>')` — grep shows one namespace per folder, no direct `localStorage` in systems | ✅ |
| No system imports another system's folder (the one shell → Users screens import was replaced by widgets) | ✅ |
| Read APIs = `b.share`, requests = `b.serve` (`bus.ask`), events = declared `announces` only (`b.emit` throws otherwise) | ✅ |
| Store asks Coins to charge/hold/convert/release/refund; Coins decides and writes | ✅ |
| Every write function checks the actor (`actorFor` + the system's own rules) — tested: member approving own coins, lead over cap, lead awarding another team, member creating a board, editing own role, Admin making a Mentor, read-only alumnus buying, second approver | ✅ all refused with Hebrew errors |
| "ניהול" shows only the current tab's systems; hidden when nothing is manageable | ✅ |
| Every change audited; notifications go through Notifications | ✅ |
| `user.deleted` → every system erases its own data; audit keeps "משתמש שנמחק #id"; Sunday keeps anonymous traces | ✅ (tested on עומר) |

## Users

| Item | Result |
| --- | --- |
| Sign-in screen (sticker, wordmark, Google button, error line) | ✅ (logos fall back to glyph — files missing, see Design 2) |
| Welcome form: name + DOB, field errors, "שליחה" enabled when valid | ✅ |
| Waiting screen: clock icon, title, editable name/DOB, "התנתקות" | ✅ |
| Approvals: rows per 3.3, team/role/sub-teams/graduation year, approve/reject, first-wins message | ✅ tested |
| Role limits: swap prompt "לצוות … כבר יש רש"צ: …. להחליף?" | ✅ tested |
| Lead moving team → confirmation, becomes Member | ✅ |
| "ללא צוות" → no-role; giving a team asks role + year | ✅ |
| Last Mentor protection (E5) | ✅ |
| Users table with search + status filter; user page; Admin flag (Mentors) | ✅ |
| Graduation: year, ticked list, confirmation, alumni + Member + Admin removed | ✅ |
| Alumni mode switch, "החזרה לפעילות", read-only tooltip "בוגרים במצב קריאה בלבד" (E7/E8) | ✅ |
| Deletion: lists what's erased, type exact name, immediate, `user.deleted` | ✅ tested |
| Teams & sub-teams: tint, icon (Trainings library), rename, archive only when empty | ✅ |
| Current grade from graduation year; 1 September rollover → ranks recalculate | ✅ tested (הילה → ניטפריים) |
| Phone visible only to self and Lead+ | ✅ |
| Hebrew strings (Users 9) | ✅ |

## NeatSystem

| Item | Result |
| --- | --- |
| Tabs and order; who sees which; no-access screen with "לפרופיל" | ✅ |
| Phone bottom nav (4 + "עוד"), desktop side bar collapsible and remembered | ✅ |
| Tab badges (Sunday, Trainings, Store), "9+" | ✅ |
| Top bar: title on scroll, people icon (not no-role), bell + count, avatar + frame + coin chip | ✅ |
| Avatar menu (profile, settings, ניהול, About, install help when not installed, sign out) | ✅ |
| Offline banner + every write fails "דרוש חיבור לאינטרנט" | ✅ tested |
| Home: greeting + date + today's meeting line, countdowns, my tasks (overdue first, max 5, empty 🎉), next milestones + next-rank line, leaderboard, announcements; desktop two columns | ✅ |
| Per-card load error with retry | ✅ (cards fail independently) |
| Profile 5.1: banner, framed avatar, styled name, team icon, rank badge 24, leaderboard flame, tags (+N), badges, stat tiles (coins+היסטוריה, streak from 2 + snowflake on own, approved count), ranks card, דבר אהוב with pencil for allowed, contact, own items, wishlist (own / managers), action buttons per owning system | ✅ |
| No-role profile ("עדיין לא שויכת לצוות") | ✅ |
| Profile picture: upload (JPG/PNG/WebP ≤ 5 MB, square, 512), back to Google, removal by Admin/Mentor with notification | ✅ (centre crop, no manual crop UI — ASSUMPTIONS U3) |
| Directory: live search, chips (incl. "ללא צוות" for Admins/Mentors), grouping, rows with frame/name colour/nameplate/rank/tags/badges, empty state; desktop 3-column grid | ✅ |
| Personal settings: picture, phone, theme (saved on account + device, applied before paint), email switches, sign out | ✅ |
| MoneyTeam bar + failure state + button | ✅ |
| About (sticker, wordmark, version, "Neat Team #1943") + demo reset | ✅ |
| Install help with grey screenshot boxes | ✅ |
| Rank-up full-screen moment ("יאללה") | ✅ |

## Sunday

| Item | Result |
| --- | --- |
| Board bar (My Tasks, boards in personal order, drag reorder, "+ לוח", "פח", "אישורי מטבעות (n)", "דשבורד" for Admins/Mentors) | ✅ |
| Board screen: rename (lead+), view switcher, search, sort, "+ קבוצה חדשה", ⚙ settings | ✅ |
| Desktop table anatomy C5 (group bar 6, handle 20, done 32, name ≥260, column widths, "+" header cell, "⋯" rows, same grid template for header & rows, sticky header) | ✅ |
| Table → card layout when it doesn't fit; no sideways scroll | ✅ |
| Phone cards C6.2 (bar, done slot, name + bubble, chips row, priority flag for גבוהה/קריטית, "+ תת-משימה") | ✅ |
| Action sheet C6.3 and full item sheet | ✅ |
| Editing per column C7 (pickers on click, name single-click for lead+, members "שייך אותי"/"הסר אותי" only for self-assignments) | ✅ |
| Done button, previous status restore, undo toasts | ✅ |
| Updates panel C8: 480 px from the left, swaps content, tabs with counts, opens on עדכונים when unseen, description autosave 1 s + "נשמר", comments with @mention, edit/delete rules, files with undo | ✅ |
| Files via Google's file picker | ❌ Static demo: links are pasted (ASSUMPTIONS S1) |
| Columns C9: add (types + groups), rename/reorder/delete with "רק בקבוצה הזו / בכל הקבוצות", delete effects listed, unique columns re-addable, apply to all groups | ✅ |
| Labels C10: editor, default statuses protected for members, priorities lead+, delete with "<n> משימות יעברו ל-…" | ✅ |
| Subitems C11: expand/collapse remembered, "+" adds with parent's assignees, parent status computed and read-only, no coins | ✅ |
| Groups C12: create at top in edit mode, rename, colour, collapse, personal order/pin, delete to trash, move items keeps status by label name | ✅ |
| Kanban (union of labels, drag to change status) | ✅ |
| Calendar (month grid, ranges as one bar split at week end, "הסתרת ימים ללא משימות" list) | ✅ |
| Calendar drag to change date (single dates and whole ranges shift by the dragged days) | ✅ |
| My Tasks C14 (cards/table, board·group line, "מצוות אחר", subitem tag, sort, done hidden + link, filters + builder + example filter, empty states) | ✅ |
| Coins C15 (size by lead+, "?"/"—", new member item notifies lead+, Done → awaiting chip, queue with size selector, approve/reject with note, assignee can't approve, leaving Done reverses) | ✅ tested (+10 then reversed) |
| Permissions table C16, read-only alumni, trash 30 days with restore | ✅ |
| Notifications C17 (assigned, deadline warning/passed once, mention, comment, left, size, coin queue, decision, inactive) | ✅ |
| Inactive users greyed + one notification to lead+ (C18) | ✅ |
| Dashboard C19 (5 cards) | ✅ |
| Dashboard: bars/points open a matching list (team rows → that team's board, assignee → profile, weekly points → coin approvals) | ✅ |
| Phone FAB "+" (adds to first expanded group) | ✅ |
| Long-press drag on phone (items between groups) | ✅ |

## Trainings

| Item | Result |
| --- | --- |
| Home: category chips (own team first, "הסמכות מיוחדות"), rank strip, tree cards with x/y + progress + "חדש" dot, empty state + "+ עץ חדש" | ✅ |
| Access 3.1 (team, special access list, tree extra access, view-only roles, alumni, Mentors never take) | ✅ |
| Tree view: rows by depth, connectors (met in blue-300), "N מתוך M" pills, pan/pinch/Ctrl+wheel zoom 50–150 %, "מרכוז", "רשימה" switch | ✅ (long rows wrap — ASSUMPTIONS T1) |
| Node states and visuals 8.1 (locked, open pulse, submitted, approved, rejected, re-approval, badges, pressed edge, dark mode) | ✅ |
| Preview card (requirements "כל אלה ✓ ✗" / "לפחות 4 מתוך 7: 2/4", "פתיחה") | ✅ |
| Milestone page 7.2 (requirements box, blocks incl. YouTube/Drive embed, checklist, exam, autosave, "סיימתי" + hint, "נשלח לאישור · date", rejection note, read-only viewers) | ✅ |
| Requirements logic 6.2 (submitted counts, hidden ignored, loops refused "זה ייצור מעגל") | ✅ |
| Approvals: first decision wins ("כבר טופל על ידי …"), reject note required, undo by decider/Mentor, weekly reminder | ✅ tested |
| Force check (profile "הוספת הכשרה", progress cell "סימון כהושלם"), no coins / no notification, "הוזן ידנית" in history, undo | ✅ |
| Editor: "+ ענף", "+ אבן דרך", node action sheet, drafts dashed, "סיום עריכה" | ✅ |
| Wizard (4 steps, dots, הקודם/הבא, "שמירת טיוטה", ✕ offers to save a draft, icon picker with search/tabs/upload, pastel picker, live preview, block editor with + / drag / ⋯ / upload, groups editor, checklist, exam, coins, "פרסום"; edit = tabs + "שמירה" + "שינוי מהותי") | ✅ |
| Major change → needs re-approval, notifications, ranks recalc | ✅ |
| Delete rules (tree/category/milestone only without approvals; else hide) | ✅ |
| Requests tab, progress tab (table desktop / cards phone, history per cell) | ✅ |
| Management (categories, approvers, access, icon library, follow, settings) | ✅ |
| Install seed: 4 categories, 4 trees, 108 published empty milestones with `star` | ✅ |
| Hebrew strings (Trainings 17) | ✅ |

## Ranks

| Item | Result |
| --- | --- |
| Rank list (8 defaults, rename, reorder, add, delete with drop-down, badge upload; placeholder circle with first letter) | ✅ |
| Ladders per category; climbing rule; grade minimums; Mentors-only; not used | ✅ |
| Seed ladders from StudentTracker (all 4 categories) | ✅ |
| Recalculation on approvals/force checks/re-approval/grade/team/role/rule changes; down is silent; one notification for many steps | ✅ |
| Where ranks show: profile header 24, ranks card 48, 16 next to names, Trainings strip ("חסרות N…", "דרושה שכבה יא'"), Home line | ✅ |
| E3: grade-blocked member (הילה: ניטפרו, "דרושה שכבה י'") | ✅ |
| History from "התקדמות" | ✅ |

## Coins, Store, Attendance, Leaderboard, Countdown, Announcements, NeatHub, Notifications, Audit log

| Item | Result |
| --- | --- |
| Coins: ledger is the balance; never below 0; spendable = balance − held; idempotency keys; earners only; reversals clamp + shortfall; manual awards with caps and "נשארו לך …"; ledger 50/page with filter and "בוטל"; management (award, recent with "ביטול", settings) | ✅ |
| Store page (header balance + held, chips incl. "של הצוות שלי"/"האוסף שלי", sort, collection rows, tile states, item sheet with try-on and "הפעלה שוב", wishlist heart) | ✅ |
| Store: purchase success — item scales in on the try-on card, coin chip counts down, toast "נקנה!" | ✅ |
| Store flows: buy, request → approve/reject/deliver/cancel, cancel approved → refund, price locked, stock, limits, freeze cap "יש לך כבר 3 הקפאות", 0-price "קבלה בחינם", read-only alumni browse only | ✅ |
| Awards, tag proposals, team rewards with Mentor approval (edits go back to approval), tag removal with refund | ✅ |
| Store management (items, collections, requests, waiting, team rewards) | ✅ |
| Attendance: Mon/Wed 17:00 seed, 30-day generation, cancel (warns, reverses coins), extra meeting with audience + coins, marking screen 11.7, "כולם נוכחים", edit window, nobody marks themselves, team table with %, settings | ✅ |
| Streaks: shown from 2, freezes used automatically / returned on correction, bonus every 5, flame colours + toast once, best streak, full recompute | ✅ (מאיה 32 violet, עומר 25 + 1 freeze held + 1 used) |
| Leaderboard: per team + all; dense ranking; zeros after; medals incl. ties; "מתאפס בעוד n ימים"; own row highlighted/pinned; Mentors see all-teams only; schedules; reset with top 3 history; "איפוס עכשיו" | ✅ tested |
| Countdown: large card + compact rows, זמן/פגישות (never remembered), "היום!", hidden the day after, full screen with Esc/✕, management with "עברו" and "עריכת ימי פגישות" | ✅ |
| Announcements: composer (audience, expiry ≤ 90, pin, include alumni, email all, poll), lead fixed audience, pin limit with notice, edit/delete (undo), "נערך", "קרא עוד", archive with search, polls (single/multiple/anonymous, close date/author close, results visibility, voters list), management | ✅ |
| NeatHub: categories, tiles, search, "לא הוגדר קישור" + pencil for editors, editing (add/edit/delete with undo/drag), management with editors + visible to, seed "כללי" | ✅ |
| Notifications: bell panel (380 px / full sheet), unread style, mark all read, tap → read + link, 90-day cleanup, email switches per type, locked account emails, coin digest 20:00 | ✅ (emails go to an outbox — ASSUMPTIONS P5) |
| Audit log viewer: newest first, 100/page, filters, search, CSV export, deleted-user names | ✅ |

## Design 10 (interaction rules) and 11 (v4 additions)

| Item | Result |
| --- | --- |
| 10.1 pickers on single click/tap; text on double-click / tap; Enter/Esc; inline field keeps place; placeholders "+ תאריך" etc.; no hover for read-only | ✅ |
| 10.2 pill / date (range, ניקוי תאריך) / people / colour / size pickers; never native `<select>` | ✅ |
| 10.2 keyboard arrows inside pickers (menus, pill lists, calendar grid) | ✅ |
| 10.3 instant save, undo toasts (5 s), delete rule (small = undo, big = confirm), failed save toast | ✅ |
| 10.4 optimistic updates, stable keys, no full-screen spinners | ✅ (skeletons not needed — local data, ASSUMPTIONS P4) |
| 10.4 metric-matched fallback font ("Rubik Fallback" with size/ascent overrides) | ✅ |
| 10.5 text fitting at 360 px, 2-line clamp, touch targets ≥ 44 | ✅ checked on Home, Sunday, Trainings, Store, Profile |
| 10.5 tested with Hebrew strings 30 % longer; 9.1 200 % zoom | ❌ not verified systematically |
| 10.6 16 presets, contrast-fitted group names | ✅ |
| 10.7 action sheets, long-press 400 ms drag with drop line, no swipe actions | ✅ |
| 10.9 side panel, bottom sheet (handle, swipe down, back closes), dialogs dim 40 %, "לצאת בלי לשמור?" | ✅ |
| 11.1 team icon on profile | ✅ |
| 11.2 rank badges 48/24/16 + placeholder + celebration | ✅ |
| 11.3 streak flame colours, medal flames | ✅ |
| 11.4 leaderboard card | ✅ |
| 11.5 16 pastels, 4×4 picker with check | ✅ |
| 11.6 countdown card/rows/full screen | ✅ |
| 11.7 attendance screen | ✅ |
| Light/dark themes for every screen | ✅ |
| Emoji: only 🎉 (and "🐕 Dog 🐕" as data) | ✅ (source scan) |
| Design 2: official logo files | ❌ not in the folder — add them to `assets/` (names in `assets/README.md`); the app shows the temporary glyph until then |

## Still open (❌ above)

1. Google's file picker for Sunday files — needs Google APIs and sign-in; the demo uses pasted Drive links.
2. A systematic pass with Hebrew strings 30 % longer and at 200 % zoom — screens were checked at 360 px with the real strings only.
3. Official logo files — not in the folder; add them to `assets/` (names in `assets/README.md`).
