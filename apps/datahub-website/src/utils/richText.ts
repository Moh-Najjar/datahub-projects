import type { RichText } from '@/types/content';

/** Plain-text version of a `RichText` value (for `alt`, `aria-label`, `<title>`). */
export function richToString(text: RichText): string {
  return typeof text === 'string' ? text : text.map((p) => (typeof p === 'string' ? p : p.mark)).join('');
}
