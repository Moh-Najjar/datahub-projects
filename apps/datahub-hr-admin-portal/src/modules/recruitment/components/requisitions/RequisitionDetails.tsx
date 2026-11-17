import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ViewKanbanOutlined from '@mui/icons-material/ViewKanbanOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useRequisition } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Requisition, RequisitionStatus } from '@/modules/recruitment/types/recruitment';
import { formatDay, formatMoney, formatTimestamp } from '@/modules/recruitment/utils/format';
import { CandidatesSection } from '../candidates/CandidatesSection';
import { RequisitionStatusChip } from '../common/StatusChips';
import { RequisitionFormDialog } from './RequisitionFormDialog';
import { RequisitionStatusDialog } from './RequisitionStatusDialog';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/recruitment/requisitions/:requisitionId` */
export function RequisitionDetails() {
  const { t } = useTranslation('recruitment');
  const { requisitionId = '' } = useParams();
  const query = useRequisition(requisitionId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={recruitmentPaths.requisitions} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToRequisitions')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('requisitions.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <RequisitionView requisition={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function RequisitionView({ requisition: r }: { requisition: Requisition }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const feedback = useFeedback();
  const [dialog, setDialog] = useState<{ kind: 'edit' } | { kind: 'status'; status: RequisitionStatus } | null>(null);
  useBreadcrumbs([{ label: t('tabs.requisitions'), to: recruitmentPaths.requisitions }, { label: r.number }]);
  const n = (v: number) => formatNumber(v, language);

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2">
            {r.title[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={r.number} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <RequisitionStatusChip status={r.status} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button component={RouterLink} to={`${recruitmentPaths.pipeline}?requisition=${r.id}`} variant="outlined" startIcon={<ViewKanbanOutlined />}>
            {t('actions.viewPipeline')}
          </Button>
          {r.can.edit && (
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setDialog({ kind: 'edit' })}>
              {t('actions.edit')}
            </Button>
          )}
          {r.nextStatuses.map((s) => (
            <Button key={s} variant={s === 'open' ? 'contained' : 'outlined'} color={s === 'cancelled' ? 'error' : 'primary'} onClick={() => setDialog({ kind: 'status', status: s })}>
              {t(`requisitionActions.${s}`)}
            </Button>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
        <Panel title={t('requisitions.details')}>
          <DetailList
            items={[
              { label: t('fields.titleEn'), value: <span dir="ltr">{r.title.en}</span> },
              { label: t('fields.titleAr'), value: <span dir="rtl">{r.title.ar}</span> },
              { label: t('fields.department'), value: r.department.name[language] },
              { label: t('fields.position'), value: r.position.name[language] },
              { label: t('fields.location'), value: r.location.name[language] },
              { label: t('fields.employmentType'), value: t(`employmentTypes.${r.employmentType}`) },
              { label: t('fields.hiringManager'), value: r.hiringManager?.name[language] ?? '—' },
              { label: t('fields.recruiter'), value: r.recruiter?.name[language] ?? '—' },
              { label: t('fields.minExperience'), value: t('units.years', { count: r.minExperienceYears, value: n(r.minExperienceYears) }) },
              { label: t('fields.education'), value: t(`education.${r.education}`) },
              { label: t('fields.skills'), value: r.skills.length ? r.skills.join(', ') : '—' },
              { label: t('fields.salaryRange'), value: r.salaryRange ? <span dir="ltr">{`${formatMoney(r.salaryRange.min, r.salaryRange.currency, language)} – ${formatMoney(r.salaryRange.max, r.salaryRange.currency, language)}`}</span> : '—' },
              { label: t('fields.openingDate'), value: formatDay(r.openingDate, language) },
              { label: t('fields.closingDate'), value: r.closingDate ? formatDay(r.closingDate, language) : '—' },
            ]}
          />
          <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 0.5 }}>
            {t('fields.description')}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
            {r.description}
          </Typography>
        </Panel>
        <Stack spacing={2.5}>
          <Panel title={t('requisitions.progress')}>
            <DetailList
              items={[
                { label: t('fields.vacancies'), value: n(r.vacancies) },
                { label: t('columns.candidates'), value: n(r.counts.candidates) },
                { label: t('requisitions.inProcess'), value: n(r.counts.active) },
                { label: t('stages.hired'), value: n(r.counts.hired) },
              ]}
            />
          </Panel>
          <Panel title={t('details.statusHistory')}>
            <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
              {[...r.history].reverse().map((h, i) => (
                <Box component="li" key={`${h.at}-${i}`}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t(`requisitionStatus.${h.to}`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {h.by[language]} · {formatTimestamp(h.at, language)}
                    {h.note ? ` · ${h.note}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Panel>
        </Stack>
      </Box>

      <Panel title={t('columns.candidates')}>
        <CandidatesSection requisitionId={r.id} />
      </Panel>

      {dialog?.kind === 'edit' && (
        <RequisitionFormDialog
          requisition={r}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            feedback.notify(t('requisitions.saved', { number: r.number }));
          }}
        />
      )}
      {dialog?.kind === 'status' && (
        <RequisitionStatusDialog
          requisition={r}
          status={dialog.status}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null);
            feedback.notify(t('requisitions.statusChanged', { number: next.number, status: t(`requisitionStatus.${next.status}`) }));
          }}
        />
      )}
      <Feedback {...feedback} />
    </>
  );
}
