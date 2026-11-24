import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatDate, formatNumber, formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { StatusChip } from '@/modules/shared/StatusChip';
import type { TrainingProgressEntry } from '../types/dashboard';
import { seriesColor } from '../utils/seriesColor';

/** Hidden on phones: the training (a link there) and its completion stay readable without scrolling. */
const wide = { display: { xs: 'none', md: 'table-cell' } } as const;

/** The most-enrolled trainings: status, learners, completion (completed ÷ enrolled) and end date. */
export function TrainingsTable({ rows }: { rows: readonly TrainingProgressEntry[] }) {
  const t = useT();
  const { locale } = useLocale();
  const c = t.dashboard.table;

  return (
    <TableContainer>
      <Table aria-label={c.title}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 0 }}>{c.training}</TableCell>
            <TableCell sx={wide}>{c.status}</TableCell>
            <TableCell sx={wide}>{c.learners}</TableCell>
            <TableCell>{c.completion}</TableCell>
            <TableCell sx={wide}>{c.endDate}</TableCell>
            <TableCell align="right" sx={{ ...wide, pr: 0 }}>
              {c.action}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const rate = row.enrollments ? (row.completed / row.enrollments) * 100 : 0;
            return (
              <TableRow key={row.trainingId} hover>
                <TableCell sx={{ pl: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: seriesColor(index), flexShrink: 0 }} />
                    <Link component={RouterLink} to={ROUTES.training(row.trainingId)} color="text.primary" underline="hover" sx={{ fontSize: 15, fontWeight: 500, overflowWrap: 'break-word' }}>
                      {row.title}
                    </Link>
                  </Box>
                </TableCell>
                <TableCell sx={wide}>
                  <StatusChip kind="training" value={row.status} />
                </TableCell>
                <TableCell sx={{ ...wide, whiteSpace: 'nowrap' }}>{fill(c.learnersValue, { count: formatNumber(row.enrollments, locale) })}</TableCell>
                <TableCell sx={{ minWidth: { xs: 130, md: 180 }, pr: { xs: 0, md: 2 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: rate < 50 ? 'warning.main' : 'text.primary' }}>
                    {fill(c.completionValue, { completed: formatNumber(row.completed, locale), total: formatNumber(row.enrollments, locale), value: formatPercent(rate, locale) })}
                  </Typography>
                  <Box aria-hidden="true" sx={{ mt: 0.75, height: 6, maxWidth: 220, borderRadius: 999, bgcolor: 'grey.100', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${Math.min(100, rate)}%`, bgcolor: seriesColor(index), borderRadius: 999 }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ ...wide, color: 'text.secondary', whiteSpace: 'nowrap' }}>{row.endDate ? formatDate(row.endDate, locale) : c.noEndDate}</TableCell>
                <TableCell align="right" sx={{ ...wide, pr: 0 }}>
                  <Link component={RouterLink} to={ROUTES.training(row.trainingId)} underline="hover" sx={{ fontWeight: 700 }} aria-label={`${c.view}: ${row.title}`}>
                    {c.view}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
