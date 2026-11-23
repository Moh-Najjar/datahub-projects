import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { createRequest } from '@/modules/leave/mock/leaveMock';
import { conversionDraft, convertCandidateToEmployee, listCandidates } from '@/modules/recruitment/mock/recruitmentMock';
import { documentsApi as api } from '@/modules/documents/api/documentsApi';
import type { Document, DocumentInput, DocumentsScope, DocumentSummary } from '@/modules/documents/types/documents';
import { addDays, expiryStatusOf, fileProblem, overallStatus } from '@/modules/documents/utils/rules';

/* The simulated documents backend on a fixed clock: Monday 16 Nov 2026, 10:30 (local). */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const TODAY = '2026-11-16';
const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
const as = (role: Role): DocumentsScope => ({ userId: users[role], role });
const HR = as('hr-admin');
const HRM = as('hr-manager');
const MANAGER = as('department-manager'); // Dana Yousef (emp-0001), Engineering
const EMPLOYEE = as('employee'); // Sami Odeh (emp-0025)
const RECRUITER = as('recruiter');
const PAYROLL = as('payroll-officer');
const ALL = { page: 1, pageSize: 100 } as const;

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const e = await promise.then(
    () => null,
    (x: unknown) => x,
  );
  expect(e, 'expected an error').toBeInstanceOf(ApiError);
  return e as ApiError;
}
const cat = async (code: string) => (await api.getDocumentCategories({ page: 1, pageSize: 100 }, HR)).items.find((c) => c.code === code)!;
async function input(code: string, over: Partial<DocumentInput> = {}): Promise<DocumentInput> {
  const c = await cat(code);
  return { ownerType: 'employee', ownerId: 'emp-0025', categoryId: c.id, name: 'Training certificate', documentNumber: '', issueDate: '2026-10-01', expiryDate: null, issuingAuthority: 'Academy', description: '', confidentiality: c.defaultConfidentiality, files: [{ name: 'certificate.pdf', sizeBytes: 250_000 }], ...over };
}
async function allDocs(scope: DocumentsScope, filters = {}): Promise<DocumentSummary[]> {
  const out: DocumentSummary[] = [];
  for (let p = 1; ; p++) {
    const res = await api.getDocuments({ page: p, pageSize: 100, filters }, scope);
    out.push(...res.items);
    if (p >= res.totalPages) return out;
  }
}

describe('rules', () => {
  it('expiry status is computed separately from verification, with the warning threshold', () => {
    expect(expiryStatusOf(null, TODAY, 30)).toBe('no-expiry');
    expect(expiryStatusOf('2026-11-15', TODAY, 30)).toBe('expired');
    expect(expiryStatusOf(TODAY, TODAY, 30)).toBe('expiring-soon');
    expect(expiryStatusOf(addDays(TODAY, 30), TODAY, 30)).toBe('expiring-soon');
    expect(expiryStatusOf(addDays(TODAY, 31), TODAY, 30)).toBe('valid');
    expect(expiryStatusOf(addDays(TODAY, 31), TODAY, 60)).toBe('expiring-soon');
    // An expired document is never shown as verified (it cannot be treated as valid); a decision stays a decision.
    expect(overallStatus('verified', 'expired')).toBe('expired');
    expect(overallStatus('rejected', 'expired')).toBe('rejected');
    expect(overallStatus('verified', 'expiring-soon')).toBe('verified');
  });

  it('file validation: allowed extensions and the configured maximum size', () => {
    const rules = { allowedFileTypes: ['pdf', 'png'] as Array<'pdf' | 'png'>, maxFileSizeMb: 2 };
    expect(fileProblem({ name: 'scan.PDF', sizeBytes: 1000 }, rules)).toBeNull();
    expect(fileProblem({ name: 'scan.exe', sizeBytes: 1000 }, rules)).toBe('fileType');
    expect(fileProblem({ name: 'scan.docx', sizeBytes: 1000 }, rules)).toBe('fileType');
    expect(fileProblem({ name: 'noextension', sizeBytes: 1000 }, rules)).toBe('fileType');
    expect(fileProblem({ name: 'big.png', sizeBytes: 2 * 1024 * 1024 + 1 }, rules)).toBe('fileSize');
    expect(fileProblem({ name: 'empty.pdf', sizeBytes: 0 }, rules)).toBe('emptyFile');
  });
});

