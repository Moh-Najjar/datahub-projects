import { FORMAT_LOCALE, type Locale } from '@/i18n/languages';
import type { AssignmentState, CompensationStatus, Currency, LineStatus, Minor, RecordState, RunStatus } from '@/modules/payroll/types/payroll';
import { CURRENCY_DIGITS, percentText, toDecimalString } from './money';

/**
 * Money for display: built from the exact decimal STRING of the minor units (no float division), grouped and with the
 * currency's digits, Latin numerals in both languages. The currency code is added by `<Money>` (always LTR).
 */
export function formatAmount(minor: Minor, currency: Currency, language: Locale): string {
  const digits = CURRENCY_DIGITS[currency];
  const format = new Intl.NumberFormat(FORMAT_LOCALE[language], { minimumFractionDigits: digits, maximumFractionDigits: digits });
  // Intl formats decimal strings exactly (no binary rounding).
  return format.format(toDecimalString(minor, currency) as unknown as number);
}

/** "JOD 1,234.500" for plain-text contexts (tooltips, aria labels). */
export const moneyText = (minor: Minor, currency: Currency, language: Locale) => `${currency} ${formatAmount(minor, currency, language)}`;

/** Whole currency units for chart axes, abbreviated for readability only (exact values are in tooltips and tables). */
export function compactAmount(minor: Minor, currency: Currency, language: Locale): string {
  const unit = 10 ** CURRENCY_DIGITS[currency];
  const whole = (minor - (minor % unit)) / unit;
  return new Intl.NumberFormat(FORMAT_LOCALE[language], { notation: 'compact', maximumFractionDigits: 1 }).format(whole);
}

export const formatPercent = (basisPoints: number) => `${percentText(basisPoints)}%`;

export function formatDay(date: string, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(new Date(`${date.slice(0, 10)}T00:00`));
}
export function formatTimestamp(iso: string, language: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}
/** "October 2026" from `YYYY-MM` or a date. */
export function formatPeriod(monthOrDate: string, language: Locale): string {
  // Incomplete input (e.g. while a month is being typed) is shown as typed instead of failing.
  if (!/^\d{4}-(0[1-9]|1[0-2])/.test(monthOrDate)) return monthOrDate;
  const [y, m] = monthOrDate.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}
/** "12:05" (hours:minutes) from minutes. */
export function formatMinutes(minutes: number, language: Locale): string {
  const m = Math.round(minutes);
  return `${new Intl.NumberFormat(FORMAT_LOCALE[language]).format(Math.floor(m / 60))}:${String(m % 60).padStart(2, '0')}`;
}

type Tone = 'success' | 'warning' | 'error' | 'info' | 'primary' | 'secondary' | 'default';
export const RUN_TONE: Record<RunStatus, Tone> = { draft: 'default', calculating: 'info', calculated: 'info', 'pending-approval': 'warning', approved: 'primary', rejected: 'error', paid: 'success', cancelled: 'default' };
export const LINE_TONE: Record<LineStatus, Tone> = { ok: 'success', warning: 'warning', error: 'error' };
export const COMP_TONE: Record<CompensationStatus, Tone> = { active: 'success', scheduled: 'info', missing: 'warning' };
export const STATE_TONE: Record<RecordState | AssignmentState, Tone> = { current: 'success', scheduled: 'info', past: 'default', ended: 'default' };
