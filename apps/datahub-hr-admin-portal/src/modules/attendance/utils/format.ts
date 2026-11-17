import type { TFunction } from 'i18next';
import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import type { AttendanceStatus } from '@/modules/attendance/types/attendance';
import { toMs } from './time';

/** `YYYY-MM-DDTHH:mm` → localized 24-hour time (Latin digits), e.g. 08:05. */
export function formatTime(dateTime: string | null, language: Locale): string {
  if (!dateTime) return '';
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(toMs(dateTime)));
}

/** `HH:mm` shift time → localized 24-hour time. */
export const formatClock = (time: string, language: Locale) => formatTime(`2000-01-01T${time}`, language);

/** Local date (`YYYY-MM-DD`) → localized date, e.g. 16 Nov 2026. */
export function formatDay(date: string, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(new Date(toMs(date)));
}

/** `YYYY-MM` → "November 2026". */
export const formatMonthKey = (month: string, language: Locale) => formatDay(`${month}-01`, language, { month: 'long', year: 'numeric' });

/** Minutes → "7h 45m" / "45 min" in the user's language. */
export function formatDuration(t: TFunction<'attendance'>, minutes: number | null): string {
  if (minutes === null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? t('duration.hm', { h, m }) : t('duration.minutes', { m });
}

/** One colour per status, used by chips, the calendar and the charts (text labels always accompany colour). */
export const STATUS_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'default'> = {
  present: 'success',
  late: 'warning',
  absent: 'error',
  'on-leave': 'info',
  'half-day': 'secondary',
  incomplete: 'warning',
  scheduled: 'default',
};
