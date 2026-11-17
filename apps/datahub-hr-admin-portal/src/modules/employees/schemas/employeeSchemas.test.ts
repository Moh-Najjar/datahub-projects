import { describe, expect, it } from 'vitest';
import { employeeFormSchema, toEmployeeInput, type EmployeeFormValues } from './employeeSchemas';

const valid: EmployeeFormValues = {
  employeeNumber: 'emp-9100',
  firstNameEn: 'Test',
  lastNameEn: 'Person',
  firstNameAr: 'تجربة',
  lastNameAr: 'شخص',
  dateOfBirth: '1990-05-20',
  gender: 'male',
  nationality: 'JO',
  maritalStatus: 'married',
  workEmail: 'Test.Person@staff.datahubhr.test',
  personalEmail: '',
  phone: '+962 79 000 0001',
  alternativePhone: '',
  address: 'Building 3',
  city: 'Amman',
  country: 'JO',
  hireDate: '2025-01-05',
  employmentType: 'full-time',
  contractStartDate: '2025-01-05',
  contractEndDate: '',
  probationEndDate: '',
  departmentId: 'dep-eng',
  positionId: 'pos-01',
  locationId: 'loc-01',
  managerId: '',
  reportingDepartmentId: '',
  emergencyName: 'Someone',
  emergencyRelationship: 'sibling',
  emergencyPhone: '+962 78 000 0002',
  emergencyAlternativePhone: '',
};

/** First reason per field (what the form shows). */
function reasons(values: Partial<EmployeeFormValues>) {
  const result = employeeFormSchema.safeParse({ ...valid, ...values });
  const first: Record<string, string> = {};
  for (const issue of result.error?.issues ?? []) first[String(issue.path[0])] ??= issue.message;
  return first;
}

describe('employee form validation', () => {
  it('accepts a valid employee and maps it to the API payload (number upper-cased, empty optionals → null)', () => {
    const input = toEmployeeInput(employeeFormSchema.parse(valid));
    expect(input).toMatchObject({ employeeNumber: 'EMP-9100', managerId: null, reportingDepartmentId: null, contractEndDate: null, name: { first: { en: 'Test', ar: 'تجربة' } } });
  });

  it('reports required fields', () => {
    expect(reasons({ firstNameEn: '', lastNameAr: '', departmentId: '', positionId: '', locationId: '', phone: '', emergencyName: '' })).toEqual({
      firstNameEn: 'required',
      lastNameAr: 'required',
      departmentId: 'required',
      positionId: 'required',
      locationId: 'required',
      phone: 'required',
      emergencyName: 'required',
    });
    expect(reasons({ gender: '' as never, employmentType: '' as never })).toEqual({ gender: 'required', employmentType: 'required' });
  });

  it('checks e-mail, phone, employee number and script of names', () => {
    expect(reasons({ workEmail: 'nope', personalEmail: 'also@bad' })).toEqual({ workEmail: 'email', personalEmail: 'email' });
    expect(reasons({ phone: 'call me', alternativePhone: '12' })).toEqual({ phone: 'phone', alternativePhone: 'phone' });
    expect(reasons({ employeeNumber: 'E 1' })).toEqual({ employeeNumber: 'employeeNumberFormat' });
    expect(reasons({ firstNameAr: 'Test', firstNameEn: 'تجربة' })).toEqual({ firstNameAr: 'arabicRequired', firstNameEn: 'latinRequired' });
  });

  it('checks dates and their consistency', () => {
    expect(reasons({ dateOfBirth: '2024-02-30' })).toEqual({ dateOfBirth: 'invalidDate' });
    expect(reasons({ dateOfBirth: '2012-01-01' })).toEqual({ dateOfBirth: 'tooYoung' });
    expect(reasons({ contractStartDate: '2024-12-31' })).toEqual({ contractStartDate: 'contractBeforeHire' });
    expect(reasons({ employmentType: 'contract' })).toEqual({ contractEndDate: 'contractEndRequired' });
    expect(reasons({ employmentType: 'contract', contractEndDate: '2025-01-05' })).toEqual({ contractEndDate: 'contractEndBeforeStart' });
    expect(reasons({ employmentType: 'intern', contractEndDate: '2025-07-05' })).toEqual({});
    expect(reasons({ probationEndDate: '2026-06-01' })).toEqual({ probationEndDate: 'probationRange' });
    expect(reasons({ probationEndDate: '2025-04-05' })).toEqual({});
    expect(reasons({ hireDate: '2099-01-01', contractStartDate: '2099-01-01' })).toEqual({ hireDate: 'hireDateTooFar' });
  });
});
