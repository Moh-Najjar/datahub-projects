import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Switch from '@mui/material/Switch';
import RateReviewOutlined from '@mui/icons-material/RateReviewOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { useRatingScale, useReviewCycles, useReviews } from '@/modules/performance/hooks/usePerformance';
import { performancePaths } from '@/modules/performance/paths';
import { REVIEW_STATES, type ReviewFilters, type ReviewSortField, type ReviewState, type ReviewSummary } from '@/modules/performance/types/performance';
import { ratingText } from '@/modules/performance/utils/format';
import { ReviewStateChip } from '../common/Chips';

/** Reviews in scope (managers: their team; HR: everyone): filters, "awaiting my review", sorting, pagination. */
export function ReviewsSection({ cycleId }: { cycleId?: string }) {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage, canReadOrganization } = usePerformanceAccess();
  const list = useListState<ReviewFilters, ReviewSortField>('state');
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const cycles = useReviewCycles({ page: 1, pageSize: 50, sortBy: 'startDate', sortDirection: 'desc' }, !cycleId);
  const current = cycles.data?.items.find((c) => c.status === 'in-progress' || c.status === 'active');
  const selectedCycle = cycleId ?? list.filters.cycleId ?? current?.id;
  const query = useReviews({ ...list.params, sortBy, filters: { ...list.params.filters, ...(selectedCycle ? { cycleId: selectedCycle } : {}) } }, Boolean(cycleId) || cycles.isSuccess);
  const { options: departments } = useDepartmentOptions({ enabled: canReadOrganization });
  const scale = useRatingScale();

  const columns: Column<ReviewSummary, ReviewSortField>[] = [
    {
      id: 'employee',
      label: t('fields.employee'),
      sortField: 'employee.name.en',
      render: (r) => (
        <Link component={RouterLink} to={performancePaths.review(r.id)} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
          {r.employee.name[language]}
        </Link>
      ),
    },
    { id: 'number', label: t('columns.number'), hideBelow: 'lg', render: (r) => <Box component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{r.employee.employeeNumber}</Box> },
    { id: 'department', label: t('fields.department'), hideBelow: 'xl', render: (r) => r.employee.department.name[language] },
    { id: 'reviewer', label: t('fields.reviewer'), hideBelow: 'xl', render: (r) => r.reviewer?.name[language] ?? '—' },
    { id: 'self', label: t('columns.self'), hideBelow: 'md', render: (r) => t(`assessment.${r.selfStatus}`) },
    { id: 'manager', label: t('columns.manager'), hideBelow: 'md', render: (r) => t(`assessment.${r.managerStatus}`) },
    { id: 'rating', label: t('fields.overallRating'), sortField: 'overallRating', hideBelow: 'sm', render: (r) => ratingText(r.overallRating, scale.data ?? [], language) },
    { id: 'state', label: t('fields.status'), sortField: 'state', render: (r) => <ReviewStateChip state={r.state} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (r) => <RowActions name={r.employee.name[language]} actions={[{ label: t('actions.openReview'), icon: RateReviewOutlined, to: performancePaths.review(r.id) }]} /> },
  ];

  return (
    <section aria-label={t('reviews.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('reviews.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        filters={
          <>
            {!cycleId && <FilterSelect label={t('fields.cycle')} value={selectedCycle ?? ''} onChange={(v) => list.setFilter('cycleId', v || undefined)} allLabel={t('filters.allCycles')} options={(cycles.data?.items ?? []).filter((c) => c.status !== 'draft').map((c) => ({ value: c.id, label: c.name[language] }))} />}
            <FilterSelect label={t('fields.status')} value={list.filters.state ?? ''} onChange={(v) => list.setFilter('state', (v || undefined) as ReviewState | undefined)} allLabel={tCommon('list.allStatuses')} options={REVIEW_STATES.map((s) => ({ value: s, label: t(`reviewState.${s}`) }))} />
            {departments.length > 0 && <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />}
            {canManage && <FormControlLabel control={<Switch checked={list.filters.mine === 'true'} onChange={(e) => list.setFilter('mine', e.target.checked ? 'true' : undefined)} />} label={t('reviews.awaitingMe')} />}
          </>
        }
      />
      <DataTable label={t('reviews.title')} columns={columns} getRowId={(r) => r.id} query={query} sort={list} pagination={list} filtered={list.hasFilters || Boolean(cycleId)} />
    </section>
  );
}
