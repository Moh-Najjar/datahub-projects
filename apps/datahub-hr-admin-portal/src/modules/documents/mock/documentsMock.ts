import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { leaveData, leaveTypes } from '@/modules/leave/mock/leaveStore';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import { payslipRecords } from '@/modules/payroll/mock/payrollMock';
import { candidateRecords, type CandidateRecord } from '@/modules/recruitment/mock/recruitmentMock';
import { categoryProblems, validateCategoryInput, validateDocumentInput, validateReason, validateRuleInput, type FieldErrors } from '@/modules/documents/schemas/documentSchemas';
import type {
  CategoryFilters,
  CategoryInput,
  ComplianceItem,
  ComplianceRow,
  ComplianceStatus,
  Confidentiality,
  Document,
  DocumentCategory,
  DocumentFilters,
  DocumentInput,
  DocumentOwner,
  DocumentsOverview,
  DocumentSettings,
  DocumentsScope,
  DocumentSource,
  DocumentStatus,
  DocumentSummary,
  DocumentUpdate,
  EmployeeCompliance,
  EmployeeDocuments,
  ExpiryFilters,
  ExpirySummary,
  FileRef,
  HistoryAction,
  HistoryEntry,
  InternalNote,
  NamedRef,
  OwnerOption,
  OwnerType,
  RecordStatus,
  RequiredRule,
  RequiredRuleInput,
  Review,
  VerificationStatus,
} from '@/modules/documents/types/documents';
import { addDays, addMonths, daysBetween, expiryStatusOf, fileTypeOf, isCurrent, overallStatus, todayIso } from '@/modules/documents/utils/rules';
import { CATEGORY_SEED, categoryByCode, CREATED, GRACE_DAYS, RULE_SEED } from './seed';

/*
 * SIMULATED documents backend (in memory, reset on reload) — part of the same simulated backend as the employees,
 * organization, recruitment, leave and payroll mocks. It is the ONE store of document records:
 * - employee documents; candidate documents (Recruitment) — after a hire, categories marked `transferOnHire` are LINKED to
 *   the new employee (no copy); leave attachments are REGISTERED once from Leave requests (same file reference, no copy);
 *   payslips stay in Payroll and are only referenced.
 *
 * Rules the real backend must enforce on every request (frontend checks are not security):
 * - Read access is the UNION of: organization documents (hr.documents.view; highly confidential ones also need
 *   hr.employees.view.personal), team documents (hr.documents.view.team: team members, standard confidentiality,
 *   manager-visible categories), payroll documents (hr.payroll.view: payroll categories, not highly confidential), candidate
 *   documents (recruitment.jobs.view) and own documents (hr.documents.view.own: employee-visible categories). Anything else is
 *   NOT_FOUND (no existence leak). Internal notes only for hr.documents.view (employee documents) / recruitment.jobs.view
 *   (candidate documents).
 * - Writes: hr.documents.manage (employee documents; highly confidential ones need hr.employees.view.personal too),
 *   recruitment.jobs.manage (candidate documents); configuration: hr.documents.config.manage.
 * - Files are SIMULATED: only metadata; `downloadAvailable` is always false.
 */

interface DocRow {
  id: string;
  reference: string;
  ownerType: OwnerType;
  ownerId: string;
  categoryId: string;
  name: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string;
  description: string;
  confidentiality: Confidentiality;
  files: FileRef[];
  verificationStatus: VerificationStatus;
  uploadedAt: string;
  uploadedBy: Localized<string>;
  updatedAt: string;
  lastReview: Review | null;
  replacementRequest: { at: string; by: Localized<string>; reason: string } | null;
  replacesId: string | null;
  replacedById: string | null;
  linkedEmployeeId: string | null;
  source: DocumentSource;
  notes: InternalNote[];
  history: HistoryEntry[];
}

type CategoryRow = Omit<DocumentCategory, 'documentCount'>;

interface RuleRow {
  id: string;
  name: Localized<string>;
  categoryIds: string[];
  employmentTypes: RequiredRule['employmentTypes'];
  employmentStatus: RequiredRule['employmentStatus'];
  departmentId: string | null;
  status: RecordStatus;
  createdAt: string;
}

interface Db {
  settings: DocumentSettings;
  categories: CategoryRow[];
  rules: RuleRow[];
  docs: DocRow[];
  seq: { doc: number; category: number; rule: number };
}

let db: Db | null = null;
/** Leave rows already registered (the list is re-scanned only when it changes). */
let syncedLeave: { rows: unknown; length: number } | null = null;

/** Restore the initial state (tests). Data is regenerated on next use, relative to the current date. */
export function resetDocumentsMock(): void {
  db = null;
  syncedLeave = null;
}

/* Helpers ------------------------------------------------------------------------------------------------------------- */

const SYSTEM: Localized<string> = { en: 'System', ar: 'النظام' };
const nowIso = () => new Date().toISOString();
const pad = (v: number, w: number) => String(v).padStart(w, '0');

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}
function forbidden(message = 'Not allowed for this document'): never {
  throw new ApiError('FORBIDDEN', message);
}
function notFound(what: string, id: string): never {
  throw new ApiError('NOT_FOUND', `${what} ${id} not found`);
}
function conflict(message: string): never {
  throw new ApiError('CONFLICT', message);
}

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Employee = ReturnType<typeof employeeRecords.all>[number];
const empRow = (id: string): Employee | undefined => employeeRecords.get(id);
const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const deptRef = (id: string): NamedRef => ({ id, name: department(id)?.name ?? { en: id, ar: id } });
function topLevel(departmentId: string): string {
  let current = department(departmentId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = department(current.parentId);
  }
  return current?.id ?? departmentId;
}

const meOf = (scope: DocumentsScope) => employeeRecords.employeeIdOf(scope.userId) ?? null;
function actorName(scope: DocumentsScope): Localized<string> {
  const id = meOf(scope);
  const e = id ? empRow(id) : undefined;
  return e ? employeeRecords.fullName(e) : { en: scope.userId, ar: scope.userId };
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}
function page<T>(items: readonly T[], params: ListParams<object>, opts: { search?: (item: T) => string; sort?: (item: T, field: string) => unknown } = {}): Paginated<T> {
  const term = params.search?.trim().toLowerCase();
  let list = term && opts.search ? items.filter((i) => opts.search!(i).toLowerCase().includes(term)) : [...items];
  if (params.sortBy && opts.sort) {
    const sign = params.sortDirection === 'desc' ? -1 : 1;
    const field = params.sortBy;
    list = list.map((item, index) => ({ item, index })).sort((a, b) => sign * compare(opts.sort!(a.item, field), opts.sort!(b.item, field)) || a.index - b.index).map((x) => x.item);
  }
  return queryCollection(list, { page: params.page, pageSize: params.pageSize });
}

/* Access ------------------------------------------------------------------------------------------------------------- */

interface Access {
  org: boolean;
  team: boolean;
  units: Set<string>;
  payroll: boolean;
  candidates: boolean;
  own: boolean;
  me: string | null;
  personal: boolean;
  write: boolean;
  recruitWrite: boolean;
  config: boolean;
  name: Localized<string>;
}

function access(scope: DocumentsScope): Access {
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(scope.role, p);
  const team = can('hr.documents.view.team');
  return {
    org: can('hr.documents.view'),
    team,
    units: team ? employeeRecords.teamUnits(scope.userId) : new Set(),
    payroll: can('hr.payroll.view'),
    candidates: can('recruitment.jobs.view'),
    own: can('hr.documents.view.own'),
    me: meOf(scope),
    personal: can('hr.employees.view.personal'),
    write: can('hr.documents.manage'),
    recruitWrite: can('recruitment.jobs.manage'),
    config: can('hr.documents.config.manage'),
    name: actorName(scope),
  };
}