describe('documents: upload, metadata and validation', () => {
  it('creates a document with SIMULATED file references only (never downloadable)', async () => {
    const doc = await api.createDocument(await input('TRAINING-CERT'), HR);
    expect(doc).toMatchObject({ verificationStatus: 'pending-review', status: 'pending-review', expiryStatus: 'no-expiry', reference: expect.stringMatching(/^DOC-\d{6}$/) });
    expect(doc.files).toEqual([{ name: 'certificate.pdf', sizeBytes: 250_000, type: 'pdf', storage: 'simulated', downloadAvailable: false }]);
    expect(doc.can.download).toBe(false);
    expect(doc.history.map((h) => h.action)).toEqual(['uploaded']);
    expect((await api.getEmployeeDocuments('emp-0025', HR)).documents.some((d) => d.id === doc.id)).toBe(true);
  });

  it('refuses wrong file types and sizes, missing metadata, bad dates, ineligible owners and duplicate numbers', async () => {
    const reasons = async (p: Promise<unknown>) => (await failure(p)).fieldErrors;
    expect(await reasons(api.createDocument(await input('TRAINING-CERT', { files: [{ name: 'run.exe', sizeBytes: 100 }] }), HR))).toMatchObject({ files: ['fileType'] });
    expect(await reasons(api.createDocument(await input('PASSPORT', { files: [{ name: 'p.pdf', sizeBytes: 6 * 1024 * 1024 }], documentNumber: 'X1', expiryDate: '2030-01-01' }), HR))).toMatchObject({ files: ['fileSize'] });
    expect(await reasons(api.createDocument(await input('TRAINING-CERT', { files: [] }), HR))).toMatchObject({ files: ['fileRequired'] });
    expect(await reasons(api.createDocument(await input('TRAINING-CERT', { name: ' ' }), HR))).toMatchObject({ name: ['required'] });
    expect(await reasons(api.createDocument(await input('PASSPORT', { documentNumber: '' }), HR))).toMatchObject({ expiryDate: ['expiryRequired'], documentNumber: ['numberRequired'] });
    expect(await reasons(api.createDocument(await input('TRAINING-CERT', { issueDate: '2026-10-01', expiryDate: '2026-09-01' }), HR))).toMatchObject({ expiryDate: ['expiryBeforeIssue'] });
    expect(await reasons(api.createDocument(await input('TRAINING-CERT', { issueDate: '2027-01-01' }), HR))).toMatchObject({ issueDate: ['issueInFuture'] });
    // Candidate-only categories cannot be attached to employees.
    expect(await reasons(api.createDocument(await input('CV'), HR))).toMatchObject({ categoryId: ['notForOwner'] });
    // Duplicate document numbers within a category that requires them.
    const existing = (await allDocs(HR, { categoryId: (await cat('NATIONAL-ID')).id }))[0]!;
    expect(await reasons(api.createDocument(await input('NATIONAL-ID', { documentNumber: existing.documentNumber!, expiryDate: '2031-01-01' }), HR))).toMatchObject({ documentNumber: ['duplicateNumber'] });
    // Inactive employees receive no new documents.
    const inactive = employeeRecords.all().find((e) => e.status === 'inactive')!;
    expect(await reasons(api.createDocument(await input('TRAINING-CERT', { ownerId: inactive.id }), HR))).toMatchObject({ ownerId: ['ownerInactive'] });
  });

  it('editing what verification relied on returns a verified document to review; archived documents are read-only', async () => {
    const doc = await api.createDocument(await input('TRAINING-CERT'), HR);
    await api.verifyDocument(doc.id, HR);
    const renamed = await api.updateDocument(doc.id, { ...(await input('TRAINING-CERT')), name: 'Renamed' }, HR);
    expect(renamed).toMatchObject({ name: 'Renamed', verificationStatus: 'verified' });
    const redated = await api.updateDocument(doc.id, { ...(await input('TRAINING-CERT')), issueDate: '2026-09-01' }, HR);
    expect(redated.verificationStatus).toBe('pending-review');
    expect(redated.history.slice(0, 2).map((h) => h.action)).toEqual(['returned-to-review', 'edited']);
    expect((await failure(api.archiveDocument(doc.id, '', HR))).fieldErrors).toMatchObject({ reason: ['reasonTooShort'] });
    const archived = await api.archiveDocument(doc.id, 'Uploaded twice by mistake.', HR);
    expect(archived).toMatchObject({ verificationStatus: 'archived', can: { edit: false, verify: false, archive: false } });
    expect((await failure(api.verifyDocument(doc.id, HR))).fieldErrors).toMatchObject({ status: ['historicalCannotVerify'] });
    expect((await failure(api.updateDocument(doc.id, await input('TRAINING-CERT'), HR))).fieldErrors).toMatchObject({ status: ['notEditable'] });
  });
});

