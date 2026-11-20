# ASSUMPTIONS

Every choice the specs didn't fix, with what I chose, why, and the section. Items marked **(confirmed 20.11.2026)**
change behaviour; they were sent as questions with this build and the team confirmed the recommended answers.

## Inputs and platform

| # | Choice | Why | Section |
| --- | --- | --- | --- |
| P1 | The folder had only `00-ALL-SPECS.txt` (no `specs/` folder, no `assets/`). I copied the combined file to `specs/` and built from it. The official logo files are **missing**: the app loads them from `assets/` by the names in Design 2 and falls back to the temporary glyph until they are added. | Nothing else to build from | Prompt 1, Design 2 |
| P2 | Hash URLs (`#/home`, `#/sunday`, …) instead of `/home`. | Works from any static server with no rewrite rules | NeatSystem 3.1 |
| P3 | Local time is treated as Israel time (the demo is run in Israel). Dates use he-IL formats, week starts Sunday. | No backend/timezone conversion in a static demo | NeatSystem 1.3 |
| P4 | Data is synchronous and local, so the "skeleton on first load" never appears; a card that throws shows "לא הצלחנו לטעון — נסה שוב" with retry (the 5-second timeout has nothing to wait for). | No network calls | Design 10.4, NeatSystem 4 |
| P5 | Emails are not sent: they are written to Notifications' outbox (`__bus.read('notifications.outbox')`). Daily coin digest at 20:00 is built the same way. | Static demo, no mail server | Notifications 3 |
| P6 | Service worker caches nothing (installability only). No offline reading or queue. | NeatSystem 1.3 "No offline mode" | NeatSystem 1.3 |
| P7 | PWA icon = temporary white rivet-gun silhouette on #1C00EA (`assets/icon*.svg/png`), recorded in `assets/README.md`. | Prompt 5 | Design 2 |
| P8 | MoneyTeam has no URL: the tab always shows "MoneyTeam לא נטען" + "פתיחה בחלון חדש"; the button shows a toast "עוד לא הוגדרה כתובת ל-MoneyTeam". | Prompt 5 | NeatSystem 8 |
| P9 | Google sign-in is replaced by "כניסה כ…" (demo). Sign-in persistence = until sign-out (stored per browser). | Prompt 5 | NeatSystem 1.3 |
| P10 | On phones each open sheet/panel adds a same-URL history entry, so the back gesture closes the top sheet first; swipe-down on the handle also closes it. | Design 10.9 | Design 10.7, 10.9 |
| P11 | Lucide 0.460.0 from unpkg. Missing icon names fall back to `star` and are listed in `missingIcons` (core/icons.js); in testing all 100 library icons resolved. | Trainings 13 | Design 5.4 |
| P12 | Moving the demo clock backwards is not fully supported (data created "in the future" stays). Leaderboards whose period starts in the future restart at the natural start. | Demo tool only | Prompt 5 |

## Contradictions / behaviour questions

| # | Choice | Why | Section |
| --- | --- | --- | --- |
| Q1 **(confirmed 20.11.2026)** | Priority labels are listed top = highest: קריטית, גבוהה, בינונית, נמוכה. | C10 lists the defaults "נמוכה, בינונית, גבוהה, קריטית" and also says "rank from top = highest", which would make נמוכה the highest | Sunday C10 |
| Q2 **(confirmed 20.11.2026)** | Leaderboard "עונה": after the end date the board resets and starts a new period of the same length. | Spec only defines the first season period | Leaderboard 3 |
| Q3 **(confirmed 20.11.2026)** | Team rewards show in the store only to members of that team (Captains/Admins/Mentors handle them in Store management). | Store 6 "visible only to one team" | Store 6–8 |
| Q4 **(confirmed 20.11.2026)** | A Streak Freeze can cover an absence only if it was bought before that absence was marked. | Recalculation "from the marks in date order" doesn't say how late purchases interact | Attendance 4.1, 5 |
| Q5 **(confirmed 20.11.2026)** | No-role users can also open personal settings (theme, phone, sign-out), About and install help. | Spec says "only their profile, notifications and MoneyTeam", but sign-out lives in settings | NeatSystem 3.1 |
| Q6 | Build team tint = sand #F3ECDD/#6B4F1D. | Design 8.3 + v3 decision (sand) beat 9.3's "Build steel blue" | Design 8.3, 9.3 |
| Q7 | Store chips include "הקפאות רצף". | Store 7 lists it; Design 7.5 omits it — system spec wins for content | Store 7, Design 7.5 |
| Q8 | Each empty state uses its own spec string: My Tasks "אין לך משימות 🎉" (Sunday C21.1), Home "אין משימות להיום 🎉" (NeatSystem 4). | The prompt quotes "אין משימות 🎉"; the specs give these exact strings | Sunday C21.1, NeatSystem 4 |
| Q9 | "Earned in a period" subtracts the full amount of a reversed earning line (not only the part actually taken from the balance). | A clamped reversal shouldn't leave a leaderboard score inflated | Coins 6–7 |
| Q10 | Super-certification gold star (Design 9.3) is not built. | Dropped in v4 (NeatSystem 1.4) | NeatSystem 1.4 |

