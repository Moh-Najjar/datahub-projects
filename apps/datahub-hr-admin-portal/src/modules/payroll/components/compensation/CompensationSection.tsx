import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { useCompensations } from '@/modules/payroll/hooks/usePayroll';
import { payrollPaths } from '@/modules/payroll/paths';
import type { CompensationFilters, CompensationSortField, CompensationStatus, EmployeeCompensationSummary, EmploymentStatus } from '@/modules/payroll/types/payroll';
import { formatDay } from '@/modules/payroll/utils/format';
import { CompensationStatusChip } from '../common/Chips';
import { Code, Money } from '../common/Money';

/** Employee compensation (hr.payroll.view only — salaries never appear in the general employee directory). */
export function CompensationSection() {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const list = useListState<CompensationFilters, CompensationSortField>('employee.employeeNumber');
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const query = useCompensations({ ...list.params, sortBy });
  const { options: departments } = useDepartmentOptions();
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });

  const columns: Column<EmployeeCompensationSummary, CompensationSortField>[] = [
    {
      id: 'employee',
      label: t('fields.employee'),
      sortField: 'employee.name.en',
      render: (r) => (
        <Box sx={{ minWidth: 0 }}>
          <Link component={RouterLink} to={payrollPaths.employee(r.employeeId)} underline="hover" sx={{ fontWeight: 500 }}>
            {r.employee.name[language]}
          </Link>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' } }}>
            {r.employee.department.name[language]}
          </Typography>
        </Box>
      ),
    },
    { id: 'number', label: t('fields.employeeNumber'), sortField: 'employee.employeeNumber', hideBelow: 'sm', render: (r) => <Code>{r.employee.employeeNumber}</Code> },
    { id: 'department', label: t('fields.department'), hideBelow: 'md', render: (r) => r.employee.department.name[language] },
    { id: 'position', label: t('fields.position'), hideBelow: 'xl', render: (r) => r.employee.position.name[language] },
    { id: 'basic', label: t('fields.basicSalary'), sortField: 'basicSalary', align: 'right', render: (r) => (r.current ? <Money value={r.current.basicSalary} currency={r.current.currency} /> : '—') },
    { id: 'frequency', label: t('fields.payFrequency'), hideBelow: 'xl', render: (r) => (r.current ? t(`payFrequency.${r.current.payFrequency}`) : '—') },
    { id: 'effective', label: t('fields.effectiveFrom'), sortField: 'effectiveFrom', hideBelow: 'lg', render: (r) => (r.current ? formatDay(r.current.effectiveFrom, language) : '—') },
    { id: 'structure', label: t('fields.structure'), hideBelow: 'lg', render: (r) => (r.current ? <Code>{r.current.structure.code}</Code> : '—') },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (r) => <CompensationStatusChip status={r.status} /> },
  ];

  return (
    <section aria-label={t('compensation.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('compensation.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        filters={
          <>
            <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />
            <FilterSelect label={t('fields.location')} value={list.filters.locationId ?? ''} onChange={(v) => list.setFilter('locationId', v || undefined)} allLabel={t('filters.allLocations')} options={(locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language] }))} />
            <FilterSelect label={t('fields.employmentStatus')} value={list.filters.employmentStatus ?? ''} onChange={(v) => list.setFilter('employmentStatus', (v || undefined) as EmploymentStatus | undefined)} allLabel={t('filters.allEmployees')} options={(['active', 'inactive'] as const).map((s) => ({ value: s, label: t(`employmentStatus.${s}`) }))} />
            <FilterSelect label={t('fields.compensationStatus')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as CompensationStatus | undefined)} allLabel={t('filters.allStatuses')} options={(['active', 'scheduled', 'missing'] as const).map((s) => ({ value: s, label: t(`compensationStatus.${s}`) }))} />
          </>
        }
      />
      <DataTable label={t('compensation.title')} columns={columns} getRowId={(r) => r.employeeId} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
    </section>
  );
}
