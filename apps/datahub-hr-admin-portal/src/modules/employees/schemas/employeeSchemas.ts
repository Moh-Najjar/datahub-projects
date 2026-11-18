import { z } from 'zod';
import {
  EMPLOYMENT_TYPES,
  FIXED_TERM_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  RELATIONSHIPS,
  type EmployeeInput,
} from '@/modules/employees/types/employee';

/*
 * Employee form schemas. Messages are reasons translated by the UI (`employees:validation.*`); the mock backend
 * validates payloads with the same rules, as the real backend must. Uniqueness, organization references and
 * manager rules need stored data, so only the backend checks them (`fieldErrors`).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ARABIC_LETTER = /[؀-ۿ]/;
const LATIN_LETTER = /[A-Za-z]/;
/** Digits, spaces, dashes and brackets, optionally starting with +; 7–20 characters. */
const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/;
const EMPLOYEE_NUMBER = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

const isDate = (v: string) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);
const todayIso = () => new Date().toISOString().slice(0, 10);

const required = (max: number) => z.string().trim().min(1, 'required').max(max, 'tooLong');
const nameEn = required(60).regex(LATIN_LETTER, 'latinRequired');
const nameAr = required(60).regex(ARABIC_LETTER, 'arabicRequired');
const date = z.string().trim().min(1, 'required').refine(isDate, 'invalidDate');
const optionalDate = z.string().trim().refine((v) => v === '' || isDate(v), 'invalidDate');
const email = z.string().trim().min(1, 'required').max(120, 'tooLong').pipe(z.email('email'));
const optionalEmail = z.string().trim().max(120, 'tooLong').refine((v) => v === '' || z.email().safeParse(v).success, 'email');
const phone = z.string().trim().min(1, 'required').regex(PHONE, 'phone');
const optionalPhone = z.string().trim().refine((v) => v === '' || PHONE.test(v), 'phone');
const choice = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values, { error: 'required' });

export const employeeFormSchema = z
  .object({
    employeeNumber: z.string().trim().toUpperCase().min(1, 'required').min(3, 'employeeNumberFormat').max(20, 'employeeNumberFormat').regex(EMPLOYEE_NUMBER, 'employeeNumberFormat'),
    firstNameEn: nameEn,
    lastNameEn: nameEn,
    firstNameAr: nameAr,
    lastNameAr: nameAr,
    dateOfBirth: date,
    gender: choice(GENDERS),
    nationality: z.string().regex(/^[A-Z]{2}$/, 'required'),
    maritalStatus: choice(MARITAL_STATUSES),
    workEmail: email,
    personalEmail: optionalEmail,
    phone,
    alternativePhone: optionalPhone,
    address: required(200),
    city: required(80),
    country: z.string().regex(/^[A-Z]{2}$/, 'required'),
    hireDate: date,
    employmentType: choice(EMPLOYMENT_TYPES),
    contractStartDate: date,
    contractEndDate: optionalDate,
    probationEndDate: optionalDate,
    departmentId: z.string().min(1, 'required'),
    positionId: z.string().min(1, 'required'),
    locationId: z.string().min(1, 'required'),
    managerId: z.string(),
    reportingDepartmentId: z.string(),
    emergencyName: required(100),
    emergencyRelationship: choice(RELATIONSHIPS),
    emergencyPhone: phone,
    emergencyAlternativePhone: optionalPhone,
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    const valid = (d: string) => d !== '' && isDate(d);
    // Only compare dates that are themselves valid (their own errors are reported above).
    if (valid(v.dateOfBirth)) {
      if (v.dateOfBirth >= todayIso() || yearsBetween(v.dateOfBirth, todayIso()) > 90) issue('dateOfBirth', 'invalidDate');
      else if (valid(v.hireDate) && yearsBetween(v.dateOfBirth, v.hireDate) < 16) issue('dateOfBirth', 'tooYoung');
    }
    if (valid(v.hireDate) && yearsBetween(todayIso(), v.hireDate) > 1) issue('hireDate', 'hireDateTooFar');
    if (valid(v.hireDate) && valid(v.contractStartDate) && v.contractStartDate < v.hireDate) issue('contractStartDate', 'contractBeforeHire');
    const fixedTerm = (FIXED_TERM_TYPES as readonly string[]).includes(v.employmentType);
    if (fixedTerm && v.contractEndDate === '') issue('contractEndDate', 'contractEndRequired');
    if (valid(v.contractEndDate) && valid(v.contractStartDate) && v.contractEndDate <= v.contractStartDate) issue('contractEndDate', 'contractEndBeforeStart');
    if (valid(v.probationEndDate) && valid(v.hireDate) && (v.probationEndDate <= v.hireDate || yearsBetween(v.hireDate, v.probationEndDate) > 1)) issue('probationEndDate', 'probationRange');
  });

