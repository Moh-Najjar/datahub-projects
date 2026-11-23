import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { employeeRecords, resetEmployeesMock } from '@/modules/employees/mock/employeesMock';
import type { EmployeeInput } from '@/modules/employees';
import { recruitmentApi as api } from '@/modules/recruitment/api/recruitmentApi';
import type { Candidate, CandidateInput, InterviewInput, OfferInput, RecruitmentScope, RequisitionInput } from '@/modules/recruitment/types/recruitment';
import { addDays } from '@/modules/recruitment/utils/pipeline';
import { resetRecruitmentMock } from './recruitmentMock';

/* The simulated recruitment backend on a fixed clock: Monday 16 Nov 2026, 10:30 (local). */
const NOW = new Date(2026, 10, 16, 10, 30);
const TODAY = '2026-11-16';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetRecruitmentMock();
  resetEmployeesMock();
});
afterEach(() => vi.useRealTimers());

const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
const scopeOf = (role: Role): RecruitmentScope => ({ kind: role === 'department-manager' ? 'team' : 'organization', userId: users[role], role });
const HR = scopeOf('hr-admin');
const RECRUITER = scopeOf('recruiter');
const MANAGER = scopeOf('department-manager');
const ALL = { page: 1, pageSize: 100 } as const;

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}
const reasons = async (p: Promise<unknown>) => (await rejection(p)).fieldErrors;
const code = async (p: Promise<unknown>) => (await rejection(p)).code;

async function openRequisition() {
  return (await api.getRequisitions({ ...ALL, filters: { status: 'open' } }, HR)).items[0]!;
}
async function candidateInput(patch: Partial<CandidateInput> = {}): Promise<CandidateInput> {
  const req = await openRequisition();
  return {
    name: { first: { en: 'Test', ar: 'اختبار' }, last: { en: 'Applicant', ar: 'متقدم' } },
    email: 'test.applicant@candidates.example.test',
    phone: '+962 79 000 1234',
    location: 'Amman',
    currentTitle: 'Developer',
    currentCompany: 'Example Co',
    experienceYears: 4,
    education: 'bachelor',
    skills: ['TypeScript'],
    languages: ['Arabic', 'English'],
    linkedinUrl: '',
    portfolioUrl: '',
    requisitionId: req.id,
    appliedAt: TODAY,
    source: 'careers-site',
    recruiterId: null,
    expectedSalary: null,
    notes: '',
    ...patch,
  };
}
/** A new candidate moved through the pipeline to `stage` with valid transitions. */
async function candidateAt(stage: 'screening' | 'shortlisted' | 'interview' | 'assessment', email = `c${Math.random().toString(36).slice(2, 8)}@candidates.example.test`): Promise<Candidate> {
  let c = await api.createCandidate(await candidateInput({ email }), HR);
  for (const s of ['screening', 'shortlisted', 'interview', 'assessment'] as const) {
    c = await api.updateCandidateStage(c.id, s, '', HR);
    if (s === stage) break;
  }
  return c;
}
async function offerInputFor(c: Candidate, patch: Partial<OfferInput> = {}): Promise<OfferInput> {
  const req = await api.getRequisitionById(c.requisition.id, HR);
  const salary = req.salaryRange ? Math.round((req.salaryRange.min + req.salaryRange.max) / 2) : 1000;
  return { candidateId: c.id, departmentId: req.department.id, positionId: req.position.id, locationId: req.location.id, salary, currency: req.salaryRange?.currency ?? 'JOD', employmentType: 'full-time', startDate: addDays(TODAY, 30), expiryDate: addDays(TODAY, 7), benefits: 'Example', ...patch };
}

