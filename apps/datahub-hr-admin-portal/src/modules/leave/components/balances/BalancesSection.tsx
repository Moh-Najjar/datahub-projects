import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useLeaveBalances, useLeaveTypes } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import type { LeaveBalance, LeaveBalanceFilters, LeaveBalanceSortField } from '@/modules/leave/types/leave';
import { balanceYears, todayIso } from '@/modules/leave/utils/format';

/** Balances per employee and leave type: remaining = allocated − used − pending (computed by the API). */
export function BalancesSection() {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { can } = useAuth();
  const [currentYear] = useState(() => Number(todayIso().slice(0, 4)));
  const list = useListState<LeaveBalanceFilters, LeaveBalanceSortField>('employee.name.en');
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const year = list.filters.year ?? String(currentYear);
  const query = useLeaveBalances({ ...list.params, sortBy, filters: { ...list.params.filters, year } });
  const types = useLeaveTypes({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const { options: departments } = useDepartmentOptions({ enabled: can('organization.departments.view') });
  const n = (v: number | null) => (v === null ? '—' : formatNumber(v, language, { maximumFractionDigits: 1 }));

  const columns: Column<LeaveBalance, LeaveBalanceSortField>[] = [
    {
      id: 'employee',
      label: t('fields.employee'),
      sortField: 'employee.name.en',
      render: (b) => (
        <Link component={RouterLink} to={leavePaths.employeeBalances(b.employeeId, b.year)} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {b.employee.name[language]}
        </Link>
      ),
    },
    { id: 'number', label: t('columns.employeeNo'), sortField: 'employee.employeeNumber', hideBelow: 'lg', render: (b) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{b.employee.employeeNumber}</Typography> },
    { id: 'department', label: t('fields.department'), hideBelow: 'xl', render: (b) => b.employee.department.name[language] },
    { id: 'type', label: t('fields.leaveType'), hideBelow: 'sm', render: (b) => b.leaveType.name[language] },
    { id: 'allocated', label: t('fields.allocated'), align: 'right', hideBelow: 'md', render: (b) => (b.allocated === null ? t('balances.noLimit') : n(b.allocated)) },
    { id: 'used', label: t('fields.used'), sortField: 'used', align: 'right', render: (b) => n(b.used) },
    { id: 'pending', label: t('fields.pending'), align: 'right', hideBelow: 'md', render: (b) => n(b.pending) },
    {
      id: 'remaining',
      label: t('fields.remaining'),
      sortField: 'remaining',
      align: 'right',
      render: (b) => (
        <Box component="span" sx={{ fontWeight: 600, color: b.remaining !== null && b.remaining <= 0 ? 'error.main' : undefined }}>
          {b.remaining === null ? t('balances.noLimit') : n(b.remaining)}
        </Box>
      ),
    },
    {
      id: 'actions',
      label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>,
      align: 'right',
      render: (b) => <RowActions name={b.employee.name[language]} actions={[{ label: t('actions.viewBalances'), icon: HistoryOutlined, to: leavePaths.employeeBalances(b.employeeId, b.year) }]} />,
    },
  ];

  return (
    <section aria-label={t('balances.title')}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('balances.formula')}
      </Typography>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('balances.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        filters={
          <>
            <FilterSelect
              label={t('fields.year')}
              value={list.filters.year ?? ''}
              onChange={(v) => list.setFilter('year', v || undefined)}
              allLabel={String(currentYear)}
              options={balanceYears(currentYear)
                .filter((y) => y !== currentYear)
                .map((y) => ({ value: String(y), label: String(y) }))}
            />
            {departments.length > 0 && (
              <FilterSelect
                label={t('fields.department')}
                value={list.filters.departmentId ?? ''}
                onChange={(v) => list.setFilter('departmentId', v || undefined)}
                allLabel={t('filters.allDepartments')}
                options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))}
              />
            )}
            <FilterSelect
              label={t('fields.leaveType')}
              value={list.filters.leaveTypeId ?? ''}
              onChange={(v) => list.setFilter('leaveTypeId', v || undefined)}
              allLabel={t('filters.allTypes')}
              options={(types.data?.items ?? []).map((x) => ({ value: x.id, label: x.name[language] }))}
            />
          </>
        }
      />
      <DataTable label={t('balances.title')} columns={columns} getRowId={(b) => `${b.employeeId}|${b.leaveType.id}`} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
    </section>
  );
}