/** Any document access at all (else FORBIDDEN for list endpoints). */
const anyAccess = (a: Access) => a.org || a.team || a.payroll || a.candidates || a.own;

/** Employee the document belongs to on the employee side (owner, or the employee a hired candidate became). */
const employeeOf = (r: DocRow) => (r.ownerType === 'employee' ? r.ownerId : r.linkedEmployeeId);

function canSee(a: Access, r: DocRow, c: CategoryRow): boolean {
  if (r.ownerType === 'candidate' && a.candidates) return true;
  const employeeId = employeeOf(r);
  if (!employeeId) return false;
  if (a.org && (r.confidentiality !== 'highly-confidential' || a.personal)) return true;
  if (a.own && employeeId === a.me && c.employeeVisible) return true;
  if (a.team && c.managerVisible && r.confidentiality === 'standard' && employeeId !== a.me) {
    const e = empRow(employeeId);
    if (e && a.units.has(e.departmentId)) return true;
  }
  return a.payroll && c.group === 'payroll' && r.confidentiality !== 'highly-confidential';
}

/** Internal notes: HR for employee documents, recruitment for candidate documents — never the owner, managers, payroll. */
const canSeeNotes = (a: Access, r: DocRow) => (r.ownerType === 'candidate' ? a.candidates : a.org && employeeOf(r) !== a.me);

function canWrite(a: Access, r: { ownerType: OwnerType; confidentiality: Confidentiality }): boolean {
  if (r.ownerType === 'candidate') return a.recruitWrite || a.write;
  return a.write && (r.confidentiality !== 'highly-confidential' || a.personal);
}

/* Data ----------------------------------------------------------------------------------------------------------------- */

function data(): Db {
  if (!db) db = generate();
  sync(db);
  return db;
}
const begin = (scope: DocumentsScope) => ({ d: data(), a: access(scope) });
const categoryOf = (d: Db, id: string) => d.categories.find((c) => c.id === id);

function fileRef(name: string, sizeBytes: number): FileRef {
  return { name, sizeBytes, type: fileTypeOf(name) ?? 'pdf', storage: 'simulated', downloadAvailable: false };
}

function newDoc(d: Db, init: Omit<DocRow, 'id' | 'reference' | 'history' | 'notes' | 'lastReview' | 'replacementRequest' | 'replacesId' | 'replacedById' | 'linkedEmployeeId' | 'updatedAt'> & Partial<DocRow>, action: HistoryAction = 'uploaded'): DocRow {
  d.seq.doc++;
  const row: DocRow = {
    id: `doc-${pad(d.seq.doc, 5)}`,
    reference: `DOC-${pad(d.seq.doc, 6)}`,
    lastReview: null,
    replacementRequest: null,
    replacesId: null,
    replacedById: null,
    linkedEmployeeId: null,
    notes: [],
    updatedAt: init.uploadedAt,
    history: [{ at: init.uploadedAt, by: init.uploadedBy, action, note: init.source.reference, relatedId: null }],
    ...init,
  };
  d.docs.push(row);
  return row;
}

/* Integration sync (idempotent): leave attachments and hired candidates ------------------------------------------------ */

function sync(d: Db) {
  // Leave: every non-draft request with an attachment is registered ONCE (the same simulated file, never copied).
  const rows = leaveData.rows();
  if (!syncedLeave || syncedLeave.rows !== rows || syncedLeave.length !== rows.length) {
    const bySource = new Map(d.docs.filter((x) => x.source.module === 'leave').map((x) => [x.source.recordId, x]));
    for (const r of rows) {
      if (!r.document || r.status === 'draft') continue;
      const existing = bySource.get(r.id);
      if (existing) {
        if (existing.files[0]?.name !== r.document.fileName) {
          existing.files = [fileRef(r.document.fileName, r.document.sizeBytes)];
          existing.updatedAt = nowIso();
          existing.history.push({ at: existing.updatedAt, by: SYSTEM, action: 'edited', note: r.number, relatedId: null });
        }
        continue;
      }
      const type = leaveTypes.all().find((x) => x.id === r.leaveTypeId);
      const code = type?.code === 'SICK' ? 'SICK-CERT' : type?.code === 'MATERN' ? 'MEDICAL-REPORT' : 'LEAVE-SUPPORT';
      const cat = categoryByCode(code);
      const at = r.submittedAt ?? r.createdAt;
      const row = newDoc(
        d,
        {
          ownerType: 'employee',
          ownerId: r.employeeId,
          categoryId: cat.id,
          name: `${type?.name.en ?? 'Leave'} — ${r.number}`,
          documentNumber: null,
          issueDate: null,
          expiryDate: null,
          issuingAuthority: '',
          description: '',
          confidentiality: cat.defaultConfidentiality,
          files: [fileRef(r.document.fileName, r.document.sizeBytes)],
          verificationStatus: r.status === 'approved' ? 'verified' : 'pending-review',
          uploadedAt: at,
          uploadedBy: r.employee.name,
          source: { module: 'leave', recordId: r.id, reference: r.number },
        },
        'registered',
      );
      if (r.status === 'approved' && r.decidedAt) {
        row.lastReview = { at: r.decidedAt, by: r.decidedBy ?? SYSTEM, decision: 'verified', reason: null };
        row.history.push({ at: r.decidedAt, by: r.decidedBy ?? SYSTEM, action: 'verified', note: r.number, relatedId: null });
      }
    }
    syncedLeave = { rows, length: rows.length };
  }
  // Recruitment: once a candidate is hired, transferable documents are LINKED to the new employee (owner stays).
  const hired = new Map(candidateRecords.all().filter((c) => c.employeeId).map((c) => [c.id, c]));
  for (const row of d.docs) {
    if (row.ownerType !== 'candidate' || row.linkedEmployeeId) continue;
    const c = hired.get(row.ownerId);
    if (!c?.employeeId || !categoryOf(d, row.categoryId)?.transferOnHire) continue;
    row.linkedEmployeeId = c.employeeId;
    const e = empRow(c.employeeId);
    row.history.push({ at: c.convertedAt ?? nowIso(), by: SYSTEM, action: 'linked-to-employee', note: e?.employeeNumber ?? c.employeeId, relatedId: null });
  }
}

/* Seed ------------------------------------------------------------------------------------------------------------------- */