## Users

| # | Choice | Section |
| --- | --- | --- |
| U1 | Alumni keep `main_team` = their team at graduation; "removed from team lists" is done by status filters everywhere. | Users 4.3–4.4 |
| U2 | Date-of-birth picker = calendar + a year jump menu (years are far back). | Users 3.2 |
| U3 | Uploaded profile picture is centre-cropped to a square and stored as 512×512 WebP (no manual crop UI). | NeatSystem 5.2 |
| U4 | `user.updated` is also announced with field `grade` for every student when the school year rolls over on 1 September, and with `graduation_year` when edited, so Ranks can recalculate. | Users 1, Ranks 4 |
| U5 | Phone format check: Israeli mobile `05X-XXXXXXX` (dash optional). | Users 2.1 |
| U6 | Approving a request as "ללא צוות" ignores role/graduation year (no-role user). Graduation-year choices: current year … current year + 6. | Users 3.3 |
| U7 | Admins can't promote to Mentor or change the Admin flag (Mentors only), consistent with 4.1. | Users 4.1 |

## Sunday

| # | Choice | Section |
| --- | --- | --- |
| S1 | Drive links are pasted URLs ("+ קישור" asks for the link and a name); Google's file picker is not available in a static demo. | C8 |
| S2 | When a board table doesn't fit at minimum column widths, the board switches to the card layout (also on desktop). | C5 |
| S3 | Kanban drag to a label name that doesn't exist in the item's group shows "לסטטוס הזה אין מקבילה בקבוצה של המשימה". | C13 |
| S4 | Calendar drag (desktop) moves a single date, or shifts a whole range by the dragged number of days. | C13 |
| S5 | "Inactive user still has open items" is sent once per user (reset when they become active again). | C17–C18 |
| S6 | A lead's coin decision can be changed from "הוכרעו" (approved → reject with note, rejected → back to waiting). | C15.5 |
| S7 | Dashboard: team rows open that team's first board, assignee bars open the profile, weekly points open the coin-approval queue. | C19 |
| S8 | New items by lead+ don't trigger the "needs size" notification (they just show "?"). | C15.2 |
| S9 | The example filter "דחוף וחסום" exists for every user until they delete it. | C14 |
| S10 | Assignee picker for lead+ lists people who can open the board and are active; inactive assignees stay visible (greyed) so they can be removed. | C7, C18 |

## Trainings & Ranks

| # | Choice | Section |
| --- | --- | --- |
| T1 | A depth row with more than 10 milestones wraps onto extra lines (the seeded trees have 23–45 start nodes in one row). Presentation only; depth logic unchanged. | Trainings 7.1, Design 7.6 |
| T2 | People who can't take a tree (view-only roles) see neutral nodes (no state) and "צפייה בלבד". | Trainings 3.1 |
| T3 | Undoing a force check deletes the record (back to open/locked); if the force check closed a pending request, that request stays closed. | Trainings 9 |
| T4 | Uploaded icons are recoloured to one colour by turning every opaque pixel into a mask (96 px PNG). | Trainings 10.2 |
| T5 | A category's ladder exists only once rules are set; new ranks added later start as "לא בשימוש" in every ladder until a rule is set. | Ranks 2–3 |
| T6 | Profile ranks card "5/8 הכשרות" = approved / required milestones of the next rank's own rule; tapping the strip lists everything missing up to the next rank. | Ranks 5 |
| T7 | Rank-up celebration shows once per category (the latest rank), the next time the user opens the app. | Ranks 4, Design 11.2 |

## Store, Coins, Attendance, Leaderboard, Countdown, Announcements, NeatHub

