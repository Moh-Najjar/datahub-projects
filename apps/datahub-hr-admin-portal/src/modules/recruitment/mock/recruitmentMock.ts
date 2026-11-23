import type { Localized } from '@datahub/shared-types';
import { queryCollection } from '@/core/api/mock/collection';
import { ApiError, type ListParams, type Paginated } from '@/core/api/types';
import { hasPermission } from '@/core/config/permissions';
import { createEmployee, employeeRecords } from '@/modules/employees/mock/employeesMock';
import type { EmployeeInput } from '@/modules/employees';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import {
  validateCandidateInput,
  validateFeedbackInput,
  validateInterviewInput,
  validateOfferInput,
  validateReason,
  validateRequisitionInput,
  type FieldErrors,
} from '@/modules/recruitment/schemas/recruitmentSchemas';
import {
  CANDIDATE_STAGES,
  FUNNEL_STEPS,
  type ActivityItem,
  type Candidate,
  type CandidateEvent,
  type CandidateEventType,
  type CandidateFilters,
  type CandidateInput,
  type CandidateSource,
  type CandidateStage,
  type CandidateSummary,
  type ConversionDraft,
  type Currency,
  type EducationLevel,
  type EmploymentType,
  type FeedbackInput,
  type Interview,
  type InterviewFeedback,
  type InterviewFilters,
  type InterviewInput,
  type InterviewStatus,
  type InterviewType,
  type NamedRef,
  type Offer,
  type OfferFilters,
  type OfferInput,
  type OfferStatus,
  type PersonName,
  type Recommendation,
  type RecruitmentScope,
  type RecruitmentSummary,
  type Requisition,
  type RequisitionFilters,
  type RequisitionInput,
  type RequisitionRef,
  type RequisitionStatus,
  type SalaryRange,
  type StaffOption,
} from '@/modules/recruitment/types/recruitment';
import {
  ACTIVE_STAGES,
  addDays,
  canMoveStage,
  experienceBand,
  funnelStepsReached,
  INTERVIEW_STAGES,
  OFFER_STAGES,
  OFFER_TRANSITIONS,
  REQUISITION_TRANSITIONS,
  STAGE_TRANSITIONS,
  toMs,
  todayIso,
} from '@/modules/recruitment/utils/pipeline';
import { BENEFITS, CITIES, COMPANIES, FIRST_FEMALE, FIRST_MALE, LANGUAGES, LAST_NAMES, REJECTION_NOTES, SALARY_BY_LEVEL, SKILLS } from './seed';

/*
 * SIMULATED recruitment backend (in memory, reset on reload) — part of the same simulated backend as the employees and
 * organization mocks: requisitions reference Organization ids, hiring managers / recruiters / interviewers are Employee
 * ids, and converting a hired candidate creates the employee through Employee Management's own `createEmployee` (same
 * validation, same employee-number rules) — there is no second employee table. Rules the real backend must enforce:
 *
 * - Scope: `organization` (recruitment.jobs.view) or `team` (hr.recruitment.view.team — read-only: requisitions of the
 *   departments the user manages or where they are the hiring manager, those candidates and interviews, the user's own
 *   interview feedback; never salaries or offers). Writes need `recruitment.jobs.manage`; conversion also `organization.employees.manage`.
 * - Workflows: requisition statuses, candidate pipeline (utils/pipeline.ts), interviews and offers with their own
 *   transitions; "hired" only through an accepted offer; hired/rejected are final unless explicitly reopened.
 * - Nothing is sent: job publishing, interview invitations and offers are SIMULATED status changes.
 */


interface RequisitionRow {
  id: string;
  number: string;
  title: Localized<string>;
  departmentId: string;
  positionId: string;
  locationId: string;
  employmentType: EmploymentType;
  vacancies: number;
  hiringManagerId: string | null;
  recruiterId: string | null;
  description: string;
  skills: string[];
  minExperienceYears: number;
  education: EducationLevel;
  salaryRange: SalaryRange | null;
  openingDate: string;
  closingDate: string | null;
  status: RequisitionStatus;
  createdAt: string;
  history: Requisition['history'];
}

interface CandidateRow {
  id: string;
  number: string;
  name: PersonName;
  email: string;
  phone: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  experienceYears: number;
  education: EducationLevel;
  skills: string[];
  languages: string[];
  linkedinUrl: string;
  portfolioUrl: string;
  requisitionId: string;
  appliedAt: string;
  source: CandidateSource;
  recruiterId: string | null;
  stage: CandidateStage;
  expectedSalary: number | null;
  notes: string;
  archived: boolean;
  archivedAt: string | null;
  employeeId: string | null;
  createdAt: string;
  history: CandidateEvent[];
}

interface FeedbackRow extends Omit<InterviewFeedback, 'interviewer'> {
  interviewerId: string;
}

interface InterviewRow {
  id: string;
  candidateId: string;
  type: InterviewType;
  status: InterviewStatus;
  start: string;
  durationMinutes: number;
  interviewerIds: string[];
  location: string;
  meetingLink: string;
  notes: string;
  cancelReason: string | null;
  createdAt: string;
  feedback: FeedbackRow[];
}

interface OfferRow {
  id: string;
  number: string;
  candidateId: string;
  requisitionId: string;
  positionId: string;
  departmentId: string;
  locationId: string;
  salary: number;
  currency: Currency;
  employmentType: EmploymentType;
  startDate: string;
  expiryDate: string;
  benefits: string;
  status: OfferStatus;
  createdAt: string;
  sentAt: string | null;
  respondedAt: string | null;
  history: Offer['history'];
}

interface Db {
  requisitions: RequisitionRow[];
  candidates: CandidateRow[];
  interviews: InterviewRow[];
  offers: OfferRow[];
  seq: { req: number; can: number; int: number; off: number };
}

let db: Db | null = null;

/** Restore the initial state (tests). Data is regenerated on next use, relative to the current date. */
export function resetRecruitmentMock(): void {
  db = null;
}

/* Helpers ------------------------------------------------------------------------------------------------ */

const SYSTEM: Localized<string> = { en: 'System', ar: 'النظام' };
const nowIso = () => new Date().toISOString();
const pad = (n: number, w: number) => String(n).padStart(w, '0');

function invalid(errors: FieldErrors): never {
  throw new ApiError('VALIDATION', 'Validation failed', errors);
}
function forbidden(message = 'Outside your recruitment scope'): never {
  throw new ApiError('FORBIDDEN', message);
}
function conflict(message: string): never {
  throw new ApiError('CONFLICT', message);
}
function notFound(what: string, id: string): never {
  throw new ApiError('NOT_FOUND', `${what} ${id} not found`);
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
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

const department = (id: string) => orgTables.departments().find((d) => d.id === id);
const position = (id: string) => orgTables.positions().find((p) => p.id === id);
const location = (id: string) => orgTables.locations().find((l) => l.id === id);
const deptRef = (id: string): NamedRef => ({ id, name: department(id)?.name ?? { en: id, ar: id } });
const posRef = (id: string): NamedRef => ({ id, name: position(id)?.title ?? { en: id, ar: id } });
const locRef = (id: string): NamedRef => ({ id, name: location(id)?.name ?? { en: id, ar: id } });
function personRef(id: string | null): NamedRef | null {
  const e = id ? employeeRecords.get(id) : undefined;
  return e ? { id: e.id, name: employeeRecords.fullName(e) } : null;
}
const isActiveEmployee = (id: string) => employeeRecords.get(id)?.status === 'active';

function topLevel(departmentId: string): string {
  let current = department(departmentId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = department(current.parentId);
  }
  return current?.id ?? departmentId;
}

function managerOf(departmentId: string): string | null {
  let current = department(departmentId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.managerId && isActiveEmployee(current.managerId)) return current.managerId;
    current = current.parentId ? department(current.parentId) : undefined;
  }
  return null;
}

const meOf = (scope: RecruitmentScope) => employeeRecords.employeeIdOf(scope.userId) ?? null;

function actor(scope: RecruitmentScope): Localized<string> {
  const id = meOf(scope);
  const e = id ? employeeRecords.get(id) : undefined;
  return e ? employeeRecords.fullName(e) : { en: scope.userId, ar: scope.userId };
}

const fullName = (n: PersonName): Localized<string> => ({ en: `${n.first.en} ${n.last.en}`.trim(), ar: `${n.first.ar || n.first.en} ${n.last.ar || n.last.en}`.trim() });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/* Seed generation ----------------------------------------------------------------------------------------- */

const STAGE_PATH: readonly CandidateStage[] = ['new', 'screening', 'shortlisted', 'interview', 'assessment', 'offer', 'hired'];
const at = (date: string, hour: number, minute = 0) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute).toISOString();
};