describe('dataset', () => {
  it('summary figures come from the same records as the lists', async () => {
    const s = await api.getRecruitmentSummary(HR);
    const candidates = await api.getCandidates({ page: 1, pageSize: 1 }, HR);
    expect(s.totalCandidates).toBe(candidates.total);
    expect(s.newCandidates).toBe((await api.getCandidates({ page: 1, pageSize: 1, filters: { stage: 'new' } }, HR)).total);
    expect(s.inInterview).toBe((await api.getCandidates({ page: 1, pageSize: 1, filters: { stage: 'interview' } }, HR)).total);
    expect(s.pendingOffers).toBe((await api.getOffers({ page: 1, pageSize: 1, filters: { status: 'sent' } }, HR)).total);
    expect(s.hired).toBe((await api.getCandidates({ page: 1, pageSize: 1, filters: { stage: 'hired' } }, HR)).total);
    expect(Object.values(s.byStage).reduce((a, b) => a + b, 0)).toBe(s.totalCandidates);
    const funnel = s.funnel.map((f) => f.count);
    expect(funnel).toEqual([...funnel].sort((a, b) => b - a)); // each step ≤ the previous one
    expect(s.monthly).toHaveLength(6);
    expect(s.openRequisitions).toBe((await api.getRequisitions({ page: 1, pageSize: 1, filters: { status: 'open' } }, HR)).total);
  });

  it('every hired candidate has an accepted offer; converted ones link to existing employees', async () => {
    const hired = (await api.getCandidates({ ...ALL, filters: { stage: 'hired' } }, HR)).items;
    const accepted = (await api.getOffers({ ...ALL, filters: { status: 'accepted' } }, HR)).items;
    expect(hired.length).toBeGreaterThan(0);
    for (const c of hired) expect(accepted.some((o) => o.candidate.id === c.id), c.number).toBe(true);
    const converted = hired.filter((c) => c.employeeId);
    expect(converted.length).toBeGreaterThan(0);
    for (const c of converted) {
      const e = employeeRecords.get(c.employeeId!)!;
      expect(e.name.first.en).toBe(c.name.first.en);
    }
    expect(hired.some((c) => !c.employeeId && c.can.convert)).toBe(true);
  });

  it('a sent offer past its expiry date is expired by the system', async () => {
    const expired = (await api.getOffers({ ...ALL, filters: { status: 'expired' } }, HR)).items;
    expect(expired.length).toBeGreaterThan(0);
    expect(expired[0]!.history.at(-1)).toMatchObject({ to: 'expired', by: { en: 'System' } });
  });
});

describe('requisitions', () => {
  const input = async (patch: Partial<RequisitionInput> = {}): Promise<RequisitionInput> => {
    const r = await openRequisition();
    return {
      title: { en: 'Data Analyst', ar: 'محلل بيانات' },
      departmentId: r.department.id,
      positionId: r.position.id,
      locationId: r.location.id,
      employmentType: 'full-time',
      vacancies: 2,
      hiringManagerId: null,
      recruiterId: 'emp-0004',
      description: 'Analyse data.',
      skills: ['SQL'],
      minExperienceYears: 2,
      education: 'bachelor',
      salaryRange: { min: 800, max: 1200, currency: 'JOD' },
      openingDate: TODAY,
      closingDate: addDays(TODAY, 60),
      ...patch,
    };
  };

  it('creates as draft, edits, and follows the status workflow (approve, hold, close, reopen)', async () => {
    let r = await api.createRequisition(await input(), RECRUITER);
    expect(r).toMatchObject({ status: 'draft', number: expect.stringMatching(/^REQ-2026-\d{3}$/) });
    r = await api.updateRequisition(r.id, await input({ vacancies: 3 }), HR);
    expect(r.vacancies).toBe(3);
    for (const s of ['pending-approval', 'open', 'on-hold', 'open', 'closed', 'open'] as const) r = await api.updateRequisitionStatus(r.id, s, '', HR);
    expect(r.history.map((h) => h.to)).toEqual(['draft', 'pending-approval', 'open', 'on-hold', 'open', 'closed', 'open']);
    expect(await code(api.updateRequisitionStatus(r.id, 'draft', '', HR))).toBe('CONFLICT');
  });

  it('validates fields and organization references', async () => {
    expect(await reasons(api.createRequisition(await input({ closingDate: addDays(TODAY, -1), salaryRange: { min: 900, max: 800, currency: 'JOD' } }), HR))).toEqual({ closingDate: ['closingBeforeOpening'], salaryMax: ['salaryMaxBelowMin'] });
    const mine = await openRequisition();
    const other = (await api.getRequisitions(ALL, HR)).items.find((x) => x.department.id !== mine.department.id)!;
    expect(await reasons(api.createRequisition(await input({ positionId: other.position.id }), HR))).toEqual({ positionId: ['positionDepartment'] });
  });

  it('search, filters, sorting and pagination', async () => {
    const page = await api.getRequisitions({ page: 1, pageSize: 5, sortBy: 'openingDate', sortDirection: 'asc' }, HR);
    expect(page.items).toHaveLength(5);
    expect(page.items.map((r) => r.openingDate)).toEqual([...page.items.map((r) => r.openingDate)].sort());
    const r = await openRequisition();
    expect((await api.getRequisitions({ ...ALL, search: r.number }, HR)).items.map((x) => x.id)).toEqual([r.id]);
    expect((await api.getRequisitions({ ...ALL, filters: { status: 'closed' } }, HR)).items.every((x) => x.status === 'closed')).toBe(true);
  });
});

