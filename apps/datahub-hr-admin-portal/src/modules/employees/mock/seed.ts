import type { Localized } from '@datahub/shared-types';
import { DEPARTMENT_SEED, LOCATION_SEED, POSITION_SEED, SEED_HEADCOUNT } from '@/modules/organization/mock/seed';
import type {
  EmergencyContact,
  EmploymentStatus,
  EmploymentType,
  Gender,
  HistoryEventType,
  MaritalStatus,
  PersonName,
  Relationship,
} from '@/modules/employees/types/employee';

/*
 * FICTIONAL employees for the simulated backend: invented names, `.test` e-mail domains (reserved, never
 * routable), phone numbers in an unassigned "000" block, generic addresses. Generated deterministically
 * (seeded PRNG), so every run and every test sees the same people. Read only by `employeesMock.ts`.
 *
 * Per unit, the number of active/inactive employees follows the organization seed (`SEED_HEADCOUNT`), so
 * department counts, the hierarchy totals and the dashboard's headcount all agree (248 on record, 235 active).
 */

/** Reference date of the seed (absolute, so the data is identical whenever it runs). */
export const SEED_DATE = '2026-11-01';

export interface EmployeeRow {
  id: string;
  employeeNumber: string;
  name: PersonName;
  dateOfBirth: string;
  gender: Gender;
  nationality: string;
  maritalStatus: MaritalStatus;
  workEmail: string;
  personalEmail: string;
  phone: string;
  alternativePhone: string;
  address: string;
  city: string;
  country: string;
  hireDate: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
  contractStartDate: string;
  contractEndDate: string | null;
  probationEndDate: string | null;
  departmentId: string;
  positionId: string;
  locationId: string;
  managerId: string | null;
  reportingDepartmentId: string | null;
  emergencyContact: EmergencyContact;
  createdAt: string;
}

export interface HistoryRow {
  id: string;
  employeeId: string;
  type: HistoryEventType;
  date: string;
  from: Localized<string> | null;
  to: Localized<string> | null;
}

/**
 * Demo sign-in accounts → their employee record (the backend links user accounts to employees). Used to
 * scope a Department Manager's requests to their team.
 */
export const ACCOUNT_EMPLOYEE: Readonly<Record<string, string>> = {
  'usr-0001': 'emp-0006',
  'usr-0002': 'emp-0002',
  'usr-0003': 'emp-0003',
  'usr-0004': 'emp-0001',
  'usr-0005': 'emp-0025',
  'usr-0006': 'emp-0004',
  'usr-0007': 'emp-0005',
};

/* Name pools (fictional combinations) ------------------------------------------------------------------- */

type Pair = readonly [en: string, ar: string];

const MALE: readonly Pair[] = [
  ['Ahmad', 'أحمد'], ['Yazan', 'يزن'], ['Fadi', 'فادي'], ['Tariq', 'طارق'], ['Hamza', 'حمزة'], ['Laith', 'ليث'],
  ['Zaid', 'زيد'], ['Faris', 'فارس'], ['Kareem', 'كريم'], ['Mahmoud', 'محمود'], ['Bilal', 'بلال'], ['Anas', 'أنس'],
  ['Mohannad', 'مهند'], ['Rakan', 'راكان'], ['Qais', 'قيس'], ['Nabil', 'نبيل'], ['Hasan', 'حسن'], ['Majed', 'ماجد'],
  ['Ibrahim', 'إبراهيم'], ['Adnan', 'عدنان'], ['Ammar', 'عمار'], ['Firas', 'فراس'], ['Jad', 'جاد'], ['Tamer', 'تامر'],
];
const FEMALE: readonly Pair[] = [
  ['Rana', 'رنا'], ['Hala', 'هلا'], ['Sara', 'سارة'], ['Lama', 'لمى'], ['Dalia', 'داليا'], ['Rawan', 'روان'],
  ['Aya', 'آية'], ['Huda', 'هدى'], ['Mais', 'ميس'], ['Leen', 'لين'], ['Farah', 'فرح'], ['Yasmin', 'ياسمين'],
  ['Raghad', 'رغد'], ['Maram', 'مرام'], ['Jana', 'جنى'], ['Salma', 'سلمى'], ['Haya', 'هيا'], ['Tasneem', 'تسنيم'],
  ['Dina', 'دينا'], ['Rasha', 'رشا'], ['Muna', 'منى'], ['Abeer', 'عبير'], ['Nada', 'ندى'], ['Lubna', 'لبنى'],
];
const LAST: readonly Pair[] = [
  ['Khoury', 'خوري'], ['Nabulsi', 'النابلسي'], ['Qasem', 'قاسم'], ['Darwish', 'درويش'], ['Barakat', 'بركات'],
  ['Salem', 'سالم'], ['Odeh', 'عودة'], ['Tamimi', 'التميمي'], ['Abbadi', 'العبادي'], ['Khatib', 'الخطيب'],
  ['Saadi', 'السعدي'], ['Ayoub', 'أيوب'], ['Bitar', 'البيطار'], ['Halabi', 'الحلبي'], ['Sharif', 'الشريف'],
  ['Momani', 'المومني'], ['Kurdi', 'الكردي'], ['Awwad', 'عواد'], ['Hourani', 'الحوراني'], ['Shawabkeh', 'الشوابكة'],
  ['Hamad', 'حمد'], ['Zaghloul', 'زغلول'], ['Fakhoury', 'فاخوري'], ['Rousan', 'الروسان'], ['Smadi', 'الصمادي'],
];

