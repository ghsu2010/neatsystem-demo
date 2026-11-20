// Store UI: store page (Design 7.5), item sheet with try-on, האוסף שלי, הפריטים שלי (equip screen),
// הרכישות שלי, wishlist, profile widgets, and Store management (Store 8).
import { html, useState, useEffect, useRef } from '../../core/lib.js';
import { bus } from '../../core/bus.js';
import { addManagement, addRoute, addWidget, addTabBadge } from '../../core/registry.js';
import { Button, Icon, Chips, Seg, Field, Card, EmptyState, Badge, Tag, Switch, SwitchRow, CoinChip, IconButton, ReadOnlyNote, cx } from '../../core/ui.js';
import { Avatar, PersonName, TeamBadge, safeRead, initials } from '../../core/people.js';
import { sheet, act, toast, confirm, promptText, popover, actionSheet } from '../../core/overlay.js';
import { pickColor, MenuSelect, pickPeople } from '../../core/pickers.js';
import { fmtDate, relTime, byHe } from '../../core/format.js';
import { navigate, route } from '../../core/router.js';
import { tintVars, PRESETS } from '../../core/color.js';
import { startDrag, moveIn } from '../../core/drag.js';
import { SLOTS, SLOT_HE, STATE_HE, img } from './index.js';

const me = () => bus.read('users.currentId');
const A = () => bus.read('users.actor', me());

/* ---------- previews ---------- */
function ItemPreview({ it, size = 'tile' }) {
  const box = (inner, style = '') => html`<div class="store-prev" style=${style}>${inner}</div>`;
  if (it.type === 'freeze') return box(html`<${Icon} name="snowflake" size=${48} color="#2D9CDB"/>`);
  if (it.type === 'tag') return box(html`<${Tag} text=${it.name} color=${it.color}/>`);
  if (it.type === 'prize' || it.type === 'privilege') {
    const url = it.image ? img.url(it.image) : null;
    return box(url ? html`<img src=${url} alt="" style="width:100%;height:100%;object-fit:cover"/>` : html`<${Icon} name=${it.type === 'prize' ? 'gift' : 'ticket'} size=${44} cls="sec"/>`);
  }
  const L = it.def.look;
  switch (it.slot) {
    case 'banner': return box('', L.style);
    case 'frame': return box(html`<span class="avatar" style="width:64px;height:64px"><span class="av-in" style="background:var(--bg-surface)"><${Icon} name="user" size=${28} cls="muted"/></span><span class="frame" style=${`background:${L.ring}`}/></span>`);
    case 'nameColor': return box(html`<span class=${cx('t-title3 w7', L.cls)} style=${L.style}>שם לדוגמה</span>`);
    case 'nameplate': return box(html`<span class="t-label nameplate" style=${L.style}>שם לדוגמה</span>`);
    case 'effect': return box(html`<${Icon} name="sparkles" size=${44} color="#7B4DFF"/>`);
    case 'theme': return box(html`<span style=${`width:56px;height:56px;border-radius:12px;background:${L.accent};box-shadow:inset 0 0 0 999px ${L.bannerTint}`}/>`);
    default: return box('');
  }
}
/** Try-on card = the user's own profile card with the item applied (Design 7.5). */
function TryOn({ uid, override = {}, play = 0 }) {
  const u = bus.read('users.get', uid);
  const eqIds = { ...bus.read('store.equippedIds', uid), ...override };
  const look = (slot) => { const id = eqIds[slot]; if (!id) return null; const c = bus.read('store.cosmetic', id); return c ? c.look : null; };
  const banner = look('banner'), frame = look('frame'), name = look('nameColor'), plate = look('nameplate'), effect = look('effect'), theme = look('theme');
  return html`<div class="card b" style="padding:0;overflow:hidden;position:relative">
    <div style=${`height:72px;${banner ? banner.style : 'background:linear-gradient(135deg,var(--hero-from),var(--hero-to))'};${theme ? `box-shadow:inset 0 0 0 999px ${theme.bannerTint}` : ''}`}/>
    ${effect && html`<${EffectLayer} kind=${effect.kind} key=${play + ':' + eqIds.effect}/>`}
    <div style="padding:0 16px 16px;margin-top:-32px" class="col gap8">
      <span class="avatar" style="width:64px;height:64px;box-shadow:0 0 0 4px var(--bg-surface)"><span class="av-in tinted" style=${safeRead('users.teamTint', u.main_team)}>${(() => { const p = safeRead('users.pictureUrl', uid); return p ? html`<img src=${p} alt=""/>` : initials(u.name_he); })()}</span>
        ${frame && html`<span class="frame" style=${`background:${frame.ring}`}/>`}</span>
      <span class=${cx('t-title3 w7', name && name.cls, name && name.animated && 'anim')} style=${name ? name.style : ''}><bdi>${u.name_he}</bdi></span>
      <div class="row gap8 t-foot sec">ברשימת החברים: <span class="t-label nameplate" style=${(plate ? plate.style : '') + ';' + (name ? name.style : '')}><span class=${name && name.cls}>${u.name_he}</span></span></div>
      ${theme && html`<div class="row gap8"><span class="subtle-box t-foot" style=${`box-shadow:inset 0 -3px 0 ${theme.accent};padding:8px 12px`}>אריח נתונים</span></div>`}
    </div></div>`;
}
function EffectLayer({ kind }) {
  const colors = kind === 'snow' ? ['#FFFFFF', '#D3E9F8'] : ['#FBEFC4', '#D69E00', '#E3DBFF', '#FFFFFF'];
  return html`<div class="effect-layer" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => html`<i style=${`left:${(i * 53) % 100}%;background:${colors[i % colors.length]};animation-delay:${(i % 9) * 120}ms;width:${4 + (i % 3) * 2}px;height:${4 + (i % 3) * 2}px;box-shadow:0 0 6px ${colors[i % colors.length]}`}/>`)}</div>`;
}
addWidget('store.effectLayer', EffectLayer);