describe('candidates and pipeline', () => {
  it('creates, edits, prevents duplicate e-mails among active candidates', async () => {
    const c = await api.createCandidate(await candidateInput(), RECRUITER);
    expect(c).toMatchObject({ stage: 'new', number: expect.stringMatching(/^CAN-\d{4}$/) });
    expect(await reasons(api.createCandidate(await candidateInput({ email: 'TEST.applicant@candidates.example.test' }), HR))).toEqual({ email: ['duplicateEmail'] });
    const edited = await api.updateCandidate(c.id, await candidateInput({ currentTitle: 'Senior Developer' }), HR);
    expect(edited.currentTitle).toBe('Senior Developer');
    const closed = (await api.getRequisitions({ ...ALL, filters: { status: 'closed' } }, HR)).items[0]!;
    expect(await reasons(api.createCandidate(await candidateInput({ email: 'x@candidates.example.test', requisitionId: closed.id }), HR))).toEqual({ requisitionId: ['requisitionNotOpen'] });
  });

  it('valid transitions only; history records every change; hired only through an accepted offer', async () => {
    const c = await api.createCandidate(await candidateInput(), HR);
    expect(c.nextStages).toEqual(['screening', 'rejected']);
    expect(await reasons(api.updateCandidateStage(c.id, 'interview', '', HR))).toEqual({ stage: ['invalidTransition'] });
    expect(await reasons(api.updateCandidateStage(c.id, 'hired', '', HR))).toEqual({ stage: ['hiredViaOffer'] });
    await api.updateCandidateStage(c.id, 'screening', 'CV looks good', HR);
    await api.updateCandidateStage(c.id, 'rejected', 'Not a fit', HR);
    expect(await reasons(api.updateCandidateStage(c.id, 'screening', '', HR))).toEqual({ stage: ['finalStage'] });
    const reopened = await api.reopenCandidate(c.id, 'Second look', HR);
    expect(reopened.stage).toBe('screening'); // back to the stage it was rejected from
    const history = await api.getCandidateHistory(c.id, HR);
    expect(history.map((h) => h.type)).toEqual(['reopened', 'stage', 'stage', 'applied']);
    expect(history[2]).toMatchObject({ from: 'new', to: 'screening', note: 'CV looks good', by: { en: 'Lina Haddad' } });
  });

  it('archive: refused with an open process; archived candidates are read-only and hidden by default', async () => {
    const c = await candidateAt('interview');
    await api.createInterview({ candidateId: c.id, type: 'video', start: `${addDays(TODAY, 2)}T10:00`, durationMinutes: 60, interviewerIds: ['emp-0002'], location: '', meetingLink: 'https://meet.example.test/x', notes: '' }, HR);
    expect(await reasons(api.archiveCandidate(c.id, HR))).toEqual({ archive: ['openProcess'] });
    await api.updateCandidateStage(c.id, 'rejected', '', HR); // also cancels the scheduled interview
    const archived = await api.archiveCandidate(c.id, HR);
    expect(archived).toMatchObject({ archived: true, can: { edit: false } });
    expect((await api.getCandidates({ ...ALL, search: c.number }, HR)).total).toBe(0);
    expect((await api.getCandidates({ ...ALL, search: c.number, filters: { archived: 'true' } }, HR)).total).toBe(1);
    expect(await code(api.updateCandidate(c.id, await candidateInput({ email: 'z@candidates.example.test' }), HR))).toBe('CONFLICT');
  });

  it('search by name, e-mail or number; filters by stage, source, experience', async () => {
    const c = (await api.getCandidates({ page: 1, pageSize: 1 }, HR)).items[0]!;
    expect((await api.getCandidates({ ...ALL, search: c.email }, HR)).items.map((x) => x.id)).toEqual([c.id]);
    expect((await api.getCandidates({ ...ALL, search: c.number }, HR)).items.map((x) => x.id)).toEqual([c.id]);
    expect((await api.getCandidates({ ...ALL, filters: { experience: '0-2' } }, HR)).items.every((x) => x.experienceYears <= 2)).toBe(true);
    const sorted = (await api.getCandidates({ ...ALL, sortBy: 'experienceYears', sortDirection: 'desc' }, HR)).items.map((x) => x.experienceYears);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
  });
});

