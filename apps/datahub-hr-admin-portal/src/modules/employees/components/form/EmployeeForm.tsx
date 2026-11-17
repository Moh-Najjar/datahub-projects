import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/useLanguage';
import { countryName, LOCATION_COUNTRIES } from '@/modules/organization';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useAssignmentOptions, type AssignmentOption } from '@/modules/employees/hooks/useAssignmentOptions';
import { useCreateEmployee, useManagerOptions, useUpdateEmployee } from '@/modules/employees/hooks/useEmployees';
import { employeePaths } from '@/modules/employees/paths';
import {
  EMPLOYEE_FORM_FIELDS,
  EMPTY_EMPLOYEE_FORM,
  employeeFormSchema,
  toEmployeeFormValues,
  toEmployeeInput,
  type EmployeeFormValues,
} from '@/modules/employees/schemas/employeeSchemas';
import { EMPLOYMENT_TYPES, GENDERS, MARITAL_STATUSES, RELATIONSHIPS, type Employee, type EmployeeInput, type EmployeeOption } from '@/modules/employees/types/employee';
import { employeeToInput } from '@/modules/employees/utils/employeeInput';
import { displayName } from '@/modules/employees/utils/names';
import { errorText, fieldErrorText } from '@/modules/employees/utils/serverErrors';

type Field = keyof EmployeeFormValues;

/**
 * Another module's create flow (e.g. Recruitment converting a hired candidate): the form is pre-filled, submits the
 * validated EmployeeInput to `submit` instead of Employee Management's create, and the caller handles success.
 * Server field errors passed to `onError` are shown on the fields as usual.
 */
export interface ExternalCreate {
  prefill: Partial<EmployeeInput>;
  submit: (input: EmployeeInput, onError: (error: Error) => void) => void;
  pending: boolean;
  submitLabel: string;
  cancelTo: string;
}

