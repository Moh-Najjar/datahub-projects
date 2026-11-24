import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/core/auth/authContext';
import { isLearnerRole } from '@/core/auth/trainingPolicy';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatNumber, formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useDepartmentOptions } from '@/modules/departments';
import { PageContainer } from '@/modules/shared/PageContainer';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { EmptyState, ErrorState, SkeletonBlock } from '@/modules/shared/states';
import { StatCard } from '@/modules/shared/StatCard';
import { StatusChip } from '@/modules/shared/StatusChip';
import { ActivityList } from './components/ActivityList';
import { StatusDonut, TrainingProgressBars } from './components/Charts';
import { DeadlinesList } from './components/DeadlinesList';
import { TrainingsTable } from './components/TrainingsTable';
import { useDashboard, useRecentActivity } from './hooks/useDashboard';
import { DASHBOARD_PERIODS, type DashboardFilters, type DashboardPeriod, type DeadlineDto, type LearnerDashboard, type ManagerDashboard, type TrainingProgressEntry } from './types/dashboard';

/** At or above this average progress every listed training counts as on track. */
const ON_TRACK_PROGRESS = 75;
const TABS = ['overview', 'deadlines', 'activity'] as const;
type DashboardTab = (typeof TABS)[number];

const isTab = (value: string | null): value is DashboardTab => TABS.includes(value as DashboardTab);
const isPeriod = (value: string | null): value is DashboardPeriod => DASHBOARD_PERIODS.includes(value as DashboardPeriod);

/** A titled card (charts, lists). */
function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card sx={{ p: { xs: 2.5, md: 4 }, minWidth: 0, height: '100%' }} component="section" aria-label={title}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 700 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Card>
  );
}

/** Pill-shaped filter select of the page header. */
function FilterSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      inputProps={{ 'aria-label': label }}
      sx={{ minWidth: 170, height: 46, borderRadius: 1.5, bgcolor: 'background.paper', fontSize: 15, fontWeight: 500, '& .MuiSelect-select': { py: 1.25 } }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

/**
 * Role-aware dashboard: a title with filters (managers), tabs — Overview, Upcoming deadlines, Recent activity — and the
 * figures of the caller's scope. Managers (SuperAdmin / DepartmentAdmin) see the training programme; learners only their
 * own trainings. Tab and filters live in the URL (`?tab=&department=&period=`), so they survive reloads and links.
 */
export default function DashboardPage() {
  const t = useT();
  const { actor } = useAuth();
  const [params, setParams] = useSearchParams();
  const isLearner = actor ? isLearnerRole(actor.role) : false;
  const canPickDepartment = actor?.role === 'SuperAdmin';

  const tab: DashboardTab = isTab(params.get('tab')) ? (params.get('tab') as DashboardTab) : 'overview';
  const filters: DashboardFilters = {
    departmentId: canPickDepartment ? params.get('department') || null : null,
    period: isPeriod(params.get('period')) ? (params.get('period') as DashboardPeriod) : 'all',
  };
  const setParam = (key: string, value: string | null) =>
    setParams(
      (current) => {
        if (value) current.set(key, value);
        else current.delete(key);
        return current;
      },
      { replace: true },
    );

  const query = useDashboard(filters);
  const data = query.data;
  const departments = useDepartmentOptions(canPickDepartment);
  const firstName = actor?.fullName.split(' ')[0] ?? '';
  const subtitle = data?.kind === 'manager' && data.scopeDepartmentName ? fill(t.dashboard.subtitleDepartment, { department: data.scopeDepartmentName }) : isLearner ? t.dashboard.subtitleLearner : t.dashboard.subtitleManager;
  const f = t.dashboard.filters;

  return (
    <PageContainer>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: { xs: 'stretch', md: 'flex-end' }, justifyContent: 'space-between', gap: 2.5, mb: 3 }}>
        <Box sx={{ minWidth: 0, flex: '1 1 280px' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 15, mb: 0.75 }}>{fill(t.dashboard.welcome, { name: firstName })}</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 30, md: 38 }, fontWeight: 800, letterSpacing: '-0.03em' }}>
            {t.dashboard.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {subtitle}
          </Typography>
        </Box>
        {!isLearner && (
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {canPickDepartment && (
              <FilterSelect
                label={f.department}
                value={filters.departmentId ?? ''}
                options={[{ value: '', label: f.allDepartments }, ...(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))]}
                onChange={(value) => setParam('department', value || null)}
              />
            )}
            <FilterSelect label={f.period} value={filters.period} options={DASHBOARD_PERIODS.map((p) => ({ value: p, label: f.periods[p] }))} onChange={(value) => setParam('period', value === 'all' ? null : value)} />
          </Stack>
        )}
      </Box>

      <Tabs value={tab} onChange={(_, next: DashboardTab) => setParam('tab', next === 'overview' ? null : next)} aria-label={t.dashboard.tabs.label} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 4, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { fontSize: 16, px: { xs: 1.5, md: 3.5 } } }}>
        {TABS.map((key) => (
          <Tab key={key} value={key} label={t.dashboard.tabs[key]} id={`dashboard-tab-${key}`} aria-controls={`dashboard-panel-${key}`} />
        ))}
      </Tabs>

      <Box role="tabpanel" id={`dashboard-panel-${tab}`} aria-labelledby={`dashboard-tab-${tab}`}>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : tab === 'deadlines' ? (
          <DeadlinesPanel deadlines={data?.deadlines} />
        ) : tab === 'activity' ? (
          <ActivityPanel departmentId={filters.departmentId} limit={isLearner ? 12 : 20} />
        ) : data?.kind === 'learner' ? (
          <LearnerOverview data={data} />
        ) : (
          <ManagerOverview data={data?.kind === 'manager' ? data : undefined} />
        )}
      </Box>
    </PageContainer>
  );
}

