import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { ROLES, type Role } from '@/core/domain/training';
import { useAuth } from '@/core/auth/authContext';
import { DEPARTMENT_ASSIGNABLE_ROLES, EVALUABLE_ROLES, isDepartmentScoped } from '@/core/auth/trainingPolicy';
import { ROUTES } from '@/core/routes/paths';
import { fill } from '@/i18n';
import { useT } from '@/i18n/useT';
import { useDepartmentOptions } from '@/modules/departments';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterBar, FilterSelect, SearchInput } from '@/modules/shared/FilterBar';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { useListState } from '@/modules/shared/hooks/useListState';
import { PageContainer } from '@/modules/shared/PageContainer';
import { PageHeader } from '@/modules/shared/PageHeader';
import { SelectField } from '@/modules/shared/SelectField';
import { StatusChip } from '@/modules/shared/StatusChip';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { applyServerErrors, apiErrorMessage } from '@/modules/shared/utils/apiMessage';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from './hooks/useUsers';
import { userSchema, type UserFormValues } from './schemas/userSchema';
import type { UserDto, UserFilters } from './types/user';

/**
 * Users of the training directory (SuperAdmin: everyone; DepartmentAdmin: their own department). These are training
 * business records — they never create Workspace accounts or change anyone's Workspace permissions.
 */