function generate(): Db {
  const today = todayIso();
  const d: Db = {
    settings: { expiryWarningDays: 30, updatedAt: CREATED, updatedBy: SYSTEM },
    categories: CATEGORY_SEED.map((c) => ({ ...c, name: { ...c.name }, appliesTo: [...c.appliesTo], allowedFileTypes: [...c.allowedFileTypes], employmentTypes: [...c.employmentTypes] })),
    rules: RULE_SEED.map((r) => ({ id: r.id, name: r.name, categoryIds: r.categoryCodes.map((code) => categoryByCode(code).id), employmentTypes: [...r.employmentTypes], employmentStatus: r.employmentStatus, departmentId: r.departmentId, status: 'active', createdAt: CREATED })),
    docs: [],
    seq: { doc: 0, category: CATEGORY_SEED.length, rule: RULE_SEED.length },
  };
  const hrEmp = empRow('emp-0002');
  const hr = hrEmp ? employeeRecords.fullName(hrEmp) : { en: 'HR Administrator', ar: 'مسؤول الموارد البشرية' };
  const at = (date: string, hour = 10) => {
    const [y, m, dd] = date.split('-').map(Number) as [number, number, number];
    const v = new Date(y, m - 1, dd, hour);
    return (v.getTime() > Date.now() ? new Date(Date.now() - 3_600_000) : v).toISOString();
  };
  const clampPast = (date: string) => (date > today ? today : date);
  const upload = (source: DocumentSource = { module: 'upload', recordId: null, reference: null }) => source;

  const verify = (row: DocRow, when: string) => {
    row.verificationStatus = 'verified';
    row.lastReview = { at: when, by: hr, decision: 'verified', reason: null };
    row.history.push({ at: when, by: hr, action: 'verified', note: null, relatedId: null });
  };
  /** Review outcome for a seeded document: mostly verified, some pending, rejected or with a replacement request. */
  const review = (row: DocRow, r: () => number, uploaded: string) => {
    const p = r();
    const when = at(clampPast(addDays(uploaded, 2)), 14);
    if (p < 0.84) verify(row, when);
    else if (p < 0.92) {
      // Pending review: recent uploads (nothing waits for years in the demo).
      const recent = at(addDays(today, -1 - Math.floor(r() * 25)), 9);
      row.uploadedAt = recent;
      row.updatedAt = recent;
      row.history[0]!.at = recent;
    }
    else if (p < 0.96) {
      row.verificationStatus = 'rejected';
      row.lastReview = { at: when, by: hr, decision: 'rejected', reason: 'The scan is not readable. Please provide a clearer copy.' };
      row.history.push({ at: when, by: hr, action: 'rejected', note: row.lastReview.reason, relatedId: null });
    } else {
      verify(row, when);
      const reqAt = at(clampPast(addDays(uploaded, 30)), 11);
      row.replacementRequest = { at: reqAt, by: hr, reason: 'Please provide an updated copy.' };
      row.history.push({ at: reqAt, by: hr, action: 'replacement-requested', note: row.replacementRequest.reason, relatedId: null });
    }
  };
  const add = (e: { id: string }, ownerType: OwnerType, code: string, name: string, uploadedOn: string, o: { number?: string | null; issue?: string | null; expiry?: string | null; authority?: string; file?: string; reviewWith?: () => number } = {}) => {
    const cat = categoryByCode(code);
    const uploadedAt = at(clampPast(uploadedOn));
    const row = newDoc(d, {
      ownerType,
      ownerId: e.id,
      categoryId: cat.id,
      name,
      documentNumber: o.number ?? null,
      issueDate: o.issue ?? null,
      expiryDate: o.expiry ?? null,
      issuingAuthority: o.authority ?? '',
      description: '',
      confidentiality: cat.defaultConfidentiality,
      files: [fileRef(o.file ?? `${code.toLowerCase()}-${e.id}.pdf`, 60_000 + Math.floor(prng(hashString(`${e.id}|${code}`))() * 2_400_000))],
      verificationStatus: 'pending-review',
      uploadedAt,
      uploadedBy: hr,
      source: upload(),
    });
    if (o.reviewWith) review(row, o.reviewWith, uploadedAt.slice(0, 10));
    return row;
  };

  for (const e of employeeRecords.all()) {
    const r = prng(hashString(`docs|${e.id}`));
    const newHire = daysBetween(e.hireDate, today) < 21;
    const top = topLevel(e.departmentId);
    const n = e.employeeNumber;
    // Employment contract (new hires sometimes still missing it).
    if (!newHire || r() < 0.5) add(e, 'employee', 'EMP-CONTRACT', 'Employment contract', e.hireDate, { issue: clampPast(e.hireDate), expiry: e.contractEndDate, number: `CT-${n}`, authority: 'Human Resources', file: `contract-${n}.pdf`, reviewWith: r });
    // Identity: national ID or passport; some expired — part of them already replaced (old one superseded).
    const foreign = e.nationality !== 'JO';
    const code = foreign ? 'PASSPORT' : 'NATIONAL-ID';
    const issue = addDays(today, -1200 - Math.floor(r() * 1500));
    const expiry = addDays(today, Math.floor(r() * 1500) - 140);
    if (!newHire || r() < 0.6) {
      const id = add(e, 'employee', code, foreign ? 'Passport' : 'National ID', addDays(e.hireDate, 1), { issue, expiry, number: foreign ? `P${pad(hashString(n) % 10_000_000, 7)}` : String(9_000_000_000 + (hashString(n) % 999_999_999)), authority: foreign ? 'Passport authority' : 'Civil Status Department', file: `${code.toLowerCase()}-${n}.pdf`, reviewWith: r });
      if (expiry < today && r() < 0.45) {
        const newer = add(e, 'employee', code, foreign ? 'Passport (renewed)' : 'National ID (renewed)', clampPast(addDays(expiry, 10)), { issue: clampPast(addDays(expiry, 5)), expiry: addDays(expiry, 3650), number: `${id.documentNumber}R`, authority: id.issuingAuthority, file: `${code.toLowerCase()}-${n}-renewed.pdf` });
        newer.replacesId = id.id;
        newer.history.push({ at: newer.uploadedAt, by: hr, action: 'replaces', note: id.reference, relatedId: id.id });
        verify(newer, newer.uploadedAt);
        id.replacedById = newer.id;
        id.verificationStatus = 'superseded';
        id.replacementRequest = null;
        id.history.push({ at: newer.uploadedAt, by: hr, action: 'superseded', note: newer.reference, relatedId: newer.id });
      }
    }
    if (foreign) add(e, 'employee', 'WORK-PERMIT', 'Work permit', addDays(e.hireDate, 14), { issue: clampPast(addDays(e.hireDate, 7)), expiry: addDays(today, Math.floor(r() * 700) - 60), number: `WP-${n}`, authority: 'Ministry of Labour', reviewWith: r });
    if (top === 'dep-eng' ? r() < 0.88 : r() < 0.4) add(e, 'employee', 'UNIVERSITY-DEGREE', 'University degree', addDays(e.hireDate, 3), { issue: addDays(e.hireDate, -800), authority: 'University', reviewWith: r });
    if (r() < 0.22) add(e, 'employee', 'TRAINING-CERT', 'Training certificate', addDays(e.hireDate, 200), { issue: clampPast(addDays(e.hireDate, 190)), authority: 'Training provider', reviewWith: r });
    if ((top === 'dep-it' || top === 'dep-fin') && r() < 0.3) add(e, 'employee', 'PROF-LICENCE', 'Professional licence', addDays(e.hireDate, 30), { issue: clampPast(addDays(e.hireDate, 20)), expiry: addDays(today, Math.floor(r() * 900) - 30), number: `PL-${n}`, authority: 'Professional association', reviewWith: r });
    if (!newHire ? r() < 0.88 : r() < 0.3) add(e, 'employee', 'EMERGENCY-FORM', 'Emergency contact form', addDays(e.hireDate, 2), { issue: clampPast(addDays(e.hireDate, 2)), reviewWith: r });
    if (!newHire ? r() < 0.9 : r() < 0.4) add(e, 'employee', 'HANDBOOK-ACK', 'Handbook acknowledgement', addDays(e.hireDate, 5), { issue: clampPast(addDays(e.hireDate, 5)), reviewWith: r });
    if (e.departmentId === 'dep-ops-log' && r() < 0.75) add(e, 'employee', 'DRIVING-LICENCE', 'Driving licence', addDays(e.hireDate, 4), { issue: addDays(e.hireDate, -400), expiry: addDays(today, Math.floor(r() * 1200) - 45), number: `DL-${n}`, authority: 'Licensing department', reviewWith: r });
    if (r() < 0.07) add(e, 'employee', 'SALARY-CERT', 'Salary certificate', addDays(today, -Math.floor(r() * 300) - 5), { issue: addDays(today, -Math.floor(r() * 300) - 5), authority: 'Human Resources', reviewWith: r });
    if (r() < 0.05) add(e, 'employee', 'SALARY-SUPPORT', 'Allowance approval', addDays(today, -Math.floor(r() * 200) - 5), { issue: addDays(today, -Math.floor(r() * 200) - 5), reviewWith: r });
    if (e.status === 'inactive') add(e, 'employee', 'TERMINATION-LETTER', 'Termination letter', addDays(today, -Math.floor(r() * 200) - 15), { reviewWith: r });
    // A few archived documents (e.g. an outdated form), kept as history.
    if (r() < 0.03) {
      const old = add(e, 'employee', 'HR-FORM', 'Outdated HR form', addDays(e.hireDate, 10), { issue: clampPast(addDays(e.hireDate, 10)) });
      old.verificationStatus = 'archived';
      old.history.push({ at: at(clampPast(addDays(e.hireDate, 400))), by: hr, action: 'archived', note: 'Replaced by the current form.', relatedId: null });
    }
  }

  // Candidates: CVs for everyone, certificates and identity documents for later stages (hired ones are linked by sync).
  const advanced = new Set(['offer', 'hired', 'interview', 'assessment']);
  for (const c of candidateRecords.all() as CandidateRecord[]) {
    const r = prng(hashString(`cand-docs|${c.id}`));
    const day = c.appliedAt.slice(0, 10);
    add(c, 'candidate', 'CV', 'CV', day, { file: `cv-${c.number}.pdf`, reviewWith: () => 0.5 });
    if (r() < 0.25) add(c, 'candidate', 'PORTFOLIO', 'Portfolio', day, { file: `portfolio-${c.number}.pdf` });
    if (r() < 0.35) add(c, 'candidate', 'PROFESSIONAL-CERT', 'Professional certificate', addDays(day, 1), { issue: addDays(day, -500), authority: 'Certification body', reviewWith: r });
    if (advanced.has(c.stage) || c.employeeId) add(c, 'candidate', 'UNIVERSITY-DEGREE', 'University degree', addDays(day, 2), { issue: addDays(day, -1500), authority: 'University', reviewWith: () => 0.3 });
  }
  return d;
}

