import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ROLES, type Role } from '@/core/config/permissions';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { useListState } from '@/modules/shared/hooks/useListState';
import { Panel } from '@/modules/shared/Panel';
import { useUsers } from '@/modules/users/hooks/useUsers';
import { usersPaths } from '@/modules/users/paths';
import { STATUS_COLOR } from '@/modules/users/utils/status';
import { ACCOUNT_STATUSES, type AccountStatus, type UserFilters, type UserSortField, type UserSummary } from '@/modules/users/types/users';
import { UserFormDialog } from './UserFormDialog';

/** `/users`: every portal account — search, filters, sorting and pages from the (mock) API. */
export function UserDirectory() {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const list = useListState<UserFilters, UserSortField>(language === 'ar' ? 'name.ar' : 'name.en');
  const query = useUsers(list.params);
  const { options: departments } = useDepartmentOptions();
  const [creating, setCreating] = useState(false);

  const columns: Column<UserSummary, UserSortField>[] = [
    {
      id: 'name',
      label: t('directory.user'),
      sortField: language === 'ar' ? 'name.ar' : 'name.en',
      render: (u) => (
        <Link component={RouterLink} to={usersPaths.user(u.id)} aria-label={t('directory.open', { name: u.name[language] })} sx={{ fontWeight: 600 }}>
          {u.name[language]}
        </Link>
      ),
    },
    { id: 'email', label: t('directory.email'), sortField: 'email', render: (u) => <bdi dir="ltr">{u.email}</bdi>, hideBelow: 'sm' },
    {
      id: 'employee',
      label: t('directory.employee'),
      render: (u) => (u.employee ? <bdi dir="ltr">{u.employee.employeeNumber}</bdi> : <Typography variant="body2" color="text.secondary">{t('directory.noEmployee')}</Typography>),
      hideBelow: 'md',
    },
    { id: 'role', label: t('directory.role'), sortField: 'role', render: (u) => tc(`roles.${u.role}`) },
    { id: 'department', label: t('directory.department'), render: (u) => u.employee?.department.name[language] ?? '—', hideBelow: 'lg' },
    { id: 'status', label: t('directory.status'), sortField: 'status', render: (u) => <Chip size="small" variant="outlined" color={STATUS_COLOR[u.status]} label={t(`statuses.${u.status}`)} /> },
    { id: 'lastLogin', label: t('directory.lastLogin'), sortField: 'lastLoginAt', render: (u) => (u.lastLoginAt ? formatDate(u.lastLoginAt, language, { dateStyle: 'medium', timeStyle: 'short' }) : t('directory.neverSignedIn')), hideBelow: 'lg' },
    { id: 'created', label: t('directory.created'), sortField: 'createdAt', render: (u) => formatDate(u.createdAt, language, { dateStyle: 'medium' }), hideBelow: 'xl' },
  ];

  return (
    <Panel title={t('tabs.users')} subtitle={t('subtitle')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('directory.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={t('directory.add')}
        onCreate={() => setCreating(true)}
        filters={
          <>
            <FilterSelect label={t('directory.role')} value={list.filters.role ?? ''} onChange={(v) => list.setFilter('role', (v || undefined) as Role | undefined)} allLabel={t('directory.allRoles')} options={ROLES.map((r) => ({ value: r, label: tc(`roles.${r}`) }))} />
            <FilterSelect label={t('directory.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as AccountStatus | undefined)} allLabel={t('directory.allStatuses')} options={ACCOUNT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))} />
            <FilterSelect label={t('directory.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('directory.allDepartments')} options={departments} />
          </>
        }
      />
      <Box sx={{ mt: 2 }}>
        <DataTable label={t('tabs.users')} columns={columns} getRowId={(u) => u.id} query={query} sort={list} pagination={list} filtered={list.hasFilters || Boolean(list.search)} />
      </Box>
      {creating && (
        <UserFormDialog
          user={null}
          onClose={() => setCreating(false)}
          onDone={(u) => {
            setCreating(false);
            navigate(usersPaths.user(u.id), { state: { created: u.name[language] } });
          }}
        />
      )}
    </Panel>
  );
}
