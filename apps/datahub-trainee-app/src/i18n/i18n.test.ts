import { describe, expect, it } from 'vitest';
import ar from './locales/ar.json';
import en from './locales/en.json';
import { fill, plural, UI } from './index';
import { formatDate, formatFileSize, formatNumber, formatPercent, toDateInputValue, toDateTimeInputValue } from './format';
import { LOCALE_DIRECTION, LOCALES, DEFAULT_LOCALE, isLocale } from './languages';

type Tree = { [key: string]: string | Tree };
const flatten = (tree: Tree, prefix = ''): Record<string, string> =>
  Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...out, [path]: value } : { ...out, ...flatten(value, path) };
  }, {});

const flatEn = flatten(en as Tree);
const flatAr = flatten(ar as Tree);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('English and Arabic have exactly the same keys', () => {
    expect(Object.keys(flatAr).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it('no translation is empty', () => {
    for (const [key, value] of [...Object.entries(flatEn), ...Object.entries(flatAr)]) expect(value.trim(), key).not.toBe('');
  });

  it('every key keeps the same {placeholders} in both languages', () => {
    for (const key of Object.keys(flatEn)) expect(placeholders(flatAr[key]!), key).toEqual(placeholders(flatEn[key]!));
  });

  it('Arabic strings are actually translated (they contain Arabic letters) except brand words, codes and symbols', () => {
    const allowedAsIs = new Set(['languages.en', 'rankings.columns.position']);
    const untranslated = Object.entries(flatAr).filter(([key, value]) => !allowedAsIs.has(key) && !/[؀-ۿ]/.test(value));
    expect(untranslated.map(([key]) => key)).toEqual([]);
  });

  it('English is the default language and each language has a direction', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALES).toEqual(['en', 'ar']);
    expect(LOCALE_DIRECTION).toEqual({ en: 'ltr', ar: 'rtl' });
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(UI.en.app.name).toBe('DataHub Training');
  });
});

describe('fill and plural', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(fill('Hello {name}, {missing}', { name: 'Sam' })).toBe('Hello Sam, {missing}');
  });

  it('chooses plural forms (English and Arabic)', () => {
    expect(plural('one item|{n} items', 1, 'en')).toBe('one item');
    expect(plural('one item|{n} items', 2, 'en')).toBe('{n} items');
    const ar5 = 'a|b|c|d|e';
    expect([1, 2, 5, 11, 100].map((n) => plural(ar5, n, 'ar'))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('localized numbers and dates (Latin digits in Arabic)', () => {
  it('formats numbers with Latin digits in both languages', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
    expect(formatNumber(1234567, 'ar')).toMatch(/^[0-9٬,.\s]+$/);
    expect(formatNumber(1234567, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatPercent(72.4, 'en')).toBe('72%');
    expect(formatPercent(72.4, 'ar')).toBe('72٪');
  });

  it('formats dates in the viewer\'s language, with Latin digits', () => {
    const iso = '2026-11-23T10:00:00.000Z';
    expect(formatDate(iso, 'en')).toMatch(/Nov 23, 2026|Nov 22, 2026/);
    expect(formatDate(iso, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatDate(iso, 'ar')).toMatch(/2026/);
    expect(formatDate(null, 'en')).toBe('—');
    expect(formatDate('garbage', 'en')).toBe('—');
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512, 'en')).toBe('512 B');
    expect(formatFileSize(2048, 'en')).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024, 'en')).toBe('5 MB');
  });

  it('builds date and date-time input values in local time', () => {
    const date = new Date(2026, 10, 5, 7, 8);
    expect(toDateInputValue(date)).toBe('2026-11-05');
    expect(toDateTimeInputValue(date)).toBe('2026-11-05T07:08');
  });
});
