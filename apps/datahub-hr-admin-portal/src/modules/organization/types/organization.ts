import type { Localized } from '@datahub/shared-types';

/*
 * Organization contracts — a DRAFT of what the future .NET backend should return. The mock API returns
 * exactly these shapes, so replacing it changes no UI code. Names are bilingual (`{ en, ar }`); codes are
 * unique per entity type (case-insensitive) and stored upper-case.
 */

export type RecordStatus = 'active' | 'inactive';

/** A reference to another record, with the display name the list/detail needs (joined by the backend). */
export interface NamedRef {
  id: string;
  name: Localized<string>;
}

/* ------------------------------------------------------------------------------------------------ */
/* Departments                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

export interface Department {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  /** `null` = top-level department. */
  parent: NamedRef | null;
  manager: NamedRef | null;
  status: RecordStatus;
  /** Active employees assigned directly to this unit (computed by the backend from employee records). */
  employeeCount: number;
  /** Direct subdepartments (any status). */
  subdepartmentCount: number;
  /** ISO date-time. */
  createdAt: string;
}

export interface DepartmentFilters {
  status: RecordStatus;
  /** A department id, or `TOP_LEVEL` for departments without a parent. */
  parentId: string;
}

/** `filters.parentId` value selecting top-level departments. */
export const TOP_LEVEL = 'top-level';

export type DepartmentSortField = 'code' | 'name.en' | 'name.ar' | 'employeeCount' | 'status' | 'createdAt';

/** Create/update payload. `status` is changed only through `updateDepartmentStatus`. */
export interface DepartmentInput {
  code: string;
  name: Localized<string>;
  description: string;
  parentId: string | null;
  managerId: string | null;
}

/** One unit of the hierarchy (flat; build the tree with `utils/hierarchy.ts`). */
export interface HierarchyNode {
  id: string;
  code: string;
  name: Localized<string>;
  parentId: string | null;
  manager: NamedRef | null;
  status: RecordStatus;
  employeeCount: number;
}

/* ------------------------------------------------------------------------------------------------ */
/* Positions                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

export const EMPLOYMENT_LEVELS = ['entry', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'executive'] as const;
export type EmploymentLevel = (typeof EMPLOYMENT_LEVELS)[number];

export interface Position {
  id: string;
  code: string;
  title: Localized<string>;
  department: NamedRef;
  description: string;
  level: EmploymentLevel;
  status: RecordStatus;
  createdAt: string;
}

export interface PositionFilters {
  status: RecordStatus;
  departmentId: string;
  level: EmploymentLevel;
}

export type PositionSortField = 'code' | 'title.en' | 'title.ar' | 'level' | 'status' | 'createdAt';

export interface PositionInput {
  code: string;
  title: Localized<string>;
  departmentId: string;
  description: string;
  level: EmploymentLevel;
}

/* ------------------------------------------------------------------------------------------------ */
/* Locations                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

export interface Location {
  id: string;
  code: string;
  name: Localized<string>;
  address: string;
  city: string;
  /** ISO 3166-1 alpha-2 code; display names come from `Intl.DisplayNames`. */
  country: string;
  status: RecordStatus;
  createdAt: string;
}

export interface LocationFilters {
  status: RecordStatus;
  country: string;
}

export type LocationSortField = 'code' | 'name.en' | 'name.ar' | 'city' | 'country' | 'status' | 'createdAt';

export interface LocationInput {
  code: string;
  name: Localized<string>;
  address: string;
  city: string;
  country: string;
}

/* ------------------------------------------------------------------------------------------------ */
/* Overview and lookups                                                                               */
/* ------------------------------------------------------------------------------------------------ */

export interface CountWithActive {
  total: number;
  active: number;
}

export interface OrganizationSummary {
  /** Top-level departments. */
  departments: CountWithActive;
  positions: CountWithActive;
  locations: CountWithActive;
  /** Every unit of the hierarchy: departments and subdepartments at any level. */
  units: CountWithActive;
}

/**
 * A person who can be assigned as department manager. INTERIM: until Employee Management exists this comes
 * from a small fictional list in this module; afterwards it will come from the employees API.
 */
export interface ManagerOption {
  id: string;
  name: Localized<string>;
  jobTitle: Localized<string>;
}

/**
 * Business-rule reasons the API returns in `ApiError.fieldErrors` (code `VALIDATION`), translated by the UI
 * (`organization:serverErrors.<reason>`). Format rules return the schema's reasons (`required`, `codeFormat`…).
 */
export type OrganizationFieldError =
  | 'duplicate'
  | 'circular'
  | 'self'
  | 'inactive'
  | 'not-found'
  | 'active-subdepartments'
  | 'inactive-parent'
  | 'inactive-department';
