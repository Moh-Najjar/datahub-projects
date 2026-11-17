import { useState } from 'react';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { visuallyHidden } from '@/modules/shared/styles';
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { useCandidates, useRequisitions } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { CANDIDATE_SOURCES, CANDIDATE_STAGES, EXPERIENCE_BANDS, type Candidate, type CandidateFilters, type CandidateSortField, type CandidateSource, type CandidateStage, type ExperienceBand } from '@/modules/recruitment/types/recruitment';
import { formatDay, personName } from '@/modules/recruitment/utils/format';
import { StageChip } from '../common/StatusChips';
import { CandidateFormDialog } from './CandidateFormDialog';
import { useCandidateActions } from './useCandidateActions';

/** Candidate directory: search (name, e-mail, number), filters, sorting, pagination; actions as allowed by the API. */
export function CandidatesSection({ requisitionId, stage }: { requisitionId?: string; stage?: CandidateStage }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage } = useRecruitmentAccess();
  const list = useListState<CandidateFilters, CandidateSortField>('appliedAt', 'desc');
  const [archived, setArchived] = useState(false);
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const filters = { ...list.params.filters, ...(requisitionId ? { requisitionId } : {}), ...(stage && !list.params.filters?.stage ? { stage } : {}), ...(archived ? { archived: 'true' as const } : {}) };
  const query = useCandidates({ ...list.params, sortBy, filters });
  const requisitions = useRequisitions({ page: 1, pageSize: 100, sortBy: 'number', sortDirection: 'desc' }, !requisitionId);
  const feedback = useFeedback();
  const actions = useCandidateActions(feedback.notify);
  const [creating, setCreating] = useState(false);

  const columns: Column<Candidate, CandidateSortField>[] = [
    { id: 'number', label: t('columns.number'), sortField: 'number', hideBelow: 'lg', render: (c) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{c.number}</Typography> },
    {
      id: 'name',
      label: t('fields.candidate'),
      sortField: 'name.en',
      render: (c) => (
        <Box sx={{ minWidth: 0 }}>
          <Link component={RouterLink} to={recruitmentPaths.candidate(c.id)} sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            {personName(c.name, language)}
          </Link>
          <Typography variant="caption" color="text.secondary" component="div" dir="ltr" sx={{ textAlign: 'start', overflowWrap: 'anywhere' }}>
            {c.email}
          </Typography>
        </Box>
      ),
    },
    ...(requisitionId ? [] : [{ id: 'requisition', label: t('fields.appliedPosition'), hideBelow: 'md' as const, render: (c: Candidate) => c.requisition.title[language] }]),
    { id: 'experience', label: t('columns.experience'), sortField: 'experienceYears', align: 'right', hideBelow: 'xl', render: (c) => formatNumber(c.experienceYears, language) },
    { id: 'source', label: t('fields.source'), hideBelow: 'xl', render: (c) => t(`sources.${c.source}`) },
    { id: 'applied', label: t('fields.appliedAt'), sortField: 'appliedAt', hideBelow: 'lg', render: (c) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{formatDay(c.appliedAt, language)}</Box> },
    { id: 'stage', label: t('fields.stage'), sortField: 'stage', render: (c) => <StageChip stage={c.stage} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (c) => <RowActions name={personName(c.name, language)} actions={actions.actionsFor(c)} /> },
  ];

  const hasFilters = list.hasFilters || archived;

  return (
    <section aria-label={t('candidates.title')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('candidates.search')}
        hasFilters={hasFilters}
        onClear={() => {
          list.clearFilters();
          setArchived(false);
        }}
        createLabel={canManage ? t('candidates.create') : undefined}
        onCreate={canManage ? () => setCreating(true) : undefined}
        filters={
          <>
            <FilterSelect label={t('fields.stage')} value={list.filters.stage ?? stage ?? ''} onChange={(v) => list.setFilter('stage', (v || undefined) as CandidateStage | undefined)} allLabel={t('filters.allStages')} options={CANDIDATE_STAGES.map((s) => ({ value: s, label: t(`stages.${s}`) }))} />
            {!requisitionId && (
              <FilterSelect label={t('fields.requisition')} value={list.filters.requisitionId ?? ''} onChange={(v) => list.setFilter('requisitionId', v || undefined)} allLabel={t('filters.allRequisitions')} options={(requisitions.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.number} · ${r.title[language]}` }))} />
            )}
            <FilterSelect label={t('fields.source')} value={list.filters.source ?? ''} onChange={(v) => list.setFilter('source', (v || undefined) as CandidateSource | undefined)} allLabel={t('filters.allSources')} options={CANDIDATE_SOURCES.map((s) => ({ value: s, label: t(`sources.${s}`) }))} />
            <FilterSelect label={t('columns.experience')} value={list.filters.experience ?? ''} onChange={(v) => list.setFilter('experience', (v || undefined) as ExperienceBand | undefined)} allLabel={t('filters.anyExperience')} options={EXPERIENCE_BANDS.map((b) => ({ value: b, label: t(`experienceBands.${b}`) }))} />
            <FormControlLabel
              control={
                <Switch
                  checked={archived}
                  onChange={(e) => {
                    setArchived(e.target.checked);
                    list.setPage(1);
                  }}
                />
              }
              label={t('candidates.showArchived')}
            />
          </>
        }
      />
      <DataTable label={t('candidates.title')} columns={columns} getRowId={(c) => c.id} query={query} sort={list} pagination={list} filtered={hasFilters || Boolean(requisitionId)} />
      {actions.dialogs}
      {creating && (
        <CandidateFormDialog
          requisitionId={requisitionId}
          onClose={() => setCreating(false)}
          onDone={(c) => {
            setCreating(false);
            feedback.notify(t('candidates.created', { name: personName(c.name, language) }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
