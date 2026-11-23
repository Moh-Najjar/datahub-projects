import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useAuth } from '@/core/context/authContext';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useLeaveAccess } from '@/modules/leave/hooks/useLeaveAccess';
import { useLeaveRequest } from '@/modules/leave/hooks/useLeave';
import { externalPaths, leavePaths } from '@/modules/leave/paths';
import type { LeaveRequest } from '@/modules/leave/types/leave';
import { formatDay, formatDays, formatRange, formatTimestamp } from '@/modules/leave/utils/format';
import { LeaveStatusChip } from '../common/LeaveStatusChip';
import { useRequestActions } from './useRequestActions';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/leave/requests/:requestId` — one request, its decision trail and the actions the API allows. */
export function RequestDetails() {
  const { t } = useTranslation('leave');
  const { requestId = '' } = useParams();
  const { canReadBeyondOwn } = useLeaveAccess();
  const query = useLeaveRequest(requestId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={canReadBeyondOwn ? leavePaths.requests : leavePaths.overview} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {canReadBeyondOwn ? t('actions.backToRequests') : t('actions.backToMyLeave')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('details.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <RequestView request={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function RequestView({ request: r }: { request: LeaveRequest }) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const { can } = useAuth();
  const { canReadBeyondOwn } = useLeaveAccess();
  const feedback = useFeedback();
  const actions = useRequestActions(feedback.notify, { includeView: false });
  useBreadcrumbs([...(canReadBeyondOwn ? [{ label: t('tabs.requests'), to: leavePaths.requests }] : []), { label: r.number }]);
  const name = r.employee.name[language];
  const canSeeEmployee = can('organization.employees.view') || can('hr.employees.view.team');
  const canSeeAttendance = can('hr.attendance.view') || can('hr.attendance.view.team');

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2" dir="ltr" sx={{ fontFamily: 'monospace' }}>
            {r.number}
          </Typography>
          <LeaveStatusChip status={r.status} />
          <Chip size="small" variant="outlined" label={r.leaveType.paid ? t('types.paid') : t('types.unpaid')} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {r.status === 'approved' && canSeeAttendance && (
            <Button component={RouterLink} to={externalPaths.attendanceHistory(r.employeeId, r.startDate.slice(0, 7))} variant="outlined" startIcon={<EventAvailableOutlined />}>
              {t('actions.viewAttendance')}
            </Button>
          )}
          {actions.actionsFor(r).map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} variant={a.label === t('actions.approve') ? 'contained' : 'outlined'} color={a.label === t('actions.reject') || a.label === t('actions.cancelRequest') ? 'error' : 'primary'} startIcon={<Icon />} onClick={a.onClick}>
                {a.label}
              </Button>
            );
          })}
        </Box>
      </Box>

      {r.status === 'rejected' && r.rejectionReason && <Alert severity="error">{t('details.rejectedBecause', { reason: r.rejectionReason })}</Alert>}
      {r.status === 'approved' && <Alert severity="success">{t('details.attendanceNote')}</Alert>}
      {r.status === 'draft' && <Alert severity="info">{t('details.draftNote')}</Alert>}

      <Panel title={t('details.title')} subtitle={formatRange(r.startDate, r.endDate, language)}>
        <DetailList
          items={[
            { label: t('fields.leaveType'), value: `${r.leaveType.name[language]} (${r.leaveType.code})` },
            { label: t('fields.startDate'), value: formatDay(r.startDate, language, { dateStyle: 'full' }) },
            { label: t('fields.endDate'), value: formatDay(r.endDate, language, { dateStyle: 'full' }) },
            { label: t('fields.days'), value: formatDays(t, r.days, language) },
            { label: t('fields.reason'), value: r.reason === null ? <Typography component="span" color="text.secondary">{t('details.restricted')}</Typography> : r.reason || '—' },
            {
              label: t('fields.document'),
              value:
                r.document === null ? (
                  '—'
                ) : (
                  <>
                    <Box component="span" dir="ltr">{t('details.document', { name: r.document.fileName, size: Math.ceil(r.document.sizeBytes / 1024) })}</Box>
                    {/* The attachment is registered in Documents Management (same file reference, not a copy). */}
                    {can('hr.documents.view') && (
                      <Link component={RouterLink} to={externalPaths.documentsFor(r.number)} sx={{ display: 'block' }}>
                        {t('details.viewInDocuments')}
                      </Link>
                    )}
                  </>
                ),
            },
            { label: t('columns.submitted'), value: r.submittedAt ? formatTimestamp(r.submittedAt, language) : '—' },
            { label: t('fields.decidedBy'), value: r.decidedBy ? `${r.decidedBy[language]} · ${formatTimestamp(r.decidedAt!, language)}` : '—' },
          ]}
        />
      </Panel>

      <Panel title={t('fields.employee')} subtitle={t('details.snapshotNote')}>
        <DetailList
          items={[
            {
              label: t('fields.employee'),
              value: canSeeEmployee ? (
                <Link component={RouterLink} to={externalPaths.employee(r.employeeId)}>
                  {name}
                </Link>
              ) : (
                name
              ),
            },
            { label: t('fields.employeeNumber'), value: <Box component="span" dir="ltr">{r.employee.employeeNumber}</Box> },
            { label: t('fields.department'), value: r.employee.department.name[language] },
            ...(canReadBeyondOwn ? [{ label: t('balances.title'), value: <Link component={RouterLink} to={leavePaths.employeeBalances(r.employeeId, Number(r.startDate.slice(0, 4)))}>{t('actions.viewBalances')}</Link> }] : []),
          ]}
        />
      </Panel>

      <Panel title={t('details.history')}>
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
          {r.history.map((h, i) => (
            <Box component="li" key={`${h.at}-${i}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t(`historyActions.${h.action}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {h.by[language]} · {formatTimestamp(h.at, language)}
              </Typography>
              {h.note && (
                <Typography variant="body2" sx={{ flexBasis: '100%' }}>
                  {h.note}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Panel>
      {actions.dialogs}
      <Feedback {...feedback} />
    </>
  );
}
