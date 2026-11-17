import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { StatusChip } from '@/modules/shared/StatusChip';
import { useLeaveAccess } from '@/modules/leave/hooks/useLeaveAccess';
import { useLeaveType } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import type { LeaveType } from '@/modules/leave/types/leave';
import { formatDays } from '@/modules/leave/utils/format';
import { TypeFormDialog } from './TypeFormDialog';
import { useTypeStatusFlow } from '@/modules/leave/hooks/useTypeStatusFlow';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/leave/types/:typeId` — a leave type and its configurable rules. */
export function TypeDetails() {
  const { t } = useTranslation('leave');
  const { typeId = '' } = useParams();
  const query = useLeaveType(typeId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={leavePaths.types} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToTypes')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('types.notFound')} forbiddenText={t('details.forbidden')}>
        {query.data && <TypeView leaveType={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

function TypeView({ leaveType: x }: { leaveType: LeaveType }) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const { canManagePolicies } = useLeaveAccess();
  const feedback = useFeedback();
  const status = useTypeStatusFlow(feedback.notify);
  const [editing, setEditing] = useState(false);
  useBreadcrumbs([{ label: t('tabs.types'), to: leavePaths.types }, { label: x.name[language] }]);
  const yesNo = (v: boolean) => (v ? t('common.yes') : t('common.no'));
  const days = (v: number | null) => (v === null ? t('balances.noLimit') : formatDays(t, v, language));

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {x.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={x.code} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <StatusChip status={x.status} />
        </Box>
        {canManagePolicies && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditing(true)}>
              {t('actions.edit')}
            </Button>
            <Button variant="outlined" color={x.status === 'active' ? 'error' : 'primary'} onClick={() => status.request(x)}>
              {x.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
            </Button>
          </Box>
        )}
      </Box>
      <Alert severity="info">{t('types.policyNote')}</Alert>
      {x.status === 'inactive' && <Alert severity="warning">{t('types.inactiveNote')}</Alert>}
      <Panel title={t('types.rules')} subtitle={x.description || undefined}>
        <DetailList
          items={[
            { label: t('fields.nameEn'), value: <span dir="ltr">{x.name.en}</span> },
            { label: t('fields.nameAr'), value: <span dir="rtl">{x.name.ar}</span> },
            { label: t('fields.paid'), value: x.paid ? t('types.paid') : t('types.unpaid') },
            { label: t('fields.annualAllocation'), value: days(x.annualAllocation) },
            { label: t('fields.seniorityRule'), value: x.seniorityYears > 0 ? t('types.seniorityRule', { years: formatNumber(x.seniorityYears, language), days: formatNumber(x.seniorityExtraDays, language) }) : '—' },
            { label: t('fields.prorateFirstYear'), value: yesNo(x.prorateFirstYear) },
            { label: t('fields.maxConsecutiveDays'), value: days(x.maxConsecutiveDays) },
            { label: t('fields.requiresApproval'), value: yesNo(x.requiresApproval) },
            { label: t('fields.requiresDocument'), value: yesNo(x.requiresDocument) },
            { label: t('fields.excludesPublicHolidays'), value: yesNo(x.excludesPublicHolidays) },
            { label: t('fields.eligibility'), value: t(`eligibility.${x.eligibility}`) },
          ]}
        />
      </Panel>
      {editing && (
        <TypeFormDialog
          leaveType={x}
          onClose={() => setEditing(false)}
          onDone={(saved) => {
            setEditing(false);
            feedback.notify(t('types.saved', { name: saved.name[language] }));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </>
  );
}
