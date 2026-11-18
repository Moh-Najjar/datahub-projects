import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ToggleOffOutlined from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlined from '@mui/icons-material/ToggleOnOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Control, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { DataTable, type Column } from '@/modules/shared/DataTable';
import { Feedback } from '@/modules/shared/Feedback';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { useListState } from '@/modules/shared/hooks/useListState';
import { useStatusFlow } from '@/modules/shared/hooks/useStatusFlow';
import { FilterSelect, ListToolbar } from '@/modules/shared/ListToolbar';
import { RowActions } from '@/modules/shared/RowActions';
import { SelectField } from '@/modules/shared/SelectField';
import { StatusChip } from '@/modules/shared/StatusChip';
import { visuallyHidden } from '@/modules/shared/styles';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreateCategory, useDocumentCategories, useUpdateCategory, useUpdateCategoryStatus } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { categoryFormSchema, categoryToForm, toCategoryInput, type CategoryFormValues } from '@/modules/documents/schemas/documentSchemas';
import { CATEGORY_GROUPS, CONFIDENTIALITY_LEVELS, EMPLOYMENT_TYPES, FILE_TYPES, OWNER_TYPES, type CategoryFilters, type CategoryGroup, type CategorySortField, type DocumentCategory, type RecordStatus } from '@/modules/documents/types/documents';
import { errorText, fieldErrorText } from '@/modules/documents/utils/serverErrors';
import { Code } from '../common/Chips';

