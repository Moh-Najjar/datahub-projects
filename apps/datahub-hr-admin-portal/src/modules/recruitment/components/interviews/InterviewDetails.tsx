import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Rating from '@mui/material/Rating';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useInterview } from '@/modules/recruitment/hooks/useRecruitment';
import { recruitmentPaths } from '@/modules/recruitment/paths';
import type { Interview } from '@/modules/recruitment/types/recruitment';
import { formatDateTime, formatTimestamp, personName } from '@/modules/recruitment/utils/format';
import { InterviewStatusChip } from '../common/StatusChips';
import { useInterviewActions } from './useInterviewActions';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/recruitment/interviews/:interviewId` — schedule, interviewers and the feedback the caller may read. */
export function InterviewDetails() {
  const { t } = useTranslation('recruitment');
  const { interviewId = '' } = useParams();
  const query = useInterview(interviewId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={recruitmentPaths.interviews} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToInterviews')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('interviews.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <InterviewView interview={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function InterviewView({ interview: i }: { interview: Interview }) {
  const { t } = useTranslation('recruitment');
  const { language } = useLanguage();
  const feedback = useFeedback();
  const actions = useInterviewActions(feedback.notify, { includeView: false });
  const name = personName(i.candidate.name, language);
  useBreadcrumbs([{ label: t('tabs.interviews'), to: recruitmentPaths.interviews }, { label: `${name} · ${formatDateTime(i.start, language)}` }]);
  const hidden = i.feedbackCount - i.feedback.length;

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {t(`interviewTypes.${i.type}`)} · {name}
          </Typography>
          <InterviewStatusChip status={i.status} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {actions.actionsFor(i).map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant="outlined" startIcon={<Icon />} onClick={a.onClick}>
                {a.label}
              </Button>
            );
          })}
        </Box>
      </Box>
      <Alert severity="info">{t('interviews.simulatedNote')}</Alert>
      {i.status === 'cancelled' && i.cancelReason && <Alert severity="warning">{t('interviews.cancelledBecause', { reason: i.cancelReason })}</Alert>}
      <Panel title={t('interviews.details')}>
        <DetailList
          items={[
            { label: t('fields.candidate'), value: <Link component={RouterLink} to={recruitmentPaths.candidate(i.candidate.id)}>{`${name} (${i.candidate.number})`}</Link> },
            { label: t('fields.requisition'), value: <Link component={RouterLink} to={recruitmentPaths.requisition(i.requisition.id)}>{i.requisition.title[language]}</Link> },
            { label: t('fields.start'), value: formatDateTime(i.start, language) },
            { label: t('fields.duration'), value: t('units.minutes', { value: i.durationMinutes }) },
            { label: t('fields.interviewers'), value: i.interviewers.map((p) => p.name[language]).join(', ') },
            { label: t('fields.interviewLocation'), value: i.location || '—' },
            { label: t('fields.meetingLink'), value: i.meetingLink ? <Box component="span" dir="ltr" sx={{ overflowWrap: 'anywhere' }}>{i.meetingLink}</Box> : '—' },
            { label: t('fields.notes'), value: i.notes || '—' },
          ]}
        />
      </Panel>
      <Panel title={t('feedback.listTitle')} subtitle={t('feedback.privacy')}>
        {i.feedback.length === 0 ? (
          <Typography color="text.secondary">{i.feedbackCount > 0 ? t('feedback.hidden', { count: i.feedbackCount }) : t('feedback.none')}</Typography>
        ) : (
          <Stack spacing={2}>
            {i.feedback.map((f) => (
              <Paper key={f.interviewer.id} variant="outlined" sx={{ p: 2 }} data-feedback={f.interviewer.id}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2">{f.interviewer.name[language]}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`recommendations.${f.recommendation}`)} · {formatTimestamp(f.submittedAt, language)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, mb: 1 }}>
                  {(['overall', 'technical', 'communication', 'problemSolving', 'experience'] as const).map((k) => (
                    <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 140 }}>
                        {t(`feedback.ratings.${k}`)}
                      </Typography>
                      <Box dir="ltr">
                        <Rating value={f[k]} readOnly size="small" getLabelText={(v) => t('feedback.ratingLabel', { value: v })} />
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Typography variant="body2">
                  <strong>{t('feedback.strengths')}:</strong> {f.strengths}
                </Typography>
                <Typography variant="body2">
                  <strong>{t('feedback.improvements')}:</strong> {f.improvements}
                </Typography>
              </Paper>
            ))}
            {hidden > 0 && <Typography color="text.secondary">{t('feedback.hidden', { count: hidden })}</Typography>}
          </Stack>
        )}
      </Panel>
      {actions.dialogs}
      <Feedback {...feedback} />
    </>
  );
}
