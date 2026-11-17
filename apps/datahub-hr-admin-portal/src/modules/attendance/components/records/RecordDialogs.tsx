import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import type { EmployeeSummary } from '@/modules/employees';
import { useCheckIn, useCheckOut, useCreateAttendanceRecord, useShifts, useUpdateAttendanceRecord } from '@/modules/attendance/hooks/useAttendance';
import { punchSchema, recordCreateSchema, recordUpdateSchema, type PunchValues, type RecordCreateValues, type RecordUpdateValues } from '@/modules/attendance/schemas/attendanceSchemas';
import type { AttendanceRecord } from '@/modules/attendance/types/attendance';
import { formatClock } from '@/modules/attendance/utils/format';
import { errorText, fieldErrorText, firstReason } from '@/modules/attendance/utils/serverErrors';
import { toDateTime, todayIso } from '@/modules/attendance/utils/time';
import { EmployeePicker } from '../common/EmployeePicker';

const dateTimeProps = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', step: 60 } } as const;

/** SIMULATED check-in / check-out for one record. The time defaults to now (or the scheduled time for past days). */
export function PunchDialog({ record, kind, onClose, onDone }: { record: AttendanceRecord; kind: 'in' | 'out'; onClose: () => void; onDone: (record: AttendanceRecord) => void }) {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const mutation = kind === 'in' ? checkIn : checkOut;
  const [formError, setFormError] = useState<string>();
  const [initial] = useState(() => {
    const now = toDateTime(Date.now());
    const scheduled = kind === 'in' ? record.scheduledStart : record.scheduledEnd;
    return scheduled < now ? scheduled : now;
  });
  const { register, handleSubmit, formState, setError } = useForm<PunchValues>({ resolver: zodResolver(punchSchema), defaultValues: { time: initial } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);

  const onSubmit = handleSubmit(({ time }) => {
    setFormError(undefined);
    mutation.mutate(
      { recordId: record.id, time },
      {
        onSuccess: onDone,
        // The backend names `time`, `checkIn` or `checkOut`: in this dialog they are all the one time field.
        onError: (error) => {
          const reason = firstReason(error);
          if (reason) setError('time', { type: 'server', message: reason }, { shouldFocus: true });
          else setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });

  return (
    <FormDialog open title={t(kind === 'in' ? 'punch.checkInTitle' : 'punch.checkOutTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.record')} pending={mutation.isPending} error={formError}>
      <Alert severity="info">{t('punch.hint')}</Alert>
      <TextField label={t('fields.time')} type="datetime-local" required {...textFieldProps(register, formState, 'time', translate)} slotProps={dateTimeProps} />
    </FormDialog>
  );
}

/** Correct a record: punches and note (approved leave comes from Leave Management). Status and hours are recomputed by the backend. */
export function RecordEditDialog({ record, onClose, onDone }: { record: AttendanceRecord; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const update = useUpdateAttendanceRecord();
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState, setError } = useForm<RecordUpdateValues>({
    resolver: zodResolver(recordUpdateSchema),
    defaultValues: { checkIn: record.checkIn ?? '', checkOut: record.checkOut ?? '', note: record.note },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    update.mutate(
      { id: record.id, input: { checkIn: v.checkIn || null, checkOut: v.checkOut || null, note: v.note } },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ['checkIn', 'checkOut', 'note'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });

  return (
    <FormDialog open title={t('edit.title')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.save')} pending={update.isPending} error={formError}>
      <TextField label={t('fields.checkIn')} type="datetime-local" {...textFieldProps(register, formState, 'checkIn', translate)} slotProps={dateTimeProps} />
      <TextField label={t('fields.checkOut')} type="datetime-local" {...textFieldProps(register, formState, 'checkOut', translate, t('edit.checkOutHint'))} slotProps={dateTimeProps} />
      {record.onLeave && <Alert severity="info">{t('edit.leaveHint')}</Alert>}
      <TextField label={t('fields.note')} multiline minRows={2} {...textFieldProps(register, formState, 'note', translate)} />
    </FormDialog>
  );
}

/** Manual record for a day without a scheduled one (e.g. weekend work). */
export function CreateRecordDialog({ onClose, onDone }: { onClose: () => void; onDone: (record: AttendanceRecord) => void }) {
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const create = useCreateAttendanceRecord();
  const shifts = useShifts({ page: 1, pageSize: 100, sortBy: 'code', sortDirection: 'asc', filters: { status: 'active' } });
  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [formError, setFormError] = useState<string>();
  const [today] = useState(() => todayIso());
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<RecordCreateValues>({
    resolver: zodResolver(recordCreateSchema),
    defaultValues: { employeeId: '', date: today, shiftId: '', checkIn: '', checkOut: '', note: '' },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const shiftOptions = useMemo(() => shifts.data?.items ?? [], [shifts.data]);

  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    create.mutate(
      { employeeId: v.employeeId, date: v.date, shiftId: v.shiftId, checkIn: v.checkIn || null, checkOut: v.checkOut || null, note: v.note },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, ['employeeId', 'date', 'shiftId', 'checkIn', 'checkOut', 'note'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });

  return (
    <FormDialog open title={t('edit.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.create')} pending={create.isPending} error={formError}>
      <Alert severity="info">{t('edit.createHint')}</Alert>
      <EmployeePicker
        label={t('fields.employee')}
        value={employee}
        activeOnly
        onChange={(e) => {
          setEmployee(e);
          setValue('employeeId', e?.id ?? '', { shouldValidate: formState.isSubmitted });
        }}
        error={translate(formState.errors.employeeId?.message)}
      />
      <TextField label={t('fields.date')} type="date" required {...textFieldProps(register, formState, 'date', translate)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr', max: today } }} />
      <Controller
        control={control}
        name="shiftId"
        render={({ field, fieldState }) => (
          <TextField select required label={t('fields.shift')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} error={Boolean(fieldState.error)} helperText={translate(fieldState.error?.message)}>
            {shiftOptions.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name[language]} ({formatClock(s.startTime, language)}–{formatClock(s.endTime, language)})
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <TextField label={t('fields.checkIn')} type="datetime-local" {...textFieldProps(register, formState, 'checkIn', translate)} slotProps={dateTimeProps} />
      <TextField label={t('fields.checkOut')} type="datetime-local" {...textFieldProps(register, formState, 'checkOut', translate, t('edit.checkOutHint'))} slotProps={dateTimeProps} />
      <TextField label={t('fields.note')} multiline minRows={2} {...textFieldProps(register, formState, 'note', translate)} />
    </FormDialog>
  );
}
