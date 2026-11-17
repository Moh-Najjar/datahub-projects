import { useState } from 'react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import SyncAltOutlined from '@mui/icons-material/SyncAltOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { useRequisitions } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { EMPLOYMENT_TYPES, REQUISITION_STATUSES, type EmploymentType, type Requisition, type RequisitionFilters, type RequisitionSortField, type RequisitionStatus } from '@/modules/recruitment/types/recruitment';
import { formatDay } from '@/modules/recruitment/utils/format';
import { RequisitionStatusChip } from '../common/StatusChips';
import { RequisitionFormDialog } from './RequisitionFormDialog';
import { RequisitionStatusDialog } from './RequisitionStatusDialog';

/** Job requisitions: search, filters (department, location, status, employment type), sorting, pagination. */
export function RequisitionsSection() {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage, canReadOrganization } = useRecruitmentAccess();
  const list = useListState<RequisitionFilters, RequisitionSortField>('number', 'desc');
  const sortBy = list.sortBy === 'title.en' || list.sortBy === 'title.ar' ? (`title.${language}` as const) : list.sortBy;
  const query = useRequisitions({ ...list.params, sortBy });
  const { options: departments } = useDepartmentOptions({ enabled: canReadOrganization });
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' }, canReadOrganization);
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<{ kind: 'form'; requisition?: Requisition } | { kind: 'status'; requisition: Requisition; status: RequisitionStatus } | null>(null);

  const actions = (r: Requisition): RowAction[] => [
    { label: t('actions.viewDetails'), icon: VisibilityOutlined, to: recruitmentPaths.requisition(r.id) },
    ...(r.can.edit ? [{ label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'form', requisition: r }) }] : []),
    ...r.nextStatuses.map((s) => ({ label: t(`requisitionActions.${s}`), icon: SyncAltOutlined, onClick: () => setDialog({ kind: 'status', requisition: r, status: s }) })),
  ];

  const columns: Column<Requisition, RequisitionSortField>[] = [
    { id: 'number', label: t('columns.number'), sortField: 'number', hideBelow: 'md', render: (r) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.number}</Typography> },
    {
      id: 'title',
      label: t('fields.jobTitle'),
      sortField: 'title.en',
      render: (r) => (
        <Link component={RouterLink} to={recruitmentPaths.requisition(r.id)} sx={{ fontWeight: 500 }}>
          {r.title[language]}
        </Link>
      ),
    },
    { id: 'department', label: t('fields.department'), hideBelow: 'lg', render: (r) => r.department.name[language] },
    { id: 'location', label: t('fields.location'), hideBelow: 'xl', render: (r) => r.location.name[language] },
    { id: 'type', label: t('fields.employmentType'), hideBelow: 'xl', render: (r) => t(`employmentTypes.${r.employmentType}`) },
    { id: 'vacancies', label: t('columns.vacancies'), sortField: 'vacancies', align: 'right', hideBelow: 'md', render: (r) => `${formatNumber(r.counts.hired, language)}/${formatNumber(r.vacancies, language)}` },
    { id: 'candidates', label: t('columns.candidates'), align: 'right', hideBelow: 'sm', render: (r) => formatNumber(r.counts.candidates, language) },
    { id: 'opening', label: t('fields.openingDate'), sortField: 'openingDate', hideBelow: 'lg', render: (r) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{formatDay(r.openingDate, language)}</Box> },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (r) => <RequisitionStatusChip status={r.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (r) => <RowActions name={r.title[language]} actions={actions(r)} /> },
  ];

  return (
    <section aria-label={t('requisitions.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('requisitions.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage ? t('requisitions.create') : undefined}
        onCreate={canManage ? () => setDialog({ kind: 'form' }) : undefined}
        filters={
          <>
            {departments.length > 0 && (
              <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />
            )}
            {canReadOrganization && (
              <FilterSelect label={t('fields.location')} value={list.filters.locationId ?? ''} onChange={(v) => list.setFilter('locationId', v || undefined)} allLabel={t('filters.allLocations')} options={(locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language] }))} />
            )}
            <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as RequisitionStatus | undefined)} allLabel={tCommon('list.allStatuses')} options={REQUISITION_STATUSES.map((s) => ({ value: s, label: t(`requisitionStatus.${s}`) }))} />
            <FilterSelect label={t('fields.employmentType')} value={list.filters.employmentType ?? ''} onChange={(v) => list.setFilter('employmentType', (v || undefined) as EmploymentType | undefined)} allLabel={t('filters.allTypes')} options={EMPLOYMENT_TYPES.map((e) => ({ value: e, label: t(`employmentTypes.${e}`) }))} />
          </>
        }
      />
      <DataTable label={t('requisitions.title')} columns={columns} getRowId={(r) => r.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {dialog?.kind === 'form' && (
        <RequisitionFormDialog
          requisition={dialog.requisition}
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setDialog(null);
            feedback.notify(t(dialog.requisition ? 'requisitions.saved' : 'requisitions.created', { number: r.number }));
          }}
        />
      )}
      {dialog?.kind === 'status' && (
        <RequisitionStatusDialog
          requisition={dialog.requisition}
          status={dialog.status}
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setDialog(null);
            feedback.notify(t('requisitions.statusChanged', { number: r.number, status: t(`requisitionStatus.${r.status}`) }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