/** Document categories: configuration used by uploads, filters, visibility and required-document rules. */
export function CategoriesSection() {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { canConfigure } = useDocumentsAccess();
  const list = useListState<CategoryFilters, CategorySortField>('code');
  const sortBy = list.sortBy === 'name.en' || list.sortBy === 'name.ar' ? (`name.${language}` as const) : list.sortBy;
  const query = useDocumentCategories({ ...list.params, sortBy });
  const feedback = useFeedback();
  const [editing, setEditing] = useState<{ category?: DocumentCategory } | null>(null);
  const status = useStatusFlow<DocumentCategory>({
    mutation: useUpdateCategoryStatus(),
    name: (c) => c.name[language],
    confirmTitle: (name) => t('categories.deactivateTitle', { name }),
    confirmText: t('categories.deactivateText'),
    confirmLabel: t('actions.deactivate'),
    successText: (name, s) => t(s === 'active' ? 'common.activated' : 'common.deactivated', { name }),
    errorText: (error) => errorText(t, tCommon, error),
    notify: feedback.notify,
  });

  const columns: Column<DocumentCategory, CategorySortField>[] = [
    { id: 'code', label: t('fields.code'), sortField: 'code', render: (c) => <Code>{c.code}</Code> },
    {
      id: 'name',
      label: t('fields.name'),
      sortField: 'name.en',
      render: (c) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {c.name[language]}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {c.tracksExpiry && <Chip size="small" variant="outlined" label={t('categories.tracksExpiry')} />}
            {c.requiresNumber && <Chip size="small" variant="outlined" label={t('categories.requiresNumber')} />}
            {c.required && <Chip size="small" variant="outlined" color="primary" label={t('categories.required')} />}
            {c.transferOnHire && <Chip size="small" variant="outlined" label={t('categories.transferOnHire')} />}
          </Box>
        </Box>
      ),
    },
    { id: 'group', label: t('fields.group'), sortField: 'group', hideBelow: 'md', render: (c) => t(`groups.${c.group}`) },
    { id: 'files', label: t('fields.allowedFiles'), hideBelow: 'lg', render: (c) => <span dir="ltr">{c.allowedFileTypes.join(', ')} · {c.maxFileSizeMb} MB</span> },
    { id: 'confidentiality', label: t('fields.confidentiality'), hideBelow: 'xl', render: (c) => t(`confidentiality.${c.defaultConfidentiality}`) },
    { id: 'documents', label: t('fields.documents'), sortField: 'documentCount', align: 'right', hideBelow: 'sm', render: (c) => formatNumber(c.documentCount, language) },
    { id: 'status', label: t('fields.status'), sortField: 'status', render: (c) => <StatusChip status={c.status} /> },
    ...(canConfigure
      ? [
          {
            id: 'actions',
            label: <Box component="span" sx={visuallyHidden}>{tCommon('list.actions')}</Box>,
            align: 'right' as const,
            render: (c: DocumentCategory) => (
              <RowActions
                name={c.name[language]}
                actions={[
                  { label: t('actions.edit'), icon: EditOutlined, onClick: () => setEditing({ category: c }) },
                  { label: c.status === 'active' ? t('actions.deactivate') : t('actions.activate'), icon: c.status === 'active' ? ToggleOffOutlined : ToggleOnOutlined, onClick: () => status.request(c) },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack spacing={2}>
      <Alert severity="info">{canConfigure ? t('categories.hint') : t('categories.readOnly')}</Alert>
      <section aria-label={t('categories.title')}>
        <ListToolbar
          search={list.search}
          onSearch={list.setSearch}
          searchLabel={t('categories.search')}
          hasFilters={list.hasFilters}
          onClear={list.clearFilters}
          createLabel={canConfigure ? t('categories.create') : undefined}
          onCreate={canConfigure ? () => setEditing({}) : undefined}
          filters={
            <>
              <FilterSelect label={t('fields.group')} value={list.filters.group ?? ''} onChange={(v) => list.setFilter('group', (v || undefined) as CategoryGroup | undefined)} allLabel={t('filters.allGroups')} options={CATEGORY_GROUPS.map((g) => ({ value: g, label: t(`groups.${g}`) }))} />
              <FilterSelect label={t('fields.status')} value={list.filters.status ?? ''} onChange={(v) => list.setFilter('status', (v || undefined) as RecordStatus | undefined)} allLabel={t('filters.allStatuses')} options={(['active', 'inactive'] as const).map((s) => ({ value: s, label: tCommon(`status.${s}`) }))} />
            </>
          }
        />
        <DataTable label={t('categories.title')} columns={columns} getRowId={(c) => c.id} query={query} sort={list} pagination={list} filtered={list.hasFilters} />
      </section>
      {editing && (
        <CategoryDialog
          category={editing.category}
          onClose={() => setEditing(null)}
          onDone={(c) => {
            setEditing(null);
            feedback.notify(t(editing.category ? 'common.saved' : 'common.created', { name: c.name[language] }));
          }}
        />
      )}
      {status.dialog}
      <Feedback {...feedback} />
    </Stack>
  );
}

const FIELDS = ['code', 'nameEn', 'nameAr', 'description', 'group', 'appliesTo', 'allowedFileTypes', 'maxFileSizeMb', 'employmentTypes', 'defaultConfidentiality'] as const;

function CheckboxGroup<V extends string>({ control, name, label, options, labelOf }: { control: Control<CategoryFormValues>; name: 'appliesTo' | 'allowedFileTypes' | 'employmentTypes'; label: string; options: readonly V[]; labelOf: (v: V) => string }) {
  const { t } = useTranslation('documents');
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value as string[];
        return (
          <FormControl component="fieldset" error={Boolean(fieldState.error)}>
            <FormLabel component="legend">{label}</FormLabel>
            <FormGroup row>
              {options.map((o) => (
                <FormControlLabel key={o} label={labelOf(o)} control={<Checkbox size="small" checked={value.includes(o)} onChange={(e) => field.onChange(e.target.checked ? [...value, o] : value.filter((x) => x !== o))} />} />
              ))}
            </FormGroup>
            {fieldState.error && <FormHelperText>{fieldErrorText(t, fieldState.error.message)}</FormHelperText>}
          </FormControl>
        );
      }}
    />
  );
}

function CategoryDialog({ category, onClose, onDone }: { category?: DocumentCategory; onClose: () => void; onDone: (c: DocumentCategory) => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const mutation = category ? update : create;
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema), defaultValues: categoryToForm(category) });
  const appliesTo = useWatch({ control, name: 'appliesTo' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<CategoryFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const flag = (name: 'required' | 'tracksExpiry' | 'requiresNumber' | 'employeeVisible' | 'managerVisible' | 'transferOnHire', label: string, disabled = false) => (
    <Controller control={control} name={name} render={({ field }) => <FormControlLabel disabled={disabled} control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={label} />} />
  );
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    const input = toCategoryInput(categoryFormSchema.parse(v));
    const callbacks = {
      onSuccess: onDone,
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (category) update.mutate({ id: category.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });
  return (
    <FormDialog open maxWidth="md" title={category ? t('categories.editTitle') : t('categories.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={category ? t('actions.save') : t('actions.create')} pending={mutation.isPending} error={formError}>
      {category && <Alert severity="info">{t('categories.editHint')}</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField label={t('fields.code')} required {...text('code', t('categories.codeHint'))} slotProps={latinInput} />
        <SelectField control={control} name="group" label={t('fields.group')} translate={translate} helper={t('categories.groupHint')} options={CATEGORY_GROUPS.map((g) => ({ value: g, label: t(`groups.${g}`) }))} />
        <TextField label={t('fields.nameEn')} required {...text('nameEn')} slotProps={latinInput} />
        <TextField label={t('fields.nameAr')} required {...text('nameAr')} slotProps={arabicInput} />
        <TextField label={t('fields.maxFileSize')} required {...text('maxFileSizeMb', t('categories.sizeHint'))} slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }} />
        <SelectField control={control} name="defaultConfidentiality" label={t('fields.defaultConfidentiality')} translate={translate} options={CONFIDENTIALITY_LEVELS.map((c) => ({ value: c, label: t(`confidentiality.${c}`) }))} />
      </Box>
      <CheckboxGroup control={control} name="appliesTo" label={t('fields.appliesTo')} options={OWNER_TYPES} labelOf={(o) => t(`ownerType.${o}`)} />
      <CheckboxGroup control={control} name="allowedFileTypes" label={t('fields.allowedFiles')} options={FILE_TYPES} labelOf={(o) => o.toUpperCase()} />
      <CheckboxGroup control={control} name="employmentTypes" label={t('fields.employmentTypes')} options={EMPLOYMENT_TYPES} labelOf={(o) => t(`employmentType.${o}`)} />
      <FormGroup>
        {flag('required', t('categories.flagRequired'))}
        {flag('tracksExpiry', t('categories.flagExpiry'))}
        {flag('requiresNumber', t('categories.flagNumber'))}
        {flag('employeeVisible', t('categories.flagEmployee'))}
        {flag('managerVisible', t('categories.flagManager'))}
        {flag('transferOnHire', t('categories.flagTransfer'), !(appliesTo.includes('candidate') && appliesTo.includes('employee')))}
      </FormGroup>
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
    </FormDialog>
  );
}
