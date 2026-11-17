import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { ListToolbar } from '@/modules/shared/ListToolbar';
import { DetailList, Panel } from '@/modules/shared/Panel';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { visuallyHidden } from '@/modules/shared/styles';
import { usePerformanceAccess } from '@/modules/performance/hooks/usePerformanceAccess';
import { useCompetencies, useRatingScale, useReviewTemplates } from '@/modules/performance/hooks/usePerformance';
import { useCompetencyStatusFlow } from '@/modules/performance/hooks/useCompetencyStatusFlow';
import type { Competency, CompetencyFilters, CompetencySortField, ReviewTemplate } from '@/modules/performance/types/performance';
import { CompetencyFormDialog, ScaleDialog, TemplateFormDialog } from './CompetencyDialogs';

/** Competencies (create, edit, activate / deactivate), review templates and the rating scale. */
export function CompetenciesSection() {
  const { t } = useTranslation('performance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canConfigure } = usePerformanceAccess();
  const list = useListState<CompetencyFilters, CompetencySortField>('code');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useCompetencies({ ...list.params, sortBy });
  const templates = useReviewTemplates();
  const scale = useRatingScale();
  const feedback = useFeedback();
  const status = useCompetencyStatusFlow(feedback.notify);
  const [dialog, setDialog] = useState<{ kind: 'competency'; competency?: Competency } | { kind: 'template'; template?: ReviewTemplate } | { kind: 'scale' } | null>(null);

  const actions = (c: Competency): RowAction[] =>
    canConfigure
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'competency', competency: c }) },
          { label: c.status === 'active' ? t('actions.deactivate') : t('actions.activate'), icon: c.status === 'active' ? ToggleOffOutlined : ToggleOnOutlined, onClick: () => status.request(c) },
        ]
      : [];
  const columns: Column<Competency, CompetencySortField>[] = [
    { id: 'code', label: t('fields.code'), sortField: 'code', render: (c) => <Typography variant="body2" component="span" dir="ltr" sx={{ fontFamily: 'monospace' }}>{c.code}</Typography> },
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (c) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {c.name[language]}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {c.description}
          </Typography>
        </Box>
      ),
    },
    { id: 'criteria', label: t('fields.criteria'), hideBelow: 'xl', render: (c) => c.criteria || '—' },
    { id: 'templates', label: t('columns.templates'), align: 'right', hideBelow: 'md', render: (c) => formatNumber(c.templateCount, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (c) => <StatusChip status={c.status} /> },
    ...(canConfigure ? [{ id: 'actions', label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>, align: 'right' as const, render: (c: Competency) => <RowActions name={c.name[language]} actions={actions(c)} /> }] : []),
  ];

  return (
    <Stack spacing={2.5}>
      <section aria-label={t('competencies.title')}>
        <ListToolbar search={list.search} onSearch={list.setSearch} searchLabel={t('competencies.search')} hasFilters={list.hasFilters} onClear={list.clearFilters} createLabel={canConfigure ? t('competencies.create') : undefined} onCreate={canConfigure ? () => setDialog({ kind: 'competency' }) : undefined} />
        <DataTable label={t('competencies.title')} columns={columns} getRowId={(c) => c.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <Panel
          title={t('templates.title')}
          actions={
            canConfigure && (
              <Button size="small" variant="outlined" onClick={() => setDialog({ kind: 'template' })}>
                {t('templates.create')}
              </Button>
            )
          }
        >
          <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('templates.title')}>
            {(templates.data ?? []).map((tp) => (
              <Box component="li" key={tp.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {tp.name[language]}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {tp.competencies.map((c) => (
                      <Chip key={c.id} size="small" variant="outlined" label={c.name[language]} />
                    ))}
                  </Box>
                </Box>
                {canConfigure && (
                  <Button size="small" startIcon={<EditOutlined />} onClick={() => setDialog({ kind: 'template', template: tp })}>
                    {t('actions.edit')}
                  </Button>
                )}
              </Box>
            ))}
          </Stack>
        </Panel>
        <Panel
          title={t('scale.title')}
          subtitle={t('scale.subtitle')}
          actions={
            canConfigure &&
            scale.data && (
              <Button size="small" variant="outlined" onClick={() => setDialog({ kind: 'scale' })}>
                {t('actions.edit')}
              </Button>
            )
          }
        >
          <DetailList items={(scale.data ?? []).map((l) => ({ label: `${l.value} — ${l.label[language]}`, value: l.description[language] || '—' }))} />
        </Panel>
      </Box>
      {dialog?.kind === 'competency' && (
        <CompetencyFormDialog
          competency={dialog.competency}
          onClose={() => setDialog(null)}
          onDone={(c) => {
            setDialog(null);
            feedback.notify(t(dialog.competency ? 'competencies.saved' : 'competencies.created', { name: c.name[language] }));
          }}
        />
      )}
      {dialog?.kind === 'template' && (
        <TemplateFormDialog
          template={dialog.template}
          onClose={() => setDialog(null)}
          onDone={(tp) => {
            setDialog(null);
            feedback.notify(t('templates.saved', { name: tp.name[language] }));
          }}
        />
      )}
      {dialog?.kind === 'scale' && scale.data && (
        <ScaleDialog
          scale={scale.data}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            feedback.notify(t('scale.saved'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </Stack>
  );
}
