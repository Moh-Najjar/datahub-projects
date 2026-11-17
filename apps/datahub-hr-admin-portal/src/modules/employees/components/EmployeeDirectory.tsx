import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { formatDate } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations, usePositions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { visuallyHidden } from '@/modules/shared/styles';
import { useEmployeeAccess } from '@/modules/employees/hooks/useEmployeeAccess';
import { useEmployees } from '@/modules/employees/hooks/useEmployees';
import { useEmployeeStatusFlow } from '@/modules/employees/hooks/useEmployeeStatusFlow';
import { employeePaths } from '@/modules/employees/paths';
import { EMPLOYMENT_TYPES, type EmployeeFilters, type EmployeeSortField, type EmployeeSummary, type EmploymentStatus, type EmploymentType } from '@/modules/employees/types/employee';
import { displayName } from '@/modules/employees/utils/names';
import { EmployeeAvatar } from './EmployeeAvatar';

/** The employee directory: server-side search, filters, sorting and pagination; actions by permission. */
export function EmployeeDirectory() {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { canManage } = useEmployeeAccess();
  const list = useListState<EmployeeFilters, EmployeeSortField>('name.en');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useEmployees({ ...list.params, sortBy });
  const feedback = useFeedback();
  const status = useEmployeeStatusFlow(feedback.notify);

  // Filter options come from Organization Management. Positions narrow to the selected department.
  const { options: departmentOptions } = useDepartmentOptions();
  const positions = usePositions({ page: 1, pageSize: 100, sortBy: `title.${language}`, sortDirection: 'asc', filters: list.filters.departmentId ? { departmentId: list.filters.departmentId } : {} });
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const positionOptions = useMemo(() => (positions.data?.items ?? []).map((p) => ({ value: p.id, label: p.title[language] })), [positions.data, language]);
  const locationOptions = useMemo(() => (locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language] })), [locations.data, language]);

  const actions = (e: EmployeeSummary): RowAction[] => [
    { label: t('actions.viewProfile'), icon: VisibilityOutlined, to: employeePaths.profile(e.id) },
    ...(canManage
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => navigate(employeePaths.edit(e.id)) },
          e.status === 'active'
            ? { label: t('actions.deactivate'), icon: ToggleOffOutlined, onClick: () => status.request(e) }
            : { label: t('actions.activate'), icon: ToggleOnOutlined, onClick: () => status.request(e) },
        ]
      : []),
  ];

  const columns: Column<EmployeeSummary, EmployeeSortField>[] = [
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (e) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <EmployeeAvatar id={e.id} name={e.name} size={32} />
          <Box sx={{ minWidth: 0 }}>
            <Link component={RouterLink} to={employeePaths.profile(e.id)} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
              {displayName(e.name, language)}
            </Link>
            {/* The e-mail has its own column on extra-wide screens; below that it sits under the name. */}
            <Typography variant="caption" color="text.secondary" component="div" dir="ltr" sx={{ display: { xs: 'none', sm: 'block', xl: 'none' }, textAlign: 'start' }}>
              {e.workEmail}
            </Typography>
          </Box>
        </Box>
      ),
    },
    { id: 'number', label: t('directory.columns.number'), sortField: 'employeeNumber', hideBelow: 'sm', render: (e) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{e.employeeNumber}</Typography> },
    { id: 'email', label: t('fields.workEmail'), sortField: 'workEmail', hideBelow: 'xl', render: (e) => <Box component="span" dir="ltr">{e.workEmail}</Box> },
    { id: 'department', label: t('fields.department'), hideBelow: 'md', render: (e) => e.department.name[language] },
    { id: 'position', label: t('fields.position'), hideBelow: 'lg', render: (e) => e.position.name[language] },
    { id: 'location', label: t('fields.location'), hideBelow: 'xl', render: (e) => e.location.name[language] },
    { id: 'hireDate', label: t('fields.hireDate'), sortField: 'hireDate', hideBelow: 'lg', render: (e) => formatDate(e.hireDate, language) },
    { id: 'status', label: t('directory.columns.status'), sortField: 'status', render: (e) => <StatusChip status={e.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (e) => <RowActions name={displayName(e.name, language)} actions={actions(e)} /> },
  ];

  return (
    <section aria-label={t('directory.label')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('directory.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage ? t('directory.create') : undefined}
        onCreate={canManage ? () => navigate(employeePaths.create) : undefined}
        filters={
          <>
            <FilterSelect
              label={t('fields.department')}
              value={list.filters.departmentId ?? ''}
              onChange={(v) => {
                list.setFilter('departmentId', v || undefined);
                list.setFilter('positionId', undefined); // positions belong to departments
              }}
              allLabel={t('directory.allDepartments')}
              options={departmentOptions.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))}
            />
            <FilterSelect label={t('fields.position')} value={list.filters.positionId ?? ''} onChange={(v) => list.setFilter('positionId', v || undefined)} allLabel={t('directory.allPositions')} options={positionOptions} />
            <FilterSelect label={t('fields.location')} value={list.filters.locationId ?? ''} onChange={(v) => list.setFilter('locationId', v || undefined)} allLabel={t('directory.allLocations')} options={locationOptions} />
            <FilterSelect
              label={t('fields.status')}
              value={list.filters.status ?? ''}
              onChange={(v) => list.setFilter('status', (v || undefined) as EmploymentStatus | undefined)}
              allLabel={tCommon('list.allStatuses')}
              options={[
                { value: 'active', label: t('status.active') },
                { value: 'inactive', label: t('status.inactive') },
              ]}
            />
            <FilterSelect
              label={t('fields.employmentType')}
              value={list.filters.employmentType ?? ''}
              onChange={(v) => list.setFilter('employmentType', (v || undefined) as EmploymentType | undefined)}
              allLabel={t('directory.allTypes')}
              options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))}
            />
          </>
        }
      />
      <DataTable label={t('directory.label')} columns={columns} getRowId={(e) => e.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {status.dialog}
      <Feedback {...feedback} />
    </section>
  );
}
