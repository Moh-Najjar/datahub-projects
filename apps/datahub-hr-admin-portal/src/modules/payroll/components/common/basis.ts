import type { TFunction } from 'i18next';
import type { Locale } from '@/i18n/languages';
import type { Currency, ItemBasis, LineItem } from '@/modules/payroll/types/payroll';
import { formatAmount, formatPercent } from '@/modules/payroll/utils/format';

/** How one line amount was obtained, in words ("JOD 1,200.000 × 20/30 days", "10.00% of JOD 1,200.000"…). */
export function basisText(t: TFunction<'payroll'>, b: ItemBasis, currency: Currency, language: Locale): string {
  const base = `${currency} ${formatAmount(b.base, currency, language)}`;
  switch (b.method) {
    case 'prorated':
      return b.days === b.periodDays ? t('basis.fullPeriod', { base }) : t('basis.prorated', { base, days: b.days, periodDays: b.periodDays });
    case 'percentage':
      return t('basis.percentage', { percent: formatPercent(b.percentage), base });
    case 'daily-rate':
      return t('basis.dailyRate', { days: b.days, base, divisor: b.divisor });
    default:
      return t('basis.fixed');
  }
}

export function itemBasis(t: TFunction<'payroll'>, item: LineItem, currency: Currency, language: Locale): string {
  const text = item.basis.map((b) => basisText(t, b, currency, language)).join(' + ');
  return item.capped ? `${text} · ${t('basis.capped')}` : text;
}
