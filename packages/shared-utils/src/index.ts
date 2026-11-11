/**
 * @datahub/shared-utils — platform-independent helpers (no DOM, no React Native, no globals beyond ECMAScript + Intl).
 * Works in browsers, Node and Hermes (React Native), which all ship `Intl`.
 */
import { INTL_LOCALE, LOCALE_DIRECTION } from '@datahub/shared-constants';
import type { Direction, ISODateString, Locale } from '@datahub/shared-types';

/* ------------------------------------------------------------------ locale */

export const getDirection = (locale: Locale): Direction => LOCALE_DIRECTION[locale];

export const isRtl = (locale: Locale): boolean => LOCALE_DIRECTION[locale] === 'rtl';

/* -------------------------------------------------------------- formatting */

/**
 * Formats a calendar date for display. Date-only parts of the ISO string are used, so the
 * displayed day never shifts with the viewer's timezone.
 */
export function formatDate(iso: ISODateString, locale: Locale, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Formats a number for display (grouping, decimals, currency/percent via `options`). */
export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], options).format(value);
}

/** Keeps the first `count` words and appends `suffix` when the text was shortened. */
export function truncateWords(text: string, count: number, suffix = ' …'): string {
  const words = text.trim().split(/\s+/);
  return words.length <= count ? text.trim() : `${words.slice(0, count).join(' ')}${suffix}`;
}

/* -------------------------------------------------------------- validation */

/** True for strings with at least one non-whitespace character. */
export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Pragmatic e-mail check (single `@`, a dot in the domain, no whitespace). Server-side validation remains authoritative. */
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
