import { useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { DetailList, Panel } from '@/modules/shared/Panel';
import { RowActions, type RowAction } from '@/modules/shared/RowActions';
import { StatusChip } from '@/modules/shared/StatusChip';
import { visuallyHidden } from '@/modules/shared/styles';
import { useAllowanceTypes, useDeductionTypes, usePayrollPolicy, useSalaryStructures } from '@/modules/payroll/hooks/usePayroll';
import { usePayrollAccess } from '@/modules/payroll/hooks/usePayrollAccess';
import { useAllowanceStatusFlow, useDeductionStatusFlow, useStructureStatusFlow } from '@/modules/payroll/hooks/useTypeStatusFlows';
import type { AllowanceType, DeductionType, RecordStatus, SalaryStructure, StructureFilters, StructureSortField, TypeFilters, TypeSortField } from '@/modules/payroll/types/payroll';
import { formatDay, formatPercent, formatTimestamp } from '@/modules/payroll/utils/format';
import { IllustrativeChip } from '../common/Chips';
import { Code, Money } from '../common/Money';
import { AllowanceTypeDialog, DeductionTypeDialog, PolicyDialog, StructureFormDialog } from './ConfigDialogs';

const statusFilter = (t: (k: 'status.active' | 'status.inactive') => string) => (['active', 'inactive'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }));
const actionsColumn = <T,>(label: string, render: (row: T) => ReactNode) => ({ id: 'actions', label: <Box component="span" sx={visuallyHidden}>{label}</Box>, align: 'right' as const, render });

/* Salary structures ------------------------------------------------------------------------------------------------ */

