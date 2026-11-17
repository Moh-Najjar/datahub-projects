import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import EditOutlined from '@mui/icons-material/EditOutlined';
import GroupAddOutlined from '@mui/icons-material/GroupAddOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { visuallyHidden } from '@/modules/shared/styles';
import { useAttendanceAccess } from '@/modules/attendance/hooks/useAttendanceAccess';
import { useShifts } from '@/modules/attendance/hooks/useAttendance';
import { useShiftStatusFlow } from '@/modules/attendance/hooks/useShiftStatusFlow';
import { attendancePaths } from '@/modules/attendance/paths';
import type { RecordStatus, Shift, ShiftFilters, ShiftSortField } from '@/modules/attendance/types/attendance';
import { formatClock, formatDuration } from '@/modules/attendance/utils/format';
import { AssignShiftDialog, ShiftFormDialog } from './ShiftDialogs';

/** Shift list: search, status filter, sorting; writers create / edit / (de)activate / assign. */
export function ShiftsSection() {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage } = useAttendanceAccess();
  const list = useListState<ShiftFilters, ShiftSortField>('startTime');
  const query = useShifts(list.params);
  const feedback = useFeedback();
  const status = useShiftStatusFlow(feedback.notify);
  const [dialog, setDialog] = useState<{ kind: 'edit'; shift?: Shift } | { kind: 'assign'; shift: Shift } | null>(null);

  const actions = (s: Shift): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: attendancePaths.shift(s.id) },
    ...(canManage
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'edit', shift: s }) },
          ...(s.status === 'active' ? [{ label: t('actions.assign'), icon: GroupAddOutlined, onClick: () => setDialog({ kind: 'assign', shift: s }) }] : []),
          s.status === 'active'
            ? { label: t('actions.deactivate'), icon: ToggleOffOutlined, onClick: () => status.request(s) }
            : { label: t('actions.activate'), icon: ToggleOnOutlined, onClick: () => status.request(s) },
        ]
      : []),
  ];

  const columns: Column<Shift, ShiftSortField>[] = [
    {
      id: 'name',
      label: t('shifts.name'),
      sortField: 'name.en',
      render: (s) => (
        <Link component={RouterLink} to={attendancePaths.shift(s.id)} sx={{ fontWeight: 500 }}>
          {s.name[language]}
        </Link>
      ),
    },
    { id: 'code', label: t('shifts.code'), sortField: 'code', hideBelow: 'lg', render: (s) => <Box component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{s.code}</Box> },
    {
      id: 'hours',
      label: t('shifts.hours'),
      sortField: 'startTime',
      render: (s) => (
        <Box sx={{ display: 'flex', alignItems: 'center', columnGap: 1, rowGap: 0.5, flexWrap: 'wrap', minWidth: 0 }}>
          <Box component="span" dir="ltr" sx={{ whiteSpace: 'nowrap' }}>
            {formatClock(s.startTime, language)}–{formatClock(s.endTime, language)}
          </Box>
          {s.overnight && (
            <Tooltip title={t('shifts.overnight')}>
              <Chip size="small" variant="outlined" label={t('shifts.nextDay')} aria-label={t('shifts.overnight')} />
            </Tooltip>
          )}
        </Box>
      ),
    },
    { id: 'break', label: t('shifts.break'), hideBelow: 'xl', render: (s) => t('shifts.minutes', { value: formatNumber(s.breakMinutes, language) }) },
    { id: 'working', label: t('shifts.working'), hideBelow: 'lg', render: (s) => formatDuration(t, s.workingMinutes) },
    { id: 'grace', label: t('shifts.grace'), hideBelow: 'xl', render: (s) => t('shifts.minutes', { value: formatNumber(s.graceMinutes, language) }) },
    { id: 'assigned', label: t('shifts.employeesShort'), sortField: 'assignedEmployees', align: 'right', hideBelow: 'md', render: (s) => formatNumber(s.assignedEmployees, language) },
    { id: 'status', label: t('shifts.status'), sortField: 'status', render: (s) => <StatusChip status={s.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (s) => <RowActions name={s.name[language]} actions={actions(s)} /> },
  ];

  return (
    <section aria-label={t('shifts.label')}>
      <Alert severity="info" icon={false} sx={{ mb: 2 }}>
        {t('shifts.examplesNote')}
      </Alert>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('shifts.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage ? t('actions.createShift') : undefined}
        onCreate={canManage ? () => setDialog({ kind: 'edit' }) : undefined}
        filters={
          <FilterSelect
            label={t('shifts.status')}
            value={list.filters.status ?? ''}
            onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)}
            allLabel={tCommon('list.allStatuses')}
            options={[
              { value: 'active', label: tCommon('status.active') },
              { value: 'inactive', label: tCommon('status.inactive') },
            ]}
          />
        }
      />
      <DataTable label={t('shifts.label')} columns={columns} getRowId={(s) => s.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {dialog?.kind === 'edit' && (
        <ShiftFormDialog
          shift={dialog.shift}
          onClose={() => setDialog(null)}
          onSaved={(created) => {
            setDialog(null);
            feedback.notify(t(created ? 'shifts.created' : 'shifts.updated'));
          }}
        />
      )}
      {dialog?.kind === 'assign' && (
        <AssignShiftDialog
          shift={dialog.shift}
          onClose={() => setDialog(null)}
          onSaved={(count) => {
            setDialog(null);
            feedback.notify(t('shifts.assigned', { value: formatNumber(count, language) }));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </section>
  );
}
