import ar from './locales/ar.json';
import en from './locales/en.json';
import type { Locale } from './languages';

/**
 * Interface strings, typed by the English file: `ar.json` must have exactly the same keys (`tsc` fails otherwise).
 * Components read them with `useT()` — never hard-code visible text.
 */
export type UiStrings = typeof en;

export const UI: Record<Locale, UiStrings> = { en, ar };

/** Fills `{key}` placeholders: `fill('Hello {name}', { name: 'Sam' })`. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Chooses `one` for 1 and `other` otherwise: strings are written `"one|other"` (Arabic: `"one|two|few|many|other"`). */
export function plural(forms: string, count: number, locale: Locale): string {
  const parts = forms.split('|');
  if (locale === 'ar' && parts.length === 5) {
    const mod100 = count % 100;
    if (count === 1) return parts[0]!;
    if (count === 2) return parts[1]!;
    if (mod100 >= 3 && mod100 <= 10) return parts[2]!;
    if (mod100 >= 11) return parts[3]!;
    return parts[4]!;
  }
  return (count === 1 ? parts[0] : parts[1]) ?? forms;
}
