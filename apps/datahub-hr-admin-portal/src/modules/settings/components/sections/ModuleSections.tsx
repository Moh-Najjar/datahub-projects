import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { CANDIDATE_SOURCES, CANDIDATE_STAGES, INTERVIEW_TYPES } from '@/modules/recruitment';
import { Panel } from '@/modules/shared/Panel';
import { useDocumentFacts, useLeaveTypeFacts, useOrganizationFacts, usePayrollFacts, usePerformanceFacts, useShiftFacts } from '@/modules/settings/hooks/useModuleSettings';
import { CURRENCIES } from '@/modules/settings/types/settings';
import { FactList, ManageLinks, QueryState } from '../common/Facts';

/*
 * Configuration that already belongs to a module, summarised read-only with links to the module's own screen (one
 * place to change it, no duplicated settings). Figures appear only when the user may read that module.
 */

function useNav() {
  const { t } = useTranslation();
  return (key: 'organization' | 'attendance' | 'leave' | 'recruitment' | 'performance' | 'payroll' | 'documents' | 'users') => t(`nav.items.${key}`);
}
const chips = (labels: string[]) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
    {labels.map((l) => (
      <Chip key={l} size="small" variant="outlined" label={l} />
    ))}
  </Box>
);
const stack = { display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' } as const;

export function CompanySection() {
  const { t } = useTranslation('settings');
  const { t: to } = useTranslation('organization');
  const { language } = useLanguage();
  const nav = useNav();
  const facts = useOrganizationFacts();
  const count = (c: { total: number; active: number } | undefined) => (c ? `${formatNumber(c.active, language)} / ${formatNumber(c.total, language)}` : '—');
  return (
    <Panel title={t('categories.company.title')} subtitle={t('categories.company.description')}>
      <Box sx={stack}>
        <QueryState query={facts}>
          <FactList
            items={[
              { label: to('tabs.departments'), value: count(facts.data?.departments) },
              { label: to('tabs.positions'), value: count(facts.data?.positions) },
              { label: to('tabs.locations'), value: count(facts.data?.locations) },
            ]}
          />
        </QueryState>
        <ManageLinks links={[{ to: '/organization/departments', label: nav('organization') }]} />
      </Box>
    </Panel>
  );
}

export function AttendanceSection() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const nav = useNav();
  const shifts = useShiftFacts();
  const active = shifts.data?.items.filter((s) => s.status === 'active') ?? [];
  const grace = active.length ? Math.round(active.reduce((s, x) => s + x.graceMinutes, 0) / active.length) : 0;
  return (
    <Panel title={t('categories.attendance.title')} subtitle={t('attendance.intro')}>
      <Box sx={stack}>
        <QueryState query={shifts}>
          <FactList
            items={[
              { label: t('attendance.shifts'), value: t('attendance.shiftsValue', { active: formatNumber(active.length, language), grace: formatNumber(grace, language) }) },
              { label: t('attendance.punches'), value: t('attendance.punchRules') },
            ]}
          />
        </QueryState>
        <Box>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, mb: 1 }}>
            {t('attendance.rules')}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75 }}>
            {(['scheduled', 'absent', 'late', 'halfDay', 'incomplete', 'overtime'] as const).map((k) => (
              <Typography key={k} component="li" variant="body2">
                {t(`attendance.rule.${k}`)}
              </Typography>
            ))}
          </Box>
        </Box>
        <ManageLinks links={[{ to: '/attendance/shifts', label: nav('attendance') }]} />
      </Box>
    </Panel>
  );
}

