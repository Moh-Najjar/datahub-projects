import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useBreadcrumbs } from '@/core/context/breadcrumbContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { DetailList, Panel, QueryBoundary } from '@/modules/shared/Panel';
import { useApproveRun, useCalculateRun, useCancelRun, useGeneratePayslips, useMarkRunPaid, usePayrollLines, usePayrollRun, useRejectRun, useSubmitRun, useValidateRun } from '@/modules/payroll/hooks/usePayroll';
import { payrollPaths } from '@/modules/payroll/paths';
import type { LineFilters, LineSortField, LineStatus, LineSummary, PayrollRun } from '@/modules/payroll/types/payroll';
import { formatDay, formatPeriod, formatTimestamp } from '@/modules/payroll/utils/format';
import { errorText } from '@/modules/payroll/utils/serverErrors';
import { LineStatusChip, RunStatusChip } from '../common/Chips';
import { Code, Money } from '../common/Money';
import { ActionDialog, ReasonDialog, RunFormDialog } from './RunDialogs';

const backIconSx = { transform: (theme: { direction: string }) => (theme.direction === 'rtl' ? 'scaleX(-1)' : undefined) };

/** `/payroll/runs/:runId` — the run, its workflow actions, totals, issues, employee lines and history. */
export function RunDetails() {
  const { t } = useTranslation('payroll');
  const { runId = '' } = useParams();
  const query = usePayrollRun(runId);
  const feedback = useFeedback();
  const { state } = useLocation() as { state: { notice?: string } | null };
  return (
    <Stack spacing={2.5}>
      <div>
        <Button component={RouterLink} to={payrollPaths.runs} size="small" startIcon={<ArrowBackOutlined sx={backIconSx} />}>
          {t('actions.backToRuns')}
        </Button>
      </div>
      {state?.notice && <Alert severity="success">{state.notice}</Alert>}
      <QueryBoundary query={query} notFoundText={t('runs.notFound')}>
        {query.data && <RunView run={query.data} notify={feedback.notify} />}
      </QueryBoundary>
      <Feedback {...feedback} />
    </Stack>
  );
}

type Dialog = 'edit' | 'approve' | 'reject' | 'paid' | 'payslips' | 'cancel' | null;

