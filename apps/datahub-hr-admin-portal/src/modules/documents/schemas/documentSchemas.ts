import { z } from 'zod';
import {
  CATEGORY_GROUPS,
  CONFIDENTIALITY_LEVELS,
  EMPLOYMENT_TYPES,
  FILE_TYPES,
  OWNER_TYPES,
  type CategoryInput,
  type DocumentCategory,
  type DocumentInput,
  type DocumentUpdate,
  type FileInput,
  type RequiredRuleInput,
} from '@/modules/documents/types/documents';
import { fileProblem, isDate, MAX_FILES } from '@/modules/documents/utils/rules';

/*
 * Documents form schemas. Messages are reasons translated by the UI (`documents:validation.*`); the simulated backend
 * validates payloads with the same functions. Rules that need stored data (duplicate numbers, owner eligibility, scope,
 * status) are checked by the backend only and come back as `fieldErrors`.
 */

export type FieldErrors = Record<string, string[]>;

const ARABIC = /[؀-ۿ]/;
const CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const text = (max: number) => z.string().trim().max(max, 'tooLong');
const required = (max: number) => z.string().trim().min(1, 'required').max(max, 'tooLong');
const optionalDate = z.string().refine((v) => v === '' || isDate(v), 'invalidDate');

function collect(check: (add: (field: string, reason: string) => void) => void): FieldErrors | undefined {
  const errors: FieldErrors = {};
  check((field, reason) => (errors[field] = [...(errors[field] ?? []), reason]));
  return Object.keys(errors).length ? errors : undefined;
}

/**
 * Rules that depend on the category: files (type, size, count), expiry date required when tracked, document number
 * required when the category says so, issue/expiry order and no issue date in the future.
 */
export function categoryProblems(v: { issueDate: string | null; expiryDate: string | null; documentNumber: string; files?: readonly FileInput[] }, category: Pick<DocumentCategory, 'tracksExpiry' | 'requiresNumber' | 'allowedFileTypes' | 'maxFileSizeMb'>, today: string): FieldErrors | undefined {
  return collect((add) => {
    if (v.files) {
      if (v.files.length === 0) add('files', 'fileRequired');
      else if (v.files.length > MAX_FILES) add('files', 'tooManyFiles');
      else {
        const problem = v.files.map((f) => fileProblem(f, category)).find(Boolean);
        if (problem) add('files', problem);
      }
    }
    if (category.tracksExpiry && !v.expiryDate) add('expiryDate', 'expiryRequired');
    if (category.requiresNumber && !v.documentNumber.trim()) add('documentNumber', 'numberRequired');
    if (v.issueDate && v.issueDate > today) add('issueDate', 'issueInFuture');
    if (v.issueDate && v.expiryDate && v.expiryDate < v.issueDate) add('expiryDate', 'expiryBeforeIssue');
  });
}

/* Document metadata form (upload and edit) ------------------------------------------------------------------------- */

export const documentFormSchema = z.object({
  ownerId: z.string().min(1, 'required'),
  categoryId: z.string().min(1, 'required'),
  name: required(120),
  documentNumber: text(60),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  issuingAuthority: text(120),
  description: text(500),
  confidentiality: z.enum(CONFIDENTIALITY_LEVELS),
});
export type DocumentFormValues = z.input<typeof documentFormSchema>;

export const toDocumentUpdate = (v: z.output<typeof documentFormSchema>): DocumentUpdate => ({
  categoryId: v.categoryId,
  name: v.name,
  documentNumber: v.documentNumber.trim(),
  issueDate: v.issueDate || null,
  expiryDate: v.expiryDate || null,
  issuingAuthority: v.issuingAuthority,
  description: v.description,
  confidentiality: v.confidentiality,
});

export function validateDocumentInput(i: DocumentInput | (DocumentUpdate & { files?: undefined; ownerType?: undefined; ownerId?: undefined })): FieldErrors | undefined {
  return collect((add) => {
    if (i.ownerType !== undefined && !(OWNER_TYPES as readonly string[]).includes(i.ownerType)) add('ownerId', 'required');
    if (i.ownerId !== undefined && !i.ownerId) add('ownerId', 'required');
    if (!i.categoryId) add('categoryId', 'required');
    if (!i.name?.trim()) add('name', 'required');
    else if (i.name.length > 120) add('name', 'tooLong');
    if ((i.documentNumber ?? '').length > 60) add('documentNumber', 'tooLong');
    if (i.issueDate !== null && !isDate(i.issueDate)) add('issueDate', 'invalidDate');
    if (i.expiryDate !== null && !isDate(i.expiryDate)) add('expiryDate', 'invalidDate');
    if ((i.issuingAuthority ?? '').length > 120) add('issuingAuthority', 'tooLong');
    if ((i.description ?? '').length > 500) add('description', 'tooLong');
    if (!(CONFIDENTIALITY_LEVELS as readonly string[]).includes(i.confidentiality)) add('confidentiality', 'required');
  });
}

/* Category ------------------------------------------------------------------------------------------------------------ */

export const categoryFormSchema = z.object({
  code: z.string().trim().min(1, 'required').max(24, 'tooLong').regex(CODE, 'invalidCode'),
  nameEn: required(80),
  nameAr: required(80).regex(ARABIC, 'arabicRequired'),
  description: text(500),
  group: z.enum(CATEGORY_GROUPS),
  appliesTo: z.array(z.enum(OWNER_TYPES)).min(1, 'chooseOne'),
  transferOnHire: z.boolean(),
  required: z.boolean(),
  tracksExpiry: z.boolean(),
  requiresNumber: z.boolean(),
  allowedFileTypes: z.array(z.enum(FILE_TYPES)).min(1, 'chooseOne'),
  maxFileSizeMb: z.string().regex(/^\d{1,2}$/, 'invalidSize').refine((v) => Number(v) >= 1 && Number(v) <= 25, 'invalidSize'),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).min(1, 'chooseOne'),
  defaultConfidentiality: z.enum(CONFIDENTIALITY_LEVELS),
  employeeVisible: z.boolean(),
  managerVisible: z.boolean(),
});
export type CategoryFormValues = z.input<typeof categoryFormSchema>;

