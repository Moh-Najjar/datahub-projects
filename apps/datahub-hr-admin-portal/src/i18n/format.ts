import { FORMAT_LOCALE, type Locale } from './languages';

/** Number in the user's language, always with Latin digits (0–9). */
export function formatNumber(value: number, language: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(FORMAT_LOCALE[language], options).format(value);
}

/** Date (ISO string or Date) in the user's language, always with Latin digits. */
export function formatDate(value: string | Date, language: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[language], options).format(typeof value === 'string' ? new Date(value) : value);
}
