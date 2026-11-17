import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useRecruitmentAccess } from '@/modules/recruitment/hooks/useRecruitmentAccess';
import { useCandidate, useCandidateHistory } from '@/modules/recruitment/hooks/useRecruitment';
import { employeeProfilePath, recruitmentPaths } from '@/modules/recruitment/paths';
import type { Candidate } from '@/modules/recruitment/types/recruitment';
import { formatDay, formatMoney, formatTimestamp, personName } from '@/modules/recruitment/utils/format';
import { StageChip } from '../common/StatusChips';
import { InterviewsSection } from '../interviews/InterviewsSection';
import { OffersSection } from '../offers/OffersSection';
import { useCandidateActions } from './useCandidateActions';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };
const TABS = ['profile', 'timeline', 'interviews', 'offers'] as const;
type TabKey = (typeof TABS)[number];

/** `/recruitment/candidates/:candidateId` — profile, timeline (stage history), interviews and offers. */
export function CandidateProfile() {
  const { t } = useTranslation('recruitment');
  const { candidateId = '' } = useParams();
  const query = useCandidate(candidateId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={recruitmentPaths.candidates} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToCandidates')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('candidates.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <CandidateView candidate={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function CandidateView({ candidate: c }: { candidate: Candidate }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const { canAny } = useAuth();
  const { canSeeOffers } = useRecruitmentAccess();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const feedback = useFeedback();
  const actions = useCandidateActions(feedback.notify, { includeView: false });
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((k) => k !== 'offers' || canSeeOffers);
  const requested = params.get('tab') as TabKey | null;
  const tab: TabKey = requested && tabs.includes(requested) ? requested : 'profile';
  const name = personName(c.name, language);
  useBreadcrumbs([{ label: t('tabs.candidates'), to: recruitmentPaths.candidates }, { label: name }]);
  const ltr = (v: string) => (v ? <Box component="span" dir="ltr" sx={{ overflowWrap: 'anywhere' }}>{v}</Box> : '—');

  return (
    <>
      {notice && <Alert severity="success">{notice}</Alert>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2">
            {name}
          </Typography>
          <Chip size="small" variant="outlined" label={c.number} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <StageChip stage={c.stage} />
          {c.archived && <Chip size="small" label={t('candidates.archivedChip')} />}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {actions.actionsFor(c).map((a) => {
            const Icon = a.icon;
            return a.to ? (
              <Button key={a.label} component={RouterLink} to={a.to} variant="contained" startIcon={<Icon />}>
                {a.label}
              </Button>
            ) : (
              <Button key={a.label} variant="outlined" startIcon={<Icon />} onClick={a.onClick}>
                {a.label}
              </Button>
            );
          })}
        </Box>
      </Box>
      {c.can.convert && <Alert severity="success">{t('conversion.readyHint')}</Alert>}
      {c.employeeId && (
        <Alert severity="info">
          {t('conversion.converted')}{' '}
          {canAny(['employees:read', 'employees:read:team']) && (
            <Link component={RouterLink} to={employeeProfilePath(c.employeeId)}>
              {t('conversion.openEmployee')}
            </Link>
          )}
        </Alert>
      )}
      {c.stage === 'hired' && !c.employeeId && !c.can.convert && <Alert severity="info">{t('conversion.needsHr')}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} variant="scrollable" scrollButtons={false} onChange={(_, v: TabKey) => setParams(v === 'profile' ? {} : { tab: v }, { replace: true })} aria-label={t('candidates.tabsLabel')}>
          {tabs.map((k) => (
            <Tab key={k} value={k} label={t(`candidates.tabs.${k}`)} id={`candidate-tab-${k}`} aria-controls="candidate-tabpanel" />
          ))}
        </Tabs>
      </Box>
      <Box role="tabpanel" id="candidate-tabpanel" aria-labelledby={`candidate-tab-${tab}`}>
        {tab === 'profile' && (
          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
            <Panel title={t('candidates.sections.personal')}>
              <DetailList
                items={[
                  { label: t('fields.nameEn'), value: <span dir="ltr">{`${c.name.first.en} ${c.name.last.en}`}</span> },
                  { label: t('fields.nameAr'), value: c.name.first.ar ? <span dir="rtl">{`${c.name.first.ar} ${c.name.last.ar}`}</span> : '—' },
                  { label: t('fields.email'), value: ltr(c.email) },
                  { label: t('fields.phone'), value: ltr(c.phone) },
                  { label: t('fields.location'), value: c.location || '—' },
                ]}
              />
            </Panel>
            <Panel title={t('candidates.sections.professional')}>
              <DetailList
                items={[
                  { label: t('fields.currentTitle'), value: c.currentTitle || '—' },
                  { label: t('fields.currentCompany'), value: c.currentCompany || '—' },
                  { label: t('fields.experienceYears'), value: t('units.years', { count: c.experienceYears, value: formatNumber(c.experienceYears, language) }) },
                  { label: t('fields.education'), value: t(`education.${c.education}`) },
                  { label: t('fields.candidateSkills'), value: c.skills.join(', ') || '—' },
                  { label: t('fields.languages'), value: c.languages.join(', ') || '—' },
                  { label: t('fields.linkedinUrl'), value: ltr(c.linkedinUrl) },
                  { label: t('fields.portfolioUrl'), value: ltr(c.portfolioUrl) },
                ]}
              />
            </Panel>
            <Panel title={t('candidates.sections.recruitment')}>
              <DetailList
                items={[
                  { label: t('fields.appliedPosition'), value: <Link component={RouterLink} to={recruitmentPaths.requisition(c.requisition.id)}>{`${c.requisition.number} · ${c.requisition.title[language]}`}</Link> },
                  { label: t('fields.appliedAt'), value: formatDay(c.appliedAt, language) },
                  { label: t('fields.source'), value: t(`sources.${c.source}`) },
                  { label: t('fields.recruiter'), value: c.recruiter?.name[language] ?? '—' },
                  { label: t('fields.stage'), value: <StageChip stage={c.stage} /> },
                  ...(canSeeOffers ? [{ label: t('fields.expectedSalary'), value: c.expectedSalary === null ? '—' : <span dir="ltr">{formatMoney(c.expectedSalary, 'JOD', language)}</span> }] : []),
                  ...(canSeeOffers ? [{ label: t('fields.notes'), value: c.notes || '—' }] : []),
                ]}
              />
            </Panel>
          </Box>
        )}
        {tab === 'timeline' && <Timeline candidateId={c.id} />}
        {tab === 'interviews' && <InterviewsSection candidateId={c.id} />}
        {tab === 'offers' && canSeeOffers && <OffersSection candidateId={c.id} />}
      </Box>
      {actions.dialogs}
      <Feedback {...feedback} />
    </>
  );
}

/** Every recorded event of the candidate, newest first (stage changes, interviews, offers, conversion). */
function Timeline({ candidateId }: { candidateId: string }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const query = useCandidateHistory(candidateId);
  return (
    <QueryBoundary query={query} notFoundText={t('candidates.notFound')} forbiddenText={t('details.forbidden')}>
      <Panel title={t('candidates.timeline')}>
        <Box component="ol" aria-label={t('candidates.timeline')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
          {(query.data ?? []).map((h, i) => (
            <Box component="li" key={`${h.at}-${i}`} sx={{ pl: 1.5, borderLeft: 3, borderColor: h.to === 'rejected' ? 'error.main' : h.to === 'hired' ? 'success.main' : 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {h.type === 'stage' || h.type === 'reopened' ? t(`events.${h.type}`, { from: h.from ? t(`stages.${h.from}`) : '', to: h.to ? t(`stages.${h.to}`) : '' }) : t(`events.${h.type}`)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {h.by[language]} · {formatTimestamp(h.at, language)}
              </Typography>
              {h.note && h.type !== 'feedback' && (
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  {h.note}
                </Typography>
              )}
              {h.type === 'feedback' && h.note && (
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  {t(`recommendations.${h.note as 'hire'}`)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Panel>
    </QueryBoundary>
  );
}
