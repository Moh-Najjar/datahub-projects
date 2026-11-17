import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { usePayslips } from '@/modules/payroll/hooks/usePayroll';
import { usePayrollAccess } from '@/modules/payroll/hooks/usePayrollAccess';
import { payrollPaths } from '@/modules/payroll/paths';
import type { PayslipFilters, PayslipSortField, PayslipSummary } from '@/modules/payroll/types/payroll';
import { formatDay, formatPeriod } from '@/modules/payroll/utils/format';
import { Code, Money } from '../common/Money';

/** Payslips (issued only from approved or paid runs). Organization view for payroll roles; own payslips otherwise. */
export function PayslipsSection({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const { canReadOrganization } = usePayrollAccess();
  const org = canReadOrganization && !embedded;
  const list = useListState<PayslipFilters, PayslipSortField>('periodStart', 'desc');
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const query = usePayslips({ ...list.params, sortBy }, !org);
  const { options: departments } = useDepartmentOptions({ enabled: org });

  const columns: Column<PayslipSummary, PayslipSortField>[] = [
    {
      id: 'number',
      label: t('fields.payslip'),
      sortField: 'number',
      render: (p) => (
        <Link component={RouterLink} to={payrollPaths.payslip(p.id)} underline="hover" sx={{ fontWeight: 500 }}>
          <Code>{p.number}</Code>
        </Link>
      ),
    },
    ...(org
      ? [
          { id: 'employee', label: t('fields.employee'), sortField: 'employee.name.en' as const, render: (p: PayslipSummary) => p.employee.name[language] },
          { id: 'department', label: t('fields.department'), hideBelow: 'lg' as const, render: (p: PayslipSummary) => p.employee.department.name[language] },
        ]
      : []),
    { id: 'period', label: t('fields.period'), sortField: 'periodStart', hideBelow: 'sm', render: (p) => formatPeriod(p.periodStart, language) },
    { id: 'payment', label: t('fields.paymentDate'), hideBelow: 'md', render: (p) => formatDay(p.paymentDate, language) },
    { id: 'gross', label: t('fields.gross'), align: 'right', hideBelow: 'md', render: (p) => <Money value={p.gross} currency={p.currency} /> },
    { id: 'net', label: t('fields.net'), sortField: 'net', align: 'right', render: (p) => <Money value={p.net} currency={p.currency} strong /> },
    { id: 'status', label: t('fields.paymentStatus'), hideBelow: 'sm', render: (p) => t(`paymentStatus.${p.paymentStatus}`) },
  ];

  return (
    <Stack spacing={2}>
      {!embedded && <Alert severity="info">{org ? t('payslips.hint') : t('payslips.ownHint')}</Alert>}
      <section aria-label={t('payslips.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={org ? t('payslips.search') : t('payslips.searchOwn')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          filters={
            <>
              <TextField
                size="small"
                type="month"
                label={t('fields.period')}
                value={list.filters.month ?? ''}
                onChange={(e) => list.setFilter('month', e.target.value || undefined)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
                sx={{ flex: '1 1 160px', minWidth: 150, maxWidth: { sm: 200 } }}
              />
              {org && <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />}
            </>
          }
        />
        <DataTable label={t('payslips.title')} columns={columns} getRowId={(p) => p.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
    </Stack>
  );
}