/* ---------- tiles and item sheet ---------- */
function tileState(it, uid) {
  const a = A();
  if (it.type === 'freeze') { const n = bus.read('attendance.freezes', uid); const cap = bus.read('attendance.settings').freeze_cap; return { owned: false, freezes: n, cap, full: n >= cap }; }
  const owned = bus.read('store.ownsItem', uid, it.id);
  const soldOut = it.stock != null && bus.read('store.soldCount', it.id) >= it.stock;
  const limit = it.limit && ['prize', 'privilege'].includes(it.type) && bus.read('store.personCount', uid, it.id) >= it.limit;
  const bal = bus.read('coins.balance', uid);
  return { owned, soldOut, limit, cantAfford: bal.spendable < it.price, wished: (bus.read('store.wishlist', uid) || []).some((x) => x.id === it.id) };
}
function Tile({ it }) {
  const uid = me();
  const s = tileState(it, uid);
  return html`<button class="store-tile" style=${s.soldOut ? 'opacity:.4' : ''} onClick=${() => openItem(it.id)} aria-label=${it.name}>
    <div style="position:relative"><${ItemPreview} it=${it}/>
      ${it.visibleTo && html`<span style="position:absolute;top:8px;inset-inline-start:8px"><${TeamBadge} teamId=${it.visibleTo}/></span>`}
      ${s.wished && html`<span style="position:absolute;top:8px;inset-inline-end:8px;color:#E2445C"><${Icon} name="heart" size=${18} fill="currentColor" label="ברשימת המשאלות"/></span>`}
      ${it.demo && html`<span class="badge" style="position:absolute;bottom:8px;inset-inline-start:8px">דוגמה</span>`}</div>
    <span class="t-label clamp2" style="text-align:start">${it.name}</span>
    <span class="row wrap gap4">${s.owned ? html`<${Badge} kind="success" text="בבעלותך" icon="check"/>` : s.soldOut ? html`<${Badge} text="אזל"/>` : s.limit ? html`<${Badge} text="הגעת למגבלה"/>`
      : html`<${CoinChip} n=${it.price} size="sm" danger=${s.cantAfford}/>`}
      ${it.type === 'freeze' && html`<span class="t-foot sec">בבעלותך: ${s.freezes}/${s.cap}</span>`}</span>
  </button>`;
}
function openItem(id) {
  sheet('', (close) => html`<${ItemSheet} id=${id} close=${close}/>`, { wide: false });
}
function ItemSheet({ id, close }) {
  const it = bus.read('store.item', id);
  const uid = me();
  const a = A();
  const [play, setPlay] = useState(0);
  const [bought, setBought] = useState(0);
  if (!it) return html`<p>הפריט לא נמצא</p>`;
  const s = tileState(it, uid);
  const cosmetic = it.type === 'cosmetic';
  const canBuy = a.teamMember && !a.readOnly;
  const request = it.type === 'prize' || it.type === 'privilege';
  let disabledReason = null;
  if (a.readOnly) disabledReason = 'בוגרים במצב קריאה בלבד';
  else if (!canBuy) disabledReason = 'אין לך מטבעות';
  else if (s.owned) disabledReason = 'בבעלותך';
  else if (s.soldOut) disabledReason = 'אזל';
  else if (s.limit) disabledReason = 'הגעת למגבלה';
  else if (it.type === 'freeze' && s.full) disabledReason = `יש לך כבר ${s.cap} הקפאות`;
  else if (!it.forSale) disabledReason = 'לא למכירה';
  const buy = async () => {
    if (request) {
      const note = await promptText({ title: `בקשה לרכוש ${it.name}`, text: `${it.price} מטבעות יישמרו עד שהבקשה תטופל.`, label: 'הערה (לא חובה)', min: 0, max: 280, ok: 'בקשה לרכוש' });
      if (note === null) return;
      if (act(() => bus.ask('store.request', { actor: uid, itemId: id, note }))) { toast('הבקשה נשלחה'); close(); }
      return;
    }
    const ok = await confirm({ title: it.price === 0 ? 'קבלה בחינם' : 'קנייה', text: `לקנות ${it.name} ב-${it.price}?`, ok: it.price === 0 ? 'קבלה בחינם' : 'קנייה' });
    if (!ok) return;
    const r = act(() => bus.ask('store.buy', { actor: uid, itemId: id }));
    if (!r) return;
    setBought(bought + 1); // the item scales in on the try-on card (Design 7.5)
    toast('נקנה!');
    if (cosmetic || it.type === 'tag') {
      if (await confirm({ title: 'להשתמש עכשיו?', text: it.name, ok: 'כן', cancel: 'אחר כך' })) {
        if (cosmetic) act(() => bus.ask('store.equip', { actor: uid, slot: it.slot, itemId: id }));
        else act(() => bus.ask('store.showTag', { actor: uid, tagId: id }));
      }
    }
  };
  return html`<div class="col gap16">
    ${cosmetic ? html`<div class=${bought ? 'scale-in' : ''} key=${'b' + bought}><${TryOn} uid=${uid} override=${{ [it.slot]: id }} play=${play}/></div>
      ${it.slot === 'effect' && html`<button class="btn btn-link btn-sm" style="align-self:flex-start" onClick=${() => setPlay(play + 1)}>הפעלה שוב</button>`}`
    : html`<div class=${bought ? 'scale-in' : ''} key=${'b' + bought}><${ItemPreview} it=${it}/></div>`}
    <div class="col gap4"><div class="row gap8"><h2 class="t-title2 grow">${it.name}</h2>${it.demo && html`<${Badge} text="דוגמה"/>`}${it.visibleTo && html`<${TeamBadge} teamId=${it.visibleTo}/>`}</div>
      ${it.desc && html`<p class="t-body sec" dir="auto">${it.desc}</p>`}
      <p class="t-foot sec">${cosmetic ? SLOT_HE[it.slot] + ' · ' : ''}${it.stock != null ? `במלאי: ${Math.max(0, it.stock - bus.read('store.soldCount', it.id))}` : 'מלאי ללא הגבלה'}${it.limit && request ? ` · עד ${it.limit} לאדם` : ''}${it.type === 'freeze' ? ` · בבעלותך: ${s.freezes}/${s.cap}` : ''}</p></div>
    ${it.type !== 'freeze' && !s.owned && html`<button class="btn btn-ghost" style="align-self:flex-start" disabled=${a.noRole} onClick=${() => act(() => bus.ask('store.toggleWish', { actor: uid, itemId: id }))}>
      <${Icon} name="heart" size=${20} fill=${s.wished ? 'currentColor' : 'none'} color=${s.wished ? '#E2445C' : undefined}/>${s.wished ? 'ברשימת המשאלות' : 'הוספה לרשימת המשאלות'}</button>`}
    <${Button} kind="reward" full disabled=${!!disabledReason} title=${disabledReason} onClick=${buy}>
      ${disabledReason || (request ? 'בקשה לרכוש' : it.price === 0 ? 'קבלה בחינם' : html`קנייה · <span class="num">${it.price}</span>`)}</${Button}>
    ${a.readOnly && html`<${ReadOnlyNote}/>`}
  </div>`;
}

