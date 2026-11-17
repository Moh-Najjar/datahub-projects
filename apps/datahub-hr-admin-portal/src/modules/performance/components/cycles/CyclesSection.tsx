import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import EditOutlined from '@mui/icons-material/EditOutlined';
import SyncAltOutlined from '@mui/icons-material/SyncAltOutlined';
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
import { visuallyHidden } from '@/modules/shared/styles';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { useReviewCycles } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import { CYCLE_STATUSES, type CycleFilters, type CycleSortField, type CycleStatus, type ReviewCycle } from '@/modules/performance/types/performance';
import { formatDay } from '@/modules/performance/utils/format';
import { CycleStatusChip, ProgressBar } from '../common/Chips';
import { CycleFormDialog, CycleStatusDialog } from './CycleDialogs';

/** Review cycles: list, status filter, create / edit drafts, lifecycle actions (performance configuration). */
export function CyclesSection() {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canConfigure } = usePerformanceAccess();
  const list = useListState<CycleFilters, CycleSortField>('startDate', 'desc');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useReviewCycles({ ...list.params, sortBy });
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<{ kind: 'form'; cycle?: ReviewCycle } | { kind: 'status'; cycle: ReviewCycle; status: CycleStatus } | null>(null);

  const actions = (c: ReviewCycle): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: performancePaths.cycle(c.id) },
    ...(c.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'form', cycle: c }) }] : []),
    ...c.nextStatuses.map((s) => ({ label: t(`cycleActions.${s}`), icon: SyncAltOutlined, onClick: () => setDialog({ kind: 'status', cycle: c, status: s }) })),
  ];
  const columns: Column<ReviewCycle, CycleSortField>[] = [
    {
      id: 'name',
      label: t('fields.cycle'),
      sortField: 'name.en',
      render: (c) => (
        <Link component={RouterLink} to={performancePaths.cycle(c.id)} sx={{ fontWeight: 500 }}>
          {c.name[language]}
        </Link>
      ),
    },
    { id: 'period', label: t('fields.reviewPeriod'), hideBelow: 'lg', render: (c) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{`${formatDay(c.periodStart, language)} – ${formatDay(c.periodEnd, language)}`}</Box> },
    { id: 'start', label: t('fields.startDate'), sortField: 'startDate', hideBelow: 'md', render: (c) => formatDay(c.startDate, language) },
    { id: 'participants', label: t('columns.participants'), align: 'right', hideBelow: 'md', render: (c) => formatNumber(c.participants, language) },
    { id: 'progress', label: t('columns.completion'), hideBelow: 'sm', render: (c) => <ProgressBar value={c.progress.total ? Math.round((c.progress.managerSubmitted / c.progress.total) * 100) : 0} label={t('columns.completion')} /> },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (c) => <CycleStatusChip status={c.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (c) => <RowActions name={c.name[language]} actions={actions(c)} /> },
  ];

  return (
    <section aria-label={t('cycles.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('cycles.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canConfigure ? t('cycles.create') : undefined}
        onCreate={canConfigure ? () => setDialog({ kind: 'form' }) : undefined}
        filters={<FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as CycleStatus | undefined)} allLabel={tCommon('list.allStatuses')} options={CYCLE_STATUSES.map((s) => ({ value: s, label: t(`cycleStatus.${s}`) }))} />}
      />
      <DataTable label={t('cycles.title')} columns={columns} getRowId={(c) => c.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {dialog?.kind === 'form' && (
        <CycleFormDialog
          cycle={dialog.cycle}
          onClose={() => setDialog(null)}
          onDone={(c) => {
            setDialog(null);
            feedback.notify(t(dialog.cycle ? 'cycles.saved' : 'cycles.created', { name: c.name[language] }));
          }}
        />
      )}
      {dialog?.kind === 'status' && (
        <CycleStatusDialog
          cycle={dialog.cycle}
          status={dialog.status}
          onClose={() => setDialog(null)}
          onDone={(c) => {
            setDialog(null);
            feedback.notify(t('cycles.statusChanged', { name: c.name[language], status: t(`cycleStatus.${c.status}`) }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
