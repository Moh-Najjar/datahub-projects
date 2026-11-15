import { describe, expect, it } from 'vitest';
import i18n, { changeLanguage, currentLanguage, resources } from '@/i18n';
import { formatDate, formatNumber } from './format';

/** Every key path of a nested translation object, e.g. `actions.backHome`. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

describe('translations', () => {
  it('Arabic and English have exactly the same keys in every namespace', () => {
    for (const ns of Object.keys(resources.en) as Array<keyof typeof resources.en>) {
      expect(keyPaths(resources.ar[ns]).sort(), `namespace "${ns}"`).toEqual(keyPaths(resources.en[ns]).sort());
    }
  });

  it('has no empty strings', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const ns of Object.values(resources[lang])) {
        const empty = keyPaths(ns).filter((path) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], ns) === '');
        expect(empty, lang).toEqual([]);
      }
    }
  });
});

describe('language switching', () => {
  it('defaults to English, LTR', () => {
    expect(currentLanguage()).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('switches to Arabic: RTL, lang attribute, translated text, remembered choice', async () => {
    await changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(i18n.t('errors.notFoundTitle')).toBe('الصفحة غير موجودة');
    expect(localStorage.getItem('datahub-hr-admin.language')).toBe('ar');
  });
});

describe('formatting', () => {
  it('uses Latin digits (0–9) in Arabic', () => {
    expect(formatNumber(1234567, 'ar')).toMatch(/^[0-9٬,.\s]+$/);
    expect(formatNumber(1234567, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatDate('2026-03-15T09:30:00Z', 'ar')).toMatch(/2026/);
    expect(formatDate('2026-03-15T09:30:00Z', 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('formats English dates day-first', () => {
    expect(formatDate('2026-03-15T09:30:00Z', 'en', { dateStyle: 'short', timeZone: 'UTC' })).toBe('15/03/2026');
  });
});