| # | Choice | Section |
| --- | --- | --- |
| C1 | Store's spendable balance chip is hidden for Mentors (no coins). | Store 2 |
| C2 | Store tile/preview for each cosmetic slot is drawn in code (gradient, ring, coloured name, plate, sparkles icon, theme swatch). | Design 8.4 |
| C3 | Demo cosmetics (one per slot, names start with "דוגמה ·") are registered from `core/demo/cosmetics.js` at boot; `systems/store/cosmetics.js` (the launch list) is empty. | Prompt 4, Store 3.1 |
| C4 | Purchase success: the try-on card scales in, the coin chip counts down, toast "נקנה!". | Design 7.5 |
| C5 | Attendance mark screen picks the most recent meeting by default. | Attendance 3 |
| C6 | Flame-colour toast is shown once per level increase (15/30/45/60). | Attendance 4 |
| C7 | Countdown "פגישות" mode counts projected regular meetings beyond Attendance's 30-day generation horizon too (from the weekly schedule). | Countdown 3 |
| C8 | Countdown full-screen view is a full-page layer and also requests browser full screen. | Countdown 4 |
| C9 | Announcement pin limit is per overlapping audience (any shared recipient). | Announcements 3 |
| C10 | Poll results before closing are visible to the author and Mentors; they can vote by tapping an option in the results view. | Announcements 4 |
| C11 | NeatHub favicon option loads `https://<site>/favicon.ico` from the site itself. | NeatHub 3 |
| C12 | Store requests show the buyer's note in the request list. | Store 5.2 |

## Demo seed (made-up people, never real students)

26 demo people (2 Mentors, Admin+Captain, Captain, a Lead and 4–5 Members per team across ט'–יב',
2 alumni, 1 no-role, 2 pending). Season start 2 August 2026 so there are 32 past Monday/Wednesday
meetings — enough for a 30+ streak (מאיה), 15+ streaks (תמר, איתי, עומר), a held freeze (עומר, ליה)
and a used freeze (עומר). Activity is scripted through each system's real requests (see
`core/demo/activity.js`).

## Hebrew strings I wrote (not given by the specs)

Short, informal, gender-neutral where possible.

- **Shell/general:** "חברי הקבוצה", "התראות", "תפריט חשבון", "כיווץ" / "הרחבת סרגל" / "כיווץ סרגל", "נשמר",
  "לא נשמר", "נסה שוב", "ביטול", "שמירה", "סגירה", "חזרה", "חיפוש", "עריכה", "מחיקה", "הסרה", "פעולות",
  "לצאת בלי לשמור?" (Design 10.9 gives it), "השינויים שלא נשמרו יימחקו.", "צריך לפחות {n} תווים",
  "גרסה 4.0 (הדגמה)", "צילום מסך יתווסף בהמשך", install steps for iPhone/Android, "עוד לא הוגדרה כתובת ל-MoneyTeam".
- **Users:** "ברוכים הבאים!", "שם מלא בעברית, 2–40 אותיות", "הגיל חייב להיות בין 10 ל-99", "קפיצה לשנה:",
  "ביקש/ה {time}", "{name} אושר/ה", "הבקשה נדחתה", "הגבלת תפקידים", "החלפה", "העברת צוות", "שנת סיום (יב')",
  "בחירת שנה", "חובה לבחור שנת סיום", "מספר נייד לא תקין", "עד 80 תווים", "אי אפשר לשנות את התפקיד של עצמך",
  "רק מנטורים משנים את הדגל הזה", "תמונת פרופיל", "הסרת התמונה שהועלתה", "אין תמונה שהועלתה", "מחיקה מיידית, בלי הקפאה ובלי ביטול.",
  "כדי לאשר, הקלידו את השם: {name}", "מחיקה לצמיתות", "המשתמש נמחק", "השם לא תואם", "אי אפשר למחוק את עצמך",
  "אין תלמידים במחזור הזה", "מחזור", "+ צוות" / "+ תת-צוות" (spec), "צוות חדש", "תת-צוות חדש", "אפשר לארכב רק צוות שאין בו אף אחד פעיל",
  "הצוות או התפקיד שלך עודכנו" (notification), "לפרופיל", "חזרה לרשימה", "פעילים", "בוגרים", "הכל", "אין בקשות ממתינות",
  "בקשות הצטרפות חדשות יופיעו כאן", "מספר רש"צים לצוות", "מספר קפטנים".
