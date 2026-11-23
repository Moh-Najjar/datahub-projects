import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect } from '@/modules/shared/ListToolbar';
import { downloadText } from '@/modules/shared/utils/download';
import { isApiError } from '@/core/api/types';
import { useExportLeaveReport, useLeaveReport, useLeaveTypes } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import { LEAVE_REPORT_TYPES, type LeaveBalance, type LeaveReportFilters, type LeaveReportType, type LeaveRequest, type UsageRow } from '@/modules/leave/types/leave';
import { formatDay, todayIso } from '@/modules/leave/utils/format';
import { errorText, fieldErrorText } from '@/modules/leave/utils/serverErrors';
import { LeaveStatusChip } from '../common/LeaveStatusChip';

const noSort = { sortBy: 'none' as const, sortDirection: 'asc' as const, toggleSort: () => undefined };

/** Leave reports (requests, balances, usage by type / department) for a period, with CSV export of the whole report. */
export function ReportsSection() {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { can } = useAuth();
  const [today] = useState(() => todayIso());
  const [type, setType] = useState<LeaveReportType>('requests');
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(`${today.slice(0, 4)}-12-31`);
  const [departmentId, setDepartmentId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const list = useListState<LeaveReportFilters, 'none'>('none');
  const filters: LeaveReportFilters = { type, from, to, departmentId, leaveTypeId };
  const query = useLeaveReport({ page: list.params.page, pageSize: list.params.pageSize, filters });
  const exporter = useExportLeaveReport();
  const types = useLeaveTypes({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const { options: departments } = useDepartmentOptions({ enabled: can('organization.departments.view') });
  const feedback = useFeedback();
  const fieldError = (field: 'from' | 'to') => (isApiError(query.error) ? fieldErrorText(t, query.error.fieldErrors?.[field]?.[0]) : undefined);
  const rangeError = fieldError('from') ?? fieldError('to');
  const n = (v: number | null) => (v === null ? t('balances.noLimit') : formatNumber(v, language, { maximumFractionDigits: 1 }));

  const requestColumns: Column<LeaveRequest, 'none'>[] = [
    { id: 'number', label: t('columns.number'), render: (r) => <Link component={RouterLink} to={leavePaths.request(r.id)} dir="ltr" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.number}</Link> },
    { id: 'employee', label: t('fields.employee'), render: (r) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{r.employee.name[language]}</Box> },
    { id: 'department', label: t('fields.department'), hideBelow: 'xl', render: (r) => r.employee.department.name[language] },
    { id: 'type', label: t('fields.leaveType'), hideBelow: 'md', render: (r) => r.leaveType.name[language] },
    { id: 'start', label: t('fields.startDate'), hideBelow: 'lg', render: (r) => formatDay(r.startDate, language) },
    { id: 'days', label: t('fields.days'), align: 'right', hideBelow: 'sm', render: (r) => n(r.days) },
    { id: 'status', label: t('fields.status'), render: (r) => <LeaveStatusChip status={r.status} /> },
  ];
  const balanceColumns: Column<LeaveBalance, 'none'>[] = [
    { id: 'employee', label: t('fields.employee'), render: (b) => <Link component={RouterLink} to={leavePaths.employeeBalances(b.employeeId, b.year)} sx={{ whiteSpace: 'nowrap' }}>{b.employee.name[language]}</Link> },
    { id: 'type', label: t('fields.leaveType'), hideBelow: 'sm', render: (b) => b.leaveType.name[language] },
    { id: 'allocated', label: t('fields.allocated'), align: 'right', hideBelow: 'md', render: (b) => n(b.allocated) },
    { id: 'used', label: t('fields.used'), align: 'right', render: (b) => n(b.used) },
    { id: 'pending', label: t('fields.pending'), align: 'right', hideBelow: 'md', render: (b) => n(b.pending) },
    { id: 'remaining', label: t('fields.remaining'), align: 'right', render: (b) => n(b.remaining) },
  ];
  const usageColumns: Column<UsageRow, 'none'>[] = [
    { id: 'key', label: type === 'by-type' ? t('fields.leaveType') : t('fields.department'), render: (u) => u.key.name[language] },
    { id: 'requests', label: t('reports.columns.requests'), align: 'right', render: (u) => n(u.requests) },
    { id: 'approved', label: t('reports.columns.approvedDays'), align: 'right', render: (u) => n(u.approvedDays) },
    { id: 'pending', label: t('reports.columns.pendingDays'), align: 'right', hideBelow: 'sm', render: (u) => n(u.pendingDays) },
    { id: 'employees', label: t('reports.columns.employees'), align: 'right', hideBelow: 'sm', render: (u) => n(u.employees) },
  ];

  const report = query.data;
  const tableQuery = <T,>(rows: T[] | undefined) => ({
    data: report && rows ? { items: rows, page: report.page, pageSize: report.pageSize, total: report.total, totalPages: report.totalPages } : undefined,
    isPending: query.isPending,
    isError: query.isError && !rangeError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  });
  const label = t(`reports.types.${type}`);
  const data = report?.data;
  const reset = () => list.setPage(1);
  const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

  return (
    <section aria-label={t('reports.title')}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
        <TextField
          select
          size="small"
          label={t('reports.type')}
          value={type}
          onChange={(e) => {
            setType(e.target.value as LeaveReportType);
            reset();
          }}
          sx={{ flex: '1 1 200px', minWidth: 180, maxWidth: { sm: 240 } }}
        >
          {LEAVE_REPORT_TYPES.map((r) => (
            <MenuItem key={r} value={r}>
              {t(`reports.types.${r}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField type="date" size="small" label={t('filters.from')} value={from} onChange={(e) => {
            setFrom(e.target.value);
            reset();
          }} error={Boolean(fieldError('from'))} helperText={fieldError('from')} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } }} slotProps={dateSlot} />
        <TextField type="date" size="small" label={t('filters.to')} value={to} onChange={(e) => {
            setTo(e.target.value);
            reset();
          }} error={Boolean(fieldError('to'))} helperText={fieldError('to')} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } }} slotProps={dateSlot} />
        {departments.length > 0 && (
          <FilterSelect label={t('fields.department')} value={departmentId} onChange={(v) => {
              setDepartmentId(v);
              reset();
            }} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />
        )}
        <FilterSelect label={t('fields.leaveType')} value={leaveTypeId} onChange={(v) => {
            setLeaveTypeId(v);
            reset();
          }} allLabel={t('filters.allTypes')} options={(types.data?.items ?? []).map((x) => ({ value: x.id, label: x.name[language] }))} />
        <Button
          variant="contained"
          startIcon={<DownloadOutlined />}
          disabled={exporter.isPending || Boolean(rangeError)}
          onClick={() =>
            exporter.mutate(
              { filters, language },
              {
                onSuccess: (csv) => {
                  downloadText(csv.fileName, csv.content);
                  feedback.notify(t('reports.exported', { rows: formatNumber(csv.rows, language) }));
                },
                onError: (error) => feedback.notify(errorText(t, tCommon, error), 'error'),
              },
            )
          }
          sx={{ ml: { sm: 'auto' } }}
        >
          {exporter.isPending ? t('reports.exporting') : t('reports.export')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {type === 'balances' ? t('reports.balancesNote', { year: from.slice(0, 4) }) : t('reports.periodNote')}
      </Typography>
      {type === 'requests' && <DataTable label={label} columns={requestColumns} getRowId={(r) => r.id} query={tableQuery(data?.type === 'requests' ? data.rows : undefined)} sort={noSort} pagination={list} filtered />}
      {type === 'balances' && <DataTable label={label} columns={balanceColumns} getRowId={(b) => `${b.employeeId}|${b.leaveType.id}`} query={tableQuery(data?.type === 'balances' ? data.rows : undefined)} sort={noSort} pagination={list} filtered />}
      {(type === 'by-type' || type === 'by-department') && <DataTable label={label} columns={usageColumns} getRowId={(u) => u.key.id} query={tableQuery(data?.type === type ? (data.rows as UsageRow[]) : undefined)} sort={noSort} pagination={list} filtered />}
      <Feedback {...feedback} />
    </section>
  );
}