/** Create (no `employee`) or edit an employee. On success, opens the profile with a confirmation. */
export function EmployeeForm({ employee, external }: { employee?: Employee; external?: ExternalCreate }) {
  const { t } = useTranslation('employees');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const [formError, setFormError] = useState<string>();
  const prefill = external?.prefill;
  const saved = useMemo(() => {
    if (employee) return toEmployeeFormValues(employeeToInput(employee));
    if (!prefill) return EMPTY_EMPLOYEE_FORM;
    const filled = Object.entries(toEmployeeFormValues(prefill as EmployeeInput)).filter(([, v]) => v !== undefined && v !== '');
    return { ...EMPTY_EMPLOYEE_FORM, ...Object.fromEntries(filled) } as EmployeeFormValues;
  }, [employee, prefill]);

  const { register, control, handleSubmit, formState, setError, setValue } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: saved,
  });
  const departmentId = useWatch({ control, name: 'departmentId' });
  const options = useAssignmentOptions(departmentId, {
    departmentId: employee?.department.id,
    positionId: employee?.position.id,
    locationId: employee?.location.id,
    reportingDepartmentId: employee?.reportingDepartment?.id,
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Field, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const countries = useMemo(() => LOCATION_COUNTRIES.map((c) => ({ value: c, label: countryName(c, language), active: true, disabled: false })).sort((a, b) => a.label.localeCompare(b.label, language)), [language]);
  const enumOptions = (values: readonly string[], prefix: 'genders' | 'marital' | 'types' | 'relationships') =>
    values.map((v) => ({ value: v, label: t(`${prefix}.${v}` as never), active: true, disabled: false }));

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    const input = toEmployeeInput(employeeFormSchema.parse(values));
    const handlers = {
      onSuccess: (result: Employee) => navigate(employeePaths.profile(result.id), { state: { notice: employee ? t('form.updated') : t('form.created') } }),
      onError: (error: Error) => {
        if (!applyServerErrors(error, EMPLOYEE_FORM_FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (external) external.submit(input, handlers.onError);
    else if (employee) update.mutate({ id: employee.id, input }, handlers);
    else create.mutate(input, handlers);
  });
  const pending = create.isPending || update.isPending || Boolean(external?.pending);
  const hasErrors = formState.submitCount > 0 && Object.keys(formState.errors).length > 0;
  const date = (name: Field, label: string, required: boolean, helper?: string) => (
    <TextField label={label} type="date" required={required} {...text(name, helper)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} />
  );

  return (
    <Box component="form" noValidate onSubmit={onSubmit} aria-label={employee ? t('form.editTitle') : t('form.createTitle')}>
      <Stack spacing={2.5}>
        {formError && (
          <Alert severity="error" role="alert">
            {formError}
          </Alert>
        )}
        {hasErrors && !formError && <Alert severity="warning">{t('form.fixErrors')}</Alert>}

        <Section title={t('form.sections.personal')}>
          <TextField label={t('fields.employeeNumber')} required {...text('employeeNumber', t('form.employeeNumberHint'))} slotProps={latinInput} />
          {/* Keeps the employee number alone on its row in the two-column layout. */}
          <Box aria-hidden sx={{ display: { xs: 'none', md: 'block' } }} />
          <TextField label={t('fields.firstNameEn')} required {...text('firstNameEn')} slotProps={latinInput} />
          <TextField label={t('fields.lastNameEn')} required {...text('lastNameEn')} slotProps={latinInput} />
          <TextField label={t('fields.firstNameAr')} required {...text('firstNameAr')} slotProps={arabicInput} />
          <TextField label={t('fields.lastNameAr')} required {...text('lastNameAr')} slotProps={arabicInput} />
          {date('dateOfBirth', t('fields.dateOfBirth'), true)}
          <SelectField control={control} name="gender" label={t('fields.gender')} options={enumOptions(GENDERS, 'genders')} translate={translate} required />
          <SelectField control={control} name="nationality" label={t('fields.nationality')} options={countries} translate={translate} required />
          <SelectField control={control} name="maritalStatus" label={t('fields.maritalStatus')} options={enumOptions(MARITAL_STATUSES, 'marital')} translate={translate} required />
        </Section>

        <Section title={t('form.sections.contact')}>
          <TextField label={t('fields.workEmail')} type="email" required {...text('workEmail', t('form.workEmailHint'))} slotProps={latinInput} />
          <TextField label={t('fields.personalEmail')} type="email" {...text('personalEmail')} slotProps={latinInput} />
          <TextField label={t('fields.phone')} type="tel" required {...text('phone')} slotProps={latinInput} />
          <TextField label={t('fields.alternativePhone')} type="tel" {...text('alternativePhone')} slotProps={latinInput} />
          <TextField label={t('fields.address')} required {...text('address')} />
          <TextField label={t('fields.city')} required {...text('city')} />
          <SelectField control={control} name="country" label={t('fields.country')} options={countries} translate={translate} required />
        </Section>

        <Section title={t('form.sections.employment')}>
          {date('hireDate', t('fields.hireDate'), true)}
          <SelectField control={control} name="employmentType" label={t('fields.employmentType')} options={enumOptions(EMPLOYMENT_TYPES, 'types')} translate={translate} required />
          {date('contractStartDate', t('fields.contractStartDate'), true)}
          {date('contractEndDate', t('fields.contractEndDate'), false, t('form.contractEndHint'))}
          {date('probationEndDate', t('fields.probationEndDate'), false, t('form.probationHint'))}
        </Section>

        <Section title={t('form.sections.organization')}>
          <SelectField
            control={control}
            name="departmentId"
            label={t('fields.department')}
            options={options.departments}
            translate={translate}
            required
            onChange={() => {
              // Positions belong to a department and managers depend on it: choose them again.
              setValue('positionId', '');
              setValue('managerId', '');
            }}
          />
          <SelectField
            control={control}
            name="positionId"
            label={t('fields.position')}
            options={options.positions}
            translate={translate}
            required
            disabled={!departmentId}
            helper={departmentId ? t('form.positionHint') : t('form.selectDepartmentFirst')}
          />
          <SelectField control={control} name="locationId" label={t('fields.workLocation')} options={options.locations} translate={translate} required />
          <ManagerSelect control={control} departmentId={departmentId} employee={employee} translate={translate} />
          <SelectField control={control} name="reportingDepartmentId" label={t('fields.reportingDepartment')} options={options.reportingDepartments} translate={translate} emptyLabel={t('form.none')} />
        </Section>

        <Section title={t('form.sections.emergency')}>
          <TextField label={t('fields.emergencyName')} required {...text('emergencyName')} />
          <SelectField control={control} name="emergencyRelationship" label={t('fields.emergencyRelationship')} options={enumOptions(RELATIONSHIPS, 'relationships')} translate={translate} required />
          <TextField label={t('fields.emergencyPhone')} type="tel" required {...text('emergencyPhone')} slotProps={latinInput} />
          <TextField label={t('fields.emergencyAlternativePhone')} type="tel" {...text('emergencyAlternativePhone')} slotProps={latinInput} />
        </Section>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1.5 }}>
          <Button component={RouterLink} to={external ? external.cancelTo : employee ? employeePaths.profile(employee.id) : employeePaths.directory} disabled={pending}>
            {tCommon('actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? tCommon('actions.saving') : external ? external.submitLabel : employee ? t('form.save') : t('form.create')}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" component="fieldset" sx={{ p: { xs: 2, sm: 3 }, m: 0, minWidth: 0 }}>
      <Typography component="legend" variant="h6" sx={{ px: 0.5 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'grid', gap: 2.5, mt: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>{children}</Box>
    </Paper>
  );
}

interface SelectFieldProps {
  control: Control<EmployeeFormValues>;
  name: Field;
  label: string;
  options: ReadonlyArray<Pick<AssignmentOption, 'value' | 'label' | 'active' | 'disabled'> & { depth?: number }>;
  translate: (reason: string | undefined) => string | undefined;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  /** Adds an empty choice with this label (optional fields). */
  emptyLabel?: string;
  onChange?: (value: string) => void;
}

function SelectField({ control, name, label, options, translate, required, disabled, helper, emptyLabel, onChange }: SelectFieldProps) {
  const { t } = useTranslation('employees');
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          select
          label={label}
          required={required}
          disabled={disabled}
          value={field.value ?? ''}
          onChange={(event) => {
            field.onChange(event.target.value);
            onChange?.(event.target.value);
          }}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={Boolean(fieldState.error)}
          helperText={translate(fieldState.error?.message) ?? helper}
        >
          {emptyLabel ? (
            <MenuItem value="">{emptyLabel}</MenuItem>
          ) : (
            <MenuItem value="" disabled>
              {t('form.select')}
            </MenuItem>
          )}
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value} disabled={o.disabled} sx={{ pl: 2 + (o.depth ?? 0) * 2 }}>
              {o.active ? o.label : t('form.inactiveOption', { name: o.label })}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}

/** Direct manager: server-side search of VALID managers for the selected department (none = no manager). */
function ManagerSelect({ control, departmentId, employee, translate }: { control: Control<EmployeeFormValues>; departmentId: string; employee?: Employee; translate: (r: string | undefined) => string | undefined }) {
  const { t } = useTranslation('employees');
  const { language } = useLanguage();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);
  const query = useManagerOptions({ departmentId, excludeEmployeeId: employee?.id, search }, Boolean(departmentId));
  const results = departmentId ? (query.data ?? []) : [];
  // The saved manager stays displayable even if no longer in the results.
  const saved: EmployeeOption | null =
    employee?.manager && departmentId === employee.department.id
      ? { id: employee.manager.id, name: { first: { en: employee.manager.name.en, ar: employee.manager.name.ar }, last: { en: '', ar: '' } }, employeeNumber: '', position: { id: '', name: { en: '', ar: '' } }, department: { id: '', name: { en: '', ar: '' } } }
      : null;
  const options = saved && !results.some((o) => o.id === saved.id) ? [saved, ...results] : results;

  return (
    <Controller
      control={control}
      name="managerId"
      render={({ field, fieldState }) => (
        <Autocomplete<EmployeeOption>
          options={options}
          disabled={!departmentId}
          loading={query.isFetching}
          value={options.find((o) => o.id === field.value) ?? null}
          onChange={(_, option) => field.onChange(option?.id ?? '')}
          onInputChange={(_, value, reason) => reason === 'input' && setInput(value)}
          onBlur={field.onBlur}
          getOptionLabel={(o) => displayName(o.name, language).trim()}
          getOptionKey={(o) => o.id}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(list) => list}
          renderOption={({ key, ...props }, o) => (
            <li key={key} {...props}>
              <Box>
                <Typography variant="body2">{displayName(o.name, language)}</Typography>
                {o.employeeNumber && (
                  <Typography variant="caption" color="text.secondary">
                    <span dir="ltr">{o.employeeNumber}</span> · {o.position.name[language]} · {o.department.name[language]}
                  </Typography>
                )}
              </Box>
            </li>
          )}
          loadingText={t('form.loadingOptions')}
          noOptionsText={t('form.noOptions')}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={field.ref}
              label={t('fields.manager')}
              placeholder={departmentId ? t('form.managerSearch') : undefined}
              error={Boolean(fieldState.error)}
              helperText={translate(fieldState.error?.message) ?? (departmentId ? t('form.managerHint') : t('form.selectDepartmentFirst'))}
            />
          )}
        />
      )}
    />
  );
}

