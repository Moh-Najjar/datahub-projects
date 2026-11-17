import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatDate, formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization/hooks/useDepartmentOptions';
import { useListState } from '@/modules/shared/hooks/useListState';
import { useDepartments, useUpdateDepartmentStatus } from '@/modules/organization/hooks/useOrganization';
import { useOrganizationAccess } from '@/modules/organization/hooks/useOrganizationAccess';
import { useStatusFlow } from '@/modules/organization/hooks/useStatusFlow';
import { orgPaths } from '@/modules/organization/paths';
import { TOP_LEVEL, type Department, type DepartmentFilters, type DepartmentSortField, type RecordStatus } from '@/modules/organization/types/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { visuallyHidden } from '@/modules/shared/styles';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { DepartmentFormDialog } from './DepartmentFormDialog';

/** Departments list: search, status/parent filters, sorting, pagination, and (for writers) create/edit/status. */
export function DepartmentsSection() {
  const { t } = useTranslation('organization');
  const { language } = useLanguage();
  const { canManage } = useOrganizationAccess();
  const list = useListState<DepartmentFilters, DepartmentSortField>('name.en');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useDepartments({ ...list.params, sortBy });
  const { options: parentOptions } = useDepartmentOptions();
  const feedback = useFeedback();
  const [editing, setEditing] = useState<Department | 'new' | null>(null);
  const status = useStatusFlow<Department>({
    mutation: useUpdateDepartmentStatus(),
    name: (d) => d.name[language],
    confirmTitle: (name) => t('confirm.deactivateDepartmentTitle', { name }),
    confirmText: t('confirm.deactivateDepartmentText'),
    notify: feedback.notify,
  });

  const actions = (d: Department): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: orgPaths.department(d.id) },
    ...(canManage
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setEditing(d) },
          d.status === 'active'
            ? { label: t('actions.deactivate'), icon: ToggleOffOutlined, onClick: () => status.request(d) }
            : { label: t('actions.activate'), icon: ToggleOnOutlined, onClick: () => status.request(d) },
        ]
      : []),
  ];

  const columns: Column<Department, DepartmentSortField>[] = [
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (d) => (
        <Link component={RouterLink} to={orgPaths.department(d.id)} sx={{ fontWeight: 500 }}>
          {d.name[language]}
        </Link>
      ),
    },
    { id: 'code', label: t('fields.code'), sortField: 'code', hideBelow: 'sm', render: (d) => <Typography variant="body2" dir="ltr" component="span" sx={{ fontFamily: 'monospace' }}>{d.code}</Typography> },
    { id: 'parent', label: t('fields.parent'), hideBelow: 'md', render: (d) => d.parent?.name[language] ?? t('list.none') },
    { id: 'manager', label: t('fields.manager'), hideBelow: 'sm', render: (d) => d.manager?.name[language] ?? t('list.none') },
    { id: 'employees', label: t('fields.employees'), sortField: 'employeeCount', align: 'right', render: (d) => formatNumber(d.employeeCount, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (d) => <StatusChip status={d.status} /> },
    { id: 'created', label: t('fields.createdAt'), sortField: 'createdAt', hideBelow: 'lg', render: (d) => formatDate(d.createdAt, language) },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{t('list.actions')}</Box>, align: 'right', render: (d) => <RowActions name={d.name[language]} actions={actions(d)} /> },
  ];

  return (
    <section aria-labelledby="org-departments-heading">
      <Typography id="org-departments-heading" variant="h3" component="h2" sx={visuallyHidden}>
        {t('tabs.departments')}
      </Typography>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('list.searchDepartments')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage ? t('actions.createDepartment') : undefined}
        onCreate={canManage ? () => setEditing('new') : undefined}
        filters={
          <>
            <FilterSelect
              label={t('fields.status')}
              value={list.filters.status ?? ''}
              onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)}
              allLabel={t('list.allStatuses')}
              options={[
                { value: 'active', label: t('status.active') },
                { value: 'inactive', label: t('status.inactive') },
              ]}
            />
            <FilterSelect
              label={t('fields.parent')}
              value={list.filters.parentId ?? ''}
              onChange={(v) => list.setFilter('parentId', v || undefined)}
              allLabel={t('list.allDepartments')}
              options={[{ value: TOP_LEVEL, label: t('list.topLevelOnly') }, ...parentOptions.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))]}
            />
          </>
        }
      />
      <DataTable
        label={t('tabs.departments')}
        columns={columns}
        getRowId={(d) => d.id}
        query={query}
        sort={list}
        pagination={list}
        filtered={list.hasFilters}
      />
      {editing && (
        <DepartmentFormDialog
          department={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(_, created) => {
            setEditing(null);
            feedback.notify(t(created ? 'feedback.departmentCreated' : 'feedback.departmentUpdated'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </section>
  );
}
