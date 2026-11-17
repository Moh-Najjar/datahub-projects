import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import TrendingUpOutlined from '@mui/icons-material/TrendingUpOutlined';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { useGoals, useReviewCycles } from '@/modules/performance/hooks/usePerformance';
import { GOAL_CATEGORIES, GOAL_STATUSES, type Goal, type GoalCategory, type GoalFilters, type GoalSortField, type GoalStatus } from '@/modules/performance/types/performance';
import { formatDay } from '@/modules/performance/utils/format';
import { GoalStatusChip, ProgressBar } from '../common/Chips';
import { GoalFormDialog, GoalHistoryDialog, GoalProgressDialog } from './GoalDialogs';

/** Goals: search, filters (status, category, cycle, department), sorting, pagination; actions allowed by the API. */
export function GoalsSection({ employeeId, allowCreate = true }: { employeeId?: string; allowCreate?: boolean }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage, canReadOrganization, scope } = usePerformanceAccess();
  const list = useListState<GoalFilters, GoalSortField>('dueDate');
  const query = useGoals({ ...list.params, filters: { ...list.params.filters, ...(employeeId ? { employeeId } : {}) } });
  const cycles = useReviewCycles({ page: 1, pageSize: 50, sortBy: 'startDate', sortDirection: 'desc' });
  const { options: departments } = useDepartmentOptions({ enabled: canReadOrganization && !employeeId });
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<{ kind: 'form'; goal?: Goal } | { kind: 'progress' | 'history'; goal: Goal } | null>(null);
  const showOwner = !employeeId && scope.kind !== 'own';

  const actions = (g: Goal): RowAction[] => [
    { label: t('actions.history'), icon: HistoryOutlined, onClick: () => setDialog({ kind: 'history', goal: g }) },
    ...(g.can.progress ? [{ label: t('actions.updateProgress'), icon: TrendingUpOutlined, onClick: () => setDialog({ kind: 'progress', goal: g }) }] : []),
    ...(g.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'form', goal: g }) }] : []),
  ];

  const columns: Column<Goal, GoalSortField>[] = [
    {
      id: 'title',
      label: t('fields.goalTitle'),
      sortField: 'title',
      render: (g) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {g.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {g.target}
          </Typography>
        </Box>
      ),
    },
    ...(showOwner ? [{ id: 'owner', label: t('fields.owner'), hideBelow: 'md' as const, render: (g: Goal) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{g.owner ? g.owner.name[language] : t('goals.departmentOwner', { department: g.department.name[language] })}</Box> }] : []),
    { id: 'category', label: t('fields.category'), hideBelow: 'xl', render: (g) => t(`categories.${g.category}`) },
    { id: 'priority', label: t('fields.priority'), sortField: 'priority', hideBelow: 'lg', render: (g) => t(`priorities.${g.priority}`) },
    { id: 'due', label: t('fields.dueDate'), sortField: 'dueDate', hideBelow: 'lg', render: (g) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{formatDay(g.dueDate, language)}</Box> },
    { id: 'progress', label: t('fields.progress'), sortField: 'progress', hideBelow: 'sm', render: (g) => <ProgressBar value={g.progress} label={t('fields.progress')} /> },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (g) => <GoalStatusChip status={g.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (g) => <RowActions name={g.title} actions={actions(g)} /> },
  ];

  return (
    <section aria-label={t('goals.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('goals.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage && allowCreate ? t('goals.create') : undefined}
        onCreate={canManage && allowCreate ? () => setDialog({ kind: 'form' }) : undefined}
        filters={
          <>
            <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as GoalStatus | undefined)} allLabel={tCommon('list.allStatuses')} options={GOAL_STATUSES.map((s) => ({ value: s, label: t(`goalStatus.${s}`) }))} />
            <FilterSelect label={t('fields.category')} value={list.filters.category ?? ''} onChange={(v) => list.setFilter('category', (v || undefined) as GoalCategory | undefined)} allLabel={t('filters.allCategories')} options={GOAL_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
            <FilterSelect label={t('fields.cycle')} value={list.filters.cycleId ?? ''} onChange={(v) => list.setFilter('cycleId', v || undefined)} allLabel={t('filters.allCycles')} options={(cycles.data?.items ?? []).map((c) => ({ value: c.id, label: c.name[language] }))} />
            {departments.length > 0 && <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />}
          </>
        }
      />
      <DataTable label={t('goals.title')} columns={columns} getRowId={(g) => g.id} query={query} sort={list} pagination={list} filtered={list.hasFilters || Boolean(employeeId)} />
      {dialog?.kind === 'form' && (
        <GoalFormDialog
          goal={dialog.goal}
          employeeId={employeeId}
          onClose={() => setDialog(null)}
          onDone={(g) => {
            setDialog(null);
            feedback.notify(t(dialog.goal ? 'goals.saved' : 'goals.created', { title: g.title }));
          }}
        />
      )}
      {dialog?.kind === 'progress' && (
        <GoalProgressDialog
          goal={dialog.goal}
          onClose={() => setDialog(null)}
          onDone={(g) => {
            setDialog(null);
            feedback.notify(t('goals.progressSaved', { title: g.title }));
          }}
        />
      )}
      {dialog?.kind === 'history' && <GoalHistoryDialog goal={dialog.goal} onClose={() => setDialog(null)} />}
      <Feedback {...feedback} />
    </section>
  );
}
