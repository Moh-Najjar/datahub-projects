import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { usePlan, useUpdatePlanActivities } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import { ACTIVITY_STATUSES, type ActivityStatus, type DevelopmentPlan } from '@/modules/performance/types/performance';
import { formatDay, formatTimestamp } from '@/modules/performance/utils/format';
import { errorText } from '@/modules/performance/utils/serverErrors';
import { PlanStatusChip, ProgressBar } from '../common/Chips';
import { PlanFormDialog } from './PlanFormDialog';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/performance/development/:planId` — objectives, activities (status updates by the employee or manager), progress. */
export function PlanDetails() {
  const { t } = useTranslation('performance');
  const { planId = '' } = useParams();
  const { canReadBeyondOwn } = usePerformanceAccess();
  const query = usePlan(planId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={canReadBeyondOwn ? performancePaths.development : performancePaths.overview} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {canReadBeyondOwn ? t('actions.backToPlans') : t('actions.backToMy')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('plans.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <PlanView plan={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function PlanView({ plan: p }: { plan: DevelopmentPlan }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canReadBeyondOwn } = usePerformanceAccess();
  const feedback = useFeedback();
  const activities = useUpdatePlanActivities();
  const [editing, setEditing] = useState(false);
  useBreadcrumbs([...(canReadBeyondOwn ? [{ label: t('tabs.development'), to: performancePaths.development }] : []), { label: p.title }]);
  const setStatus = (activityId: string, status: ActivityStatus) =>
    activities.mutate({ id: p.id, changes: [{ id: activityId, status }] }, { onSuccess: () => feedback.notify(t('plans.activityUpdated')), onError: (e) => feedback.notify(errorText(t, tCommon, e), 'error') });

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {p.title}
          </Typography>
          <PlanStatusChip status={p.status} />
        </Box>
        {p.can.edit && (
          <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditing(true)}>
            {t('actions.edit')}
          </Button>
        )}
      </Box>
      <Panel title={t('plans.details')}>
        <DetailList
          items={[
            { label: t('fields.employee'), value: p.employee.name[language] },
            { label: t('fields.department'), value: p.employee.department.name[language] },
            { label: t('fields.targetDate'), value: formatDay(p.targetDate, language) },
            { label: t('fields.cycle'), value: p.cycle?.name[language] ?? '—' },
            { label: t('fields.progress'), value: <ProgressBar value={p.progress} label={t('fields.progress')} /> },
            { label: t('plans.updated'), value: formatTimestamp(p.updatedAt, language) },
          ]}
        />
      </Panel>
      <Panel title={t('plans.objectives')}>
        <Box component="ul" sx={{ m: 0, pl: 3 }}>
          {p.objectives.map((o) => (
            <li key={o}>
              <Typography variant="body2">{o}</Typography>
            </li>
          ))}
        </Box>
      </Panel>
      <Panel title={t('plans.activities')} subtitle={p.can.updateActivities ? t('plans.activitiesHint') : undefined}>
        <TableContainer sx={{ position: 'relative' }}>
          <Table size="small" aria-label={t('plans.activities')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('fields.activity')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.activityType')}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{t('fields.targetDate')}</TableCell>
                <TableCell>{t('fields.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {p.activities.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{t(`activityTypes.${a.type}`)}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, whiteSpace: 'nowrap' }}>{formatDay(a.targetDate, language)}</TableCell>
                  <TableCell>
                    {p.can.updateActivities ? (
                      <TextField select size="small" value={a.status} onChange={(e) => setStatus(a.id, e.target.value as ActivityStatus)} disabled={activities.isPending} slotProps={{ htmlInput: { 'aria-label': t('plans.activityStatusFor', { title: a.title }) } }} sx={{ minWidth: 140 }}>
                        {ACTIVITY_STATUSES.map((s) => (
                          <MenuItem key={s} value={s}>
                            {t(`activityStatus.${s}`)}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      t(`activityStatus.${a.status}`)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Panel>
      {editing && (
        <PlanFormDialog
          plan={p}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            feedback.notify(t('plans.saved', { title: p.title }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </>
  );
}