describe('verification workflow', () => {
  it('verify / reject (reason required) / request replacement; every decision recorded with reviewer and date', async () => {
    const a = await api.createDocument(await input('TRAINING-CERT'), HR);
    expect((await failure(api.rejectDocument(a.id, 'no', HR))).fieldErrors).toMatchObject({ reason: ['reasonTooShort'] });
    const rejected = await api.rejectDocument(a.id, 'Certificate is not signed.', HR);
    expect(rejected).toMatchObject({ verificationStatus: 'rejected', lastReview: { decision: 'rejected', reason: 'Certificate is not signed.', by: { en: expect.any(String) }, at: expect.any(String) } });
    expect((await failure(api.verifyDocument(a.id, HR))).fieldErrors).toMatchObject({ status: ['notPending'] });
    // Rejected documents need a replacement.
    expect(rejected.can.replace).toBe(true);
    const b = await api.createDocument(await input('HR-FORM', { name: 'Signed policy', files: [{ name: 'policy.docx', sizeBytes: 9000 }] }), HR);
    const verified = await api.verifyDocument(b.id, HR);
    expect(verified.lastReview).toMatchObject({ decision: 'verified' });
    const requested = await api.requestDocumentReplacement(b.id, 'A newer version of the form is required.', HR);
    expect(requested.replacementRequest?.reason).toBe('A newer version of the form is required.');
    const noted = await api.addDocumentNote(b.id, 'Called the employee about the new form.', HR);
    expect(noted.internalNotes).toHaveLength(1);
    expect((await api.getDocumentHistory(b.id, HR)).map((h) => h.action)).toEqual(['note', 'replacement-requested', 'verified', 'uploaded']);
  });

  it('expired documents cannot be verified', async () => {
    const expiredPending = (await allDocs(HR, { status: 'expired' })).find((s) => s.verificationStatus === 'pending-review');
    if (expiredPending) expect((await failure(api.verifyDocument(expiredPending.id, HR))).fieldErrors).toMatchObject({ status: ['expiredCannotVerify'] });
    const doc = await api.createDocument(await input('PROF-LICENCE', { documentNumber: 'PL-TEST-1', issueDate: '2020-01-01', expiryDate: '2026-11-01' }), HR);
    expect(doc.status).toBe('expired');
    expect(doc.can.verify).toBe(false);
    expect((await failure(api.verifyDocument(doc.id, HR))).fieldErrors).toMatchObject({ status: ['expiredCannotVerify'] });
  });

  it('replacement: the previous document is kept, linked, and superseded only once the replacement is verified', async () => {
    const old = (await allDocs(HR, { categoryId: (await cat('NATIONAL-ID')).id, status: 'expired' }))[0]!;
    const replacement = await api.replaceDocument(old.id, { ...(await input('NATIONAL-ID')), name: 'National ID (renewed)', documentNumber: old.documentNumber!, issueDate: '2026-11-10', expiryDate: '2036-11-09', files: [{ name: 'id-new.jpg', sizeBytes: 400_000 }] }, HR);
    expect(replacement.replaces?.id).toBe(old.id);
    let previous: Document = await api.getDocumentById(old.id, HR);
    expect(previous.replacedBy?.id).toBe(replacement.id);
    expect(previous.verificationStatus).not.toBe('superseded');
    expect(previous.can.replace).toBe(false);
    await api.verifyDocument(replacement.id, HR);
    previous = await api.getDocumentById(old.id, HR);
    expect(previous.verificationStatus).toBe('superseded');
    expect(previous.history.map((h) => h.action).slice(0, 2)).toEqual(['superseded', 'replacement-uploaded']);
    // History is never deleted: the superseded document is still listed with historical documents.
    expect((await allDocs(HR, { includeHistorical: 'true', ownerId: old.owner.id })).some((d) => d.id === old.id)).toBe(true);
    expect((await allDocs(HR, { ownerId: old.owner.id })).some((d) => d.id === old.id)).toBe(false);
  });
});

