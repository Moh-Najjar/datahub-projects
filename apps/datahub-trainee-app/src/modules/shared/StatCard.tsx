import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';

type Tone = 'primary' | 'success' | 'warning' | 'info' | 'secondary';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  /** Small supporting line under the value (e.g. "of 12 trainings"). */
  hint?: string;
  isLoading?: boolean;
}

/** A statistic: a big tabular number, its label and an icon chip. */
export function StatCard({ label, value, icon, tone = 'primary', hint, isLoading }: StatCardProps) {
  return (
    <Card sx={{ p: 2.5, height: '100%', display: 'flex', alignItems: 'flex-start', gap: 2 }}>
      <Box aria-hidden sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: (theme) => theme.palette[tone].light, color: (theme) => (tone === 'primary' ? theme.palette.primary.main : theme.palette[tone].main) }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        {isLoading ? (
          <Skeleton variant="text" width={72} height={40} />
        ) : (
          <Typography component="p" sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {value}
          </Typography>
        )}
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </Box>
    </Card>
  );
}