function generate(): Db {
  const today = todayIso();
  const year = today.slice(0, 4);
  const r = prng(hashString('recruitment-seed-v1'));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
  const between = (from: string, to: string) => {
    const span = Math.round((toMs(to) - toMs(from)) / 86_400_000);
    return span <= 0 ? from : addDays(from, Math.floor(r() * (span + 1)));
  };
  const out: Db = { requisitions: [], candidates: [], interviews: [], offers: [], seq: { req: 0, can: 0, int: 0, off: 0 } };
  const employees = employeeRecords.all();
  const active = employees.filter((e) => e.status === 'active');
  const hrPeople = active.filter((e) => topLevel(e.departmentId) === 'dep-hr' && e.id !== 'emp-0003' && e.id !== 'emp-0004');
  const recruiterPool = ['emp-0004', 'emp-0004', ...hrPeople.slice(0, 2).map((e) => e.id)];
  const usedEmails = new Set<string>();
  const peopleOf = (departmentId: string) => active.filter((e) => e.departmentId === departmentId || topLevel(e.departmentId) === topLevel(departmentId));

  const newRequisition = (positionId: string, departmentId: string, locationId: string, status: RequisitionStatus, openingDate: string, closingDate: string | null, vacancies: number): RequisitionRow => {
    const pos = position(positionId)!;
    const range = SALARY_BY_LEVEL[pos.level] ?? SALARY_BY_LEVEL.mid!;
    const top = topLevel(departmentId);
    const pool = SKILLS[top] ?? SKILLS.GENERAL!;
    const skills = [...new Set(Array.from({ length: 4 }, () => pick(pool)))];
    const createdAt = at(addDays(openingDate, -12), 9, 15);
    const recruiterId = pick(recruiterPool);
    const by = personRef(recruiterId)?.name ?? SYSTEM;
    const history: Requisition['history'] = [{ at: createdAt, by, note: '', from: null, to: 'draft' }];
    const flow: RequisitionStatus[] = status === 'draft' ? [] : status === 'pending-approval' ? ['pending-approval'] : status === 'cancelled' ? ['pending-approval', 'cancelled'] : ['pending-approval', 'open', ...(status === 'open' ? [] : [status])];
    let prev: RequisitionStatus = 'draft';
    flow.forEach((to, i) => {
      const day = to === 'open' ? openingDate : to === 'closed' || to === 'on-hold' || to === 'cancelled' ? addDays(openingDate, 25 + i * 5) : addDays(openingDate, -8 + i);
      history.push({ at: at(day > today ? today : day, 11), by: to === 'open' ? (personRef('emp-0002')?.name ?? SYSTEM) : by, note: '', from: prev, to });
      prev = to;
    });
    out.seq.req++;
    const row: RequisitionRow = {
      id: `req-${pad(out.seq.req, 3)}`,
      number: `REQ-${year}-${pad(out.seq.req, 3)}`,
      title: pos.title,
      departmentId,
      positionId,
      locationId,
      employmentType: pos.level === 'entry' && r() < 0.3 ? 'intern' : r() < 0.1 ? 'contract' : 'full-time',
      vacancies,
      hiringManagerId: managerOf(departmentId),
      recruiterId,
      description: `We are looking for a ${pos.title.en} to join the ${department(departmentId)?.name.en ?? ''} team. (Fictional demo posting.)`,
      skills,
      minExperienceYears: { entry: 0, junior: 1, mid: 3, senior: 5, lead: 6, manager: 7, director: 10, executive: 12 }[pos.level] ?? 2,
      education: pos.level === 'entry' ? 'diploma' : 'bachelor',
      salaryRange: r() < 0.75 ? { min: range[0], max: range[1], currency: 'JOD' } : null,
      openingDate,
      closingDate,
      status,
      createdAt,
      history,
    };
    out.requisitions.push(row);
    return row;
  };

  const newPerson = (): { name: PersonName; email: string } => {
    for (;;) {
      const first = pick(r() < 0.5 ? FIRST_MALE : FIRST_FEMALE);
      const last = pick(LAST_NAMES);
      const base = `${slug(first[0])}.${slug(last[0])}`;
      let email = `${base}@candidates.example.test`;
      for (let n = 2; usedEmails.has(email); n++) email = `${base}${n}@candidates.example.test`;
      usedEmails.add(email);
      return { name: { first: { en: first[0], ar: first[1] }, last: { en: last[0], ar: last[1] } }, email };
    }
  };

  /** A candidate whose pipeline history follows the valid transitions up to `stage` (or rejected after `rejectedFrom`). */
  const newCandidate = (req: RequisitionRow, appliedAt: string, stage: CandidateStage, person = newPerson(), rejectedFrom?: CandidateStage): CandidateRow => {
    out.seq.can++;
    const range = req.salaryRange;
    const pool = SKILLS[topLevel(req.departmentId)] ?? SKILLS.GENERAL!;
    const recruiter = personRef(req.recruiterId)?.name ?? SYSTEM;
    const history: CandidateEvent[] = [{ at: at(appliedAt, 8, 30), type: 'applied', from: null, to: 'new', by: SYSTEM, note: '', refId: null }];
    const target = stage === 'rejected' ? (rejectedFrom ?? 'new') : stage;
    let day = appliedAt;
    for (let i = 1; i <= STAGE_PATH.indexOf(target); i++) {
      const to = STAGE_PATH[i]!;
      if (to === 'hired') break; // hired is recorded by the accepted offer
      day = addDays(day, 2 + Math.floor(r() * 5));
      if (day > today) day = today;
      history.push({ at: at(day, 10 + i), type: 'stage', from: STAGE_PATH[i - 1]!, to, by: recruiter, note: '', refId: null });
    }
    if (stage === 'rejected') {
      day = addDays(day, 1 + Math.floor(r() * 4));
      if (day > today) day = today;
      history.push({ at: at(day, 16), type: 'stage', from: target, to: 'rejected', by: recruiter, note: pick(REJECTION_NOTES), refId: null });
    }
    const row: CandidateRow = {
      id: `can-${pad(out.seq.can, 4)}`,
      number: `CAN-${pad(out.seq.can, 4)}`,
      name: person.name,
      email: person.email,
      phone: `+962 7${7 + Math.floor(r() * 3)} 000 ${pad(Math.floor(r() * 10000), 4)}`,
      location: pick(CITIES),
      currentTitle: r() < 0.85 ? (position(req.positionId)?.title.en ?? '') : '',
      currentCompany: r() < 0.85 ? pick(COMPANIES) : '',
      experienceYears: req.minExperienceYears + Math.floor(r() * 7),
      education: r() < 0.7 ? 'bachelor' : r() < 0.5 ? 'master' : 'diploma',
      skills: [...new Set(Array.from({ length: 3 + Math.floor(r() * 3) }, () => pick(pool)))],
      languages: r() < 0.3 ? ['Arabic', 'English', pick(LANGUAGES.slice(2))] : ['Arabic', 'English'],
      linkedinUrl: r() < 0.5 ? `https://profiles.example.test/${slug(person.name.first.en)}-${slug(person.name.last.en)}` : '',
      portfolioUrl: r() < 0.15 ? `https://portfolio.example.test/${slug(person.name.first.en)}` : '',
      requisitionId: req.id,
      appliedAt,
      source: pick(['careers-site', 'careers-site', 'linkedin', 'referral', 'job-board', 'agency', 'university'] as const),
      recruiterId: req.recruiterId,
      stage,
      expectedSalary: range && r() < 0.7 ? Math.round((range.min + r() * (range.max - range.min)) / 10) * 10 : null,
      notes: '',
      archived: false,
      archivedAt: null,
      employeeId: null,
      createdAt: at(appliedAt, 8, 30),
      history,
    };
    out.candidates.push(row);
    return row;
  };

  const entered = (c: CandidateRow, stage: CandidateStage) => c.history.find((h) => h.to === stage)?.at.slice(0, 10) ?? null;
  const interviewersFor = (req: RequisitionRow) => {
    const people = peopleOf(req.departmentId).filter((e) => e.id !== req.hiringManagerId);
    const second = people.length ? people[Math.floor(r() * people.length)]!.id : null;
    return [...new Set([req.hiringManagerId, second].filter((x): x is string => Boolean(x)))];
  };
  const feedbackFor = (interviewerId: string, startDay: string, strong: boolean): FeedbackRow => {
    const base = strong ? 4 : 2;
    const score = () => Math.min(5, Math.max(1, base + Math.floor(r() * 2) - (r() < 0.15 ? 1 : 0)));
    const overall = score();
    const recommendation: Recommendation = overall >= 5 ? 'strong-hire' : overall >= 4 ? 'hire' : overall === 3 ? 'hold' : 'reject';
    return {
      interviewerId,
      overall,
      technical: score(),
      communication: score(),
      problemSolving: score(),
      experience: score(),
      strengths: strong ? 'Clear examples from previous work; structured answers.' : 'Friendly and motivated.',
      improvements: strong ? 'Could go deeper on scaling questions.' : 'Limited hands-on experience for this level.',
      recommendation,
      submittedAt: at(addDays(startDay, 1), 9),
      submittedBy: personRef(interviewerId)?.name ?? SYSTEM,
    };
  };
  const newInterview = (c: CandidateRow, req: RequisitionRow, start: string, status: InterviewStatus, withFeedback: boolean, strong: boolean): InterviewRow => {
    out.seq.int++;
    const interviewerIds = interviewersFor(req);
    const type: InterviewType = pick(['video', 'in-person', 'technical', 'hr', 'phone'] as const);
    const row: InterviewRow = {
      id: `int-${pad(out.seq.int, 4)}`,
      candidateId: c.id,
      type,
      status,
      start,
      durationMinutes: pick([30, 45, 60, 60, 90]),
      interviewerIds,
      location: type === 'in-person' || type === 'technical' ? `${location(req.locationId)?.name.en ?? 'Office'} — meeting room ${1 + Math.floor(r() * 6)}` : '',
      meetingLink: type === 'video' ? `https://meet.example.test/${c.number.toLowerCase()}-${out.seq.int}` : '',
      notes: '',
      cancelReason: status === 'cancelled' ? 'Candidate asked to reschedule.' : null,
      createdAt: at(addDays(start.slice(0, 10), -3), 9),
      feedback: withFeedback ? interviewerIds.map((id) => feedbackFor(id, start.slice(0, 10), strong)) : [],
    };
    out.interviews.push(row);
    c.history.push({ at: row.createdAt, type: 'interview-scheduled', from: null, to: null, by: personRef(req.recruiterId)?.name ?? SYSTEM, note: '', refId: row.id });
    if (status === 'completed') c.history.push({ at: at(start.slice(0, 10), 18), type: 'interview-completed', from: null, to: null, by: SYSTEM, note: '', refId: row.id });
    if (status === 'cancelled') c.history.push({ at: at(addDays(start.slice(0, 10), -1), 12), type: 'interview-cancelled', from: null, to: null, by: SYSTEM, note: row.cancelReason ?? '', refId: row.id });
    if (status === 'no-show') c.history.push({ at: at(start.slice(0, 10), 18), type: 'interview-no-show', from: null, to: null, by: SYSTEM, note: '', refId: row.id });
    return row;
  };
  const newOffer = (c: CandidateRow, req: RequisitionRow, status: OfferStatus, startDate: string, expiryDate: string, createdDay: string): OfferRow => {
    out.seq.off++;
    const range = req.salaryRange ?? { min: 800, max: 1200, currency: 'JOD' as const };
    const by = personRef(req.recruiterId)?.name ?? SYSTEM;
    const createdAt = at(createdDay, 10);
    const history: Offer['history'] = [{ at: createdAt, by, note: '', from: null, to: 'draft' }];
    const sentAt = status === 'draft' || (status === 'withdrawn' && r() < 0.5) ? null : at(addDays(createdDay, 1), 11);
    if (sentAt) history.push({ at: sentAt, by, note: '', from: 'draft', to: 'sent' });
    const respondedAt = status === 'accepted' || status === 'rejected' ? at(addDays(createdDay, 3), 15) : null;
    if (status !== 'draft' && status !== 'sent') history.push({ at: respondedAt ?? at(addDays(createdDay, 2), 12), by: status === 'accepted' || status === 'rejected' ? fullName(c.name) : by, note: status === 'rejected' ? 'Accepted another offer.' : '', from: sentAt ? 'sent' : 'draft', to: status });
    const row: OfferRow = {
      id: `off-${pad(out.seq.off, 3)}`,
      number: `OFF-${year}-${pad(out.seq.off, 3)}`,
      candidateId: c.id,
      requisitionId: req.id,
      positionId: req.positionId,
      departmentId: req.departmentId,
      locationId: req.locationId,
      salary: Math.round((range.min + (range.max - range.min) * (0.3 + r() * 0.5)) / 10) * 10,
      currency: range.currency,
      employmentType: req.employmentType,
      startDate,
      expiryDate,
      benefits: BENEFITS,
      status,
      createdAt,
      sentAt,
      respondedAt,
      history,
    };
    out.offers.push(row);
    const type = (s: OfferStatus): CandidateEventType => (s === 'sent' ? 'offer-sent' : s === 'accepted' ? 'offer-accepted' : s === 'rejected' ? 'offer-rejected' : 'offer-withdrawn');
    c.history.push({ at: createdAt, type: 'offer-created', from: null, to: null, by, note: '', refId: row.id });
    for (const h of history.slice(1)) c.history.push({ at: h.at, type: type(h.to), from: null, to: null, by: h.by, note: h.note, refId: row.id });
    return row;
  };
  /** Interviews (and offers) consistent with the stage a candidate reached. */
  const addProcess = (c: CandidateRow, req: RequisitionRow) => {
    const reached = c.stage === 'rejected' ? (c.history.filter((h) => h.type === 'stage' && h.to !== 'rejected').at(-1)?.to ?? 'new') : c.stage;
    const interviewDay = entered(c, 'interview');
    if (!interviewDay) return;
    const beyond = ['assessment', 'offer', 'hired'].includes(reached) || (c.stage === 'rejected' && reached === 'interview');
    if (c.stage === 'interview') {
      const roll = r();
      if (roll < 0.55) newInterview(c, req, `${addDays(today, 1 + Math.floor(r() * 12))}T${pick(['09:00', '10:30', '12:00', '13:30', '15:00'])}`, 'scheduled', false, true);
      else if (roll < 0.85) {
        const day = interviewDay < today ? between(interviewDay, addDays(today, -1)) : addDays(today, -1);
        const row = newInterview(c, req, `${day}T10:00`, 'completed', true, r() < 0.6);
        row.feedback = row.feedback.slice(0, row.interviewerIds.length - 1); // the last interviewer still owes feedback
      } else newInterview(c, req, `${addDays(interviewDay, 1)}T11:00`, r() < 0.5 ? 'no-show' : 'cancelled', false, false);
    } else if (beyond) {
      const strong = c.stage !== 'rejected';
      newInterview(c, req, `${addDays(interviewDay, 1)}T10:00`, 'completed', true, strong);
      if (r() < 0.5 && c.stage !== 'rejected') newInterview(c, req, `${addDays(interviewDay, 3)}T13:30`, 'completed', true, strong);
    }
  };

  // 1) Closed requisitions behind real recent hires: the hired candidate IS that employee (already converted).
  const recentHires = active.filter((e) => e.hireDate > addDays(today, -200) && e.hireDate <= addDays(today, -7) && position(e.positionId)?.status === 'active').sort((a, b) => a.hireDate.localeCompare(b.hireDate)).slice(-5);
  for (const e of recentHires) {
    const opening = addDays(e.hireDate, -75);
    const req = newRequisition(e.positionId, e.departmentId, e.locationId, 'closed', opening, addDays(e.hireDate, -30), 1);
    for (let i = 0; i < 3 + Math.floor(r() * 4); i++) {
      const from = pick(['new', 'screening', 'shortlisted', 'interview'] as const);
      const c = newCandidate(req, between(opening, addDays(opening, 20)), 'rejected', undefined, from);
      addProcess(c, req);
    }
    const hired = newCandidate(req, addDays(opening, 4), 'offer', { name: e.name, email: `${slug(e.name.first.en)}.${slug(e.name.last.en)}@candidates.example.test` });
    hired.currentTitle = '';
    addProcess(hired, req);
    const offer = newOffer(hired, req, 'accepted', e.hireDate, addDays(e.hireDate, -36), addDays(e.hireDate, -42));
    hired.stage = 'hired';
    hired.history.push({ at: offer.respondedAt!, type: 'stage', from: 'offer', to: 'hired', by: SYSTEM, note: '', refId: offer.id });
    hired.employeeId = e.id;
    hired.history.push({ at: at(addDays(e.hireDate, -20), 10), type: 'converted', from: null, to: null, by: personRef('emp-0002')?.name ?? SYSTEM, note: '', refId: e.id });
  }

  // 2) Current requisitions across departments.
  const used = new Set(out.requisitions.map((q) => q.positionId));
  const positions = orgTables
    .positions()
    .filter((p) => p.status === 'active' && department(p.departmentId)?.status === 'active' && p.level !== 'executive' && !used.has(p.id))
    .map((p) => ({ p, k: r() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 18)
    .map((x) => x.p);
  const plan: RequisitionStatus[] = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'on-hold', 'on-hold', 'draft', 'draft', 'pending-approval', 'pending-approval', 'cancelled'];
  const locations = orgTables.locations().filter((l) => l.status === 'active');
  let readyToConvert = 0;
  positions.forEach((p, i) => {
    const status = plan[i] ?? 'open';
    const opening = status === 'draft' ? addDays(today, 7 + Math.floor(r() * 20)) : status === 'pending-approval' ? addDays(today, 3 + Math.floor(r() * 10)) : addDays(today, -(15 + Math.floor(r() * 140)));
    const closing = status === 'open' || status === 'on-hold' ? (r() < 0.3 ? null : addDays(today, 10 + Math.floor(r() * 60))) : status === 'draft' || status === 'pending-approval' ? addDays(opening, 60) : addDays(opening, 40);
    const vacancies = 1 + (r() < 0.3 ? 1 : 0) + (r() < 0.1 ? 1 : 0);
    const loc = locations[0] && r() < 0.7 ? locations[0] : pick(locations);
    const req = newRequisition(p.id, p.departmentId, loc.id, status, opening, closing, vacancies);
    if (status === 'draft' || status === 'pending-approval') return;
    const last = status === 'cancelled' ? addDays(opening, 25) : today;
    const count = status === 'open' ? 5 + Math.floor(r() * 10) : 3 + Math.floor(r() * 4);
    for (let n = 0; n < count; n++) {
      const applied = between(opening, last);
      const age = (toMs(today) - toMs(applied)) / 86_400_000;
      let stage: CandidateStage;
      let rejectedFrom: CandidateStage | undefined;
      const roll = r();
      if (status === 'cancelled') stage = 'rejected';
      else if (age < 4) stage = roll < 0.7 ? 'new' : 'screening';
      else if (roll < 0.28) stage = 'rejected';
      else if (roll < 0.38) stage = 'new';
      else if (roll < 0.52) stage = 'screening';
      else if (roll < 0.64) stage = 'shortlisted';
      else if (roll < 0.82) stage = 'interview';
      else if (roll < 0.91) stage = 'assessment';
      else stage = 'offer';
      if (stage === 'rejected') rejectedFrom = pick(['new', 'screening', 'screening', 'shortlisted', 'interview'] as const);
      if (stage !== 'new' && age < 3) stage = 'new';
      const c = newCandidate(req, applied, stage, undefined, rejectedFrom);
      addProcess(c, req);
      if (c.stage === 'offer') {
        const created = addDays(entered(c, 'offer') ?? today, 0);
        const o = r();
        if (o < 0.15) newOffer(c, req, 'sent', addDays(today, 30), addDays(today, -2), addDays(created > addDays(today, -10) ? addDays(today, -10) : created, 0)); // will expire on read
        else if (o < 0.6) newOffer(c, req, 'sent', addDays(today, 21 + Math.floor(r() * 20)), addDays(today, 3 + Math.floor(r() * 8)), created > today ? today : created);
        else if (o < 0.8) newOffer(c, req, 'draft', addDays(today, 30), addDays(today, 10), created > today ? today : created);
        else newOffer(c, req, pick(['rejected', 'withdrawn'] as const), addDays(today, 25), addDays(today, 5), created > today ? today : created);
      }
    }
    // Two hired candidates with an accepted offer starting soon: ready to convert into employees.
    if (status === 'open' && readyToConvert < 2) {
      readyToConvert++;
      const c = newCandidate(req, addDays(opening, 3), 'offer');
      addProcess(c, req);
      const offer = newOffer(c, req, 'accepted', addDays(today, 14 + readyToConvert * 7), addDays(today, 2), addDays(today, -6));
      c.stage = 'hired';
      c.history.push({ at: offer.respondedAt!, type: 'stage', from: 'offer', to: 'hired', by: SYSTEM, note: '', refId: offer.id });
    }
  });
  for (const c of out.candidates) c.history.sort((a, b) => a.at.localeCompare(b.at));
  return out;
}

function data(): Db {
  if (!db) db = generate();
  expireOffers(db);
  return db;
}

/** SYSTEM: sent offers past their expiry date become "expired" (the real backend would run this as a job). */
function expireOffers(d: Db) {
  const today = todayIso();
  for (const o of d.offers) {
    if (o.status !== 'sent' || o.expiryDate >= today) continue;
    const when = nowIso();
    o.status = 'expired';
    o.history.push({ at: when, by: SYSTEM, note: '', from: 'sent', to: 'expired' });
    d.candidates.find((c) => c.id === o.candidateId)?.history.push({ at: when, type: 'offer-expired', from: null, to: null, by: SYSTEM, note: '', refId: o.id });
  }
}

/* Scope ---------------------------------------------------------------------------------------------------- */

interface Access {
  role: RecruitmentScope['role'];
  org: boolean;
  write: boolean;
  me: string | null;
  units: Set<string>;
}

function access(scope: RecruitmentScope): Access {
  const me = meOf(scope);
  if (scope.kind === 'organization') {
    if (!hasPermission(scope.role, 'recruitment.jobs.view')) forbidden();
    return { role: scope.role, org: true, write: hasPermission(scope.role, 'recruitment.jobs.manage'), me, units: new Set() };
  }
  if (!hasPermission(scope.role, 'hr.recruitment.view.team')) forbidden();
  return { role: scope.role, org: false, write: false, me, units: employeeRecords.teamUnits(scope.userId) };
}

function requireWrite(a: Access) {
  if (!a.write) forbidden('recruitment.jobs.manage is required');
}

const reqVisible = (a: Access, q: RequisitionRow) => a.org || a.units.has(q.departmentId) || (a.me !== null && q.hiringManagerId === a.me);
const reqOf = (d: Db, id: string) => d.requisitions.find((q) => q.id === id);
const candVisible = (a: Access, d: Db, c: CandidateRow) => {
  const q = reqOf(d, c.requisitionId);
  return Boolean(q && reqVisible(a, q));
};
const interviewVisible = (a: Access, d: Db, i: InterviewRow) => {
  const c = d.candidates.find((x) => x.id === i.candidateId);
  return Boolean(c && (candVisible(a, d, c) || (a.me !== null && i.interviewerIds.includes(a.me))));
};

function visibleRequisition(a: Access, d: Db, id: string): RequisitionRow {
  const q = reqOf(d, id);
  if (!q) notFound('Requisition', id);
  if (!reqVisible(a, q)) forbidden();
  return q;
}
function visibleCandidate(a: Access, d: Db, id: string): CandidateRow {
  const c = d.candidates.find((x) => x.id === id);
  if (!c) notFound('Candidate', id);
  if (!candVisible(a, d, c)) forbidden();
  return c;
}
function visibleInterview(a: Access, d: Db, id: string): InterviewRow {
  const i = d.interviews.find((x) => x.id === id);
  if (!i) notFound('Interview', id);
  if (!interviewVisible(a, d, i)) forbidden();
  return i;
}
function offersAllowed(a: Access) {
  // Offers contain salaries: organization readers only.
  if (!a.org) forbidden('Offers are not available in team scope');
}

/* Mapping -------------------------------------------------------------------------------------------------- */

const reqRef = (q: RequisitionRow): RequisitionRef => ({ id: q.id, number: q.number, title: q.title });
const candSummary = (c: CandidateRow): CandidateSummary => ({ id: c.id, number: c.number, name: c.name, email: c.email });
const hiresOf = (d: Db, requisitionId: string) => d.offers.filter((o) => o.requisitionId === requisitionId && o.status === 'accepted').length;
const activeOfferOf = (d: Db, candidateId: string) => d.offers.find((o) => o.candidateId === candidateId && (o.status === 'draft' || o.status === 'sent'));
const acceptedOfferOf = (d: Db, candidateId: string) => d.offers.find((o) => o.candidateId === candidateId && o.status === 'accepted');

function toRequisition(d: Db, a: Access, q: RequisitionRow): Requisition {
  const mine = d.candidates.filter((c) => c.requisitionId === q.id && !c.archived);
  return {
    id: q.id,
    number: q.number,
    title: q.title,
    department: deptRef(q.departmentId),
    position: posRef(q.positionId),
    location: locRef(q.locationId),
    employmentType: q.employmentType,
    vacancies: q.vacancies,
    hiringManager: personRef(q.hiringManagerId),
    recruiter: personRef(q.recruiterId),
    description: q.description,
    skills: q.skills,
    minExperienceYears: q.minExperienceYears,
    education: q.education,
    salaryRange: a.org ? q.salaryRange : null,
    openingDate: q.openingDate,
    closingDate: q.closingDate,
    status: q.status,
    createdAt: q.createdAt,
    history: q.history,
    counts: { candidates: mine.length, active: mine.filter((c) => ACTIVE_STAGES.includes(c.stage)).length, hired: hiresOf(d, q.id) },
    nextStatuses: a.write ? [...REQUISITION_TRANSITIONS[q.status]] : [],
    can: { edit: a.write && !['closed', 'cancelled'].includes(q.status) },
  };
}

function toCandidate(d: Db, a: Access, c: CandidateRow): Candidate {
  const q = reqOf(d, c.requisitionId)!;
  const canConvert = a.write && c.stage === 'hired' && !c.employeeId && Boolean(acceptedOfferOf(d, c.id));
  return {
    id: c.id,
    number: c.number,
    name: c.name,
    email: c.email,
    phone: c.phone,
    location: c.location,
    currentTitle: c.currentTitle,
    currentCompany: c.currentCompany,
    experienceYears: c.experienceYears,
    education: c.education,
    skills: c.skills,
    languages: c.languages,
    linkedinUrl: c.linkedinUrl,
    portfolioUrl: c.portfolioUrl,
    requisition: reqRef(q),
    appliedAt: c.appliedAt,
    source: c.source,
    recruiter: personRef(c.recruiterId),
    stage: c.stage,
    expectedSalary: a.org ? c.expectedSalary : null,
    notes: a.org ? c.notes : '',
    archived: c.archived,
    archivedAt: c.archivedAt,
    employeeId: c.employeeId,
    createdAt: c.createdAt,
    nextStages: a.write && !c.archived ? STAGE_TRANSITIONS[c.stage].filter((s) => s !== 'rejected' || !activeOfferOf(d, c.id)) : [],
    can: {
      edit: a.write && !c.archived,
      archive: a.write && !c.archived && !hasOpenProcess(d, c),
      reopen: a.write && !c.archived && c.stage === 'rejected',
      schedule: a.write && !c.archived && INTERVIEW_STAGES.includes(c.stage),
      offer: a.org && a.write && !c.archived && OFFER_STAGES.includes(c.stage) && !activeOfferOf(d, c.id),
      convert: canConvert && hasPermission(a.role, 'organization.employees.manage'),
    },
  };
}

const hasOpenProcess = (d: Db, c: CandidateRow) =>
  Boolean(activeOfferOf(d, c.id)) || d.interviews.some((i) => i.candidateId === c.id && i.status === 'scheduled');

function toInterview(d: Db, a: Access, i: InterviewRow): Interview {
  const c = d.candidates.find((x) => x.id === i.candidateId)!;
  const q = reqOf(d, c.requisitionId)!;
  const started = toMs(i.start) <= Date.now();
  const readable = i.feedback.filter((f) => a.write || f.interviewerId === a.me);
  const submitted = new Set(i.feedback.map((f) => f.interviewerId));
  const pending = i.interviewerIds.filter((id) => !submitted.has(id));
  const feedbackOpen = (i.status === 'completed' || (i.status === 'scheduled' && started)) && !c.archived;
  return {
    id: i.id,
    candidate: candSummary(c),
    requisition: reqRef(q),
    type: i.type,
    status: i.status,
    start: i.start,
    durationMinutes: i.durationMinutes,
    interviewers: i.interviewerIds.map((id) => personRef(id) ?? { id, name: { en: id, ar: id } }),
    location: i.location,
    meetingLink: i.meetingLink,
    notes: a.org ? i.notes : '',
    cancelReason: i.cancelReason,
    createdAt: i.createdAt,
    feedback: readable.map(({ interviewerId, ...f }) => ({ ...f, interviewer: personRef(interviewerId) ?? { id: interviewerId, name: { en: interviewerId, ar: interviewerId } } })),
    feedbackCount: i.feedback.length,
    pendingFeedbackFrom: pending,
    can: {
      edit: a.write && i.status === 'scheduled' && !started,
      cancel: a.write && i.status === 'scheduled',
      complete: a.write && i.status === 'scheduled' && started,
      feedbackFor: feedbackOpen ? pending.filter((id) => a.write || id === a.me) : [],
    },
  };
}

function toOffer(d: Db, a: Access, o: OfferRow): Offer {
  const c = d.candidates.find((x) => x.id === o.candidateId)!;
  return {
    id: o.id,
    number: o.number,
    candidate: candSummary(c),
    requisition: reqRef(reqOf(d, o.requisitionId)!),
    position: posRef(o.positionId),
    department: deptRef(o.departmentId),
    location: locRef(o.locationId),
    salary: o.salary,
    currency: o.currency,
    employmentType: o.employmentType,
    startDate: o.startDate,
    expiryDate: o.expiryDate,
    benefits: o.benefits,
    status: o.status,
    createdAt: o.createdAt,
    sentAt: o.sentAt,
    respondedAt: o.respondedAt,
    history: o.history,
    nextStatuses: a.write ? [...OFFER_TRANSITIONS[o.status]] : [],
    can: { edit: a.write && o.status === 'draft' },
  };
}

function begin(scope: RecruitmentScope) {
  const d = data();
  return { d, a: access(scope) };
}

/* Requisitions ---------------------------------------------------------------------------------------------- */

export function listRequisitions(params: ListParams<RequisitionFilters>, scope: RecruitmentScope): Paginated<Requisition> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const units = f.departmentId ? new Set([f.departmentId, ...orgTables.descendants(f.departmentId)]) : null;
  const rows = d.requisitions
    .filter((q) => reqVisible(a, q) && (!f.status || q.status === f.status) && (!units || units.has(q.departmentId)) && (!f.locationId || q.locationId === f.locationId) && (!f.employmentType || q.employmentType === f.employmentType))
    .sort((x, y) => y.number.localeCompare(x.number))
    .map((q) => ({ ...toRequisition(d, a, q), 'title.en': q.title.en, 'title.ar': q.title.ar }));
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['number', 'title.en', 'title.ar'] });
  return { ...page, items: page.items.map(({ 'title.en': _e, 'title.ar': _a, ...q }) => q) };
}

