import type { Localized } from '@datahub/shared-types';
import { EMPLOYMENT_TYPES, type CategoryGroup, type Confidentiality, type DocumentCategory, type FileType, type OwnerType } from '@/modules/documents/types/documents';

/*
 * FICTIONAL document configuration for the demo: categories and required-document rules. They are configuration
 * DATA (editable in the UI), not rules hard-coded in screens.
 */

export const CREATED = '2024-01-02T09:00:00.000Z';

type CategorySeed = Omit<DocumentCategory, 'documentCount'>;
const PDF_IMG: FileType[] = ['pdf', 'jpg', 'jpeg', 'png'];
const PDF_DOC: FileType[] = ['pdf', 'doc', 'docx'];

interface Options {
  appliesTo?: OwnerType[];
  transferOnHire?: boolean;
  required?: boolean;
  tracksExpiry?: boolean;
  requiresNumber?: boolean;
  files?: FileType[];
  maxMb?: number;
  confidentiality?: Confidentiality;
  employeeVisible?: boolean;
  managerVisible?: boolean;
}

let n = 0;
function category(code: string, group: CategoryGroup, en: string, ar: string, description: string, o: Options = {}): CategorySeed {
  n++;
  return {
    id: `cat-${String(n).padStart(2, '0')}`,
    code,
    name: { en, ar },
    description,
    group,
    appliesTo: o.appliesTo ?? ['employee'],
    transferOnHire: o.transferOnHire ?? false,
    required: o.required ?? false,
    tracksExpiry: o.tracksExpiry ?? false,
    requiresNumber: o.requiresNumber ?? false,
    allowedFileTypes: o.files ?? PDF_IMG,
    maxFileSizeMb: o.maxMb ?? 10,
    employmentTypes: [...EMPLOYMENT_TYPES],
    defaultConfidentiality: o.confidentiality ?? 'standard',
    employeeVisible: o.employeeVisible ?? true,
    managerVisible: o.managerVisible ?? false,
    status: 'active',
    createdAt: CREATED,
  };
}

const IDENTITY: Options = { tracksExpiry: true, requiresNumber: true, maxMb: 5, confidentiality: 'highly-confidential' };
const EDUCATION: Options = { appliesTo: ['employee', 'candidate'], transferOnHire: true, managerVisible: true };