/** Named people: department managers (organization seed `managerId`s) and the demo accounts' employees. */
const NAMED: ReadonlyArray<{ id: string; first: Pair; last: Pair; gender: Gender; departmentId: string; positionId: string; hireDate: string }> = [
  { id: 'emp-0001', first: ['Dana', 'دانا'], last: ['Yousef', 'يوسف'], gender: 'female', departmentId: 'dep-eng', positionId: 'pos-01', hireDate: '2019-03-10' },
  { id: 'emp-0002', first: ['Lina', 'لينا'], last: ['Haddad', 'حداد'], gender: 'female', departmentId: 'dep-hr-ops', positionId: 'pos-23', hireDate: '2021-02-01' },
  { id: 'emp-0003', first: ['Rami', 'رامي'], last: ['Saleh', 'صالح'], gender: 'male', departmentId: 'dep-hr', positionId: 'pos-35', hireDate: '2019-02-17' },
  { id: 'emp-0004', first: ['Maya', 'مايا'], last: ['Jaber', 'جابر'], gender: 'female', departmentId: 'dep-hr-ta', positionId: 'pos-24', hireDate: '2022-05-15' },
  { id: 'emp-0005', first: ['Khaled', 'خالد'], last: ['Mansour', 'منصور'], gender: 'male', departmentId: 'dep-fin-pay', positionId: 'pos-21', hireDate: '2020-01-19' },
  { id: 'emp-0006', first: ['Omar', 'عمر'], last: ['Khalil', 'خليل'], gender: 'male', departmentId: 'dep-it-inf', positionId: 'pos-18', hireDate: '2020-03-01' },
  { id: 'emp-0007', first: ['Nadia', 'نادية'], last: ['Fares', 'فارس'], gender: 'female', departmentId: 'dep-sales', positionId: 'pos-10', hireDate: '2019-02-10' },
  { id: 'emp-0008', first: ['Ziad', 'زياد'], last: ['Hamdan', 'حمدان'], gender: 'male', departmentId: 'dep-ops', positionId: 'pos-13', hireDate: '2019-02-10' },
  { id: 'emp-0009', first: ['Reem', 'ريم'], last: ['Shami', 'شامي'], gender: 'female', departmentId: 'dep-support', positionId: 'pos-17', hireDate: '2019-11-17' },
  { id: 'emp-0010', first: ['Basel', 'باسل'], last: ['Atieh', 'عطية'], gender: 'male', departmentId: 'dep-it', positionId: 'pos-30', hireDate: '2019-02-24' },
  { id: 'emp-0011', first: ['Sana', 'سناء'], last: ['Qudah', 'القضاة'], gender: 'female', departmentId: 'dep-fin', positionId: 'pos-32', hireDate: '2019-02-24' },
  { id: 'emp-0012', first: ['Tamer', 'تامر'], last: ['Aziz', 'عزيز'], gender: 'male', departmentId: 'dep-mkt', positionId: 'pos-34', hireDate: '2020-03-08' },
  { id: 'emp-0013', first: ['Laila', 'ليلى'], last: ['Masri', 'المصري'], gender: 'female', departmentId: 'dep-eng-swd', positionId: 'pos-02', hireDate: '2019-04-07' },
  { id: 'emp-0014', first: ['Hani', 'هاني'], last: ['Awad', 'عوض'], gender: 'male', departmentId: 'dep-eng-mob', positionId: 'pos-05', hireDate: '2021-05-23' },
  { id: 'emp-0015', first: ['Nour', 'نور'], last: ['Haddadin', 'حدادين'], gender: 'female', departmentId: 'dep-eng-qa', positionId: 'pos-07', hireDate: '2019-09-08' },
  { id: 'emp-0016', first: ['Yousef', 'يوسف'], last: ['Rahhal', 'رحال'], gender: 'male', departmentId: 'dep-eng-data', positionId: 'pos-08', hireDate: '2022-01-16' },
  { id: 'emp-0017', first: ['Rania', 'رانيا'], last: ['Saad', 'سعد'], gender: 'female', departmentId: 'dep-sales-ent', positionId: 'pos-11', hireDate: '2020-04-26' },
  { id: 'emp-0018', first: ['Majd', 'مجد'], last: ['Zoubi', 'الزعبي'], gender: 'male', departmentId: 'dep-ops-fac', positionId: 'pos-14', hireDate: '2019-06-30' },
  { id: 'emp-0019', first: ['Ola', 'علا'], last: ['Batayneh', 'البطاينة'], gender: 'female', departmentId: 'dep-ops-log', positionId: 'pos-15', hireDate: '2020-09-06' },
  { id: 'emp-0020', first: ['Samer', 'سامر'], last: ['Hijazi', 'حجازي'], gender: 'male', departmentId: 'dep-it-inf', positionId: 'pos-18', hireDate: '2020-02-23' },
  { id: 'emp-0021', first: ['Dima', 'ديما'], last: ['Tal', 'التل'], gender: 'female', departmentId: 'dep-it-sd', positionId: 'pos-19', hireDate: '2020-02-23' },
  { id: 'emp-0022', first: ['Wael', 'وائل'], last: ['Rifai', 'الرفاعي'], gender: 'male', departmentId: 'dep-fin-acc', positionId: 'pos-20', hireDate: '2019-02-24' },
  { id: 'emp-0023', first: ['Hiba', 'هبة'], last: ['Sabbagh', 'الصباغ'], gender: 'female', departmentId: 'dep-hr-ops', positionId: 'pos-23', hireDate: '2021-01-24' },
  { id: 'emp-0024', first: ['Tala', 'تالا'], last: ['Nasser', 'ناصر'], gender: 'female', departmentId: 'dep-hr-ta', positionId: 'pos-24', hireDate: '2021-01-24' },
  { id: 'emp-0025', first: ['Sami', 'سامي'], last: ['Odeh', 'عودة'], gender: 'male', departmentId: 'dep-eng-swd', positionId: 'pos-03', hireDate: '2023-08-13' },
];