export function getRequisition(id: string, scope: RecruitmentScope): Requisition {
  const { d, a } = begin(scope);
  return toRequisition(d, a, visibleRequisition(a, d, id));
}

function checkRequisition(input: RequisitionInput, current?: RequisitionRow): RequisitionInput {
  const format = validateRequisitionInput(input);
  if (format) invalid(format);
  const errors: FieldErrors = {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  const dep = department(input.departmentId);
  if (!dep) add('departmentId', 'notFound');
  else if (dep.status !== 'active' && dep.id !== current?.departmentId) add('departmentId', 'inactive');
  const pos = position(input.positionId);
  if (!pos) add('positionId', 'notFound');
  else if (pos.departmentId !== input.departmentId) add('positionId', 'positionDepartment');
  else if (pos.status !== 'active' && pos.id !== current?.positionId) add('positionId', 'inactive');
  const loc = location(input.locationId);
  if (!loc) add('locationId', 'notFound');
  else if (loc.status !== 'active' && loc.id !== current?.locationId) add('locationId', 'inactive');
  if (input.hiringManagerId && !isActiveEmployee(input.hiringManagerId)) add('hiringManagerId', 'inactiveEmployee');
  if (input.recruiterId && !isActiveEmployee(input.recruiterId)) add('recruiterId', 'inactiveEmployee');
  if (current && input.vacancies < hiresOf(data(), current.id)) add('vacancies', 'belowHired');
  if (Object.keys(errors).length) invalid(errors);
  return { ...input, title: { en: input.title.en.trim(), ar: input.title.ar.trim() }, description: input.description.trim() };
}

export function createRequisition(input: RequisitionInput, scope: RecruitmentScope): Requisition {
  const { d, a } = begin(scope);
  requireWrite(a);
  const v = checkRequisition(input);
  d.seq.req++;
  const createdAt = nowIso();
  const row: RequisitionRow = { ...v, id: `req-${pad(d.seq.req, 3)}`, number: `REQ-${todayIso().slice(0, 4)}-${pad(d.seq.req, 3)}`, status: 'draft', createdAt, history: [{ at: createdAt, by: actor(scope), note: '', from: null, to: 'draft' }] };
  d.requisitions.push(row);
  return toRequisition(d, a, row);
}

export function updateRequisition(id: string, input: RequisitionInput, scope: RecruitmentScope): Requisition {
  const { d, a } = begin(scope);
  requireWrite(a);
  const q = visibleRequisition(a, d, id);
  if (q.status === 'closed' || q.status === 'cancelled') conflict(`Requisition ${q.number} is ${q.status}`);
  Object.assign(q, checkRequisition(input, q));
  return toRequisition(d, a, q);
}

export function updateRequisitionStatus(id: string, status: RequisitionStatus, note: string, scope: RecruitmentScope): Requisition {
  const { d, a } = begin(scope);
  requireWrite(a);
  const q = visibleRequisition(a, d, id);
  if (!REQUISITION_TRANSITIONS[q.status].includes(status)) conflict(`Requisition ${q.number} cannot go from ${q.status} to ${status}`);
  if (status === 'open' && q.closingDate && q.closingDate < todayIso()) invalid({ closingDate: ['closingPast'] });
  if (status === 'cancelled' && hiresOf(d, q.id) > 0) invalid({ status: ['hasHires'] });
  if (status === 'open' && q.status === 'closed' && hiresOf(d, q.id) >= q.vacancies) invalid({ vacancies: ['filled'] });
  q.history.push({ at: nowIso(), by: actor(scope), note: note.trim(), from: q.status, to: status });
  q.status = status;
  return toRequisition(d, a, q);
}

/* Candidates ------------------------------------------------------------------------------------------------ */

export function listCandidates(params: ListParams<CandidateFilters>, scope: RecruitmentScope): Paginated<Candidate> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const rows = d.candidates
    .filter(
      (c) =>
        candVisible(a, d, c) &&
        (f.archived === 'true' ? c.archived : !c.archived) &&
        (!f.stage || c.stage === f.stage) &&
        (!f.requisitionId || c.requisitionId === f.requisitionId) &&
        (!f.source || c.source === f.source) &&
        (!f.experience || experienceBand(c.experienceYears) === f.experience) &&
        (!f.recruiterId || c.recruiterId === f.recruiterId),
    )
    .sort((x, y) => y.appliedAt.localeCompare(x.appliedAt) || y.number.localeCompare(x.number))
    .map((c) => ({ ...toCandidate(d, a, c), 'name.en': `${c.name.first.en} ${c.name.last.en}`, 'name.ar': fullName(c.name).ar, stageOrder: CANDIDATE_STAGES.indexOf(c.stage) }));
  const sortBy = params.sortBy === 'stage' ? 'stageOrder' : params.sortBy;
  const page = queryCollection(rows, { ...params, sortBy, filters: {} }, { searchFields: ['number', 'email', 'name.en', 'name.ar'] });
  return { ...page, items: page.items.map(({ 'name.en': _e, 'name.ar': _a, stageOrder: _s, ...c }) => c) };
}

