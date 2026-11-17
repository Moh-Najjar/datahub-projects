import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { usePayrollAccess } from '@/modules/payroll/hooks/usePayrollAccess';
import { usePayrollRuns } from '@/modules/payroll/hooks/usePayroll';
import { payrollPaths } from '@/modules/payroll/paths';
import { RUN_STATUSES, type RunFilters, type RunSortField, type RunStatus, type RunSummary } from '@/modules/payroll/types/payroll';
import { formatDay, formatPeriod } from '@/modules/payroll/utils/format';
import { RunStatusChip } from '../common/Chips';
import { Code, Money } from '../common/Money';
import { RunFormDialog } from './RunDialogs';

/** Payroll runs: one per period and department scope (or all departments), newest first. */
export function RunsSection() {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { canWrite } = usePayrollAccess();
  const list = useListState<RunFilters, RunSortField>('periodStart', 'desc');
  const query = usePayrollRuns(list.params);
  const { options: departments } = useDepartmentOptions();
  const [creating, setCreating] = useState(false);

  const columns: Column<RunSummary, RunSortField>[] = [
    {
      id: 'number',
      label: t('fields.runNumber'),
      sortField: 'number',
      render: (r) => (
        <Link component={RouterLink} to={payrollPaths.run(r.id)} underline="hover" sx={{ fontWeight: 600 }}>
          <Code>{r.number}</Code>
        </Link>
      ),
    },
    { id: 'period', label: t('fields.period'), sortField: 'periodStart', render: (r) => formatPeriod(r.periodStart, language) },
    { id: 'department', label: t('fields.departmentScope'), hideBelow: 'sm', render: (r) => r.department?.name[language] ?? t('common.allDepartments') },
    { id: 'payment', label: t('fields.paymentDate'), sortField: 'paymentDate', hideBelow: 'lg', render: (r) => formatDay(r.paymentDate, language) },
    { id: 'employees', label: t('fields.employees'), align: 'right', hideBelow: 'md', render: (r) => (r.totals ? formatNumber(r.totals.employees, language) : '—') },
    { id: 'net', label: t('fields.net'), sortField: 'totals.net', align: 'right', hideBelow: 'md', render: (r) => (r.totals ? <Money value={r.totals.net} currency={r.currency} /> : '—') },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (r) => <RunStatusChip status={r.status} /> },
  ];

  return (
    <Stack spacing={2}>
      <section aria-label={t('runs.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('runs.search')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          createLabel={canWrite ? t('runs.create') : undefined}
          onCreate={canWrite ? () => setCreating(true) : undefined}
          filters={
            <>
              <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as RunStatus | undefined)} allLabel={t('filters.allStatuses')} options={RUN_STATUSES.map((s) => ({ value: s, label: t(`runStatus.${s}`) }))} />
              <FilterSelect label={t('fields.departmentScope')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allScopes')} options={departments.filter((d) => d.depth === 0).map((d) => ({ value: d.value, label: d.label }))} />
              <TextField
                size="small"
                type="month"
                label={t('fields.period')}
                value={list.filters.month ?? ''}
                onChange={(e) => list.setFilter('month', e.target.value || undefined)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
                sx={{ flex: '1 1 160px', minWidth: 150, maxWidth: { sm: 200 } }}
              />
            </>
          }
        />
        <DataTable label={t('runs.title')} columns={columns} getRowId={(r) => r.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('runs.workflowHint')}
        </Typography>
      </Box>
      {creating && <RunFormDialog onClose={() => setCreating(false)} onDone={(r) => navigate(payrollPaths.run(r.id), { state: { notice: t('runs.created', { number: r.number }) } })} />}
    </Stack>
  );
}