describe('interviews and feedback', () => {
  const at = (days: number, time = '10:00') => `${addDays(TODAY, days)}T${time}`;
  const interview = (candidateId: string, patch: Partial<InterviewInput> = {}): InterviewInput => ({ candidateId, type: 'video', start: at(2), durationMinutes: 60, interviewerIds: ['emp-0002'], location: '', meetingLink: 'https://meet.example.test/abc', notes: '', ...patch });

  it('schedules (shortlisted → interview), refuses past times, double bookings and wrong stages; cancels with a reason', async () => {
    const c = await candidateAt('shortlisted');
    const i = await api.createInterview(interview(c.id), HR);
    expect(i.status).toBe('scheduled');
    expect((await api.getCandidateById(c.id, HR)).stage).toBe('interview');
    expect(await reasons(api.createInterview(interview(c.id, { start: at(-1) }), HR))).toEqual({ start: ['pastStart'] });
    expect(await reasons(api.createInterview(interview(c.id, { start: at(2, '10:30') }), HR))).toMatchObject({ interviewerIds: ['interviewerBusy'] });
    expect(await reasons(api.createInterview(interview(c.id, { start: at(2, '10:30'), interviewerIds: ['emp-0003'] }), HR))).toEqual({ start: ['candidateBusy'] });
    expect(await reasons(api.createInterview(interview(c.id, { type: 'video', meetingLink: '' }), HR))).toEqual({ meetingLink: ['meetingLinkRequired'] });
    const fresh = await api.createCandidate(await candidateInput({ email: 'fresh@candidates.example.test' }), HR);
    expect(await reasons(api.createInterview(interview(fresh.id, { start: at(4) }), HR))).toEqual({ candidateId: ['stageNotInterview'] });
    expect(await reasons(api.cancelInterview(i.id, ' ', HR))).toEqual({ reason: ['reasonRequired'] });
    expect((await api.cancelInterview(i.id, 'Candidate unavailable', HR)).status).toBe('cancelled');
    expect(await code(api.cancelInterview(i.id, 'again', HR))).toBe('CONFLICT');
  });

  it('feedback: after the interview, by an assigned interviewer, once; private to recruitment writers', async () => {
    const c = await candidateAt('interview');
    const i = await api.createInterview(interview(c.id, { interviewerIds: ['emp-0002', 'emp-0001'] }), HR);
    const fb = { interviewerId: 'emp-0002', overall: 4, technical: 4, communication: 5, problemSolving: 4, experience: 3, strengths: 'Clear answers', improvements: 'More depth', recommendation: 'hire' as const };
    expect(await reasons(api.submitInterviewFeedback(i.id, fb, HR))).toEqual({ interviewerId: ['notStarted'] });
    vi.setSystemTime(new Date(`${addDays(TODAY, 2)}T12:00`));
    expect(await reasons(api.submitInterviewFeedback(i.id, { ...fb, interviewerId: 'emp-0009' }, HR))).toEqual({ interviewerId: ['notInterviewer'] });
    expect(await reasons(api.submitInterviewFeedback(i.id, { ...fb, overall: 6 }, HR))).toEqual({ overall: ['ratingRequired'] });
    const done = await api.submitInterviewFeedback(i.id, fb, HR);
    expect(done).toMatchObject({ status: 'completed', feedbackCount: 1, pendingFeedbackFrom: ['emp-0001'] });
    expect(await code(api.submitInterviewFeedback(i.id, fb, HR))).toBe('CONFLICT');
    // The Department Manager (emp-0001) is an interviewer: may submit and read only their own feedback.
    expect(await code(api.submitInterviewFeedback(i.id, { ...fb, interviewerId: 'emp-0002' }, MANAGER))).toBe('FORBIDDEN');
    const theirs = await api.submitInterviewFeedback(i.id, { ...fb, interviewerId: 'emp-0001', recommendation: 'strong-hire' }, MANAGER);
    expect(theirs.feedback.map((f) => f.interviewer.id)).toEqual(['emp-0001']);
    expect(theirs.feedbackCount).toBe(2);
    expect((await api.getInterviewById(i.id, HR)).feedback).toHaveLength(2);
  });
});