function RunView({ run: r, notify }: { run: PayrollRun; notify: (text: string, severity?: 'success' | 'error') => void }) {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  useBreadcrumbs([{ label: t('tabs.runs'), to: payrollPaths.runs }, { label: r.number }]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const calculate = useCalculateRun();
  const validate = useValidateRun();
  const submit = useSubmitRun();
  const approve = useApproveRun();
  const reject = useRejectRun();
  const paid = useMarkRunPaid();
  const payslips = useGeneratePayslips();
  const cancel = useCancelRun();
  const fail = (error: Error) => notify(errorText(t, tCommon, error), 'error');
  const busy = calculate.isPending || validate.isPending || submit.isPending;
  const errors = r.issues.filter((i) => i.severity === 'error');
  const warnings = r.issues.filter((i) => i.severity === 'warning');
  const validated = r.validatedAt !== null && r.calculatedAt !== null && r.validatedAt >= r.calculatedAt;
  const close = () => setDialog(null);
  const reset = () => [approve, reject, paid, payslips, cancel].forEach((m) => m.reset());

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" component="h2">
            <Code>{r.number}</Code>
          </Typography>
          <RunStatusChip status={r.status} />
          <Typography color="text.secondary">
            {formatPeriod(r.periodStart, language)} · {r.department?.name[language] ?? t('common.allDepartments')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {r.can.edit && (
            <Button variant="outlined" onClick={() => setDialog('edit')}>
              {t('actions.edit')}
            </Button>
          )}
          {r.can.calculate && (
            <Button variant={r.status === 'draft' ? 'contained' : 'outlined'} disabled={busy} onClick={() => calculate.mutate(r.id, { onSuccess: () => notify(t('runs.calculated')), onError: fail })}>
              {r.calculatedAt ? t('actions.recalculate') : t('actions.calculate')}
            </Button>
          )}
          {r.can.validate && (
            <Button variant={validated ? 'outlined' : 'contained'} disabled={busy} onClick={() => validate.mutate(r.id, { onSuccess: (v) => notify(v.issues.some((i) => i.severity === 'error') ? t('runs.validatedWithErrors') : t('runs.validated')), onError: fail })}>
              {t('actions.validate')}
            </Button>
          )}
          {r.status === 'calculated' && r.can.validate && (
            <Button variant="contained" disabled={busy || !r.can.submit} onClick={() => submit.mutate(r.id, { onSuccess: () => notify(t('runs.submitted')), onError: fail })}>
              {t('actions.submit')}
            </Button>
          )}
          {r.can.approve && (
            <Button
              variant="contained"
              color="success"
              onClick={() => {
                reset();
                setDialog('approve');
              }}
            >
              {t('actions.approve')}
            </Button>
          )}
          {r.can.reject && (
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                reset();
                setDialog('reject');
              }}
            >
              {t('actions.reject')}
            </Button>
          )}
          {r.can.markPaid && (
            <Button
              variant="contained"
              onClick={() => {
                reset();
                setDialog('paid');
              }}
            >
              {t('actions.markPaid')}
            </Button>
          )}
          {r.can.generatePayslips && (
            <Button
              variant="outlined"
              onClick={() => {
                reset();
                setDialog('payslips');
              }}
            >
              {t('actions.generatePayslips')}
            </Button>
          )}
          {r.can.cancel && (
            <Button
              color="error"
              onClick={() => {
                reset();
                setDialog('cancel');
              }}
            >
              {t('actions.cancelRun')}
            </Button>
          )}
        </Box>
      </Box>

      {r.status === 'calculated' && r.can.validate && !validated && <Alert severity="info">{t('runs.validateFirst')}</Alert>}
      {r.status === 'calculated' && validated && errors.length > 0 && <Alert severity="error">{t('runs.fixErrors')}</Alert>}
      {r.approvalBlockedReason === 'ownRun' && <Alert severity="warning">{t('runs.ownRun')}</Alert>}
      {r.status === 'pending-approval' && !r.can.approve && r.approvalBlockedReason === null && <Alert severity="info">{t('runs.awaitingApprover')}</Alert>}
      {r.status === 'rejected' && (
        <Alert severity="error">
          <strong>{t('runs.rejectedBy', { name: r.rejectedBy?.[language] ?? '' })}</strong> {r.rejectionReason}
          <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
            {t('runs.correctHint')}
          </Box>
        </Alert>
      )}
      {r.status === 'cancelled' && <Alert severity="info">{t('runs.cancelledNote', { reason: r.cancellationReason ?? '' })}</Alert>}
      {(r.status === 'approved' || r.status === 'paid') && <Alert severity="info">{r.status === 'paid' ? t('runs.paidNote') : t('runs.approvedNote')}</Alert>}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <Panel title={t('runs.details')}>
          <DetailList
            items={[
              { label: t('fields.period'), value: `${formatDay(r.periodStart, language)} – ${formatDay(r.periodEnd, language)}` },
              { label: t('fields.paymentDate'), value: formatDay(r.paymentDate, language) },
              { label: t('fields.departmentScope'), value: r.department?.name[language] ?? t('common.allDepartments') },
              { label: t('fields.currency'), value: <Code>{r.currency}</Code> },
              { label: t('fields.payFrequency'), value: t(`payFrequency.${r.payFrequency}`) },
              { label: t('fields.createdBy'), value: `${r.createdBy.name[language]} · ${formatTimestamp(r.createdAt, language)}` },
              { label: t('fields.calculatedAt'), value: r.calculatedAt ? formatTimestamp(r.calculatedAt, language) : '—' },
              { label: t('fields.approvedBy'), value: r.approvedBy ? `${r.approvedBy[language]} · ${formatTimestamp(r.approvedAt!, language)}` : '—' },
              { label: t('fields.payslips'), value: r.totals ? `${formatNumber(r.payslipsGenerated, language)} / ${formatNumber(r.totals.employees, language)}` : '—' },
              { label: t('fields.dailyRateDivisor'), value: r.policy ? formatNumber(r.policy.dailyRateDivisor, language) : '—' },
            ]}
          />
        </Panel>
        <Panel title={t('runs.totals')} subtitle={r.totals ? t('runs.totalsHint') : undefined}>
          {r.totals ? (
            <DetailList
              items={[
                { label: t('fields.employees'), value: formatNumber(r.totals.employees, language) },
                { label: t('fields.basic'), value: <Money value={r.totals.basic} currency={r.currency} /> },
                { label: t('fields.allowances'), value: <Money value={r.totals.allowances} currency={r.currency} /> },
                { label: t('fields.overtime'), value: <Money value={r.totals.overtime} currency={r.currency} /> },
                { label: t('fields.gross'), value: <Money value={r.totals.gross} currency={r.currency} strong /> },
                { label: t('fields.deductions'), value: <Money value={r.totals.deductions} currency={r.currency} /> },
                { label: t('fields.net'), value: <Money value={r.totals.net} currency={r.currency} strong /> },
              ]}
            />
          ) : (
            <Typography color="text.secondary">{t('runs.notCalculated')}</Typography>
          )}
        </Panel>
      </Box>

      {r.issues.length > 0 && (
        <Panel title={t('runs.issues', { errors: errors.length, warnings: warnings.length })} subtitle={r.validatedAt ? t('runs.checkedAt', { when: formatTimestamp(r.validatedAt, language) }) : undefined}>
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: 280, overflowY: 'auto' }} aria-label={t('runs.issuesLabel')}>
            {[...errors, ...warnings].map((i, index) => (
              <Box component="li" key={`${i.code}-${i.employeeId ?? 'run'}-${index}`}>
                <Alert severity={i.severity === 'error' ? 'error' : 'warning'} sx={{ py: 0 }}>
                  {i.employee && i.employeeId ? (
                    <>
                      {r.status !== 'draft' && r.totals && i.code !== 'missingCompensation' && i.code !== 'currencyMismatch' && i.code !== 'inAnotherRun' ? (
                        <Link component={RouterLink} to={payrollPaths.line(r.id, i.employeeId)}>
                          {i.employee.name[language]}
                        </Link>
                      ) : (
                        <Link component={RouterLink} to={payrollPaths.employee(i.employeeId)}>
                          {i.employee.name[language]}
                        </Link>
                      )}{' '}
                      (<Code>{i.employee.employeeNumber}</Code>):{' '}
                    </>
                  ) : null}
                  {t(`issues.${i.code}` as never)}
                </Alert>
              </Box>
            ))}
          </Stack>
        </Panel>
      )}

      {r.totals && <LinesTable run={r} />}

      <Panel title={t('runs.history')}>
        <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('runs.history')}>
          {[...r.history].reverse().map((h, index) => (
            <Box component="li" key={`${h.at}-${index}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'baseline' }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t(`history.${h.action}` as never, { by: h.by[language], number: h.note })}
              </Typography>
              {h.note && h.action !== 'payslips' && (
                <Typography variant="body2" color="text.secondary">
                  “{h.note}”
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ marginInlineStart: 'auto' }}>
                {formatTimestamp(h.at, language)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Panel>

      {dialog === 'edit' && (
        <RunFormDialog
          run={r}
          onClose={close}
          onDone={() => {
            close();
            notify(t('runs.saved'));
          }}
        />
      )}
      {dialog === 'approve' && (
        <ActionDialog
          title={t('runs.approveTitle', { number: r.number })}
          text={t('runs.approveText')}
          confirmLabel={t('actions.approve')}
          pending={approve.isPending}
          error={approve.isError ? errorText(t, tCommon, approve.error) : undefined}
          onConfirm={() =>
            approve.mutate(r.id, {
              onSuccess: () => {
                close();
                notify(t('runs.approved'));
              },
            })
          }
          onClose={close}
        />
      )}
      {dialog === 'paid' && (
        <ActionDialog
          title={t('runs.paidTitle', { number: r.number })}
          text={t('runs.paidText')}
          confirmLabel={t('actions.markPaid')}
          pending={paid.isPending}
          error={paid.isError ? errorText(t, tCommon, paid.error) : undefined}
          onConfirm={() =>
            paid.mutate(r.id, {
              onSuccess: () => {
                close();
                notify(t('runs.markedPaid'));
              },
            })
          }
          onClose={close}
        />
      )}
      {dialog === 'payslips' && (
        <ActionDialog
          title={t('runs.payslipsTitle')}
          text={t('runs.payslipsText')}
          confirmLabel={t('actions.generatePayslips')}
          pending={payslips.isPending}
          error={payslips.isError ? errorText(t, tCommon, payslips.error) : undefined}
          onConfirm={() =>
            payslips.mutate(
              { id: r.id },
              {
                onSuccess: (res) => {
                  close();
                  notify(t('runs.payslipsGenerated', { number: formatNumber(res.generated, language) }));
                },
              },
            )
          }
          onClose={close}
        />
      )}
      {dialog === 'reject' && (
        <ReasonDialog
          title={t('runs.rejectTitle', { number: r.number })}
          hint={t('runs.rejectHint')}
          submitLabel={t('actions.reject')}
          pending={reject.isPending}
          error={reject.isError ? errorText(t, tCommon, reject.error) : undefined}
          onSubmit={(reason) =>
            reject.mutate(
              { id: r.id, reason },
              {
                onSuccess: () => {
                  close();
                  notify(t('runs.rejected'));
                },
              },
            )
          }
          onClose={close}
        />
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title={t('runs.cancelTitle', { number: r.number })}
          hint={t('runs.cancelHint')}
          submitLabel={t('actions.cancelRun')}
          pending={cancel.isPending}
          error={cancel.isError ? errorText(t, tCommon, cancel.error) : undefined}
          onSubmit={(reason) =>
            cancel.mutate(
              { id: r.id, reason },
              {
                onSuccess: () => {
                  close();
                  notify(t('runs.cancelled'));
                },
              },
            )
          }
          onClose={close}
        />
      )}
    </>
  );
}

/** Employee-level results of the run (snapshots). */
function LinesTable({ run }: { run: PayrollRun }) {
  const { t } = useTranslation('payroll');
  const { language } = useLanguage();
  const list = useListState<LineFilters, LineSortField>('employee.employeeNumber');
  const sortBy = list.sortBy === 'employee.name.en' || list.sortBy === 'employee.name.ar' ? (`employee.name.${language}` as const) : list.sortBy;
  const query = usePayrollLines(run.id, { ...list.params, sortBy });
  const money = (v: number) => <Money value={v} currency={run.currency} hideCode />;
  const columns: Column<LineSummary, LineSortField>[] = [
    {
      id: 'employee',
      label: t('fields.employee'),
      sortField: 'employee.name.en',
      render: (l) => (
        <Link component={RouterLink} to={payrollPaths.line(run.id, l.employeeId)} underline="hover" sx={{ fontWeight: 500 }}>
          {l.employee.name[language]}
        </Link>
      ),
    },
    { id: 'number', label: t('fields.employeeNumber'), sortField: 'employee.employeeNumber', hideBelow: 'sm', render: (l) => <Code>{l.employee.employeeNumber}</Code> },
    { id: 'department', label: t('fields.department'), hideBelow: 'xl', render: (l) => l.employee.department.name[language] },
    { id: 'basic', label: t('fields.basic'), align: 'right', hideBelow: 'lg', render: (l) => money(l.basic) },
    { id: 'allowances', label: t('fields.allowances'), align: 'right', hideBelow: 'lg', render: (l) => money(l.allowances) },
    { id: 'overtime', label: t('fields.overtime'), align: 'right', hideBelow: 'xl', render: (l) => money(l.overtime) },
    { id: 'gross', label: t('fields.gross'), sortField: 'gross', align: 'right', hideBelow: 'md', render: (l) => money(l.gross) },
    { id: 'deductions', label: t('fields.deductions'), sortField: 'deductions', align: 'right', hideBelow: 'md', render: (l) => money(l.deductions) },
    { id: 'net', label: t('fields.net'), sortField: 'net', align: 'right', render: (l) => money(l.net) },
    { id: 'status', label: t('fields.status'), sortField: 'status', hideBelow: 'sm', render: (l) => <LineStatusChip status={l.status} /> },
  ];
  return (
    <Panel title={t('runs.lines')} subtitle={t('runs.linesHint', { currency: run.currency })}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('runs.searchLines')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        filters={<FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as LineStatus | undefined)} allLabel={t('filters.allStatuses')} options={(['ok', 'warning', 'error'] as const).map((s) => ({ value: s, label: t(`lineStatus.${s}`) }))} />}
      />
      <DataTable label={t('runs.lines')} columns={columns} getRowId={(l) => l.employeeId} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
    </Panel>
  );
}