describe('categories and settings', () => {
  it('category CRUD with unique codes; categories required by an active rule stay active', async () => {
    const created = await api.createDocumentCategory({ code: 'SAFETY-CERT', name: { en: 'Safety certificate', ar: 'شهادة السلامة' }, description: '', group: 'education', appliesTo: ['employee'], transferOnHire: false, required: false, tracksExpiry: true, requiresNumber: false, allowedFileTypes: ['pdf'], maxFileSizeMb: 3, employmentTypes: ['full-time'], defaultConfidentiality: 'standard', employeeVisible: true, managerVisible: true }, HR);
    expect(created).toMatchObject({ status: 'active', documentCount: 0 });
    expect((await failure(api.createDocumentCategory({ ...created, code: 'cv' }, HR))).fieldErrors?.code).toContain('invalidCode');
    expect((await failure(api.createDocumentCategory({ ...created, code: 'CV' }, HR))).fieldErrors).toMatchObject({ code: ['duplicateCode'] });
    expect((await api.updateDocumentCategory(created.id, { ...created, maxFileSizeMb: 5 }, HR)).maxFileSizeMb).toBe(5);
    expect((await api.updateDocumentCategoryStatus(created.id, 'inactive', HR)).status).toBe('inactive');
    // Part-time employees are not eligible and inactive categories accept no uploads.
    expect((await failure(api.createDocument({ ...(await input('TRAINING-CERT')), categoryId: created.id, expiryDate: '2028-01-01' }, HR))).fieldErrors).toMatchObject({ categoryId: ['categoryInactive'] });
    expect((await failure(api.updateDocumentCategoryStatus((await cat('EMP-CONTRACT')).id, 'inactive', HR))).fieldErrors).toMatchObject({ status: ['categoryRequired'] });
    // Configuration needs hr.documents.config.manage (the HR Manager may not).
    expect((await failure(api.createDocumentCategory({ ...created, code: 'NEW-ONE' }, HRM))).code).toBe('FORBIDDEN');
  });

  it('the expiry warning threshold is configurable (initially 30 days)', async () => {
    expect((await api.getDocumentSettings(HR)).expiryWarningDays).toBe(30);
    const before = (await api.getDocumentsOverview(HR)).totals.expiringSoon;
    await api.updateDocumentSettings({ expiryWarningDays: 90 }, HR);
    expect((await api.getDocumentsOverview(HR)).totals.expiringSoon).toBeGreaterThan(before);
    expect((await failure(api.updateDocumentSettings({ expiryWarningDays: 0 }, HR))).fieldErrors).toMatchObject({ expiryWarningDays: ['invalidThreshold'] });
  });
});

describe('expiry management', () => {
  it('windows: expired, 7, 30, 60 and 90 days, current documents only, soonest first', async () => {
    const s = await api.getDocumentExpirySummary(HR);
    const window = async (w: '7' | '30' | '60' | '90' | 'expired') => (await api.getExpiringDocuments({ ...ALL, filters: { window: w } }, HR)).total;
    expect(await window('expired')).toBe(s.expired);
    expect(await window('7')).toBe(s.within7);
    expect(await window('30')).toBe(s.within30);
    expect(await window('90')).toBe(s.within90);
    expect(s.within7 <= s.within30 && s.within30 <= s.within60 && s.within60 <= s.within90).toBe(true);
    expect((await api.getExpiredDocuments(ALL, HR)).total).toBe(s.expired);
    const soon = (await api.getExpiringDocuments({ ...ALL, filters: { window: '90' } }, HR)).items;
    expect(soon.every((d, i) => i === 0 || soon[i - 1]!.expiryDate! <= d.expiryDate!)).toBe(true);
    expect(soon.every((d) => d.daysRemaining! >= 0 && d.daysRemaining! <= 90 && d.verificationStatus !== 'superseded')).toBe(true);
    expect(s.months).toHaveLength(12);
  });

  it('overview: KPIs, charts and attention lists come from the same documents', async () => {
    const o = await api.getDocumentsOverview(HR);
    const all = await allDocs(HR, { includeHistorical: 'true' });
    expect(o.totals.total).toBe(all.length);
    expect(o.totals.archived).toBe(all.filter((d) => d.verificationStatus === 'archived').length);
    expect(o.byStatus.reduce((sum, x) => sum + x.count, 0)).toBe(o.totals.total);
    expect(o.byCategory.reduce((sum, x) => sum + x.count, 0)).toBe(o.totals.active);
    expect(o.totals.expired).toBe(o.expiry.expired);
    expect(o.attention.missingTotal).toBeGreaterThan(0);
    for (const kpi of Object.values(o.totals)) expect(kpi).toBeGreaterThanOrEqual(0);
  });
});