/* Mapping ---------------------------------------------------------------------------------------------------------------- */

function ownerOf(r: DocRow): DocumentOwner {
  if (r.ownerType === 'employee') {
    const e = empRow(r.ownerId);
    return e ? { type: 'employee', id: e.id, name: employeeRecords.fullName(e), number: e.employeeNumber, department: deptRef(e.departmentId), active: e.status === 'active' } : { type: 'employee', id: r.ownerId, name: { en: r.ownerId, ar: r.ownerId }, number: '', department: null, active: false };
  }
  const c = candidateRecords.all().find((x) => x.id === r.ownerId);
  return c ? { type: 'candidate', id: c.id, name: c.name, number: c.number, department: c.departmentId ? deptRef(c.departmentId) : null, active: !c.archived } : { type: 'candidate', id: r.ownerId, name: { en: r.ownerId, ar: r.ownerId }, number: '', department: null, active: false };
}

/** Candidate lookups are cached per request (the candidate list is rebuilt per call). */
function owners(): (r: DocRow) => DocumentOwner {
  const cand = new Map(candidateRecords.all().map((c) => [c.id, c]));
  return (r) => {
    if (r.ownerType === 'employee') return ownerOf(r);
    const c = cand.get(r.ownerId);
    return c ? { type: 'candidate', id: c.id, name: c.name, number: c.number, department: c.departmentId ? deptRef(c.departmentId) : null, active: !c.archived } : ownerOf(r);
  };
}

function toSummary(d: Db, r: DocRow, owner: DocumentOwner, today = todayIso()): DocumentSummary {
  const c = categoryOf(d, r.categoryId)!;
  const expiryStatus = expiryStatusOf(r.expiryDate, today, d.settings.expiryWarningDays);
  return {
    id: r.id,
    reference: r.reference,
    name: r.name,
    documentNumber: r.documentNumber,
    owner,
    category: { id: c.id, code: c.code, name: c.name, group: c.group },
    issueDate: r.issueDate,
    expiryDate: r.expiryDate,
    verificationStatus: r.verificationStatus,
    expiryStatus,
    status: overallStatus(r.verificationStatus, expiryStatus),
    daysRemaining: r.expiryDate ? daysBetween(today, r.expiryDate) : null,
    confidentiality: r.confidentiality,
    uploadedAt: r.uploadedAt,
    source: r.source,
    replacementRequested: r.replacementRequest !== null,
    linkedEmployeeId: r.linkedEmployeeId,
  };
}

const HIDDEN_FOR_OWNER: readonly HistoryAction[] = ['note'];

function toDocument(d: Db, a: Access, r: DocRow): Document {
  const notes = canSeeNotes(a, r);
  const writable = canWrite(a, r);
  const today = todayIso();
  const s = toSummary(d, r, ownerOf(r), today);
  const ref = (id: string | null) => {
    const x = id ? d.docs.find((y) => y.id === id) : undefined;
    return x && canSee(a, x, categoryOf(d, x.categoryId)!) ? { id: x.id, reference: x.reference } : null;
  };
  const current = isCurrent(r.verificationStatus);
  return {
    ...s,
    issuingAuthority: r.issuingAuthority,
    description: r.description,
    files: r.files,
    uploadedBy: r.uploadedBy,
    updatedAt: r.updatedAt,
    lastReview: r.lastReview,
    replacementRequest: r.replacementRequest,
    replaces: ref(r.replacesId),
    replacedBy: ref(r.replacedById),
    internalNotes: notes ? r.notes : null,
    // Internal notes are history entries too: hidden (with their text) from anyone who may not see notes.
    history: [...r.history].reverse().filter((h) => notes || !HIDDEN_FOR_OWNER.includes(h.action)),
    can: {
      edit: writable && current,
      verify: writable && r.verificationStatus === 'pending-review' && s.expiryStatus !== 'expired',
      reject: writable && r.verificationStatus === 'pending-review',
      requestReplacement: writable && (r.verificationStatus === 'verified' || r.verificationStatus === 'rejected') && r.replacementRequest === null && r.replacedById === null,
      replace: writable && current && r.replacedById === null && s.owner.active,
      archive: writable && current,
      addNote: writable && notes,
      download: false,
    },
  };
}

/* Documents ------------------------------------------------------------------------------------------------------------------ */

/** Visible rows (with their category) for the caller. */
function visible(d: Db, a: Access): Array<{ r: DocRow; c: CategoryRow }> {
  return d.docs.flatMap((r) => {
    const c = categoryOf(d, r.categoryId);
    return c && canSee(a, r, c) ? [{ r, c }] : [];
  });
}

function getVisibleRow(d: Db, a: Access, id: string): DocRow {
  const r = d.docs.find((x) => x.id === id);
  // Not visible → NOT_FOUND: the API never reveals that a document exists.
  if (!r || !canSee(a, r, categoryOf(d, r.categoryId)!)) notFound('Document', id);
  return r;
}