export const toCategoryInput = (v: z.output<typeof categoryFormSchema>): CategoryInput => ({
  code: v.code,
  name: { en: v.nameEn, ar: v.nameAr },
  description: v.description,
  group: v.group,
  appliesTo: v.appliesTo,
  transferOnHire: v.appliesTo.includes('candidate') && v.appliesTo.includes('employee') && v.transferOnHire,
  required: v.required,
  tracksExpiry: v.tracksExpiry,
  requiresNumber: v.requiresNumber,
  allowedFileTypes: v.allowedFileTypes,
  maxFileSizeMb: Number(v.maxFileSizeMb),
  employmentTypes: v.employmentTypes,
  defaultConfidentiality: v.defaultConfidentiality,
  employeeVisible: v.employeeVisible,
  managerVisible: v.managerVisible,
});

export const categoryToForm = (c?: CategoryInput): CategoryFormValues => ({
  code: c?.code ?? '',
  nameEn: c?.name.en ?? '',
  nameAr: c?.name.ar ?? '',
  description: c?.description ?? '',
  group: c?.group ?? 'hr',
  appliesTo: c?.appliesTo ?? ['employee'],
  transferOnHire: c?.transferOnHire ?? false,
  required: c?.required ?? false,
  tracksExpiry: c?.tracksExpiry ?? false,
  requiresNumber: c?.requiresNumber ?? false,
  allowedFileTypes: c?.allowedFileTypes ?? ['pdf'],
  maxFileSizeMb: String(c?.maxFileSizeMb ?? 10),
  employmentTypes: c?.employmentTypes ?? [...EMPLOYMENT_TYPES],
  defaultConfidentiality: c?.defaultConfidentiality ?? 'standard',
  employeeVisible: c?.employeeVisible ?? true,
  managerVisible: c?.managerVisible ?? false,
});

export function validateCategoryInput(i: CategoryInput): FieldErrors | undefined {
  return collect((add) => {
    if (!CODE.test(i.code ?? '') || i.code.length > 24) add('code', 'invalidCode');
    if (!i.name?.en?.trim()) add('nameEn', 'required');
    if (!i.name?.ar?.trim() || !ARABIC.test(i.name.ar)) add('nameAr', 'arabicRequired');
    if (!(CATEGORY_GROUPS as readonly string[]).includes(i.group)) add('group', 'required');
    if (!i.appliesTo?.length) add('appliesTo', 'chooseOne');
    if (!i.allowedFileTypes?.length || i.allowedFileTypes.some((x) => !(FILE_TYPES as readonly string[]).includes(x))) add('allowedFileTypes', 'chooseOne');
    if (!Number.isInteger(i.maxFileSizeMb) || i.maxFileSizeMb < 1 || i.maxFileSizeMb > 25) add('maxFileSizeMb', 'invalidSize');
    if (!i.employmentTypes?.length) add('employmentTypes', 'chooseOne');
    if (!(CONFIDENTIALITY_LEVELS as readonly string[]).includes(i.defaultConfidentiality)) add('defaultConfidentiality', 'required');
  });
}

/* Required-document rule ------------------------------------------------------------------------------------------------ */

export const ruleFormSchema = z.object({
  nameEn: required(80),
  nameAr: required(80).regex(ARABIC, 'arabicRequired'),
  categoryIds: z.array(z.string()).min(1, 'chooseOne'),
  employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)),
  employmentStatus: z.enum(['active', 'inactive', 'any']),
  departmentId: z.string(),
});
export type RuleFormValues = z.input<typeof ruleFormSchema>;

export const toRuleInput = (v: z.output<typeof ruleFormSchema>): RequiredRuleInput => ({
  name: { en: v.nameEn, ar: v.nameAr },
  categoryIds: v.categoryIds,
  employmentTypes: v.employmentTypes,
  employmentStatus: v.employmentStatus,
  departmentId: v.departmentId || null,
});

export function validateRuleInput(i: RequiredRuleInput): FieldErrors | undefined {
  return collect((add) => {
    if (!i.name?.en?.trim()) add('nameEn', 'required');
    if (!i.name?.ar?.trim() || !ARABIC.test(i.name.ar)) add('nameAr', 'arabicRequired');
    if (!i.categoryIds?.length) add('categoryIds', 'chooseOne');
    if (!['active', 'inactive', 'any'].includes(i.employmentStatus)) add('employmentStatus', 'required');
  });
}

/* Reasons and notes ----------------------------------------------------------------------------------------------------- */

export const reasonFormSchema = z.object({ reason: z.string().trim().min(5, 'reasonTooShort').max(500, 'tooLong') });
export type ReasonFormValues = z.input<typeof reasonFormSchema>;

export function validateReason(reason: string, field = 'reason'): FieldErrors | undefined {
  const r = (reason ?? '').trim();
  return collect((add) => {
    if (r.length < 5) add(field, 'reasonTooShort');
    if (r.length > 500) add(field, 'tooLong');
  });
}

export const thresholdFormSchema = z.object({ expiryWarningDays: z.string().regex(/^\d{1,3}$/, 'invalidThreshold').refine((v) => Number(v) >= 1 && Number(v) <= 180, 'invalidThreshold') });
export type ThresholdFormValues = z.input<typeof thresholdFormSchema>;