export function getCandidate(id: string, scope: RecruitmentScope): Candidate {
  const { d, a } = begin(scope);
  return toCandidate(d, a, visibleCandidate(a, d, id));
}

export function candidateHistory(id: string, scope: RecruitmentScope): CandidateEvent[] {
  const { d, a } = begin(scope);
  const c = visibleCandidate(a, d, id);
  // Team scope: no offer events (salary context) and no feedback notes.
  const events = a.org ? c.history : c.history.filter((h) => !h.type.startsWith('offer-')).map((h) => (h.type === 'feedback' ? { ...h, note: '' } : h));
  // Newest first; events recorded in the same instant keep their recorded order (reversed).
  return events.map((e, i) => ({ e, i })).sort((x, y) => y.e.at.localeCompare(x.e.at) || y.i - x.i).map((x) => x.e);
}

function checkCandidate(d: Db, input: CandidateInput, current?: CandidateRow): CandidateInput {
  const format = validateCandidateInput(input);
  if (format) invalid(format);
  const errors: FieldErrors = {};
  const email = input.email.trim().toLowerCase();
  // One active application per e-mail address (archived records do not count).
  if (d.candidates.some((c) => c.id !== current?.id && !c.archived && c.email.toLowerCase() === email)) errors.email = ['duplicateEmail'];
  const q = reqOf(d, input.requisitionId);
  if (!q) errors.requisitionId = ['notFound'];
  else if (current && current.requisitionId !== q.id && !['new', 'screening'].includes(current.stage)) errors.requisitionId = ['requisitionLocked'];
  else if ((!current || current.requisitionId !== q.id) && q.status !== 'open') errors.requisitionId = ['requisitionNotOpen'];
  if (input.appliedAt > todayIso()) errors.appliedAt = ['futureDate'];
  if (input.recruiterId && !isActiveEmployee(input.recruiterId)) errors.recruiterId = ['inactiveEmployee'];
  if (Object.keys(errors).length) invalid(errors);
  const trim = (s: string) => s.trim();
  return {
    ...input,
    email,
    name: { first: { en: trim(input.name.first.en), ar: trim(input.name.first.ar) }, last: { en: trim(input.name.last.en), ar: trim(input.name.last.ar) } },
    phone: trim(input.phone),
    notes: trim(input.notes),
  };
}