describe('offers', () => {
  it('draft → sent → accepted makes the candidate hired; expiry, salary range and one active offer are enforced', async () => {
    const c = await candidateAt('assessment', 'offer.me@candidates.example.test');
    const req = await api.getRequisitionById(c.requisition.id, HR);
    if (req.salaryRange) expect(await reasons(api.createOffer(await offerInputFor(c, { salary: req.salaryRange.max + 100 }), HR))).toEqual({ salary: ['outsideRange'] });
    expect(await reasons(api.createOffer(await offerInputFor(c, { expiryDate: addDays(TODAY, -1) }), HR))).toEqual({ expiryDate: ['expiryPast'] });
    expect(await reasons(api.createOffer(await offerInputFor(c, { expiryDate: addDays(TODAY, 40) }), HR))).toEqual({ expiryDate: ['expiryAfterStart'] });
    let offer = await api.createOffer(await offerInputFor(c), HR);
    expect(offer.status).toBe('draft');
    expect((await api.getCandidateById(c.id, HR)).stage).toBe('offer');
    expect(await reasons(api.createOffer(await offerInputFor(c), HR))).toEqual({ candidateId: ['activeOffer'] });
    offer = await api.updateOffer(offer.id, await offerInputFor(c, { benefits: 'Updated' }), HR);
    offer = await api.updateOfferStatus(offer.id, 'sent', '', HR);
    expect(await code(api.updateOffer(offer.id, await offerInputFor(c), HR))).toBe('CONFLICT'); // only drafts are edited
    expect(await reasons(api.updateCandidateStage(c.id, 'rejected', '', HR))).toEqual({ stage: ['activeOffer'] });
    offer = await api.updateOfferStatus(offer.id, 'accepted', 'Signed', HR);
    expect(offer.status).toBe('accepted');
    const hired = await api.getCandidateById(c.id, HR);
    expect(hired).toMatchObject({ stage: 'hired', can: { convert: true } });
    expect(await code(api.updateOfferStatus(offer.id, 'withdrawn', '', HR))).toBe('CONFLICT');
  });

  it('a sent offer expires after its expiry date and can no longer be accepted', async () => {
    const c = await candidateAt('interview', 'expiring@candidates.example.test');
    let offer = await api.createOffer(await offerInputFor(c, { expiryDate: addDays(TODAY, 2) }), HR);
    offer = await api.updateOfferStatus(offer.id, 'sent', '', HR);
    vi.setSystemTime(new Date(`${addDays(TODAY, 3)}T09:00`));
    expect((await api.getOfferById(offer.id, HR)).status).toBe('expired');
    expect(await code(api.updateOfferStatus(offer.id, 'accepted', '', HR))).toBe('CONFLICT');
    expect((await api.getCandidateHistory(c.id, HR))[0]!.type).toBe('offer-expired');
  });

  it('rejected and withdrawn offers leave the candidate in the offer stage; a new offer can follow', async () => {
    const c = await candidateAt('interview', 'decline@candidates.example.test');
    const first = await api.updateOfferStatus((await api.createOffer(await offerInputFor(c), HR)).id, 'sent', '', HR);
    expect((await api.updateOfferStatus(first.id, 'rejected', 'Accepted another offer', HR)).status).toBe('rejected');
    const second = await api.createOffer(await offerInputFor(c), HR);
    expect((await api.updateOfferStatus(second.id, 'withdrawn', '', HR)).status).toBe('withdrawn');
    expect((await api.getCandidateById(c.id, HR)).stage).toBe('offer');
  });
});