function DeadlinesPanel({ deadlines }: { deadlines: DeadlineDto[] | undefined }) {
  const t = useT();
  return <Section title={t.dashboard.deadlines}>{deadlines ? deadlines.length > 0 ? <DeadlinesList items={deadlines} /> : <EmptyState dense title={t.dashboard.noDeadlines} /> : <SkeletonBlock lines={4} />}</Section>;
}

function ActivityPanel({ departmentId, limit }: { departmentId: string | null; limit: number }) {
  const t = useT();
  const activity = useRecentActivity(limit, departmentId);
  return (
    <Section title={t.activity.title}>
      {activity.isError ? <ErrorState dense error={activity.error} onRetry={() => activity.refetch()} /> : activity.data ? activity.data.length > 0 ? <ActivityList items={activity.data} /> : <EmptyState dense title={t.activity.empty} /> : <SkeletonBlock lines={5} />}
    </Section>
  );
}

/** A short, computed observation about the listed trainings (never invented): the weakest one, or "on track". */
function Insight({ rows }: { rows: readonly TrainingProgressEntry[] }) {
  const t = useT();
  const { locale } = useLocale();
  const lowest = rows.reduce<TrainingProgressEntry | undefined>((min, row) => (!min || row.averageProgress < min.averageProgress ? row : min), undefined);
  if (!lowest) return null;
  const text =
    lowest.averageProgress >= ON_TRACK_PROGRESS
      ? fill(t.dashboard.insight.onTrack, { value: formatPercent(ON_TRACK_PROGRESS, locale) })
      : fill(t.dashboard.insight.lowest, { title: lowest.title, value: formatPercent(lowest.averageProgress, locale) });
  return (
    // The start-edge accent: `borderLeft` is mirrored in RTL by the Emotion cache.
    <Box sx={{ mt: 3.5, p: 2.5, borderRadius: 1.25, bgcolor: 'primary.light', borderLeft: 4, borderColor: 'primary.main' }}>
      <Typography sx={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'primary.main', mb: 0.5 }}>{t.dashboard.insight.label}</Typography>
      <Typography sx={{ color: 'text.primary', fontSize: 15, lineHeight: 1.6 }}>{text}</Typography>
    </Box>
  );
}

