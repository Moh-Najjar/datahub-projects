import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftOutlined from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import PersonOutlineOutlined from '@mui/icons-material/PersonOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { employeePaths } from '@/modules/employees';
import { Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useAttendanceAccess } from '@/modules/attendance/hooks/useAttendanceAccess';
import { useAttendanceHistory } from '@/modules/attendance/hooks/useAttendance';
import { attendancePaths } from '@/modules/attendance/paths';
import type { AttendanceRecord, EmployeeAttendanceHistory } from '@/modules/attendance/types/attendance';
import { formatDay, formatDuration, formatMonthKey, formatTime, STATUS_TONE } from '@/modules/attendance/utils/format';
import { toMs } from '@/modules/attendance/utils/time';
import { AttendanceStatusChip } from '../common/AttendanceStatusChip';
import { EmployeePicker } from '../common/EmployeePicker';

/** `/attendance/history` — choose an employee (roles that see more than their own attendance). */
export function HistoryPicker() {
  const { t } = useTranslation('attendance');
  const navigate = useNavigate();
  return (
    <Panel title={t('history.title')} subtitle={t('history.selectHint')}>
      <EmployeePicker label={t('history.selectEmployee')} value={null} onChange={(e) => e && navigate(attendancePaths.employeeHistory(e.id))} sx={{ maxWidth: 420 }} />
    </Panel>
  );
}

/** `/attendance/history/:employeeId?month=YYYY-MM` (or "My attendance" with `employeeId="me"`). */
export function EmployeeHistory({ employeeId: fixedId }: { employeeId?: string }) {
  const { t } = useTranslation('attendance');
  const params = useParams();
  const employeeId = fixedId ?? params.employeeId ?? '';
  const [search, setSearch] = useSearchParams();
  const month = search.get('month') ?? undefined;
  const query = useAttendanceHistory(employeeId, month);
  return (
    <QueryBoundary query={query} notFoundText={t('history.notFound')} forbiddenText={t('history.forbidden')}>
      {query.data && <HistoryView history={query.data} own={employeeId === 'me'} onMonth={(m) => setSearch({ month: m }, { replace: true })} />}
    </QueryBoundary>
  );
}