- **NeatSystem:** "פרופיל", "פרטים", "עוד לא נכתב", "הכשרות מאושרות", "{n} תגיות" (spec "+N תגיות"), "תמונת פרופיל",
  "העלאת תמונה", "JPG, PNG או WebP עד 5 MB", "טלפון נייד", "רק את/ה והנהלת הצוות רואים", "ערכת צבעים", "מיילים",
  "אין התראות פוש לטלפון — רק בתוך האתר ובמייל.", "(תמיד)" for locked email types, "התמונה עודכנה", "חזרנו לתמונת Google".
- **Notifications (texts sent by systems):** "קיבלת {n} מטבעות: {reason}", "ירדו {n} מטבעות: {reason}", "פגישה נוספת: {title} · {date} {time}",
  "הפגישה ב-{date} בוטלה", "בקשה חדשה: {name} · {item}", "הבקשה אושרה — {item}", "הבקשה נדחתה — {item}: {reason}",
  "הבקשה בוטלה — {item}", "סומן כנמסר — {item}", "קיבלת תגית/פריט: {name}", "תגית הוסרה ממך: {tag}", "הצעה להענקת תגית ל{name}",
  "פרס צוות מחכה לאישור: {name}", "ההצעה שלך אושרה/נדחתה: …", "בקשה חדשה: {name} · {milestone}", "אושר: {milestone}",
  "נדחה: {milestone} — {note}", "ההחלטה על {milestone} בוטלה: {note}", "תזכורת: {name} מחכה לאישור {milestone}",
  "שינוי מהותי ב{milestone}: צריך לשלוח שוב", "מונית/הוסרת מאישור בקשות ב{category}", "קיבלת גישה לעץ {tree}", "הגישה שלך לעץ {tree} הוסרה",
  "שויכת למשימה: {name}", "תאריך יעד ב-{date}: {name}", "תאריך היעד עבר: {name}", "{name} תייג/ה אותך: {task}", "עדכון חדש ב{task}",
  "{name} עזב/ה משימה: {task}", "משימה מחכה לאישור מטבעות: {task}", "המטבעות אושרו: {task}", "המטבעות נדחו: {task} — {note}",
  "המשימה אושרה (ללא מטבעות): {task}", "ל{name} (לא פעיל/ה) יש משימות פתוחות", "הודעה חדשה מ{name}: {text}",
  "ההודעה שנעצת כבר לא נעוצה — נעצו הודעה חדשה", "מצב בוגר: פעיל / קריאה בלבד".
  Email-preference labels per type (e.g. "שויכת למשימה", "תאריך יעד מתקרב / עבר", "קיבלת מטבעות או שבוטלו (סיכום יומי ב-20:00)").
- **Coins:** "שמורים: {n}", "אין עדיין תנועות", "עוד 50", "למי", "בחירת אנשים", "סכום (1–{max})", "המטבעות הוענקו",
  "ביטול שורה", "אפשר לבטל רק שורת צבירה", "השורה כבר בוטלה", "חובה לכתוב סיבה", "אי אפשר להעניק לעצמך", type names
  (הכשרה, משימה, נוכחות, בונוס רצף, הענקה, רכישה, שמירה, שחרור שמירה, החזר, ביטול), settings labels.
- **Store:** "אין לך מטבעות", "לא למכירה", "הוספה לרשימת המשאלות" (Store 7), "ברשימת המשאלות", "נקנה!" (Design 7.5),
  "הבקשה נשלחה", "הערה (לא חובה)", "{price} מטבעות יישמרו עד שהבקשה תטופל.", "אחר כך", "{n} שמורים לבקשות",
  "אין כאן פריטים עדיין", "עוד אין לך פריטים", "פריטים שתקנו או תקבלו יופיעו כאן", "ברירת מחדל", "אפשר לבחור עד 3 תגיות",
  "עוד לא קנית כלום", "נקנה", "הוענק", "תגית קיימת", "הצעת תגית חדשה", "טקסט התגית", "שליחה לאישור", "ההצעה נשלחה למנטורים",
  "הסרת תגית", "{n} פריטים ותגיות בבעלותך", "לבו פריטים בחנות כדי להוסיף אותם לכאן", "קוסמטיקה (מוגדרת בקוד)",
  "פריטים שנוצרו באפליקציה", "+ פריט חדש", "פרס צוות חדש", "+ פרס צוות", "פרס צוות עולה לחנות אחרי אישור מנטור/ית.",
  "הענקה בלבד", "מוסתר", "בחנות", "אין מה לאשר", "אין בקשות", "אושרו", "נמסרו", "כל הצוותים", "ביטול בקשה מאושרת",
  "המטבעות יוחזרו לקונה.", "אוסף חדש", "+ אוסף", "עוד (ללא אוסף)", "אפשר להעניק רק תגית או פריט קוסמטי",
  "אפשר למחוק רק פריט שאף אחד לא קנה או קיבל — אפשר להסתיר אותו".
