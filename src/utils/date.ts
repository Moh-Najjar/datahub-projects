import type { Locale } from '@/i18n/types';

const MONTHS: Record<Locale, readonly string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  // WordPress' Arabic month names, as shown on the original's Arabic pages.
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

/**
 * Formats a post date like the original ("November 9, 2026" / "نوفمبر 9, 2026").
 * Parsed manually so the calendar date never shifts with the viewer's timezone.
 */
export function formatPostDate(iso: string, locale: Locale): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[locale][(m ?? 1) - 1]} ${d}, ${y}`;
}

/** The original theme trims excerpts to 18 words and appends " …". */
export function trimExcerpt(text: string, words = 18): string {
  return `${text.split(/\s+/).slice(0, words).join(' ')} …`;
}
