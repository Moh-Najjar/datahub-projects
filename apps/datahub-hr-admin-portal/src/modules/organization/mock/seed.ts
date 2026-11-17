import type { Localized } from '@datahub/shared-types';
import type { EmploymentLevel, RecordStatus } from '@/modules/organization/types/organization';

/*
 * FICTIONAL organization data for the simulated backend (all people, places and addresses are invented).
 * Read only by `organizationMock.ts`.
 *
 * The eight top-level departments use the same ids and names as the dashboard's dataset. Department managers
 * (`managerId`) are employee ids from the employees module's simulated data, and employee counts are computed
 * from employee records — `SEED_HEADCOUNT` only tells the employee generator how many fictional people to
 * create per unit, so that each department plus its subdepartments matches the dashboard's headcount
 * (Engineering 58 active + 4 inactive, Sales 39 + 2, Operations 36 + 2, Customer Support 33 + 2, IT 23 + 1,
 * Finance 17 + 1, Marketing 15 + 1, HR 14).
 */

export interface DepartmentRow {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  parentId: string | null;
  managerId: string | null;
  status: RecordStatus;
  createdAt: string;
}

/** Fictional employees to generate per unit (active / inactive). Read only by the employee seed generator. */
export const SEED_HEADCOUNT: Record<string, { active: number; inactive: number }> = {};

const INACTIVE_SEED: Record<string, number> = { 'dep-eng': 4, 'dep-sales': 2, 'dep-ops': 2, 'dep-support': 2, 'dep-it': 1, 'dep-fin': 1, 'dep-mkt': 1 };

export interface PositionRow {
  id: string;
  code: string;
  title: Localized<string>;
  departmentId: string;
  description: string;
  level: EmploymentLevel;
  status: RecordStatus;
  createdAt: string;
}

export interface LocationRow {
  id: string;
  code: string;
  name: Localized<string>;
  address: string;
  city: string;
  country: string;
  status: RecordStatus;
  createdAt: string;
}

const dep = (
  id: string,
  code: string,
  en: string,
  ar: string,
  parentId: string | null,
  managerId: string | null,
  employeeCount: number,
  createdAt: string,
  description = '',
  status: RecordStatus = 'active',
): DepartmentRow => {
  SEED_HEADCOUNT[id] = { active: employeeCount, inactive: INACTIVE_SEED[id] ?? 0 };
  return { id, code, name: { en, ar }, description, parentId, managerId, status, createdAt: `${createdAt}T09:00:00.000Z` };
};

export const DEPARTMENT_SEED: readonly DepartmentRow[] = [
  dep('dep-eng', 'ENG', 'Engineering', 'الهندسة', null, 'emp-0001', 6, '2019-02-03', 'Builds and maintains the company’s software products.'),
  dep('dep-eng-swd', 'SWD', 'Software Development', 'تطوير البرمجيات', 'dep-eng', 'emp-0013', 20, '2019-02-03'),
  dep('dep-eng-mob', 'MOB', 'Mobile Development', 'تطوير تطبيقات الهاتف', 'dep-eng-swd', 'emp-0014', 10, '2021-05-16'),
  dep('dep-eng-qa', 'QA', 'Quality Assurance', 'ضمان الجودة', 'dep-eng', 'emp-0015', 12, '2019-09-01'),
  dep('dep-eng-data', 'DATA', 'Data & Analytics', 'البيانات والتحليلات', 'dep-eng', 'emp-0016', 10, '2022-01-09'),
  dep('dep-eng-lab', 'RLAB', 'Research Lab', 'مختبر الأبحاث', 'dep-eng', null, 0, '2023-03-12', 'Paused research unit.', 'inactive'),
  dep('dep-sales', 'SLS', 'Sales', 'المبيعات', null, 'emp-0007', 5, '2019-02-03', 'New business and account growth.'),
  dep('dep-sales-ent', 'ENTS', 'Enterprise Sales', 'مبيعات الشركات', 'dep-sales', 'emp-0017', 18, '2020-04-19'),
  dep('dep-sales-chn', 'CHNS', 'Channel Sales', 'مبيعات القنوات', 'dep-sales', null, 16, '2021-10-03'),
  dep('dep-ops', 'OPS', 'Operations', 'العمليات', null, 'emp-0008', 8, '2019-02-03'),
  dep('dep-ops-fac', 'FAC', 'Facilities', 'المرافق', 'dep-ops', 'emp-0018', 12, '2019-06-23'),
  dep('dep-ops-log', 'LOG', 'Logistics', 'الخدمات اللوجستية', 'dep-ops', 'emp-0019', 16, '2020-08-30'),
  dep('dep-support', 'CS', 'Customer Support', 'دعم العملاء', null, 'emp-0009', 33, '2019-11-10', 'Customer help desk and onboarding.'),
  dep('dep-it', 'IT', 'Information Technology', 'تقنية المعلومات', null, 'emp-0010', 5, '2019-02-03'),
  dep('dep-it-inf', 'INFRA', 'Infrastructure', 'البنية التحتية', 'dep-it', 'emp-0020', 10, '2020-02-16'),
  dep('dep-it-sd', 'SD', 'Service Desk', 'مكتب الخدمة', 'dep-it', 'emp-0021', 8, '2020-02-16'),
  dep('dep-fin', 'FIN', 'Finance', 'المالية', null, 'emp-0011', 4, '2019-02-03'),
  dep('dep-fin-acc', 'ACC', 'Accounting', 'المحاسبة', 'dep-fin', 'emp-0022', 8, '2019-02-03'),
  dep('dep-fin-pay', 'PAY', 'Payroll', 'الرواتب', 'dep-fin', 'emp-0005', 5, '2020-01-12'),
  dep('dep-mkt', 'MKT', 'Marketing', 'التسويق', null, 'emp-0012', 15, '2020-03-01'),
  dep('dep-hr', 'HR', 'Human Resources', 'الموارد البشرية', null, 'emp-0003', 4, '2019-02-03', 'People operations, policies and talent.'),
  dep('dep-hr-ta', 'TA', 'Talent Acquisition', 'استقطاب المواهب', 'dep-hr', 'emp-0024', 5, '2021-01-17'),
  dep('dep-hr-ops', 'HROPS', 'HR Operations', 'عمليات الموارد البشرية', 'dep-hr', 'emp-0023', 5, '2021-01-17'),
];