export function createCandidate(input: CandidateInput, scope: RecruitmentScope): Candidate {
  const { d, a } = begin(scope);
  requireWrite(a);
  const v = checkCandidate(d, input);
  d.seq.can++;
  const createdAt = nowIso();
  const row: CandidateRow = {
    ...v,
    id: `can-${pad(d.seq.can, 4)}`,
    number: `CAN-${pad(d.seq.can, 4)}`,
    stage: 'new',
    archived: false,
    archivedAt: null,
    employeeId: null,
    createdAt,
    history: [{ at: createdAt, type: 'applied', from: null, to: 'new', by: actor(scope), note: '', refId: null }],
  };
  d.candidates.push(row);
  return toCandidate(d, a, row);
}

export function updateCandidate(id: string, input: CandidateInput, scope: RecruitmentScope): Candidate {
  const { d, a } = begin(scope);
  requireWrite(a);
  const c = visibleCandidate(a, d, id);
  if (c.archived) conflict(`Candidate ${c.number} is archived`);
  Object.assign(c, checkCandidate(d, input, c));
  return toCandidate(d, a, c);
}

/** Cancels the candidate's scheduled interviews (rejection / archive). */
function cancelScheduled(d: Db, c: CandidateRow, reason: string, by: Localized<string>) {
  for (const i of d.interviews.filter((x) => x.candidateId === c.id && x.status === 'scheduled')) {
    i.status = 'cancelled';
    i.cancelReason = reason;
    c.history.push({ at: nowIso(), type: 'interview-cancelled', from: null, to: null, by, note: reason, refId: i.id });
  }
}