/* Helpers ---------------------------------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => toDate(Date.parse(`${iso}T00:00:00Z`) + days * DAY);
const between = (random: () => number, from: string, to: string) => {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return toDate(a + Math.floor(random() * Math.max(1, (b - a) / DAY)) * DAY);
};
const pick = <T,>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
const weighted = <T,>(random: () => number, entries: ReadonlyArray<readonly [T, number]>): T => {
  let r = random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [value, weight] of entries) if ((r -= weight) < 0) return value;
  return entries[0]![0];
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const phone = (random: () => number) => `+962 7${7 + Math.floor(random() * 3)} 000 ${String(Math.floor(random() * 10000)).padStart(4, '0')}`;
const HEAD_LEVELS = new Set(['manager', 'director', 'executive', 'lead']);

/* Generation ------------------------------------------------------------------------------------------- */

function generate() {
  const random = mulberry32(20_261_101);
  const employees: EmployeeRow[] = [];
  const usedEmails = new Set<string>();
  const usedNames = new Set<string>();
  const departmentById = new Map(DEPARTMENT_SEED.map((d) => [d.id, d]));

  const location = (status: EmploymentStatus, departmentId: string) => {
    if (status === 'inactive' && random() < 0.5) return 'loc-06';
    if (departmentId === 'dep-ops-log') return weighted(random, [['loc-03', 6], ['loc-01', 4]] as const);
    return weighted(random, [['loc-01', 70], ['loc-02', 8], ['loc-03', 6], ['loc-04', 9], ['loc-05', 7]] as const);
  };
  const cityOf = (locationId: string) => LOCATION_SEED.find((l) => l.id === locationId)!;

  const make = (id: string, first: Pair, last: Pair, gender: Gender, departmentId: string, positionId: string, status: EmploymentStatus, hireDate?: string): EmployeeRow => {
    const department = departmentById.get(departmentId)!;
    const hire = hireDate ?? between(random, department.createdAt.slice(0, 10), addDays(SEED_DATE, -20));
    const type: EmploymentType = hireDate ? 'full-time' : weighted(random, [['full-time', 80], ['part-time', 6], ['contract', 8], ['temporary', 3], ['intern', 3]] as const);
    const fixedTerm = type === 'contract' || type === 'temporary' || type === 'intern';
    const locationId = location(status, departmentId);
    const place = cityOf(locationId);
    let email = `${slug(first[0])}.${slug(last[0])}@staff.datahubhr.test`;
    for (let n = 2; usedEmails.has(email); n++) email = `${slug(first[0])}.${slug(last[0])}${n}@staff.datahubhr.test`;
    usedEmails.add(email);
    const hiredRecently = Date.parse(hire) > Date.parse(addDays(SEED_DATE, -180));
    const ageAtHire = 21 + Math.floor(random() * 22);
    const contactFirst = pick(random, random() < 0.5 ? MALE : FEMALE);
    return {
      id,
      employeeNumber: `EMP-${id.slice(4)}`,
      name: { first: { en: first[0], ar: first[1] }, last: { en: last[0], ar: last[1] } },
      dateOfBirth: addDays(hire, -Math.round((ageAtHire + random()) * 365.25)),
      gender,
      nationality: weighted(random, [['JO', 76], ['PS', 6], ['EG', 5], ['LB', 4], ['IQ', 3], ['SA', 3], ['AE', 3]] as const),
      maritalStatus: weighted(random, [['single', 40], ['married', 52], ['divorced', 6], ['widowed', 2]] as const),
      workEmail: email,
      personalEmail: `${slug(first[0])}${slug(last[0])}${Math.floor(random() * 90) + 10}@mail.example`,
      phone: phone(random),
      alternativePhone: random() < 0.4 ? phone(random) : '',
      address: `Building ${1 + Math.floor(random() * 80)}, Street ${1 + Math.floor(random() * 40)}`,
      city: place.city,
      country: place.country,
      hireDate: hire,
      employmentType: type,
      status,
      contractStartDate: hire,
      contractEndDate: fixedTerm ? addDays(hire, type === 'intern' ? 180 : 365 * (1 + Math.floor(random() * 2))) : null,
      probationEndDate: hiredRecently ? addDays(hire, 90) : null,
      departmentId,
      positionId,
      locationId,
      managerId: null, // set below once every unit's people exist
      reportingDepartmentId: null,
      emergencyContact: {
        name: `${contactFirst[0]} ${last[0]}`,
        relationship: pick(random, ['spouse', 'parent', 'sibling', 'sibling', 'parent', 'relative'] as Relationship[]),
        phone: phone(random),
        alternativePhone: '',
      },
      createdAt: `${hire}T08:00:00.000Z`,
    };
  };

  for (const n of NAMED) {
    usedNames.add(`${n.first[0]} ${n.last[0]}`);
    employees.push(make(n.id, n.first, n.last, n.gender, n.departmentId, n.positionId, 'active', n.hireDate));
  }

  let next = NAMED.length + 1;
  const freshName = (): { first: Pair; last: Pair; gender: Gender } => {
    for (;;) {
      const gender: Gender = random() < 0.5 ? 'male' : 'female';
      const first = pick(random, gender === 'male' ? MALE : FEMALE);
      const last = pick(random, LAST);
      const key = `${first[0]} ${last[0]}`;
      if (!usedNames.has(key)) {
        usedNames.add(key);
        return { first, last, gender };
      }
    }
  };

  for (const unit of DEPARTMENT_SEED) {
    const target = SEED_HEADCOUNT[unit.id] ?? { active: 0, inactive: 0 };
    const unitPositions = POSITION_SEED.filter((p) => p.departmentId === unit.id);
    const staff = unitPositions.filter((p) => p.status === 'active' && !HEAD_LEVELS.has(p.level));
    const anyStaff = unitPositions.filter((p) => !HEAD_LEVELS.has(p.level));
    const named = employees.filter((e) => e.departmentId === unit.id).length;
    for (let i = named; i < target.active; i++) {
      const person = freshName();
      employees.push(make(`emp-${String(next++).padStart(4, '0')}`, person.first, person.last, person.gender, unit.id, pick(random, staff).id, 'active'));
    }
    for (let i = 0; i < target.inactive; i++) {
      const person = freshName();
      employees.push(make(`emp-${String(next++).padStart(4, '0')}`, person.first, person.last, person.gender, unit.id, pick(random, anyStaff).id, 'inactive'));
    }
  }

  // Direct manager: the unit's manager, or (for the manager, or a unit without one) the nearest manager above.
  const unitManager = (departmentId: string | null, self: string): string | null => {
    for (let d = departmentId ? departmentById.get(departmentId) : undefined; d; d = d.parentId ? departmentById.get(d.parentId) : undefined) {
      if (d.managerId && d.managerId !== self) return d.managerId;
    }
    return null;
  };
  for (const e of employees) e.managerId = unitManager(e.departmentId, e.id);

  return employees;
}

