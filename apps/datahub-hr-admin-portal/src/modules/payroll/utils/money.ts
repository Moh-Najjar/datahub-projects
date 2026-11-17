import type { Currency, Minor } from '@/modules/payroll/types/payroll';

/*
 * Decimal-safe money. Amounts are INTEGERS in the currency's minor unit and every operation is integer arithmetic:
 * no floating-point value is ever produced for an amount (a division keeps its remainder and rounds explicitly).
 *
 * ROUNDING RULE (tested): a calculated line is rounded ONCE, half-up (ties away from zero), to the currency's minor
 * unit — e.g. JOD 850.000 × 7 ÷ 30 days = 198.3333… → 198.333; 0.0005 → 0.001. Totals are sums of rounded lines, so a
 * total always equals the sum of what is displayed.
 */

/** Minor-unit digits per currency (ISO 4217): JOD has 3 (fils), the others 2. */
export const CURRENCY_DIGITS: Readonly<Record<Currency, number>> = { JOD: 3, USD: 2, SAR: 2, AED: 2 };
const POWERS = [1, 10, 100, 1000] as const;

/** Minor units in one major unit (JOD: 1000). */
export const minorPerUnit = (currency: Currency): number => POWERS[CURRENCY_DIGITS[currency]]!;

/** Basis points in 100 % (percentages are stored as integer basis points: 1 500 = 15.00 %). */
export const FULL_PERCENT = 10_000;

function assertSafe(...values: number[]): void {
  for (const v of values) if (!Number.isSafeInteger(v)) throw new RangeError(`Amount ${v} is not a safe integer`);
}

/** Exact integer division rounded half-up (ties away from zero). Both operands must be safe integers. */
export function divRound(numerator: number, denominator: number): number {
  assertSafe(numerator, denominator);
  if (denominator <= 0) throw new RangeError('Denominator must be positive');
  const n = Math.abs(numerator);
  const remainder = n % denominator;
  const quotient = (n - remainder) / denominator;
  const rounded = 2 * remainder >= denominator ? quotient + 1 : quotient;
  return numerator < 0 ? -rounded : rounded;
}

/** Sum of amounts (integer addition, checked). */
export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0;
  for (const v of values) {
    assertSafe(v);
    total += v;
  }
  assertSafe(total);
  return total;
}

/** `percentage` basis points of `base`, rounded once. */
export function percentOf(base: Minor, percentage: number): Minor {
  assertSafe(base * percentage);
  return divRound(base * percentage, FULL_PERCENT);
}

/** `base × days ÷ periodDays`, rounded once (partial periods). Equals `base` exactly for a full period. */
export function prorate(base: Minor, days: number, periodDays: number): Minor {
  if (days === periodDays) return base;
  assertSafe(base * days);
  return divRound(base * days, periodDays);
}

/**
 * Daily-rate amount for several days, rounded ONCE: Σ(monthly basic in force on each day) ÷ divisor.
 * (Rounding the daily rate first and multiplying would accumulate error.)
 */
export function dailyRateAmount(basicPerDay: readonly Minor[], divisor: number): Minor {
  return divRound(sumMinor(basicPerDay), divisor);
}

/* Text ⇄ minor units (forms, CSV, display) ------------------------------------------------------------------------ */

/** Parses "850", "850.5" or "850.125" into minor units; `null` if invalid or with more decimals than the currency has. */
export function parseAmount(text: string, currency: Currency): Minor | null {
  const match = /^(\d{1,10})(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const digits = CURRENCY_DIGITS[currency];
  const fraction = match[2] ?? '';
  if (fraction.length > digits) return null;
  const value = Number(match[1]) * minorPerUnit(currency) + Number(fraction.padEnd(digits, '0') || '0');
  return Number.isSafeInteger(value) ? value : null;
}

/** Minor units → plain decimal text with exactly the currency's digits ("850.125", "-12.50"); no grouping. */
export function toDecimalString(minor: Minor, currency: Currency): string {
  assertSafe(minor);
  const digits = CURRENCY_DIGITS[currency];
  const unit = minorPerUnit(currency);
  const abs = Math.abs(minor);
  const fraction = abs % unit;
  const whole = (abs - fraction) / unit;
  const sign = minor < 0 ? '-' : '';
  return digits === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(fraction).padStart(digits, '0')}`;
}

/** "15.00" from 1 500 basis points. */
export function percentText(basisPoints: number): string {
  assertSafe(basisPoints);
  const fraction = basisPoints % 100;
  return `${(basisPoints - fraction) / 100}.${String(fraction).padStart(2, '0')}`;
}

/** Parses "15", "15.5" or "15.25" (0–100, at most 2 decimals) into basis points; `null` if invalid. */
export function parsePercent(text: string): number | null {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  return value <= FULL_PERCENT ? value : null;
}
