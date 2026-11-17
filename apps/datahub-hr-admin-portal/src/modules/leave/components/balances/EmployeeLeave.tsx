import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useEmployeeLeaveBalances, useLeaveBalanceHistory } from '@/modules/leave/hooks/useLeave';
import { leavePaths } from '@/modules/leave/paths';
import type { BalanceEvent, LeaveBalance } from '@/modules/leave/types/leave';
import { balanceYears, formatDay, todayIso } from '@/modules/leave/utils/format';
import { RequestsSection } from '../requests/RequestsSection';

/** `/leave/balances/:employeeId` — one employee's balances, balance history and requests. */
export function EmployeeBalancesPage() {
  const { employeeId = '' } = useParams();
  return <EmployeeLeave employeeId={employeeId} withBreadcrumbs />;
}

interface Props {
  /** An employee id, or `'me'` for the signed-in user's own leave. */
  employeeId: string;
  withBreadcrumbs?: boolean;
  /** Inside another page (Employee Profile): no header. */
  embedded?: boolean;
}

/**
 * Balances (one card per leave type), the movements behind a balance, and the employee's requests (pending,
 * approved, rejected…). Scope is enforced by the API: other people's leave is refused outside the caller's scope.
 */
export function EmployeeLeave({ employeeId, withBreadcrumbs = false, embedded = false }: Props) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [currentYear] = useState(() => Number(todayIso().slice(0, 4)));
  const requestedYear = Number(params.get('year'));
  const year = balanceYears(currentYear).includes(requestedYear) ? requestedYear : currentYear;
  const query = useEmployeeLeaveBalances(employeeId, year);
  const balances = query.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const resolvedId = balances[0]?.employeeId ?? (employeeId === 'me' ? '' : employeeId);
  const own = employeeId === 'me';
  const header = balances[0]?.employee;
  const selectedBalance = balances.find((b) => b.leaveType.id === selected) ?? null;

  return (
    <Stack spacing={2.5}>
      {withBreadcrumbs && header && <Crumbs name={header.name[language]} />}
      {!embedded && header && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" component="h2">
            {own ? t('tabs.my') : header.name[language]}
          </Typography>
          <Chip size="small" variant="outlined" label={header.employeeNumber} dir="ltr" sx={{ fontFamily: 'monospace' }} />
          <Typography variant="body2" color="text.secondary">
            {header.department.name[language]}
          </Typography>
        </Box>
      )}
      <QueryBoundary query={query} notFoundText={t('balances.notFound')} forbiddenText={t('balances.forbidden')}>
        <Panel
          title={t('balances.title')}
          subtitle={t('balances.formula')}
          actions={
            <TextField
              select
              size="small"
              label={t('fields.year')}
              value={year}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (Number(e.target.value) === currentYear) next.delete('year');
                else next.set('year', e.target.value);
                setParams(next, { replace: true });
                setSelected(null);
              }}
              sx={{ minWidth: 110 }}
            >
              {balanceYears(currentYear).map((y) => (
                <MenuItem key={y} value={y}>
                  <span dir="ltr">{y}</span>
                </MenuItem>
              ))}
            </TextField>
          }
        >
          {query.isPending ? (
            <Skeleton height={120} />
          ) : (
            <Box component="ul" aria-label={t('balances.title')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}>
              {balances.map((b) => (
                <BalanceCard key={b.leaveType.id} balance={b} selected={selected === b.leaveType.id} onSelect={() => setSelected(selected === b.leaveType.id ? null : b.leaveType.id)} />
              ))}
            </Box>
          )}
        </Panel>
      </QueryBoundary>
      {selectedBalance && resolvedId && <BalanceHistory employeeId={employeeId} balance={selectedBalance} year={year} />}
      {resolvedId && (
        <Panel title={own ? t('requests.mine') : t('requests.label')}>
          <RequestsSection employeeId={resolvedId} allowCreate={own} />
        </Panel>
      )}
    </Stack>
  );
}

function Crumbs({ name }: { name: string }) {
  const { t } = useTranslation('leave');
  useBreadcrumbs([{ label: t('tabs.balances'), to: leavePaths.balances }, { label: name }]);
  return null;
}

function BalanceCard({ balance: b, selected, onSelect }: { balance: LeaveBalance; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const n = (v: number) => formatNumber(v, language, { maximumFractionDigits: 1 });
  const low = b.remaining !== null && b.remaining <= 0;
  return (
    <Paper component="li" variant="outlined" sx={{ p: 2, borderColor: selected ? 'primary.main' : undefined, minWidth: 0 }} data-balance={b.leaveType.code}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
        {b.leaveType.name[language]}
      </Typography>
      <Typography variant="h5" component="p" sx={{ fontWeight: 600, color: low ? 'error.main' : undefined }}>
        {b.remaining === null ? t('balances.noLimit') : n(b.remaining)}
        <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.75 }}>
          {b.remaining === null ? '' : t('balances.remainingOf', { allocated: n(b.allocated ?? 0) })}
        </Typography>
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('balances.usedPending', { used: n(b.used), pending: n(b.pending) })}
      </Typography>
      <Button size="small" onClick={onSelect} aria-expanded={selected} sx={{ mt: 1, px: 0 }}>
        {selected ? t('balances.hideHistory') : t('balances.showHistory')}
      </Button>
    </Paper>
  );
}

/** Each movement with the balance after it (the events start with the allocation). */
function withRunningBalance(events: readonly BalanceEvent[]): Array<BalanceEvent & { running: number }> {
  return events.reduce<Array<BalanceEvent & { running: number }>>((out, e) => [...out, { ...e, running: (out.at(-1)?.running ?? 0) + e.days }], []);
}

function BalanceHistory({ employeeId, balance, year }: { employeeId: string; balance: LeaveBalance; year: number }) {
  const { t } = useTranslation('leave');
  const { language } = useLanguage();
  const query = useLeaveBalanceHistory(employeeId, balance.leaveType.id, year);
  const n = (v: number) => formatNumber(v, language, { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const rows = withRunningBalance(query.data ?? []);
  return (
    <Panel title={t('balances.historyTitle', { type: balance.leaveType.name[language] })} subtitle={t('balances.historyHint')}>
      <QueryBoundary query={query} notFoundText={t('balances.notFound')} forbiddenText={t('balances.forbidden')}>
        {rows.length === 0 ? (
          <Alert severity="info">{t('balances.noHistory')}</Alert>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('balances.historyTitle', { type: balance.leaveType.name[language] })}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('fields.date')}</TableCell>
                  <TableCell>{t('balances.event')}</TableCell>
                  <TableCell>{t('columns.number')}</TableCell>
                  <TableCell align="right">{t('fields.days')}</TableCell>
                  {balance.allocated !== null && <TableCell align="right">{t('fields.remaining')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((e, i) => (
                  <TableRow key={`${e.date}-${e.type}-${i}`}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDay(e.date, language)}</TableCell>
                    <TableCell>{t(`balanceEvents.${e.type}`)}</TableCell>
                    <TableCell>
                      {e.requestId ? (
                        <Link component={RouterLink} to={leavePaths.request(e.requestId)} dir="ltr" sx={{ fontFamily: 'monospace' }}>
                          {e.requestNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right" dir="ltr">
                      {n(e.days)}
                    </TableCell>
                    {balance.allocated !== null && <TableCell align="right">{formatNumber(e.running, language, { maximumFractionDigits: 1 })}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </QueryBoundary>
    </Panel>
  );
}
