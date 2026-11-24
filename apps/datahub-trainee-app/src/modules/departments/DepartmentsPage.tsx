import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { fill } from '@/i18n';
import { useT } from '@/i18n/useT';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterBar, SearchInput } from '@/modules/shared/FilterBar';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { useListState } from '@/modules/shared/hooks/useListState';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { applyServerErrors } from '@/modules/shared/utils/apiMessage';
import { useCreateDepartment, useDeleteDepartment, useDepartments, useUpdateDepartment } from './hooks/useDepartments';
import { departmentSchema, type DepartmentFormValues } from './schemas/departmentSchema';
import type { DepartmentDto } from './types/department';

/** Departments (SuperAdmin): create, rename and delete; each shows how many users and trainings it holds. */
export default function DepartmentsPage() {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useFeedback();
  const list = useListState({ pageSize: 10, initialSort: { sortBy: 'name', sortDirection: 'asc' } });
  const query = useDepartments(list.params);
  const [editing, setEditing] = useState<DepartmentDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<DepartmentDto | null>(null);
  const del = useDeleteDepartment();

  const columns: Column<DepartmentDto>[] = [
    { id: 'name', header: t.departments.columns.name, sortKey: 'name', render: (d) => <strong>{d.name}</strong> },
    { id: 'users', header: t.departments.columns.users, sortKey: 'users', hideBelow: 'sm', align: 'right', render: (d) => (d.userCount === null ? '—' : formatNumber(d.userCount, locale)) },
    { id: 'trainings', header: t.departments.columns.trainings, sortKey: 'trainings', hideBelow: 'sm', align: 'right', render: (d) => (d.trainingCount === null ? '—' : formatNumber(d.trainingCount, locale)) },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 120,
      render: (d) => (
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title={t.common.edit}>
            <IconButton size="small" aria-label={`${t.common.edit}: ${d.name}`} onClick={() => setEditing(d)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t.common.delete}>
            <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${d.name}`} onClick={() => setDeleting(d)}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t.departments.title}
        subtitle={t.departments.subtitle}
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
            {t.departments.new}
          </Button>
        }
      />
      <FilterBar search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.departments.search} />} hasActiveFilters={list.hasActiveFilters} onClear={list.clearFilters} />
      <DataTable
        label={t.departments.title}
        columns={columns}
        rows={query.data?.items}
        getRowId={(d) => d.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        hasActiveFilters={list.hasActiveFilters}
        empty={{ title: t.departments.empty.title, description: t.departments.empty.body, icon: <ApartmentOutlinedIcon />, action: <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t.departments.new}</Button> }}
        emptyFiltered={{ title: t.common.noMatches, description: t.common.noMatchesBody }}
        pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize } : undefined}
        sort={{ sortBy: list.sortBy, direction: list.sortDirection, onSort: list.setSort }}
      />
      {editing && <DepartmentFormDialog department={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(message) => feedback.success(message)} />}
      <ConfirmDialog
        open={deleting !== null}
        title={t.departments.delete.title}
        message={fill(t.departments.delete.message, { name: deleting?.name ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          feedback.success(t.departments.deleted);
        }}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}

function DepartmentFormDialog({ department, onClose, onSaved }: { department: DepartmentDto | null; onClose: () => void; onSaved: (message: string) => void }) {
  const t = useT();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<DepartmentFormValues>({ resolver: zodResolver(departmentSchema(t)), defaultValues: { name: department?.name ?? '' } });
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => setFocus('name'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      if (department) await update.mutateAsync({ id: department.id, input: values });
      else await create.mutateAsync(values);
      onSaved(department ? t.departments.saved : t.departments.created);
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['name'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={department ? t.departments.edit : t.departments.new} submitLabel={department ? t.common.save : t.common.create} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="xs">
      <TextField label={t.departments.fields.name} required autoComplete="off" error={!!errors.name} helperText={errors.name?.message} {...register('name')} slotProps={{ inputLabel: { shrink: true } }} />
    </FormDialog>
  );
}
