import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import type { CandidateStage, InterviewStatus, OfferStatus, PersonName, RequisitionStatus } from '@/modules/recruitment/types/recruitment';
import { toMs } from './pipeline';

/** Local date (`YYYY-MM-DD`) → localized date (Latin digits). */
export function formatDay(date: string, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(new Date(toMs(date.slice(0, 10))));
}

/** Local date-time (`YYYY-MM-DDTHH:mm`) → localized date and 24-hour time. */
export function formatDateTime(dateTime: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(toMs(dateTime)));
}

/** ISO timestamp → localized date and time. */
export function formatTimestamp(iso: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}

/** Amount with its currency code (code kept LTR by the caller), e.g. "1,250 JOD". */
export const formatMoney = (amount: number, currency: string, language: Locale) => `${formatNumber(amount, language)} ${currency}`;

/** Full name in the UI language (Arabic falls back to the Latin spelling when not given). */
export function personName(name: PersonName, language: Locale): string {
  if (language === 'ar') return `${name.first.ar || name.first.en} ${name.last.ar || name.last.en}`.trim();
  return `${name.first.en} ${name.last.en}`.trim();
}

type Tone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' | 'default';

export const STAGE_TONE: Record<CandidateStage, Tone> = {
  new: 'info',
  screening: 'default',
  shortlisted: 'secondary',
  interview: 'primary',
  assessment: 'primary',
  offer: 'warning',
  hired: 'success',
  rejected: 'error',
};

export const REQUISITION_TONE: Record<RequisitionStatus, Tone> = {
  draft: 'default',
  'pending-approval': 'warning',
  open: 'success',
  'on-hold': 'secondary',
  closed: 'default',
  cancelled: 'error',
};

export const INTERVIEW_TONE: Record<InterviewStatus, Tone> = { scheduled: 'info', completed: 'success', cancelled: 'default', 'no-show': 'error' };

export const OFFER_TONE: Record<OfferStatus, Tone> = { draft: 'default', sent: 'info', accepted: 'success', rejected: 'error', expired: 'warning', withdrawn: 'default' };
