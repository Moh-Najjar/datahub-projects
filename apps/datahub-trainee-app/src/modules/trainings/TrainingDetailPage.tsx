import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { isLearnerRole } from '@/core/auth/trainingPolicy';
import { useBreadcrumbTail } from '@/core/hooks/breadcrumbContext';
import { ROUTES, TRAINING_TABS, type TrainingTab } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatDate, formatNumber, formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { ErrorState } from '@/modules/shared/states';
import { StatusChip } from '@/modules/shared/StatusChip';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { AssignmentsTab } from './components/AssignmentsTab';
import { ContentTab } from './components/ContentTab';
import { TraineesTab } from './components/TraineesTab';
import { TrainingFormDialog } from './components/TrainingFormDialog';
import { useDeleteTraining, useTraining, useUpdateTraining } from './hooks/useTrainings';
import type { TrainingDto } from './types/training';

/** One training: overview, learning content, assignments and (staff) the people enrolled. Tabs are part of the URL. */
export default function TrainingDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { can, actor } = useAuth();
  const { trainingId, tab: tabParam } = useParams();
  const query = useTraining(trainingId);
  const update = useUpdateTraining();
  const del = useDeleteTraining();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const training = query.data;
  useBreadcrumbTail(training?.title);

  const canAuthor = can('trainings.manage');
  const canSubmit = !!actor && isLearnerRole(actor.role);
  const tabs: TrainingTab[] = TRAINING_TABS.filter((tab) => tab !== 'trainees' || canAuthor);
  const tab: TrainingTab = (tabParam as TrainingTab | undefined) ?? 'overview';
  if (tabParam && !tabs.includes(tab)) return <Navigate to={ROUTES.training(trainingId ?? '')} replace />;

  if (query.isError) {
    return (
      <PageContainer>
        <Button component={RouterLink} to={ROUTES.trainings} startIcon={<BackIcon />} sx={{ mb: 2 }}>
          {t.trainings.back}
        </Button>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </PageContainer>
    );
  }

  const togglePublished = async (current: TrainingDto) => {
    const publish = current.status !== 'published';
    try {
      await update.mutateAsync({ id: current.id, input: { title: current.title, description: current.description, status: publish ? 'published' : 'draft', startDate: current.startDate, endDate: current.endDate, durationHours: current.durationHours } });
      feedback.success(publish ? t.trainings.published : t.trainings.unpublished);
    } catch (error) {
      feedback.error(apiErrorMessage(t, error));
    }
  };

  const publishAction =
    training && canAuthor ? (
      <Button variant="outlined" startIcon={training.status === 'published' ? <UnpublishedOutlinedIcon /> : <PublishedWithChangesIcon />} disabled={update.isPending} onClick={() => togglePublished(training)}>
        {training.status === 'published' ? t.trainings.unpublish : t.trainings.publish}
      </Button>
    ) : null;

  return (
    <PageContainer>
      <PageHeader
        title={training?.title ?? '…'}
        subtitle={training ? [training.departmentName, training.trainerName ? fill(t.trainings.trainerBy, { name: training.trainerName }) : null].filter(Boolean).join(' · ') : undefined}
        eyebrow={training ? <StatusChip kind="training" value={training.status} /> : <Skeleton width={80} height={26} />}
        actions={
          training && canAuthor ? (
            <>
              {publishAction}
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)}>
                {t.common.edit}
              </Button>
              <Button variant="outlined" color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setDeleting(true)}>
                {t.common.delete}
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={(_, value: TrainingTab) => navigate(ROUTES.training(trainingId ?? '', value))} variant="scrollable" scrollButtons="auto" aria-label={t.trainings.tabs.label} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        {tabs.map((value) => (
          <Tab key={value} value={value} label={t.trainings.tabs[value]} id={`training-tab-${value}`} aria-controls={`training-panel-${value}`} />
        ))}
      </Tabs>

      <Box role="tabpanel" id={`training-panel-${tab}`} aria-labelledby={`training-tab-${tab}`}>
        {tab === 'overview' && <Overview training={training} />}
        {tab === 'content' && trainingId && <ContentTab trainingId={trainingId} canAuthor={canAuthor} />}
        {tab === 'assignments' && trainingId && <AssignmentsTab trainingId={trainingId} canAuthor={canAuthor} canSubmit={canSubmit} />}
        {tab === 'trainees' && trainingId && canAuthor && <TraineesTab trainingId={trainingId} />}
      </Box>

      {editing && training && <TrainingFormDialog training={training} onClose={() => setEditing(false)} onSaved={() => feedback.success(t.trainings.saved)} />}
      <ConfirmDialog
        open={deleting}
        title={t.trainings.delete.title}
        message={fill(t.trainings.delete.message, { title: training?.title ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!training) return;
          await del.mutateAsync(training.id);
          feedback.success(t.trainings.deleted);
          navigate(ROUTES.trainings, { replace: true });
        }}
        onClose={() => setDeleting(false)}
      />
    </PageContainer>
  );
}

