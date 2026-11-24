import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined';
import { useNavigate } from 'react-router-dom';
import { TRAINING_STATUSES } from '@/core/domain/training';
import { useAuth } from '@/core/auth/authContext';
import { isDepartmentScoped } from '@/core/auth/trainingPolicy';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { formatDate, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useDepartmentOptions } from '@/modules/departments';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/modules/shared/FilterBar';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { useListState } from '@/modules/shared/hooks/useListState';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { EmptyState, ErrorState, SkeletonBlock } from '@/modules/shared/states';
import { StatusChip } from '@/modules/shared/StatusChip';
import { apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { ReorderDialog } from './components/ReorderDialog';
import { TrainingFormDialog } from './components/TrainingFormDialog';
import { useDeleteTraining, useTrainings, useUpdateTraining } from './hooks/useTrainings';
import type { TrainingDto, TrainingFilters } from './types/training';

/**
 * Trainings. Managers (SuperAdmin / DepartmentAdmin) get the management table — create, edit, publish, delete and
 * manual order; learners get "My trainings": only published trainings they are enrolled in, with their progress.
 */
export default function TrainingsPage() {
  const { can } = useAuth();
  return can('trainings.manage') ? <ManageTrainings /> : <MyTrainings />;
}

function ManageTrainings() {
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { actor } = useAuth();
  const scoped = actor ? isDepartmentScoped(actor) : false;
  const list = useListState<TrainingFilters>({ pageSize: 10, initialSort: { sortBy: 'order', sortDirection: 'asc' } });
  const query = useTrainings(list.params);
  const departments = useDepartmentOptions();
  const update = useUpdateTraining();
  const del = useDeleteTraining();
  const [editing, setEditing] = useState<TrainingDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TrainingDto | null>(null);
  const [reordering, setReordering] = useState(false);

  const togglePublished = async (training: TrainingDto) => {
    const publish = training.status !== 'published';
    try {
      await update.mutateAsync({ id: training.id, input: { title: training.title, description: training.description, status: publish ? 'published' : 'draft', startDate: training.startDate, endDate: training.endDate, durationHours: training.durationHours } });
      feedback.success(publish ? t.trainings.published : t.trainings.unpublished);
    } catch (error) {
      feedback.error(apiErrorMessage(t, error));
    }
  };

  const columns: Column<TrainingDto>[] = [
    {
      id: 'title',
      header: t.trainings.columns.training,
      sortKey: 'title',
      render: (tr) => (
        <Box sx={{ minWidth: 0, maxWidth: 420 }}>
          <Typography sx={{ fontWeight: 600 }} noWrap>
            {tr.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {tr.trainerName ? fill(t.trainings.trainerBy, { name: tr.trainerName }) : t.trainings.noTrainer}
          </Typography>
        </Box>
      ),
    },
    { id: 'department', header: t.trainings.columns.department, sortKey: 'department', hideBelow: 'md', render: (tr) => tr.departmentName ?? '—' },
    { id: 'status', header: t.trainings.columns.status, sortKey: 'status', render: (tr) => <StatusChip kind="training" value={tr.status} /> },
    {
      id: 'enrollments',
      header: t.trainings.columns.enrollments,
      sortKey: 'enrollments',
      hideBelow: 'sm',
      render: (tr) => (
        <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(tr.enrollmentCount, locale)} · {fill(t.trainings.completedCount, { count: formatNumber(tr.completedCount, locale) })}
        </Typography>
      ),
    },
    { id: 'created', header: t.trainings.columns.created, sortKey: 'createdAt', hideBelow: 'lg', render: (tr) => formatDate(tr.createdAt, locale) },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 150,
      render: (tr) => (
        <Stack direction="row" onClick={(e) => e.stopPropagation()} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title={tr.status === 'published' ? t.trainings.unpublish : t.trainings.publish}>
            <IconButton size="small" disabled={update.isPending} aria-label={`${tr.status === 'published' ? t.trainings.unpublish : t.trainings.publish}: ${tr.title}`} onClick={() => togglePublished(tr)}>
              {tr.status === 'published' ? <UnpublishedOutlinedIcon fontSize="small" /> : <PublishedWithChangesIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={t.common.edit}>
            <IconButton size="small" aria-label={`${t.common.edit}: ${tr.title}`} onClick={() => setEditing(tr)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.common.delete}>
            <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${tr.title}`} onClick={() => setDeleting(tr)}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const newButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
      {t.trainings.new}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t.trainings.title}
        subtitle={scoped ? t.trainings.subtitleDepartment : t.trainings.subtitle}
        actions={
          <>
            <Button variant="outlined" startIcon={<SwapVertIcon />} onClick={() => setReordering(true)}>
              {t.trainings.reorder.open}
            </Button>
            {newButton}
          </>
        }
      />
      <FilterBar
        search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.trainings.search} />}
        filters={
          <>
            <FilterSelect label={t.trainings.columns.status} value={list.filters.status} options={TRAINING_STATUSES.map((s) => ({ value: s, label: t.enums.trainingStatus[s] }))} onChange={(v) => list.setFilter('status', v)} />
            {!scoped && <FilterSelect label={t.trainings.columns.department} value={list.filters.departmentId} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} onChange={(v) => list.setFilter('departmentId', v)} />}
          </>
        }
        hasActiveFilters={list.hasActiveFilters}
        onClear={list.clearFilters}
      />
      <DataTable
        label={t.trainings.title}
        columns={columns}
        rows={query.data?.items}
        getRowId={(tr) => tr.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        hasActiveFilters={list.hasActiveFilters}
        onRowClick={(tr) => navigate(ROUTES.training(tr.id))}
        empty={{ title: t.trainings.empty.title, description: t.trainings.empty.body, icon: <SchoolOutlinedIcon />, action: newButton }}
        emptyFiltered={{ title: t.common.noMatches, description: t.common.noMatchesBody }}
        pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize } : undefined}
        sort={{ sortBy: list.sortBy, direction: list.sortDirection, onSort: list.setSort }}
      />
      {editing && <TrainingFormDialog training={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(saved, created) => { feedback.success(created ? t.trainings.created : t.trainings.saved); if (created) navigate(ROUTES.training(saved.id)); }} />}
      {reordering && <ReorderDialog onClose={() => setReordering(false)} onSaved={() => feedback.success(t.trainings.reorder.saved)} />}
      <ConfirmDialog
        open={deleting !== null}
        title={t.trainings.delete.title}
        message={fill(t.trainings.delete.message, { title: deleting?.title ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          feedback.success(t.trainings.deleted);
        }}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}

/** The learner's own trainings as cards with progress. */
function MyTrainings() {
  const t = useT();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const list = useListState<TrainingFilters>({ pageSize: 9, initialSort: { sortBy: 'order', sortDirection: 'asc' } });
  const query = useTrainings(list.params);

  return (
    <PageContainer>
      <PageHeader title={t.trainings.myTitle} subtitle={t.trainings.mySubtitle} />
      <FilterBar search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.trainings.search} />} hasActiveFilters={list.hasActiveFilters} onClear={list.clearFilters} />
      {query.isLoading && (
        <Grid container spacing={2.5}>
          {[0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ p: 2.5 }}>
                <SkeletonBlock lines={4} />
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      {query.isError && !query.data && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && query.data.items.length === 0 && (
        <EmptyState icon={<SchoolOutlinedIcon />} title={list.hasActiveFilters ? t.common.noMatches : t.trainings.myEmpty.title} description={list.hasActiveFilters ? t.common.noMatchesBody : t.trainings.myEmpty.body} />
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <Grid container spacing={2.5}>
            {query.data.items.map((tr) => (
              <Grid key={tr.id} size={{ xs: 12, md: 6, lg: 4 }}>
                <Card sx={{ height: '100%', '&:hover': { borderColor: 'primary.main' } }}>
                  <CardActionArea onClick={() => navigate(ROUTES.training(tr.id))} sx={{ height: '100%', p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1.5 }} aria-label={tr.title}>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Chip size="small" variant="outlined" label={tr.departmentName ?? '—'} />
                      {tr.myEnrollment && <StatusChip kind="enrollment" value={tr.myEnrollment.status} />}
                    </Stack>
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                      {tr.title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                      {tr.description}
                    </Typography>
                    {tr.myEnrollment && <ProgressIndicator value={tr.myEnrollment.progress} />}
                    <Typography variant="caption" color="text.secondary">
                      {tr.trainerName ? fill(t.trainings.trainerBy, { name: tr.trainerName }) : t.trainings.noTrainer}
                      {tr.endDate ? ` · ${fill(t.trainings.endsOn, { date: formatDate(tr.endDate, locale) })}` : ''}
                    </Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
          {query.data.totalPages > 1 && (
            <Stack sx={{ alignItems: 'center', mt: 3 }}>
              <Pagination count={query.data.totalPages} page={query.data.page} onChange={(_, page) => list.setPage(page)} color="primary" />
            </Stack>
          )}
        </>
      )}
    </PageContainer>
  );
}