function summaries(d: Db, a: Access, f: Partial<DocumentFilters>): DocumentSummary[] {
  const today = todayIso();
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const ownerFor = owners();
  return visible(d, a)
    .filter(({ r, c }) => (f.includeHistorical === 'true' || f.status === 'archived' || f.status === 'superseded' || isCurrent(r.verificationStatus)) && (!f.categoryId || r.categoryId === f.categoryId) && (!f.group || c.group === f.group) && (!f.ownerType || r.ownerType === f.ownerType) && (!f.ownerId || r.ownerId === f.ownerId || r.linkedEmployeeId === f.ownerId) && (!f.from || r.uploadedAt.slice(0, 10) >= f.from) && (!f.to || r.uploadedAt.slice(0, 10) <= f.to))
    .map(({ r }) => toSummary(d, r, ownerFor(r), today))
    .filter((s) => (!units || (s.owner.department !== null && units.has(s.owner.department.id))) && (!f.status || s.status === f.status) && (!f.expiryStatus || s.expiryStatus === f.expiryStatus));
}

const summarySort = (s: DocumentSummary, field: string) =>
  field === 'owner.name.en' ? s.owner.name.en : field === 'owner.name.ar' ? s.owner.name.ar : field === 'category' ? s.category.code : (s as unknown as Record<string, unknown>)[field];
const summarySearch = (s: DocumentSummary) => `${s.name} ${s.reference} ${s.documentNumber ?? ''} ${s.owner.name.en} ${s.owner.name.ar} ${s.owner.number} ${s.source.reference ?? ''}`;

export function listDocuments(params: ListParams<DocumentFilters>, scope: DocumentsScope): Paginated<DocumentSummary> {
  const { d, a } = begin(scope);
  if (!anyAccess(a)) forbidden();
  const rows = summaries(d, a, params.filters ?? {}).sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
  return page(rows, params, { search: summarySearch, sort: summarySort });
}

export function getDocument(id: string, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  return toDocument(d, a, getVisibleRow(d, a, id));
}

export function documentHistory(id: string, scope: DocumentsScope): HistoryEntry[] {
  return getDocument(id, scope).history;
}

function resolveOwner(type: OwnerType, id: string): { department: string | null; employmentType: Employee['employmentType'] | null; active: boolean } {
  if (type === 'employee') {
    const e = empRow(id);
    if (!e) invalid({ ownerId: ['required'] });
    return { department: e.departmentId, employmentType: e.employmentType, active: e.status === 'active' };
  }
  const c = candidateRecords.all().find((x) => x.id === id);
  if (!c) invalid({ ownerId: ['required'] });
  return { department: c.departmentId, employmentType: null, active: !c.archived };
}