/* ---------- store page ---------- */
const CHIP_SLOTS = SLOTS.map(([v, l]) => ({ value: v, label: l }));
function StorePage() {
  const uid = me();
  const a = A();
  const [chip, setChip] = useState('all');
  const [sort, setSort] = useState('new');
  const bal = bus.read('coins.balance', uid);
  const all = bus.read('store.items', { includeHidden: false }).filter((it) => bus.read('store.canSee', uid, it.id));
  const myTeam = all.filter((it) => it.visibleTo && it.visibleTo === a.team);
  const sorter = (x, y) => (sort === 'low' ? x.price - y.price : sort === 'high' ? y.price - x.price : (y.createdAt > x.createdAt ? 1 : -1));
  const cols = bus.read('store.collections');
  const chips = [{ value: 'all', label: 'הכל' }, ...CHIP_SLOTS, { value: 'tags', label: 'תגיות' }, { value: 'freeze', label: 'הקפאות רצף' }, { value: 'prizes', label: 'פרסים וזכויות' },
    ...(myTeam.length ? [{ value: 'team', label: 'של הצוות שלי' }] : []), { value: 'mine', label: 'האוסף שלי' }];
  const row = (title, list) => list.length ? html`<section class="col gap8"><h2 class="t-title3">${title}</h2><div class="hscroll">${list.sort(sorter).map((it) => html`<${Tile} key=${it.id} it=${it}/>`)}</div></section>` : null;
  let body;
  if (chip === 'all') {
    body = html`<div class="col gap24">
      ${cols.map((c) => row(c.name, all.filter((it) => it.collection === c.id && !it.visibleTo)))}
      ${row('הקפאות רצף', all.filter((it) => it.type === 'freeze'))}
      ${row('תגיות', all.filter((it) => it.type === 'tag' && !it.collection && !it.visibleTo))}
      ${row('פרסים וזכויות', all.filter((it) => (it.type === 'prize' || it.type === 'privilege') && !it.collection && !it.visibleTo))}
      ${row('של הצוות שלי', myTeam)}
      ${row('עוד', all.filter((it) => it.type === 'cosmetic' && !it.collection))}</div>`;
  } else if (chip === 'mine') body = html`<${MyCollection} uid=${uid}/>`;
  else {
    const list = all.filter((it) => (chip === 'tags' ? it.type === 'tag' : chip === 'freeze' ? it.type === 'freeze' : chip === 'prizes' ? it.type === 'prize' || it.type === 'privilege' : chip === 'team' ? it.visibleTo === a.team : it.type === 'cosmetic' && it.slot === chip)).sort(sorter);
    body = list.length ? html`<div class="tile-grid">${list.map((it) => html`<${Tile} key=${it.id} it=${it}/>`)}</div>` : html`<${EmptyState} title="אין כאן פריטים עדיין"/>`;
  }
  return html`<div class="col gap16">
    <div class="row between wrap"><h1 class="page-title" style="margin:0">חנות</h1>
      ${!a.isMentor && html`<div class="col gap4" style="align-items:flex-end"><${CoinChip} n=${bal.spendable} size="lg"/>${bal.held > 0 && html`<span class="t-foot sec num">${bal.held} שמורים לבקשות</span>`}</div>`}</div>
    <div class="row wrap gap8"><${Button} kind="tinted" size="sm" icon="receipt" onClick=${() => navigate('/store/purchases')}>הרכישות שלי</${Button}>
      <${Button} kind="tinted" size="sm" icon="shirt" onClick=${() => navigate('/store/my-items')}>הפריטים שלי</${Button}></div>
    ${a.readOnly && html`<${ReadOnlyNote}/>`}
    <div class="row gap8" style="align-items:center"><div class="grow" style="min-width:0"><${Chips} items=${chips} value=${chip} onChange=${setChip}/></div>
      ${chip !== 'mine' && html`<${Seg} small value=${sort} onChange=${setSort} options=${[{ value: 'new', label: 'חדש' }, { value: 'low', label: 'מחיר נמוך' }, { value: 'high', label: 'מחיר גבוה' }]}/>`}</div>
    ${body}</div>`;
}
function MyCollection({ uid }) {
  const owned = bus.read('store.ownedItems', uid).filter((i) => i.type === 'cosmetic');
  const eq = bus.read('store.equippedIds', uid);
  if (!owned.length) return html`<${EmptyState} title="עוד אין לך פריטים" text="פריטים שתקנו או תקבלו יופיעו כאן"/>`;
  return html`<div class="col gap16">${SLOTS.map(([slot, label]) => { const list = owned.filter((i) => i.slot === slot); return list.length ? html`<section class="col gap8"><h2 class="t-title3">${label}</h2>
    <div class="tile-grid">${list.map((it) => html`<div class="store-tile" style="cursor:default"><${ItemPreview} it=${it}/><span class="t-label">${it.name}</span>
      <div class="switch-row" style="min-height:36px"><span class="t-foot sec">${eq[slot] === it.id ? 'בשימוש' : 'לא בשימוש'}</span>
        <${Switch} on=${eq[slot] === it.id} label=${it.name} onChange=${(v) => act(() => bus.ask('store.equip', { actor: uid, slot, itemId: v ? it.id : null }))}/></div></div>`)}</div></section>` : null; })}</div>`;
}

