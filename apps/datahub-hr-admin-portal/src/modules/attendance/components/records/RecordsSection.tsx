import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import type { EmployeeSummary } from '@/modules/employees';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useAttendanceAccess } from '@/modules/attendance/hooks/useAttendanceAccess';
import { useAttendanceRecords, useShifts } from '@/modules/attendance/hooks/useAttendance';
import { attendancePaths } from '@/modules/attendance/paths';
import { ATTENDANCE_STATUSES, type AttendanceFilters, type AttendanceRecord, type AttendanceSortField, type AttendanceStatus } from '@/modules/attendance/types/attendance';
import { formatDay, formatDuration, formatTime } from '@/modules/attendance/utils/format';
import { todayIso } from '@/modules/attendance/utils/time';
import { AttendanceStatusChip } from '../common/AttendanceStatusChip';
import { EmployeePicker } from '../common/EmployeePicker';
import { CreateRecordDialog, PunchDialog, RecordEditDialog } from './RecordDialogs';

type Dialog = { kind: 'in' | 'out' | 'edit'; record: AttendanceRecord } | { kind: 'create' } | null;

/** Daily records: server-side search, filters (date, department, employee, status, shift), sorting, pagination. */
export function RecordsSection() {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { can } = useAuth();
  const { canManage, scope } = useAttendanceAccess();
  const list = useListState<AttendanceFilters, AttendanceSortField>('employee.name.en');
  const [today] = useState(() => todayIso());
  const [date, setDate] = useState(today);
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const query = useAttendanceRecords({ ...list.params, sortBy, filters: { ...list.params.filters, ...(date ? { date } : {}), ...(employee ? { employeeId: employee.id } : {}) } });
  // Departments come from Organization Management (only for roles that may read the organization structure).
  const { options: departments } = useDepartmentOptions({ enabled: can('organization.departments.view') });
  const shifts = useShifts({ page: 1, pageSize: 100, sortBy: 'code', sortDirection: 'asc' });
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<Dialog>(null);

  const actions = (r: AttendanceRecord): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: attendancePaths.record(r.id) },
    { label: t('actions.viewHistory'), icon: HistoryOutlined, to: attendancePaths.employeeHistory(r.employeeId, r.date.slice(0, 7)) },
    ...(canManage
      ? [
          ...(!r.checkIn && !r.onLeave ? [{ label: t('actions.checkIn'), icon: LoginOutlined, onClick: () => setDialog({ kind: 'in', record: r }) }] : []),
          ...(r.checkIn && !r.checkOut ? [{ label: t('actions.checkOut'), icon: LogoutOutlined, onClick: () => setDialog({ kind: 'out', record: r }) }] : []),
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'edit', record: r }) },
        ]
      : []),
  ];

  const ltr = (text: string) => (
    <Box component="span" dir="ltr">
      {text}
    </Box>
  );
  const columns: Column<AttendanceRecord, AttendanceSortField>[] = [
    {
      id: 'employee',
      label: t('fields.employee'),
      sortField: 'employee.name.en',
      render: (r) => (
        <Link component={RouterLink} to={attendancePaths.record(r.id)} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {r.employee.name[language]}
        </Link>
      ),
    },
    { id: 'number', label: t('columns.number'), sortField: 'employee.employeeNumber', hideBelow: 'lg', render: (r) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{r.employee.employeeNumber}</Typography> },
    { id: 'department', label: t('fields.department'), hideBelow: 'lg', render: (r) => r.employee.department.name[language] },
    { id: 'position', label: t('fields.position'), hideBelow: 'xl', render: (r) => r.employee.position.name[language] },
    { id: 'shift', label: t('fields.shift'), hideBelow: 'xl', render: (r) => <Box component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{r.shift.code}</Box> },
    { id: 'date', label: t('fields.date'), sortField: 'date', hideBelow: date ? 'xl' : 'md', render: (r) => formatDay(r.date, language) },
    { id: 'in', label: t('fields.checkIn'), sortField: 'checkIn', hideBelow: 'sm', render: (r) => ltr(formatTime(r.checkIn, language) || '—') },
    { id: 'out', label: t('fields.checkOut'), hideBelow: 'sm', render: (r) => ltr(formatTime(r.checkOut, language) || '—') },
    { id: 'hours', label: t('columns.workingHours'), sortField: 'workedMinutes', hideBelow: 'lg', render: (r) => formatDuration(t, r.workedMinutes) || '—' },
    { id: 'late', label: t('columns.late'), sortField: 'lateMinutes', hideBelow: 'lg', render: (r) => (r.lateMinutes ? formatDuration(t, r.lateMinutes) : '—') },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (r) => <AttendanceStatusChip status={r.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (r) => <RowActions name={r.employee.name[language]} actions={actions(r)} /> },
  ];

  const hasFilters = list.hasFilters || Boolean(employee) || date !== today;

  return (
    <section aria-label={t('records.label')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('records.search')}
        hasFilters={hasFilters}
        onClear={() => {
          list.clearFilters();
          setEmployee(null);
          setDate(today);
        }}
        createLabel={canManage ? t('records.create') : undefined}
        onCreate={canManage ? () => setDialog({ kind: 'create' }) : undefined}
        filters={
          <>
            <TextField
              type="date"
              size="small"
              label={t('fields.date')}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                list.setPage(1);
              }}
              sx={{ flex: '1 1 160px', minWidth: 150, maxWidth: { sm: 200 } }}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', max: today } }}
            />
            {scope.kind !== 'own' && (
              <EmployeePicker
                label={t('fields.employee')}
                value={employee}
                size="small"
                onChange={(e) => {
                  setEmployee(e);
                  list.setPage(1);
                }}
                sx={{ flex: '1 1 220px', minWidth: 200, maxWidth: { sm: 280 } }}
              />
            )}
            {can('organization.departments.view') && (
              <FilterSelect
                label={t('fields.department')}
                value={list.filters.departmentId ?? ''}
                onChange={(v) => list.setFilter('departmentId', v || undefined)}
                allLabel={t('records.allDepartments')}
                options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))}
              />
            )}
            <FilterSelect
              label={t('fields.status')}
              value={list.filters.status ?? ''}
              onChange={(v) => list.setFilter('status', (v || undefined) as AttendanceStatus | undefined)}
              allLabel={tCommon('list.allStatuses')}
              options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
            />
            <FilterSelect
              label={t('fields.shift')}
              value={list.filters.shiftId ?? ''}
              onChange={(v) => list.setFilter('shiftId', v || undefined)}
              allLabel={t('records.allShifts')}
              options={(shifts.data?.items ?? []).map((s) => ({ value: s.id, label: s.name[language] }))}
            />
          </>
        }
      />
      <DataTable label={t('records.label')} columns={columns} getRowId={(r) => r.id} query={query} sort={list} pagination={list} filtered={hasFilters} />
      {dialog?.kind === 'in' || dialog?.kind === 'out' ? (
        <PunchDialog
          record={dialog.record}
          kind={dialog.kind}
          onClose={() => setDialog(null)}
          onDone={() => {
            feedback.notify(t(dialog.kind === 'in' ? 'punch.checkedIn' : 'punch.checkedOut'));
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.kind === 'edit' && (
        <RecordEditDialog
          record={dialog.record}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            feedback.notify(t('edit.saved'));
          }}
        />
      )}
      {dialog?.kind === 'create' && (
        <CreateRecordDialog
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setDialog(null);
            setDate(r.date);
            feedback.notify(t('edit.created'));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