describe('required documents and compliance', () => {
  it('checklist statuses and completeness; missing and expired are different', async () => {
    const o = await api.getDocumentsOverview(HR);
    const missing = o.attention.missing[0]!;
    const c = await api.getEmployeeDocumentCompliance(missing.employee.id, HR);
    expect(c.items.find((i) => i.rule.id === missing.rule.id)!.status).toBe('missing');
    const verified = c.items.filter((i) => i.status === 'verified').length;
    expect(c.completeness).toBe(Math.round((verified / c.items.length) * 100));
    // An employee with an expired identity document is "expired", not "missing".
    const expiredId = (await allDocs(HR, { categoryId: (await cat('PASSPORT')).id, status: 'expired' })).concat(await allDocs(HR, { categoryId: (await cat('NATIONAL-ID')).id, status: 'expired' }));
    const holder = expiredId.find((d) => employeeRecords.get(d.owner.id)?.status === 'active')!;
    const items = (await api.getEmployeeDocumentCompliance(holder.owner.id, HR)).items;
    expect(items.find((i) => i.rule.id === 'req-02')!.status).toBe('expired');
  });

  it('rules: create (any of several categories, by type, status and department), grace period for new rules', async () => {
    const rule = await api.createRequiredDocumentRule({ name: { en: 'Training certificate', ar: 'شهادة تدريب' }, categoryIds: [(await cat('TRAINING-CERT')).id], employmentTypes: ['full-time'], employmentStatus: 'active', departmentId: 'dep-hr' }, HR);
    expect(rule.applicableEmployees).toBeGreaterThan(0);
    const member = employeeRecords.all().find((e) => e.status === 'active' && e.employmentType === 'full-time' && (e.departmentId === 'dep-hr' || e.departmentId.startsWith('dep-hr-')))!;
    const item = (await api.getEmployeeDocumentCompliance(member.id, HR)).items.find((i) => i.rule.id === rule.id)!;
    expect(['required', 'verified', 'pending-verification', 'expired', 'uploaded']).toContain(item.status); // new rule: never "missing" during the grace period
    expect(item.status === 'required' ? item.dueDate : 'ok').toBeTruthy();
    expect((await failure(api.createRequiredDocumentRule({ name: { en: 'CV', ar: 'سيرة' }, categoryIds: [(await cat('CV')).id], employmentTypes: [], employmentStatus: 'active', departmentId: null }, HR))).fieldErrors).toMatchObject({ categoryIds: ['notForOwner'] });
    expect((await api.updateRequiredDocumentRuleStatus(rule.id, 'inactive', HR)).status).toBe('inactive');
    expect((await failure(api.createRequiredDocumentRule({ name: { en: 'x', ar: 'س' }, categoryIds: [], employmentTypes: [], employmentStatus: 'active', departmentId: null }, HR))).code).toBe('VALIDATION');
    expect((await failure(api.createRequiredDocumentRule({ name: { en: 'x', ar: 'س' }, categoryIds: [(await cat('TRAINING-CERT')).id], employmentTypes: [], employmentStatus: 'active', departmentId: null }, MANAGER))).code).toBe('FORBIDDEN');
  });
});