function BackIcon() {
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  return rtl ? <ArrowForwardIcon /> : <ArrowBackIcon />;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>{children}</Typography>
    </Box>
  );
}

function Overview({ training }: { training: TrainingDto | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  const none = '—';
  if (!training) {
    return (
      <Card sx={{ p: 3 }}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rounded" height={90} sx={{ mt: 1 }} />
      </Card>
    );
  }
  const rate = training.enrollmentCount ? (training.completedCount / training.enrollmentCount) * 100 : 0;
  const mine = training.myEnrollment;

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            {t.trainings.overview.about}
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{training.description}</Typography>
          <Divider sx={{ my: 3 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Fact label={t.trainings.fields.department}>{training.departmentName ?? none}</Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Fact label={t.trainings.fields.trainer}>{training.trainerName ?? t.trainings.noTrainer}</Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Fact label={t.trainings.fields.duration}>{training.durationHours ? fill(t.trainings.hours, { count: formatNumber(training.durationHours, locale) }) : none}</Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Fact label={t.trainings.fields.startDate}>{formatDate(training.startDate, locale)}</Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Fact label={t.trainings.fields.endDate}>{formatDate(training.endDate, locale)}</Fact>
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <Fact label={t.trainings.columns.created}>{formatDate(training.createdAt, locale)}</Fact>
            </Grid>
          </Grid>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Stack spacing={2.5}>
          {mine && (
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
                {t.trainings.overview.yourProgress}
              </Typography>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <StatusChip kind="enrollment" value={mine.status} />
                {mine.completedAt && (
                  <Typography variant="body2" color="text.secondary">
                    {fill(t.trainings.overview.completedOn, { date: formatDate(mine.completedAt, locale) })}
                  </Typography>
                )}
              </Stack>
              <ProgressIndicator value={mine.progress} />
              {mine.status === 'completed' && (
                <Button component={RouterLink} to={ROUTES.certificate(mine.id)} variant="contained" startIcon={<WorkspacePremiumOutlinedIcon />} sx={{ mt: 2 }} fullWidth>
                  {t.certificates.view}
                </Button>
              )}
            </Card>
          )}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
              {t.trainings.overview.enrollment}
            </Typography>
            <Stack spacing={2}>
              <Fact label={t.trainings.columns.enrollments}>{formatNumber(training.enrollmentCount, locale)}</Fact>
              <Fact label={t.trainings.overview.completionRate}>
                {formatPercent(rate, locale)} ({formatNumber(training.completedCount, locale)})
              </Fact>
              <Fact label={t.trainings.tabs.content}>{formatNumber(training.materialCount, locale)}</Fact>
              <Fact label={t.trainings.tabs.assignments}>{formatNumber(training.assignmentCount, locale)}</Fact>
            </Stack>
          </Card>
        </Stack>
      </Grid>
    </Grid>
  );
}
