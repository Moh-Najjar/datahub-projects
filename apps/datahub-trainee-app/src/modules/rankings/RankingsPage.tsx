import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { EVALUABLE_ROLES, isDepartmentScoped } from '@/core/auth/trainingPolicy';
import { useAuth } from '@/core/auth/authContext';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatDate, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useDepartmentOptions } from '@/modules/departments';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/modules/shared/FilterBar';
import { useListState } from '@/modules/shared/hooks/useListState';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { StatusChip } from '@/modules/shared/StatusChip';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { useRankings } from './hooks/useRankings';
import type { RankingEntryDto, RankingFilters } from './types/ranking';

/**
 * Rankings (SuperAdmin / DepartmentAdmin): everyone ranked by their most recent evaluation total — the original
 * ordering — with the "Evaluate" action that opens the person's evaluation history and form.
 */
export default function RankingsPage() {
  const t = useT();
  const { locale } = useLocale();
  const { actor } = useAuth();
  const scoped = actor ? isDepartmentScoped(actor) : false;
  const list = useListState<RankingFilters>({ pageSize: 10 });
  const query = useRankings(list.params);
  const departments = useDepartmentOptions();

  const columns: Column<RankingEntryDto>[] = [
    {
      id: 'position',
      header: t.rankings.columns.position,
      width: 80,
      render: (r) =>
        r.position === null ? (
          <Typography color="text.secondary">—</Typography>
        ) : (
          <Box aria-label={fill(t.rankings.positionLabel, { position: r.position })} sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', bgcolor: r.position <= 3 ? 'primary.main' : 'grey.100', color: r.position <= 3 ? 'primary.contrastText' : 'text.primary' }}>
            {formatNumber(r.position, locale)}
          </Box>
        ),
    },
    {
      id: 'name',
      header: t.rankings.columns.trainee,
      render: (r) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <UserAvatar name={r.userName} />
          <Typography sx={{ fontWeight: 600 }}>{r.userName}</Typography>
        </Stack>
      ),
    },
    { id: 'role', header: t.rankings.columns.role, hideBelow: 'md', render: (r) => <StatusChip kind="role" value={r.role} /> },
    { id: 'department', header: t.rankings.columns.department, hideBelow: 'md', render: (r) => r.departmentName ?? t.common.noDepartment },
    {
      id: 'total',
      header: t.rankings.columns.total,
      width: 220,
      render: (r) =>
        r.latestTotal !== null && r.latestMaxTotal ? (
          <Box>
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fill(t.evaluations.totalOf, { total: formatNumber(r.latestTotal, locale), max: formatNumber(r.latestMaxTotal, locale) })}</Typography>
            <ProgressIndicator value={(r.latestTotal / r.latestMaxTotal) * 100} showValue={false} label={t.rankings.columns.total} />
          </Box>
        ) : (
          <Typography color="text.secondary">{t.rankings.notEvaluated}</Typography>
        ),
    },
    { id: 'count', header: t.rankings.columns.evaluations, hideBelow: 'sm', align: 'right', render: (r) => formatNumber(r.evaluationCount, locale) },
    { id: 'last', header: t.rankings.columns.lastEvaluated, hideBelow: 'lg', render: (r) => formatDate(r.latestEvaluatedAt, locale) },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 130,
      render: (r) => (
        <Button size="small" variant="outlined" component={RouterLink} to={ROUTES.userEvaluations(r.userId)} startIcon={<FactCheckOutlinedIcon />} aria-label={`${t.rankings.evaluate}: ${r.userName}`}>
          {t.rankings.evaluate}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title={t.rankings.title} subtitle={t.rankings.subtitle} />
      <FilterBar
        search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.rankings.search} />}
        filters={
          <>
            <FilterSelect label={t.rankings.columns.role} value={list.filters.role} options={EVALUABLE_ROLES.map((r) => ({ value: r, label: t.roles[r] }))} onChange={(v) => list.setFilter('role', v)} />
            {!scoped && <FilterSelect label={t.rankings.columns.department} value={list.filters.departmentId} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} onChange={(v) => list.setFilter('departmentId', v)} />}
          </>
        }
        hasActiveFilters={list.hasActiveFilters}
        onClear={list.clearFilters}
      />
      <DataTable
        label={t.rankings.title}
        columns={columns}
        rows={query.data?.items}
        getRowId={(r) => r.userId}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        hasActiveFilters={list.hasActiveFilters}
        empty={{ title: t.rankings.empty.title, description: t.rankings.empty.body, icon: <LeaderboardOutlinedIcon /> }}
        emptyFiltered={{ title: t.common.noMatches, description: t.common.noMatchesBody }}
        pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize } : undefined}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {t.rankings.rule}
      </Typography>
    </PageContainer>
  );
}