/* ---------- הפריטים שלי: equip screen ---------- */
function EquipScreen() {
  const uid = me();
  const q = route().query;
  const saved = bus.read('store.equippedIds', uid);
  const savedTags = (bus.read('store.shownTags', uid) || []).map((t) => t.id);
  const [equip, setEquip] = useState({ ...saved });
  const [tags, setTags] = useState(savedTags);
  const [slot, setSlot] = useState(q.slot || 'banner');
  const owned = bus.read('store.ownedItems', uid);
  const dirty = JSON.stringify(equip) !== JSON.stringify(saved) || JSON.stringify(tags) !== JSON.stringify(savedTags);
  const list = slot === 'tags' ? owned.filter((i) => i.type === 'tag') : owned.filter((i) => i.type === 'cosmetic' && i.slot === slot);
  return html`<div class="col gap16" style="max-width:720px">
    <h1 class="page-title" style="margin:0">הפריטים שלי</h1>
    <${TryOn} uid=${uid} override=${Object.fromEntries(SLOTS.map(([s]) => [s, equip[s] || null]))}/>
    ${tags.length > 0 && html`<div class="row wrap gap4">${tags.map((t) => { const x = owned.find((i) => i.id === t); return x && html`<${Tag} text=${x.name} color=${x.color}/>`; })}</div>`}
    <${Chips} items=${[...CHIP_SLOTS, { value: 'tags', label: 'תגיות' }]} value=${slot} onChange=${setSlot}/>
    ${list.length === 0 ? html`<${EmptyState} title="אין לך פריטים מהסוג הזה" action=${html`<${Button} kind="tinted" onClick=${() => navigate('/store')}>לחנות</${Button}>`}/>`
    : slot === 'tags' ? html`<div class="list">${list.map((t) => { const i = tags.indexOf(t.id); return html`<div class="lrow"><${Tag} text=${t.name} color=${t.color}/><span class="grow"/>
        ${i >= 0 && html`<span class="badge brand num">${i + 1}</span>`}
        <${Switch} on=${i >= 0} label=${t.name} disabled=${i < 0 && tags.length >= 3} onChange=${(v) => setTags(v ? [...tags, t.id] : tags.filter((x) => x !== t.id))}/></div>`; })}
        <div class="lrow t-foot sec">אפשר לבחור עד 3 תגיות</div></div>`
    : html`<div class="tile-grid">${[{ id: null, name: 'ברירת מחדל' }, ...list].map((it) => html`<button class=${cx('store-tile', (equip[slot] || null) === it.id && 'on')} onClick=${() => setEquip({ ...equip, [slot]: it.id })}>
        ${it.id ? html`<${ItemPreview} it=${it}/>` : html`<div class="store-prev"><${Icon} name="circle-off" size=${32} cls="muted"/></div>`}<span class="t-label">${it.name}</span></button>`)}</div>`}
    <div class="row"><${Button} kind="primary" disabled=${!dirty} onClick=${() => act(() => bus.ask('store.saveEquip', { actor: uid, equip, tags }), 'נשמר')}>שמירה</${Button}>
      <${Button} kind="ghost" disabled=${!dirty} onClick=${() => { setEquip({ ...saved }); setTags(savedTags); }}>ביטול</${Button}></div>
  </div>`;
}

/* ---------- הרכישות שלי ---------- */
function Purchases() {
  const uid = me();
  const list = bus.read('store.purchases', uid);
  return html`<div class="col gap12"><h1 class="page-title" style="margin:0">הרכישות שלי</h1>
    ${list.length === 0 ? html`<${EmptyState} title="עוד לא קנית כלום"/>` : html`<div class="list">${list.map((p) => html`<div class="lrow" key=${p.id}>
      <${Icon} name=${p.kind === 'request' ? 'gift' : p.kind === 'award' ? 'award' : 'shopping-bag'} size=${20} cls="sec"/>
      <div class="col gap4 grow"><span class="t-label">${p.itemName}</span><span class="t-foot sec">${fmtDate(p.at)}${p.kind === 'award' ? ' · הוענק' : ''}${p.note ? ' · ' + p.note : ''}</span>
        ${p.history[p.history.length - 1].reason && html`<span class="t-foot sec">${p.history[p.history.length - 1].reason}</span>`}</div>
      <${Badge} text=${p.kind === 'digital' && p.state === 'completed' ? 'נקנה' : STATE_HE[p.state]} kind=${['approved', 'delivered', 'completed'].includes(p.state) ? 'success' : p.state === 'rejected' ? 'danger' : ''}/>
      ${p.price > 0 && html`<span class="t-foot num">${p.price}</span>`}
      ${p.state === 'requested' && html`<${Button} size="xs" kind="secondary" onClick=${async () => { if (await confirm({ title: 'ביטול בקשה', text: p.itemName, ok: 'ביטול בקשה', danger: true })) act(() => bus.ask('store.cancelRequest', { actor: uid, purchaseId: p.id }), 'הבקשה בוטלה'); }}>ביטול בקשה</${Button}>`}
    </div>`)}</div>`}</div>`;
}

