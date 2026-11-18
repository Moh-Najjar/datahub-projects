import type { Localized } from '@datahub/shared-types';
import type { Role } from '@/core/config/permissions';

/*
 * Documents contracts — a DRAFT of what the future .NET backend should return. The mock API returns exactly these shapes.
 * Documents Management is the ONE source of truth for HR documents: employee documents, candidate documents (Recruitment),
 * leave attachments (registered from Leave requests, never copied) and payroll supporting documents. Payslips stay in
 * Payroll and are only REFERENCED. Owners are referenced by id (Employee Management / Recruitment own them).
 *
 * FILES ARE SIMULATED in this phase: only metadata is kept, in memory. Nothing is uploaded, stored or downloadable.
 */

export interface NamedRef {
  id: string;
  name: Localized<string>;
}

export type RecordStatus = 'active' | 'inactive';

/** Mirror of Employee Management's contract (kept here so the contract stands alone, like Payroll's). */
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'intern'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/* Categories ------------------------------------------------------------------------------------------------------ */

/** Category groups decide WHO may see a document beyond HR (payroll roles see `payroll`, recruiters `recruitment`). */
export const CATEGORY_GROUPS = ['identity', 'employment', 'education', 'hr', 'leave', 'payroll', 'recruitment'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const CONFIDENTIALITY_LEVELS = ['standard', 'confidential', 'highly-confidential'] as const;
export type Confidentiality = (typeof CONFIDENTIALITY_LEVELS)[number];

export const OWNER_TYPES = ['employee', 'candidate'] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface DocumentCategory {
  id: string;
  code: string;
  name: Localized<string>;
  description: string;
  group: CategoryGroup;
  /** Employees / candidates the category can belong to. */
  appliesTo: OwnerType[];
  /** Candidate documents of this category follow the candidate when they are hired (no copy is made). */
  transferOnHire: boolean;
  /** Generally mandatory (used as a hint; required-document rules decide who must provide it). */
  required: boolean;
  /** An expiry date is required and tracked. */
  tracksExpiry: boolean;
  /** A document number is required and unique within the category (current documents). */
  requiresNumber: boolean;
  allowedFileTypes: FileType[];
  maxFileSizeMb: number;
  /** Employment types the category applies to. */
  employmentTypes: EmploymentType[];
  defaultConfidentiality: Confidentiality;
  /** The owning employee may see their own documents of this category. */
  employeeVisible: boolean;
  /** Department Managers may see their team's documents of this category (standard confidentiality only). */
  managerVisible: boolean;
  status: RecordStatus;
  createdAt: string;
  /** Derived: current (not archived / superseded) documents. */
  documentCount: number;
}

export type CategoryInput = Omit<DocumentCategory, 'id' | 'status' | 'createdAt' | 'documentCount'>;

export interface CategoryFilters {
  status: RecordStatus;
  group: CategoryGroup;
}

export type CategorySortField = 'code' | 'name.en' | 'name.ar' | 'group' | 'status' | 'documentCount';

/* Documents ------------------------------------------------------------------------------------------------------- */

/**
 * Review decision (stored). `expired` is NOT a review decision: it is derived from the expiry date (see
 * `ExpiryStatus`) and shown as the overall `status` — verification and expiry are separate concepts.
 */
export const VERIFICATION_STATUSES = ['pending-review', 'verified', 'rejected', 'archived', 'superseded'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Overall status for lists: the review decision, or `expired` for a pending / verified document past its expiry date. */
export const DOCUMENT_STATUSES = ['pending-review', 'verified', 'rejected', 'expired', 'archived', 'superseded'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const EXPIRY_STATUSES = ['valid', 'expiring-soon', 'expired', 'no-expiry'] as const;
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

/**
 * A file reference. In this phase `storage` is always `simulated`: the browser never sends the content and nothing is
 * stored, so `downloadAvailable` is always false and the UI never shows a download link.
 *
 * FUTURE BACKEND CONTRACT (to be agreed, not implemented): the backend receives the file in an authenticated upload,
 * scans it, stores it encrypted outside the web root and returns `storage: 'server'` + an opaque `fileId`. Downloads go
 * through an authorised request that re-checks the caller's access to the document on every call (short-lived,
 * single-use link), and every download is audited.
 */
export interface FileRef {
  name: string;
  sizeBytes: number;
  type: FileType;
  storage: 'simulated';
  downloadAvailable: false;
}

export interface DocumentOwner {
  type: OwnerType;
  id: string;
  name: Localized<string>;
  /** Employee number, or candidate number. */
  number: string;
  department: NamedRef | null;
  /** Active employee / non-archived candidate: only active owners receive new documents (and replacements). */
  active: boolean;
}

/** Where a document came from when another module produced it (no file is duplicated). */
export interface DocumentSource {
  module: 'leave' | 'recruitment' | 'upload';
  /** Leave request id / candidate id. */
  recordId: string | null;
  /** Human reference (leave request number…). */
  reference: string | null;
}

export type HistoryAction =
  | 'uploaded'
  | 'registered'
  | 'edited'
  | 'verified'
  | 'rejected'
  | 'replacement-requested'
  | 'replacement-uploaded'
  | 'replaces'
  | 'superseded'
  | 'archived'
  | 'note'
  | 'linked-to-employee'
  | 'returned-to-review';

export interface HistoryEntry {
  at: string;
  by: Localized<string>;
  action: HistoryAction;
  /** Rejection / replacement reason, the related document number…; `null` when hidden from the caller (internal). */
  note: string | null;
  /** The related document (replacement / replaced one), if any. */
  relatedId: string | null;
}

export interface InternalNote {
  at: string;
  by: Localized<string>;
  text: string;
}

export interface Review {
  at: string;
  by: Localized<string>;
  decision: 'verified' | 'rejected';
  reason: string | null;
}

export interface DocumentSummary {
  id: string;
  /** System reference, e.g. DOC-001234 (not the number printed on the document). */
  reference: string;
  name: string;
  /** Number printed on the document (passport number…), if any. */
  documentNumber: string | null;
  owner: DocumentOwner;
  category: NamedRef & { code: string; group: CategoryGroup };
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: VerificationStatus;
  expiryStatus: ExpiryStatus;
  status: DocumentStatus;
  /** Days until expiry (negative = days since); `null` without an expiry date. */
  daysRemaining: number | null;
  confidentiality: Confidentiality;
  uploadedAt: string;
  source: DocumentSource;
  replacementRequested: boolean;
  /** Employee the document is linked to after a candidate was hired (owner stays the candidate). */
  linkedEmployeeId: string | null;
}

export interface Document extends DocumentSummary {
  issuingAuthority: string;
  description: string;
  files: FileRef[];
  uploadedBy: Localized<string>;
  updatedAt: string;
  lastReview: Review | null;
  replacementRequest: { at: string; by: Localized<string>; reason: string } | null;
  /** Previous document this one replaces / the document that replaced this one. */
  replaces: { id: string; reference: string } | null;
  replacedBy: { id: string; reference: string } | null;
  /** `null` when the caller may not see internal notes (employees, managers, payroll…). */
  internalNotes: InternalNote[] | null;
  history: HistoryEntry[];
  /** What the caller may do now (computed by the backend from the rules and the caller's permissions). */
  can: { edit: boolean; verify: boolean; reject: boolean; requestReplacement: boolean; replace: boolean; archive: boolean; addNote: boolean; download: false };
}

export interface DocumentFilters {
  categoryId: string;
  group: CategoryGroup;
  ownerType: OwnerType;
  /** Employee or candidate id. */
  ownerId: string;
  departmentId: string;
  status: DocumentStatus;
  expiryStatus: ExpiryStatus;
  /** Uploaded between (inclusive). */
  from: string;
  to: string;
  /** Include archived and superseded documents (default: current only). */
  includeHistorical: 'true';
}

export type DocumentSortField = 'name' | 'reference' | 'owner.name.en' | 'owner.name.ar' | 'category' | 'issueDate' | 'expiryDate' | 'uploadedAt' | 'status';

export interface FileInput {
  name: string;
  sizeBytes: number;
}

export interface DocumentInput {
  ownerType: OwnerType;
  ownerId: string;
  categoryId: string;
  name: string;
  documentNumber: string;
  issueDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string;
  description: string;
  confidentiality: Confidentiality;
  files: FileInput[];
}

/** Metadata edit (files and owner never change; a new file is a replacement). */
export type DocumentUpdate = Omit<DocumentInput, 'ownerType' | 'ownerId' | 'files'>;

/* Required documents and compliance -------------------------------------------------------------------------------- */

export interface RequiredRule {
  id: string;
  name: Localized<string>;
  /** Any ONE of these categories satisfies the rule (e.g. national ID or passport). */
  categories: Array<NamedRef & { code: string }>;
  /** Empty = every employment type. */
  employmentTypes: EmploymentType[];
  employmentStatus: 'active' | 'inactive' | 'any';
  /** Department (with its subdepartments); `null` = every department. */
  department: NamedRef | null;
  status: RecordStatus;
  createdAt: string;
  /** Derived: employees the rule applies to now. */
  applicableEmployees: number;
}

export interface RequiredRuleInput {
  name: Localized<string>;
  categoryIds: string[];
  employmentTypes: EmploymentType[];
  employmentStatus: 'active' | 'inactive' | 'any';
  departmentId: string | null;
}

/**
 * Checklist item status:
 * - `required`: nothing provided yet, within the grace period (30 days after hire or after the rule was created);
 * - `missing`: nothing acceptable after the grace period (rejected documents do not count);
 * - `uploaded`: provided, but HR requested a replacement;
 * - `pending-verification` / `verified`; `expired`: the provided document is past its expiry date.
 * Missing and expired are different: an expired document exists and must be renewed.
 */
export const COMPLIANCE_STATUSES = ['required', 'uploaded', 'pending-verification', 'verified', 'missing', 'expired'] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export interface ComplianceItem {
  rule: { id: string; name: Localized<string> };
  status: ComplianceStatus;
  /** The document that satisfies (or best matches) the rule; `null` when hidden from the caller or missing. */
  document: Pick<DocumentSummary, 'id' | 'reference' | 'name' | 'expiryDate' | 'verificationStatus'> | null;
  /** Last day of the grace period for `required`. */
  dueDate: string | null;
}

export interface EmployeeCompliance {
  employee: { id: string; name: Localized<string>; employeeNumber: string; department: NamedRef };
  items: ComplianceItem[];
  /** Verified (and not expired) ÷ applicable rules, 0–100; `null` when no rule applies. */
  completeness: number | null;
}

export interface ComplianceRow {
  employee: EmployeeCompliance['employee'];
  rule: ComplianceItem['rule'];
  status: ComplianceStatus;
}

/* Expiry, overview ------------------------------------------------------------------------------------------------- */

export const EXPIRY_WINDOWS = ['expired', '7', '30', '60', '90'] as const;
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];

export interface ExpiryFilters {
  window: ExpiryWindow;
  categoryId: string;
  departmentId: string;
}

export interface ExpirySummary {
  thresholdDays: number;
  expired: number;
  within7: number;
  within30: number;
  within60: number;
  within90: number;
  /** Current documents expiring per month, next 12 months (`YYYY-MM`). */
  months: Array<{ month: string; count: number }>;
}

export interface DocumentsOverview {
  totals: { total: number; active: number; expiringSoon: number; expired: number; pendingReview: number; archived: number };
  byCategory: Array<{ category: NamedRef; count: number }>;
  byStatus: Array<{ status: DocumentStatus; count: number }>;
  byDepartment: Array<{ department: NamedRef; count: number }>;
  expiry: ExpirySummary;
  attention: {
    expired: DocumentSummary[];
    expiringSoon: DocumentSummary[];
    pendingReview: DocumentSummary[];
    missing: ComplianceRow[];
    missingTotal: number;
  };
}

export interface DocumentSettings {
  /** Documents expiring within this many days are "expiring soon" (initially 30). */
  expiryWarningDays: number;
  updatedAt: string;
  updatedBy: Localized<string>;
}

/** Payslips are generated by Payroll: Documents only REFERENCES them (links to the Payroll payslip page). */
export interface PayslipReference {
  id: string;
  number: string;
  periodStart: string;
  paymentDate: string;
}

export interface EmployeeDocuments {
  /** The employee as an upload owner (no second employee store: read from Employee Management's records). */
  owner: OwnerOption;
  documents: DocumentSummary[];
  /** `null` when the caller may not see payslips (only payroll roles and the employee themselves). */
  payslips: PayslipReference[] | null;
  compliance: EmployeeCompliance | null;
}

export interface OwnerOption {
  type: OwnerType;
  id: string;
  name: Localized<string>;
  number: string;
  employmentType: EmploymentType | null;
}

/**
 * Who is asking. Access is the UNION of the caller's permissions (computed by the backend from the token): organization
 * documents (documents:read), team documents (documents:read:team), payroll documents (payroll:read), candidate documents
 * (recruitment:read) and own documents (documents:read:own).
 */
export interface DocumentsScope {
  userId: string;
  role: Role;
}
