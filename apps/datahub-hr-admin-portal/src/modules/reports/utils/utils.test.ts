import { describe, expect, it } from 'vitest';
import type { ReportColumn, ReportRow } from '@/modules/reports/types/reports';
import { buildCustom, builderErrors, sortRows } from './builder';
import { addMonths, ageBand, attendanceRate, complianceRate, daysBetween, funnelConversion, headcountOn, median, monthsIn, offerAcceptanceRate, periodTurnover, ratingDistribution, ratio, timeToHire, turnoverByMonth, yearsBetween } from './calculations';
import { buildCsv, csvCell, csvIdentifier, csvValue } from './csv';
import { defaultFilters, filterErrors, filtersFromParams, filtersToParams, relevantFilters } from './filters';

const counts = (c: Partial<Record<'present' | 'late' | 'absent' | 'on-leave' | 'half-day' | 'incomplete' | 'scheduled', number>>) => ({ present: 0, late: 0, absent: 0, 'on-leave': 0, 'half-day': 0, incomplete: 0, scheduled: 0, ...c });

describe('formulas', () => {
  it('ratios have no basis (null) when the whole is zero — never 0 %', () => {
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(0, 5)).toBe(0);
    expect(median([])).toBeNull();
    expect(median([5, 1, 3, 9])).toBe(4);
  });

  it('attendance rate: attended ÷ (attended + absent); Not started and approved leave are not due', () => {
    expect(attendanceRate(counts({ present: 6, late: 2, 'half-day': 1, incomplete: 1, absent: 2, 'on-leave': 5, scheduled: 40 }))).toBe(10 / 12);
    expect(attendanceRate(counts({ scheduled: 30, 'on-leave': 2 }))).toBeNull();
  });

  it('turnover: leavers ÷ average of opening and closing headcount', () => {
    const people = [
      { hireDate: '2020-01-01', leftOn: null },
      { hireDate: '2020-01-01', leftOn: '2026-10-10' },
      { hireDate: '2026-10-05', leftOn: null },
      { hireDate: '2021-01-01', leftOn: '2026-09-30' },
    ];
    expect(headcountOn(people, '2026-09-30')).toBe(2); // the one leaving on 30 Sep is no longer employed that evening
    const [october] = turnoverByMonth(people, ['2026-10']);
    expect(october).toEqual({ month: '2026-10', opening: 2, hires: 1, leavers: 1, closing: 2, averageHeadcount: 2, turnoverRate: 0.5 });
    expect(periodTurnover(people, '2026-09-01', '2026-10-31')).toMatchObject({ opening: 3, closing: 2, leavers: 2, hires: 1, rate: 0.8 });
  });

  it('recruitment: acceptance over answered/expired offers, step conversion, time to hire only with both dates', () => {
    expect(offerAcceptanceRate(['accepted', 'accepted', 'rejected', 'expired', 'sent', 'draft', 'withdrawn'])).toBe(0.5);
    expect(offerAcceptanceRate(['sent'])).toBeNull();
    expect(funnelConversion([100, 50, 0, 0])).toEqual([null, 0.5, 0, null]);
    expect(timeToHire('2026-09-01', '2026-10-01T09:30')).toBe(30);
    expect(timeToHire(null, '2026-10-01')).toBeNull();
    expect(timeToHire('2026-10-02', '2026-10-01')).toBeNull();
  });

  it('ratings, documents, ages and dates', () => {
    expect(ratingDistribution([5, 4, 4, 0, 6])).toEqual([{ value: 1, count: 0 }, { value: 2, count: 0 }, { value: 3, count: 0 }, { value: 4, count: 2 }, { value: 5, count: 1 }]);
    expect(complianceRate([{ status: 'verified' }, { status: 'missing' }, { status: 'expired' }, { status: 'verified' }])).toBe(0.5);
    expect(complianceRate([])).toBeNull();
    expect(yearsBetween('2000-11-17', '2026-11-16')).toBe(25);
    expect(ageBand(25)).toBe('25-34');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across a DST change
    expect(monthsIn('2026-11-20', '2027-01-03')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(addMonths('2026-01', -2)).toBe('2025-11');
  });
});