/* ---------- profile widgets ---------- */
function awardSheet(target, kind) {
  const a = A();
  const items = bus.read('store.items').filter((i) => (kind === 'tag' ? i.type === 'tag' : i.type === 'cosmetic') && !bus.read('store.ownsItem', target, i.id));
  const manager = a.isAdmin || a.isMentor;
  const st = { item: null, reason: '', newText: '', color: 'p:4', mode: 'existing' };
  const Body = ({ close }) => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const set = (k) => (v) => setF({ ...f, [k]: v });
    return html`<div class="col gap12">
      ${!manager && html`<${Seg} full value=${f.mode} onChange=${set('mode')} options=${[{ value: 'existing', label: 'תגית קיימת' }, { value: 'new', label: 'הצעת תגית חדשה' }]}/>`}
      ${f.mode === 'existing' ? html`<div class="col gap4" style="max-height:260px;overflow:auto">${items.length === 0 ? html`<p class="t-foot sec">אין פריטים להענקה</p>` : items.map((i) => html`<button class=${cx('menu-item', f.item === i.id && 'kbd')} onClick=${() => set('item')(i.id)}>
          ${i.type === 'tag' ? html`<${Tag} text=${i.name} color=${i.color}/>` : html`<span>${i.name}</span>`}<span class="grow"/>${f.item === i.id && html`<${Icon} name="check" size=${18}/>`}</button>`)}</div>`
      : html`<div class="row gap8"><input class="input grow" maxlength="24" placeholder="טקסט התגית" value=${f.newText} onInput=${(e) => set('newText')(e.target.value)}/>
          <button class="swatch" style=${`width:48px;height:48px;background:${PRESETS[parseInt(f.color.slice(2)) - 1].hex}`} aria-label="צבע" onClick=${(e) => pickColor(e.currentTarget, { current: f.color, onPick: set('color') })}/></div>
          ${f.newText && html`<${Tag} text=${f.newText} color=${f.color}/>`}`}
      <${Field} label="סיבה" hint=${`${f.reason.length}/140`}><input class="input" maxlength="140" value=${f.reason} onInput=${(e) => set('reason')(e.target.value)}/></${Field}>
      <${Button} kind="primary" disabled=${f.reason.trim().length < 3 || (f.mode === 'existing' ? !f.item : !f.newText.trim())} onClick=${() => {
        const r = manager ? act(() => bus.ask('store.award', { actor: me(), uid: target, itemId: f.item, reason: f.reason }))
          : act(() => bus.ask('store.proposeTag', { actor: me(), uid: target, tagId: f.mode === 'existing' ? f.item : null, newTag: f.mode === 'new' ? { text: f.newText, color: f.color } : null, reason: f.reason }));
        if (r !== undefined) { toast(manager ? 'הוענק' : 'ההצעה נשלחה למנטורים'); close(); }
      }}>${manager ? 'הענקה' : 'שליחה לאישור'}</${Button}></div>`;
  };
  sheet(kind === 'tag' ? 'הענק תגית' : 'הענק פריט', (close) => html`<${Body} close=${close}/>`);
}
addWidget('store.profileActions', ({ viewer, target }) => {
  const a = bus.read('users.actor', viewer);
  const t = bus.read('users.actor', target);
  if (!a || a.readOnly || !t || t.noRole) return null;
  const manager = a.isAdmin || a.isMentor;
  const canPropose = (a.isCaptain || (a.isLead && a.team === t.team));
  return html`${(manager || canPropose) && html`<${Button} kind="tinted" size="sm" icon="tag" onClick=${() => awardSheet(target, 'tag')}>הענק תגית</${Button}>`}
    ${manager && html`<${Button} kind="tinted" size="sm" icon="gift" onClick=${() => awardSheet(target, 'item')}>הענק פריט</${Button}>`}
    ${a.isMentor && (bus.read('store.ownedTags', target) || []).length > 0 && html`<${Button} kind="ghost" size="sm" onClick=${(e) => actionSheet('הסרת תגית', bus.read('store.ownedTags', target).map((tg) => ({ label: tg.text, icon: 'x', onClick: async () => { if (await confirm({ title: 'הסרת תגית', text: `התגית "${tg.text}" תוסר (תגית שנקנתה תוחזר במטבעות).`, ok: 'הסרה', danger: true })) act(() => bus.ask('store.removeTag', { actor: viewer, uid: target, tagId: tg.id }), 'התגית הוסרה'); } })), e.currentTarget)}>הסרת תגית</${Button}>`}`;
});
addWidget('store.myItemsCard', ({ uid }) => {
  const owned = bus.read('store.ownedItems', uid);
  return html`<${Card} title="הפריטים שלי" icon="shirt" action=${html`<${Button} kind="tinted" size="sm" onClick=${() => navigate('/store/my-items')}>עריכה</${Button}>`}>
    <p class="t-foot sec">${owned.length ? `${owned.length} פריטים ותגיות בבעלותך` : 'עוד אין לך פריטים'}</p></${Card}>`;
});
addWidget('store.wishlistCard', ({ viewer, target }) => {
  const a = bus.read('users.actor', viewer);
  const own = viewer === target;
  if (!own && !(a && (a.isAdmin || a.isMentor))) return null;
  const list = bus.read('store.wishlist', target);
  if (!own && !list.length) return null;
  return html`<${Card} title="רשימת משאלות" icon="heart">${list.length === 0 ? html`<p class="t-foot sec">לבו פריטים בחנות כדי להוסיף אותם לכאן</p>`
    : html`<div class="list">${list.map((it) => html`<div class="lrow"><span class="t-label grow">${it.name}</span><${CoinChip} n=${it.price} size="sm"/>
      ${!own && (it.type === 'tag' || it.type === 'cosmetic') && html`<${Button} size="xs" kind="tinted" onClick=${async () => {
        const r = await promptText({ title: `הענקת ${it.name}`, label: 'סיבה', min: 3, max: 140, multiline: false });
        if (r) act(() => bus.ask('store.award', { actor: viewer, uid: target, itemId: it.id, reason: r }), 'הוענק');
      }}>הענקה</${Button}>`}</div>`)}</div>`}</${Card}>`;
});

