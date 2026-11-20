// כלי הדגמה — made-up demo people (never real students). Grades are relative to the 2026–27 school year:
// graduation 2027 = יב', 2028 = יא', 2029 = י', 2030 = ט'.
export const DEMO_PEOPLE = [
  // Mentors
  { id: 'u-mentor1', name_he: 'אורית שחר', google_name: 'Orit Shachar', google_email: 'orit.mentor@example.com', role: 'mentor', dob: '1984-03-12' },
  { id: 'u-mentor2', name_he: 'גיל רוזנטל', google_name: 'Gil Rosental', google_email: 'gil.mentor@example.com', role: 'mentor', dob: '1979-07-02' },
  // Admin + Captain, and another Captain
  { id: 'u-tamar', name_he: 'תמר אלון', google_name: 'Tamar Alon', google_email: 'tamar.alon@example.com', role: 'captain', is_admin: true, team: 'team-software', grad: 2027, dob: '2009-02-17', subs: ['sub-finance'] },
  { id: 'u-yonatan', name_he: 'יונתן כץ', google_name: 'Yonatan Katz', google_email: 'yonatan.katz@example.com', role: 'captain', team: 'team-build', grad: 2027, dob: '2009-05-30', subs: ['sub-awards'] },
  // שרטוט
  { id: 'u-maya', name_he: 'מאיה לוי', google_name: 'Maya Levi', google_email: 'maya.levi@example.com', role: 'lead', team: 'team-cad', grad: 2028, dob: '2010-01-08', subs: ['sub-media'], phone: '052-1234567' },
  { id: 'u-ido', name_he: 'עידו פרץ', google_name: 'Ido Peretz', google_email: 'ido.peretz@example.com', role: 'member', team: 'team-cad', grad: 2030, dob: '2012-04-21' },
  { id: 'u-shira', name_he: 'שירה גולן', google_name: 'Shira Golan', google_email: 'shira.golan@example.com', role: 'member', team: 'team-cad', grad: 2029, dob: '2011-09-03', subs: ['sub-community'] },
  { id: 'u-alon', name_he: 'אלון מזרחי', google_name: 'Alon Mizrahi', google_email: 'alon.mizrahi@example.com', role: 'member', team: 'team-cad', grad: 2028, dob: '2010-06-14' },
  { id: 'u-roni', name_he: 'רוני אברהם', google_name: 'Roni Avraham', google_email: 'roni.avraham@example.com', role: 'member', team: 'team-cad', grad: 2029, dob: '2011-11-27', subs: ['sub-media'] },
  { id: 'u-daniel', name_he: 'דניאל שמש', google_name: 'Daniel Shemesh', google_email: 'daniel.shemesh@example.com', role: 'member', team: 'team-cad', grad: 2030, dob: '2012-02-09' },
  // בנייה
  { id: 'u-itay', name_he: 'איתי ברק', google_name: 'Itay Barak', google_email: 'itay.barak@example.com', role: 'lead', team: 'team-build', grad: 2027, dob: '2009-08-19' },
  { id: 'u-hila', name_he: 'הילה דהן', google_name: 'Hila Dahan', google_email: 'hila.dahan@example.com', role: 'member', team: 'team-build', grad: 2030, dob: '2012-03-05' },
  { id: 'u-omer', name_he: 'עומר ביטון', google_name: 'Omer Biton', google_email: 'omer.biton@example.com', role: 'member', team: 'team-build', grad: 2029, dob: '2011-07-22', subs: ['sub-community'] },
  { id: 'u-lia', name_he: 'ליה פרידמן', google_name: 'Lia Friedman', google_email: 'lia.friedman@example.com', role: 'member', team: 'team-build', grad: 2028, dob: '2010-12-01' },
  { id: 'u-nadav', name_he: 'נדב אוחיון', google_name: 'Nadav Ohayon', google_email: 'nadav.ohayon@example.com', role: 'member', team: 'team-build', grad: 2030, dob: '2012-05-16' },
  // תוכנה
  { id: 'u-adi', name_he: 'עדי וייס', google_name: 'Adi Weiss', google_email: 'adi.weiss@example.com', role: 'lead', team: 'team-software', grad: 2028, dob: '2010-04-11', subs: ['sub-awards'] },
  { id: 'u-yoav', name_he: 'יואב קליין', google_name: 'Yoav Klein', google_email: 'yoav.klein@example.com', role: 'member', team: 'team-software', grad: 2029, dob: '2011-03-29' },
  { id: 'u-michal', name_he: 'מיכל חדד', google_name: 'Michal Hadad', google_email: 'michal.hadad@example.com', role: 'member', team: 'team-software', grad: 2030, dob: '2012-10-07', subs: ['sub-media'] },
  { id: 'u-ariel', name_he: 'אריאל סבג', google_name: 'Ariel Sabag', google_email: 'ariel.sabag@example.com', role: 'member', team: 'team-software', grad: 2027, dob: '2009-01-25' },
  { id: 'u-tal', name_he: 'טל נחום', google_name: 'Tal Nahum', google_email: 'tal.nahum@example.com', role: 'member', team: 'team-software', grad: 2029, dob: '2011-08-13' },
  { id: 'u-gilad', name_he: 'גלעד שפירא', google_name: 'Gilad Shapira', google_email: 'gilad.shapira@example.com', role: 'member', team: 'team-software', grad: 2030, dob: '2012-06-30' },
  // alumni: read-only and switched to active
  { id: 'u-noam', name_he: 'נועם רביבו', google_name: 'Noam Revivo', google_email: 'noam.revivo@example.com', role: 'member', team: 'team-build', grad: 2026, dob: '2008-02-04', alumni: true, alumni_active: false },
  { id: 'u-inbal', name_he: 'ענבל טננבאום', google_name: 'Inbal Tenenbaum', google_email: 'inbal.t@example.com', role: 'member', team: 'team-software', grad: 2026, dob: '2008-09-18', alumni: true, alumni_active: true },
  // no-role
  { id: 'u-raz', name_he: 'רז יוסף', google_name: 'Raz Yosef', google_email: 'raz.yosef@example.com', role: null, dob: '2011-12-12' },
  // pending sign-ups
  { id: 'u-shahar', name_he: 'שחר מלכה', google_name: 'Shahar Malka', google_email: 'shahar.malka@example.com', pending: true, dob: '2012-01-19' },
  { id: 'u-avigail', name_he: 'אביגיל רון', google_name: 'Avigail Ron', google_email: 'avigail.ron@example.com', pending: true, dob: '2011-05-02' },
];
