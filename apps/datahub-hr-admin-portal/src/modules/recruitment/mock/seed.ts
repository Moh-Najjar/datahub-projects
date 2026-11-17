/*
 * FICTIONAL recruitment pools for the simulated backend. Candidates are invented people with `.test` e-mail addresses
 * and "000" phone numbers; companies are invented. Read only by the recruitment mock.
 */

type Pair = readonly [en: string, ar: string];

export const FIRST_MALE: readonly Pair[] = [
  ['Omar', 'عمر'], ['Yousef', 'يوسف'], ['Khalid', 'خالد'], ['Sami', 'سامي'], ['Hadi', 'هادي'], ['Rayan', 'ريان'],
  ['Nizar', 'نزار'], ['Wael', 'وائل'], ['Basel', 'باسل'], ['Ziad', 'زياد'], ['Murad', 'مراد'], ['Suhaib', 'صهيب'],
  ['Mazen', 'مازن'], ['Osama', 'أسامة'], ['Karam', 'كرم'], ['Hisham', 'هشام'], ['Ehab', 'إيهاب'], ['Saif', 'سيف'],
];
export const FIRST_FEMALE: readonly Pair[] = [
  ['Nour', 'نور'], ['Reem', 'ريم'], ['Lara', 'لارا'], ['Dana', 'دانة'], ['Sana', 'سناء'], ['Rula', 'رلى'],
  ['Hiba', 'هبة'], ['Noor', 'نور'], ['Tala', 'تالا'], ['Ruba', 'ربى'], ['Asma', 'أسماء'], ['Malak', 'ملك'],
  ['Shahd', 'شهد'], ['Bayan', 'بيان'], ['Duaa', 'دعاء'], ['Ghada', 'غادة'], ['Wafa', 'وفاء'], ['Zeina', 'زينة'],
];
export const LAST_NAMES: readonly Pair[] = [
  ['Masri', 'المصري'], ['Jaradat', 'جرادات'], ['Obeidat', 'عبيدات'], ['Qudah', 'القضاة'], ['Rawashdeh', 'الرواشدة'],
  ['Hijazi', 'حجازي'], ['Shami', 'الشامي'], ['Najjar', 'النجار'], ['Haddadin', 'حدادين'], ['Zoubi', 'الزعبي'],
  ['Atieh', 'عطية'], ['Bataineh', 'البطاينة'], ['Khasawneh', 'الخصاونة'], ['Mahmoud', 'محمود'], ['Ghanem', 'غانم'],
  ['Shdeifat', 'الشديفات'], ['Abu Zeid', 'أبو زيد'], ['Sweis', 'سويس'], ['Tarawneh', 'الطراونة'], ['Nimri', 'النمري'],
];

/** Invented employers (no real companies). */
export const COMPANIES: readonly string[] = [
  'Northwind Systems', 'Bluepeak Solutions', 'Cedar Digital', 'Olive Grove Retail', 'Sandstone Logistics', 'Azure Coast Telecom',
  'Petra Analytics Lab', 'Juniper Health Group', 'Falcon Ridge Finance', 'Desert Bloom Media', 'Harbor Light Services', 'Copperline Industries',
];

export const CITIES: readonly string[] = ['Amman', 'Irbid', 'Zarqa', 'Aqaba', 'Madaba', 'Salt', 'Dubai', 'Riyadh'];

export const LANGUAGES: readonly string[] = ['Arabic', 'English', 'French', 'German', 'Turkish'];

/** Skill pools per top-level department (fallback: GENERAL). */
export const SKILLS: Readonly<Record<string, readonly string[]>> = {
  'dep-eng': ['TypeScript', 'React', 'Node.js', 'C#', '.NET', 'SQL', 'Docker', 'Kubernetes', 'Testing', 'System design', 'Kotlin', 'Swift'],
  'dep-it': ['Networking', 'Windows Server', 'Linux', 'Cloud infrastructure', 'Security', 'Scripting', 'ITIL', 'Monitoring'],
  'dep-sales': ['Negotiation', 'CRM', 'Account management', 'Prospecting', 'Presentations', 'Forecasting'],
  'dep-mkt': ['Content writing', 'SEO', 'Social media', 'Campaign management', 'Analytics', 'Branding', 'Design tools'],
  'dep-fin': ['Accounting', 'IFRS', 'Excel', 'Budgeting', 'Payroll', 'Auditing', 'ERP'],
  'dep-hr': ['Recruiting', 'Labour law', 'Onboarding', 'HR systems', 'Employee relations', 'Training'],
  'dep-ops': ['Logistics', 'Planning', 'Inventory', 'Process improvement', 'Procurement', 'Quality'],
  'dep-support': ['Customer service', 'Ticketing', 'Communication', 'Troubleshooting', 'Product knowledge'],
  GENERAL: ['Communication', 'Teamwork', 'Excel', 'Reporting', 'Problem solving'],
};

/** Example monthly salary ranges (JOD) per position level — demo values, not a pay policy. */
export const SALARY_BY_LEVEL: Readonly<Record<string, readonly [number, number]>> = {
  entry: [450, 650],
  junior: [600, 900],
  mid: [900, 1400],
  senior: [1400, 2100],
  lead: [1900, 2700],
  manager: [2300, 3300],
  director: [3200, 4500],
  executive: [4200, 6000],
};

export const BENEFITS = 'Health insurance (example), 21 days annual leave per the leave policy, transport allowance (example).';

export const REJECTION_NOTES: readonly string[] = ['Experience does not match the role.', 'Position filled by another candidate.', 'Candidate withdrew from the process.'];