describe('permissions and confidentiality (enforced by the API)', () => {
  it('Department Manager: team members only, standard confidentiality, manager-visible categories', async () => {
    const team = employeeRecords.teamUnits('usr-0004');
    const docs = await allDocs(MANAGER);
    expect(docs.length).toBeGreaterThan(0);
    // Her own documents follow the self-service rule; everything else must be team, standard, manager-visible.
    for (const d of docs.filter((x) => (x.linkedEmployeeId ?? x.owner.id) !== 'emp-0001')) {
      expect(d.confidentiality, d.reference).toBe('standard');
      expect(team.has(employeeRecords.get(d.linkedEmployeeId ?? d.owner.id)!.departmentId), d.reference).toBe(true);
      expect(['identity', 'leave', 'payroll', 'recruitment']).not.toContain(d.category.group === 'identity' && d.category.code === 'DRIVING-LICENCE' ? 'x' : d.category.group);
    }
    // Another team's document, an identity document of the team: NOT_FOUND (existence is not revealed).
    const outside = (await allDocs(HR)).find((d) => d.owner.type === 'employee' && !team.has(employeeRecords.get(d.owner.id)!.departmentId))!;
    expect((await failure(api.getDocumentById(outside.id, MANAGER))).code).toBe('NOT_FOUND');
    const teamIdentity = (await allDocs(HR, { categoryId: (await cat('NATIONAL-ID')).id, ownerType: 'employee' })).find((d) => team.has(employeeRecords.get(d.owner.id)!.departmentId))!;
    expect((await failure(api.getDocumentById(teamIdentity.id, MANAGER))).code).toBe('NOT_FOUND');
    expect((await failure(api.verifyDocument(docs[0]!.id, MANAGER))).code).toBe('FORBIDDEN');
  });

  it('Employee: own documents of employee-visible categories, no internal notes, nobody else’s', async () => {
    const mine = await allDocs(EMPLOYEE);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((d) => d.owner.id === 'emp-0025' || d.linkedEmployeeId === 'emp-0025')).toBe(true);
    const restricted = await api.createDocument(await input('HR-OTHER', { name: 'Internal investigation note', files: [{ name: 'note.pdf', sizeBytes: 1000 }] }), HR);
    expect((await failure(api.getDocumentById(restricted.id, EMPLOYEE))).code).toBe('NOT_FOUND');
    const own = await api.createDocument(await input('TRAINING-CERT'), HR);
    await api.addDocumentNote(own.id, 'Internal: check with the trainer.', HR);
    const seen = await api.getDocumentById(own.id, EMPLOYEE);
    expect(seen.internalNotes).toBeNull();
    expect(seen.history.some((h) => h.action === 'note')).toBe(false);
    expect(JSON.stringify(seen)).not.toContain('check with the trainer');
    const other = (await allDocs(HR)).find((d) => d.owner.type === 'employee' && d.owner.id !== 'emp-0025')!;
    expect((await failure(api.getDocumentById(other.id, EMPLOYEE))).code).toBe('NOT_FOUND');
    expect((await failure(api.getEmployeeDocuments('emp-0001', EMPLOYEE))).code).toBe('FORBIDDEN');
    expect((await failure(api.createDocument(await input('TRAINING-CERT'), EMPLOYEE))).code).toBe('FORBIDDEN');
  });

  it('Payroll Officer: payroll documents only (never identity or medical); payslips are references', async () => {
    const docs = await allDocs(PAYROLL);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.category.group === 'payroll' || d.owner.id === 'emp-0005')).toBe(true);
    const sick = (await allDocs(HR, { categoryId: (await cat('SICK-CERT')).id }))[0]!;
    expect((await failure(api.getDocumentById(sick.id, PAYROLL))).code).toBe('NOT_FOUND');
    const forEmployee = await api.getEmployeeDocuments('emp-0025', PAYROLL);
    expect(forEmployee.payslips!.length).toBeGreaterThan(0);
    expect(forEmployee.payslips![0]!.number).toMatch(/^PS-/);
    // Roles without hr.payroll.view get no payslip references (a manager for their team); the employee gets their own.
    const teamMember = employeeRecords.all().find((e) => e.id !== 'emp-0001' && employeeRecords.teamUnits('usr-0004').has(e.departmentId))!;
    expect((await api.getEmployeeDocuments(teamMember.id, MANAGER)).payslips).toBeNull();
    expect((await api.getEmployeeDocuments('emp-0025', EMPLOYEE)).payslips!.length).toBeGreaterThan(0);
  });

  it('highly confidential documents need hr.employees.view.personal even for document readers', async () => {
    // Every HR document role holds the personal permission; the rule is checked on each read.
    const id = (await allDocs(HR, { categoryId: (await cat('NATIONAL-ID')).id }))[0]!;
    expect((await api.getDocumentById(id.id, HRM)).confidentiality).toBe('highly-confidential');
    expect((await failure(api.getDocumentById(id.id, RECRUITER))).code).toBe('NOT_FOUND');
  });
});

