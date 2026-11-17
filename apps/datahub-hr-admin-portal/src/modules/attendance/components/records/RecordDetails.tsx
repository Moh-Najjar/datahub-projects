import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { navItem } from '@/core/routes/navigation';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useAttendanceAccess } from '@/modules/attendance/hooks/useAttendanceAccess';
import { useAttendanceRecord } from '@/modules/attendance/hooks/useAttendance';
import { attendancePaths } from '@/modules/attendance/paths';
import type { AttendanceRecord } from '@/modules/attendance/types/attendance';
import { formatClock, formatDay, formatDuration, formatTime } from '@/modules/attendance/utils/format';
import { AttendanceStatusChip } from '../common/AttendanceStatusChip';
import { PunchDialog, RecordEditDialog } from './RecordDialogs';

/** The approved leave request behind an "On leave" day (Leave Management URL from the navigation map, no module import). */
const leaveRequestPath = (id: string) => `${navItem('leave').path}/requests/${encodeURIComponent(id)}`;

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/attendance/records/:recordId` — one record with its snapshot data and (for writers) punches and correction. */
export function RecordDetails() {
  const { t } = useTranslation('attendance');
  const { recordId = '' } = useParams();
  const query = useAttendanceRecord(recordId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={attendancePaths.records} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToRecords')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('details.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <RecordView record={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function RecordView({ record: r }: { record: AttendanceRecord }) {
  const { t } = useTranslation('attendance');
  const { language } = useLanguage();
  const { canManage } = useAttendanceAccess();
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<'in' | 'out' | 'edit' | null>(null);
  const name = r.employee.name[language];
  useBreadcrumbs([{ label: t('tabs.records'), to: attendancePaths.records }, { label: `${name} · ${formatDay(r.date, language)}` }]);
  const ltr = (text: string) => (
    <Box component="span" dir="ltr">
      {text || '—'}
    </Box>
  );

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2">
            {name}
          </Typography>
          <Chip size="small" variant="outlined" label={r.employee.employeeNumber} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <AttendanceStatusChip status={r.status} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button component={RouterLink} to={attendancePaths.employeeHistory(r.employeeId, r.date.slice(0, 7))} variant="outlined" startIcon={<HistoryOutlined />}>
            {t('actions.viewHistory')}
          </Button>
          {canManage && !r.checkIn && !r.onLeave && (
            <Button variant="contained" startIcon={<LoginOutlined />} onClick={() => setDialog('in')}>
              {t('actions.checkIn')}
            </Button>
          )}
          {canManage && r.checkIn && !r.checkOut && (
            <Button variant="contained" startIcon={<LogoutOutlined />} onClick={() => setDialog('out')}>
              {t('actions.checkOut')}
            </Button>
          )}
          {canManage && (
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setDialog('edit')}>
              {t('actions.edit')}
            </Button>
          )}
        </Box>
      </Box>

      <Panel title={t('details.title')} subtitle={formatDay(r.date, language, { dateStyle: 'full' })}>
        <DetailList
          items={[
            { label: t('fields.shift'), value: `${r.shift.name[language]} (${r.shift.code})` },
            { label: t('fields.scheduled'), value: ltr(t('details.scheduled', { start: formatClock(r.shift.startTime, language), end: formatClock(r.shift.endTime, language) })) },
            { label: t('fields.checkIn'), value: ltr(r.checkIn ? `${formatTime(r.checkIn, language)} · ${formatDay(r.checkIn.slice(0, 10), language)}` : '') },
            { label: t('fields.checkOut'), value: ltr(r.checkOut ? `${formatTime(r.checkOut, language)} · ${formatDay(r.checkOut.slice(0, 10), language)}` : '') },
            { label: t('fields.workingHours'), value: formatDuration(t, r.workedMinutes) || '—' },
            { label: t('fields.lateBy'), value: r.lateMinutes ? formatDuration(t, r.lateMinutes) : '—' },
            { label: t('fields.status'), value: <AttendanceStatusChip status={r.status} /> },
            ...(r.leaveRequestId
              ? [{ label: t('fields.leaveRequest'), value: <Link component={RouterLink} to={leaveRequestPath(r.leaveRequestId)}>{t('details.viewLeaveRequest')}</Link> }]
              : []),
            { label: t('fields.note'), value: r.note || '—' },
          ]}
        />
      </Panel>

      <Panel title={t('fields.employee')} subtitle={t('details.snapshotNote')}>
        <DetailList
          items={[
            {
              label: t('fields.employee'),
              value: (
                <Link component={RouterLink} to={attendancePaths.employeeHistory(r.employeeId, r.date.slice(0, 7))}>
                  {name}
                </Link>
              ),
            },
            { label: t('fields.employeeNumber'), value: ltr(r.employee.employeeNumber) },
            { label: t('fields.department'), value: r.employee.department.name[language] },
            { label: t('fields.position'), value: r.employee.position.name[language] },
          ]}
        />
      </Panel>

      {(dialog === 'in' || dialog === 'out') && (
        <PunchDialog
          record={r}
          kind={dialog}
          onClose={() => setDialog(null)}
          onDone={() => {
            feedback.notify(t(dialog === 'in' ? 'punch.checkedIn' : 'punch.checkedOut'));
            setDialog(null);
          }}
        />
      )}
      {dialog === 'edit' && (
        <RecordEditDialog
          record={r}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            feedback.notify(t('edit.saved'));
          }}
        />
      )}
      <Feedback {...feedback} />
    </>
  );
}