export function updateCandidateStage(id: string, stage: CandidateStage, note: string, scope: RecruitmentScope): Candidate {
  const { d, a } = begin(scope);
  requireWrite(a);
  const c = visibleCandidate(a, d, id);
  if (c.archived) conflict(`Candidate ${c.number} is archived`);
  if (stage === 'hired') invalid({ stage: ['hiredViaOffer'] });
  if (!canMoveStage(c.stage, stage)) invalid({ stage: [c.stage === 'hired' || c.stage === 'rejected' ? 'finalStage' : 'invalidTransition'] });
  if (stage === 'rejected' && activeOfferOf(d, c.id)) invalid({ stage: ['activeOffer'] });
  const by = actor(scope);
  if (stage === 'rejected') cancelScheduled(d, c, 'Candidate rejected.', by);
  c.history.push({ at: nowIso(), type: 'stage', from: c.stage, to: stage, by, note: note.trim(), refId: null });
  c.stage = stage;
  return toCandidate(d, a, c);
}

/** Explicit reopening of a rejected candidate: back to the stage they were rejected from. */
export function reopenCandidate(id: string, note: string, scope: RecruitmentScope): Candidate {
  const { d, a } = begin(scope);
  requireWrite(a);
  const c = visibleCandidate(a, d, id);
  if (c.archived) conflict(`Candidate ${c.number} is archived`);
  if (c.stage !== 'rejected') invalid({ stage: ['notRejected'] });
  const q = reqOf(d, c.requisitionId)!;
  if (q.status !== 'open' && q.status !== 'on-hold') invalid({ stage: ['requisitionNotOpen'] });
  const back = c.history.filter((h) => h.to === 'rejected').at(-1)?.from ?? 'screening';
  c.history.push({ at: nowIso(), type: 'reopened', from: 'rejected', to: back, by: actor(scope), note: note.trim(), refId: null });
  c.stage = back;
  return toCandidate(d, a, c);
}

export function archiveCandidate(id: string, scope: RecruitmentScope): Candidate {
  const { d, a } = begin(scope);
  requireWrite(a);
  const c = visibleCandidate(a, d, id);
  if (c.archived) conflict(`Candidate ${c.number} is already archived`);
  if (hasOpenProcess(d, c)) invalid({ archive: ['openProcess'] });
  const when = nowIso();
  c.archived = true;
  c.archivedAt = when;
  c.history.push({ at: when, type: 'archived', from: null, to: null, by: actor(scope), note: '', refId: null });
  return toCandidate(d, a, c);
}

/* Interviews ------------------------------------------------------------------------------------------------ */

export function listInterviews(params: ListParams<InterviewFilters>, scope: RecruitmentScope): Paginated<Interview> {
  const { d, a } = begin(scope);
  const f = params.filters ?? {};
  const rows = d.interviews
    .filter((i) => {
      if (!interviewVisible(a, d, i)) return false;
      const c = d.candidates.find((x) => x.id === i.candidateId)!;
      return (
        (!f.status || i.status === f.status) &&
        (!f.type || i.type === f.type) &&
        (!f.candidateId || i.candidateId === f.candidateId) &&
        (!f.requisitionId || c.requisitionId === f.requisitionId) &&
        (!f.from || i.start.slice(0, 10) >= f.from) &&
        (!f.to || i.start.slice(0, 10) <= f.to)
      );
    })
    .sort((x, y) => y.start.localeCompare(x.start))
    .map((i) => {
      const view = toInterview(d, a, i);
      return { ...view, search: `${view.candidate.number} ${view.candidate.name.first.en} ${view.candidate.name.last.en} ${fullName(view.candidate.name).ar} ${view.requisition.number}` };
    });
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['search'] });
  return { ...page, items: page.items.map(({ search: _s, ...i }) => i) };
}

export function getInterview(id: string, scope: RecruitmentScope): Interview {
  const { d, a } = begin(scope);
  return toInterview(d, a, visibleInterview(a, d, id));
}

const overlapsSlot = (x: InterviewRow, start: string, minutes: number) => {
  const s = toMs(start);
  const e = s + minutes * 60_000;
  const xs = toMs(x.start);
  return xs < e && s < xs + x.durationMinutes * 60_000;
};

function checkInterview(d: Db, input: InterviewInput, current?: InterviewRow) {
  const format = validateInterviewInput(input);
  if (format) invalid(format);
  const errors: FieldErrors = {};
  if (toMs(input.start) <= Date.now()) errors.start = ['pastStart'];
  for (const id of input.interviewerIds) if (!isActiveEmployee(id)) errors.interviewerIds = ['inactiveEmployee'];
  const others = d.interviews.filter((i) => i.id !== current?.id && i.status === 'scheduled' && overlapsSlot(i, input.start, input.durationMinutes));
  if (!errors.interviewerIds && others.some((i) => i.interviewerIds.some((id) => input.interviewerIds.includes(id)))) errors.interviewerIds = ['interviewerBusy'];
  if (!errors.start && others.some((i) => i.candidateId === input.candidateId)) errors.start = ['candidateBusy'];
  if (Object.keys(errors).length) invalid(errors);
}

export function createInterview(input: InterviewInput, scope: RecruitmentScope): Interview {
  const { d, a } = begin(scope);
  requireWrite(a);
  const c = visibleCandidate(a, d, input.candidateId);
  if (c.archived) invalid({ candidateId: ['archived'] });
  if (!INTERVIEW_STAGES.includes(c.stage)) invalid({ candidateId: ['stageNotInterview'] });
  checkInterview(d, input);
  d.seq.int++;
  const by = actor(scope);
  const row: InterviewRow = {
    id: `int-${pad(d.seq.int, 4)}`,
    candidateId: c.id,
    type: input.type,
    status: 'scheduled',
    start: input.start,
    durationMinutes: input.durationMinutes,
    interviewerIds: [...new Set(input.interviewerIds)],
    location: input.location.trim(),
    meetingLink: input.meetingLink.trim(),
    notes: input.notes.trim(),
    cancelReason: null,
    createdAt: nowIso(),
    feedback: [],
  };
  d.interviews.push(row);
  if (c.stage === 'shortlisted') {
    c.history.push({ at: row.createdAt, type: 'stage', from: 'shortlisted', to: 'interview', by, note: '', refId: row.id });
    c.stage = 'interview';
  }
  c.history.push({ at: row.createdAt, type: 'interview-scheduled', from: null, to: null, by, note: '', refId: row.id });
  return toInterview(d, a, row);
}

export function updateInterview(id: string, input: InterviewInput, scope: RecruitmentScope): Interview {
  const { d, a } = begin(scope);
  requireWrite(a);
  const i = visibleInterview(a, d, id);
  if (i.status !== 'scheduled') conflict(`Interview ${id} is ${i.status}`);
  if (input.candidateId !== i.candidateId) invalid({ candidateId: ['candidateLocked'] });
  checkInterview(d, input, i);
  Object.assign(i, { type: input.type, start: input.start, durationMinutes: input.durationMinutes, interviewerIds: [...new Set(input.interviewerIds)], location: input.location.trim(), meetingLink: input.meetingLink.trim(), notes: input.notes.trim() });
  d.candidates.find((c) => c.id === i.candidateId)!.history.push({ at: nowIso(), type: 'interview-updated', from: null, to: null, by: actor(scope), note: '', refId: i.id });
  return toInterview(d, a, i);
}

