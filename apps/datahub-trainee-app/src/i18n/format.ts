import type { Locale } from './languages';

/*
 * Localized dates and numbers. Arabic keeps Latin digits (0–9), like the other DataHub apps.
 * All dates are shown in the viewer's time zone.
 */

const intlLocale = (locale: Locale): string => (locale === 'ar' ? 'ar-u-nu-latn' : 'en-US');

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

/** `percent` is 0–100 (not a fraction). */
export function formatPercent(percent: number, locale: Locale): string {
  return formatNumber(Math.round(percent), locale) + (locale === 'ar' ? '٪' : '%');
}

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | number | Date | null | undefined, locale: Locale): string {
  const date = value == null ? null : toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined, locale: Locale): string {
  const date = value == null ? null : toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatLongDate(value: string | number | Date, locale: Locale): string {
  const date = toDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat(intlLocale(locale), { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

/** "3 days ago" / "in 2 hours". */
export function formatRelative(value: string | number | Date, locale: Locale, now: number = Date.now()): string {
  const date = toDate(value);
  if (!date) return '—';
  const seconds = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

export function formatFileSize(bytes: number, locale: Locale): string {
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, locale, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(bytes / (1024 * 1024), locale, { maximumFractionDigits: 1 })} MB`;
}

/** `yyyy-MM-dd` for `<input type="date">` (local date). */
export function toDateInputValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `yyyy-MM-ddTHH:mm` for `<input type="datetime-local">` (local time). */
export function toDateTimeInputValue(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
