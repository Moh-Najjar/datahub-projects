import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import { downloadText } from '@/modules/shared/utils/download';
import { FilterSelect } from '@/modules/shared/ListToolbar';
import { useAttendanceReport, useExportAttendanceReport } from '@/modules/attendance/hooks/useAttendance';
import { attendancePaths } from '@/modules/attendance/paths';
import { ATTENDANCE_STATUSES, REPORT_TYPES, type AttendanceRecord, type DepartmentReportRow, type EmployeeReportRow, type ReportFilters, type ReportType } from '@/modules/attendance/types/attendance';
import { formatDay, formatDuration, formatTime } from '@/modules/attendance/utils/format';
import { errorText, fieldErrorText, firstReason } from '@/modules/attendance/utils/serverErrors';
import { todayIso } from '@/modules/attendance/utils/time';
import { AttendanceStatusChip } from '../common/AttendanceStatusChip';

const noSort = { sortBy: 'none' as const, sortDirection: 'asc' as const, toggleSort: () => undefined };

/** Daily / monthly / department / late / absence reports with date and department filters, plus CSV export. */
export function ReportsSection() {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { can } = useAuth();
  const [today] = useState(() => todayIso());
  const [type, setType] = useState<ReportType>('daily');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [departmentId, setDepartmentId] = useState('');
  const list = useListState<ReportFilters, 'none'>('none');
  const filters: ReportFilters = { type, from, to: type === 'daily' ? from : to, departmentId };
  const query = useAttendanceReport({ page: list.params.page, pageSize: list.params.pageSize, filters });
  const exporter = useExportAttendanceReport();
  const feedback = useFeedback();
  const { options: departments } = useDepartmentOptions({ enabled: can('organization:read') });
  const rangeError = query.isError ? fieldErrorText(t, firstReason(query.error)) : undefined;

  const chooseType = (next: ReportType) => {
    setType(next);
    list.setPage(1);
    // Sensible default periods: one day, or the current month so far.
    if (next === 'daily') setFrom(today);
    else {
      setFrom(`${today.slice(0, 8)}01`);
      setTo(today);
    }
  };

  const recordColumns: Column<AttendanceRecord, 'none'>[] = [
    { id: 'employee', label: t('fields.employee'), render: (r) => <Link component={RouterLink} to={attendancePaths.record(r.id)} sx={{ whiteSpace: 'nowrap' }}>{r.employee.name[language]}</Link> },
    { id: 'number', label: t('columns.number'), hideBelow: 'md', render: (r) => <Box component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{r.employee.employeeNumber}</Box> },
    { id: 'department', label: t('fields.department'), hideBelow: 'lg', render: (r) => r.employee.department.name[language] },
    { id: 'date', label: t('fields.date'), hideBelow: type === 'daily' ? 'xl' : 'sm', render: (r) => formatDay(r.date, language) },
    { id: 'in', label: t('fields.checkIn'), hideBelow: 'sm', render: (r) => <span dir="ltr">{formatTime(r.checkIn, language) || '—'}</span> },
    { id: 'out', label: t('fields.checkOut'), hideBelow: 'md', render: (r) => <span dir="ltr">{formatTime(r.checkOut, language) || '—'}</span> },
    { id: 'hours', label: t('columns.workingHours'), hideBelow: 'md', render: (r) => formatDuration(t, r.workedMinutes) || '—' },
    { id: 'late', label: t('columns.late'), hideBelow: type === 'late' ? undefined : 'lg', render: (r) => (r.lateMinutes ? formatDuration(t, r.lateMinutes) : '—') },
    { id: 'status', label: t('fields.status'), render: (r) => <AttendanceStatusChip status={r.status} /> },
  ];
  const n = (v: number) => formatNumber(v, language);
  const monthlyColumns: Column<EmployeeReportRow, 'none'>[] = [
    { id: 'employee', label: t('fields.employee'), render: (r) => <Link component={RouterLink} to={attendancePaths.employeeHistory(r.employeeId)} sx={{ whiteSpace: 'nowrap' }}>{r.name[language]}</Link> },
    { id: 'department', label: t('fields.department'), hideBelow: 'lg', render: (r) => r.department.name[language] },
    { id: 'days', label: t('reports.columns.workingDays'), align: 'right', hideBelow: 'sm', render: (r) => n(r.workingDays) },
    { id: 'present', label: t('reports.columns.present'), align: 'right', render: (r) => n(r.present) },
    { id: 'late', label: t('reports.columns.late'), align: 'right', hideBelow: 'sm', render: (r) => n(r.late) },
    { id: 'absent', label: t('reports.columns.absent'), align: 'right', render: (r) => n(r.absent) },
    { id: 'leave', label: t('reports.columns.leave'), align: 'right', hideBelow: 'md', render: (r) => n(r.onLeave) },
    { id: 'hours', label: t('reports.columns.hours'), hideBelow: 'md', render: (r) => formatDuration(t, r.totalMinutes) || '—' },
    { id: 'average', label: t('reports.columns.average'), hideBelow: 'lg', render: (r) => formatDuration(t, r.averageMinutes) || '—' },
  ];
  const departmentColumns: Column<DepartmentReportRow, 'none'>[] = [
    { id: 'department', label: t('fields.department'), render: (r) => r.department.name[language] },
    { id: 'employees', label: t('reports.columns.employees'), align: 'right', hideBelow: 'sm', render: (r) => n(r.employees) },
    { id: 'scheduled', label: t('reports.columns.scheduled'), align: 'right', hideBelow: 'md', render: (r) => n(r.scheduled) },
    { id: 'present', label: t('reports.columns.present'), align: 'right', render: (r) => n(r.present) },
    { id: 'late', label: t('reports.columns.late'), align: 'right', hideBelow: 'sm', render: (r) => n(r.late) },
    { id: 'absent', label: t('reports.columns.absent'), align: 'right', render: (r) => n(r.absent) },
    { id: 'leave', label: t('reports.columns.leave'), align: 'right', hideBelow: 'md', render: (r) => n(r.onLeave) },
    { id: 'rate', label: t('reports.columns.rate'), align: 'right', render: (r) => (r.rate === null ? '—' : formatNumber(r.rate, language, { style: 'percent', maximumFractionDigits: 1 })) },
    { id: 'hours', label: t('reports.columns.hours'), hideBelow: 'lg', render: (r) => formatDuration(t, r.totalMinutes) || '—' },
  ];

  const report = query.data;
  const page = <T,>(rows: T[]) => ({ items: rows, page: report!.page, pageSize: report!.pageSize, total: report!.total, totalPages: report!.totalPages });
  const tableQuery = <T,>(rows: T[] | undefined) => ({ data: report && rows ? page(rows) : undefined, isPending: query.isPending, isError: query.isError && !rangeError, isFetching: query.isFetching, refetch: query.refetch });
  const label = t(`reports.types.${type}`);
  const c = report?.totals;
  const totals = c
    ? [
        { key: 'records', label: t('reports.records'), value: n(c.records) },
        ...ATTENDANCE_STATUSES.filter((s) => c[s] > 0).map((s) => ({ key: s, label: t(`status.${s}`), value: n(c[s]) })),
        { key: 'hours', label: t('reports.totalHours'), value: formatDuration(t, c.totalMinutes) || '—' },
      ]
    : [];

  return (
    <section aria-label={t('reports.title')}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
        <TextField select size="small" label={t('reports.type')} value={type} onChange={(e) => chooseType(e.target.value as ReportType)} sx={{ flex: '1 1 200px', minWidth: 180, maxWidth: { sm: 240 } }}>
          {REPORT_TYPES.map((r) => (
            <MenuItem key={r} value={r}>
              {t(`reports.types.${r}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          size="small"
          label={type === 'daily' ? t('reports.date') : t('reports.from')}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            list.setPage(1);
          }}
          sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } }}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', max: today } }}
        />
        {type !== 'daily' && (
          <TextField
            type="date"
            size="small"
            label={t('reports.to')}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              list.setPage(1);
            }}
            error={Boolean(rangeError)}
            helperText={rangeError}
            sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 190 } }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', min: from, max: today } }}
          />
        )}
        {can('organization:read') && (
          <FilterSelect
            label={t('reports.department')}
            value={departmentId}
            onChange={(v) => {
              setDepartmentId(v);
              list.setPage(1);
            }}
            allLabel={t('reports.allDepartments')}
            options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))}
          />
        )}
        <Button
          variant="contained"
          startIcon={<DownloadOutlined />}
          disabled={exporter.isPending || !report}
          onClick={() =>
            exporter.mutate(
              { filters, language },
              {
                onSuccess: (file) => {
                  downloadText(file.fileName, file.content);
                  feedback.notify(t('reports.exported', { value: n(file.rows) }));
                },
                onError: (error) => feedback.notify(errorText(t, tCommon, error), 'error'),
              },
            )
          }
          sx={{ ml: { sm: 'auto' } }}
        >
          {t('actions.export')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('reports.exportHint')}
      </Typography>
      {rangeError && <Alert severity="warning" sx={{ mb: 2 }}>{rangeError}</Alert>}

      {totals.length > 0 && (
        <Box component="ul" aria-label={t('reports.summary')} sx={{ listStyle: 'none', m: 0, p: 0, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {totals.map((item) => (
            <li key={item.key}>
              <Chip variant="outlined" label={`${item.label}: ${item.value}`} data-report-total={item.key} />
            </li>
          ))}
        </Box>
      )}

      {report?.data.type === 'monthly' ? (
        <DataTable label={label} columns={monthlyColumns} getRowId={(r) => r.employeeId} query={tableQuery(report.data.rows)} sort={noSort} pagination={list} filtered={false} />
      ) : report?.data.type === 'department' ? (
        <DataTable label={label} columns={departmentColumns} getRowId={(r) => r.department.id} query={tableQuery(report.data.rows)} sort={noSort} pagination={list} filtered={false} />
      ) : (
        <DataTable label={label} columns={recordColumns} getRowId={(r) => r.id} query={tableQuery(report && (report.data.type === 'daily' || report.data.type === 'late' || report.data.type === 'absence') ? report.data.rows : undefined)} sort={noSort} pagination={list} filtered={false} />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
