// Trainings icon library (Trainings 13): 100 Lucide icons in 7 groups, each with Hebrew + English keywords.
export const ICON_GROUPS = [
  ['שרטוט ותכנון', 'pencil-ruler:סרגל עיפרון שרטוט ruler:סרגל מדידה drafting-compass:מחוגה pen-tool:עט וקטור shapes:צורות box:קופסה גוף cube boxes:קופסאות הרכבה cylinder:גליל cone:חרוט pyramid:פירמידה layers:שכבות axis-3d:צירים תלת axis rotate-3d:סיבוב תלת scale-3d:קנה מידה spline:עקומה ספליין'],
  ['מכניקה ובנייה', 'wrench:מפתח ברגים wrench hammer:פטיש cog:גלגל שיניים gear nut:אום bolt:בורג drill:מקדחה anvil:סדן gauge:מד מד-לחץ weight:משקל magnet:מגנט construction:בנייה עבודות move:הזזה rotate-cw:סיבוב link:חוליה שרשרת pickaxe:מכוש'],
  ['חשמל ואלקטרוניקה', 'cpu:מעבד בקר microchip:שבב circuit-board:מעגל לוח battery:סוללה battery-charging:טעינה zap:חשמל ברק plug:תקע plug-zap:חיבור חשמל cable:כבל radio:רדיו antenna:אנטנה power:הפעלה כוח lightbulb:נורה רעיון gamepad-2:שלט ג׳ויסטיק בקר'],
  ['תוכנה', 'code:קוד code-xml:קוד xml terminal:טרמינל square-terminal:מסוף braces:סוגריים bug:באג git-branch:ענף גיט git-merge:מיזוג binary:בינארי database:מסד נתונים laptop:מחשב נייד monitor:מסך file-code:קובץ קוד workflow:תהליך זרימה'],
  ['בטיחות', 'shield:מגן בטיחות shield-check:מגן מאושר hard-hat:קסדה glasses:משקפי מגן triangle-alert:אזהרה flame:אש להבה siren:סירנה חירום hand:יד עצור ear:אוזן שמיעה רעש eye:עין ראייה'],
  ['כלים ומכונות', 'printer:מדפסת הדפסה scissors:מספריים חיתוך crosshair:כוונת crosshair factory:מפעל package:חבילה package-open:חבילה פתוחה forklift:מלגזה truck:משאית fan:מאוורר thermometer:מדחום timer:טיימר שעון hourglass:שעון חול container:מכולה scan-line:סריקה'],
  ['כללי', 'star:כוכב flag:דגל book-open:ספר לימוד graduation-cap:כובע סיום trophy:גביע award:פרס medal:מדליה rocket:רקטה target:מטרה brain:מוח users:אנשים צוות presentation:מצגת clipboard-list:רשימה calendar:לוח שנה map:מפה puzzle:פאזל sparkles:נצנוץ heart:לב'],
].map(([group, s]) => ({ group, icons: s.split(' ').reduce((acc, tok) => {
  if (tok.includes(':')) { const [name, kw] = tok.split(':'); acc.push({ name, kw: [name, kw] }); } else acc[acc.length - 1].kw.push(tok);
  return acc;
}, []) }));
export const ALL_ICONS = ICON_GROUPS.flatMap((g) => g.icons.map((i) => ({ ...i, group: g.group })));