function HistoryView({ history: h, own, onMonth }: { history: EmployeeAttendanceHistory; own: boolean; onMonth: (month: string) => void }) {
  const { t } = useTranslation('attendance');
  const { language } = useLanguage();
  const { can } = useAuth();
  const { scope } = useAttendanceAccess();
  const name = h.employee.name[language];
  useBreadcrumbs(own ? [] : [{ label: t('tabs.history'), to: attendancePaths.history }, { label: name }]);
  const index = h.availableMonths.indexOf(h.month);
  const older = h.availableMonths[index + 1];
  const newer = h.availableMonths[index - 1];
  const canOpenProfile = !own && (can('organization.employees.view') || can('hr.employees.view.team'));
  const flip = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

  const totals = [
    { key: 'workingDays', value: formatNumber(h.totals.workingDays, language) },
    { key: 'present', value: formatNumber(h.totals.present, language) },
    { key: 'late', value: formatNumber(h.totals.late, language) },
    { key: 'absent', value: formatNumber(h.totals.absent, language) },
    { key: 'leave', value: formatNumber(h.totals.onLeave, language) },
    { key: 'totalHours', value: formatDuration(t, h.totals.totalMinutes) || '—' },
    { key: 'averageHours', value: formatDuration(t, h.totals.averageMinutes) || '—' },
  ] as const;

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
            <Typography variant="h5" component="h2">
              {name}
            </Typography>
            <Chip size="small" variant="outlined" label={h.employee.employeeNumber} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          </Box>
          <Typography color="text.secondary">
            {h.employee.position.name[language]} · {h.employee.department.name[language]}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          {canOpenProfile && (
            <Button component={RouterLink} to={employeePaths.profile(h.employee.id)} variant="outlined" startIcon={<PersonOutlineOutlined />}>
              {t('history.openProfile')}
            </Button>
          )}
          <IconButton aria-label={t('actions.previousMonth')} disabled={!older} onClick={() => older && onMonth(older)}>
            <ChevronLeftOutlined sx={flip} />
          </IconButton>
          <TextField select size="small" label={t('history.month')} value={h.month} onChange={(e) => onMonth(e.target.value)} sx={{ minWidth: 180 }}>
            {h.availableMonths.map((m) => (
              <MenuItem key={m} value={m}>
                {formatMonthKey(m, language)}
              </MenuItem>
            ))}
          </TextField>
          <IconButton aria-label={t('actions.nextMonth')} disabled={!newer} onClick={() => newer && onMonth(newer)}>
            <ChevronRightOutlined sx={flip} />
          </IconButton>
        </Box>
      </Paper>
      {h.employee.status === 'inactive' && <Alert severity="info">{t('history.inactiveEmployee')}</Alert>}

      <Box component="section" aria-label={t('history.totals.label')}>
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' } }}>
          {totals.map((item) => (
            <Paper key={item.key} component="li" variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {t(`history.totals.${item.key}`)}
              </Typography>
              <Typography variant="h6" component="p" data-total={item.key}>
                {item.value}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      <Panel title={t('history.calendar')} subtitle={formatMonthKey(h.month, language)}>
        <MonthCalendar month={h.month} records={h.records} />
      </Panel>

      <Panel title={t('history.table')}>
        {h.records.length === 0 ? (
          <Typography color="text.secondary">{t('history.noRecords')}</Typography>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('history.table')}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.date')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', lg: 'table-cell' } }}>{t('fields.shift')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.checkIn')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.checkOut')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('columns.workingHours')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', lg: 'table-cell' } }}>{t('columns.late')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {h.records.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      {scope.kind === 'own' ? (
                        formatDay(r.date, language)
                      ) : (
                        <Link component={RouterLink} to={attendancePaths.record(r.id)}>
                          {formatDay(r.date, language)}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{r.shift.name[language]}</TableCell>
                    <TableCell dir="ltr">{formatTime(r.checkIn, language) || '—'}</TableCell>
                    <TableCell dir="ltr" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      {formatTime(r.checkOut, language) || '—'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{formatDuration(t, r.workedMinutes) || '—'}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{r.lateMinutes ? formatDuration(t, r.lateMinutes) : '—'}</TableCell>
                    <TableCell>
                      <AttendanceStatusChip status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
    </Stack>
  );
}

/** Month grid (weeks start on Sunday; mirrors in RTL because it is a CSS grid). */
function MonthCalendar({ month, records }: { month: string; records: AttendanceRecord[] }) {
  const { t } = useTranslation('attendance');
  const { language } = useLanguage();
  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);
  const { cells, weekdays } = useMemo(() => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const list: Array<string | null> = Array.from({ length: first.getDay() }, () => null);
    for (let d = 1; d <= days; d++) list.push(`${month}-${String(d).padStart(2, '0')}`);
    const fmt = new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: 'short' });
    return { cells: list, weekdays: Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2026, 10, 15 + i))) };
  }, [month, language]);
  const dayFormat = new Intl.DateTimeFormat(FORMAT_LOCALE[language], { day: 'numeric' });

  return (
    <Box>
      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.75, mb: 0.75 }}>
        {weekdays.map((w) => (
          <Typography key={w} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>
            {w}
          </Typography>
        ))}
      </Box>
      <Box component="ol" aria-label={t('history.calendar')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.75 }}>
        {cells.map((date, i) => {
          if (!date) return <Box component="li" key={`pad-${i}`} aria-hidden />;
          const r = byDate.get(date);
          const tone = r ? STATUS_TONE[r.status] : 'default';
          const label = `${formatDay(date, language, { day: 'numeric', month: 'long' })}: ${r ? t(`status.${r.status}`) : t('history.dayOff')}`;
          return (
            <Tooltip key={date} title={r ? `${t(`status.${r.status}`)}${r.checkIn ? ` · ${formatTime(r.checkIn, language)}` : ''}` : t('history.dayOff')}>
              <Box
                component="li"
                tabIndex={0}
                aria-label={label}
                data-day={date}
                data-status={r?.status ?? 'none'}
                sx={(theme) => {
                  const color = tone === 'default' ? (theme.vars ?? theme).palette.text.secondary : (theme.vars ?? theme).palette[tone].main;
                  return {
                    minHeight: { xs: 40, sm: 56 },
                    p: 0.75,
                    borderRadius: 1,
                    border: 1,
                    borderColor: r ? color : 'divider',
                    bgcolor: r ? theme.alpha(color, 0.1) : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minWidth: 0,
                  };
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {dayFormat.format(new Date(toMs(date)))}
                </Typography>
                {r && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t(`status.${r.status}`)}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
