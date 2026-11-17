import { describe, expect, it } from 'vitest';
import { departmentFormSchema, locationFormSchema, positionFormSchema, toDepartmentInput } from './organizationSchemas';

/** First reason per field — what the form (and the API's `fieldErrors[field][0]`) shows. */
function reasons(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  const first: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) first[String(issue.path[0])] ??= issue.message;
  return first;
}

const department = { code: 'eng-02', nameEn: 'Platform', nameAr: 'المنصة', description: '', parentId: '', managerId: '' };

describe('organization form validation', () => {
  it('accepts a valid department and normalises it to the API payload', () => {
    const parsed = departmentFormSchema.parse({ ...department, code: '  eng-02 ', parentId: 'dep-eng' });
    expect(toDepartmentInput(parsed)).toEqual({ code: 'ENG-02', name: { en: 'Platform', ar: 'المنصة' }, description: '', parentId: 'dep-eng', managerId: null });
  });

  it('reports required fields and code format problems', () => {
    expect(reasons(departmentFormSchema.safeParse({ ...department, code: '', nameEn: ' ', nameAr: '' }))).toEqual({ code: 'required', nameEn: 'required', nameAr: 'required' });
    expect(reasons(departmentFormSchema.safeParse({ ...department, code: 'A' }))).toEqual({ code: 'codeLength' });
    expect(reasons(departmentFormSchema.safeParse({ ...department, code: 'ABCDEFGHIJKLM' }))).toEqual({ code: 'codeLength' });
    for (const bad of ['EN G', 'ENG_1', '-ENG', 'ENG--1', 'ENG-']) {
      expect(reasons(departmentFormSchema.safeParse({ ...department, code: bad })), bad).toEqual({ code: 'codeFormat' });
    }
  });

  it('requires Arabic script in Arabic names and limits lengths', () => {
    expect(reasons(departmentFormSchema.safeParse({ ...department, nameAr: 'Platform' }))).toEqual({ nameAr: 'arabicRequired' });
    expect(reasons(departmentFormSchema.safeParse({ ...department, nameEn: 'x'.repeat(101), description: 'y'.repeat(501) }))).toEqual({ nameEn: 'tooLong', description: 'tooLong' });
  });

  it('positions need a department and a known level; locations a known country', () => {
    expect(reasons(positionFormSchema.safeParse({ code: 'P-1', titleEn: 'A', titleAr: 'أ', departmentId: '', level: '', description: '' }))).toEqual({ departmentId: 'required', level: 'required' });
    expect(positionFormSchema.safeParse({ code: 'P-1', titleEn: 'A', titleAr: 'أ', departmentId: 'dep-eng', level: 'senior', description: '' }).success).toBe(true);
    expect(reasons(locationFormSchema.safeParse({ code: 'L-1', nameEn: 'A', nameAr: 'أ', address: '', city: '', country: 'XX' }))).toEqual({ address: 'required', city: 'required', country: 'required' });
  });
});