function checkMetadata(d: Db, input: DocumentUpdate & { files?: DocumentInput['files'] }, owner: { type: OwnerType; employmentType: Employee['employmentType'] | null; active: boolean }, exceptId?: string, replacingId?: string): CategoryRow {
  const errors = validateDocumentInput(input as DocumentInput) ?? {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  const c = categoryOf(d, input.categoryId);
  if (!c) add('categoryId', 'required');
  else {
    if (c.status !== 'active') add('categoryId', 'categoryInactive');
    if (!c.appliesTo.includes(owner.type)) add('categoryId', 'notForOwner');
    else if (owner.employmentType && !c.employmentTypes.includes(owner.employmentType)) add('categoryId', 'notEligible');
    for (const [field, reasons] of Object.entries(categoryProblems({ issueDate: input.issueDate, expiryDate: input.expiryDate, documentNumber: input.documentNumber ?? '', files: input.files }, c, todayIso()) ?? {})) for (const reason of reasons) add(field, reason);
    const number = input.documentNumber?.trim();
    if (c.requiresNumber && number && d.docs.some((x) => x.id !== exceptId && x.id !== replacingId && x.categoryId === c.id && isCurrent(x.verificationStatus) && x.documentNumber?.toUpperCase() === number.toUpperCase())) add('documentNumber', 'duplicateNumber');
  }
  if (!owner.active) add('ownerId', 'ownerInactive');
  if (Object.keys(errors).length) invalid(errors);
  return c!;
}

/** SIMULATED upload: only metadata is stored (in memory); no file content ever reaches this backend. */
export function createDocument(input: DocumentInput, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  if (!canWrite(a, { ownerType: input.ownerType, confidentiality: input.confidentiality })) forbidden();
  const owner = resolveOwner(input.ownerType, input.ownerId);
  checkMetadata(d, input, { type: input.ownerType, ...owner });
  const row = newDoc(d, {
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    categoryId: input.categoryId,
    name: input.name.trim(),
    documentNumber: input.documentNumber.trim() || null,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    issuingAuthority: input.issuingAuthority.trim(),
    description: input.description.trim(),
    confidentiality: input.confidentiality,
    files: input.files.map((f) => fileRef(f.name, f.sizeBytes)),
    verificationStatus: 'pending-review',
    uploadedAt: nowIso(),
    uploadedBy: a.name,
    source: { module: 'upload', recordId: null, reference: null },
  });
  return toDocument(d, a, row);
}

/** Metadata edit. Changing what verification relied on (category, number, dates) returns a verified document to review. */
export function updateDocument(id: string, input: DocumentUpdate, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const r = getVisibleRow(d, a, id);
  if (!canWrite(a, r) || !canWrite(a, { ownerType: r.ownerType, confidentiality: input.confidentiality })) forbidden();
  if (!isCurrent(r.verificationStatus)) invalid({ status: ['notEditable'] });
  const owner = resolveOwner(r.ownerType, r.ownerId);
  checkMetadata(d, input, { type: r.ownerType, ...owner, active: true }, r.id);
  const at = nowIso();
  const keyChanged = r.categoryId !== input.categoryId || (r.documentNumber ?? '') !== input.documentNumber.trim() || r.issueDate !== input.issueDate || r.expiryDate !== input.expiryDate;
  Object.assign(r, { categoryId: input.categoryId, name: input.name.trim(), documentNumber: input.documentNumber.trim() || null, issueDate: input.issueDate, expiryDate: input.expiryDate, issuingAuthority: input.issuingAuthority.trim(), description: input.description.trim(), confidentiality: input.confidentiality, updatedAt: at });
  r.history.push({ at, by: a.name, action: 'edited', note: null, relatedId: null });
  if (keyChanged && r.verificationStatus === 'verified') {
    r.verificationStatus = 'pending-review';
    r.history.push({ at, by: a.name, action: 'returned-to-review', note: null, relatedId: null });
  }
  return toDocument(d, a, r);
}

export function archiveDocument(id: string, reason: string, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const r = getVisibleRow(d, a, id);
  if (!canWrite(a, r)) forbidden();
  if (!isCurrent(r.verificationStatus)) invalid({ status: ['alreadyHistorical'] });
  const errors = validateReason(reason);
  if (errors) invalid(errors);
  const at = nowIso();
  Object.assign(r, { verificationStatus: 'archived', updatedAt: at, replacementRequest: null });
  r.history.push({ at, by: a.name, action: 'archived', note: reason.trim(), relatedId: null });
  return toDocument(d, a, r);
}

export function verifyDocument(id: string, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const r = getVisibleRow(d, a, id);
  if (!canWrite(a, r)) forbidden();
  if (r.verificationStatus !== 'pending-review') invalid({ status: [r.verificationStatus === 'archived' || r.verificationStatus === 'superseded' ? 'historicalCannotVerify' : 'notPending'] });
  if (expiryStatusOf(r.expiryDate, todayIso(), d.settings.expiryWarningDays) === 'expired') invalid({ status: ['expiredCannotVerify'] });
  const at = nowIso();
  r.verificationStatus = 'verified';
  r.lastReview = { at, by: a.name, decision: 'verified', reason: null };
  r.updatedAt = at;
  r.history.push({ at, by: a.name, action: 'verified', note: null, relatedId: null });
  // A verified replacement supersedes the document it replaces (kept, linked, never deleted).
  const old = r.replacesId ? d.docs.find((x) => x.id === r.replacesId) : undefined;
  if (old && isCurrent(old.verificationStatus)) {
    old.verificationStatus = 'superseded';
    old.replacementRequest = null;
    old.updatedAt = at;
    old.history.push({ at, by: a.name, action: 'superseded', note: r.reference, relatedId: r.id });
  }
  return toDocument(d, a, r);
}

export function rejectDocument(id: string, reason: string, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const r = getVisibleRow(d, a, id);
  if (!canWrite(a, r)) forbidden();
  const errors = validateReason(reason);
  if (errors) invalid(errors);
  if (r.verificationStatus !== 'pending-review') invalid({ status: ['notPending'] });
  const at = nowIso();
  r.verificationStatus = 'rejected';
  r.lastReview = { at, by: a.name, decision: 'rejected', reason: reason.trim() };
  r.updatedAt = at;
  r.history.push({ at, by: a.name, action: 'rejected', note: reason.trim(), relatedId: null });
  return toDocument(d, a, r);
}

export function requestReplacement(id: string, reason: string, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const r = getVisibleRow(d, a, id);
  if (!canWrite(a, r)) forbidden();
  const errors = validateReason(reason);
  if (errors) invalid(errors);
  if (!(r.verificationStatus === 'verified' || r.verificationStatus === 'rejected') || r.replacementRequest || r.replacedById) invalid({ status: ['cannotRequestReplacement'] });
  const at = nowIso();
  r.replacementRequest = { at, by: a.name, reason: reason.trim() };
  r.updatedAt = at;
  r.history.push({ at, by: a.name, action: 'replacement-requested', note: reason.trim(), relatedId: null });
  return toDocument(d, a, r);
}

export function addNote(id: string, text: string, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const r = getVisibleRow(d, a, id);
  if (!canWrite(a, r) || !canSeeNotes(a, r)) forbidden();
  const errors = validateReason(text, 'note');
  if (errors) invalid(errors);
  const at = nowIso();
  r.notes.push({ at, by: a.name, text: text.trim() });
  r.history.push({ at, by: a.name, action: 'note', note: text.trim(), relatedId: null });
  return toDocument(d, a, r);
}

/**
 * Upload a replacement (new document linked to the previous one). The previous document stays as it is until the
 * replacement is VERIFIED, then becomes `superseded` — nothing is deleted.
 */
export function replaceDocument(id: string, input: Omit<DocumentInput, 'ownerType' | 'ownerId'>, scope: DocumentsScope): Document {
  const { d, a } = begin(scope);
  const old = getVisibleRow(d, a, id);
  if (!canWrite(a, old)) forbidden();
  if (!isCurrent(old.verificationStatus) || old.replacedById) invalid({ status: ['cannotReplace'] });
  const owner = resolveOwner(old.ownerType, old.ownerId);
  checkMetadata(d, input, { type: old.ownerType, ...owner }, undefined, old.id);
  const at = nowIso();
  const row = newDoc(d, {
    ownerType: old.ownerType,
    ownerId: old.ownerId,
    categoryId: input.categoryId,
    name: input.name.trim(),
    documentNumber: input.documentNumber.trim() || null,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    issuingAuthority: input.issuingAuthority.trim(),
    description: input.description.trim(),
    confidentiality: input.confidentiality,
    files: input.files.map((f) => fileRef(f.name, f.sizeBytes)),
    verificationStatus: 'pending-review',
    uploadedAt: at,
    uploadedBy: a.name,
    source: { module: 'upload', recordId: null, reference: null },
  });
  row.replacesId = old.id;
  row.linkedEmployeeId = old.linkedEmployeeId;
  row.history.push({ at, by: a.name, action: 'replaces', note: old.reference, relatedId: old.id });
  old.replacedById = row.id;
  old.updatedAt = at;
  old.history.push({ at, by: a.name, action: 'replacement-uploaded', note: row.reference, relatedId: row.id });
  return toDocument(d, a, row);
}

/* Owners ------------------------------------------------------------------------------------------------------------------------ */

function ownerVisible(a: Access, type: OwnerType, id: string): boolean {
  if (type === 'candidate') return a.candidates;
  if (a.org || a.payroll) return true;
  if (a.own && id === a.me) return true;
  const e = empRow(id);
  return a.team && Boolean(e && a.units.has(e.departmentId));
}

export function employeeDocuments(employeeId: string, scope: DocumentsScope): EmployeeDocuments {
  const { d, a } = begin(scope);
  const e = empRow(employeeId) ?? notFound('Employee', employeeId);
  if (!ownerVisible(a, 'employee', employeeId)) forbidden();
  const documents = summaries(d, a, { ownerId: employeeId, includeHistorical: 'true' })
    .filter((s) => s.owner.type === 'employee' || s.linkedEmployeeId === employeeId)
    .sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
  // Payslips: Payroll's own records, referenced only for payroll roles and the employee themselves.
  const payslips = a.payroll || (employeeId === a.me && hasPermission(scope.role, 'hr.payroll.view.own')) ? payslipRecords.forEmployee(employeeId) : null;
  const compliance = a.org || a.team || employeeId === a.me ? complianceOf(d, a, e) : null;
  return { owner: { type: 'employee', id: e.id, name: employeeRecords.fullName(e), number: e.employeeNumber, employmentType: e.employmentType }, documents, payslips, compliance };
}

export function candidateDocuments(candidateId: string, scope: DocumentsScope): DocumentSummary[] {
  const { d, a } = begin(scope);
  if (!a.candidates) forbidden('recruitment.jobs.view is required');
  if (!candidateRecords.all().some((c) => c.id === candidateId)) notFound('Candidate', candidateId);
  return summaries(d, a, { ownerType: 'candidate', ownerId: candidateId, includeHistorical: 'true' }).sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
}

/** Owners the caller may attach documents to (upload form). */
export function ownerOptions(search: string, type: OwnerType, scope: DocumentsScope): OwnerOption[] {
  const { a } = begin(scope);
  const term = search.trim().toLowerCase();
  if (type === 'candidate') {
    if (!a.candidates) forbidden();
    return candidateRecords
      .all()
      .filter((c) => !c.archived && (!term || `${c.name.en} ${c.name.ar} ${c.number}`.toLowerCase().includes(term)))
      .slice(0, 25)
      .map((c) => ({ type: 'candidate', id: c.id, name: c.name, number: c.number, employmentType: null }));
  }
  if (!anyAccess(a)) forbidden();
  return employeeRecords
    .all()
    .filter((e) => ownerVisible(a, 'employee', e.id) && (!term || `${employeeRecords.fullName(e).en} ${employeeRecords.fullName(e).ar} ${e.employeeNumber}`.toLowerCase().includes(term)))
    .sort((x, y) => x.employeeNumber.localeCompare(y.employeeNumber))
    .slice(0, 25)
    .map((e) => ({ type: 'employee', id: e.id, name: employeeRecords.fullName(e), number: e.employeeNumber, employmentType: e.employmentType }));
}

/* Categories ------------------------------------------------------------------------------------------------------------------- */

function toCategory(d: Db, c: CategoryRow): DocumentCategory {
  return { ...c, documentCount: d.docs.filter((x) => x.categoryId === c.id && isCurrent(x.verificationStatus)).length };
}

/** Categories are configuration: readable by anyone with document access (needed for filters and uploads). */
export function listCategories(params: ListParams<CategoryFilters>, scope: DocumentsScope): Paginated<DocumentCategory> {
  const { d, a } = begin(scope);
  if (!anyAccess(a)) forbidden();
  const f = params.filters ?? {};
  const rows = d.categories.filter((c) => (!f.status || c.status === f.status) && (!f.group || c.group === f.group)).map((c) => toCategory(d, c));
  return page(rows, params, { search: (c) => `${c.code} ${c.name.en} ${c.name.ar}`, sort: (c, field) => (field === 'name.en' ? c.name.en : field === 'name.ar' ? c.name.ar : (c as unknown as Record<string, unknown>)[field]) });
}

function checkCategory(d: Db, input: CategoryInput, exceptId?: string) {
  const errors = validateCategoryInput(input) ?? {};
  if (d.categories.some((c) => c.id !== exceptId && c.code.toUpperCase() === input.code?.toUpperCase())) errors.code = [...(errors.code ?? []), 'duplicateCode'];
  if (Object.keys(errors).length) invalid(errors);
}

export function createCategory(input: CategoryInput, scope: DocumentsScope): DocumentCategory {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  checkCategory(d, input);
  d.seq.category++;
  const row: CategoryRow = { ...input, id: `cat-${pad(d.seq.category, 2)}`, status: 'active', createdAt: nowIso() };
  d.categories.push(row);
  return toCategory(d, row);
}

/** Existing documents keep their metadata; new rules (file types, size, expiry) apply to new uploads and edits. */
export function updateCategory(id: string, input: CategoryInput, scope: DocumentsScope): DocumentCategory {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  const c = d.categories.find((x) => x.id === id) ?? notFound('Category', id);
  checkCategory(d, input, id);
  // Owners already holding documents of the category cannot be removed from it.
  const removed = c.appliesTo.filter((t) => !input.appliesTo.includes(t));
  if (removed.some((t) => d.docs.some((x) => x.categoryId === id && x.ownerType === t && isCurrent(x.verificationStatus)))) invalid({ appliesTo: ['ownerTypeInUse'] });
  Object.assign(c, input);
  return toCategory(d, c);
}

export function updateCategoryStatus(id: string, status: RecordStatus, scope: DocumentsScope): DocumentCategory {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  const c = d.categories.find((x) => x.id === id) ?? notFound('Category', id);
  if (c.status === status) conflict('Status unchanged');
  // An inactive category accepts no new uploads; documents keep it. A category required by an active rule stays active.
  if (status === 'inactive' && d.rules.some((r) => r.status === 'active' && r.categoryIds.includes(id))) invalid({ status: ['categoryRequired'] });
  c.status = status;
  return toCategory(d, c);
}

/* Settings ---------------------------------------------------------------------------------------------------------------------- */

export function getSettings(scope: DocumentsScope): DocumentSettings {
  const { d, a } = begin(scope);
  if (!anyAccess(a)) forbidden();
  return d.settings;
}

export function updateSettings(input: { expiryWarningDays: number }, scope: DocumentsScope): DocumentSettings {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  if (!Number.isInteger(input.expiryWarningDays) || input.expiryWarningDays < 1 || input.expiryWarningDays > 180) invalid({ expiryWarningDays: ['invalidThreshold'] });
  d.settings = { expiryWarningDays: input.expiryWarningDays, updatedAt: nowIso(), updatedBy: a.name };
  return d.settings;
}

/* Required documents and compliance ------------------------------------------------------------------------------------------------ */

function toRule(d: Db, r: RuleRow): RequiredRule {
  return {
    id: r.id,
    name: r.name,
    categories: r.categoryIds.map((id) => {
      const c = categoryOf(d, id);
      return { id, code: c?.code ?? id, name: c?.name ?? { en: id, ar: id } };
    }),
    employmentTypes: r.employmentTypes,
    employmentStatus: r.employmentStatus,
    department: r.departmentId ? deptRef(r.departmentId) : null,
    status: r.status,
    createdAt: r.createdAt,
    applicableEmployees: r.status === 'active' ? employeeRecords.all().filter((e) => applies(r, e)).length : 0,
  };
}

function applies(rule: RuleRow, e: Employee): boolean {
  if (rule.employmentStatus !== 'any' && e.status !== rule.employmentStatus) return false;
  if (rule.employmentTypes.length && !rule.employmentTypes.includes(e.employmentType)) return false;
  if (rule.departmentId && e.departmentId !== rule.departmentId && !orgTables.descendants(rule.departmentId).has(e.departmentId)) return false;
  return true;
}

export function listRules(scope: DocumentsScope): RequiredRule[] {
  const { d, a } = begin(scope);
  if (!a.org && !a.team) forbidden();
  return d.rules.map((r) => toRule(d, r));
}

function checkRule(d: Db, input: RequiredRuleInput) {
  const errors = validateRuleInput(input) ?? {};
  if (input.categoryIds?.some((id) => !categoryOf(d, id)?.appliesTo.includes('employee'))) errors.categoryIds = [...(errors.categoryIds ?? []), 'notForOwner'];
  if (input.departmentId && !department(input.departmentId)) errors.departmentId = ['required'];
  if (Object.keys(errors).length) invalid(errors);
}

export function createRule(input: RequiredRuleInput, scope: DocumentsScope): RequiredRule {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  checkRule(d, input);
  d.seq.rule++;
  const row: RuleRow = { id: `req-${pad(d.seq.rule, 2)}`, name: input.name, categoryIds: [...new Set(input.categoryIds)], employmentTypes: input.employmentTypes, employmentStatus: input.employmentStatus, departmentId: input.departmentId, status: 'active', createdAt: nowIso() };
  d.rules.push(row);
  return toRule(d, row);
}

export function updateRule(id: string, input: RequiredRuleInput, scope: DocumentsScope): RequiredRule {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  const r = d.rules.find((x) => x.id === id) ?? notFound('Rule', id);
  checkRule(d, input);
  Object.assign(r, { name: input.name, categoryIds: [...new Set(input.categoryIds)], employmentTypes: input.employmentTypes, employmentStatus: input.employmentStatus, departmentId: input.departmentId });
  return toRule(d, r);
}

export function updateRuleStatus(id: string, status: RecordStatus, scope: DocumentsScope): RequiredRule {
  const { d, a } = begin(scope);
  if (!a.config) forbidden('hr.documents.config.manage is required');
  const r = d.rules.find((x) => x.id === id) ?? notFound('Rule', id);
  if (r.status === status) conflict('Status unchanged');
  // Re-activating restarts the grace period for everyone it applies to.
  if (status === 'active') r.createdAt = nowIso();
  r.status = status;
  return toRule(d, r);
}

const RANK: Record<ComplianceStatus, number> = { verified: 0, 'pending-verification': 1, uploaded: 2, expired: 3, required: 4, missing: 5 };

/**
 * The employee's checklist. Compliance is INFORMATION only: it never blocks payroll or changes employment status (no
 * policy configures that).
 */
function complianceOf(d: Db, a: Access, e: Employee, today = todayIso()): EmployeeCompliance {
  const mine = d.docs.filter((x) => employeeOf(x) === e.id && isCurrent(x.verificationStatus));
  const items: ComplianceItem[] = d.rules
    .filter((r) => r.status === 'active' && applies(r, e))
    .map((rule) => {
      const candidates = mine.filter((x) => rule.categoryIds.includes(x.categoryId) && x.verificationStatus !== 'rejected');
      const statusOf = (x: DocRow): ComplianceStatus => {
        if (expiryStatusOf(x.expiryDate, today, d.settings.expiryWarningDays) === 'expired') return 'expired';
        if (x.replacementRequest) return 'uploaded';
        return x.verificationStatus === 'verified' ? 'verified' : 'pending-verification';
      };
      const best = candidates.map((x) => ({ x, s: statusOf(x) })).sort((p, q) => RANK[p.s] - RANK[q.s])[0];
      const start = e.hireDate > rule.createdAt.slice(0, 10) ? e.hireDate : rule.createdAt.slice(0, 10);
      const due = addDays(start, GRACE_DAYS);
      const status: ComplianceStatus = best ? best.s : today <= due ? 'required' : 'missing';
      const shown = best && canSee(a, best.x, categoryOf(d, best.x.categoryId)!) ? best.x : null;
      return {
        rule: { id: rule.id, name: rule.name },
        status,
        document: shown ? { id: shown.id, reference: shown.reference, name: shown.name, expiryDate: shown.expiryDate, verificationStatus: shown.verificationStatus } : null,
        dueDate: status === 'required' ? due : null,
      };
    });
  const verified = items.filter((i) => i.status === 'verified').length;
  return {
    employee: { id: e.id, name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId) },
    items,
    completeness: items.length ? Math.round((verified / items.length) * 100) : null,
  };
}