export function cancelInterview(id: string, reason: string, scope: RecruitmentScope): Interview {
  const { d, a } = begin(scope);
  requireWrite(a);
  const i = visibleInterview(a, d, id);
  const errors = validateReason(reason);
  if (i.status !== 'scheduled') conflict(`Interview ${id} is ${i.status}`);
  if (errors) invalid(errors);
  i.status = 'cancelled';
  i.cancelReason = reason.trim();
  d.candidates.find((c) => c.id === i.candidateId)!.history.push({ at: nowIso(), type: 'interview-cancelled', from: null, to: null, by: actor(scope), note: i.cancelReason, refId: i.id });
  return toInterview(d, a, i);
}

/** Marks a scheduled interview that has started as completed or no-show. */
export function updateInterviewStatus(id: string, status: 'completed' | 'no-show', scope: RecruitmentScope): Interview {
  const { d, a } = begin(scope);
  requireWrite(a);
  const i = visibleInterview(a, d, id);
  if (i.status !== 'scheduled') conflict(`Interview ${id} is ${i.status}`);
  if (toMs(i.start) > Date.now()) invalid({ status: ['notStarted'] });
  i.status = status;
  d.candidates.find((c) => c.id === i.candidateId)!.history.push({ at: nowIso(), type: status === 'completed' ? 'interview-completed' : 'interview-no-show', from: null, to: null, by: actor(scope), note: '', refId: i.id });
  return toInterview(d, a, i);
}

/**
 * Feedback by an interviewer of this interview: recruitment writers may record it for any assigned interviewer;
 * a team-scoped user only for themselves. One submission per interviewer; final once submitted.
 */
export function submitInterviewFeedback(id: string, input: FeedbackInput, scope: RecruitmentScope): Interview {
  const { d, a } = begin(scope);
  const i = visibleInterview(a, d, id);
  if (!a.write && input.interviewerId !== a.me) forbidden('Only the interviewer can submit this feedback');
  if (!i.interviewerIds.includes(input.interviewerId)) invalid({ interviewerId: ['notInterviewer'] });
  if (i.status === 'cancelled' || i.status === 'no-show') conflict(`Interview ${id} is ${i.status}`);
  if (toMs(i.start) > Date.now()) invalid({ interviewerId: ['notStarted'] });
  if (i.feedback.some((f) => f.interviewerId === input.interviewerId)) conflict('Feedback already submitted');
  const errors = validateFeedbackInput(input);
  if (errors) invalid(errors);
  const c = d.candidates.find((x) => x.id === i.candidateId)!;
  if (c.archived) conflict(`Candidate ${c.number} is archived`);
  const by = actor(scope);
  const when = nowIso();
  if (i.status === 'scheduled') {
    i.status = 'completed';
    c.history.push({ at: when, type: 'interview-completed', from: null, to: null, by: SYSTEM, note: '', refId: i.id });
  }
  i.feedback.push({ ...input, strengths: input.strengths.trim(), improvements: input.improvements.trim(), submittedAt: when, submittedBy: by });
  c.history.push({ at: when, type: 'feedback', from: null, to: null, by: personRef(input.interviewerId)?.name ?? by, note: input.recommendation, refId: i.id });
  return toInterview(d, a, i);
}

/* Offers ----------------------------------------------------------------------------------------------------- */

export function listOffers(params: ListParams<OfferFilters>, scope: RecruitmentScope): Paginated<Offer> {
  const { d, a } = begin(scope);
  offersAllowed(a);
  const f = params.filters ?? {};
  const rows = d.offers
    .filter((o) => (!f.status || o.status === f.status) && (!f.requisitionId || o.requisitionId === f.requisitionId) && (!f.candidateId || o.candidateId === f.candidateId))
    .sort((x, y) => y.number.localeCompare(x.number))
    .map((o) => {
      const view = toOffer(d, a, o);
      return { ...view, search: `${o.number} ${view.candidate.number} ${view.candidate.name.first.en} ${view.candidate.name.last.en} ${fullName(view.candidate.name).ar}` };
    });
  const page = queryCollection(rows, { ...params, filters: {} }, { searchFields: ['search'] });
  return { ...page, items: page.items.map(({ search: _s, ...o }) => o) };
}

export function getOffer(id: string, scope: RecruitmentScope): Offer {
  const { d, a } = begin(scope);
  offersAllowed(a);
  const o = d.offers.find((x) => x.id === id);
  if (!o) notFound('Offer', id);
  return toOffer(d, a, o);
}

function checkOffer(d: Db, input: OfferInput, c: CandidateRow, current?: OfferRow) {
  const format = validateOfferInput(input);
  if (format) invalid(format);
  const errors: FieldErrors = {};
  const add = (field: string, reason: string) => (errors[field] = [...(errors[field] ?? []), reason]);
  const q = reqOf(d, c.requisitionId)!;
  if (q.status !== 'open') add('candidateId', 'requisitionNotOpen');
  else if (hiresOf(d, q.id) >= q.vacancies) add('candidateId', 'noVacancy');
  const pos = position(input.positionId);
  if (!department(input.departmentId) || department(input.departmentId)!.status !== 'active') add('departmentId', 'inactive');
  if (!pos || pos.status !== 'active') add('positionId', 'inactive');
  else if (pos.departmentId !== input.departmentId) add('positionId', 'positionDepartment');
  if (!location(input.locationId) || location(input.locationId)!.status !== 'active') add('locationId', 'inactive');
  if (q.salaryRange && q.salaryRange.currency === input.currency && (input.salary < q.salaryRange.min || input.salary > q.salaryRange.max)) add('salary', 'outsideRange');
  const today = todayIso();
  if (input.startDate <= today) add('startDate', 'startPast');
  if (input.expiryDate < today) add('expiryDate', 'expiryPast');
  if (!current && activeOfferOf(d, c.id)) add('candidateId', 'activeOffer');
  if (Object.keys(errors).length) invalid(errors);
}

export function createOffer(input: OfferInput, scope: RecruitmentScope): Offer {
  const { d, a } = begin(scope);
  offersAllowed(a);
  requireWrite(a);
  const c = visibleCandidate(a, d, input.candidateId);
  if (c.archived) invalid({ candidateId: ['archived'] });
  if (!OFFER_STAGES.includes(c.stage)) invalid({ candidateId: ['stageNotOffer'] });
  checkOffer(d, input, c);
  d.seq.off++;
  const by = actor(scope);
  const createdAt = nowIso();
  const row: OfferRow = {
    id: `off-${pad(d.seq.off, 3)}`,
    number: `OFF-${todayIso().slice(0, 4)}-${pad(d.seq.off, 3)}`,
    candidateId: c.id,
    requisitionId: c.requisitionId,
    positionId: input.positionId,
    departmentId: input.departmentId,
    locationId: input.locationId,
    salary: input.salary,
    currency: input.currency,
    employmentType: input.employmentType,
    startDate: input.startDate,
    expiryDate: input.expiryDate,
    benefits: input.benefits.trim(),
    status: 'draft',
    createdAt,
    sentAt: null,
    respondedAt: null,
    history: [{ at: createdAt, by, note: '', from: null, to: 'draft' }],
  };
  d.offers.push(row);
  if (c.stage !== 'offer') {
    c.history.push({ at: createdAt, type: 'stage', from: c.stage, to: 'offer', by, note: '', refId: row.id });
    c.stage = 'offer';
  }
  c.history.push({ at: createdAt, type: 'offer-created', from: null, to: null, by, note: '', refId: row.id });
  return toOffer(d, a, row);
}

export function updateOffer(id: string, input: OfferInput, scope: RecruitmentScope): Offer {
  const { d, a } = begin(scope);
  offersAllowed(a);
  requireWrite(a);
  const o = d.offers.find((x) => x.id === id);
  if (!o) notFound('Offer', id);
  if (o.status !== 'draft') conflict(`Offer ${o.number} is ${o.status}; only drafts can be edited`);
  if (input.candidateId !== o.candidateId) invalid({ candidateId: ['candidateLocked'] });
  checkOffer(d, input, d.candidates.find((c) => c.id === o.candidateId)!, o);
  Object.assign(o, { positionId: input.positionId, departmentId: input.departmentId, locationId: input.locationId, salary: input.salary, currency: input.currency, employmentType: input.employmentType, startDate: input.startDate, expiryDate: input.expiryDate, benefits: input.benefits.trim() });
  return toOffer(d, a, o);
}

/**
 * Offer workflow (SIMULATED — nothing is e-mailed): send, record the candidate's answer (accept / reject) or withdraw.
 * Accepting makes the candidate "hired" and closes the requisition once all vacancies are filled.
 */
export function updateOfferStatus(id: string, status: OfferStatus, note: string, scope: RecruitmentScope): Offer {
  const { d, a } = begin(scope);
  offersAllowed(a);
  requireWrite(a);
  const o = d.offers.find((x) => x.id === id);
  if (!o) notFound('Offer', id);
  if (!OFFER_TRANSITIONS[o.status].includes(status)) conflict(`Offer ${o.number} cannot go from ${o.status} to ${status}`);
  const c = d.candidates.find((x) => x.id === o.candidateId)!;
  const q = reqOf(d, o.requisitionId)!;
  const today = todayIso();
  if (status === 'sent' && o.expiryDate < today) invalid({ expiryDate: ['expiryPast'] });
  if (status === 'accepted' && hiresOf(d, q.id) >= q.vacancies) invalid({ status: ['noVacancy'] });
  if (status === 'accepted' && c.archived) invalid({ status: ['archived'] });
  const by = actor(scope);
  const when = nowIso();
  o.history.push({ at: when, by, note: note.trim(), from: o.status, to: status });
  o.status = status;
  if (status === 'sent') o.sentAt = when;
  if (status === 'accepted' || status === 'rejected') o.respondedAt = when;
  const type: Record<string, CandidateEventType> = { sent: 'offer-sent', accepted: 'offer-accepted', rejected: 'offer-rejected', withdrawn: 'offer-withdrawn' };
  c.history.push({ at: when, type: type[status]!, from: null, to: null, by, note: note.trim(), refId: o.id });
  if (status === 'accepted') {
    c.history.push({ at: when, type: 'stage', from: c.stage, to: 'hired', by: SYSTEM, note: '', refId: o.id });
    c.stage = 'hired';
    if (hiresOf(d, q.id) >= q.vacancies && (q.status === 'open' || q.status === 'on-hold')) {
      q.history.push({ at: when, by: SYSTEM, note: 'All vacancies filled.', from: q.status, to: 'closed' });
      q.status = 'closed';
    }
  }
  return toOffer(d, a, o);
}

