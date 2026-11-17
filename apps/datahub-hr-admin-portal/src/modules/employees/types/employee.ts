import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Employee contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly
 * these shapes. Organization references (department, position, location, reporting department) are ids owned by
 * Organization Management; the backend joins their display names (`NamedRef`).
 */

export type EmploymentStatus = 'active' | 'inactive';

export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
/** Types that must have a contract end date. */
export const FIXED_TERM_TYPES: readonly EmploymentType[] = ['contract', 'temporary', 'intern'];

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const RELATIONSHIPS = ['spouse', 'parent', 'sibling', 'child', 'relative', 'friend'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export interface PersonName {
  first: Localized<string>;
  last: Localized<string>;
}

export interface EmergencyContact {
  name: string;
  relationship: Relationship;
  phone: string;
  alternativePhone: string;
}

/** A row of the directory (list endpoint). */
export interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  name: PersonName;
  workEmail: string;
  department: NamedRef;
  position: NamedRef;
  location: NamedRef;
  hireDate: string;
  employmentType: EmploymentType;
  status: EmploymentStatus;
}

/**
 * Personal (private) details. Returned only to viewers with `employees:read:personal`; for everyone else the
 * backend sends `personal: null` — the values never leave the server, the UI does not merely hide them.
 */
export interface PersonalDetails {
  dateOfBirth: string;
  gender: Gender;
  /** ISO 3166-1 alpha-2. */
  nationality: string;
  maritalStatus: MaritalStatus;
  personalEmail: string;
  phone: string;
  alternativePhone: string;
  address: string;
  city: string;
  country: string;
  emergencyContact: EmergencyContact;
}

/** The profile. Dates are ISO `YYYY-MM-DD`. Work and organization data are visible to every allowed reader. */
export interface Employee extends EmployeeSummary {
  /** No photo storage yet: always null (the UI shows initials). */
  photoUrl: null;
  contractStartDate: string;
  contractEndDate: string | null;
  probationEndDate: string | null;
  manager: NamedRef | null;
  /** Optional dotted-line department (when the employee also reports to another unit). */
  reportingDepartment: NamedRef | null;
  createdAt: string;
  /** `null` when the viewer lacks `employees:read:personal`. */
  personal: PersonalDetails | null;
}

export interface EmployeeFilters {
  departmentId: string;
  positionId: string;
  locationId: string;
  status: EmploymentStatus;
  employmentType: EmploymentType;
}

export type EmployeeSortField = 'employeeNumber' | 'name.en' | 'name.ar' | 'workEmail' | 'hireDate' | 'status';

/** Create/update payload. `status` changes only through `updateEmployeeStatus`. */
export interface EmployeeInput {
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
  contractStartDate: string;
  contractEndDate: string | null;
  probationEndDate: string | null;
  departmentId: string;
  positionId: string;
  locationId: string;
  managerId: string | null;
  reportingDepartmentId: string | null;
  emergencyContact: EmergencyContact;
}

/**
 * Who is asking: which employees they may see (organization / own team) and their role, from which the backend
 * decides field-level access (`employees:read:personal`, sensitive documents). The real backend derives all of
 * this from the signed-in user's token and NEVER trusts values sent by the browser; the mock receives them
 * explicitly because it has no token.
 */
export type EmployeeScope = { kind: 'organization'; role: Role } | { kind: 'team'; userId: string; role: Role };

/* Documents ------------------------------------------------------------------------------------------ */

export const DOCUMENT_TYPES = ['contract', 'national-id', 'passport', 'work-permit', 'certificate', 'medical', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** `pending-review` = uploaded, not yet checked by HR. Expiry-based states are computed by the backend. */
export type DocumentStatus = 'valid' | 'expiring-soon' | 'expired' | 'pending-review';

/** Identity and health documents: personal data, returned only with `employees:read:personal` (plus `documents:read`). */
export const SENSITIVE_DOCUMENT_TYPES: readonly DocumentType[] = ['national-id', 'passport', 'work-permit', 'medical'];

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  name: string;
  type: DocumentType;
  /** File metadata only — the file itself is NOT stored anywhere in this demo. */
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  expiryDate: string | null;
  status: DocumentStatus;
}

export interface DocumentInput {
  name: string;
  type: DocumentType;
  fileName: string;
  sizeBytes: number;
  expiryDate: string | null;
}

/* Employment history --------------------------------------------------------------------------------- */

export type HistoryEventType = 'joined' | 'department-changed' | 'position-changed' | 'manager-changed' | 'status-changed';

export interface EmploymentHistoryEntry {
  id: string;
  employeeId: string;
  type: HistoryEventType;
  /** ISO date the change took effect. */
  date: string;
  /** Previous / new value (names for references, a status key for status changes). */
  from: Localized<string> | null;
  to: Localized<string> | null;
}

/* Lookups -------------------------------------------------------------------------------------------- */

export interface EmployeeOption {
  id: string;
  name: PersonName;
  employeeNumber: string;
  position: NamedRef;
  department: NamedRef;
}

export interface ManagerOptionsQuery {
  search?: string;
  /** Managers must work in this department or one of its parent departments. */
  departmentId?: string;
  /** The employee being edited: excluded together with everyone who reports to them (no cycles). */
  excludeEmployeeId?: string;
}