export const CATEGORY_SEED: readonly CategorySeed[] = [
  // Employee identity
  category('NATIONAL-ID', 'identity', 'National ID', 'الهوية الوطنية', 'Copy of the national identity card.', { ...IDENTITY, appliesTo: ['employee', 'candidate'], transferOnHire: true, required: true }),
  category('PASSPORT', 'identity', 'Passport', 'جواز السفر', 'Copy of the passport data page.', { ...IDENTITY, appliesTo: ['employee', 'candidate'], transferOnHire: true }),
  category('RESIDENCE-PERMIT', 'identity', 'Residence Permit', 'تصريح الإقامة', 'Residence permit for non-national employees.', IDENTITY),
  category('WORK-PERMIT', 'identity', 'Work Permit', 'تصريح العمل', 'Work permit for non-national employees.', IDENTITY),
  category('DRIVING-LICENCE', 'identity', 'Driving Licence', 'رخصة القيادة', 'Required for roles that drive company vehicles.', { tracksExpiry: true, requiresNumber: true, maxMb: 5, managerVisible: true }),
  // Employment
  category('EMP-CONTRACT', 'employment', 'Employment Contract', 'عقد العمل', 'Signed employment contract and its amendments.', { required: true, files: PDF_DOC, confidentiality: 'confidential' }),
  category('JOB-OFFER', 'employment', 'Job Offer', 'العرض الوظيفي', 'Signed job offer letter.', { files: PDF_DOC, confidentiality: 'confidential' }),
  category('PROMOTION-LETTER', 'employment', 'Promotion Letter', 'خطاب الترقية', 'Letter confirming a promotion.', { files: PDF_DOC, confidentiality: 'confidential' }),
  category('SALARY-CERT', 'employment', 'Salary Certificate', 'شهادة راتب', 'Certificate of salary issued to the employee (salary information).', { files: PDF_DOC, confidentiality: 'confidential' }),
  category('EXPERIENCE-CERT', 'employment', 'Experience Certificate', 'شهادة خبرة', 'Experience letter from a previous or the current employer.', { files: PDF_DOC }),
  category('TERMINATION-LETTER', 'employment', 'Termination Letter', 'خطاب إنهاء الخدمة', 'Letter ending the employment.', { files: PDF_DOC, confidentiality: 'confidential' }),
  // Education and professional
  category('UNIVERSITY-DEGREE', 'education', 'University Degree', 'الشهادة الجامعية', 'University degree certificate.', EDUCATION),
  category('ACADEMIC-CERT', 'education', 'Academic Certificate', 'شهادة أكاديمية', 'School or other academic certificate.', EDUCATION),
  category('PROFESSIONAL-CERT', 'education', 'Professional Certificate', 'شهادة مهنية', 'Professional certification.', EDUCATION),
  category('TRAINING-CERT', 'education', 'Training Certificate', 'شهادة تدريب', 'Completion certificate of a training course.', EDUCATION),
  category('PROF-LICENCE', 'education', 'Professional Licence', 'رخصة مزاولة المهنة', 'Licence to practise a regulated profession.', { ...EDUCATION, tracksExpiry: true, requiresNumber: true }),
  // HR and administration
  category('EMERGENCY-FORM', 'hr', 'Emergency Contact Form', 'نموذج جهات الاتصال للطوارئ', 'Signed emergency contact form (personal data).', { required: true, confidentiality: 'confidential' }),
  category('HANDBOOK-ACK', 'hr', 'Employee Handbook Acknowledgement', 'إقرار استلام دليل الموظف', 'Signed acknowledgement of the employee handbook.', { required: true, managerVisible: true }),
  category('HR-FORM', 'hr', 'Signed HR Forms', 'نماذج موارد بشرية موقعة', 'Other signed HR forms.', { files: PDF_DOC, managerVisible: true }),
  category('HR-OTHER', 'hr', 'Other HR Documents', 'مستندات موارد بشرية أخرى', 'Other HR documents (restricted: not shown to the employee).', { files: PDF_DOC, confidentiality: 'confidential', employeeVisible: false }),
  // Leave and attendance
  category('SICK-CERT', 'leave', 'Sick Leave Certificate', 'شهادة إجازة مرضية', 'Medical certificate supporting sick leave (medical information).', { confidentiality: 'highly-confidential' }),
  category('MEDICAL-REPORT', 'leave', 'Medical Report', 'تقرير طبي', 'Medical report (medical information).', { confidentiality: 'highly-confidential' }),
  category('LEAVE-SUPPORT', 'leave', 'Leave Supporting Document', 'مستند داعم للإجازة', 'Document supporting a leave request.', { confidentiality: 'confidential' }),
  // Payroll
  category('PAYSLIP', 'payroll', 'Payslip (external copy)', 'قسيمة راتب (نسخة خارجية)', 'Payslip copies from outside the payroll system (e.g. a previous employer). Payroll payslips are referenced, not uploaded.', { files: ['pdf'], confidentiality: 'confidential' }),
  category('SALARY-SUPPORT', 'payroll', 'Salary Supporting Document', 'مستند داعم للراتب', 'Documents supporting a salary change, allowance or deduction.', { files: PDF_DOC, confidentiality: 'confidential' }),
  // Recruitment (candidate documents)
  category('CV', 'recruitment', 'CV', 'السيرة الذاتية', 'Curriculum vitae submitted with the application.', { appliesTo: ['candidate'], files: PDF_DOC, confidentiality: 'confidential' }),
  category('PORTFOLIO', 'recruitment', 'Portfolio', 'ملف الأعمال', 'Work samples or portfolio.', { appliesTo: ['candidate'], files: [...PDF_IMG, 'docx'], maxMb: 20 }),
  category('APPLICATION-SUPPORT', 'recruitment', 'Supporting Application Document', 'مستند داعم للطلب', 'Other documents supporting the application.', { appliesTo: ['candidate'], files: PDF_DOC, confidentiality: 'confidential' }),
];

export const categoryByCode = (code: string) => CATEGORY_SEED.find((c) => c.code === code)!;

export interface RuleSeed {
  id: string;
  name: Localized<string>;
  categoryCodes: string[];
  employmentTypes: Array<(typeof EMPLOYMENT_TYPES)[number]>;
  employmentStatus: 'active' | 'inactive' | 'any';
  departmentId: string | null;
}

/** Example rules (configuration, not policy). */
export const RULE_SEED: readonly RuleSeed[] = [
  { id: 'req-01', name: { en: 'Employment contract', ar: 'عقد العمل' }, categoryCodes: ['EMP-CONTRACT'], employmentTypes: [], employmentStatus: 'active', departmentId: null },
  { id: 'req-02', name: { en: 'Identity document', ar: 'وثيقة الهوية' }, categoryCodes: ['NATIONAL-ID', 'PASSPORT'], employmentTypes: [], employmentStatus: 'active', departmentId: null },
  { id: 'req-03', name: { en: 'Emergency contact form', ar: 'نموذج جهات الاتصال للطوارئ' }, categoryCodes: ['EMERGENCY-FORM'], employmentTypes: [], employmentStatus: 'active', departmentId: null },
  { id: 'req-04', name: { en: 'Handbook acknowledgement', ar: 'إقرار دليل الموظف' }, categoryCodes: ['HANDBOOK-ACK'], employmentTypes: [], employmentStatus: 'active', departmentId: null },
  { id: 'req-05', name: { en: 'University degree (Engineering)', ar: 'الشهادة الجامعية (الهندسة)' }, categoryCodes: ['UNIVERSITY-DEGREE'], employmentTypes: ['full-time'], employmentStatus: 'active', departmentId: 'dep-eng' },
  { id: 'req-06', name: { en: 'Driving licence (Logistics)', ar: 'رخصة القيادة (اللوجستيات)' }, categoryCodes: ['DRIVING-LICENCE'], employmentTypes: [], employmentStatus: 'active', departmentId: 'dep-ops-log' },
];

/** Days after hire (or after a rule is created) before a missing required document counts as "missing". */
export const GRACE_DAYS = 30;
