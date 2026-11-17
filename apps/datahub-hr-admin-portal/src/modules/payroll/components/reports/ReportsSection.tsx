import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import type { Localized } from '@datahub/shared-types';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations } from '@/modules/organization';
import { FilterSelect } from '@/modules/shared/ListToolbar';
import { Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { downloadText } from '@/modules/shared/utils/download';
import { useExportReport, usePayrollEmployeeOptions, usePayrollReport } from '@/modules/payroll/hooks/usePayroll';
import { PAYROLL_REPORT_TYPES, type EmployeeOption, type PayrollReport, type PayrollReportFilters, type PayrollReportType, type ReportCell, type RunStatus } from '@/modules/payroll/types/payroll';
import { formatDay, formatPeriod } from '@/modules/payroll/utils/format';
import { addMonths, monthOf, todayIso } from '@/modules/payroll/utils/rules';
import { errorText, fieldErrorText } from '@/modules/payroll/utils/serverErrors';
import { Code, Money } from '../common/Money';

/** Payroll reports on FINAL payroll (approved and paid runs), filtered and exported as CSV in the user's language. */
export function ReportsSection() {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const thisMonth = monthOf(todayIso());
  const [filters, setFilters] = useState<PayrollReportFilters>({ type: 'summary', fromMonth: addMonths(thisMonth, -6), toMonth: addMonths(thisMonth, -1), departmentId: '', locationId: '', employeeId: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [search, setSearch] = useState('');
  const options = usePayrollEmployeeOptions(search);
  const { options: departments } = useDepartmentOptions();
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const query = usePayrollReport({ page, pageSize, filters }, true);
  const exporter = useExportReport();
  const [exported, setExported] = useState<string | null>(null);
  const set = <K extends keyof PayrollReportFilters>(key: K, value: PayrollReportFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const fieldError = (field: string) => (isApiError(query.error) ? fieldErrorText(t, query.error.fieldErrors?.[field]?.[0]) : undefined);
  const r = query.data;

  const cell = (report: PayrollReport, key: string, kind: PayrollReport['columns'][number]['kind'], v: ReportCell) => {
    if (v === null || v === undefined) return key === 'department' ? t('common.allDepartments') : '—';
    switch (kind) {
      case 'money':
        return <Money value={v as number} currency={report.currency} hideCode />;
      case 'number':
        return formatNumber(v as number, language);
      case 'localized':
        return (v as Localized<string>)[language];
      case 'month':
        return formatPeriod(v as string, language);
      case 'date':
        return formatDay(v as string, language);
      case 'status':
        return key === 'status' ? t(`runStatus.${v as RunStatus}`) : t(`deductionCategory.${v as 'loan'}` as never);
      case 'code':
        return <Code>{v as string}</Code>;
      default:
        return String(v);
    }
  };
  const numeric = (kind: string) => kind === 'money' || kind === 'number';

  return (
    <Box sx={{ display: 'grid', gap: 2.5 }}>
      <Alert severity="info">{t('reports.hint')}</Alert>
      <Panel title={t('reports.filters')}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
          <TextField select size="small" label={t('reports.type')} value={filters.type} onChange={(e) => set('type', e.target.value as PayrollReportType)} sx={{ flex: '1 1 200px', minWidth: 180, maxWidth: { sm: 260 } }}>
            {PAYROLL_REPORT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`reports.types.${type}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" type="month" label={t('reports.fromMonth')} value={filters.fromMonth} onChange={(e) => set('fromMonth', e.target.value)} error={Boolean(fieldError('fromMonth'))} helperText={fieldError('fromMonth')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } }} />
          <TextField size="small" type="month" label={t('reports.toMonth')} value={filters.toMonth} onChange={(e) => set('toMonth', e.target.value)} error={Boolean(fieldError('toMonth'))} helperText={fieldError('toMonth')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } }} />
          <FilterSelect label={t('fields.department')} value={filters.departmentId} onChange={(v) => set('departmentId', v)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />
          <FilterSelect label={t('fields.location')} value={filters.locationId} onChange={(v) => set('locationId', v)} allLabel={t('filters.allLocations')} options={(locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language] }))} />
          <Autocomplete
            size="small"
            sx={{ flex: '1 1 220px', minWidth: 200, maxWidth: { sm: 300 } }}
            options={options.data ?? []}
            value={employee}
            filterOptions={(x) => x}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            getOptionLabel={(o) => `${o.name[language]} (${o.employeeNumber})`}
            onInputChange={(_, v) => setSearch(v)}
            onChange={(_, v) => {
              setEmployee(v);
              set('employeeId', v?.id ?? '');
            }}
            renderInput={(params) => <TextField {...params} label={t('fields.employee')} placeholder={t('filters.allEmployees')} />}
          />
        </Box>
      </Panel>

      <Panel
        title={t(`reports.types.${filters.type}`)}
        subtitle={r ? t('reports.subtitle', { currency: r.currency, from: formatPeriod(filters.fromMonth, language), to: formatPeriod(filters.toMonth, language) }) : undefined}
        actions={
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlined />}
            disabled={!r || r.total === 0 || exporter.isPending}
            onClick={() =>
              exporter.mutate(filters, {
                onSuccess: (file) => {
                  downloadText(file.fileName, file.content);
                  setExported(t('reports.exported', { file: file.fileName, rows: formatNumber(file.rows, language) }));
                },
              })
            }
          >
            {t('actions.exportCsv')}
          </Button>
        }
      >
        {exported && (
          <Alert severity="success" onClose={() => setExported(null)} sx={{ mb: 2 }}>
            {exported}
          </Alert>
        )}
        {exporter.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorText(t, tCommon, exporter.error)}
          </Alert>
        )}
        {query.isError && !(isApiError(query.error) && query.error.code === 'VALIDATION') ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void query.refetch()}>
                {tCommon('actions.retry')}
              </Button>
            }
          >
            {tCommon('list.loadError')}
          </Alert>
        ) : query.isError ? (
          <Alert severity="warning">{t('reports.fixFilters')}</Alert>
        ) : !r ? (
          <>
            <Box component="span" role="status" sx={visuallyHidden}>
              {tCommon('shell.loading')}
            </Box>
            <Skeleton variant="rounded" height={240} />
          </>
        ) : (
          <Box sx={{ position: 'relative' }}>
            {query.isFetching && <LinearProgress aria-hidden sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 }} />}
            <TableContainer sx={{ position: 'relative' }}>
              <Table size="small" aria-label={t(`reports.types.${filters.type}`)} sx={{ '& .MuiTableCell-root': { px: { xs: 1, sm: 2 } } }}>
                <TableHead>
                  <TableRow>
                    {r.columns.map((c) => (
                      <TableCell key={c.key} align={numeric(c.kind) ? 'right' : undefined} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {t(`reports.columns.${c.key}` as never)}
                        {c.kind === 'money' && (
                          <Box component="span" dir="ltr" sx={{ color: 'text.secondary', fontWeight: 400, marginInlineStart: 0.5 }}>
                            ({r.currency})
                          </Box>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={r.columns.length}>
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          {t('reports.empty')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {r.rows.map((row, index) => (
                    <TableRow key={index} hover>
                      {r.columns.map((c) => (
                        <TableCell key={c.key} align={numeric(c.kind) ? 'right' : undefined}>
                          {cell(r, c.key, c.kind, row[c.key] ?? null)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                {r.total > 0 && Object.keys(r.totals).length > 0 && (
                  <TableFooter>
                    <TableRow>
                      {r.columns.map((c, i) => (
                        <TableCell key={c.key} align={numeric(c.kind) ? 'right' : undefined} sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.875rem' }}>
                          {i === 0 ? t('reports.total') : r.totals[c.key] !== undefined ? cell(r, c.key, c.kind, r.totals[c.key]!) : ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </TableContainer>
            {r.total > 0 && (
              <TablePagination
                component="div"
                count={r.total}
                page={r.page - 1}
                rowsPerPage={r.pageSize}
                rowsPerPageOptions={[10, 25, 50, 100]}
                onPageChange={(_, p) => setPage(p + 1)}
                onRowsPerPageChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                labelRowsPerPage={tCommon('list.rowsPerPage')}
                labelDisplayedRows={({ from, to, count }) => tCommon('list.displayedRows', { from: formatNumber(from, language), to: formatNumber(to, language), value: formatNumber(count, language) })}
                getItemAriaLabel={(type) => tCommon(`pagination.${type}`)}
              />
            )}
          </Box>
        )}
      </Panel>
    </Box>
  );
}