/* ---------- management ---------- */
function ItemsMgmt() {
  const a = A();
  const all = bus.read('store.items');
  const cols = bus.read('store.collections');
  const colOpts = [{ value: null, label: 'עוד (ללא אוסף)' }, ...cols.map((c) => ({ value: c.id, label: c.name }))];
  const cos = all.filter((i) => i.type === 'cosmetic');
  const created = all.filter((i) => ['tag', 'prize', 'privilege'].includes(i.type) && i.approval !== 'rejected');
  const freeze = all.find((i) => i.type === 'freeze');
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return html`<div class="col gap16">
    <${Card} border title="הקפאת רצף"><div class="row gap8"><span class="t-foot sec grow">מחיר</span><input class="input num" style="width:120px" type="number" min="0" value=${freeze.price}
      onChange=${(e) => act(() => bus.ask('store.setFreezePrice', { actor: me(), price: Number(e.target.value) }), 'נשמר')}/></div></${Card}>
    <${Card} border title="קוסמטיקה (מוגדרת בקוד)">${cos.length === 0 ? html`<p class="t-foot sec">אין פריטים קוסמטיים</p>` : html`<div class="col gap12">${cos.map((c) => html`<div class="subtle-box col gap8" key=${c.id}>
      <div class="row gap8"><span class="t-label grow">${c.name}</span>${c.demo && html`<${Badge} text="דוגמה"/>`}<${Badge} text=${SLOT_HE[c.slot]}/></div>
      <div class="row wrap gap8"><label class="col gap4 t-foot">מחיר<input class="input num" style="width:100px" type="number" min="0" value=${c.price} onChange=${(e) => act(() => bus.ask('store.setCosmetic', { actor: me(), id: c.id, patch: { price: Number(e.target.value) } }), 'נשמר')}/></label>
        <label class="col gap4 t-foot">מלאי<input class="input num" style="width:100px" type="number" min="0" placeholder="∞" value=${c.stock ?? ''} onChange=${(e) => act(() => bus.ask('store.setCosmetic', { actor: me(), id: c.id, patch: { stock: num(e.target.value) } }), 'נשמר')}/></label>
        <label class="col gap4 t-foot" style="min-width:160px">אוסף<${MenuSelect} value=${c.collection} options=${colOpts} onChange=${(v) => act(() => bus.ask('store.setCosmetic', { actor: me(), id: c.id, patch: { collection: v } }))}/></label>
        <label class="col gap4 t-foot">במכירה<${Switch} on=${c.visible} label="במכירה" onChange=${(v) => act(() => bus.ask('store.setCosmetic', { actor: me(), id: c.id, patch: { visible: v } }))}/></label></div></div>`)}</div>`}</${Card}>
    <div class="row between"><h3 class="t-title3">פריטים שנוצרו באפליקציה</h3><${Button} kind="tinted" size="sm" onClick=${() => itemForm(null)}>+ פריט חדש</${Button}></div>
    <div class="list">${created.map((i) => html`<div class="lrow" key=${i.id}>${i.type === 'tag' ? html`<${Tag} text=${i.name} color=${i.color}/>` : html`<span class="t-label">${i.name}</span>`}
      <span class="grow"/>${i.visibleTo && html`<${TeamBadge} teamId=${i.visibleTo}/>`}${i.hidden && html`<${Badge} text="מוסתר"/>`}${!i.forSale && html`<${Badge} text="הענקה בלבד"/>`}${i.approval === 'pending' && html`<${Badge} text="ממתין לאישור"/>`}
      <span class="t-foot num">${i.price}</span>
      <${IconButton} small icon="ellipsis" label="פעולות" onClick=${(e) => actionSheet(i.name, [
        { icon: 'pencil', label: 'עריכה', onClick: () => itemForm(i) },
        { icon: i.hidden ? 'eye' : 'eye-off', label: i.hidden ? 'הצגה' : 'הסתרה', onClick: () => act(() => bus.ask('store.setItemFlags', { actor: me(), id: i.id, hidden: !i.hidden })) },
        { icon: 'trash-2', label: 'מחיקה', danger: true, onClick: async () => { if (await confirm({ title: `מחיקת ${i.name}`, text: 'אפשר למחוק רק פריט שאף אחד לא קנה או קיבל.', ok: 'מחיקה', danger: true })) act(() => bus.ask('store.deleteItem', { actor: me(), id: i.id }), 'נמחק'); } },
      ], e.currentTarget)}/></div>`)}</div></div>`;
}
function itemForm(item, teamMode) {
  const a = A();
  const st = item ? { ...item, stock: item.stock ?? '', limit: item.limit ?? '' } : { type: 'tag', name: '', desc: '', color: 'p:4', price: 50, stock: '', limit: '', visibleTo: teamMode ? (a.isLead && !a.isCaptain ? a.team : null) : null, forSale: true, collection: null, image: null };
  const Body = () => {
    const [f, setF] = useState(st); Object.assign(st, f);
    const set = (k) => (v) => setF({ ...f, [k]: v });
    const fileRef = useRef();
    const teams = bus.read('users.mainTeams');
    return html`<div class="col gap12">
      <${Field} label="סוג"><${Seg} full value=${f.type} onChange=${set('type')} options=${[{ value: 'tag', label: 'תגית' }, { value: 'prize', label: 'פרס' }, { value: 'privilege', label: 'זכות' }]}/></${Field}>
      <${Field} label=${`שם (עד ${f.type === 'tag' ? 24 : 40})`}><input class="input" maxlength=${f.type === 'tag' ? 24 : 40} value=${f.name} onInput=${(e) => set('name')(e.target.value)}/></${Field}>
      <${Field} label="תיאור (עד 300)"><textarea class="textarea" maxlength="300" value=${f.desc} onInput=${(e) => set('desc')(e.target.value)}/></${Field}>
      ${f.type === 'tag' ? html`<${Field} label="צבע"><div class="row gap8"><button class="swatch" style=${`background:${PRESETS[parseInt((f.color || 'p:4').slice(2)) - 1].hex}`} aria-label="צבע" onClick=${(e) => pickColor(e.currentTarget, { current: f.color, onPick: set('color') })}/>${f.name && html`<${Tag} text=${f.name} color=${f.color}/>`}</div></${Field}>`
        : html`<${Field} label="תמונה (עד 5 MB)"><div class="row gap8"><${Button} size="sm" kind="tinted" icon="upload" onClick=${() => fileRef.current.click()}>${f.image ? 'החלפת תמונה' : 'העלאת תמונה'}</${Button}>${f.image && html`<span class="t-foot sec">הועלתה</span>`}</div>
          <input ref=${fileRef} type="file" accept="image/*" class="hide" onChange=${async (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) return toast('עד 5 MB'); const id = await img.put(file); set('image')(id); }}/></${Field}>`}
      <div class="two-col"><${Field} label="מחיר"><input class="input num" type="number" min="0" value=${f.price} onInput=${(e) => set('price')(e.target.value)}/></${Field}>
        <${Field} label="מלאי (ריק = ללא הגבלה)"><input class="input num" type="number" min="0" value=${f.stock} onInput=${(e) => set('stock')(e.target.value)}/></${Field}>
        ${f.type !== 'tag' && html`<${Field} label="מגבלה לאדם"><input class="input num" type="number" min="1" value=${f.limit} onInput=${(e) => set('limit')(e.target.value)}/></${Field}>`}
        <${Field} label="גלוי ל"><${MenuSelect} value=${f.visibleTo} disabled=${teamMode && a.isLead && !a.isCaptain} options=${[...(teamMode ? [] : [{ value: null, label: 'כולם' }]), ...teams.map((t) => ({ value: t.id, label: 'רק ' + t.name }))]} onChange=${set('visibleTo')}/></${Field}>
        ${!teamMode && html`<${Field} label="אוסף"><${MenuSelect} value=${f.collection} options=${[{ value: null, label: 'ללא' }, ...bus.read('store.collections').map((c) => ({ value: c.id, label: c.name }))]} onChange=${set('collection')}/></${Field}>`}</div>
      <${SwitchRow} label="למכירה" sub="כבוי = הענקה בלבד" on=${f.forSale} onChange=${set('forSale')}/>
      ${teamMode && html`<p class="t-foot sec">פרס צוות עולה לחנות אחרי אישור מנטור/ית.</p>`}</div>`;
  };
  sheet(item ? 'עריכת פריט' : teamMode ? 'פרס צוות חדש' : 'פריט חדש', () => html`<${Body}/>`, {
    foot: (c) => html`<${Button} kind="primary" full onClick=${() => {
      const fields = { type: st.type, name: st.name, desc: st.desc, color: st.type === 'tag' ? st.color : null, image: st.type !== 'tag' ? st.image : null, price: Number(st.price) || 0,
        stock: st.stock === '' ? null : Number(st.stock), limit: st.type === 'tag' || st.limit === '' ? null : Number(st.limit), visibleTo: st.visibleTo || null, forSale: st.forSale, collection: st.collection || null };
      if (act(() => bus.ask('store.saveItem', { actor: me(), id: item && item.id, fields }))) { c(); toast(teamMode ? 'נשלח לאישור' : 'נשמר'); }
    }}>שמירה</${Button}>`,
  });
}
function Collections() {
  const [list, setList] = useState(bus.read('store.collections').map((c) => ({ ...c })));
  const saved = bus.read('store.collections');
  const items = bus.read('store.items').filter((i) => i.type === 'cosmetic' || i.type === 'tag' || i.type === 'prize' || i.type === 'privilege');
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  return html`<div class="col gap12">
    <div class="list" data-drop-list="cols:1">${list.map((c, i) => html`<div class="lrow" data-drag-item key=${c.id || i}>
      <span class="drag-handle" onPointerDown=${(e) => startDrag(e, { group: 'cols', listId: '1', onDrop: ({ fromIndex, toIndex }) => setList(moveIn(list, fromIndex, toIndex)) })}><${Icon} name="grip-vertical" size=${20}/></span>
      <input class="input grow" value=${c.name} maxlength="30" onInput=${(e) => setList(list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}/>
      <span class="t-foot sec num">${items.filter((it) => it.collection === c.id).length}</span>
      <${IconButton} small icon="trash-2" label="מחיקה" onClick=${async () => { if (await confirm({ title: `מחיקת ${c.name}`, text: 'הפריטים שבאוסף יעברו ל"עוד".', ok: 'מחיקה', danger: true })) setList(list.filter((_, j) => j !== i)); }}/></div>`)}</div>
    <div class="row"><${Button} kind="tinted" size="sm" onClick=${() => setList([...list, { id: null, name: 'אוסף חדש' }])}>+ אוסף</${Button}>
      <${Button} kind="primary" size="sm" disabled=${!dirty} onClick=${() => act(() => bus.ask('store.saveCollections', { actor: me(), list }), 'נשמר')}>שמירה</${Button}></div>
    ${saved.map((c) => html`<${Card} border title=${c.name}><div class="col gap4">${items.map((it) => html`<label class="check-row" style="min-height:36px"><${Switch} on=${it.collection === c.id} label=${it.name}
      onChange=${(v) => act(() => bus.ask('store.setItemCollection', { actor: me(), id: it.id, collection: v ? c.id : null }))}/><span class="t-foot">${it.name}</span></label>`)}</div></${Card}>`)}
  </div>`;
}
function Requests() {
  const a = A();
  const [state, setState] = useState('requested');
  const [team, setTeam] = useState('');
  const hl = route().query.id;
  const list = bus.read('store.allPurchases').filter((p) => p.kind === 'request' && bus.read('store.canHandleRequest', me(), p.id) && (state === 'all' || p.state === state) && (!team || p.team === team)).reverse();
  const teams = bus.read('users.mainTeams');
  return html`<div class="col gap12">
    <${Chips} value=${state} onChange=${setState} items=${[{ value: 'requested', label: 'ממתינות' }, { value: 'approved', label: 'אושרו' }, { value: 'delivered', label: 'נמסרו' }, { value: 'all', label: 'הכל' }]}/>
    <${Chips} value=${team} onChange=${setTeam} items=${[{ value: '', label: 'כל הצוותים' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]}/>
    ${list.length === 0 ? html`<${EmptyState} title="אין בקשות" sticker=${false}/>` : html`<div class="list">${list.map((p) => html`<div class="lrow" key=${p.id} style=${hl === p.id ? 'background:var(--brand-subtle)' : ''}>
      <${Avatar} uid=${p.uid} size=${32}/><div class="col gap4 grow"><span class="t-label">${p.itemName}</span><span class="t-foot sec"><${PersonName} uid=${p.uid} rank=${false}/> · ${relTime(p.at)} · <span class="num">${p.price}</span>${p.note ? ' · ' + p.note : ''}</span></div>
      <${Badge} text=${STATE_HE[p.state]}/>
      ${p.state === 'requested' && html`<${Button} size="xs" kind="primary" onClick=${() => act(() => bus.ask('store.decide', { actor: me(), purchaseId: p.id, approve: true }), 'אושר')}>אישור</${Button}>
        <${Button} size="xs" kind="secondary" onClick=${async () => { const r = await promptText({ title: 'דחיית בקשה', label: 'סיבה', min: 3, max: 140 }); if (r) act(() => bus.ask('store.decide', { actor: me(), purchaseId: p.id, approve: false, reason: r }), 'נדחה'); }}>דחייה</${Button}>`}
      ${p.state === 'approved' && html`<${Button} size="xs" kind="primary" onClick=${() => act(() => bus.ask('store.deliver', { actor: me(), purchaseId: p.id }), 'סומן כנמסר')}>סומן כנמסר</${Button}>
        <${Button} size="xs" kind="ghost" onClick=${async () => { const r = await promptText({ title: 'ביטול בקשה מאושרת', text: 'המטבעות יוחזרו לקונה.', label: 'סיבה', min: 3, max: 140 }); if (r) act(() => bus.ask('store.cancelApproved', { actor: me(), purchaseId: p.id, reason: r }), 'בוטל והוחזר'); }}>ביטול</${Button}>`}
    </div>`)}</div>`}</div>`;
}
function Waiting() {
  const items = bus.read('store.items').filter((i) => (i.approval === 'pending' || i.pendingEdit) && !i.deleted);
  const props = bus.read('store.proposals').filter((p) => p.state === 'pending');
  if (!items.length && !props.length) return html`<${EmptyState} title="אין מה לאשר" sticker=${false}/>`;
  return html`<div class="col gap12">
    ${items.map((i) => { const v = i.pendingEdit ? { ...i, ...i.pendingEdit } : i; return html`<div class="card b col gap8" key=${i.id}>
      <div class="row gap8"><span class="t-label grow">${v.name}</span><${TeamBadge} teamId=${v.visibleTo}/>${i.pendingEdit && html`<${Badge} text="עריכה"/>`}</div>
      <span class="t-foot sec">${v.desc}</span><span class="t-foot sec">הוצע על ידי <${PersonName} uid=${i.pendingEdit ? i.pendingEdit.by : i.createdBy} rank=${false}/> · מחיר מוצע ${v.price}</span>
      <div class="row"><${Button} size="sm" kind="primary" onClick=${async () => { const p = await promptText({ title: 'אישור פרס צוות', label: 'מחיר', value: String(v.price), multiline: false, max: 6 }); if (p !== null) act(() => bus.ask('store.decideItem', { actor: me(), id: i.id, approve: true, price: Number(p) }), 'אושר'); }}>אישור</${Button}>
        <${Button} size="sm" kind="secondary" onClick=${() => act(() => bus.ask('store.decideItem', { actor: me(), id: i.id, approve: false }), 'נדחה')}>דחייה</${Button}></div></div>`; })}
    ${props.map((p) => { const tag = p.tagId ? bus.read('store.item', p.tagId) : null; return html`<div class="card b col gap8" key=${p.id}>
      <div class="row gap8 wrap"><span class="t-label">הענקת תגית ל</span><${PersonName} uid=${p.uid}/>${tag ? html`<${Tag} text=${tag.name} color=${tag.color}/>` : html`<${Tag} text=${p.newTag.text} color=${p.newTag.color}/><${Badge} text="תגית חדשה"/>`}</div>
      <span class="t-foot sec">"${p.reason}" · הוצע על ידי <${PersonName} uid=${p.proposer} rank=${false}/></span>
      <div class="row"><${Button} size="sm" kind="primary" onClick=${() => act(() => bus.ask('store.decideProposal', { actor: me(), proposalId: p.id, approve: true }), 'אושר והוענק')}>אישור</${Button}>
        <${Button} size="sm" kind="secondary" onClick=${() => act(() => bus.ask('store.decideProposal', { actor: me(), proposalId: p.id, approve: false }), 'נדחה')}>דחייה</${Button}></div></div>`; })}</div>`;
}
function TeamRewards() {
  const a = A();
  const list = bus.read('store.items').filter((i) => i.visibleTo && (a.isCaptain || i.visibleTo === a.team) && i.approval !== 'rejected');
  return html`<div class="col gap12"><div><${Button} kind="tinted" size="sm" onClick=${() => itemForm(null, true)}>+ פרס צוות</${Button}></div>
    ${list.length === 0 ? html`<${EmptyState} title="אין עדיין פרסי צוות" sticker=${false}/>` : html`<div class="list">${list.map((i) => html`<div class="lrow"><span class="t-label grow">${i.name}</span><${TeamBadge} teamId=${i.visibleTo}/>
      ${i.approval === 'pending' || i.pendingEdit ? html`<${Badge} text="ממתין לאישור"/>` : html`<${Badge} kind="success" text="בחנות"/>`}<span class="t-foot num">${i.price}</span>
      <${IconButton} small icon="pencil" label="עריכה" onClick=${() => itemForm(i, true)}/></div>`)}</div>`}</div>`;
}

addRoute({ path: '/store', tab: 'store', title: 'חנות', render: () => html`<${StorePage}/>` });
addRoute({ path: '/store/purchases', tab: 'store', title: 'הרכישות שלי', render: () => html`<${Purchases}/>` });
addRoute({ path: '/store/my-items', tab: 'store', title: 'הפריטים שלי', access: 'any', render: () => html`<${EquipScreen} key=${route().query.slot || ''}/>` });
addTabBadge('store', (uid) => bus.read('store.requestsToHandle', uid));
addManagement('store', 'חנות', [
  { id: 'items', title: 'פריטים', icon: 'package', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${ItemsMgmt}/>` },
  { id: 'collections', title: 'אוספים', icon: 'layers', can: (a) => a.isAdmin || a.isMentor, render: () => html`<${Collections}/>` },
  { id: 'requests', title: 'בקשות', icon: 'inbox', can: (a) => !a.readOnly && (a.isLead || a.isCaptain || a.isAdmin || a.isMentor), badge: (a) => bus.read('store.requestsToHandle', a.id), render: () => html`<${Requests}/>` },
  { id: 'waiting', title: 'ממתינים לאישור', icon: 'hourglass', can: (a) => a.isMentor, badge: () => bus.read('store.waitingApproval'), render: () => html`<${Waiting}/>` },
  { id: 'team', title: 'פרסי צוות', icon: 'users', can: (a) => !a.readOnly && (a.isLead || a.isCaptain), render: () => html`<${TeamRewards}/>` },
]);

// store tile CSS (owned by Store)
const css = document.createElement('style');
css.textContent = `.store-tile{display:flex;flex-direction:column;gap:8px;width:160px;flex:none;background:none;border:0;padding:0;text-align:start;cursor:pointer;color:inherit}
.tile-grid .store-tile{width:auto}
.store-tile.on .store-prev{box-shadow:0 0 0 2px var(--brand)}
.store-prev{aspect-ratio:1;width:100%;border-radius:var(--r-lg);background:var(--bg-subtle);display:grid;place-items:center;overflow:hidden;padding:8px;text-align:center}`;
document.head.appendChild(css);