export function employeeCompliance(employeeId: string, scope: DocumentsScope): EmployeeCompliance {
  const { d, a } = begin(scope);
  const e = empRow(employeeId) ?? notFound('Employee', employeeId);
  if (!(a.org || (a.team && a.units.has(e.departmentId)) || employeeId === a.me)) forbidden();
  return complianceOf(d, a, e);
}

/** Employees in the caller's scope (organization or team) with their completeness. */
function complianceScope(d: Db, a: Access): EmployeeCompliance[] {
  if (!a.org && !a.team) return [];
  return employeeRecords
    .all()
    .filter((e) => e.status === 'active' && (a.org || a.units.has(e.departmentId)))
    .map((e) => complianceOf(d, a, e));
}

export interface ComplianceFilters {
  departmentId: string;
  status: ComplianceStatus;
}

export function complianceList(params: ListParams<ComplianceFilters>, scope: DocumentsScope): Paginated<EmployeeCompliance> {
  const { d, a } = begin(scope);
  if (!a.org && !a.team) forbidden();
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const rows = complianceScope(d, a).filter((c) => (!units || units.has(c.employee.department.id)) && (!f.status || c.items.some((i) => i.status === f.status)));
  return page(rows, params, {
    search: (c) => `${c.employee.name.en} ${c.employee.name.ar} ${c.employee.employeeNumber}`,
    sort: (c, field) => (field === 'completeness' ? c.completeness : field === 'employee.name.ar' ? c.employee.name.ar : field === 'employee.employeeNumber' ? c.employee.employeeNumber : c.employee.name.en),
  });
}