/* Documents and history (derived from the employees, deterministic) ------------------------------------- */

function generateHistory(employees: readonly EmployeeRow[]): HistoryRow[] {
  const random = mulberry32(9_001);
  const rows: HistoryRow[] = [];
  let n = 1;
  const add = (employeeId: string, type: HistoryEventType, date: string, from: Localized<string> | null, to: Localized<string> | null) =>
    rows.push({ id: `hist-${String(n++).padStart(5, '0')}`, employeeId, type, date, from, to });
  const department = (id: string) => DEPARTMENT_SEED.find((d) => d.id === id)!.name;
  const position = (id: string) => POSITION_SEED.find((p) => p.id === id)!.title;
  const STATUS = { active: { en: 'active', ar: 'active' }, inactive: { en: 'inactive', ar: 'inactive' } };

  for (const e of employees) {
    add(e.id, 'joined', e.hireDate, null, department(e.departmentId));
    const years = (Date.parse(SEED_DATE) - Date.parse(e.hireDate)) / (365 * DAY);
    if (years > 2 && random() < 0.35) {
      // An earlier position in the same unit, then a promotion to the current one.
      const others = POSITION_SEED.filter((p) => p.departmentId === e.departmentId && p.id !== e.positionId);
      if (others.length) add(e.id, 'position-changed', addDays(e.hireDate, 400 + Math.floor(random() * 300)), position(pick(random, others).id), position(e.positionId));
    }
    if (years > 3 && random() < 0.2) {
      const parent = DEPARTMENT_SEED.find((d) => d.id === e.departmentId)?.parentId;
      if (parent) add(e.id, 'department-changed', addDays(e.hireDate, 800 + Math.floor(random() * 200)), department(parent), department(e.departmentId));
    }
    if (e.status === 'inactive') add(e.id, 'status-changed', between(random, addDays(e.hireDate, 200), addDays(SEED_DATE, -10)), STATUS.active, STATUS.inactive);
  }
  return rows;
}

export const EMPLOYEE_SEED: readonly EmployeeRow[] = generate();
export const HISTORY_SEED: readonly HistoryRow[] = generateHistory(EMPLOYEE_SEED);
