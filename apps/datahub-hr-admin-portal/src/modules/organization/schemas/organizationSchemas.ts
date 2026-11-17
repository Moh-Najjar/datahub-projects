import { z } from 'zod';
import { EMPLOYMENT_LEVELS, type DepartmentInput, type LocationInput, type PositionInput } from '@/modules/organization/types/organization';
import { LOCATION_COUNTRIES } from '@/modules/organization/utils/countries';

/*
 * Form schemas. Error messages are translation keys under `organization:validation.*` (the form translates
 * them). The mock backend validates incoming payloads with the same rules, as the real backend must.
 * Uniqueness and hierarchy rules need the stored data, so the backend checks them (`fieldErrors`).
 */

/** 2–12 characters: letters, digits and single hyphens (stored upper-case). */
const CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const ARABIC_LETTER = /[؀-ۿ]/;

const code = z.string().trim().toUpperCase().min(1, 'required').min(2, 'codeLength').max(12, 'codeLength').regex(CODE_PATTERN, 'codeFormat');
const nameEn = z.string().trim().min(1, 'required').max(100, 'tooLong');
const nameAr = z.string().trim().min(1, 'required').max(100, 'tooLong').regex(ARABIC_LETTER, 'arabicRequired');
const description = z.string().trim().max(500, 'tooLong');
/** Select values: '' means "none". */
const optionalId = z.string();

export const departmentFormSchema = z.object({
  code,
  nameEn,
  nameAr,
  description,
  parentId: optionalId,
  managerId: optionalId,
});
export type DepartmentFormValues = z.input<typeof departmentFormSchema>;

export const positionFormSchema = z.object({
  code,
  titleEn: nameEn,
  titleAr: nameAr,
  departmentId: z.string().min(1, 'required'),
  level: z.enum(EMPLOYMENT_LEVELS, { error: 'required' }),
  description,
});
export type PositionFormValues = z.input<typeof positionFormSchema>;

export const locationFormSchema = z.object({
  code,
  nameEn,
  nameAr,
  address: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  city: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  country: z.enum(LOCATION_COUNTRIES, { error: 'required' }),
});
export type LocationFormValues = z.input<typeof locationFormSchema>;

/* Form values ⇄ API payloads ----------------------------------------------------------------------- */

export function toDepartmentInput(values: z.output<typeof departmentFormSchema>): DepartmentInput {
  return {
    code: values.code,
    name: { en: values.nameEn, ar: values.nameAr },
    description: values.description,
    parentId: values.parentId || null,
    managerId: values.managerId || null,
  };
}

export function toPositionInput(values: z.output<typeof positionFormSchema>): PositionInput {
  return { code: values.code, title: { en: values.titleEn, ar: values.titleAr }, departmentId: values.departmentId, level: values.level, description: values.description };
}

export function toLocationInput(values: z.output<typeof locationFormSchema>): LocationInput {
  return { code: values.code, name: { en: values.nameEn, ar: values.nameAr }, address: values.address, city: values.city, country: values.country };
}

/* Server-side validation (used by the mock backend) ------------------------------------------------- */

/** Field → reasons, like the backend's 422 response. */
export type FieldErrors = Record<string, string[]>;

function issues(result: z.ZodSafeParseResult<unknown>, rename: Record<string, string> = {}): FieldErrors | undefined {
  if (result.success) return undefined;
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    const key = rename[field] ?? field;
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return errors;
}

export function validateDepartmentInput(input: DepartmentInput): FieldErrors | undefined {
  return issues(
    departmentFormSchema.safeParse({ code: input.code, nameEn: input.name?.en, nameAr: input.name?.ar, description: input.description ?? '', parentId: input.parentId ?? '', managerId: input.managerId ?? '' }),
  );
}

export function validatePositionInput(input: PositionInput): FieldErrors | undefined {
  return issues(positionFormSchema.safeParse({ code: input.code, titleEn: input.title?.en, titleAr: input.title?.ar, departmentId: input.departmentId, level: input.level, description: input.description ?? '' }));
}

export function validateLocationInput(input: LocationInput): FieldErrors | undefined {
  return issues(locationFormSchema.safeParse({ code: input.code, nameEn: input.name?.en, nameAr: input.name?.ar, address: input.address, city: input.city, country: input.country }));
}
