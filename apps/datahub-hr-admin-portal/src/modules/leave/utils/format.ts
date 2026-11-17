import type { TFunction } from 'i18next';
import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import type { LeaveStatus } from '@/modules/leave/types/leave';

const parse = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** Local date (`YYYY-MM-DD`) → localized date (Latin digits), e.g. 16 Nov 2026. */
export function formatDay(date: string, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(parse(date));
}

/** ISO timestamp → localized date and time. */
export function formatTimestamp(iso: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}

/** A date range: one date when start = end. */
export const formatRange = (start: string, end: string, language: Locale) => (start === end ? formatDay(start, language) : `${formatDay(start, language)} – ${formatDay(end, language)}`);

/** `YYYY-MM` → "November 2026". */
export const formatMonthKey = (month: string, language: Locale) => formatDay(`${month}-01`, language, { month: 'long', year: 'numeric' });

/** Day counts can be half days (pro-rated allocations): "1 day", "12.5 days", with i18next plurals. */
export const formatDays = (t: TFunction<'leave'>, days: number, language: Locale) => t('units.days', { count: days, value: formatNumber(days, language, { maximumFractionDigits: 1 }) });

/** One colour per status, used by the chips and the calendar (text labels always accompany colour). */
export const STATUS_TONE: Record<LeaveStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  draft: 'default',
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'default',
};

const pad = (n: number) => String(n).padStart(2, '0');
/** Today as a local `YYYY-MM-DD`. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Balance years offered in selectors: next year, this year and last year. */
export const balanceYears = (current: number) => [current + 1, current, current - 1];