describe('candidate → employee conversion', () => {
  async function readyCandidate() {
    return (await api.getCandidates({ ...ALL, filters: { stage: 'hired' } }, HR)).items.find((c) => c.can.convert)!;
  }
  function employeeInput(draft: Awaited<ReturnType<typeof api.getConversionDraft>>): EmployeeInput {
    return {
      employeeNumber: draft.employeeNumber,
      name: draft.name,
      dateOfBirth: '1995-04-12',
      gender: 'female',
      nationality: 'JO',
      maritalStatus: 'single',
      workEmail: draft.workEmail,
      personalEmail: draft.personalEmail,
      phone: draft.phone,
      alternativePhone: '',
      address: 'Building 1',
      city: 'Amman',
      country: 'JO',
      hireDate: draft.hireDate,
      employmentType: draft.employmentType,
      contractStartDate: draft.hireDate,
      contractEndDate: null,
      probationEndDate: null,
      departmentId: draft.departmentId,
      positionId: draft.positionId,
      locationId: draft.locationId,
      managerId: draft.managerId,
      reportingDepartmentId: null,
      emergencyContact: { name: 'Contact Person', relationship: 'parent', phone: '+962 79 000 0000', alternativePhone: '' },
    };
  }

  it('creates exactly one employee through Employee Management and links it', async () => {
    const before = employeeRecords.all().length;
    const c = await readyCandidate();
    const draft = await api.getConversionDraft(c.id, HR);
    expect(draft).toMatchObject({ candidateId: c.id, personalEmail: c.email, employeeNumber: expect.stringMatching(/^EMP-\d{4}$/) });
    const converted = await api.convertCandidateToEmployee(c.id, employeeInput(draft), HR);
    expect(employeeRecords.all().length).toBe(before + 1);
    const employee = employeeRecords.get(converted.employeeId!)!;
    expect(employee).toMatchObject({ employeeNumber: draft.employeeNumber, departmentId: draft.departmentId, hireDate: draft.hireDate });
    expect(converted.can.convert).toBe(false);
    expect((await api.getCandidateHistory(c.id, HR))[0]).toMatchObject({ type: 'converted', refId: employee.id });
    // A second conversion is refused; history is preserved.
    expect(await code(api.convertCandidateToEmployee(c.id, employeeInput({ ...draft, employeeNumber: 'EMP-9999', workEmail: 'other@staff.datahubhr.test' }), HR))).toBe('CONFLICT');
    expect(employeeRecords.all().length).toBe(before + 1);
  });

  it("Employee Management's rules apply (duplicate number), and only roles with organization.employees.manage may convert", async () => {
    const c = await readyCandidate();
    const draft = await api.getConversionDraft(c.id, HR);
    expect(await reasons(api.convertCandidateToEmployee(c.id, employeeInput({ ...draft, employeeNumber: 'EMP-0001' }), HR))).toMatchObject({ employeeNumber: ['duplicate'] });
    expect(await code(api.convertCandidateToEmployee(c.id, employeeInput(draft), RECRUITER))).toBe('FORBIDDEN'); // recruiter has no organization.employees.manage
    const notHired = (await api.getCandidates({ ...ALL, filters: { stage: 'interview' } }, HR)).items[0]!;
    expect(await reasons(api.getConversionDraft(notHired.id, HR))).toEqual({ candidateId: ['notHired'] });
  });
});

describe('permissions and scope', () => {
  it('Department Manager: own requisitions only, read-only, no offers or salaries', async () => {
    const team = await api.getRequisitions(ALL, MANAGER);
    const units = employeeRecords.teamUnits(users['department-manager']);
    expect(team.total).toBeGreaterThan(0);
    for (const r of team.items) expect(units.has(r.department.id) || r.hiringManager?.id === 'emp-0001', r.number).toBe(true);
    for (const r of team.items) expect(r.salaryRange).toBeNull();
    const candidates = (await api.getCandidates(ALL, MANAGER)).items;
    expect(candidates.every((c) => c.expectedSalary === null && c.can.edit === false && c.nextStages.length === 0)).toBe(true);
    expect(await code(api.getOffers(ALL, MANAGER))).toBe('FORBIDDEN');
    expect(await code(api.createCandidate(await candidateInput({ email: 'dm@candidates.example.test' }), MANAGER))).toBe('FORBIDDEN');
    const outside = (await api.getRequisitions(ALL, HR)).items.find((r) => !units.has(r.department.id) && r.hiringManager?.id !== 'emp-0001')!;
    expect(await code(api.getRequisitionById(outside.id, MANAGER))).toBe('FORBIDDEN');
    expect((await api.getCandidateHistory(candidates[0]!.id, MANAGER)).some((h) => h.type.startsWith('offer-'))).toBe(false);
  });

  it('Employee and Payroll Officer have no recruitment access; a forged scope is refused', async () => {
    for (const role of ['employee', 'payroll-officer'] as const) {
      expect(await code(api.getRecruitmentSummary(scopeOf(role)))).toBe('FORBIDDEN');
      expect(await code(api.getCandidates(ALL, { ...scopeOf(role), kind: 'team' }))).toBe('FORBIDDEN');
    }
  });

  it('HR Manager and Recruiter manage recruitment; staff options need recruitment.jobs.manage', async () => {
    expect((await api.getStaffOptions('', RECRUITER)).length).toBeGreaterThan(0);
    expect(await code(api.getStaffOptions('', MANAGER))).toBe('FORBIDDEN');
    expect((await api.createCandidate(await candidateInput({ email: 'hrm@candidates.example.test' }), scopeOf('hr-manager'))).stage).toBe('new');
  });
});
