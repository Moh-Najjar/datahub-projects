import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { displayName, type EmployeeSummary } from '@/modules/employees';
import { useWorkingWeek } from '@/modules/settings';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';
import { FormDialog } from '@/modules/shared/FormDialog';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useAssignShift, useCreateShift, useUpdateShift } from '@/modules/attendance/hooks/useAttendance';
import { shiftFormSchema, toShiftInput, type ShiftFormValues } from '@/modules/attendance/schemas/attendanceSchemas';
import { WEEKDAYS, type Shift } from '@/modules/attendance/types/attendance';
import { errorText, fieldErrorText } from '@/modules/attendance/utils/serverErrors';
import { EmployeePicker } from '../common/EmployeePicker';

const FIELDS = ['code', 'nameEn', 'nameAr', 'startTime', 'endTime', 'breakMinutes', 'graceMinutes', 'workDays'] as const;

function MinutesField({ control, name, label, helper, translate }: { control: Control<ShiftFormValues>; name: 'breakMinutes' | 'graceMinutes'; label: string; helper: string; translate: (r: string | undefined) => string | undefined }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          type="number"
          required
          label={label}
          value={Number.isNaN(field.value) ? '' : field.value}
          onChange={(e) => field.onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
          onBlur={field.onBlur}
          inputRef={field.ref}
          error={Boolean(fieldState.error)}
          helperText={translate(fieldState.error?.message) ?? helper}
          slotProps={{ htmlInput: { min: 0, step: 5, dir: 'ltr' } }}
        />
      )}
    />
  );
}

/** Create / edit a shift. Mount only while open. */
export function ShiftFormDialog({ shift, onClose, onSaved }: { shift?: Shift; onClose: () => void; onSaved: (created: boolean) => void }) {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateShift();
  const update = useUpdateShift();
  const [formError, setFormError] = useState<string>();
  // A NEW shift starts with the organisation's working week (System Settings); existing shifts keep their own days.
  const week = useWorkingWeek(!shift);
  const defaults: ShiftFormValues = {
    code: shift?.code ?? '',
    nameEn: shift?.name.en ?? '',
    nameAr: shift?.name.ar ?? '',
    startTime: shift?.startTime ?? '08:00',
    endTime: shift?.endTime ?? '16:00',
    breakMinutes: shift?.breakMinutes ?? 60,
    graceMinutes: shift?.graceMinutes ?? 10,
    workDays: shift?.workDays ?? week.data?.workDays ?? [0, 1, 2, 3, 4],
  };
  const { register, control, handleSubmit, formState, setError } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: defaults,
    // When the working week arrives after the dialog opened, apply it unless the user already changed the days.
    values: !shift && week.data ? defaults : undefined,
    resetOptions: { keepDirtyValues: true },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const field = (name: (typeof FIELDS)[number], helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const dayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: 'long' });
    // 2026-11-15 is a Sunday.
    return WEEKDAYS.map((d) => format.format(new Date(2026, 10, 15 + d)));
  }, [language]);

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    const input = toShiftInput(shiftFormSchema.parse(values));
    const handlers = {
      onSuccess: () => onSaved(!shift),
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (shift) update.mutate({ id: shift.id, input }, handlers);
    else create.mutate(input, handlers);
  });

  return (
    <FormDialog open title={shift ? t('shifts.editTitle') : t('shifts.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={shift ? t('actions.save') : t('actions.create')} pending={create.isPending || update.isPending} error={formError}>
      <TextField label={t('shifts.code')} required autoFocus {...field('code')} slotProps={latinInput} />
      <TextField label={t('shifts.nameEn')} required {...field('nameEn')} slotProps={latinInput} />
      <TextField label={t('shifts.nameAr')} required {...field('nameAr')} slotProps={arabicInput} />
      <TextField label={t('shifts.start')} type="time" required {...field('startTime')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} />
      <TextField label={t('shifts.end')} type="time" required {...field('endTime', t('shifts.timesHint'))} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} />
      <MinutesField control={control} name="breakMinutes" label={t('shifts.break')} helper={t('shifts.breakHint')} translate={translate} />
      <MinutesField control={control} name="graceMinutes" label={t('shifts.grace')} helper={t('shifts.graceHint')} translate={translate} />
      <Controller
        control={control}
        name="workDays"
        render={({ field: days, fieldState }) => (
          <FormControl component="fieldset" error={Boolean(fieldState.error)}>
            <FormLabel component="legend">{t('shifts.workDays')}</FormLabel>
            <FormGroup row>
              {WEEKDAYS.map((d) => (
                <FormControlLabel
                  key={d}
                  label={dayNames[d]}
                  control={
                    <Checkbox
                      checked={days.value.includes(d)}
                      onChange={(e) => days.onChange(e.target.checked ? [...days.value, d] : days.value.filter((x) => x !== d))}
                    />
                  }
                />
              ))}
            </FormGroup>
            {fieldState.error && <FormHelperText>{translate(fieldState.error.message)}</FormHelperText>}
          </FormControl>
        )}
      />
    </FormDialog>
  );
}

/** Assign active employees to a shift (from today; past records keep their shift). */
export function AssignShiftDialog({ shift, onClose, onSaved }: { shift: Shift; onClose: () => void; onSaved: (count: number) => void }) {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const assign = useAssignShift();
  const [selected, setSelected] = useState<EmployeeSummary[]>([]);
  const [pick, setPick] = useState<EmployeeSummary | null>(null);
  const [formError, setFormError] = useState<string>();

  return (
    <FormDialog
      open
      title={t('shifts.assignTitle', { name: shift.name[language] })}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        setFormError(undefined);
        if (!selected.length) {
          setFormError(t('validation.required'));
          return;
        }
        assign.mutate({ shiftId: shift.id, employeeIds: selected.map((e) => e.id) }, { onSuccess: (r) => onSaved(r.assigned), onError: (error) => setFormError(errorText(t, tCommon, error)) });
      }}
      submitLabel={t('actions.assign')}
      pending={assign.isPending}
      error={formError}
    >
      <Alert severity="info">{t('shifts.assignHint')}</Alert>
      <EmployeePicker
        label={t('shifts.assignEmployees')}
        value={pick}
        activeOnly
        onChange={(e) => {
          if (e && !selected.some((s) => s.id === e.id)) setSelected([...selected, e]);
          setPick(null);
        }}
      />
      {selected.length > 0 && (
        <Box component="ul" aria-label={t('shifts.members')} sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selected.map((e) => (
            <li key={e.id}>
              <Chip label={displayName(e.name, language)} onDelete={() => setSelected(selected.filter((s) => s.id !== e.id))} />
            </li>
          ))}
        </Box>
      )}
    </FormDialog>
  );
}
