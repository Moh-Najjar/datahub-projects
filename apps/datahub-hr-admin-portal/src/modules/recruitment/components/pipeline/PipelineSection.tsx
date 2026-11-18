import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import TableRowsOutlined from '@mui/icons-material/TableRowsOutlined';
import ViewKanbanOutlined from '@mui/icons-material/ViewKanbanOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { FilterSelect } from '@/modules/shared/ListToolbar';
import { useCandidates, useRecruitmentSummary, useRequisitions } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import { CANDIDATE_STAGES, type Candidate, type CandidateStage } from '@/modules/recruitment/types/recruitment';
import { personName } from '@/modules/recruitment/utils/format';
import { toMs } from '@/modules/recruitment/utils/pipeline';
import { CandidatesSection } from '../candidates/CandidatesSection';
import { useCandidateActions } from '../candidates/useCandidateActions';

const MAX = 100;

/**
 * Recruitment pipeline: candidates per stage (Kanban, scrollable columns) or as a list. Moves use the same API rules as
 * everywhere else (valid transitions only; "hired" only through an accepted offer; hired/rejected are final).
 */
export function PipelineSection() {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const requisitionId = params.get('requisition') ?? '';
  const view = params.get('view') === 'list' ? 'list' : 'board';
  const requisitions = useRequisitions({ page: 1, pageSize: 100, sortBy: 'number', sortDirection: 'desc' });
  const query = useCandidates({ page: 1, pageSize: MAX, sortBy: 'appliedAt', sortDirection: 'desc', filters: requisitionId ? { requisitionId } : {} }, view === 'board');
  // Column totals for the whole scope come from the summary (the board shows at most MAX cards).
  const summary = useRecruitmentSummary();
  const feedback = useFeedback();
  const actions = useCandidateActions(feedback.notify);
  const [now] = useState(() => Date.now());
  const byStage = useMemo(() => {
    const map = new Map<CandidateStage, Candidate[]>(CANDIDATE_STAGES.map((s) => [s, []]));
    for (const c of query.data?.items ?? []) map.get(c.stage)!.push(c);
    return map;
  }, [query.data]);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <section aria-label={t('pipeline.title')}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <FilterSelect label={t('fields.requisition')} value={requisitionId} onChange={(v) => setParam('requisition', v)} allLabel={t('filters.allRequisitions')} options={(requisitions.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.number} · ${r.title[language]}` }))} />
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v: string | null) => v && setParam('view', v === 'list' ? 'list' : '')} aria-label={t('pipeline.viewLabel')} sx={{ ml: { sm: 'auto' } }}>
          <ToggleButton value="board" aria-label={t('pipeline.board')}>
            <ViewKanbanOutlined fontSize="small" sx={{ mr: 0.75 }} />
            {t('pipeline.board')}
          </ToggleButton>
          <ToggleButton value="list" aria-label={t('pipeline.list')}>
            <TableRowsOutlined fontSize="small" sx={{ mr: 0.75 }} />
            {t('pipeline.list')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {view === 'list' ? (
        <CandidatesSection key={requisitionId} requisitionId={requisitionId || undefined} />
      ) : query.isError ? (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>{t('actions.retry')}</Button>}>
          {t('pipeline.loadError')}
        </Alert>
      ) : (
        <>
          {(query.data?.total ?? 0) > MAX && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {t('pipeline.limited', { shown: MAX, total: query.data!.total })}
            </Alert>
          )}
          {/* The board scrolls inside its own container: the page itself never overflows horizontally. */}
          <Box role="list" aria-label={t('pipeline.title')} tabIndex={0} sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, scrollSnapType: 'x proximity' }}>
            {CANDIDATE_STAGES.map((stage) => {
              const list = byStage.get(stage) ?? [];
              const count = requisitionId ? list.length : (summary.data?.byStage[stage] ?? list.length);
              return (
                <Paper key={stage} role="listitem" variant="outlined" aria-label={`${t(`stages.${stage}`)}: ${count}`} sx={{ flex: '0 0 260px', p: 1.5, bgcolor: 'background.default', scrollSnapAlign: 'start', minHeight: 180 }} data-column={stage}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" component="h3">
                      {t(`stages.${stage}`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" data-count={stage}>
                      {query.isPending ? '…' : formatNumber(count, language)}
                    </Typography>
                  </Box>
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
                    {query.isPending
                      ? [0, 1].map((i) => <Skeleton key={i} component="li" variant="rounded" height={64} />)
                      : list.map((c) => <CandidateCard key={c.id} candidate={c} now={now} showRequisition={!requisitionId} onMove={(s) => actions.open('move', c, s)} />)}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </>
      )}
      {actions.dialogs}
      <Feedback {...feedback} />
    </section>
  );
}

function CandidateCard({ candidate: c, now, showRequisition, onMove }: { candidate: Candidate; now: number; showRequisition: boolean; onMove: (stage: CandidateStage) => void }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const days = Math.max(0, Math.floor((now - toMs(c.appliedAt)) / 86_400_000));
  const name = personName(c.name, language);
  return (
    <Paper component="li" variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }} data-candidate={c.id}>
      <Link component={RouterLink} to={recruitmentPaths.candidate(c.id)} sx={{ fontWeight: 500, display: 'block' }}>
        {name}
      </Link>
      {showRequisition && (
        <Typography variant="caption" color="text.secondary" component="div" noWrap>
          {c.requisition.title[language]}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" component="div">
        {t('pipeline.appliedDaysAgo', { days: formatNumber(days, language) })}
      </Typography>
      {c.nextStages.length > 0 && (
        <>
          <Button size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu" aria-label={t('pipeline.moveFor', { name })} sx={{ mt: 0.5, px: 0.5, minWidth: 0 }}>
            {t('actions.moveStage')}
          </Button>
          <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
            {c.nextStages.map((s) => (
              <MenuItem
                key={s}
                onClick={() => {
                  setAnchor(null);
                  onMove(s);
                }}
              >
                {t('pipeline.moveTo', { stage: t(`stages.${s}`) })}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Paper>
  );
}