const pos = (
  id: string,
  code: string,
  en: string,
  ar: string,
  departmentId: string,
  level: EmploymentLevel,
  createdAt: string,
  status: RecordStatus = 'active',
): PositionRow => ({ id, code, title: { en, ar }, departmentId, description: '', level, status, createdAt: `${createdAt}T09:00:00.000Z` });

export const POSITION_SEED: readonly PositionRow[] = [
  pos('pos-01', 'ENG-EM', 'Engineering Manager', 'مدير هندسة', 'dep-eng', 'manager', '2019-02-03'),
  pos('pos-02', 'SWD-SSE', 'Senior Software Engineer', 'مهندس برمجيات أول', 'dep-eng-swd', 'senior', '2019-02-03'),
  pos('pos-03', 'SWD-SE', 'Software Engineer', 'مهندس برمجيات', 'dep-eng-swd', 'mid', '2019-02-03'),
  pos('pos-04', 'SWD-JSE', 'Junior Software Engineer', 'مهندس برمجيات مبتدئ', 'dep-eng-swd', 'junior', '2020-06-14'),
  pos('pos-05', 'MOB-DEV', 'Mobile Developer', 'مطور تطبيقات الهاتف', 'dep-eng-mob', 'mid', '2021-05-16'),
  pos('pos-06', 'QA-ENG', 'QA Engineer', 'مهندس ضمان الجودة', 'dep-eng-qa', 'mid', '2019-09-01'),
  pos('pos-07', 'QA-LEAD', 'QA Lead', 'قائد فريق ضمان الجودة', 'dep-eng-qa', 'lead', '2019-09-01'),
  pos('pos-08', 'DATA-SDE', 'Senior Data Engineer', 'مهندس بيانات أول', 'dep-eng-data', 'senior', '2022-01-09'),
  pos('pos-09', 'DATA-ANL', 'Data Analyst', 'محلل بيانات', 'dep-eng-data', 'mid', '2022-01-09'),
  pos('pos-10', 'SLS-HEAD', 'Head of Sales', 'رئيس المبيعات', 'dep-sales', 'director', '2019-02-03'),
  pos('pos-11', 'ENTS-AM', 'Account Manager', 'مدير حسابات', 'dep-sales-ent', 'mid', '2020-04-19'),
  pos('pos-12', 'CHNS-PM', 'Partner Manager', 'مدير شركاء', 'dep-sales-chn', 'senior', '2021-10-03'),
  pos('pos-13', 'OPS-DIR', 'Operations Director', 'مدير العمليات', 'dep-ops', 'director', '2019-02-03'),
  pos('pos-14', 'FAC-CRD', 'Facilities Coordinator', 'منسق المرافق', 'dep-ops-fac', 'junior', '2019-06-23'),
  pos('pos-15', 'LOG-SPC', 'Logistics Specialist', 'أخصائي لوجستي', 'dep-ops-log', 'mid', '2020-08-30'),
  pos('pos-16', 'CS-AGT', 'Customer Support Agent', 'موظف دعم العملاء', 'dep-support', 'entry', '2019-11-10'),
  pos('pos-17', 'CS-SUP', 'Support Team Supervisor', 'مشرف فريق الدعم', 'dep-support', 'lead', '2019-11-10'),
  pos('pos-18', 'IT-SYS', 'Systems Administrator', 'مسؤول أنظمة', 'dep-it-inf', 'senior', '2020-02-16'),
  pos('pos-19', 'SD-TECH', 'Service Desk Technician', 'فني مكتب الخدمة', 'dep-it-sd', 'junior', '2020-02-16'),
  pos('pos-20', 'FIN-ACC', 'Accountant', 'محاسب', 'dep-fin-acc', 'mid', '2019-02-03'),
  pos('pos-21', 'PAY-SPC', 'Payroll Specialist', 'أخصائي رواتب', 'dep-fin-pay', 'mid', '2020-01-12'),
  pos('pos-22', 'MKT-SPC', 'Marketing Specialist', 'أخصائي تسويق', 'dep-mkt', 'mid', '2020-03-01'),
  pos('pos-23', 'HR-GEN', 'HR Generalist', 'أخصائي موارد بشرية', 'dep-hr-ops', 'mid', '2021-01-17'),
  pos('pos-24', 'TA-REC', 'Recruiter', 'مسؤول توظيف', 'dep-hr-ta', 'mid', '2021-01-17'),
  pos('pos-25', 'RLAB-RS', 'Research Scientist', 'باحث علمي', 'dep-eng-lab', 'senior', '2023-03-12', 'inactive'),
  pos('pos-26', 'ENG-INT', 'Engineering Intern', 'متدرب هندسة', 'dep-eng', 'entry', '2022-06-05', 'inactive'),
  pos('pos-27', 'ENG-TPM', 'Technical Program Manager', 'مدير برامج تقنية', 'dep-eng', 'senior', '2020-09-06'),
  pos('pos-28', 'SLS-OPS', 'Sales Operations Specialist', 'أخصائي عمليات المبيعات', 'dep-sales', 'mid', '2020-04-19'),
  pos('pos-29', 'OPS-CRD', 'Operations Coordinator', 'منسق العمليات', 'dep-ops', 'junior', '2019-02-03'),
  pos('pos-30', 'IT-MGR', 'IT Manager', 'مدير تقنية المعلومات', 'dep-it', 'manager', '2019-02-03'),
  pos('pos-31', 'IT-ARC', 'Solutions Architect', 'مهندس حلول', 'dep-it', 'senior', '2021-02-14'),
  pos('pos-32', 'FIN-MGR', 'Finance Manager', 'مدير المالية', 'dep-fin', 'manager', '2019-02-03'),
  pos('pos-33', 'FIN-ANL', 'Financial Analyst', 'محلل مالي', 'dep-fin', 'mid', '2019-02-03'),
  pos('pos-34', 'MKT-MGR', 'Marketing Manager', 'مدير التسويق', 'dep-mkt', 'manager', '2020-03-01'),
  pos('pos-35', 'HR-MGR', 'HR Manager', 'مدير الموارد البشرية', 'dep-hr', 'manager', '2019-02-03'),
  pos('pos-36', 'HR-BP', 'HR Business Partner', 'شريك أعمال الموارد البشرية', 'dep-hr', 'senior', '2021-01-17'),
];

