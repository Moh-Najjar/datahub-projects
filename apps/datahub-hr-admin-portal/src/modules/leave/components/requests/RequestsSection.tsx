import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
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
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useLeaveAccess } from '@/modules/leave/hooks/useLeaveAccess';
import { useLeaveRequests, useLeaveTypes } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import { LEAVE_STATUSES, type LeaveRequest, type LeaveRequestFilters, type LeaveRequestSortField, type LeaveStatus } from '@/modules/leave/types/leave';
import { formatDay } from '@/modules/leave/utils/format';
import { LeaveEmployeePicker, type LeaveEmployee } from '../common/LeaveEmployeePicker';
import { LeaveStatusChip } from '../common/LeaveStatusChip';
import { RequestFormDialog } from './RequestFormDialog';
import { useRequestActions } from './useRequestActions';

interface Props {
  /** "Awaiting me": only pending requests the caller may decide (computed by the API). */
  awaiting?: boolean;
  /** Fixed employee (employee leave page / profile tab): no employee filter, no department column. */
  employeeId?: string;
  /** Hide the toolbar's create button (e.g. someone else's leave). */
  allowCreate?: boolean;
}

/** Leave requests: server-side search, filters, sorting and pagination; actions as allowed by the API. */
export function RequestsSection({ awaiting = false, employeeId, allowCreate = true }: Props) {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { can } = useAuth();
  const { scope, canRequest } = useLeaveAccess();
  const list = useListState<LeaveRequestFilters, LeaveRequestSortField>(awaiting ? 'startDate' : 'submittedAt', awaiting ? 'asc' : 'desc');
  const [employee, setEmployee] = useState<LeaveEmployee | null>(null);
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const fixedEmployee = employeeId ?? employee?.id;
  const query = useLeaveRequests({
    ...list.params,
    sortBy,
    filters: { ...list.params.filters, ...(fixedEmployee ? { employeeId: fixedEmployee } : {}), ...(awaiting ? { awaitingMe: 'true' as const, status: undefined } : {}) },
  });
  const types = useLeaveTypes({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });
  const { options: departments } = useDepartmentOptions({ enabled: can('organization:read') && !employeeId });
  const feedback = useFeedback();
  const actions = useRequestActions(feedback.notify);
  const [creating, setCreating] = useState(false);
  const showEmployee = !employeeId && scope.kind !== 'own';

  const columns: Column<LeaveRequest, LeaveRequestSortField>[] = [
    {
      id: 'number',
      label: t('columns.number'),
      sortField: 'number',
      render: (r) => (
        <Link component={RouterLink} to={leavePaths.request(r.id)} dir="ltr" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {r.number}
        </Link>
      ),
    },
    ...(showEmployee
      ? [
          { id: 'employee', label: t('fields.employee'), sortField: 'employee.name.en' as const, render: (r: LeaveRequest) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{r.employee.name[language]}</Box> },
          { id: 'department', label: t('fields.department'), hideBelow: 'xl' as const, render: (r: LeaveRequest) => r.employee.department.name[language] },
        ]
      : []),
    { id: 'type', label: t('fields.leaveType'), hideBelow: 'sm', render: (r) => r.leaveType.name[language] },
    { id: 'start', label: t('fields.startDate'), sortField: 'startDate', hideBelow: 'md', render: (r) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{formatDay(r.startDate, language)}</Box> },
    { id: 'end', label: t('fields.endDate'), hideBelow: 'lg', render: (r) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{formatDay(r.endDate, language)}</Box> },
    { id: 'days', label: t('fields.days'), sortField: 'days', align: 'right', hideBelow: 'sm', render: (r) => formatNumber(r.days, language) },
    { id: 'submitted', label: t('columns.submitted'), sortField: 'submittedAt', hideBelow: 'xl', render: (r) => (r.submittedAt ? formatDay(r.submittedAt.slice(0, 10), language) : '—') },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (r) => <LeaveStatusChip status={r.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (r) => <RowActions name={r.number} actions={actions.actionsFor(r)} /> },
  ];

  const hasFilters = list.hasFilters || Boolean(employee);
  const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

  return (
    <section aria-label={awaiting ? t('tabs.approvals') : t('requests.label')}>
      {awaiting && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {scope.kind === 'team' ? t('requests.awaitingTeamHint') : t('requests.awaitingHint')}
        </Alert>
      )}
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('requests.search')}
        hasFilters={hasFilters}
        onClear={() => {
          list.clearFilters();
          setEmployee(null);
        }}
        createLabel={canRequest && allowCreate && !awaiting ? t('requests.create') : undefined}
        onCreate={canRequest && allowCreate && !awaiting ? () => setCreating(true) : undefined}
        filters={
          <>
            {showEmployee && (
              <LeaveEmployeePicker
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
            {departments.length > 0 && (
              <FilterSelect
                label={t('fields.department')}
                value={list.filters.departmentId ?? ''}
                onChange={(v) => list.setFilter('departmentId', v || undefined)}
                allLabel={t('filters.allDepartments')}
                options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))}
              />
            )}
            <FilterSelect
              label={t('fields.leaveType')}
              value={list.filters.leaveTypeId ?? ''}
              onChange={(v) => list.setFilter('leaveTypeId', v || undefined)}
              allLabel={t('filters.allTypes')}
              options={(types.data?.items ?? []).map((x) => ({ value: x.id, label: x.name[language] }))}
            />
            {!awaiting && (
              <FilterSelect
                label={t('fields.status')}
                value={list.filters.status ?? ''}
                onChange={(v) => list.setFilter('status', (v || undefined) as LeaveStatus | undefined)}
                allLabel={tCommon('list.allStatuses')}
                options={LEAVE_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
              />
            )}
            <TextField
              type="date"
              size="small"
              label={t('filters.from')}
              value={list.filters.from ?? ''}
              onChange={(e) => list.setFilter('from', e.target.value || undefined)}
              sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 180 } }}
              slotProps={dateSlot}
            />
            <TextField
              type="date"
              size="small"
              label={t('filters.to')}
              value={list.filters.to ?? ''}
              onChange={(e) => list.setFilter('to', e.target.value || undefined)}
              sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 180 } }}
              slotProps={dateSlot}
            />
          </>
        }
      />
      <DataTable label={awaiting ? t('tabs.approvals') : t('requests.label')} columns={columns} getRowId={(r) => r.id} query={query} sort={list} pagination={list} filtered={hasFilters} />
      {actions.dialogs}
      {creating && (
        <RequestFormDialog
          onClose={() => setCreating(false)}
          onDone={(r, submitted) => {
            setCreating(false);
            feedback.notify(t(submitted ? (r.status === 'approved' ? 'form.autoApproved' : 'form.submitted') : 'form.draftSaved', { number: r.number }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