describe('integrations', () => {
  it('Leave: attachments are registered once from leave requests (same file reference, highly confidential medical)', async () => {
    const sick = await allDocs(HR, { categoryId: (await cat('SICK-CERT')).id });
    expect(sick.length).toBeGreaterThan(0);
    expect(sick.every((d) => d.source.module === 'leave' && d.source.reference?.startsWith('LR-') && d.confidentiality === 'highly-confidential')).toBe(true);
    const before = (await allDocs(HR, { group: 'leave' })).length;
    const request = createRequest({ leaveTypeId: 'lt-08', startDate: '2026-12-14', endDate: '2026-12-14', reason: 'Family matter for the demo.', document: { fileName: 'support-letter.pdf', sizeBytes: 52_000 }, submit: true }, { kind: 'own', userId: 'usr-0005', role: 'employee' });
    const after = await allDocs(HR, { group: 'leave' });
    expect(after.length).toBe(before + 1);
    const registered = after.find((d) => d.source.recordId === request.id)!;
    expect(registered).toMatchObject({ owner: { id: 'emp-0025' }, verificationStatus: 'pending-review', source: { module: 'leave', reference: request.number } });
    expect((await api.getDocumentById(registered.id, HR)).files[0]!.name).toBe('support-letter.pdf');
    // Reading again never duplicates it.
    expect((await allDocs(HR, { group: 'leave' })).length).toBe(before + 1);
  });

  it('Recruitment: candidate documents only for recruitment users; after hiring, transferable documents follow (CV does not)', async () => {
    const candidate = listCandidates({ page: 1, pageSize: 100, filters: { stage: 'hired' } }, { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' }).items.find((c) => c.can.convert)!;
    const docs = await api.getCandidateDocuments(candidate.id, RECRUITER);
    expect(docs.some((d) => d.category.code === 'CV')).toBe(true);
    expect((await failure(api.getCandidateDocuments(candidate.id, PAYROLL))).code).toBe('FORBIDDEN');
    expect((await failure(api.getCandidateDocuments(candidate.id, EMPLOYEE))).code).toBe('FORBIDDEN');
    // A recruiter uploads a certificate for the candidate (recruitment.jobs.manage), but cannot see employee documents.
    const cert = await api.createDocument({ ...(await input('PROFESSIONAL-CERT')), ownerType: 'candidate', ownerId: candidate.id }, RECRUITER);
    expect((await failure(api.getEmployeeDocuments('emp-0025', RECRUITER))).code).toBe('FORBIDDEN');
    // Convert: the certificate is LINKED to the new employee (one record, history kept); the CV stays with the candidate.
    const scope = { kind: 'organization' as const, userId: 'usr-0002', role: 'hr-admin' as const };
    const draft = conversionDraft(candidate.id, scope);
    const converted = convertCandidateToEmployee(candidate.id, { employeeNumber: draft.employeeNumber, name: draft.name, dateOfBirth: '1995-04-12', gender: 'female', nationality: 'JO', maritalStatus: 'single', workEmail: draft.workEmail, personalEmail: draft.personalEmail, phone: draft.phone, alternativePhone: '', address: 'Building 1', city: 'Amman', country: 'JO', hireDate: draft.hireDate, employmentType: draft.employmentType, contractStartDate: draft.hireDate, contractEndDate: null, probationEndDate: null, departmentId: draft.departmentId, positionId: draft.positionId, locationId: draft.locationId, managerId: draft.managerId, reportingDepartmentId: null, emergencyContact: { name: 'Contact Person', relationship: 'parent', phone: '+962 79 000 0000', alternativePhone: '' } }, scope);
    const employeeDocs = (await api.getEmployeeDocuments(converted.employeeId!, HR)).documents;
    expect(employeeDocs.some((d) => d.id === cert.id)).toBe(true);
    expect(employeeDocs.some((d) => d.category.code === 'CV')).toBe(false);
    const linked = await api.getDocumentById(cert.id, HR);
    expect(linked.owner.type).toBe('candidate');
    expect(linked.linkedEmployeeId).toBe(converted.employeeId);
    expect(linked.history[0]!.action).toBe('linked-to-employee');
    const count = (await allDocs(HR, { includeHistorical: 'true' })).filter((d) => d.id === cert.id).length;
    expect(count).toBe(1);
  });
});
