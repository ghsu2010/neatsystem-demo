// כלי הדגמה — sample cosmetics, one per slot, marked "דוגמה". Demo data only: they are registered
// into Store at boot by core/demo and are never part of systems/store/cosmetics.js (the launch list).
export const DEMO_COSMETICS = [
  { id: 'cos:demo-banner', slot: 'banner', name: 'דוגמה · באנר שקיעה', desc: 'באנר בשיפוע סגול-תכלת.', defaultPrice: 120,
    look: { style: 'background:linear-gradient(135deg,#7B4DFF,#2D9CDB)' } },
  { id: 'cos:demo-frame', slot: 'frame', name: 'דוגמה · מסגרת זהב', desc: 'מסגרת זהובה סביב התמונה.', defaultPrice: 150,
    look: { ring: 'conic-gradient(#D69E00,#FBEFC4,#D69E00,#FBEFC4,#D69E00)' } },
  { id: 'cos:demo-name', slot: 'nameColor', name: 'דוגמה · שם אוקיינוס', desc: 'שם בשיפוע נוצץ (מונפש רק בפרופיל).', defaultPrice: 250,
    look: { style: 'background-image:linear-gradient(90deg,#2D9CDB,#7B4DFF,#2D9CDB)', cls: 'anim-shimmer', animated: true } },
  { id: 'cos:demo-plate', slot: 'nameplate', name: 'דוגמה · לוחית מנטה', desc: 'רקע עדין מאחורי השם ברשימת החברים.', defaultPrice: 80,
    look: { style: 'background:linear-gradient(90deg,#CDEFE0,#D3E9F8);color:#0B0D13' } },
  { id: 'cos:demo-effect', slot: 'effect', name: 'דוגמה · נצנצים', desc: 'נצנצים שיורדים פעם אחת כשפותחים את הפרופיל.', defaultPrice: 300,
    look: { kind: 'sparkles' } },
  { id: 'cos:demo-theme', slot: 'theme', name: 'דוגמה · ערכת יער', desc: 'גוון ירוק לבאנר ולאריחי הנתונים.', defaultPrice: 100,
    look: { bannerTint: 'rgb(0 168 107 / .22)', accent: '#00A86B' } },
];
