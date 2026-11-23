import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { isApiError } from '@/core/api/types';
import { useLanguage } from '@/i18n/useLanguage';
import { DetailList, Panel } from '@/modules/shared/Panel';
import { visuallyHidden } from '@/modules/shared/styles';
import { useMyPayroll } from '@/modules/payroll/hooks/usePayroll';
import { payrollPaths } from '@/modules/payroll/paths';
import type { EmployeeAllowance, EmployeeDeduction, MyPayroll as MyPayrollData } from '@/modules/payroll/types/payroll';
import { formatDay, formatPercent, formatPeriod } from '@/modules/payroll/utils/format';
import { IllustrativeChip } from './common/Chips';
import { Code, Money } from './common/Money';

/**
 * My payroll (hr.payroll.view.own — every staff member): own compensation, allowances and deductions in force, and the
 * payroll history from own payslips. Nothing about other employees or the organisation is requested.
 */
export function MyPayroll() {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const query = useMyPayroll();
  if (query.isPending) {
    return (
      <Box>
        <Box component="span" role="status" sx={visuallyHidden}>
          {tCommon('shell.loading')}
        </Box>
        <Skeleton variant="rounded" height={160} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={240} />
      </Box>
    );
  }
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === 'NOT_FOUND') return <Alert severity="info">{t('my.noEmployeeRecord')}</Alert>;
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tCommon('actions.retry')}
          </Button>
        }
      >
        {tCommon('list.loadError')}
      </Alert>
    );
  }
  return <MyView data={query.data} />;
}

function MyView({ data: m }: { data: MyPayrollData }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const items = (rows: ReadonlyArray<EmployeeAllowance | EmployeeDeduction>) =>
    rows.length === 0 ? (
      <Typography color="text.secondary">{t('compensation.noAssignments')}</Typography>
    ) : (
      <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {rows.map((a) => (
          <Box component="li" key={a.id} sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
              {a.type.name[language]}
              {'illustrative' in a.type && a.type.illustrative && <IllustrativeChip />}
              {a.recurrence === 'one-time' && (
                <Typography variant="caption" color="text.secondary">
                  ({t('compensation.oneTimeOn', { date: formatDay(a.effectiveFrom, language) })})
                </Typography>
              )}
            </Box>
            {a.calculation === 'percentage' ? <span dir="ltr">{t('common.ofBasic', { percent: formatPercent(a.percentage ?? 0) })}</span> : <Money value={a.amount ?? 0} currency={a.currency} />}
          </Box>
        ))}
      </Stack>
    );

  return (
    <Stack spacing={2.5}>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr 1fr' } }}>
        <Panel title={t('my.compensation')}>
          {m.current ? (
            <DetailList
              items={[
                { label: t('fields.basicSalary'), value: <Money value={m.current.basicSalary} currency={m.current.currency} strong /> },
                { label: t('fields.payFrequency'), value: t(`payFrequency.${m.current.payFrequency}`) },
                { label: t('fields.effectiveFrom'), value: formatDay(m.current.effectiveFrom, language) },
                { label: t('fields.structure'), value: m.current.structure.name[language] },
                { label: t('fields.department'), value: m.employee.department.name[language] },
                { label: t('fields.position'), value: m.employee.position.name[language] },
              ]}
            />
          ) : (
            <Typography color="text.secondary">{t('my.noCompensation')}</Typography>
          )}
        </Panel>
        <Panel title={t('compensation.allowances')}>{items(m.allowances)}</Panel>
        <Panel title={t('compensation.deductions')}>{items(m.deductions)}</Panel>
      </Box>

      <Panel title={t('my.history')} subtitle={t('my.historyHint')}>
        {m.history.length === 0 ? (
          <Typography color="text.secondary">{t('my.noPayslips')}</Typography>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('my.history')} sx={{ '& .MuiTableCell-root': { px: { xs: 1, sm: 2 } } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.period')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('fields.paymentDate')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }} align="right">
                    {t('fields.gross')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', sm: 'table-cell' } }} align="right">
                    {t('fields.deductions')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {t('fields.net')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.payslip')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {m.history.map((h) => (
                  <TableRow key={h.id} hover>
                    <TableCell>{formatPeriod(h.periodStart, language)}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {formatDay(h.paymentDate, language)} · {t(`paymentStatus.${h.paymentStatus}`)}
                    </TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Money value={h.gross} currency={h.currency} hideCode />
                    </TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      <Money value={h.deductions} currency={h.currency} hideCode />
                    </TableCell>
                    <TableCell align="right">
                      <Money value={h.net} currency={h.currency} strong />
                    </TableCell>
                    <TableCell>
                      <Link component={RouterLink} to={payrollPaths.payslip(h.id)} underline="hover" aria-label={t('my.openPayslip', { period: formatPeriod(h.periodStart, language) })}>
                        <Code>{h.number}</Code>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
      <Typography variant="caption" color="text.secondary">
        {t('my.privacyNote')}
      </Typography>
    </Stack>
  );
}