- **Attendance:** "אין פגישה ביום הזה", "בחרו יום מסומן בלוח", "אין אנשים שאפשר לסמן בפגישה הזו", "מערכת שבועית", "+ יום פגישה",
  "כותרת (לא חובה)", "תחילת עונה", "סוף עונה", "שינוי חל רק על פגישות עתידיות שלא סומנו.", "פגישות קרובות", "קבועה", "נוספת",
  "בוטלה", "הפגישה נוספה והקהל קיבל הודעה", "שיא: {n}", "הקפאות: {n}", "עוד אין סימוני נוכחות", "הקפאה",
  "אי אפשר לסמן פגישה עתידית", "אי אפשר לסמן את עצמך", "אפשר לשנות עד {n} ימים אחרי הפגישה".
- **Leaderboard:** "מוצג" / "כבוי", "תקופה נוכחית: …", "אין".
- **Countdown:** "עריכת ספירה", "מוצג החל מ (לא חובה)", "מיד", "אין ספירות פעילות", "בעוד {n} ימים" (Design 11.6), "התאריך חייב להיות בעתיד".
- **Announcements:** "הודעות" (card title), "הודעה חדשה", "עריכת הודעה", "פחות", "ההודעה נמחקה", "+ אפשרות", "אפשרות {n}",
  "הסרת הסקר", "סגירת הסקר (ברירת מחדל: תפוגת ההודעה)", "נסגר ב-{date}", "כולם יראו את התוצאות.", "פגה ב-{date}", "תפוגה {date}",
  "כתבו הודעה או הוסיפו סקר", "בין 2 ל-30 אפשרויות", "אחרי ההצבעה הראשונה אי אפשר לשנות אפשרויות", "הסקר לא מיועד לך",
  "רק מי שפרסם/ה סוגר/ת את הסקר", "אנונימי" badge.
- **NeatHub:** "קישור חדש", "עריכת קישור", "הוספת קישור", "האייקון של האתר", "לחיצה ארוכה וגרירה לשינוי סדר", "גררו כדי לשנות סדר",
  "קטגוריה חדשה", "עורכים (מלבד אדמינים ומנטורים)", "גלוי ל", "הקישור חייב להתחיל ב-https://", "{n} קישורים".
- **Trainings:** "עצים", "צפייה בלבד", "הגדרות עץ", "עץ חדש", "שם העץ (עד 40)", "צבע ברירת מחדל לאבני דרך", "גישה נוספת לעץ",
  "מי עוד יכול/ה ללמוד את העץ", "אין עדיין אבני דרך בעץ הזה", "ענף חדש", "פתיחה", "אבן הדרך נעולה — השלימו קודם את הדרישות",
  "מאושר", "נדחה", "היה שינוי מהותי באבן הדרך — עברו על התוכן ושלחו שוב.", "תרגול", "מבחן", "נשלח לאישור", "ניסיון {n}",
  "ניסיונות קודמים", "היסטוריה", "תשובות", "הוספה ({n})", "נוספו {n} הכשרות", "בחירת אייקון", "חיפוש בעברית או באנגלית",
  "העלאת אייקון", "SVG או PNG, ריבועי, עד 200 KB. נצבע בצבע אחד.", "כתבו כאן…", "בלוק", "הוספת בלוק", "שכפול", "החלפת קובץ",
  "הועלה", "כיתוב (לא חובה)", "ההעלאה נכשלה — נסה שוב", "+ אבני דרך", "אבן דרך חדשה", "הטיוטה נשמרה",
  "נשמר — כולם יתבקשו לשלוח שוב", "+ קטגוריה מיוחדת", "הסמכה מיוחדת", "ברירת מחדל: מנטורים, קפטנים ואדמינים ורש"צ הצוות", "ממונים",
  "מי יכול/ה ללמוד את הקטגוריה", "עוד לא הועלו אייקונים", "התראות על בקשות מגיעות רק מהקטגוריות המסומנות…",
  "מטבעות ברירת מחדל לאבן דרך", "ימים עד תזכורת על בקשה", "כבר נשלחה בקשה", "אי אפשר לאשר בקשה של עצמך",
  "חובה לכתוב הערה", "רק מי שהחליט/ה או מנטור/ית", "יש בעץ אישורים — אפשר רק להסתיר אותו", "מישהו כבר שלח או קיבל את אבן הדרך — אפשר רק להסתיר".
