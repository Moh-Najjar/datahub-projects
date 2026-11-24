import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { chart } from '@/core/theme/tokens';
import { formatNumber, formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import type { StatusBreakdown, TrainingProgressEntry } from '../types/dashboard';
import { seriesColor } from '../utils/seriesColor';

/**
 * Small, dependency-free charts (SVG + boxes). Every value is also written as text, so colour is never the only way to
 * read them; the graphics themselves are `aria-hidden` or carry a text summary.
 */

const SEGMENTS = [
  { key: 'inProgress', color: chart[0] },
  { key: 'assigned', color: chart[1] },
  { key: 'completed', color: chart[2] },
] as const;

const SIZE = 136;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Enrollments by status: a donut with the total in its centre and a legend with each share. */
export function StatusDonut({ data }: { data: StatusBreakdown }) {
  const t = useT();
  const { locale } = useLocale();
  const total = data.assigned + data.inProgress + data.completed;
  const labels = { assigned: t.enums.enrollmentStatus.assigned, inProgress: t.enums.enrollmentStatus['in-progress'], completed: t.enums.enrollmentStatus.completed };
  const share = (value: number) => (total ? (value / total) * 100 : 0);

  // Each arc starts where the previous ones end.
  const lengths = SEGMENTS.map((segment) => (share(data[segment.key]) / 100) * CIRCUMFERENCE);
  const arcs = SEGMENTS.map((segment, index) => ({ ...segment, length: lengths[index]!, offset: lengths.slice(0, index).reduce((sum, l) => sum + l, 0) }));

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2.5, sm: 4 }} sx={{ alignItems: 'center' }}>
      <Box
        role="img"
        aria-label={SEGMENTS.map((s) => `${labels[s.key]}: ${formatNumber(data[s.key], locale)}`).join(', ')}
        sx={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#ececf3" strokeWidth={STROKE} />
          {arcs.map((arc) =>
            arc.length > 0 ? (
              <circle
                key={arc.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={-arc.offset}
              />
            ) : null,
          )}
        </svg>
        <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatNumber(total, locale)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t.dashboard.donutCenter}
          </Typography>
        </Box>
      </Box>
      <Stack component="ul" spacing={1.5} sx={{ p: 0, m: 0, listStyle: 'none', flex: 1, width: '100%' }}>
        {SEGMENTS.map((s) => (
          <Stack component="li" key={s.key} direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
            <Typography sx={{ flex: 1, fontSize: 15 }}>{labels[s.key]}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(data[s.key], locale)}
            </Typography>
            <Typography sx={{ fontWeight: 700, minWidth: 48, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>{formatPercent(share(data[s.key]), locale)}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

/** Average progress of the most-enrolled trainings: label · coloured bar · value (values under 50 % in orange). */
export function TrainingProgressBars({ rows }: { rows: readonly TrainingProgressEntry[] }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <Stack component="ul" spacing={2.25} sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={t.dashboard.progressByTraining}>
      {rows.map((row, index) => {
        const value = Math.min(100, row.averageProgress);
        return (
          <Box
            component="li"
            key={row.trainingId}
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: 'minmax(140px, 34%) 1fr 56px' }, columnGap: 2.5, rowGap: 0.75, alignItems: 'center' }}
          >
            <Typography sx={{ fontSize: 15, textAlign: { md: 'right' }, overflowWrap: 'anywhere' }}>{row.title}</Typography>
            <Box aria-hidden="true" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, gridRow: { xs: 2, md: 'auto' }, height: 12, borderRadius: 999, bgcolor: 'grey.100', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${value}%`, bgcolor: seriesColor(index), borderRadius: 999 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, textAlign: 'end', fontVariantNumeric: 'tabular-nums', color: value < 50 ? 'warning.main' : 'text.primary' }}>{formatPercent(value, locale)}</Typography>
          </Box>
        );
      })}
    </Stack>
  );
}