export default function UsersPage() {
  const t = useT();
  const { actor } = useAuth();
  const feedback = useFeedback();
  const scoped = actor ? isDepartmentScoped(actor) : false;
  const list = useListState<UserFilters>({ pageSize: 10, initialSort: { sortBy: 'name', sortDirection: 'asc' } });
  const query = useUsers(list.params);
  const departments = useDepartmentOptions();
  const update = useUpdateUser();
  const [editing, setEditing] = useState<UserDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<UserDto | null>(null);
  const del = useDeleteUser();

  const toggleActive = async (user: UserDto, isActive: boolean) => {
    try {
      await update.mutateAsync({ id: user.id, input: { fullName: user.fullName, email: user.email, role: user.role, departmentId: user.departmentId, isActive } });
      feedback.success(isActive ? t.users.activated : t.users.deactivated);
    } catch (error) {
      feedback.error(apiErrorMessage(t, error));
    }
  };

  const columns: Column<UserDto>[] = [
    {
      id: 'name',
      header: t.users.columns.user,
      sortKey: 'name',
      render: (u) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <UserAvatar name={u.fullName} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {u.fullName}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {u.email}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    { id: 'role', header: t.users.columns.role, sortKey: 'role', render: (u) => <StatusChip kind="role" value={u.role} /> },
    { id: 'department', header: t.users.columns.department, sortKey: 'department', hideBelow: 'md', render: (u) => u.departmentName ?? t.common.noDepartment },
    {
      id: 'status',
      header: t.users.columns.active,
      sortKey: 'status',
      hideBelow: 'sm',
      render: (u) => (
        <FormControlLabel
          sx={{ m: 0 }}
          control={<Switch size="small" checked={u.isActive} disabled={update.isPending || u.id === actor?.userId} onChange={(_, checked) => toggleActive(u, checked)} />}
          label={u.isActive ? t.users.active : t.users.inactive}
          slotProps={{ typography: { variant: 'body2' } }}
        />
      ),
    },
    {
      id: 'actions',
      header: t.common.actions,
      align: 'right',
      width: 150,
      render: (u) => (
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          {EVALUABLE_ROLES.includes(u.role) && (
            <Tooltip title={t.users.evaluations}>
              <IconButton size="small" component={RouterLink} to={ROUTES.userEvaluations(u.id)} aria-label={`${t.users.evaluations}: ${u.fullName}`}>
                <FactCheckOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t.common.edit}>
            <IconButton size="small" aria-label={`${t.common.edit}: ${u.fullName}`} onClick={() => setEditing(u)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={u.id === actor?.userId ? t.users.cannotDeleteSelf : t.common.delete}>
            <span>
              <IconButton size="small" color="error" disabled={u.id === actor?.userId} aria-label={`${t.common.delete}: ${u.fullName}`} onClick={() => setDeleting(u)}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  const newButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
      {t.users.new}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title={t.users.title} subtitle={scoped ? t.users.subtitleDepartment : t.users.subtitle} actions={newButton} />
      <FilterBar
        search={<SearchInput value={list.searchInput} onChange={list.setSearchInput} placeholder={t.users.search} />}
        filters={
          <>
            <FilterSelect label={t.users.columns.role} value={list.filters.role} options={ROLES.map((r) => ({ value: r, label: t.roles[r] }))} onChange={(v) => list.setFilter('role', v)} />
            {!scoped && <FilterSelect label={t.users.columns.department} value={list.filters.departmentId} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} onChange={(v) => list.setFilter('departmentId', v)} />}
            <FilterSelect label={t.users.columns.active} value={list.filters.isActive} options={[{ value: 'true', label: t.users.active }, { value: 'false', label: t.users.inactive }]} onChange={(v) => list.setFilter('isActive', v)} minWidth={150} />
          </>
        }
        hasActiveFilters={list.hasActiveFilters}
        onClear={list.clearFilters}
      />
      <DataTable
        label={t.users.title}
        columns={columns}
        rows={query.data?.items}
        getRowId={(u) => u.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        hasActiveFilters={list.hasActiveFilters}
        empty={{ title: t.users.empty.title, description: t.users.empty.body, icon: <PeopleOutlinedIcon />, action: newButton }}
        emptyFiltered={{ title: t.common.noMatches, description: t.common.noMatchesBody }}
        pagination={query.data ? { page: query.data.page, pageSize: query.data.pageSize, total: query.data.total, onPageChange: list.setPage, onPageSizeChange: list.setPageSize } : undefined}
        sort={{ sortBy: list.sortBy, direction: list.sortDirection, onSort: list.setSort }}
      />
      {editing && <UserFormDialog user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(message) => feedback.success(message)} />}
      <ConfirmDialog
        open={deleting !== null}
        title={t.users.delete.title}
        message={fill(t.users.delete.message, { name: deleting?.fullName ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await del.mutateAsync(deleting.id);
          feedback.success(t.users.deleted);
        }}
        onClose={() => setDeleting(null)}
      />
    </PageContainer>
  );
}

function UserFormDialog({ user, onClose, onSaved }: { user: UserDto | null; onClose: () => void; onSaved: (message: string) => void }) {
  const t = useT();
  const { actor } = useAuth();
  const scoped = actor ? isDepartmentScoped(actor) : false;
  const departments = useDepartmentOptions();
  const create = useCreateUser();
  const update = useUpdateUser();
  const [failure, setFailure] = useState<unknown>(null);
  const roles: readonly Role[] = scoped ? DEPARTMENT_ASSIGNABLE_ROLES : ROLES;
  const { register, control, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema(t)),
    defaultValues: { fullName: user?.fullName ?? '', email: user?.email ?? '', role: user?.role ?? roles[0] ?? 'Trainee', departmentId: user?.departmentId ?? (scoped ? (actor?.departmentId ?? '') : ''), isActive: user?.isActive ?? true },
  });

  useEffect(() => setFocus('fullName'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const input = { fullName: values.fullName, email: values.email, role: values.role, departmentId: values.departmentId || null };
    try {
      if (user) await update.mutateAsync({ id: user.id, input: { ...input, isActive: values.isActive } });
      else await create.mutateAsync(input);
      onSaved(user ? t.users.saved : t.users.created);
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['fullName', 'email', 'role', 'departmentId'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={user ? t.users.edit : t.users.new} description={t.users.formNote} submitLabel={user ? t.common.save : t.common.create} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit}>
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label={t.users.fields.fullName} required autoComplete="off" error={!!errors.fullName} helperText={errors.fullName?.message} {...register('fullName')} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label={t.users.fields.email} type="email" required autoComplete="off" error={!!errors.email} helperText={errors.email?.message} {...register('email')} slotProps={{ inputLabel: { shrink: true } }} />
        <SelectField control={control} name="role" label={t.users.fields.role} required options={roles.map((r) => ({ value: r, label: t.roles[r] }))} helperText={scoped ? t.users.roleLimited : undefined} />
        <SelectField control={control} name="departmentId" label={t.users.fields.department} disabled={scoped} emptyLabel={t.common.noDepartment} options={(departments.data ?? []).map((d) => ({ value: d.id, label: d.name }))} helperText={scoped ? t.users.departmentLocked : undefined} />
        {user && (
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} disabled={user.id === actor?.userId} />} label={t.users.fields.isActive} />}
          />
        )}
      </Stack>
    </FormDialog>
  );
}