export function LeaveSection() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const nav = useNav();
  const types = useLeaveTypeFacts();
  const yes = (v: boolean) => (v ? t('leave.required') : t('leave.notRequired'));
  return (
    <Panel title={t('categories.leave.title')} subtitle={t('leave.intro')}>
      <Box sx={stack}>
        <QueryState query={types}>
          <TableContainer sx={{ overflowX: 'auto', position: 'relative' }}>
            <Table size="small" aria-label={t('leave.types')} sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  {(['type', 'paid', 'allowance', 'maxConsecutive', 'document', 'approval', 'status'] as const).map((c) => (
                    <TableCell key={c} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {t(`leave.${c}`)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(types.data?.items ?? []).map((lt) => (
                  <TableRow key={lt.id}>
                    <TableCell>{lt.name[language]}</TableCell>
                    <TableCell>{lt.paid ? t('leave.paid') : t('leave.unpaid')}</TableCell>
                    <TableCell>{lt.annualAllocation === null ? t('leave.noAllowance') : formatNumber(lt.annualAllocation, language)}</TableCell>
                    <TableCell>{lt.maxConsecutiveDays === null ? t('leave.noAllowance') : formatNumber(lt.maxConsecutiveDays, language)}</TableCell>
                    <TableCell>{yes(lt.requiresDocument)}</TableCell>
                    <TableCell>{yes(lt.requiresApproval)}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" color={lt.status === 'active' ? 'success' : 'default'} label={t(`calendar.statuses.${lt.status}`)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </QueryState>
        <FactList
          items={[
            { label: t('leave.leaveYear'), value: t('leave.leaveYearValue') },
            { label: t('leave.routing'), value: t('leave.routingValue') },
            { label: t('leave.notSupported'), value: t('leave.notSupportedValue') },
          ]}
        />
        <ManageLinks links={[{ to: '/leave/types', label: nav('leave') }]} />
      </Box>
    </Panel>
  );
}

export function RecruitmentSection() {
  const { t } = useTranslation('settings');
  const { t: tr } = useTranslation('recruitment');
  const nav = useNav();
  return (
    <Panel title={t('categories.recruitment.title')} subtitle={t('recruitment.intro')}>
      <Box sx={stack}>
        <FactList
          items={[
            { label: t('recruitment.stages'), value: chips(CANDIDATE_STAGES.map((s) => tr(`stages.${s}`))) },
            { label: t('recruitment.sources'), value: chips(CANDIDATE_SOURCES.map((s) => tr(`sources.${s}`))) },
            { label: t('recruitment.interviewTypes'), value: chips(INTERVIEW_TYPES.map((s) => tr(`interviewTypes.${s}`))) },
            { label: t('recruitment.requisitions'), value: t('recruitment.requisitionsValue') },
            { label: t('recruitment.offers'), value: t('recruitment.offersValue') },
          ]}
        />
        <ManageLinks links={[{ to: '/recruitment/requisitions', label: nav('recruitment') }]} />
      </Box>
    </Panel>
  );
}

export function PerformanceSection() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const nav = useNav();
  const { scale, cycles } = usePerformanceFacts();
  const open = cycles.data?.items.filter((c) => c.status === 'active' || c.status === 'in-progress').length ?? 0;
  return (
    <Panel title={t('categories.performance.title')} subtitle={t('performance.intro')}>
      <Box sx={stack}>
        <QueryState query={scale}>
          <FactList
            items={[
              { label: t('performance.scale'), value: chips((scale.data ?? []).map((l) => `${formatNumber(l.value, language)} · ${l.label[language]}`)) },
              { label: t('performance.cycles'), value: cycles.data ? t('performance.cyclesValue', { active: formatNumber(open, language), total: formatNumber(cycles.data.total, language) }) : '—' },
              { label: t('performance.frequency'), value: t('performance.frequencyValue') },
              { label: t('performance.workflow'), value: t('performance.workflowValue') },
              { label: t('performance.goals'), value: t('performance.goalsValue') },
            ]}
          />
        </QueryState>
        <ManageLinks links={[{ to: '/performance/cycles', label: nav('performance') }]} />
      </Box>
    </Panel>
  );
}

export function PayrollSection() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const nav = useNav();
  const { can } = useAuth();
  const policy = usePayrollFacts();
  if (!can('hr.payroll.view')) return <Alert severity="info">{t('readOnly')}</Alert>;
  return (
    <Panel title={t('categories.payroll.title')} subtitle={t('payroll.intro')}>
      <Box sx={stack}>
        <QueryState query={policy}>
          <FactList
            items={[
              { label: t('payroll.frequency'), value: t('payroll.frequencyValue') },
              { label: t('payroll.currencies'), value: <bdi dir="ltr">{CURRENCIES.join(' · ')}</bdi> },
              { label: t('payroll.divisor'), value: t('payroll.divisorValue', { value: formatNumber(policy.data?.dailyRateDivisor ?? 30, language) }) },
              { label: t('payroll.rounding'), value: t('payroll.roundingValue') },
              { label: t('payroll.proration'), value: t('payroll.prorationValue') },
              { label: t('payroll.overtime'), value: t('payroll.overtimeValue') },
              { label: t('payroll.statutory'), value: t('payroll.statutoryValue') },
              { label: t('payroll.approval'), value: t('payroll.approvalValue') },
            ]}
          />
        </QueryState>
        <ManageLinks
          links={[
            { to: '/payroll/structures', label: `${nav('payroll')} · ${t('payroll.components')}` },
            { to: '/payroll/deductions', label: `${nav('payroll')} · ${t('payroll.divisor')}` },
          ]}
        />
      </Box>
    </Panel>
  );
}

export function DocumentsSection() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const nav = useNav();
  const { settings, categories, rules } = useDocumentFacts();
  const n = (v: number) => formatNumber(v, language);
  return (
    <Panel title={t('categories.documents.title')} subtitle={t('documents.intro')}>
      <Box sx={stack}>
        <QueryState query={settings}>
          <FactList
            items={[
              { label: t('documents.expiryWarning'), value: t('documents.expiryWarningValue', { value: n(settings.data?.expiryWarningDays ?? 0) }) },
              { label: t('documents.categories'), value: categories.data ? t('documents.categoriesValue', { active: n(categories.data.items.filter((c) => c.status === 'active').length), total: n(categories.data.total) }) : '—' },
              { label: t('documents.fileRules'), value: t('documents.fileRulesValue') },
              { label: t('documents.required'), value: rules.data ? t('documents.requiredValue', { value: n(rules.data.filter((r) => r.status === 'active').length) }) : '—' },
              { label: t('documents.verification'), value: t('documents.verificationValue') },
            ]}
          />
        </QueryState>
        <ManageLinks
          links={[
            { to: '/documents/categories', label: nav('documents') },
            { to: '/documents/required', label: `${nav('documents')} · ${t('documents.required')}` },
          ]}
        />
      </Box>
    </Panel>
  );
}

export function WorkflowsSection() {
  const { t } = useTranslation('settings');
  const nav = useNav();
  const items = ['leave', 'payroll', 'requisition', 'offer', 'document', 'review'] as const;
  return (
    <Panel title={t('categories.workflows.title')} subtitle={t('workflows.intro')}>
      <Box sx={stack}>
        <TableContainer sx={{ overflowX: 'auto', position: 'relative' }}>
          <Table size="small" aria-label={t('categories.workflows.title')} sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('categories.workflows.title')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('workflows.stages')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('workflows.approvers')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((k) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 500 }}>{t(`workflows.items.${k}.title`)}</TableCell>
                  <TableCell>{t(`workflows.items.${k}.stages`)}</TableCell>
                  <TableCell>{t(`workflows.items.${k}.approvers`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <FactList
          items={[
            { label: t('workflows.pending'), value: t('workflows.pendingValue') },
            { label: t('workflows.escalation'), value: t('workflows.escalationValue') },
          ]}
        />
        <ManageLinks links={[{ to: '/users/permissions', label: nav('users') }]} />
      </Box>
    </Panel>
  );
}