- **Ranks:** "מה חסר לדרגה הבאה", "הדרגה הגבוהה ביותר בקטגוריה", "אין מה להשלים", "היסטוריית דרגות", "אין שינויים", "תג",
  "עד שמעלים תג, מוצג עיגול עם האות הראשונה של הדרגה…", "כל דרגה דורשת את שלה ואת כל מה שלפניה" (Ranks 3), "אין סולמות שאפשר לערוך".
- **Sunday:** "לוחות", "פילטר", "הגדרות סאנדיי", "שם המשימה", "שם תת-המשימה", "+ אחראי" / "+ עדיפות" / "+ תאריך" (Design 10.1),
  "סומן כבוצע", "הוחזר", "הסטטוס שונה ל\"{label}\"", "האחראים עודכנו", "התאריך עודכן", "התאריך נוקה", "שייך אותי" / "הסר אותי" (spec),
  "ממתין לאישור", "ללא", "גרירה", "הועבר ל{group}", "שוכפל", "נמחק", "מסונן לפי {name}", "ניקוי", "+ עמודה" (menu title "הוספת עמודה"),
  "הזזת עמודה", "שינוי שם עמודה", "איפה למחוק?", "העמודה נמחקה", "העמודה נוספה", "עמודה חדשה: {type}", "להוסיף לקבוצות", "+ אפשרות",
  "עריכת עדיפויות", "תווית חדשה", "+ תווית", "הצמדה למעלה" (spec) / "ביטול הצמדה", "מוצמד", "מחיקת קבוצה", "הקבוצה הועברה לפח",
  "הלוח הועבר לפח", "לוח חדש", "שם הלוח", "כללי", "תצוגות", "גישה ללוח", "מי רואה את הלוח", "הסתרת משימות שהושלמו", "פילטר",
  "סטטוס", "באיחור", "השבוע", "לוחות", "את/ה משויך/ת למשימה — קפטן או מנטור/ית יאשרו", "שינוי לדחייה", "החזרה לממתינים",
  "הוחזר לממתינים", "בוצע {date}", "כל הלוחות", "עוד לא הוכרעו משימות", "שוחזר", "שוחזר (ללא ערכים)", "נמחק ע\"י {name}",
  "עוד {n} ימים", dashboard card titles, "אין משימות בחודש הזה", "החודש הקודם/הבא", "כתבו עדכון… (@ לתיוג)", "תיוג", "העדכון נמחק",
  "הקישור נמחק", "שם הקובץ", "המשימה נמחקה", "הדביקו קישור לקובץ ב-Google Drive (או כל קישור http/https).",
  delete-column effects lines (from C9), "לסטטוס הזה אין מקבילה בקבוצה של המשימה", "אפשר לשייך רק את עצמך",
  "רק רש"צ ומעלה יכולים להסיר אותך מהמשימה", "רק רש"צ ומעלה משנים שם", "אפשר למחוק רק משימות שיצרת", "נקבע לפי תתי-המשימות" (spec).
- **Audit log:** "חיפוש חופשי", "כל המערכות/המבצעים/המשתמשים/הפעולות", "מתאריך", "עד תאריך", "{n} רשומות", "עמוד {n} מתוך {m}",
  column headers, Hebrew system names.
- **Demo tools:** "כלי הדגמה", "כניסה כ…", "חשבון Google חדש", "מייל (מומצא)", "שם בחשבון Google", "המשך", "לוח בדיקות",
  "תאריך ושעה באפליקציה", "עכשיו: …", "(מוגדר ידנית)", "החלה", "+יום", "+שבוע", "זמן אמיתי", "מצב לא מקוון", "איפוס נתוני הדגמה",
  "החלפת משתמש", group names (מנטורים, קפטנים, רש"צים, חברי צוות, בוגרים, ללא צוות, ממתינים לאישור), "(מחובר/ת)".
