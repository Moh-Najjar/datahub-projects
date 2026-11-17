import type { CandidateStage, ExperienceBand, FunnelStep, OfferStatus, RequisitionStatus } from '@/modules/recruitment/types/recruitment';

/*
 * Pure workflow rules (used by the simulated backend and the UI; the real backend implements the same).
 */

/**
 * Manual pipeline moves. `hired` is never a manual move: it happens only when the candidate ACCEPTS an offer, so every
 * hired candidate has an accepted offer. `hired` and `rejected` are final; only an explicit reopen leaves `rejected`.
 */
export const STAGE_TRANSITIONS: Readonly<Record<CandidateStage, readonly CandidateStage[]>> = {
  new: ['screening', 'rejected'],
  screening: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['assessment', 'offer', 'rejected'],
  assessment: ['interview', 'offer', 'rejected'],
  offer: ['rejected'],
  hired: [],
  rejected: [],
};

export const canMoveStage = (from: CandidateStage, to: CandidateStage) => STAGE_TRANSITIONS[from].includes(to);

/** Stages from which interviews may be scheduled (a shortlisted candidate moves to "interview"). */
export const INTERVIEW_STAGES: readonly CandidateStage[] = ['shortlisted', 'interview', 'assessment'];
/** Stages from which an offer may be prepared (the candidate moves to "offer"). */
export const OFFER_STAGES: readonly CandidateStage[] = ['interview', 'assessment', 'offer'];

/** Candidates still in the process. */
export const ACTIVE_STAGES: readonly CandidateStage[] = ['new', 'screening', 'shortlisted', 'interview', 'assessment', 'offer'];

const ORDER: readonly CandidateStage[] = ['new', 'screening', 'shortlisted', 'interview', 'assessment', 'offer', 'hired'];
/** Funnel step reached when a candidate reaches `stage`. */
export function funnelStepsReached(stage: CandidateStage): FunnelStep[] {
  const i = ORDER.indexOf(stage);
  const steps: FunnelStep[] = ['applied'];
  if (i >= ORDER.indexOf('screening')) steps.push('screened');
  if (i >= ORDER.indexOf('interview')) steps.push('interviewed');
  if (i >= ORDER.indexOf('offer')) steps.push('offered');
  if (i >= ORDER.indexOf('hired')) steps.push('hired');
  return steps;
}

export const REQUISITION_TRANSITIONS: Readonly<Record<RequisitionStatus, readonly RequisitionStatus[]>> = {
  draft: ['pending-approval', 'cancelled'],
  'pending-approval': ['open', 'draft', 'cancelled'],
  open: ['on-hold', 'closed', 'cancelled'],
  'on-hold': ['open', 'closed', 'cancelled'],
  // "Reopen": a closed requisition may be opened again; cancelled is final.
  closed: ['open'],
  cancelled: [],
};

/** `expired` is set by the system when a sent offer passes its expiry date, never manually. */
export const OFFER_TRANSITIONS: Readonly<Record<OfferStatus, readonly OfferStatus[]>> = {
  draft: ['sent', 'withdrawn'],
  sent: ['accepted', 'rejected', 'withdrawn'],
  accepted: [],
  rejected: [],
  expired: [],
  withdrawn: [],
};

export function experienceBand(years: number): ExperienceBand {
  if (years <= 2) return '0-2';
  if (years <= 5) return '3-5';
  if (years <= 10) return '6-10';
  return '10+';
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00`).getTime()) && formatDate(new Date(`${v}T00:00`)) === v;
export const isDateTime = (v: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && isDate(v.slice(0, 10)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60;
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const formatDateTime = (d: Date) => `${formatDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
};
export const todayIso = () => formatDate(new Date());
export const nowLocal = () => formatDateTime(new Date());
/** Local date-time → epoch ms. */
export const toMs = (dateTime: string) => new Date(dateTime.length === 10 ? `${dateTime}T00:00` : dateTime).getTime();
