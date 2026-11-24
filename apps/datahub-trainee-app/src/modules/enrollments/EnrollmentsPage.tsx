import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from '@/core/domain/training';
import { ROUTES } from '@/core/routes/paths';
import { clampProgress, statusForProgress, withStatus } from '@/core/utils/enrollmentRules';
import { fill } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useTrainingOptions } from '@/modules/trainings';
import { useAssignableUsers } from '@/modules/users';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/modules/shared/FilterBar';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { useListState } from '@/modules/shared/hooks/useListState';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { ProgressIndicator } from '@/modules/shared/ProgressIndicator';
import { SelectField } from '@/modules/shared/SelectField';
import { StatusChip } from '@/modules/shared/StatusChip';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { applyServerErrors } from '@/modules/shared/utils/apiMessage';
import { useCreateEnrollment, useDeleteEnrollment, useEnrollments, useUpdateEnrollmentProgress, useUpdateEnrollmentStatus } from './hooks/useEnrollments';
import { enrollmentSchema, enrollmentUpdateSchema, type EnrollmentFormValues, type EnrollmentUpdateValues } from './schemas/enrollmentSchema';
import type { EnrollmentDto, EnrollmentFilters } from './types/enrollment';

/** Enrollments (SuperAdmin / DepartmentAdmin): assign trainings, update status and progress, remove. */
export default function EnrollmentsPage() {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useFeedback();
  const list = useListState<EnrollmentFilters>({ pageSize: 10 });
  const query = useEnrollments(list.params);
  const trainings = useTrainingOptions();
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState<EnrollmentDto | null>(null);
  const [removing, setRemoving] = useState<EnrollmentDto | null>(null);
  const remove = useDeleteEnrollment();

  const columns: Column<EnrollmentDto>[] = [
    {
      id: 'user',
      header: t.enrollments.columns.trainee,
      sortKey: 'user',
      render: (e) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <UserAvatar name={e.userName} size={32} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {e.userName}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {t.roles[e.userRole]}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    {
      id: 'training',
      header: t.enrollments.columns.training,
      sortKey: 'training',
      render: (e) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 500 }}>
            {e.trainingTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {e.departmentName ?? ''}
          </Typography>
        </Box>
      ),
    },
    { id: 'status', header: t.enrollments.columns.status, sortKey: 'status', render: (e) => <StatusChip kind="enrollment" value={e.status} /> },
    { id: 'progress', header: t.enrollments.columns.progress, sortKey: 'progress', hideBelow: 'sm', width: 190, render: (e) => <ProgressIndicator value={e.progress} /> },
    {
      id: 'assigned',
      header: t.enrollments.columns.assigned,
      sortKey: 'assignedAt',
      hideBelow: 'lg',
      render: (e) => (
        <Box>
          <Typography variant="body2">{formatDate(e.assignedAt, locale)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {fill(t.enrollments.assignedBy, { name: e.assignedByUserName ?? '—' })}
          </Typography>
        </Box>
      ),
    },
    { id: 'completed', header: t.enrollments.columns.completed, sortKey: 'completedAt', hideBelow: 'lg', render: (e) => formatDate(e.completedAt, locale) },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 140,
      render: (e) => (
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          {e.status === 'completed' && (
            <Tooltip title={t.certificates.view}>
              <IconButton size="small" component={RouterLink} to={ROUTES.certificate(e.id)} aria-label={`${t.certificates.view}: ${e.userName}`}>
                <WorkspacePremiumOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t.enrollments.updateProgress}>
            <IconButton size="small" aria-label={`${t.enrollments.updateProgress}: ${e.userName}`} onClick={() => setUpdating(e)}>
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.common.delete}>
            <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${e.userName}`} onClick={() => setRemoving(e)}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const assignButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAssigning(true)}>
      {t.enrollments.assign}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title={t.enrollments.title} subtitle={t.enrollments.subtitle} actions={assignButton} />
      <FilterBar
        search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.enrollments.search} />}
        filters={
          <>
            <FilterSelect label={t.enrollments.columns.training} value={list.filters.trainingId} options={(trainings.data ?? []).map((tr) => ({ value: tr.id, label: tr.title }))} onChange={(v) => list.setFilter('trainingId', v)} minWidth={220} />
            <FilterSelect label={t.enrollments.columns.status} value={list.filters.status} options={ENROLLMENT_STATUSES.map((s) => ({ value: s, label: t.enums.enrollmentStatus[s] }))} onChange={(v) => list.setFilter('status', v)} />
          </>
        }
        hasActiveFilters={list.hasActiveFilters}
        onClear={list.clearFilters}
      />
      <DataTable
        label={t.enrollments.title}
        columns={columns}
        rows={query.data?.items}
        getRowId={(e) => e.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        hasActiveFilters={list.hasActiveFilters}
        empty={{ title: t.enrollments.empty.title, description: t.enrollments.empty.body, icon: <AssignmentIndOutlinedIcon />, action: assignButton }}
        emptyFiltered={{ title: t.common.noMatches, description: t.common.noMatchesBody }}
        pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize } : undefined}
        sort={{ sortBy: list.sortBy, direction: list.sortDirection, onSort: list.setSort }}
      />
      {assigning && <AssignDialog onClose={() => setAssigning(false)} onSaved={() => feedback.success(t.enrollments.assigned)} />}
      {updating && <UpdateDialog enrollment={updating} onClose={() => setUpdating(null)} onSaved={() => feedback.success(t.enrollments.updated)} />}
      <ConfirmDialog
        open={removing !== null}
        title={t.enrollments.remove.title}
        message={fill(t.enrollments.remove.message, { user: removing?.userName ?? '', training: removing?.trainingTitle ?? '' })}
        confirmLabel={t.common.remove}
        destructive
        onConfirm={async () => {
          if (!removing) return;
          await remove.mutateAsync(removing.id);
          feedback.success(t.enrollments.removed);
        }}
        onClose={() => setRemoving(null)}
      />
    </PageContainer>
  );
}

/** Assign a training to a user: only active Intern / Trainee / Employee users and non-archived trainings are offered. */
function AssignDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const trainings = useTrainingOptions();
  const users = useAssignableUsers();
  const create = useCreateEnrollment();
  const [failure, setFailure] = useState<unknown>(null);
  const { control, handleSubmit, setError, formState: { isSubmitting } } = useForm<EnrollmentFormValues>({ resolver: zodResolver(enrollmentSchema(t)), defaultValues: { trainingId: '', userId: '' } });
  const trainingId = useWatch({ control, name: 'trainingId' });
  // Users already enrolled in the chosen training are shown but disabled (the backend refuses duplicates too).
  const enrolledForTraining = useEnrollments({ page: 1, pageSize: 500, filters: { trainingId } }, !!trainingId);
  const enrolledUserIds = useMemo(() => new Set((enrolledForTraining.data?.items ?? []).map((e) => e.userId)), [enrolledForTraining.data]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await create.mutateAsync(values);
      onSaved();
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['trainingId', 'userId'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={t.enrollments.assign} description={t.enrollments.assignNote} submitLabel={t.enrollments.assignSubmit} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit}>
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <SelectField control={control} name="trainingId" label={t.enrollments.fields.training} required emptyLabel={t.enrollments.selectTraining} options={(trainings.data ?? []).filter((tr) => tr.status !== 'archived').map((tr) => ({ value: tr.id, label: `${tr.title} — ${tr.departmentName ?? ''}` }))} />
        <SelectField
          control={control}
          name="userId"
          label={t.enrollments.fields.user}
          required
          emptyLabel={t.enrollments.selectUser}
          options={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.fullName} (${t.roles[u.role]})${enrolledUserIds.has(u.id) ? ` — ${t.enrollments.alreadyEnrolled}` : ''}`, disabled: enrolledUserIds.has(u.id) }))}
        />
      </Stack>
    </FormDialog>
  );
}

