// כלי הדגמה — scripted demo activity. Every step is a real user acting through a system's own request
// on the bus, with the clock moved to the step's date, so coins, streaks, ranks, notifications and the
// audit log all come from the real cross-system flows.
import { bus } from '../bus.js';

const MENTOR = 'u-mentor1', MENTOR2 = 'u-mentor2';
const iso = (d, t = '18:30') => `${d}T${t}:00`;

export function seedActivity({ ask, at }) {
  const safe = (label, fn) => { try { return fn(); } catch (e) { console.warn('demo seed step failed:', label, e && e.message); return undefined; } };
  const A = (name, p) => safe(name, () => ask(name, p));
  const ms = (cat, name) => bus.read('trainings.lookup', cat, name);
  const events = []; // {t, fn}
  const add = (t, fn) => events.push({ t: new Date(t).getTime(), fn });

  /* ---------------- Trainings: content, requirements, access ---------------- */
  add(iso('2026-08-04', '10:00'), () => {
    A('trainings.setCategoryAccess', { actor: MENTOR, catId: 'cat-cnc', access: { all: false, users: ['u-omer', 'u-yonatan', 'u-itay', 'u-lia'], teams: [], subteams: [], roles: [] } });
    const cad = (n) => ms('שרטוט', n);
    const req = (name, groups) => A('trainings.setRequirements', { actor: MENTOR, msId: cad(name), groups: groups.map(([mode, n, names]) => ({ mode, n, ids: names.map(cad) })) });
    req('Advanced entities', [['all', 1, ['Basic entities']]]);
    req('Smart dimension', [['all', 1, ['Basic entities']]]);
    req('Extrude boss', [['all', 2, ['Basic planes', 'Smart dimension']]]);
    req('Sketch on face', [['all', 1, ['Extrude boss']]]);
    req('Extrude Cut', [['all', 1, ['Extrude boss']]]);
    req('Revolve', [['all', 1, ['Extrude boss']]]);
    req('Edit sketch & Features', [['atleast', 2, ['Extrude boss', 'Relations', 'Sketch on face']]]);
    req('Fillete & Chamfer', [['atleast', 1, ['Extrude Cut', 'Revolve']]]);
    A('trainings.saveMilestone', { actor: MENTOR, milestone: { id: cad('Basic entities'), icon: 'pencil-ruler', color: 5,
      desc: 'קווים, מעגלים, קשתות ומלבנים — אבני הבניין של כל סקיצה ב-SolidWorks.',
      blocks: [
        { id: 'b1', type: 'text', html: '<h2>מה לומדים</h2><p>בסקיצה דו-ממדית משרטטים את <b>הצורה הבסיסית</b> של החלק. כל פיצ׳ר תלת-ממדי מתחיל מסקיצה.</p><ul><li>Line ו-Centerline</li><li>Circle ו-Arc</li><li>Rectangle ו-Slot</li></ul>' },
        { id: 'b2', type: 'videoLink', url: 'https://www.youtube.com/@SOLIDWORKS', caption: 'ערוץ ההדרכות של SolidWorks (קישור הדגמה)' },
        { id: 'b3', type: 'text', html: '<h3>טיפ</h3><p>החזיקו Shift כדי לשרטט קו ישר לחלוטין.</p>' }],
      checklist: [{ id: 'c1', text: 'שרטטתי מלבן עם חור במרכז' }, { id: 'c2', text: 'שרטטתי סלוט באורך 40 מ"מ' }, { id: 'c3', text: 'שמרתי את הקובץ בתיקיית הצוות' }],
      exam: [{ id: 'q1', text: 'מה ההבדל בין Line ל-Centerline?' }, { id: 'q2', text: 'מתי נשתמש ב-Slot?' }] } });
    A('trainings.saveMilestone', { actor: MENTOR, milestone: { id: cad('Smart dimension'), icon: 'ruler', color: 5, desc: 'מוסיפים מידות לסקיצה כדי שתהיה מוגדרת לגמרי (שחורה).',
      blocks: [{ id: 'b1', type: 'text', html: '<p>סקיצה <b>כחולה</b> עדיין לא מוגדרת. מוסיפים מידות ויחסים עד שכל הקווים הופכים לשחורים.</p><ol><li>בוחרים Smart Dimension</li><li>לוחצים על הישות</li><li>מקלידים את המידה</li></ol>' }],
      checklist: [{ id: 'c1', text: 'הסקיצה שלי מוגדרת לגמרי' }, { id: 'c2', text: 'השתמשתי במידה זוויתית' }] } });
    A('trainings.saveMilestone', { actor: MENTOR, milestone: { id: cad('Extrude boss'), icon: 'box', color: 4, desc: 'הופכים סקיצה לגוף תלת-ממדי בעזרת Extrude.',
      blocks: [{ id: 'b1', type: 'text', html: '<p>Extrude Boss/Base מותח את הסקיצה לעומק. נסו את האפשרויות <b>Blind</b>, <b>Mid Plane</b> ו-<b>Up To Surface</b>.</p>' }],
      exam: [{ id: 'q1', text: 'מה עושה Mid Plane?' }] } });
  });

  // helpers for requests
  const submitAndApprove = (uid, cat, names, approver, day, { approve = true, rejectNote } = {}) => names.forEach((n, i) => {
    const t = new Date(iso(day, '17:30')).getTime() + i * 20 * 60000;
    add(t, () => {
      const id = ms(cat, n); if (!id) return;
      const m = bus.read('trainings.milestone', id);
      A('trainings.saveProgress', { actor: uid, msId: id, ticks: (m.checklist || []).map((x) => x.id), answers: Object.fromEntries((m.exam || []).map((q) => [q.id, 'התשובה שלי לשאלה'])) });
      const rq = A('trainings.submit', { actor: uid, msId: id });
      if (!rq || !approver) return;
      add(t + 3600000, () => A('trainings.decide', { actor: approver, requestId: rq, approve, note: rejectNote }));
    });
  });
  const force = (approver, uid, cat, names, day) => add(iso(day, '19:00'), () => A('trainings.forceCheck', { actor: approver, uid, msIds: names.map((n) => ms(cat, n)).filter(Boolean) }));
  const T = (cat) => ({ build: ['ברגים', 'אומים', 'חומרים', 'לקיחת מידות', 'מקדחים', 'זוויות', 'מפתחות', 'ניטים', 'מקדחה', 'מברגה', 'מסור ידני', 'שופין', 'ניטר', 'רצועת שיוף', 'מקדחת עמוד', 'משייף חשמלי', 'ניטר פנאומטי', 'דיסק ידני', 'ג\'יגסו', 'מסור שולחן', 'דרמל (שיוף)', 'דרמל (חיתוך)', 'מולטי-טול', 'מסור סרט', 'גריינדר', 'מנועים', 'תמסורות', 'דיסק שולחן (משונן)', 'ZK'],
    soft: ['🐕 Dog 🐕', 'Java basics', 'OOPs', 'Git', 'Cool For The Summer', 'Pheonix', 'אלקטרוניקה 101', 'הלחמה', 'הרובוט הראשון שלי', 'SOLID', 'Clean Code', 'Conventions', 'Design Patterns', 'Command Based', 'Command Compositions', 'Unit testing', 'אוטומציות', 'How java runs?', 'Autonomous Routines', 'PIDF', 'Vision', 'Code Reviewing', 'Swerve'],
    cad: ['Basic entities', 'Basic planes', 'Advanced entities', 'Smart dimension', 'Extrude boss', 'Edit sketch & Features', 'Sketch on face', 'Relations', 'Selected contours', 'Extrude Cut', 'From - property manager', 'Directions - property manager', 'Revolve', 'Fillete & Chamfer', 'Convert', 'Thin features', 'Basic Mates', 'Advanced Mates', 'ניווט', 'Fixed & Float', 'Insert Component', 'Mirror feature'],
    cnc: ['שרטוט בסיסי', 'Setup תוכנתי', 'קביעת Feature', 'קביעת Operation'] }[cat]);

  // launch-time force checks of experienced students (no coins)
  force(MENTOR, 'u-yonatan', 'בנייה', T('build'), '2026-08-10');
  force(MENTOR, 'u-itay', 'בנייה', T('build').slice(0, 25), '2026-08-10');
  force('u-itay', 'u-hila', 'בנייה', T('build').slice(0, 28), '2026-08-20'); // all up to ניטפריים; blocked only by grade (ט')
  force('u-itay', 'u-lia', 'בנייה', T('build').slice(0, 14), '2026-08-20');
  force(MENTOR, 'u-tamar', 'תוכנה', T('soft'), '2026-08-10');
  force(MENTOR, 'u-adi', 'תוכנה', T('soft').slice(0, 19), '2026-08-10');
  force('u-adi', 'u-ariel', 'תוכנה', T('soft').slice(0, 13), '2026-08-20');
  force(MENTOR, 'u-maya', 'שרטוט', T('cad'), '2026-08-10');
  force('u-maya', 'u-roni', 'שרטוט', T('cad').slice(0, 10), '2026-08-21');
  force(MENTOR, 'u-omer', 'CNC', T('cnc'), '2026-09-01'); // CNC rank ניט

  // studying through requests (coins)
  submitAndApprove('u-omer', 'בנייה', T('build').slice(0, 8), 'u-itay', '2026-09-07');
  submitAndApprove('u-nadav', 'בנייה', T('build').slice(0, 3), 'u-itay', '2026-10-05');
  submitAndApprove('u-yoav', 'תוכנה', T('soft').slice(0, 9), 'u-adi', '2026-09-14');
  submitAndApprove('u-michal', 'תוכנה', T('soft').slice(0, 3), 'u-adi', '2026-10-12');
  submitAndApprove('u-tal', 'תוכנה', T('soft').slice(0, 5), 'u-adi', '2026-09-21');
  submitAndApprove('u-tal', 'תוכנה', ['Pheonix'], 'u-adi', '2026-11-02', { approve: false, rejectNote: 'חסר צילום של הרובוט עובד — תעלו ותשלחו שוב' });
  submitAndApprove('u-inbal', 'תוכנה', T('soft').slice(0, 2), 'u-adi', '2026-09-28');
  submitAndApprove('u-alon', 'שרטוט', ['Basic entities', 'Basic planes', 'Smart dimension', 'Advanced entities', 'Extrude boss', 'Relations', 'Selected contours', 'Sketch on face', 'Extrude Cut'], 'u-maya', '2026-09-09');
  submitAndApprove('u-shira', 'שרטוט', ['Basic entities', 'Basic planes'], 'u-maya', '2026-10-19');
  // pending requests waiting for approval
  submitAndApprove('u-shira', 'שרטוט', ['Smart dimension'], null, '2026-11-16');
  submitAndApprove('u-ido', 'שרטוט', ['Basic entities'], null, '2026-11-18');
  submitAndApprove('u-michal', 'תוכנה', ['Git'], null, '2026-11-17');
  submitAndApprove('u-nadav', 'בנייה', ['לקיחת מידות'], null, '2026-11-11');

  /* ---------------- Attendance (+ Streak Freezes bought in Store) ---------------- */
  bus.ask('attendance.generate', {});
  const meetings = bus.read('attendance.calendar', '2026-08-01', '2026-11-19').filter((m) => !m.projected && !m.cancelled);
  const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);
  const ABSENT = {
    'u-maya': [], 'u-tamar': [10], 'u-itay': [14], 'u-omer': [5, 24], 'u-lia': [11], 'u-yonatan': [3, 19],
  };
  meetings.forEach((m, i) => {
    const t = new Date(`${m.date}T${m.time}:00`).getTime() + 90 * 60000;
    if (i === 18) add(t - 3600000, () => A('store.buy', { actor: 'u-omer', itemId: 'freeze' }));
    if (i === 22) add(t - 3600000, () => A('store.buy', { actor: 'u-omer', itemId: 'freeze' }));
    if (i === 26) add(t - 3600000, () => A('store.buy', { actor: 'u-lia', itemId: 'freeze' }));
    add(t, () => {
      bus.read('attendance.audience', m.id).forEach((u) => {
        const list = ABSENT[u];
        const absent = list ? list.includes(i) : (i + hash(u)) % 7 === 0 || (i + hash(u)) % 11 === 0;
        A('attendance.mark', { actor: MENTOR, meetingId: m.id, uid: u, value: absent ? 'absent' : 'present' });
      });
    });
  });

  /* ---------------- Coins: manual awards ---------------- */
  add(iso('2026-11-05', '20:00'), () => A('coins.award', { actor: 'u-itay', uids: ['u-nadav'], amount: 15, reason: 'עזרה בסידור הסדנה אחרי הפגישה' }));
  add(iso('2026-11-12', '20:00'), () => A('coins.award', { actor: MENTOR, uids: ['u-ariel', 'u-michal'], amount: 40, reason: 'הצגת הקבוצה בכנס הנוער' }));

  /* ---------------- Store ---------------- */
  add(iso('2026-08-02', '09:00'), () => {
    A('store.saveCollections', { actor: MENTOR, list: [{ id: 'col-autumn', name: 'קולקציית סתיו' }] });
    ['cos:demo-banner', 'cos:demo-frame', 'cos:demo-name'].forEach((id) => A('store.setCosmetic', { actor: MENTOR, id, patch: { collection: 'col-autumn' } }));
    const it = (f) => A('store.saveItem', { actor: MENTOR, fields: { desc: '', stock: null, limit: null, visibleTo: null, collection: null, image: null, ...f } });
    globalThis.__demoIds = {
      cadKing: it({ type: 'tag', name: 'מלך ה-CAD', color: 'p:5', price: 200, forSale: true }),
      welder: it({ type: 'tag', name: 'רתך מוסמך', color: 'p:13', price: 150, forSale: true }),
      mvp: it({ type: 'tag', name: 'MVP עונה 2026', color: 'p:10', price: 0, forSale: false }),
      volunteer: it({ type: 'tag', name: 'מתנדב/ת השנה', color: 'p:3', price: 0, forSale: false }),
      shirt: it({ type: 'prize', name: 'חולצת קבוצה', desc: 'חולצת Neat Team רשמית במידה שתבחרו.', price: 300, stock: 20, limit: 1, forSale: true }),
      song: it({ type: 'privilege', name: 'בחירת שיר בסדנה', desc: 'את/ה בוחר/ת את הפלייליסט לפגישה אחת.', price: 80, forSale: true }),
    };
  });
  add(iso('2026-11-08', '21:00'), () => {
    const ids = globalThis.__demoIds || {};
    A('store.saveItem', { actor: 'u-adi', fields: { type: 'prize', name: 'פיצה לצוות תוכנה', desc: 'ארוחת פיצה אחרי פגישה.', price: 250, stock: 1, limit: 1, visibleTo: 'team-software', forSale: true, collection: null, image: null } });
    A('store.proposeTag', { actor: 'u-adi', uid: 'u-michal', tagId: ids.volunteer, reason: 'הובילה את יום ההתנדבות בבית הספר' });
    A('store.award', { actor: MENTOR, uid: 'u-itay', itemId: ids.mvp, reason: 'הוביל את הבנייה בעונה שעברה' });
    A('store.award', { actor: MENTOR, uid: 'u-maya', itemId: 'cos:demo-effect', reason: 'תודה על הדרכת חברי הצוות החדשים' });
  });
  add(iso('2026-11-19', '20:00'), () => {
    const ids = globalThis.__demoIds || {};
    A('store.buy', { actor: 'u-maya', itemId: 'cos:demo-banner' }); A('store.buy', { actor: 'u-maya', itemId: 'cos:demo-frame' });
    A('store.saveEquip', { actor: 'u-maya', equip: { banner: 'cos:demo-banner', frame: 'cos:demo-frame', effect: 'cos:demo-effect' }, tags: [] });
    A('store.buy', { actor: 'u-tamar', itemId: 'cos:demo-name' }); A('store.equip', { actor: 'u-tamar', slot: 'nameColor', itemId: 'cos:demo-name' });
    A('store.buy', { actor: 'u-alon', itemId: ids.cadKing }); A('store.showTag', { actor: 'u-alon', tagId: ids.cadKing });
    A('store.showTag', { actor: 'u-itay', tagId: ids.mvp });
    A('store.request', { actor: 'u-yoav', itemId: ids.shirt, note: 'מידה M בבקשה' });
    A('store.toggleWish', { actor: 'u-ido', itemId: 'cos:demo-frame' }); A('store.toggleWish', { actor: 'u-ido', itemId: ids.shirt });
    A('store.toggleWish', { actor: 'u-shira', itemId: 'cos:demo-name' }); A('store.toggleWish', { actor: 'u-michal', itemId: 'cos:demo-plate' });
  });

  /* ---------------- Sunday ---------------- */
  add(iso('2026-11-08', '18:00'), () => {
    // שרטוט board
    const cad = A('sunday.createBoard', { actor: 'u-maya', name: 'שרטוט — רובוט 2027', team: 'team-cad' });
    const g1 = A('sunday.createGroup', { actor: 'u-maya', boardId: cad, name: 'הדפסות' });
    const g2 = A('sunday.createGroup', { actor: 'u-maya', boardId: cad, name: 'מנגנון הרמה' });
    const g3 = A('sunday.createGroup', { actor: 'u-maya', boardId: cad, name: 'תכנון שלדה' });
    A('sunday.updateGroup', { actor: 'u-maya', groupId: g3, patch: { color: 'p:5' } });
    A('sunday.updateGroup', { actor: 'u-maya', groupId: g2, patch: { color: 'p:3' } });
    A('sunday.updateGroup', { actor: 'u-maya', groupId: g1, patch: { color: 'p:1' } });
    const item = (actor, g, name, f = {}) => {
      const id = A('sunday.createItem', { actor, groupId: g, name });
      if (!id) return id;
      if (f.who) A('sunday.setAssignees', { actor: f.assignBy || 'u-maya', itemId: id, uids: f.who });
      if (f.date) A('sunday.setDate', { actor, itemId: id, start: f.start || null, end: f.date });
      if (f.pri) A('sunday.setPriority', { actor, itemId: id, key: f.pri });
      if (f.size) A('sunday.setSize', { actor: f.sizeBy || 'u-maya', itemId: id, size: f.size });
      if (f.status) A('sunday.setStatus', { actor: f.statusBy || actor, itemId: id, key: f.status });
      return id;
    };
    globalThis.__sun = {};
    const S = globalThis.__sun;
    S.chassis = item('u-maya', g3, 'שרטוט בסיס השלדה', { who: ['u-alon', 'u-shira'], date: '2026-11-25', pri: 'high', size: 'large', status: 'working' });
    item('u-maya', g3, 'חישוב משקלים', { who: ['u-alon'], date: '2026-11-18', pri: 'crit', size: 'medium', status: 'stuck' });
    item('u-ido', g3, 'ייצוא קבצי DXF לחיתוך', { date: '2026-11-20', pri: 'med' });
    S.lift = item('u-maya', g2, 'מודל מנגנון הרמה', { who: ['u-shira', 'u-roni'], start: '2026-11-16', date: '2026-11-26', pri: 'high', size: 'huge' });
    ['גלגלת עליונה', 'מסילה', 'חיבור למנוע'].forEach((n, i) => { const sid = A('sunday.createItem', { actor: 'u-shira', groupId: g2, name: n, parentId: S.lift }); if (sid && i < 2) A('sunday.setStatus', { actor: 'u-shira', itemId: sid, key: 'done' }); });
    S.print = item('u-maya', g1, 'הדפסת מחברים', { who: ['u-roni'], size: 'medium', date: '2026-11-17' });
    S.tol = item('u-daniel', g1, 'תיקון סובלנות לחורים', { date: '2026-11-15' });
    item('u-maya', g1, 'כיול מדפסת', { who: ['u-daniel', 'u-ido'], date: '2026-11-30', pri: 'low', size: 'small' });
    // בנייה board
    const build = A('sunday.createBoard', { actor: 'u-itay', name: 'בנייה — הכנה לעונה', team: 'team-build' });
    const b2 = A('sunday.createGroup', { actor: 'u-itay', boardId: build, name: 'רכש' });
    const b1 = A('sunday.createGroup', { actor: 'u-itay', boardId: build, name: 'סדנה' });
    A('sunday.updateGroup', { actor: 'u-itay', groupId: b1, patch: { color: 'p:13' } });
    S.tools = item('u-itay', b1, 'סידור ארון כלים', { who: ['u-hila', 'u-omer'], assignBy: 'u-itay', size: 'small', sizeBy: 'u-itay', date: '2026-11-10' });
    S.clean = item('u-itay', b1, 'ניקוי וסידור הסדנה', { who: ['u-omer'], assignBy: 'u-itay', size: 'large', sizeBy: 'u-itay', date: '2026-11-12' });
    S.drill = item('u-nadav', b1, 'בדיקת מקדחת עמוד', { date: '2026-11-16' });
    item('u-itay', b2, 'הזמנת פרופילי אלומיניום', { who: ['u-lia'], assignBy: 'u-itay', date: '2026-11-23', start: '2026-11-19', pri: 'high', size: 'medium', sizeBy: 'u-itay', status: 'working', statusBy: 'u-lia' });
    item('u-itay', b2, 'השוואת מחירי ניטים', { who: ['u-nadav'], assignBy: 'u-itay', date: '2026-12-03', pri: 'low' });
    // כללי board
    const gen = A('sunday.createBoard', { actor: 'u-tamar', name: 'כללי — אירועים', team: null });
    const e1 = A('sunday.createGroup', { actor: 'u-tamar', boardId: gen, name: 'קיקאוף' });
    A('sunday.updateGroup', { actor: 'u-tamar', groupId: e1, patch: { color: 'p:7' } });
    item('u-tamar', e1, 'עיצוב חולצות לעונה', { who: ['u-michal'], assignBy: 'u-tamar', start: '2026-12-01', date: '2026-12-10', pri: 'med', size: 'medium', sizeBy: 'u-tamar' });
    item('u-tamar', e1, 'מצגת גיוס תורמים', { who: ['u-ariel', 'u-tamar'], assignBy: 'u-tamar', date: '2026-11-27', pri: 'high', size: 'large', sizeBy: 'u-yonatan', status: 'working' });
    item('u-tamar', e1, 'הזמנת אוטובוס לאירוע', { who: ['u-yonatan'], assignBy: 'u-tamar', date: '2027-01-02', pri: 'low', size: 'small', sizeBy: 'u-tamar' });
    A('sunday.addColumn', { actor: 'u-tamar', groupId: e1, type: 'text', label: 'הערות' });
  });
  add(iso('2026-11-12', '19:30'), () => {
    const S = globalThis.__sun || {};
    A('sunday.comment', { actor: 'u-maya', itemId: S.chassis, text: '@אלון מזרחי תעדכן אחרי הפגישה איפה עומד הסקיצה של הבסיס', mentions: ['u-alon'] });
    A('sunday.setStatus', { actor: 'u-omer', itemId: S.tools, key: 'done' });
    A('sunday.setStatus', { actor: 'u-omer', itemId: S.clean, key: 'done' });
  });
  add(iso('2026-11-13', '20:00'), () => {
    const S = globalThis.__sun || {};
    A('sunday.comment', { actor: 'u-alon', itemId: S.chassis, text: 'סיימתי את הצלע הקדמית, נשאר החיבור לגלגלים. מעלה קובץ לדרייב מחר.' });
    A('sunday.addFile', { actor: 'u-alon', itemId: S.chassis, name: 'שלדה v3.SLDPRT', url: 'https://drive.google.com/file/d/demo-file-id/view' });
    A('sunday.setDescription', { actor: 'u-maya', itemId: S.chassis, html: '<h2>מטרה</h2><p>שלדה במידות <b>27x27 אינץ׳</b>, פרופילי 1x1.</p><ul><li>לשמור מקום לסוללה</li><li>חורים כל 0.5 אינץ׳</li></ul>' });
    A('sunday.approveCoins', { actor: 'u-itay', itemId: S.tools, size: 'small' });
    A('sunday.approveCoins', { actor: 'u-itay', itemId: S.clean, size: 'large' });
  });
  add(iso('2026-11-18', '19:45'), () => {
    const S = globalThis.__sun || {};
    A('sunday.setStatus', { actor: 'u-roni', itemId: S.print, key: 'done' });      // waiting for coin approval
    A('sunday.setAssignees', { actor: 'u-daniel', itemId: S.tol, uids: ['u-daniel'] });
    A('sunday.setStatus', { actor: 'u-daniel', itemId: S.tol, key: 'done' });     // waiting for size + approval
    A('sunday.setStatus', { actor: 'u-nadav', itemId: S.drill, key: 'working' });
    A('sunday.comment', { actor: 'u-shira', itemId: S.lift, text: 'הגלגלת והמסילה מוכנות. מחר מתחילה את החיבור למנוע.' });
  });

  /* ---------------- Countdowns ---------------- */
  add(iso('2026-11-01', '10:00'), () => {
    A('countdown.save', { actor: MENTOR, name: 'קיקאוף 2027', at: new Date('2027-01-09T19:00:00').toISOString(), desc: 'חשיפת המשחק של העונה החדשה — כולם באולם!' });
    A('countdown.save', { actor: MENTOR2, name: 'תחרות מחוזית', at: new Date('2027-03-08T08:00:00').toISOString(), desc: 'התחרות המחוזית הראשונה של העונה' });
  });

  /* ---------------- Announcements & poll ---------------- */
  const all = { all: true, users: [], teams: [], subteams: [], roles: [] };
  add(iso('2026-10-01', '12:00'), () => A('announcements.publish', { actor: MENTOR, fields: { text: 'שנה טובה לכולם! הפגישה הראשונה אחרי החגים ביום שני ב-17:00.', audience: all, expires: '2026-10-08', pinned: false } }));
  add(iso('2026-11-15', '09:00'), () => A('announcements.publish', { actor: MENTOR2, fields: { text: 'ברוכים הבאים לעונת 2027! כל המידע על הקיקאוף, ההרשמה וההסעות יעלה כאן ובקישורים ב-NeatHub. שאלות — לקפטנים.', audience: all, expires: '2026-12-15', pinned: true, includeAlumni: true } }));
  add(iso('2026-11-17', '21:00'), () => A('announcements.publish', { actor: 'u-maya', fields: { text: 'מחר מביאים מחשבים ניידים עם SolidWorks מותקן. מי שאין לו — לדבר איתי עד הערב.', audience: { all: false, users: [], teams: ['team-cad'], subteams: [], roles: [] }, expires: '2026-11-24' } }));
  add(iso('2026-11-18', '10:00'), () => {
    const id = A('announcements.publish', { actor: 'u-tamar', fields: { text: 'מתכננים ערב גיבוש לכל הקבוצה עם פיצות!', audience: all, expires: '2026-11-27',
      poll: { question: 'איזה יום מתאים לכם לערב הגיבוש?', options: [{ text: 'ראשון' }, { text: 'שלישי' }, { text: 'חמישי' }], multiple: false, anonymous: false, closesAt: '2026-11-26' } } });
    if (!id) return;
    const poll = bus.read('announcements.forUser', 'u-maya').find((p) => p.id === id);
    if (!poll) return;
    const o = poll.poll.options.map((x) => x.id);
    [['u-maya', 0], ['u-alon', 1], ['u-itay', 1], ['u-yoav', 2], ['u-hila', 1], ['u-adi', 0], ['u-omer', 1]].forEach(([u, k]) => A('announcements.vote', { actor: u, postId: id, optionIds: [o[k]] }));
  });

  // run everything in date order
  events.sort((x, y) => x.t - y.t);
  for (let i = 0; i < events.length; i++) { const ev = events[i]; at(new Date(ev.t).toISOString(), () => safe('event', ev.fn)); events.sort((x, y) => x.t - y.t); }
}
