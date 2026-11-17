import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { useInterviews } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { INTERVIEW_STATUSES, INTERVIEW_TYPES, type Interview, type InterviewFilters, type InterviewSortField, type InterviewStatus, type InterviewType } from '@/modules/recruitment/types/recruitment';
import { formatDateTime, personName } from '@/modules/recruitment/utils/format';
import { InterviewStatusChip } from '../common/StatusChips';
import { InterviewFormDialog } from './InterviewFormDialog';
import { useInterviewActions } from './useInterviewActions';

/** Interviews (simulated scheduling): search, filters, sorting, pagination and the actions the API allows. */
export function InterviewsSection({ candidateId }: { candidateId?: string }) {
  const { t } = useTranslation('recruitment');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canManage, scope } = useRecruitmentAccess();
  const list = useListState<InterviewFilters, InterviewSortField>('start', 'desc');
  const query = useInterviews({ ...list.params, filters: { ...list.params.filters, ...(candidateId ? { candidateId } : {}) } });
  const feedback = useFeedback();
  const actions = useInterviewActions(feedback.notify);
  const [creating, setCreating] = useState(false);
  const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

  const columns: Column<Interview, InterviewSortField>[] = [
    {
      id: 'start',
      label: t('fields.start'),
      sortField: 'start',
      render: (i) => (
        <Link component={RouterLink} to={recruitmentPaths.interview(i.id)} sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
          {formatDateTime(i.start, language)}
        </Link>
      ),
    },
    ...(candidateId ? [] : [{ id: 'candidate', label: t('fields.candidate'), render: (i: Interview) => <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{personName(i.candidate.name, language)}</Box> }]),
    { id: 'requisition', label: t('fields.requisition'), hideBelow: 'xl', render: (i) => i.requisition.title[language] },
    { id: 'type', label: t('fields.interviewType'), sortField: 'type', hideBelow: 'md', render: (i) => t(`interviewTypes.${i.type}`) },
    { id: 'interviewers', label: t('fields.interviewers'), hideBelow: 'lg', render: (i) => i.interviewers.map((p) => p.name[language]).join(', ') },
    { id: 'feedback', label: t('columns.feedback'), hideBelow: 'lg', render: (i) => <Typography variant="body2" component="span" dir="ltr">{`${i.feedbackCount}/${i.interviewers.length}`}</Typography> },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (i) => <InterviewStatusChip status={i.status} /> },
    { id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right', render: (i) => <RowActions name={personName(i.candidate.name, language)} actions={actions.actionsFor(i)} /> },
  ];

  return (
    <section aria-label={t('interviews.title')}>
      {!candidateId && <Alert severity="info" sx={{ mb: 2 }}>{scope.kind === 'team' ? t('interviews.teamNote') : t('interviews.simulatedNote')}</Alert>}
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('interviews.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        createLabel={canManage && !candidateId ? t('interviews.create') : undefined}
        onCreate={canManage && !candidateId ? () => setCreating(true) : undefined}
        filters={
          <>
            <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as InterviewStatus | undefined)} allLabel={tCommon('list.allStatuses')} options={INTERVIEW_STATUSES.map((s) => ({ value: s, label: t(`interviewStatus.${s}`) }))} />
            <FilterSelect label={t('fields.interviewType')} value={list.filters.type ?? ''} onChange={(v) => list.setFilter('type', (v || undefined) as InterviewType | undefined)} allLabel={t('filters.allTypes')} options={INTERVIEW_TYPES.map((s) => ({ value: s, label: t(`interviewTypes.${s}`) }))} />
            <TextField type="date" size="small" label={t('filters.from')} value={list.filters.from ?? ''} onChange={(e) => list.setFilter('from', e.target.value || undefined)} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 180 } }} slotProps={dateSlot} />
            <TextField type="date" size="small" label={t('filters.to')} value={list.filters.to ?? ''} onChange={(e) => list.setFilter('to', e.target.value || undefined)} sx={{ flex: '1 1 150px', minWidth: 150, maxWidth: { sm: 180 } }} slotProps={dateSlot} />
          </>
        }
      />
      <DataTable label={t('interviews.title')} columns={columns} getRowId={(i) => i.id} query={query} sort={list} pagination={list} filtered={list.hasFilters || Boolean(candidateId)} />
      {actions.dialogs}
      {creating && (
        <InterviewFormDialog
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            feedback.notify(t('interviews.scheduled'));
          }}
        />
      )}
      <Feedback {...feedback} />
    </section>
  );
}
