import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import EditOutlined from '@mui/icons-material/EditOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
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
import { usePlans } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import { PLAN_STATUSES, type DevelopmentPlan, type PlanFilters, type PlanSortField, type PlanStatus } from '@/modules/performance/types/performance';
import { formatDay } from '@/modules/performance/utils/format';
import { PlanStatusChip, ProgressBar } from '../common/Chips';
import { PlanFormDialog } from './PlanFormDialog';

/** Development plans in scope: search, filters, sorting, pagination; create / edit for managers. */
export function PlansSection({ employeeId, allowCreate = true }: { employeeId?: string; allowCreate?: boolean }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage, canReadOrganization, scope } = usePerformanceAccess();
  const list = useListState<PlanFilters, PlanSortField>('targetDate');
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const query = usePlans({ ...list.params, sortBy, filters: { ...list.params.filters, ...(employeeId ? { employeeId } : {}) } });
  const { options: departments } = useDepartmentOptions({ enabled: canReadOrganization && !employeeId });
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<{ plan?: DevelopmentPlan } | null>(null);
  const showEmployee = !employeeId && scope.kind !== 'own';

  const actions = (p: DevelopmentPlan): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: performancePaths.plan(p.id) },
    ...(p.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ plan: p }) }] : []),
  ];
  const columns: Column<DevelopmentPlan, PlanSortField>[] = [
    {
      id: 'title',
      label: t('fields.planTitle'),
      render: (p) => (
        <Link component={RouterLink} to={performancePaths.plan(p.id)} sx={{ fontWeight: 500 }}>
          {p.title}
        </Link>
      ),
    },
    ...(showEmployee ? [{ id: 'employee', label: t('fields.employee'), sortField: 'employee.name.en' as const, render: (p: DevelopmentPlan) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{p.employee.name[language]}</Box> }] : []),
    { id: 'activities', label: t('plans.activities'), align: 'right', hideBelow: 'lg', render: (p) => <span dir="ltr">{`${p.activities.filter((a) => a.status === 'done').length}/${p.activities.length}`}</span> },
    { id: 'target', label: t('fields.targetDate'), sortField: 'targetDate', hideBelow: 'md', render: (p) => formatDay(p.targetDate, language) },
    { id: 'progress', label: t('fields.progress'), sortField: 'progress', hideBelow: 'sm', render: (p) => <ProgressBar value={p.progress} label={t('fields.progress')} /> },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (p) => <PlanStatusChip status={p.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (p) => <RowActions name={p.title} actions={actions(p)} /> },
  ];

  return (
    <section aria-label={t('plans.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('plans.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage && allowCreate ? t('plans.create') : undefined}
        onCreate={canManage && allowCreate ? () => setDialog({}) : undefined}
        filters={
          <>
            <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as PlanStatus | undefined)} allLabel={tCommon('list.allStatuses')} options={PLAN_STATUSES.map((s) => ({ value: s, label: t(`planStatus.${s}`) }))} />
            {departments.length > 0 && <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />}
          </>
        }
      />
      <DataTable label={t('plans.title')} columns={columns} getRowId={(p) => p.id} query={query} sort={list} pagination={list} filtered={list.hasFilters || Boolean(employeeId)} />
      {dialog && (
        <PlanFormDialog
          plan={dialog.plan}
          employeeId={employeeId}
          onClose={() => setDialog(null)}
          onDone={(p) => {
            setDialog(null);
            feedback.notify(t(dialog.plan ? 'plans.saved' : 'plans.created', { title: p.title }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
