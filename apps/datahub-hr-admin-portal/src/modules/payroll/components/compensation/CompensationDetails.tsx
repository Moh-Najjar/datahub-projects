import { lazy, Suspense, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { useLanguage } from '@/i18n/useLanguage';
import { employeePaths } from '@/modules/employees';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useCompensation } from '@/modules/payroll/hooks/usePayroll';
import { usePayrollAccess } from '@/modules/payroll/hooks/usePayrollAccess';
import { payrollPaths } from '@/modules/payroll/paths';
import type { EmployeeAllowance, EmployeeCompensationDetail, EmployeeDeduction } from '@/modules/payroll/types/payroll';
import { formatDay, formatPercent, formatTimestamp } from '@/modules/payroll/utils/format';
import { CompensationStatusChip, IllustrativeChip, StateChip } from '../common/Chips';
import { Code, Money } from '../common/Money';
import { AssignmentDialog, CompensationFormDialog, EndAssignmentDialog } from './CompensationDialogs';

// Payroll supporting documents live in Documents Management (one store); shown lazily, payroll categories only.
const PayrollDocumentsPanel = lazy(() => import('@/modules/documents').then((m) => ({ default: m.PayrollDocumentsPanel })));

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/payroll/compensation/:employeeId` — current compensation, salary history, allowances and deductions. */
export function CompensationDetails() {
  const { t } = useTranslation('payroll');
  const { employeeId = '' } = useParams();
  const query = useCompensation(employeeId);
  const feedback = useFeedback();
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={payrollPaths.compensation} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToCompensation')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('compensation.notFound')}>
        {query.data && <DetailView detail={query.data} notify={feedback.notify} />}
      </QueryBoundary>
      <Feedback {...feedback} />
    </Stack>
  );
}

type DialogState = { kind: 'compensation' } | { kind: 'assign'; type: 'allowance' | 'deduction' } | { kind: 'end'; assignment: EmployeeAllowance | EmployeeDeduction } | null;

function DetailView({ detail: d, notify }: { detail: EmployeeCompensationDetail; notify: (text: string) => void }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const { canWrite } = usePayrollAccess();
  const [dialog, setDialog] = useState<DialogState>(null);
  const name = d.employee.name[language];
  useBreadcrumbs([{ label: t('tabs.compensation'), to: payrollPaths.compensation }, { label: name }]);
  const close = () => setDialog(null);
  const done = (text: string) => () => {
    close();
    notify(text);
  };
  const editable = canWrite && d.can.update;

  const assignments = (rows: ReadonlyArray<EmployeeAllowance | EmployeeDeduction>, label: string) =>
    rows.length === 0 ? (
      <Typography color="text.secondary">{t('compensation.noAssignments')}</Typography>
    ) : (
      <TableContainer sx={{ position: 'relative' }}>
        <Table size="small" aria-label={label}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('fields.item')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }} align="right">
                {t('fields.amount')}
              </TableCell>
              <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('fields.validity')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('fields.status')}</TableCell>
              {editable && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                    {a.type.name[language]} <Code>{a.type.code}</Code>
                    {'illustrative' in a.type && a.type.illustrative && <IllustrativeChip />}
                  </Box>
                  {a.note && (
                    <Typography variant="caption" color="text.secondary">
                      {a.note}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{a.calculation === 'percentage' ? <span dir="ltr">{formatPercent(a.percentage ?? 0)}</span> : <Money value={a.amount ?? 0} currency={a.currency} />}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  {a.recurrence === 'one-time' ? t('compensation.oneTimeOn', { date: formatDay(a.effectiveFrom, language) }) : `${formatDay(a.effectiveFrom, language)} – ${a.effectiveTo ? formatDay(a.effectiveTo, language) : t('compensation.openEnded')}`}
                </TableCell>
                <TableCell>
                  <StateChip state={a.state} />
                </TableCell>
                {editable && (
                  <TableCell align="right">
                    {a.recurrence === 'recurring' && a.state !== 'ended' && (
                      <Button size="small" onClick={() => setDialog({ kind: 'end', assignment: a })}>
                        {t('actions.end')}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {name}
          </Typography>
          <Chip size="small" variant="outlined" label={<Code>{d.employee.employeeNumber}</Code>} />
          <CompensationStatusChip status={d.status} />
          {d.employee.status === 'inactive' && <Chip size="small" label={t('employmentStatus.inactive')} />}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button component={RouterLink} to={employeePaths.profile(d.employeeId)}>
            {t('actions.viewProfile')}
          </Button>
          {editable && (
            <Button variant="contained" onClick={() => setDialog({ kind: 'compensation' })}>
              {d.current ? t('actions.updateCompensation') : t('actions.setCompensation')}
            </Button>
          )}
        </Box>
      </Box>

      <Panel title={t('compensation.current')}>
        {d.current ? (
          <DetailList
            items={[
              { label: t('fields.basicSalary'), value: <Money value={d.current.basicSalary} currency={d.current.currency} strong /> },
              { label: t('fields.structure'), value: <><Code>{d.current.structure.code}</Code> {d.current.structure.name[language]}</> },
              { label: t('fields.payFrequency'), value: t(`payFrequency.${d.current.payFrequency}`) },
              { label: t('fields.effectiveFrom'), value: formatDay(d.current.effectiveFrom, language) },
              { label: t('fields.department'), value: d.employee.department.name[language] },
              { label: t('fields.position'), value: d.employee.position.name[language] },
              { label: t('fields.employmentType'), value: t(`employmentType.${d.employee.employmentType}`) },
              { label: t('fields.hireDate'), value: formatDay(d.employee.hireDate, language) },
            ]}
          />
        ) : (
          <Typography color="text.secondary">{d.status === 'scheduled' ? t('compensation.onlyScheduled') : t('compensation.missing')}</Typography>
        )}
      </Panel>

      <Panel title={t('compensation.history')} subtitle={t('compensation.historySubtitle')}>
        {d.history.length === 0 ? (
          <Typography color="text.secondary">{t('compensation.noHistory')}</Typography>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('compensation.history')}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.validity')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {t('fields.basicSalary')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.structure')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('fields.reason')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', lg: 'table-cell' } }}>{t('fields.recordedBy')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.status')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {d.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {formatDay(h.effectiveFrom, language)} – {h.effectiveTo ? formatDay(h.effectiveTo, language) : t('compensation.openEnded')}
                    </TableCell>
                    <TableCell align="right">
                      <Money value={h.basicSalary} currency={h.currency} />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Code>{h.structure.code}</Code>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {t(`compensationReason.${h.reason}`)}
                      {h.note && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {h.note}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                      {h.createdBy[language]} · {formatTimestamp(h.createdAt, language)}
                    </TableCell>
                    <TableCell>
                      <StateChip state={h.state} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' } }}>
        <Panel
          title={t('compensation.allowances')}
          actions={
            editable && (
              <Button size="small" variant="outlined" onClick={() => setDialog({ kind: 'assign', type: 'allowance' })}>
                {t('actions.assignAllowance')}
              </Button>
            )
          }
        >
          {assignments(d.allowances, t('compensation.allowances'))}
        </Panel>
        <Panel
          title={t('compensation.deductions')}
          subtitle={t('compensation.deductionsHint')}
          actions={
            editable && (
              <Button size="small" variant="outlined" onClick={() => setDialog({ kind: 'assign', type: 'deduction' })}>
                {t('actions.assignDeduction')}
              </Button>
            )
          }
        >
          {assignments(d.deductions, t('compensation.deductions'))}
        </Panel>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('compensation.otherDeductionsNote')}{' '}
        <Link component={RouterLink} to={payrollPaths.deductions}>
          {t('tabs.deductions')}
        </Link>
      </Typography>
      <Suspense fallback={<LinearProgress />}>
        <PayrollDocumentsPanel employeeId={d.employeeId} />
      </Suspense>

      {dialog?.kind === 'compensation' && <CompensationFormDialog detail={d} onClose={close} onDone={done(t('compensation.saved'))} />}
      {dialog?.kind === 'assign' && <AssignmentDialog kind={dialog.type} employeeId={d.employeeId} onClose={close} onDone={done(t('compensation.assigned'))} />}
      {dialog?.kind === 'end' && <EndAssignmentDialog assignment={dialog.assignment} onClose={close} onDone={done(t('compensation.ended'))} />}
    </>
  );
}