/** Update status and progress together: changing one moves the other (0 ⇒ Assigned, 1–99 ⇒ In Progress, 100 ⇒ Completed). */
function UpdateDialog({ enrollment, onClose, onSaved }: { enrollment: EnrollmentDto; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const updateStatus = useUpdateEnrollmentStatus();
  const updateProgress = useUpdateEnrollmentProgress();
  const [failure, setFailure] = useState<unknown>(null);
  const { control, setValue, getValues, handleSubmit, formState: { isSubmitting } } = useForm<EnrollmentUpdateValues>({ resolver: zodResolver(enrollmentUpdateSchema(t)), defaultValues: { status: enrollment.status, progress: enrollment.progress } });

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      // Progress and status always agree, so progress is the source of truth when it changed.
      if (values.progress !== enrollment.progress) await updateProgress.mutateAsync({ id: enrollment.id, input: { progress: values.progress } });
      else if (values.status !== enrollment.status) await updateStatus.mutateAsync({ id: enrollment.id, input: { status: values.status } });
      onSaved();
      onClose();
    } catch (error) {
      setFailure(error);
    }
  });

  return (
    <FormDialog open title={t.enrollments.updateProgress} description={`${enrollment.userName} — ${enrollment.trainingTitle}`} submitLabel={t.common.save} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit}>
      <Stack spacing={3} sx={{ pt: 1 }}>
        <SelectField
          control={control}
          name="status"
          label={t.enrollments.fields.status}
          options={ENROLLMENT_STATUSES.map((s) => ({ value: s, label: t.enums.enrollmentStatus[s] }))}
          onValueChange={(value) => setValue('progress', withStatus({ status: enrollment.status, progress: getValues('progress'), completedAt: null }, value as EnrollmentStatus, '').progress)}
        />
        <Controller
          control={control}
          name="progress"
          render={({ field }) => (
            <Box>
              <Typography id="progress-label" variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {t.enrollments.fields.progress}
              </Typography>
              <ProgressIndicator value={field.value} label={t.enrollments.fields.progress} />
              <Slider
                value={field.value}
                min={0}
                max={100}
                step={5}
                marks
                valueLabelDisplay="auto"
                aria-labelledby="progress-label"
                onChange={(_, value) => {
                  const progress = clampProgress(value as number);
                  field.onChange(progress);
                  setValue('status', statusForProgress(progress));
                }}
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        />
      </Stack>
    </FormDialog>
  );
}
