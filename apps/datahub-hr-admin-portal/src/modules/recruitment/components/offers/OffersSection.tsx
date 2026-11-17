import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useOffers, useRequisitions } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { OFFER_STATUSES, type Offer, type OfferFilters, type OfferSortField, type OfferStatus } from '@/modules/recruitment/types/recruitment';
import { formatDay, formatMoney, personName } from '@/modules/recruitment/utils/format';
import { OfferStatusChip } from '../common/StatusChips';
import { useOfferActions } from './useOfferActions';

/** Offers: search, filters (status, requisition), sorting, pagination. Offers are prepared from a candidate. */
export function OffersSection({ candidateId }: { candidateId?: string }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const list = useListState<OfferFilters, OfferSortField>('number', 'desc');
  const query = useOffers({ ...list.params, filters: { ...list.params.filters, ...(candidateId ? { candidateId } : {}) } });
  const requisitions = useRequisitions({ page: 1, pageSize: 100, sortBy: 'number', sortDirection: 'desc' }, !candidateId);
  const feedback = useFeedback();
  const actions = useOfferActions(feedback.notify);

  const columns: Column<Offer, OfferSortField>[] = [
    {
      id: 'number',
      label: t('columns.number'),
      sortField: 'number',
      render: (o) => (
        <Link component={RouterLink} to={recruitmentPaths.offer(o.id)} dir="ltr" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {o.number}
        </Link>
      ),
    },
    ...(candidateId ? [] : [{ id: 'candidate', label: t('fields.candidate'), render: (o: Offer) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{personName(o.candidate.name, language)}</Box> }]),
    { id: 'position', label: t('fields.position'), hideBelow: 'lg', render: (o) => o.position.name[language] },
    { id: 'salary', label: t('fields.salary'), sortField: 'salary', align: 'right', hideBelow: 'md', render: (o) => <Box component="span" dir="ltr" sx={{ whiteSpace: 'nowrap' }}>{formatMoney(o.salary, o.currency, language)}</Box> },
    { id: 'start', label: t('fields.startDate'), sortField: 'startDate', hideBelow: 'xl', render: (o) => formatDay(o.startDate, language) },
    { id: 'expiry', label: t('fields.expiryDate'), sortField: 'expiryDate', hideBelow: 'lg', render: (o) => formatDay(o.expiryDate, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (o) => <OfferStatusChip status={o.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (o) => <RowActions name={o.number} actions={actions.actionsFor(o)} /> },
  ];

  return (
    <section aria-label={t('offers.title')}>
      {!candidateId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('offers.simulatedNote')}
        </Alert>
      )}
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('offers.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        filters={
          <>
            <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as OfferStatus | undefined)} allLabel={tCommon('list.allStatuses')} options={OFFER_STATUSES.map((s) => ({ value: s, label: t(`offerStatus.${s}`) }))} />
            {!candidateId && (
              <FilterSelect label={t('fields.requisition')} value={list.filters.requisitionId ?? ''} onChange={(v) => list.setFilter('requisitionId', v || undefined)} allLabel={t('filters.allRequisitions')} options={(requisitions.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.number} · ${r.title[language]}` }))} />
            )}
          </>
        }
      />
      <DataTable label={t('offers.title')} columns={columns} getRowId={(o) => o.id} query={query} sort={list} pagination={list} filtered={list.hasFilters || Boolean(candidateId)} />
      {actions.dialogs}
      <Feedback {...feedback} />
    </section>
  );
}