/* Expiry --------------------------------------------------------------------------------------------------------------------------- */

function expirySummaryOf(d: Db, rows: readonly DocumentSummary[], today: string): ExpirySummary {
  const dated = rows.filter((s) => isCurrent(s.verificationStatus) && s.daysRemaining !== null);
  const within = (n: number) => dated.filter((s) => s.daysRemaining! >= 0 && s.daysRemaining! <= n).length;
  const month = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(month, i));
  return {
    thresholdDays: d.settings.expiryWarningDays,
    expired: dated.filter((s) => s.daysRemaining! < 0).length,
    within7: within(7),
    within30: within(30),
    within60: within(60),
    within90: within(90),
    months: months.map((m) => ({ month: m, count: dated.filter((s) => s.expiryDate!.slice(0, 7) === m && s.daysRemaining! >= 0).length })),
  };
}

export function expiringDocuments(params: ListParams<ExpiryFilters>, scope: DocumentsScope): Paginated<DocumentSummary> {
  const { d, a } = begin(scope);
  if (!anyAccess(a)) forbidden();
  const f = params.filters ?? {};
  const window = f.window ?? '30';
  const rows = summaries(d, a, { categoryId: f.categoryId, departmentId: f.departmentId })
    .filter((s) => s.daysRemaining !== null && (window === 'expired' ? s.daysRemaining < 0 : s.daysRemaining >= 0 && s.daysRemaining <= Number(window)))
    .sort((x, y) => x.expiryDate!.localeCompare(y.expiryDate!));
  return page(rows, params, { search: summarySearch, sort: summarySort });
}

export function expiredDocuments(params: ListParams<Omit<ExpiryFilters, 'window'>>, scope: DocumentsScope): Paginated<DocumentSummary> {
  return expiringDocuments({ ...params, filters: { ...params.filters, window: 'expired' } }, scope);
}

export function expirySummary(scope: DocumentsScope): ExpirySummary {
  const { d, a } = begin(scope);
  if (!anyAccess(a)) forbidden();
  const today = todayIso();
  return expirySummaryOf(d, summaries(d, a, {}), today);
}

/* Overview ------------------------------------------------------------------------------------------------------------------------- */

export function overview(scope: DocumentsScope): DocumentsOverview {
  const { d, a } = begin(scope);
  if (!anyAccess(a)) forbidden();
  const today = todayIso();
  const all = summaries(d, a, { includeHistorical: 'true' });
  const current = all.filter((s) => isCurrent(s.verificationStatus));
  const count = <K extends string>(list: readonly DocumentSummary[], key: (s: DocumentSummary) => K | null) => {
    const m = new Map<K, number>();
    for (const s of list) {
      const k = key(s);
      if (k !== null) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const byCategory = [...count(current, (s) => s.category.id)].map(([id, n]) => ({ category: { id, name: categoryOf(d, id)!.name }, count: n })).sort((x, y) => y.count - x.count);
  const byDepartment = [...count(current, (s) => (s.owner.department ? topLevel(s.owner.department.id) : null))].map(([id, n]) => ({ department: deptRef(id), count: n })).sort((x, y) => y.count - x.count);
  const statuses: DocumentStatus[] = ['verified', 'pending-review', 'rejected', 'expired', 'archived', 'superseded'];
  const statusCounts = count(all, (s) => s.status);
  const compliance = complianceScope(d, a);
  const missing: ComplianceRow[] = compliance.flatMap((c) => c.items.filter((i) => i.status === 'missing').map((i) => ({ employee: c.employee, rule: i.rule, status: i.status })));
  const soonest = (list: DocumentSummary[]) => list.sort((x, y) => (x.expiryDate ?? '').localeCompare(y.expiryDate ?? '')).slice(0, 5);
  return {
    totals: {
      total: all.length,
      active: current.length,
      expiringSoon: current.filter((s) => s.expiryStatus === 'expiring-soon').length,
      expired: current.filter((s) => s.expiryStatus === 'expired').length,
      pendingReview: current.filter((s) => s.verificationStatus === 'pending-review').length,
      archived: all.filter((s) => s.verificationStatus === 'archived').length,
    },
    byCategory,
    byStatus: statuses.map((s) => ({ status: s, count: statusCounts.get(s) ?? 0 })),
    byDepartment,
    expiry: expirySummaryOf(d, current, today),
    attention: {
      expired: soonest(current.filter((s) => s.expiryStatus === 'expired')).reverse(),
      expiringSoon: soonest(current.filter((s) => s.expiryStatus === 'expiring-soon')),
      pendingReview: current.filter((s) => s.verificationStatus === 'pending-review').sort((x, y) => x.uploadedAt.localeCompare(y.uploadedAt)).slice(0, 5),
      missing: missing.slice(0, 5),
      missingTotal: missing.length,
    },
  };
}

/** Self-service: the caller's own employee documents (hr.documents.view.own) with their checklist and payslip references. */
export function myDocuments(scope: DocumentsScope): EmployeeDocuments {
  const me = meOf(scope);
  if (!me) notFound('Employee record for account', scope.userId);
  return employeeDocuments(me, scope);
}
