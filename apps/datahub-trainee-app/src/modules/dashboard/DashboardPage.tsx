import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PercentIcon from '@mui/icons-material/Percent';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatNumber, formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { EmptyState, ErrorState, SkeletonBlock } from '@/modules/shared/states';
import { StatCard } from '@/modules/shared/StatCard';
import { StatusChip } from '@/modules/shared/StatusChip';
import { ActivityList } from './components/ActivityList';
import { StatusBreakdownChart, TrainingProgressChart } from './components/Charts';
import { DeadlinesList } from './components/DeadlinesList';
import { useDashboard, useRecentActivity } from './hooks/useDashboard';
import type { LearnerDashboard, ManagerDashboard } from './types/dashboard';

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }} component="section" aria-label={title}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Card>
  );
}

/**
 * Role-aware overview. Managers (SuperAdmin / DepartmentAdmin) see the training programme of their scope — figures,
 * enrollments by status, progress by training, deadlines and recent activity. Learners see only their own trainings.
 */
export default function DashboardPage() {
  const t = useT();
  const { actor } = useAuth();
  const query = useDashboard();
  const data = query.data;
  const firstName = actor?.fullName.split(' ')[0] ?? '';

  return (
    <PageContainer>
      <PageHeader title={fill(t.dashboard.welcome, { name: firstName })} subtitle={data?.kind === 'manager' ? (data.scopeDepartmentName ? fill(t.dashboard.subtitleDepartment, { department: data.scopeDepartmentName }) : t.dashboard.subtitleManager) : t.dashboard.subtitleLearner} />
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {!query.isError && (data?.kind === 'learner' ? <LearnerView data={data} /> : <ManagerView data={data?.kind === 'manager' ? data : undefined} />)}
    </PageContainer>
  );
}

function ManagerView({ data }: { data: ManagerDashboard | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  const activity = useRecentActivity(8);
  const stats = data?.stats;
  const loading = !data;
  const n = (value: number | undefined) => formatNumber(value ?? 0, locale);

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.totalTrainings} value={n(stats?.totalTrainings)} icon={<SchoolOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.publishedTrainings} value={n(stats?.publishedTrainings)} icon={<PublishedWithChangesIcon />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.totalEnrollments} value={n(stats?.totalEnrollments)} icon={<AssignmentTurnedInOutlinedIcon />} tone="info" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.activeTrainees} value={n(stats?.activeTrainees)} icon={<GroupsOutlinedIcon />} tone="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.completed} value={n(stats?.completedEnrollments)} icon={<CheckCircleOutlinedIcon />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.completionRate} value={formatPercent(stats?.completionRate ?? 0, locale)} icon={<PercentIcon />} tone="secondary" />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={2.5}>
            <Section title={t.dashboard.enrollmentsByStatus}>
              {data ? data.stats.totalEnrollments > 0 ? <StatusBreakdownChart data={data.statusBreakdown} /> : <EmptyState dense title={t.dashboard.noEnrollments} /> : <SkeletonBlock lines={2} />}
            </Section>
            <Section title={t.dashboard.progressByTraining} action={<Link component={RouterLink} to={ROUTES.trainings} underline="hover" variant="body2">{t.dashboard.viewAll}</Link>}>
              {data ? data.trainingProgress.length > 0 ? <TrainingProgressChart rows={data.trainingProgress} /> : <EmptyState dense title={t.dashboard.noEnrollments} /> : <SkeletonBlock lines={4} />}
            </Section>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2.5}>
            <Section title={t.dashboard.deadlines}>{data ? data.deadlines.length > 0 ? <DeadlinesList items={data.deadlines} /> : <EmptyState dense title={t.dashboard.noDeadlines} /> : <SkeletonBlock lines={3} />}</Section>
            <Section title={t.activity.title}>
              {activity.isError ? <ErrorState dense error={activity.error} onRetry={() => activity.refetch()} /> : activity.data ? activity.data.length > 0 ? <ActivityList items={activity.data} /> : <EmptyState dense title={t.activity.empty} /> : <SkeletonBlock lines={4} />}
            </Section>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}

function LearnerView({ data }: { data: LearnerDashboard }) {
  const t = useT();
  const { locale } = useLocale();
  const activity = useRecentActivity(6);
  const n = (value: number) => formatNumber(value, locale);

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.myTrainings} value={n(data.stats.enrolled)} icon={<SchoolOutlinedIcon />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.inProgress} value={n(data.stats.inProgress)} icon={<TrendingUpIcon />} tone="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.completed} value={n(data.stats.completed)} icon={<CheckCircleOutlinedIcon />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.certificates} value={n(data.stats.certificates)} icon={<WorkspacePremiumOutlinedIcon />} tone="secondary" hint={data.stats.certificates ? undefined : t.dashboard.noCertificatesYet} />
        </Grid>
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={2.5}>
            <Section title={t.dashboard.continueLearning} action={<Link component={RouterLink} to={ROUTES.trainings} underline="hover" variant="body2">{t.dashboard.viewAll}</Link>}>
              {data.current.length === 0 ? (
                <EmptyState dense title={data.stats.enrolled === 0 ? t.dashboard.noTrainings : t.dashboard.allDone} description={data.stats.enrolled === 0 ? t.dashboard.noTrainingsBody : undefined} />
              ) : (
                <Stack spacing={2.5} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
                  {data.current.map((item) => (
                    <Box component="li" key={item.trainingId}>
                      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                        <Link component={RouterLink} to={ROUTES.training(item.trainingId)} underline="hover" color="text.primary" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                          {item.title}
                        </Link>
                        <StatusChip kind="enrollment" value={item.status} />
                      </Stack>
                      <ProgressIndicator value={item.progress} />
                    </Box>
                  ))}
                </Stack>
              )}
              {data.stats.enrolled > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
                  {fill(t.dashboard.averageProgress, { value: formatPercent(data.stats.averageProgress, locale) })}
                </Typography>
              )}
              {data.stats.certificates > 0 && (
                <Button component={RouterLink} to={ROUTES.certificates} startIcon={<WorkspacePremiumOutlinedIcon />} sx={{ mt: 1 }}>
                  {t.dashboard.viewCertificates}
                </Button>
              )}
            </Section>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={2.5}>
            <Section title={t.dashboard.deadlines}>{data.deadlines.length > 0 ? <DeadlinesList items={data.deadlines} /> : <EmptyState dense title={t.dashboard.noDeadlines} />}</Section>
            <Section title={t.activity.title}>
              {activity.isError ? <ErrorState dense error={activity.error} onRetry={() => activity.refetch()} /> : activity.data ? activity.data.length > 0 ? <ActivityList items={activity.data} /> : <EmptyState dense title={t.activity.empty} /> : <SkeletonBlock lines={3} />}
            </Section>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