const loc = (
  id: string,
  code: string,
  en: string,
  ar: string,
  address: string,
  city: string,
  country: string,
  createdAt: string,
  status: RecordStatus = 'active',
): LocationRow => ({ id, code, name: { en, ar }, address, city, country, status, createdAt: `${createdAt}T09:00:00.000Z` });

export const LOCATION_SEED: readonly LocationRow[] = [
  loc('loc-01', 'AMM-HQ', 'Amman Headquarters', 'المقر الرئيسي - عمّان', 'Business District, Building 14, Floor 6', 'Amman', 'JO', '2019-02-03'),
  loc('loc-02', 'IRB-01', 'Irbid Office', 'مكتب إربد', 'University Street, Building 3', 'Irbid', 'JO', '2021-03-14'),
  loc('loc-03', 'AQB-01', 'Aqaba Office', 'مكتب العقبة', 'Port Road, Unit 9', 'Aqaba', 'JO', '2022-09-04'),
  loc('loc-04', 'RUH-01', 'Riyadh Office', 'مكتب الرياض', 'Business Gate, Tower B, Floor 11', 'Riyadh', 'SA', '2023-01-22'),
  loc('loc-05', 'DXB-01', 'Dubai Office', 'مكتب دبي', 'Innovation Hub, Office 402', 'Dubai', 'AE', '2024-05-12'),
  loc('loc-06', 'ZRQ-WH', 'Zarqa Warehouse', 'مستودع الزرقاء', 'Industrial Zone, Plot 27', 'Zarqa', 'JO', '2020-07-19', 'inactive'),
];