export type EmployeeFormValues = z.input<typeof employeeFormSchema>;
export type EmployeeFormOutput = z.output<typeof employeeFormSchema>;
export const EMPLOYEE_FORM_FIELDS = Object.keys(employeeFormSchema.shape) as Array<keyof EmployeeFormValues>;

/** Empty form (create). Selects use '' until chosen; the schema reports "required". */
export const EMPTY_EMPLOYEE_FORM = Object.fromEntries(EMPLOYEE_FORM_FIELDS.map((f) => [f, ''])) as unknown as EmployeeFormValues;

export function toEmployeeInput(v: EmployeeFormOutput): EmployeeInput {
  return {
    employeeNumber: v.employeeNumber,
    name: { first: { en: v.firstNameEn, ar: v.firstNameAr }, last: { en: v.lastNameEn, ar: v.lastNameAr } },
    dateOfBirth: v.dateOfBirth,
    gender: v.gender,
    nationality: v.nationality,
    maritalStatus: v.maritalStatus,
    workEmail: v.workEmail,
    personalEmail: v.personalEmail,
    phone: v.phone,
    alternativePhone: v.alternativePhone,
    address: v.address,
    city: v.city,
    country: v.country,
    hireDate: v.hireDate,
    employmentType: v.employmentType,
    contractStartDate: v.contractStartDate,
    contractEndDate: v.contractEndDate || null,
    probationEndDate: v.probationEndDate || null,
    departmentId: v.departmentId,
    positionId: v.positionId,
    locationId: v.locationId,
    managerId: v.managerId || null,
    reportingDepartmentId: v.reportingDepartmentId || null,
    emergencyContact: { name: v.emergencyName, relationship: v.emergencyRelationship, phone: v.emergencyPhone, alternativePhone: v.emergencyAlternativePhone },
  };
}

/** API payload → form values (edit, and server-side validation). */
export function toEmployeeFormValues(e: EmployeeInput): EmployeeFormValues {
  return {
    employeeNumber: e.employeeNumber ?? '',
    firstNameEn: e.name?.first?.en ?? '',
    lastNameEn: e.name?.last?.en ?? '',
    firstNameAr: e.name?.first?.ar ?? '',
    lastNameAr: e.name?.last?.ar ?? '',
    dateOfBirth: e.dateOfBirth ?? '',
    gender: e.gender,
    nationality: e.nationality ?? '',
    maritalStatus: e.maritalStatus,
    workEmail: e.workEmail ?? '',
    personalEmail: e.personalEmail ?? '',
    phone: e.phone ?? '',
    alternativePhone: e.alternativePhone ?? '',
    address: e.address ?? '',
    city: e.city ?? '',
    country: e.country ?? '',
    hireDate: e.hireDate ?? '',
    employmentType: e.employmentType,
    contractStartDate: e.contractStartDate ?? '',
    contractEndDate: e.contractEndDate ?? '',
    probationEndDate: e.probationEndDate ?? '',
    departmentId: e.departmentId ?? '',
    positionId: e.positionId ?? '',
    locationId: e.locationId ?? '',
    managerId: e.managerId ?? '',
    reportingDepartmentId: e.reportingDepartmentId ?? '',
    emergencyName: e.emergencyContact?.name ?? '',
    emergencyRelationship: e.emergencyContact?.relationship,
    emergencyPhone: e.emergencyContact?.phone ?? '',
    emergencyAlternativePhone: e.emergencyContact?.alternativePhone ?? '',
  };
}

/* Server-side validation (mock backend) ------------------------------------------------------------- */

export type FieldErrors = Record<string, string[]>;

function issues(result: z.ZodSafeParseResult<unknown>): FieldErrors | undefined {
  if (result.success) return undefined;
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] = [...(errors[field] ?? []), issue.message];
  }
  return errors;
}

export const validateEmployeeInput = (input: EmployeeInput) => issues(employeeFormSchema.safeParse(toEmployeeFormValues(input)));

