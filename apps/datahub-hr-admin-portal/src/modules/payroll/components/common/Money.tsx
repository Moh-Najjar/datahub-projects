import Box from '@mui/material/Box';
import { useLanguage } from '@/i18n/useLanguage';
import type { Currency, Minor } from '@/modules/payroll/types/payroll';
import { formatAmount } from '@/modules/payroll/utils/format';

/**
 * An amount with its currency code, always left-to-right (also in Arabic) and with tabular digits so columns align.
 * `hideCode` for dense tables whose header already names the currency.
 */
export function Money({ value, currency, hideCode = false, strong = false }: { value: Minor; currency: Currency; hideCode?: boolean; strong?: boolean }) {
  const { language } = useLanguage();
  return (
    <Box component="span" dir="ltr" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: strong ? 600 : undefined, unicodeBidi: 'isolate' }}>
      {hideCode ? '' : `${currency} `}
      {formatAmount(value, currency, language)}
    </Box>
  );
}

/** A technical identifier (run number, employee number, code): monospace and left-to-right. */
export function Code({ children }: { children: string }) {
  return (
    <Box component="span" dir="ltr" sx={{ fontFamily: 'monospace', fontSize: '0.85em', whiteSpace: 'nowrap', unicodeBidi: 'isolate' }}>
      {children}
    </Box>
  );
}