export function StructuresSection() {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canWrite } = usePayrollAccess();
  const list = useListState<StructureFilters, StructureSortField>('code');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useSalaryStructures({ ...list.params, sortBy });
  const feedback = useFeedback();
  const status = useStructureStatusFlow(feedback.notify);
  const [dialog, setDialog] = useState<{ kind: 'form'; structure?: SalaryStructure } | { kind: 'view'; structure: SalaryStructure } | null>(null);

  const actions = (s: SalaryStructure): RowAction[] => [
    { label: t('actions.view'), icon: VisibilityOutlined, onClick: () => setDialog({ kind: 'view', structure: s }) },
    ...(canWrite
      ? [
          { label: t('actions.edit'), icon: EditOutlined, onClick: () => setDialog({ kind: 'form', structure: s }) },
          { label: s.status === 'active' ? t('actions.deactivate') : t('actions.activate'), icon: s.status === 'active' ? ToggleOffOutlined : ToggleOnOutlined, onClick: () => status.request(s) },
        ]
      : []),
  ];
  const columns: Column<SalaryStructure, StructureSortField>[] = [
    { id: 'code', label: t('fields.code'), sortField: 'code', render: (s) => <Code>{s.code}</Code> },
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (s) => (
        <Link component="button" type="button" underline="hover" onClick={() => setDialog({ kind: 'view', structure: s })} sx={{ textAlign: 'start', fontWeight: 500 }}>
          {s.name[language]}
        </Link>
      ),
    },
    { id: 'basic', label: t('fields.basicSalary'), sortField: 'basicSalary', align: 'right', render: (s) => <Money value={s.basicSalary} currency={s.currency} /> },
    { id: 'frequency', label: t('fields.payFrequency'), hideBelow: 'lg', render: (s) => t(`payFrequency.${s.payFrequency}`) },
    { id: 'types', label: t('fields.employmentTypes'), hideBelow: 'xl', render: (s) => s.employmentTypes.map((x) => t(`employmentType.${x}`)).join(', ') },
    { id: 'assigned', label: t('fields.assignedEmployees'), sortField: 'assignedEmployees', align: 'right', hideBelow: 'md', render: (s) => formatNumber(s.assignedEmployees, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (s) => <StatusChip status={s.status} /> },
    actionsColumn<SalaryStructure>(tCommon('list.actions'), (s) => <RowActions name={s.name[language]} actions={actions(s)} />),
  ];

  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('structures.hint')}</Alert>
      <section aria-label={t('structures.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('structures.search')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          createLabel={canWrite ? t('structures.create') : undefined}
          onCreate={canWrite ? () => setDialog({ kind: 'form' }) : undefined}
          filters={<FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)} allLabel={t('filters.allStatuses')} options={statusFilter(t)} />}
        />
        <DataTable label={t('structures.title')} columns={columns} getRowId={(s) => s.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      {dialog?.kind === 'form' && (
        <StructureFormDialog
          structure={dialog.structure}
          onClose={() => setDialog(null)}
          onDone={(s) => {
            setDialog(null);
            feedback.notify(t(dialog.structure ? 'common.saved' : 'common.created', { name: s.name[language] }));
          }}
        />
      )}
      {dialog?.kind === 'view' && (
        <Dialog open onClose={() => setDialog(null)} maxWidth="sm" fullWidth aria-labelledby="structure-title">
          <DialogTitle id="structure-title">
            {dialog.structure.name[language]} <Code>{dialog.structure.code}</Code>
          </DialogTitle>
          <DialogContent dividers>
            <DetailList
              items={[
                { label: t('fields.basicSalary'), value: <Money value={dialog.structure.basicSalary} currency={dialog.structure.currency} /> },
                { label: t('fields.currency'), value: <Code>{dialog.structure.currency}</Code> },
                { label: t('fields.payFrequency'), value: t(`payFrequency.${dialog.structure.payFrequency}`) },
                { label: t('fields.employmentTypes'), value: dialog.structure.employmentTypes.map((x) => t(`employmentType.${x}`)).join(', ') },
                { label: t('fields.assignedEmployees'), value: formatNumber(dialog.structure.assignedEmployees, language) },
                { label: t('fields.status'), value: <StatusChip status={dialog.structure.status} /> },
                { label: t('fields.createdAt'), value: formatDay(dialog.structure.createdAt, language) },
                { label: t('fields.description'), value: dialog.structure.description || '—' },
              ]}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>{t('actions.close')}</Button>
          </DialogActions>
        </Dialog>
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </Stack>
  );
}

/* Allowance types ------------------------------------------------------------------------------------------------- */

export function AllowancesSection() {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canWrite } = usePayrollAccess();
  const list = useListState<TypeFilters, TypeSortField>('code');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useAllowanceTypes({ ...list.params, sortBy });
  const feedback = useFeedback();
  const status = useAllowanceStatusFlow(feedback.notify);
  const [editing, setEditing] = useState<{ type?: AllowanceType } | null>(null);
  const columns: Column<AllowanceType, TypeSortField>[] = [
    { id: 'code', label: t('fields.code'), sortField: 'code', render: (a) => <Code>{a.code}</Code> },
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (a) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {a.name[language]}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {a.description}
          </Typography>
        </Box>
      ),
    },
    { id: 'value', label: t('fields.value'), align: 'right', render: (a) => (a.calculation === 'percentage' ? <span dir="ltr">{t('common.ofBasic', { percent: formatPercent(a.percentage ?? 0) })}</span> : <Money value={a.amount ?? 0} currency={a.currency} />) },
    { id: 'recurrence', label: t('fields.recurrence'), hideBelow: 'md', render: (a) => t(`recurrence.${a.recurrence}`) },
    { id: 'taxable', label: t('fields.taxable'), hideBelow: 'lg', render: (a) => (a.taxable ? t('common.yes') : t('common.no')) },
    { id: 'assigned', label: t('fields.assignedEmployees'), sortField: 'assignedEmployees', align: 'right', hideBelow: 'md', render: (a) => formatNumber(a.assignedEmployees, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (a) => <StatusChip status={a.status} /> },
    ...(canWrite
      ? [
          actionsColumn<AllowanceType>(tCommon('list.actions'), (a) => (
            <RowActions
              name={a.name[language]}
              actions={[
                { label: t('actions.edit'), icon: EditOutlined, onClick: () => setEditing({ type: a }) },
                { label: a.status === 'active' ? t('actions.deactivate') : t('actions.activate'), icon: a.status === 'active' ? ToggleOffOutlined : ToggleOnOutlined, onClick: () => status.request(a) },
              ]}
            />
          )),
        ]
      : []),
  ];
  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('allowances.hint')}</Alert>
      <section aria-label={t('allowances.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('allowances.search')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          createLabel={canWrite ? t('allowances.create') : undefined}
          onCreate={canWrite ? () => setEditing({}) : undefined}
          filters={<FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)} allLabel={t('filters.allStatuses')} options={statusFilter(t)} />}
        />
        <DataTable label={t('allowances.title')} columns={columns} getRowId={(a) => a.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      {editing && (
        <AllowanceTypeDialog
          type={editing.type}
          onClose={() => setEditing(null)}
          onDone={(a) => {
            setEditing(null);
            feedback.notify(t(editing.type ? 'common.saved' : 'common.created', { name: a.name[language] }));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </Stack>
  );
}

/* Deduction types and calculation policy ------------------------------------------------------------------------- */

export function DeductionsSection() {
  const { t } = useTranslation('payroll');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canWrite } = usePayrollAccess();
  const list = useListState<TypeFilters, TypeSortField>('code');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useDeductionTypes({ ...list.params, sortBy });
  const policy = usePayrollPolicy();
  const feedback = useFeedback();
  const status = useDeductionStatusFlow(feedback.notify);
  const [editing, setEditing] = useState<{ type?: DeductionType } | null>(null);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const value = (d: DeductionType) => {
    if (d.calculation === 'daily-rate') return t('calculation.daily-rate');
    if (d.calculation === 'percentage') return <span dir="ltr">{t('common.ofBasic', { percent: formatPercent(d.percentage ?? 0) })}</span>;
    return <Money value={d.amount ?? 0} currency={d.currency} />;
  };
  const columns: Column<DeductionType, TypeSortField>[] = [
    { id: 'code', label: t('fields.code'), sortField: 'code', render: (d) => <Code>{d.code}</Code> },
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (d) => (
        <Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {d.name[language]}
            </Typography>
            {d.illustrative && <IllustrativeChip />}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {d.description}
          </Typography>
        </Box>
      ),
    },
    { id: 'category', label: t('fields.category'), hideBelow: 'md', render: (d) => t(`deductionCategory.${d.category}`) },
    { id: 'value', label: t('fields.value'), align: 'right', render: value },
    { id: 'max', label: t('fields.maxAmount'), align: 'right', hideBelow: 'lg', render: (d) => (d.maxAmount === null ? '—' : <Money value={d.maxAmount} currency={d.currency} />) },
    { id: 'recurrence', label: t('fields.recurrence'), hideBelow: 'xl', render: (d) => t(`recurrence.${d.recurrence}`) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (d) => <StatusChip status={d.status} /> },
    ...(canWrite
      ? [
          actionsColumn<DeductionType>(tCommon('list.actions'), (d) => (
            <RowActions
              name={d.name[language]}
              actions={[
                { label: t('actions.edit'), icon: EditOutlined, onClick: () => setEditing({ type: d }) },
                { label: d.status === 'active' ? t('actions.deactivate') : t('actions.activate'), icon: d.status === 'active' ? ToggleOffOutlined : ToggleOnOutlined, onClick: () => status.request(d) },
              ]}
            />
          )),
        ]
      : []),
  ];
  const p = policy.data;
  return (
    <Stack spacing={2.5}>
      <Alert severity="warning">{t('deductions.legalNotice')}</Alert>
      <section aria-label={t('deductions.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('deductions.search')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          createLabel={canWrite ? t('deductions.create') : undefined}
          onCreate={canWrite ? () => setEditing({}) : undefined}
          filters={<FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)} allLabel={t('filters.allStatuses')} options={statusFilter(t)} />}
        />
        <DataTable label={t('deductions.title')} columns={columns} getRowId={(d) => d.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      <Panel
        title={t('policy.title')}
        subtitle={t('policy.subtitle')}
        actions={
          canWrite &&
          p && (
            <Button size="small" variant="outlined" onClick={() => setEditingPolicy(true)}>
              {t('actions.edit')}
            </Button>
          )
        }
      >
        {p ? (
          <DetailList
            items={[
              { label: t('fields.dailyRateDivisor'), value: t('policy.divisorValue', { divisor: p.dailyRateDivisor }) },
              { label: t('policy.rounding'), value: t('policy.roundingValue') },
              { label: t('policy.proration'), value: t('policy.prorationValue') },
              { label: t('policy.recurring'), value: t('policy.recurringValue') },
              { label: t('policy.negativeNet'), value: t('policy.negativeNetValue') },
              { label: t('policy.overtime'), value: t('policy.overtimeValue') },
              { label: t('policy.lateness'), value: t('policy.latenessValue') },
              { label: t('policy.leave'), value: t('policy.leaveValue') },
              { label: t('fields.updatedBy'), value: `${p.updatedBy[language]} · ${formatTimestamp(p.updatedAt, language)}` },
            ]}
          />
        ) : (
          <Typography color="text.secondary">{tCommon('shell.loading')}</Typography>
        )}
      </Panel>
      {editing && (
        <DeductionTypeDialog
          type={editing.type}
          onClose={() => setEditing(null)}
          onDone={(d) => {
            setEditing(null);
            feedback.notify(t(editing.type ? 'common.saved' : 'common.created', { name: d.name[language] }));
          }}
        />
      )}
      {editingPolicy && p && (
        <PolicyDialog
          policy={p}
          onClose={() => setEditingPolicy(false)}
          onDone={() => {
            setEditingPolicy(false);
            feedback.notify(t('policy.saved'));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </Stack>
  );
}
