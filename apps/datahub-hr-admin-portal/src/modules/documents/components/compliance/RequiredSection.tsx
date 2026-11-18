import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions } from '@/modules/organization';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { Panel } from '@/modules/shared/Panel';
import { SelectField } from '@/modules/shared/SelectField';
import { StatusChip } from '@/modules/shared/StatusChip';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import type { ComplianceFilters } from '@/modules/documents/api/documentsApi';
import { useAllCategories, useComplianceList, useCreateRule, useDocumentSettings, useRequiredRules, useUpdateRule, useUpdateRuleStatus, useUpdateSettings } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { ruleFormSchema, thresholdFormSchema, toRuleInput, type RuleFormValues, type ThresholdFormValues } from '@/modules/documents/schemas/documentSchemas';
import { COMPLIANCE_STATUSES, EMPLOYMENT_TYPES, type ComplianceStatus, type EmployeeCompliance, type RequiredRule } from '@/modules/documents/types/documents';
import { errorText, fieldErrorText } from '@/modules/documents/utils/serverErrors';
import { Code, ComplianceChip } from '../common/Chips';
import { ComplianceChecklist } from './ComplianceChecklist';

/** Required-document rules (configuration) and every employee's compliance in the caller's scope. */
export function RequiredSection() {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canConfigure } = useDocumentsAccess();
  const rules = useRequiredRules();
  const settings = useDocumentSettings();
  const feedback = useFeedback();
  const updateStatus = useUpdateRuleStatus();
  const [editing, setEditing] = useState<{ rule?: RequiredRule } | null>(null);
  const [threshold, setThreshold] = useState(false);

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">{t('required.hint')}</Alert>
      <Panel
        title={t('required.rules')}
        subtitle={t('required.rulesHint')}
        actions={
          canConfigure && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button size="small" variant="outlined" onClick={() => setThreshold(true)} disabled={!settings.data}>
                {t('required.threshold', { days: settings.data?.expiryWarningDays ?? 30 })}
              </Button>
              <Button size="small" variant="contained" onClick={() => setEditing({})}>
                {t('required.create')}
              </Button>
            </Box>
          )
        }
      >
        {rules.isPending ? (
          <LinearProgress aria-label={tCommon('shell.loading')} />
        ) : rules.isError ? (
          <Alert severity="error">{tCommon('list.loadError')}</Alert>
        ) : (
          <TableContainer sx={{ position: 'relative' }}>
            <Table size="small" aria-label={t('required.rules')} sx={{ '& .MuiTableCell-root': { px: { xs: 1, sm: 2 } } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.name')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', md: 'table-cell' } }}>{t('fields.categories')}</TableCell>
                  <TableCell sx={{ fontWeight: 600, display: { xs: 'none', lg: 'table-cell' } }}>{t('fields.appliesTo')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {t('fields.employees')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('fields.status')}</TableCell>
                  {canConfigure && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {(rules.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name[language]}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {r.categories.map((c, i) => (
                          <Chip key={c.id} size="small" variant="outlined" label={`${i > 0 ? `${t('required.or')} ` : ''}${c.name[language]}`} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                      {[r.employmentTypes.length ? r.employmentTypes.map((x) => t(`employmentType.${x}`)).join(', ') : t('required.allTypes'), t(`required.employmentStatus.${r.employmentStatus}`), r.department?.name[language] ?? t('filters.allDepartments')].join(' · ')}
                    </TableCell>
                    <TableCell align="right">{formatNumber(r.applicableEmployees, language)}</TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                    {canConfigure && (
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Button size="small" onClick={() => setEditing({ rule: r })}>
                          {t('actions.edit')}
                        </Button>
                        <Button size="small" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: r.id, status: r.status === 'active' ? 'inactive' : 'active' }, { onSuccess: () => feedback.notify(t(r.status === 'active' ? 'common.deactivated' : 'common.activated', { name: r.name[language] })), onError: (e) => feedback.notify(errorText(t, tCommon, e), 'error') })}>
                          {r.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>

      <ComplianceTable />
      <Typography variant="caption" color="text.secondary">
        {t('required.noBlocking')}
      </Typography>

      {editing && (
        <RuleDialog
          rule={editing.rule}
          onClose={() => setEditing(null)}
          onDone={(r) => {
            setEditing(null);
            feedback.notify(t(editing.rule ? 'common.saved' : 'common.created', { name: r.name[language] }));
          }}
        />
      )}
      {threshold && settings.data && (
        <ThresholdDialog
          days={settings.data.expiryWarningDays}
          onClose={() => setThreshold(false)}
          onDone={() => {
            setThreshold(false);
            feedback.notify(t('required.thresholdSaved'));
          }}
        />
      )}
      <Feedback {...feedback} />
    </Stack>
  );
}

/** Employees with their completeness; a row expands to the checklist. */
function ComplianceTable() {
  const { t } = useTranslation('documents');
  const { language } = useLanguage();
  const list = useListState<ComplianceFilters, string>('completeness', 'asc');
  const query = useComplianceList(list.params);
  const { options: departments } = useDepartmentOptions();
  const [open, setOpen] = useState<EmployeeCompliance | null>(null);
  const columns: Column<EmployeeCompliance, string>[] = [
    {
      id: 'employee',
      label: t('fields.employee'),
      sortField: `employee.name.${language}`,
      render: (c) => (
        <Button size="small" onClick={() => setOpen(open?.employee.id === c.employee.id ? null : c)} sx={{ textAlign: 'start', justifyContent: 'flex-start', p: 0, minWidth: 0 }} aria-expanded={open?.employee.id === c.employee.id}>
          {c.employee.name[language]}
        </Button>
      ),
    },
    { id: 'number', label: t('fields.ownerNumber'), sortField: 'employee.employeeNumber', hideBelow: 'sm', render: (c) => <Code>{c.employee.employeeNumber}</Code> },
    { id: 'department', label: t('fields.department'), hideBelow: 'md', render: (c) => c.employee.department.name[language] },
    {
      id: 'items',
      label: t('compliance.items'),
      hideBelow: 'lg',
      render: (c) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {c.items
            .filter((i) => i.status !== 'verified')
            .map((i) => (
              <ComplianceChip key={i.rule.id} status={i.status} />
            ))}
        </Box>
      ),
    },
    {
      id: 'completeness',
      label: t('compliance.completeness'),
      sortField: 'completeness',
      render: (c) =>
        c.completeness === null ? (
          '—'
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 110 }}>
            <LinearProgress variant="determinate" value={c.completeness} color={c.completeness === 100 ? 'success' : c.completeness >= 60 ? 'primary' : 'warning'} sx={{ flex: 1, height: 6, borderRadius: 3 }} aria-label={t('compliance.completenessOf', { name: c.employee.name[language] })} />
            <Typography variant="body2" dir="ltr">
              {formatNumber(c.completeness, language)}%
            </Typography>
          </Box>
        ),
    },
  ];
  return (
    <Panel title={t('compliance.title')} subtitle={t('compliance.subtitle')}>
      <ListToolbar
        search={list.search}
        onSearch={list.setSearch}
        searchLabel={t('compliance.search')}
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        filters={
          <>
            <FilterSelect label={t('fields.department')} value={list.filters.departmentId ?? ''} onChange={(v) => list.setFilter('departmentId', v || undefined)} allLabel={t('filters.allDepartments')} options={departments.map((o) => ({ value: o.value, label: o.label, depth: o.depth }))} />
            <FilterSelect label={t('compliance.withStatus')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as ComplianceStatus | undefined)} allLabel={t('filters.allStatuses')} options={COMPLIANCE_STATUSES.map((s) => ({ value: s, label: t(`compliance.status.${s}`) }))} />
          </>
        }
      />
      <DataTable label={t('compliance.title')} columns={columns} getRowId={(c) => c.employee.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      {open && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" component="h3" sx={{ mb: 1 }}>
            {t('compliance.checklistFor', { name: open.employee.name[language] })}
          </Typography>
          <ComplianceChecklist compliance={open} />
        </Box>
      )}
    </Panel>
  );
}

const RULE_FIELDS = ['nameEn', 'nameAr', 'categoryIds', 'employmentTypes', 'employmentStatus', 'departmentId'] as const;

function RuleDialog({ rule, onClose, onDone }: { rule?: RequiredRule; onClose: () => void; onDone: (r: RequiredRule) => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateRule();
  const update = useUpdateRule();
  const mutation = rule ? update : create;
  const categories = useAllCategories();
  const { options: departments } = useDepartmentOptions();
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: { nameEn: rule?.name.en ?? '', nameAr: rule?.name.ar ?? '', categoryIds: rule?.categories.map((c) => c.id) ?? [], employmentTypes: rule?.employmentTypes ?? [], employmentStatus: rule?.employmentStatus ?? 'active', departmentId: rule?.department?.id ?? '' },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<RuleFormValues>) => textFieldProps(register, formState, name, translate);
  const employeeCategories = (categories.data?.items ?? []).filter((c) => c.appliesTo.includes('employee') && (c.status === 'active' || rule?.categories.some((x) => x.id === c.id)));
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toRuleInput(ruleFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, RULE_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (rule) update.mutate({ id: rule.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open maxWidth="md" title={rule ? t('required.editTitle') : t('required.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={rule ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
        <SelectField control={control} name="employmentStatus" label={t('fields.employmentStatus')} translate={translate} options={(['active', 'inactive', 'any'] as const).map((s) => ({ value: s, label: t(`required.employmentStatus.${s}`) }))} />
        <SelectField control={control} name="departmentId" label={t('fields.department')} translate={translate} helper={t('required.departmentHint')} options={[{ value: '', label: t('filters.allDepartments') }, ...departments.map((d) => ({ value: d.value, label: `${'— '.repeat(d.depth)}${d.label}`, disabled: d.disabled }))]} />
      </Box>
      <Controller
        control={control}
        name="categoryIds"
        render={({ field, fieldState }) => (
          <FormControl component="fieldset" error={Boolean(fieldState.error)}>
            <FormLabel component="legend">{t('required.anyOf')}</FormLabel>
            <FormGroup row>
              {employeeCategories.map((c) => (
                <FormControlLabel key={c.id} label={c.name[language]} control={<Checkbox size="small" checked={field.value.includes(c.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))} />} />
              ))}
            </FormGroup>
            {fieldState.error && <FormHelperText>{translate(fieldState.error.message)}</FormHelperText>}
          </FormControl>
        )}
      />
      <Controller
        control={control}
        name="employmentTypes"
        render={({ field }) => (
          <FormControl component="fieldset">
            <FormLabel component="legend">{t('fields.employmentTypes')}</FormLabel>
            <FormGroup row>
              {EMPLOYMENT_TYPES.map((x) => (
                <FormControlLabel key={x} label={t(`employmentType.${x}`)} control={<Checkbox size="small" checked={field.value.includes(x)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, x] : field.value.filter((y) => y !== x))} />} />
              ))}
            </FormGroup>
            <FormHelperText>{t('required.typesHint')}</FormHelperText>
          </FormControl>
        )}
      />
    </FormDialog>
  );
}

function ThresholdDialog({ days, onClose, onDone }: { days: number; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const mutation = useUpdateSettings();
  const { register, handleSubmit, formState } = useForm<ThresholdFormValues>({ resolver: zodResolver(thresholdFormSchema), defaultValues: { expiryWarningDays: String(days) } });
  return (
    <FormDialog open title={t('required.thresholdTitle')} onClose={onClose} onSubmit={handleSubmit((v) => mutation.mutate({ expiryWarningDays: Number(v.expiryWarningDays) }, { onSuccess: onDone }))} submitLabel={t('actions.save')} pending={mutation.isPending} error={mutation.isError ? errorText(t, tCommon, mutation.error) : undefined}>
      <TextField label={t('fields.thresholdDays')} required {...textFieldProps(register, formState, 'expiryWarningDays', (r) => fieldErrorText(t, r), t('required.thresholdHint'))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
    </FormDialog>
  );
}
