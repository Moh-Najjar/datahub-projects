import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { Panel, QueryBoundary } from '@/modules/shared/Panel';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { usePerformanceHistory, useRatingScale } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import type { EmployeePerformanceHistory } from '@/modules/performance/types/performance';
import { formatDay, ratingText } from '@/modules/performance/utils/format';
import { CycleStatusChip, ReviewStateChip } from './common/Chips';
import { PlansSection } from './development/PlansSection';
import { GoalsSection } from './goals/GoalsSection';

/**
 * One employee's performance: review history with overall ratings, goals and development plans. `'me'` = the signed-in
 * user. The API enforces privacy: own records for employees, the team for managers, everyone for HR.
 */
export function EmployeePerformance({ employeeId, embedded = false }: { employeeId: string; embedded?: boolean }) {
  const { t } = useTranslation('performance');
  const query = usePerformanceHistory(employeeId);
  return (
    <QueryBoundary query={query} notFoundText={t('history.notFound')} forbiddenText={t('history.forbidden')}>
      {query.data && <HistoryView history={query.data} own={employeeId === 'me'} embedded={embedded} />}
    </QueryBoundary>
  );
}

function HistoryView({ history: h, own, embedded }: { history: EmployeePerformanceHistory; own: boolean; embedded: boolean }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  const scale = useRatingScale();
  const { canManage } = usePerformanceAccess();
  const actionable = own ? h.reviews.find((r) => (r.cycleStatus === 'active' || r.cycleStatus === 'in-progress') && r.selfStatus !== 'submitted') : undefined;

  return (
    <Stack spacing={2.5}>
      {!embedded && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {own ? t('tabs.my') : h.employee.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={h.employee.employeeNumber} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <Typography variant="body2" color="text.secondary">
            {h.employee.position.name[language]} · {h.employee.department.name[language]}
          </Typography>
        </Box>
      )}
      {actionable && (
        <Alert severity="warning" action={<Link component={RouterLink} to={performancePaths.review(actionable.id)}>{t('history.openSelf')}</Link>}>
          {t('history.selfDue', { cycle: actionable.cycle.name[language] })}
        </Alert>
      )}
      <Panel title={t('history.reviews')}>
        {h.reviews.length === 0 ? (
          <Typography color="text.secondary">{t('history.noReviews')}</Typography>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('history.reviews')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('fields.cycle')}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{t('fields.reviewPeriod')}</TableCell>
                  <TableCell>{t('fields.overallRating')}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {h.reviews.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link component={RouterLink} to={performancePaths.review(r.id)}>
                        {r.cycle.name[language]}
                      </Link>
                      <Box sx={{ mt: 0.5 }}>
                        <CycleStatusChip status={r.cycleStatus} />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>{`${formatDay(r.periodStart, language)} – ${formatDay(r.periodEnd, language)}`}</TableCell>
                    <TableCell data-rating={r.id}>{ratingText(r.overallRating, scale.data ?? [], language)}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <ReviewStateChip state={r.state} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
      <Panel title={t('history.goals')}>
        <GoalsSection employeeId={h.employee.id} allowCreate={!own && canManage} />
      </Panel>
      <Panel title={t('history.plans')}>
        <PlansSection employeeId={h.employee.id} allowCreate={!own && canManage} />
      </Panel>
    </Stack>
  );
}
