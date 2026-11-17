import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
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
import { useLeaveAccess } from '@/modules/leave/hooks/useLeaveAccess';
import { useLeaveTypes } from '@/modules/leave/hooks/useLeave';
import { useTypeStatusFlow } from '@/modules/leave/hooks/useTypeStatusFlow';
import { leavePaths } from '@/modules/leave/paths';
import type { LeaveType, LeaveTypeFilters, LeaveTypeSortField, RecordStatus } from '@/modules/leave/types/leave';
import { TypeFormDialog } from './TypeFormDialog';

/** Leave types: search, status / paid filters, create, edit, activate / deactivate (leave:manage-policies). */
export function TypesSection() {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManagePolicies } = useLeaveAccess();
  const list = useListState<LeaveTypeFilters, LeaveTypeSortField>('code');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useLeaveTypes({ ...list.params, sortBy });
  const feedback = useFeedback();
  const status = useTypeStatusFlow(feedback.notify);
  const [dialog, setDialog] = useState<{ type?: LeaveType } | null>(null);
  const n = (v: number | null) => (v === null ? t('balances.noLimit') : formatNumber(v, language));

  const actions = (x: LeaveType): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: leavePaths.type(x.id) },
    ...(canManagePolicies
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ type: x }) },
          { label: x.status === 'active' ? t('actions.deactivate') : t('actions.activate'), icon: x.status === 'active' ? ToggleOffOutlined : ToggleOnOutlined, onClick: () => status.request(x) },
        ]
      : []),
  ];

  const columns: Column<LeaveType, LeaveTypeSortField>[] = [
    { id: 'code', label: t('fields.code'), sortField: 'code', render: (x) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{x.code}</Typography> },
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (x) => (
        <Link component={RouterLink} to={leavePaths.type(x.id)} sx={{ fontWeight: 500 }}>
          {x.name[language]}
        </Link>
      ),
    },
    { id: 'paid', label: t('fields.paid'), hideBelow: 'sm', render: (x) => (x.paid ? t('types.paid') : t('types.unpaid')) },
    { id: 'allocation', label: t('columns.allocation'), sortField: 'annualAllocation', align: 'right', hideBelow: 'md', render: (x) => n(x.annualAllocation) },
    { id: 'max', label: t('columns.maxDays'), align: 'right', hideBelow: 'lg', render: (x) => n(x.maxConsecutiveDays) },
    { id: 'approval', label: t('columns.approval'), hideBelow: 'xl', render: (x) => (x.requiresApproval ? t('common.yes') : t('common.no')) },
    { id: 'document', label: t('columns.document'), hideBelow: 'xl', render: (x) => (x.requiresDocument ? t('common.yes') : t('common.no')) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (x) => <StatusChip status={x.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (x) => <RowActions name={x.name[language]} actions={actions(x)} /> },
  ];

  return (
    <section aria-label={t('types.label')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('types.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManagePolicies ? t('types.create') : undefined}
        onCreate={canManagePolicies ? () => setDialog({}) : undefined}
        filters={
          <>
            <FilterSelect
              label={t('fields.status')}
              value={list.filters.status ?? ''}
              onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)}
              allLabel={tCommon('list.allStatuses')}
              options={[
                { value: 'active', label: tCommon('status.active') },
                { value: 'inactive', label: tCommon('status.inactive') },
              ]}
            />
            <FilterSelect
              label={t('fields.paid')}
              value={list.filters.paid ?? ''}
              onChange={(v) => list.setFilter('paid', (v || undefined) as 'paid' | 'unpaid' | undefined)}
              allLabel={t('filters.paidAll')}
              options={[
                { value: 'paid', label: t('types.paid') },
                { value: 'unpaid', label: t('types.unpaid') },
              ]}
            />
          </>
        }
      />
      <DataTable label={t('types.label')} columns={columns} getRowId={(x) => x.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {dialog && (
        <TypeFormDialog
          leaveType={dialog.type}
          onClose={() => setDialog(null)}
          onDone={(x) => {
            setDialog(null);
            feedback.notify(t(dialog.type ? 'types.saved' : 'types.created', { name: x.name[language] }));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </section>
  );
}