/* Overview --------------------------------------------------------------------------------------------------- */

export function summary(scope: RecruitmentScope): RecruitmentSummary {
  const { d, a } = begin(scope);
  const reqs = d.requisitions.filter((q) => reqVisible(a, q));
  const reqIds = new Set(reqs.map((q) => q.id));
  const all = d.candidates.filter((c) => reqIds.has(c.requisitionId));
  const current = all.filter((c) => !c.archived);
  const byStage = Object.fromEntries(CANDIDATE_STAGES.map((s) => [s, 0])) as Record<CandidateStage, number>;
  for (const c of current) byStage[c.stage]++;
  const open = reqs.filter((q) => q.status === 'open');
  const offers = d.offers.filter((o) => reqIds.has(o.requisitionId));
  const interviews = d.interviews.filter((i) => all.some((c) => c.id === i.candidateId));
  const today = todayIso();
  const months = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(`${today.slice(0, 7)}-01T00:00`);
    dt.setMonth(dt.getMonth() - (5 - i));
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  });
  const local = (iso: string) => {
    const dt = new Date(iso);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthly = months.map((month) => ({
    month,
    applications: all.filter((c) => c.appliedAt.startsWith(month)).length,
    interviews: interviews.filter((i) => i.status === 'completed' && i.start.startsWith(month)).length,
    offers: offers.filter((o) => o.sentAt && local(o.sentAt) === month).length,
    hires: offers.filter((o) => o.status === 'accepted' && o.respondedAt && local(o.respondedAt) === month).length,
  }));
  const byRequisition = reqs
    .map((q) => {
      const mine = current.filter((c) => c.requisitionId === q.id);
      return { requisition: reqRef(q), total: mine.length, active: mine.filter((c) => ACTIVE_STAGES.includes(c.stage)).length, hired: mine.filter((c) => c.stage === 'hired').length };
    })
    .filter((x) => x.total > 0)
    .sort((x, y) => y.total - x.total || x.requisition.number.localeCompare(y.requisition.number))
    .slice(0, 8);
  const reachedCount = Object.fromEntries(FUNNEL_STEPS.map((s) => [s, 0])) as Record<(typeof FUNNEL_STEPS)[number], number>;
  for (const c of all) {
    const stages = c.history.map((h) => h.to).filter((s): s is CandidateStage => Boolean(s) && s !== 'rejected');
    const order = ['new', 'screening', 'shortlisted', 'interview', 'assessment', 'offer', 'hired'];
    const best = stages.reduce<CandidateStage>((m, s) => (order.indexOf(s) > order.indexOf(m) ? s : m), 'new');
    for (const step of funnelStepsReached(best)) reachedCount[step]++;
  }
  const recent: ActivityItem[] = all
    .flatMap((c) =>
      c.history
        .filter((h) => (a.org || !h.type.startsWith('offer-')) && h.type !== 'feedback')
        .map((h) => ({ at: h.at, type: h.type, candidate: candSummary(c), requisition: reqRef(reqOf(d, c.requisitionId)!), to: h.to, by: h.by })),
    )
    .filter((x) => x.at <= nowIso())
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 10);
  return {
    openPositions: open.reduce((s, q) => s + Math.max(0, q.vacancies - hiresOf(d, q.id)), 0),
    openRequisitions: open.length,
    totalCandidates: current.length,
    newCandidates: byStage.new,
    inInterview: byStage.interview,
    pendingOffers: offers.filter((o) => o.status === 'sent').length,
    hired: byStage.hired,
    byStage,
    monthly,
    byRequisition,
    funnel: FUNNEL_STEPS.map((step) => ({ step, count: reachedCount[step] })),
    recent,
  };
}

/* Staff options & conversion --------------------------------------------------------------------------------- */

/** Active employees for hiring manager / recruiter / interviewer fields (recruitment writers only). */
export function staffOptions(search: string, scope: RecruitmentScope): StaffOption[] {
  const { a } = begin(scope);
  requireWrite(a);
  const term = search.trim().toLowerCase();
  return employeeRecords
    .all()
    .filter((e) => e.status === 'active')
    .filter((e) => {
      const n = employeeRecords.fullName(e);
      return !term || n.en.toLowerCase().includes(term) || n.ar.includes(term) || e.employeeNumber.toLowerCase().includes(term);
    })
    .sort((x, y) => employeeRecords.fullName(x).en.localeCompare(employeeRecords.fullName(y).en))
    .slice(0, 20)
    .map((e) => ({ id: e.id, name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId), position: posRef(e.positionId) }));
}

function convertible(scope: RecruitmentScope, candidateId: string) {
  const { d, a } = begin(scope);
  requireWrite(a);
  if (!hasPermission(scope.role, 'organization.employees.manage')) forbidden('organization.employees.manage is required to create employees');
  const c = visibleCandidate(a, d, candidateId);
  if (c.employeeId) conflict(`Candidate ${c.number} is already employee ${c.employeeId}`);
  const offer = acceptedOfferOf(d, c.id);
  if (c.stage !== 'hired' || !offer) invalid({ candidateId: ['notHired'] });
  return { d, a, c, offer };
}

function suggestEmployeeNumber(): string {
  const max = employeeRecords.all().reduce((m, e) => Math.max(m, Number(/(\d+)$/.exec(e.employeeNumber)?.[1] ?? 0)), 0);
  return `EMP-${pad(max + 1, 4)}`;
}

/** Employee values pre-filled from the candidate and the accepted offer; HR completes the rest. */
export function conversionDraft(candidateId: string, scope: RecruitmentScope): ConversionDraft {
  const { d, c, offer } = convertible(scope, candidateId);
  const base = `${slug(c.name.first.en)}.${slug(c.name.last.en)}`;
  const taken = new Set(employeeRecords.all().map((e) => e.workEmail.toLowerCase()));
  let workEmail = `${base}@staff.datahubhr.test`;
  for (let n = 2; taken.has(workEmail); n++) workEmail = `${base}${n}@staff.datahubhr.test`;
  const q = reqOf(d, c.requisitionId)!;
  return {
    candidateId: c.id,
    offerId: offer.id,
    employeeNumber: suggestEmployeeNumber(),
    name: c.name,
    workEmail,
    personalEmail: c.email,
    phone: c.phone,
    hireDate: offer.startDate,
    employmentType: offer.employmentType,
    departmentId: offer.departmentId,
    positionId: offer.positionId,
    locationId: offer.locationId,
    managerId: q.hiringManagerId && isActiveEmployee(q.hiringManagerId) ? q.hiringManagerId : null,
  };
}

/**
 * Converts a hired candidate into an Employee Management record — once. The employee is created by Employee
 * Management's `createEmployee` (its validation and uniqueness rules apply and its field errors are returned as-is);
 * the candidate keeps its recruitment history and is linked to the new employee id.
 */
export function convertCandidateToEmployee(candidateId: string, input: EmployeeInput, scope: RecruitmentScope): Candidate {
  const { d, a, c } = convertible(scope, candidateId);
  const employee = createEmployee(input, { kind: 'organization', role: scope.role });
  c.employeeId = employee.id;
  c.history.push({ at: nowIso(), type: 'converted', from: null, to: null, by: actor(scope), note: employee.employeeNumber, refId: employee.id });
  return toCandidate(d, a, c);
}

/* Used by the documents mock (same simulated backend; documents → recruitment, never the other way) --------------- */

export interface CandidateRecord {
  id: string;
  number: string;
  name: Localized<string>;
  stage: CandidateStage;
  archived: boolean;
  /** Department of the requisition applied for. */
  departmentId: string;
  /** Set once the candidate was converted to an employee. */
  employeeId: string | null;
  /** When the conversion happened (from the candidate's history), if converted. */
  convertedAt: string | null;
  appliedAt: string;
}

export const candidateRecords = {
  /** Every candidate (any stage), with the requisition's department and the employee created from them, if any. */
  all(): CandidateRecord[] {
    const d = data();
    const department = new Map(d.requisitions.map((r) => [r.id, r.departmentId]));
    return d.candidates.map((c) => {
      const conversion = [...c.history].reverse().find((h) => h.type === 'converted');
      return {
        id: c.id,
        number: c.number,
        name: { en: `${c.name.first.en} ${c.name.last.en}`, ar: `${c.name.first.ar} ${c.name.last.ar}` },
        stage: c.stage,
        archived: c.archived,
        departmentId: department.get(c.requisitionId) ?? '',
        employeeId: c.employeeId,
        convertedAt: conversion?.at ?? null,
        appliedAt: c.appliedAt,
      };
    });
  },
};
