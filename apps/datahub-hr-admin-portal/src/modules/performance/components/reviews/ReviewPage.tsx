import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { useRatingScale, useReopenReview, useReview } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import type { Review } from '@/modules/performance/types/performance';
import { formatDay, formatTimestamp, ratingText } from '@/modules/performance/utils/format';
import { errorText } from '@/modules/performance/utils/serverErrors';
import { CycleStatusChip, GoalStatusChip, ProgressBar, ReviewStateChip } from '../common/Chips';
import { ManagerReviewForm, SelfAssessmentForm } from './ReviewForms';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/performance/reviews/:reviewId` — the structured review: information, goals, self-assessment, manager review. */
export function ReviewPage() {
  const { t } = useTranslation('performance');
  const { reviewId = '' } = useParams();
  const { canReadBeyondOwn } = usePerformanceAccess();
  const query = useReview(reviewId);
  // Feedback lives here: the view re-renders with new permissions after each submission.
  const feedback = useFeedback();
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={canReadBeyondOwn ? performancePaths.reviews : performancePaths.overview} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {canReadBeyondOwn ? t('actions.backToReviews') : t('actions.backToMy')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('reviews.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <ReviewView review={query.data} notify={feedback.notify} />}
      </QueryBoundary>
      <Feedback {...feedback} />
    </Stack>
  );
}

function ReviewView({ review: r, notify }: { review: Review; notify: (text: string, severity?: 'success' | 'error') => void }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canReadBeyondOwn } = usePerformanceAccess();
  const scale = useRatingScale();
  const levels = scale.data ?? [];
  const reopen = useReopenReview();
  const [reopening, setReopening] = useState<'self' | 'manager' | null>(null);
  const name = r.employee.name[language];
  useBreadcrumbs([...(canReadBeyondOwn ? [{ label: t('tabs.reviews'), to: performancePaths.reviews }] : []), { label: `${name} · ${r.cycle.name[language]}` }]);
  const s = r.selfAssessment;
  const m = r.managerReview;
  const goalTitle = (id: string) => r.goals.find((g) => g.id === id)?.title ?? id;
  const competencyName = (id: string) => r.competencies.find((c) => c.id === id)?.name[language] ?? id;

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {name}
          </Typography>
          <Chip size="small" variant="outlined" label={r.employee.employeeNumber} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <ReviewStateChip state={r.state} />
        </Box>
        {r.can.reopen && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {s?.status === 'submitted' && (
              <Button variant="outlined" onClick={() => setReopening('self')}>
                {t('actions.reopenSelf')}
              </Button>
            )}
            {m?.status === 'submitted' && (
              <Button variant="outlined" onClick={() => setReopening('manager')}>
                {t('actions.reopenManager')}
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Panel title={t('reviews.employeeInfo')}>
          <DetailList
            items={[
              { label: t('fields.employee'), value: name },
              { label: t('fields.department'), value: r.employee.department.name[language] },
              { label: t('fields.position'), value: r.employee.position.name[language] },
              { label: t('fields.reviewer'), value: r.reviewer?.name[language] ?? '—' },
            ]}
          />
        </Panel>
        <Panel title={t('reviews.cycleInfo')}>
          <DetailList
            items={[
              { label: t('fields.cycle'), value: r.cycle.name[language] },
              { label: t('fields.status'), value: <CycleStatusChip status={r.cycle.status} /> },
              { label: t('fields.selfAssessmentDeadline'), value: formatDay(r.cycle.selfAssessmentDeadline, language) },
              { label: t('fields.managerReviewDeadline'), value: formatDay(r.cycle.managerReviewDeadline, language) },
            ]}
          />
        </Panel>
      </Box>

      <Panel title={t('reviews.goals')}>
        {r.goals.length === 0 ? (
          <Typography color="text.secondary">{t('reviews.noGoals')}</Typography>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('reviews.goals')}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('fields.goalTitle')}</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{t('fields.target')}</TableCell>
                  <TableCell>{t('fields.progress')}</TableCell>
                  <TableCell>{t('fields.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {r.goals.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.title}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{g.target}</TableCell>
                    <TableCell>
                      <ProgressBar value={g.progress} label={t('fields.progress')} />
                    </TableCell>
                    <TableCell>
                      <GoalStatusChip status={g.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <Panel title={t('reviews.selfAssessment')} subtitle={s?.submittedAt ? t('reviews.submittedAt', { when: formatTimestamp(s.submittedAt, language) }) : undefined}>
        {r.can.selfAssess ? (
          <SelfAssessmentForm key={r.selfAssessment?.status} review={r} notify={notify} />
        ) : s && s.status === 'submitted' ? (
          <DetailList
            items={[
              ...s.goalRatings.map((g) => ({ label: goalTitle(g.goalId), value: `${ratingText(g.rating, levels, language)}${g.comment ? ` · ${g.comment}` : ''}` })),
              { label: t('fields.achievements'), value: s.achievements || '—' },
              { label: t('fields.challenges'), value: s.challenges || '—' },
              { label: t('fields.employeeComments'), value: s.comments || '—' },
            ]}
          />
        ) : (
          <Typography color="text.secondary">{t('reviews.selfNotSubmitted')}</Typography>
        )}
      </Panel>

      <Panel title={t('reviews.managerReview')} subtitle={m?.submittedAt ? t('reviews.submittedBy', { name: m.reviewer?.[language] ?? '', when: formatTimestamp(m.submittedAt, language) }) : undefined}>
        {r.can.managerReview ? (
          <ManagerReviewForm key={r.managerReview?.status} review={r} notify={notify} />
        ) : m && m.status === 'submitted' ? (
          <DetailList
            items={[
              { label: t('fields.overallRating'), value: <strong>{ratingText(m.overallRating, levels, language)}</strong> },
              ...m.goalRatings.map((g) => ({ label: goalTitle(g.goalId), value: `${ratingText(g.rating, levels, language)}${g.comment ? ` · ${g.comment}` : ''}` })),
              ...m.competencyRatings.map((c) => ({ label: competencyName(c.competencyId), value: `${ratingText(c.rating, levels, language)}${c.comment ? ` · ${c.comment}` : ''}` })),
              { label: t('fields.strengths'), value: m.strengths || '—' },
              { label: t('fields.improvements'), value: m.improvements || '—' },
              { label: t('fields.development'), value: m.development || '—' },
              { label: t('fields.managerComments'), value: m.comments || '—' },
            ]}
          />
        ) : (
          <>
            <Typography color="text.secondary">{m?.status === 'draft' ? t('reviews.managerDraft') : t('reviews.managerNotSubmitted')}</Typography>
            {s?.status !== 'submitted' && canReadBeyondOwn && <Alert severity="info" sx={{ mt: 1.5 }}>{t('reviews.waitForSelf')}</Alert>}
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={reopening !== null}
        title={reopening === 'self' ? t('reviews.reopenSelfTitle') : t('reviews.reopenManagerTitle')}
        text={reopening === 'self' ? t('reviews.reopenSelfText') : t('reviews.reopenManagerText')}
        confirmLabel={t('actions.reopen')}
        pending={reopen.isPending}
        error={reopen.isError ? errorText(t, tCommon, reopen.error) : undefined}
        onConfirm={() =>
          reopening &&
          reopen.mutate(
            { id: r.id, part: reopening },
            {
              onSuccess: () => {
                setReopening(null);
                notify(t('reviews.reopened'));
              },
            },
          )
        }
        onClose={() => setReopening(null)}
      />
    </>
  );
}
