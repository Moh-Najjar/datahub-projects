import type { Localized } from '@datahub/shared-types';
import type { Locale } from '@/i18n/languages';
import { toDecimalString } from '@/modules/payroll';
import type { EnumName, ReportColumn, ReportRow, ReportValue } from '@/modules/reports/types/reports';

/*
 * CSV for reports: UTF-8 with a BOM (spreadsheet apps then show Arabic correctly), CRLF lines, every cell quoted.
 * - Text that a spreadsheet would run as a formula (= + - @ tab CR at the start) is prefixed with `'`.
 * - Identifiers stay text: numeric-looking codes get a leading tab, so leading zeros and long digits survive.
 * - Numbers are plain (Latin digits, `.` decimals, no grouping); money is the EXACT decimal string of the minor units
 *   (JOD: 3 decimals); percentages are percent values with one decimal; dates are ISO `YYYY-MM-DD`.
 */

const FORMULA = /^[=+\-@\t\r]/;

/** One quoted cell. `numeric` values are never neutralised (a negative number is not a formula). */
export function csvCell(value: string | number | null, numeric = false): string {
  let text = value === null ? '' : String(value);
  if (!numeric && FORMULA.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** An identifier (employee number, reference…) kept as text by spreadsheets. */
export function csvIdentifier(value: string | null): string {
  if (value === null) return csvCell(null);
  if (/^\d+$/.test(value) || /^\d+[.,]?\d*[eE]\d+$/.test(value)) return `"\t${value}"`;
  return csvCell(value);
}

export interface CsvLabels {
  language: Locale;
  header: (column: ReportColumn) => string;
  enumLabel: (name: EnumName, value: string) => string;
}

const fixed = (value: number, digits: number) => (Math.round(value * 10 ** digits) / 10 ** digits).toFixed(digits);

/** The cell for one value of a column. */
export function csvValue(column: ReportColumn, value: ReportValue, labels: CsvLabels): string {
  if (value === null || value === undefined) return csvCell(null);
  switch (column.kind) {
    case 'number':
      return csvCell(typeof value === 'number' ? String(value) : String(value), typeof value === 'number');
    case 'decimal':
    case 'rating':
    case 'hours':
      return typeof value === 'number' ? csvCell(fixed(value, 2), true) : csvCell(String(value));
    case 'percent':
      return typeof value === 'number' ? csvCell(fixed(value * 100, 1), true) : csvCell(String(value));
    case 'money':
      return typeof value === 'number' ? csvCell(toDecimalString(value, 'JOD'), true) : csvCell(String(value));
    case 'code':
      return csvIdentifier(String(value));
    case 'date':
      return csvCell(String(value).slice(0, 10));
    case 'month':
      return csvCell(String(value).slice(0, 7));
    case 'localized':
      return csvCell(typeof value === 'object' ? (value as Localized<string>)[labels.language] : String(value));
    case 'enum':
      return csvCell(column.enum ? labels.enumLabel(column.enum, String(value)) : String(value));
    default:
      return csvCell(typeof value === 'object' ? (value as Localized<string>)[labels.language] : String(value));
  }
}

/** The whole file: headings, then one line per row. */
export function buildCsv(columns: readonly ReportColumn[], rows: readonly ReportRow[], labels: CsvLabels): string {
  const lines = [columns.map((c) => csvCell(labels.header(c))).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvValue(c, row[c.key] ?? null, labels)).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
