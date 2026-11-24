import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';

interface ProgressIndicatorProps {
  /** 0–100. */
  value: number;
  /** Show the percentage as text next to the bar (default true). */
  showValue?: boolean;
  /** Accessible name; defaults to "Progress". */
  label?: string;
  minWidth?: number;
}

/** A progress bar with its percentage. Green once complete. */
export function ProgressIndicator({ value, showValue = true, label, minWidth = 120 }: ProgressIndicatorProps) {
  const t = useT();
  const { locale } = useLocale();
  const complete = value >= 100;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth }}>
      <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, value))} color={complete ? 'success' : 'primary'} aria-label={label ?? t.common.progress} sx={{ flex: 1, height: 8 }} />
      {showValue && (
        <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 40, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
          {formatPercent(value, locale)}
        </Typography>
      )}
    </Box>
  );
}
