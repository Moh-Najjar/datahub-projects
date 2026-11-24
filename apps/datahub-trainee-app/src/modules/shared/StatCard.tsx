import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

type Tone = 'primary' | 'success' | 'warning' | 'info' | 'secondary';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Small muted icon in the top corner (optional). */
  icon?: ReactNode;
  /** Colour of the supporting line — and of the value when `emphasis` is set. */
  tone?: Tone;
  /** Supporting line under the value (e.g. "12 published"). */
  hint?: string;
  /** Colours the value too: a figure that needs attention. */
  emphasis?: boolean;
  isLoading?: boolean;
}

/** A key figure: label on top, a large tabular number and a coloured supporting line. */
export function StatCard({ label, value, icon, tone = 'primary', hint, emphasis = false, isLoading }: StatCardProps) {
  const color = `${tone}.main`;
  return (
    <Card sx={{ p: { xs: 2.5, md: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography color="text.secondary" sx={{ fontSize: 15, fontWeight: 500 }}>
          {label}
        </Typography>
        {icon && (
          <Box aria-hidden sx={{ color: 'grey.400', display: 'flex', '& svg': { fontSize: 20 } }}>
            {icon}
          </Box>
        )}
      </Box>
      {isLoading ? (
        <Skeleton variant="text" width={96} height={56} />
      ) : (
        <Typography component="p" sx={{ mt: 1, fontSize: { xs: 34, md: 40 }, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em', color: emphasis ? color : 'text.primary' }}>
          {value}
        </Typography>
      )}
      {hint && (
        <Typography variant="body2" sx={{ mt: 1, fontWeight: 600, color }}>
          {hint}
        </Typography>
      )}
    </Card>
  );
}