function ManagerOverview({ data }: { data: ManagerDashboard | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  const stats = data?.stats;
  const loading = !data;
  const n = (value: number | undefined) => formatNumber(value ?? 0, locale);
  const h = t.dashboard.hints;

  return (
    <Stack spacing={3.5}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.totalTrainings} value={n(stats?.totalTrainings)} tone="success" hint={stats && fill(h.published, { count: n(stats.publishedTrainings) })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            isLoading={loading}
            label={t.dashboard.stats.completionRate}
            value={formatPercent(stats?.completionRate ?? 0, locale)}
            tone="success"
            hint={stats && fill(h.completedOf, { completed: n(stats.completedEnrollments), total: n(stats.totalEnrollments) })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.dueSoon} value={n(stats?.dueSoon)} tone="warning" emphasis={(stats?.dueSoon ?? 0) > 0} hint={h.dueSoon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard isLoading={loading} label={t.dashboard.stats.activeTrainees} value={n(stats?.activeTrainees)} tone="info" hint={stats && fill(h.enrollments, { count: n(stats.totalEnrollments) })} />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Section title={t.dashboard.enrollmentsByStatus}>
            {data ? (
              data.stats.totalEnrollments > 0 ? (
                <>
                  <StatusDonut data={data.statusBreakdown} />
                  <Insight rows={data.trainingProgress} />
                </>
              ) : (
                <EmptyState dense title={t.dashboard.noEnrollments} />
              )
            ) : (
              <SkeletonBlock lines={4} />
            )}
          </Section>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Section title={t.dashboard.progressByTraining}>
            {data ? data.trainingProgress.length > 0 ? <TrainingProgressBars rows={data.trainingProgress} /> : <EmptyState dense title={t.dashboard.noEnrollments} /> : <SkeletonBlock lines={5} />}
          </Section>
        </Grid>
      </Grid>

      {/* The table sits directly on the page canvas (no card). */}
      <Box component="section" aria-label={t.dashboard.table.title}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography component="h2" sx={{ fontSize: 20, fontWeight: 700 }}>
            {t.dashboard.table.title}
          </Typography>
          <Link component={RouterLink} to={ROUTES.trainings} underline="hover" sx={{ fontWeight: 700 }}>
            {t.dashboard.viewAll}
          </Link>
        </Stack>
        {data ? data.trainingProgress.length > 0 ? <TrainingsTable rows={data.trainingProgress} /> : <EmptyState dense title={t.dashboard.noEnrollments} /> : <SkeletonBlock lines={5} />}
      </Box>
    </Stack>
  );
}

function LearnerOverview({ data }: { data: LearnerDashboard }) {
  const t = useT();
  const { locale } = useLocale();
  const n = (value: number) => formatNumber(value, locale);

  return (
    <Stack spacing={3.5}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.myTrainings} value={n(data.stats.enrolled)} tone="primary" hint={data.stats.enrolled ? fill(t.dashboard.hints.averageProgress, { value: formatPercent(data.stats.averageProgress, locale) }) : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.inProgress} value={n(data.stats.inProgress)} tone="warning" emphasis={data.stats.inProgress > 0} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.completed} value={n(data.stats.completed)} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard label={t.dashboard.stats.certificates} value={n(data.stats.certificates)} tone="info" hint={data.stats.certificates ? undefined : t.dashboard.noCertificatesYet} />
        </Grid>
      </Grid>
      <Section title={t.dashboard.continueLearning} action={<Link component={RouterLink} to={ROUTES.trainings} underline="hover" sx={{ fontWeight: 700 }}>{t.dashboard.viewAll}</Link>}>
        {data.current.length === 0 ? (
          <EmptyState dense title={data.stats.enrolled === 0 ? t.dashboard.noTrainings : t.dashboard.allDone} description={data.stats.enrolled === 0 ? t.dashboard.noTrainingsBody : undefined} />
        ) : (
          <Stack spacing={3} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {data.current.map((item) => (
              <Box component="li" key={item.trainingId}>
                <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Link component={RouterLink} to={ROUTES.training(item.trainingId)} underline="hover" color="text.primary" sx={{ fontWeight: 600, fontSize: 16, overflowWrap: 'break-word' }}>
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
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
  );
}