describe('filters', () => {
  it('defaults to the last three months, validates dates and the 24-month limit', () => {
    expect(defaultFilters('2026-11-16')).toMatchObject({ from: '2026-09-01', to: '2026-11-16' });
    expect(filterErrors({ ...defaultFilters('2026-11-16'), from: '2026-13-01' })).toEqual({ from: ['invalidDate'] });
    expect(filterErrors({ ...defaultFilters('2026-11-16'), from: '2024-12-01', to: '2026-11-30' })).toEqual({});
    expect(filterErrors({ ...defaultFilters('2026-11-16'), from: '2024-11-30', to: '2026-11-01' })).toEqual({ to: ['rangeTooLong'] });
  });

  it('keeps only the filters a report uses, and round-trips through the URL', () => {
    const f = { ...defaultFilters('2026-11-16'), departmentId: 'dep-eng', employmentType: 'contract' as const };
    expect(relevantFilters(f, ['departmentId'])).toMatchObject({ departmentId: 'dep-eng', employmentType: '' });
    expect(filtersFromParams(new URLSearchParams(filtersToParams(f)))).toEqual(f);
    expect(filtersFromParams(new URLSearchParams('employmentType=freelance')).employmentType).toBe('');
  });
});

describe('CSV', () => {
  const labels = { language: 'en' as const, header: (c: ReportColumn) => c.key, enumLabel: (_: string, v: string) => v.toUpperCase() };

  it('neutralises spreadsheet formulas in text, never in numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(csvCell('-2', true)).toBe('"-2"');
    expect(csvCell(null)).toBe('""');
  });

  it('keeps identifiers as text and money exact', () => {
    expect(csvIdentifier('00123')).toBe('"\t00123"');
    expect(csvIdentifier('EMP-0001')).toBe('"EMP-0001"');
    expect(csvIdentifier('+962')).toBe(`"'+962"`);
    expect(csvValue({ key: 'gross', kind: 'money' }, 1_234_567, labels)).toBe('"1234.567"');
    expect(csvValue({ key: 'net', kind: 'money' }, -5, labels)).toBe('"-0.005"');
    expect(csvValue({ key: 'rate', kind: 'percent' }, 0.91234, labels)).toBe('"91.2"');
    expect(csvValue({ key: 'd', kind: 'date' }, '2026-11-16', labels)).toBe('"2026-11-16"');
    expect(csvValue({ key: 's', kind: 'enum', enum: 'employeeStatus' }, 'active', labels)).toBe('"ACTIVE"');
    expect(csvValue({ key: 'n', kind: 'localized' }, { en: 'Engineering', ar: 'الهندسة' }, { ...labels, language: 'ar' })).toBe('"الهندسة"');
  });

  it('a file has a BOM, headings and CRLF lines', () => {
    const csv = buildCsv([{ key: 'a', kind: 'text' }], [{ a: 'x' }, { a: null }], labels);
    expect(csv).toBe('﻿"a"\r\n"x"\r\n""\r\n');
  });
});

describe('builder', () => {
  const columns: ReportColumn[] = [{ key: 'name', kind: 'text' }, { key: 'dept', kind: 'text' }, { key: 'days', kind: 'number' }, { key: 'rate', kind: 'percent' }];
  const rows: ReportRow[] = [
    { name: 'A', dept: 'X', days: 2, rate: 0.5 },
    { name: 'B', dept: 'X', days: 3, rate: 1 },
    { name: 'C', dept: 'Y', days: null, rate: null },
  ];

  it('projects fields, sorts with missing values last', () => {
    const r = buildCustom({ fields: ['name', 'days'], groupBy: null, sortBy: 'days', sortDirection: 'desc' }, columns, rows);
    expect(r.rows).toEqual([{ name: 'B', days: 3 }, { name: 'A', days: 2 }, { name: 'C', days: null }]);
    expect(sortRows(rows, 'days', 'asc').map((x) => x.name)).toEqual(['A', 'B', 'C']);
  });

  it('groups: counts, sums of amounts, averages of rates', () => {
    const r = buildCustom({ fields: ['dept', 'days', 'rate'], groupBy: 'dept', sortBy: null, sortDirection: 'asc' }, columns, rows);
    expect(r.columns.map((c) => c.key)).toEqual(['dept', 'rows', 'days', 'rate']);
    expect(r.rows).toEqual([{ dept: 'X', rows: 2, days: 5, rate: 0.75 }, { dept: 'Y', rows: 1, days: null, rate: null }]);
  });

  it('accepts only the dataset’s fields', () => {
    expect(builderErrors({ fields: [], groupBy: null, sortBy: null }, columns)).toEqual({ fields: ['required'] });
    expect(builderErrors({ fields: ['salary'], groupBy: 'days', sortBy: 'x' }, columns)).toEqual({ fields: ['notAllowed'], groupBy: ['notAllowed'], sortBy: ['notAllowed'] });
  });
});
