import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import type { PayrollLineDetail } from '@/modules/payroll/api/payrollApi';
import { usePayrollLine } from '@/modules/payroll/hooks/usePayroll';
import { payrollPaths } from '@/modules/payroll/paths';
import type { Currency, LineItem } from '@/modules/payroll/types/payroll';
import { formatDay, formatMinutes, formatPeriod } from '@/modules/payroll/utils/format';
import { itemBasis } from '../common/basis';
import { IllustrativeChip, LineStatusChip, RunStatusChip } from '../common/Chips';
import { Code, Money } from '../common/Money';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/payroll/runs/:runId/employees/:employeeId` — one employee's calculation: every item, its basis and the inputs used. */
export function LineDetails() {
  const { t } = useTranslation('payroll');
  const { runId = '', employeeId = '' } = useParams();
  const query = usePayrollLine(runId, employeeId);
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={payrollPaths.run(runId)} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToRun')}
        </Button>
      </div>
      <QueryBoundary query={query} notFoundText={t('lines.notFound')}>
        {query.data && <LineView line={query.data} />}
      </QueryBoundary>
    </Stack>
  );
}

export function ItemsTable({ label, items, total, totalLabel, currency }: { label: string; items: readonly LineItem[]; total: number; totalLabel: string; currency: Currency }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  return (
    <TableContainer sx={{ position: 'relative' }}>
      <Table size="small" aria-label={label}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>{t('fields.item')}</TableCell>
            <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }}>{t('fields.basis')}</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>
              {t('fields.amount')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <Typography variant="body2" color="text.secondary">
                  {t('lines.none')}
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {items.map((i, index) => (
            <TableRow key={`${i.code}-${index}`}>
              <TableCell>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                  <span>{i.name[language]}</span>
                  <Code>{i.code}</Code>
                  {i.illustrative && <IllustrativeChip />}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
                  {itemBasis(t, i, currency, language)}
                </Typography>
              </TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, color: 'text.secondary' }}>{itemBasis(t, i, currency, language)}</TableCell>
              <TableCell align="right">
                <Money value={i.amount} currency={currency} hideCode />
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
              {totalLabel}
            </TableCell>
            <TableCell align="right">
              <Money value={total} currency={currency} strong />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function LineView({ line: l }: { line: PayrollLineDetail }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  useBreadcrumbs([{ label: t('tabs.runs'), to: payrollPaths.runs }, { label: l.run.number, to: payrollPaths.run(l.run.id) }, { label: l.employee.name[language] }]);
  const a = l.inputs.attendance;
  const day = (d: string) => formatDay(d, language, { day: 'numeric', month: 'short' });
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {l.employee.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={<Code>{l.employee.employeeNumber}</Code>} />
          <LineStatusChip status={l.status} />
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {l.payslipId && (
            <Button variant="outlined" component={RouterLink} to={payrollPaths.payslip(l.payslipId)}>
              {t('actions.viewPayslip')}
            </Button>
          )}
          <Button component={RouterLink} to={payrollPaths.employee(l.employeeId)}>
            {t('actions.viewCompensation')}
          </Button>
        </Box>
      </Box>
      <Alert severity="info">{t('lines.snapshotHint')}</Alert>
      {l.issues
        .filter((i) => i !== 'partialPeriod')
        .map((i) => (
          <Alert key={i} severity={i === 'negativeNet' ? 'error' : 'warning'}>
            {t(`issues.${i}` as never)}
          </Alert>
        ))}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <Panel title={t('lines.employee')}>
          <DetailList
            items={[
              { label: t('fields.department'), value: l.employee.department.name[language] },
              { label: t('fields.position'), value: l.employee.position.name[language] },
              { label: t('fields.location'), value: l.employee.location.name[language] },
              { label: t('fields.run'), value: <Link component={RouterLink} to={payrollPaths.run(l.run.id)}><Code>{l.run.number}</Code></Link> },
              { label: t('fields.period'), value: formatPeriod(l.run.periodStart, language) },
              { label: t('fields.status'), value: <RunStatusChip status={l.run.status} /> },
            ]}
          />
        </Panel>
        <Panel title={t('lines.summary')}>
          <DetailList
            items={[
              { label: t('fields.basic'), value: <Money value={l.basic} currency={l.currency} /> },
              { label: t('fields.allowances'), value: <Money value={l.allowances} currency={l.currency} /> },
              { label: t('fields.overtime'), value: <Money value={l.overtime} currency={l.currency} /> },
              { label: t('fields.gross'), value: <Money value={l.gross} currency={l.currency} strong /> },
              { label: t('fields.deductions'), value: <Money value={l.deductions} currency={l.currency} /> },
              { label: t('fields.net'), value: <Money value={l.net} currency={l.currency} strong /> },
            ]}
          />
        </Panel>
      </Box>

      <Panel title={t('lines.earnings')} subtitle={t('lines.overtimeNote')}>
        <ItemsTable label={t('lines.earnings')} items={l.earnings} total={l.gross} totalLabel={t('fields.gross')} currency={l.currency} />
      </Panel>
      <Panel title={t('lines.deductions')} subtitle={t('lines.deductionsNote')}>
        <ItemsTable label={t('lines.deductions')} items={l.deductionItems} total={l.deductions} totalLabel={t('fields.totalDeductions')} currency={l.currency} />
      </Panel>

      <Panel title={t('lines.inputs')} subtitle={t('lines.inputsHint')}>
        <Stack spacing={2.5}>
          <DetailList
            items={[
              { label: t('inputs.period'), value: t('inputs.days', { from: day(l.inputs.period.start), to: day(l.inputs.period.end), days: l.inputs.period.days }) },
              { label: t('inputs.employed'), value: t('inputs.days', { from: day(l.inputs.employment.from), to: day(l.inputs.employment.to), days: l.inputs.employment.days }) },
              { label: t('inputs.policy'), value: t('inputs.policyValue', { divisor: l.inputs.policy.dailyRateDivisor }) },
              { label: t('inputs.unpaidLeaveDays'), value: formatNumber(l.inputs.unpaidLeaveDays, language) },
              { label: t('inputs.absenceDays'), value: formatNumber(l.inputs.absenceDays, language) },
            ]}
          />
          <div>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              {t('inputs.compensation')}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {l.inputs.compensation.map((c) => (
                <li key={c.recordId}>
                  <Typography variant="body2">
                    <Code>{c.structureCode}</Code> · <Money value={c.basicSalary} currency={l.currency} /> · {t('inputs.days', { from: day(c.from), to: day(c.to), days: c.days })}
                  </Typography>
                </li>
              ))}
            </Box>
          </div>
          <div>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              {t('inputs.leave')}
            </Typography>
            {l.inputs.leave.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('inputs.noLeave')}
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {l.inputs.leave.map((lv) => (
                  <li key={lv.requestId}>
                    <Typography variant="body2">
                      <Code>{lv.number}</Code> · {lv.typeName[language]} · {lv.paid ? t('inputs.paidLeave') : t('inputs.unpaidLeave')} · {lv.dates.map(day).join(', ')}
                    </Typography>
                  </li>
                ))}
              </Box>
            )}
          </div>
          <div>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              {t('inputs.attendance')}
            </Typography>
            {a.dataFrom === null ? (
              <Typography variant="body2" color="text.secondary">
                {t('inputs.noAttendance', { days: a.scheduledDays })}
              </Typography>
            ) : (
              <DetailList
                items={[
                  { label: t('inputs.dataRange'), value: `${day(a.dataFrom)} – ${day(a.dataTo!)}` },
                  { label: t('inputs.scheduledDays'), value: formatNumber(a.scheduledDays, language) },
                  { label: t('inputs.present'), value: formatNumber(a.present + a.late, language) },
                  { label: t('inputs.late'), value: t('inputs.lateValue', { days: a.late, minutes: a.lateMinutes }) },
                  { label: t('inputs.absent'), value: a.absentDates.length ? `${formatNumber(a.absent, language)} (${a.absentDates.map(day).join(', ')})` : formatNumber(a.absent, language) },
                  { label: t('inputs.onLeave'), value: formatNumber(a.onLeave, language) },
                  { label: t('inputs.worked'), value: formatMinutes(a.workedMinutes, language) },
                  { label: t('inputs.beyondShift'), value: formatMinutes(a.minutesBeyondShift, language) },
                ]}
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {t('inputs.attendanceNote')}
            </Typography>
          </div>
        </Stack>
      </Panel>
    </>
  );
}
