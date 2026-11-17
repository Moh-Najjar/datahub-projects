import type { Locale } from '@/i18n/languages';
import type { PersonName } from '@/modules/employees/types/employee';

/** "First Last" in the given language. */
export const displayName = (name: PersonName, language: Locale) => `${name.first[language]} ${name.last[language]}`;

/** Up to two initials for the avatar placeholder (Arabic "ال" article skipped). */
export function initials(name: PersonName, language: Locale): string {
  return [name.first[language], name.last[language]]
    .map((part) => part.replace(/^ال/, '').trim().charAt(0))
    .join('')
    .toUpperCase();
}
