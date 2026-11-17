import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';
import { useAttendanceAccess } from '@/modules/attendance/hooks/useAttendanceAccess';
import { useShift, useShiftMembers } from '@/modules/attendance/hooks/useAttendance';
import { useShiftStatusFlow } from '@/modules/attendance/hooks/useShiftStatusFlow';
import { attendancePaths } from '@/modules/attendance/paths';
import type { Shift } from '@/modules/attendance/types/attendance';
import { formatClock, formatDuration } from '@/modules/attendance/utils/format';
import { AssignShiftDialog, ShiftFormDialog } from './ShiftDialogs';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/attendance/shifts/:shiftId` — shift settings and the employees assigned to it. */
export function ShiftDetails() {
  const { t } = useTranslation('attendance');
  const { shiftId = '' } = useParams();
  const query = useShift(shiftId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={attendancePaths.shifts} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToShifts')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('shifts.notFound')}>
        {query.data && <ShiftView shift={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function ShiftView({ shift: s }: { shift: Shift }) {
  const { t } = useTranslation('attendance');
  const { language } = useLanguage();
  const { canManage } = useAttendanceAccess();
  const members = useShiftMembers(s.id);
  const feedback = useFeedback();
  const status = useShiftStatusFlow(feedback.notify);
  const [dialog, setDialog] = useState<'edit' | 'assign' | null>(null);
  useBreadcrumbs([{ label: t('tabs.shifts'), to: attendancePaths.shifts }, { label: s.name[language] }]);
  const days = useMemo(() => {
    const format = new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: 'long' });
    // 2026-11-15 is a Sunday (weekday 0).
    const names = s.workDays.map((d) => format.format(new Date(2026, 10, 15 + d)));
    return new Intl.ListFormat(FORMAT_LOCALE[language], { style: 'long', type: 'conjunction' }).format(names);
  }, [s.workDays, language]);

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {s.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={s.code} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <StatusChip status={s.status} />
          {s.overnight && <Chip size="small" variant="outlined" label={t('shifts.overnight')} />}
        </Box>
        {canManage && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setDialog('edit')}>
              {t('actions.edit')}
            </Button>
            {s.status === 'active' && (
              <Button variant="outlined" startIcon={<GroupAddOutlined />} onClick={() => setDialog('assign')}>
                {t('actions.assign')}
              </Button>
            )}
            <Button variant="outlined" color={s.status === 'active' ? 'error' : 'primary'} startIcon={s.status === 'active' ? <ToggleOffOutlined /> : <ToggleOnOutlined />} onClick={() => status.request(s)}>
              {s.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
            </Button>
          </Box>
        )}
      </Box>

      <Panel title={t('shifts.name')} subtitle={t('shifts.timesHint')}>
        <DetailList
          items={[
            { label: t('shifts.start'), value: <span dir="ltr">{formatClock(s.startTime, language)}</span> },
            { label: t('shifts.end'), value: <span dir="ltr">{formatClock(s.endTime, language)}</span> },
            { label: t('shifts.break'), value: t('shifts.minutes', { value: formatNumber(s.breakMinutes, language) }) },
            { label: t('shifts.working'), value: formatDuration(t, s.workingMinutes) },
            { label: t('shifts.grace'), value: t('shifts.minutes', { value: formatNumber(s.graceMinutes, language) }) },
            { label: t('shifts.workDays'), value: days },
            { label: t('shifts.assigned'), value: formatNumber(s.assignedEmployees, language) },
          ]}
        />
      </Panel>

      <Panel title={t('shifts.members')}>
        {members.data && members.data.length > 0 ? (
          <List disablePadding dense sx={{ maxHeight: 420, overflowY: 'auto' }}>
            {members.data.map((m) => (
              <ListItem key={m.employeeId} divider disableGutters>
                <ListItemText
                  primary={
                    <Link component={RouterLink} to={attendancePaths.employeeHistory(m.employeeId)}>
                      {m.name[language]}
                    </Link>
                  }
                  secondary={
                    <>
                      <span dir="ltr">{m.employeeNumber}</span> · {m.department.name[language]}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography color="text.secondary">{members.isPending ? '…' : t('shifts.noMembers')}</Typography>
        )}
      </Panel>

      {dialog === 'edit' && (
        <ShiftFormDialog
          shift={s}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            feedback.notify(t('shifts.updated'));
          }}
        />
      )}
      {dialog === 'assign' && (
        <AssignShiftDialog
          shift={s}
          onClose={() => setDialog(null)}
          onSaved={(count) => {
            setDialog(null);
            feedback.notify(t('shifts.assigned', { value: formatNumber(count, language) }));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </>
  );
}
