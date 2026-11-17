import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useReviewCycle } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import type { CycleStatus, ReviewCycle } from '@/modules/performance/types/performance';
import { formatDay, formatTimestamp } from '@/modules/performance/utils/format';
import { CycleStatusChip, ProgressBar } from '../common/Chips';
import { ReviewsSection } from '../reviews/ReviewsSection';
import { AssignDialog, CycleFormDialog, CycleStatusDialog } from './CycleDialogs';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/performance/cycles/:cycleId` — dates, completion tracking, participants' reviews, lifecycle. */
export function CycleDetails() {
  const { t } = useTranslation('performance');
  const { cycleId = '' } = useParams();
  const query = useReviewCycle(cycleId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={performancePaths.cycles} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToCycles')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('cycles.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <CycleView cycle={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function CycleView({ cycle: c }: { cycle: ReviewCycle }) {
  const { t } = useTranslation('performance');
  const { language } = useLanguage();
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<{ kind: 'edit' | 'assign' } | { kind: 'status'; status: CycleStatus } | null>(null);
  useBreadcrumbs([{ label: t('tabs.cycles'), to: performancePaths.cycles }, { label: c.name[language] }]);
  const n = (v: number) => formatNumber(v, language);
  const pct = (v: number) => (c.progress.total ? Math.round((v / c.progress.total) * 100) : 0);

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {c.name[language]}
          </Typography>
          <CycleStatusChip status={c.status} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {c.can.edit && (
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setDialog({ kind: 'edit' })}>
              {t('actions.edit')}
            </Button>
          )}
          {c.can.assign && (
            <Button variant="outlined" startIcon={<GroupAddOutlined />} onClick={() => setDialog({ kind: 'assign' })}>
              {t('actions.assignEmployees')}
            </Button>
          )}
          {c.nextStatuses.map((s) => (
            <Button key={s} variant={s === 'active' ? 'contained' : 'outlined'} color={s === 'closed' ? 'error' : 'primary'} onClick={() => setDialog({ kind: 'status', status: s })}>
              {t(`cycleActions.${s}`)}
            </Button>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
        <Panel title={t('cycles.details')} subtitle={c.description || undefined}>
          <DetailList
            items={[
              { label: t('fields.reviewPeriod'), value: `${formatDay(c.periodStart, language)} – ${formatDay(c.periodEnd, language)}` },
              { label: t('fields.startDate'), value: formatDay(c.startDate, language) },
              { label: t('fields.endDate'), value: formatDay(c.endDate, language) },
              { label: t('fields.selfAssessmentDeadline'), value: formatDay(c.selfAssessmentDeadline, language) },
              { label: t('fields.managerReviewDeadline'), value: formatDay(c.managerReviewDeadline, language) },
              { label: t('fields.template'), value: c.template.name[language] },
            ]}
          />
        </Panel>
        <Stack spacing={2.5}>
          <Panel title={t('cycles.completion')}>
            <DetailList
              items={[
                { label: t('columns.participants'), value: n(c.participants) },
                { label: t('cycles.selfDone'), value: <ProgressBar value={pct(c.progress.selfSubmitted)} label={t('cycles.selfDone')} /> },
                { label: t('cycles.managerDone'), value: <ProgressBar value={pct(c.progress.managerSubmitted)} label={t('cycles.managerDone')} /> },
              ]}
            />
          </Panel>
          <Panel title={t('details.statusHistory')}>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
              {[...c.history].reverse().map((h, i) => (
                <Box component="li" key={`${h.at}-${i}`}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t(`cycleStatus.${h.to}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {h.by[language]} · {formatTimestamp(h.at, language)}
                    {h.note ? ` · ${h.note}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Panel>
        </Stack>
      </Box>
      {c.status !== 'draft' && (
        <Panel title={t('cycles.reviews')}>
          <ReviewsSection cycleId={c.id} />
        </Panel>
      )}
      {c.status === 'draft' && <Typography color="text.secondary">{t('cycles.draftParticipants', { value: n(c.participants) })}</Typography>}
      {dialog?.kind === 'edit' && (
        <CycleFormDialog
          cycle={c}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            feedback.notify(t('cycles.saved', { name: c.name[language] }));
          }}
        />
      )}
      {dialog?.kind === 'assign' && (
        <AssignDialog
          cycle={c}
          onClose={() => setDialog(null)}
          onDone={(count) => {
            setDialog(null);
            feedback.notify(t('cycles.assigned', { value: n(count) }));
          }}
        />
      )}
      {dialog?.kind === 'status' && (
        <CycleStatusDialog
          cycle={c}
          status={dialog.status}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null);
            feedback.notify(t('cycles.statusChanged', { name: next.name[language], status: t(`cycleStatus.${next.status}`) }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </>
  );
}
