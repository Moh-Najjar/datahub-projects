import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { formatDate } from '@/i18n/format';
import { FORMAT_LOCALE } from '@/i18n/languages';
import { useLanguage } from '@/i18n/useLanguage';
import { Feedback } from '@/modules/shared/Feedback';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput } from '@/modules/shared/formFields';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { Panel } from '@/modules/shared/Panel';
import { useHolidays, useHolidayStatus, useSaveHoliday } from '@/modules/settings/hooks/useSettings';
import { useValidationText } from '@/modules/settings/hooks/useValidationText';
import { holidaySchema } from '@/modules/settings/schemas/settingsSchemas';
import type { Holiday, HolidayInput } from '@/modules/settings/types/settings';
import { ReasonDialog } from '@/modules/shared/ReasonDialog';
import { SectionEditor } from '../common/SectionEditor';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function WorkingWeek({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const message = useValidationText();
  const day = (d: number) => new Intl.DateTimeFormat(FORMAT_LOCALE[language], { weekday: 'long' }).format(new Date(2026, 10, 15 + d));
  return (
    <SectionEditor section="workingWeek" title={t('calendar.workingWeek')} subtitle={t('calendar.workingWeekHint')} readOnly={readOnly}>
      {(form, disabled) => (
        <Controller
          control={form.control}
          name="workDays"
          render={({ field, fieldState }) => {
            const days = (field.value ?? []) as number[];
            return (
              <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
                <Typography component="legend" variant="body2" color="text.secondary">
                  {t('calendar.workingWeek')}
                </Typography>
                <FormGroup row>
                  {DAYS.map((d) => (
                    <FormControlLabel
                      key={d}
                      control={<Checkbox checked={days.includes(d)} disabled={disabled} onChange={() => field.onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b))} />}
                      label={day(d)}
                      sx={{ minWidth: { xs: '45%', sm: 150 }, mr: 0 }}
                    />
                  ))}
                </FormGroup>
                {fieldState.error && <FormHelperText error>{message(fieldState.error.message ?? (fieldState.error as unknown as { root?: { message?: string } }).root?.message)}</FormHelperText>}
              </Box>
            );
          }}
        />
      )}
    </SectionEditor>
  );
}

function HolidayDialog({ holiday, onClose, onSaved }: { holiday: Holiday | 'new'; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const message = useValidationText();
  const save = useSaveHoliday();
  const existing = holiday === 'new' ? null : holiday;
  const { register, control, handleSubmit, formState, setError } = useForm<HolidayInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: { date: existing?.date ?? '', name: { en: existing?.name.en ?? '', ar: existing?.name.ar ?? '' }, recurring: existing?.recurring ?? false },
  });
  const onSubmit = (e: FormEvent<HTMLFormElement>) =>
    void handleSubmit((input) =>
      save.mutate(
        { id: existing?.id ?? null, input, reason: '' },
        {
          onSuccess: onSaved,
          onError: (error) => {
            if (isApiError(error) && error.fieldErrors) for (const [k, r] of Object.entries(error.fieldErrors)) setError(k as 'date', { type: 'server', message: r[0] });
          },
        },
      ),
    )(e);
  const err = (path: 'date' | 'name.en' | 'name.ar') => {
    const e = path === 'date' ? formState.errors.date : path === 'name.en' ? formState.errors.name?.en : formState.errors.name?.ar;
    return message(e?.message);
  };
  const general = save.isError && !(isApiError(save.error) && save.error.code === 'VALIDATION') ? tc(`apiErrors.${isApiError(save.error) ? save.error.code : 'SERVER'}`) : undefined;
  return (
    <FormDialog open title={existing ? t('calendar.editTitle') : t('calendar.addTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.save')} pending={save.isPending} error={general}>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <TextField {...register('date')} type="date" label={t('calendar.date')} required error={Boolean(err('date'))} helperText={err('date')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} />
        <TextField {...register('name.en')} label={t('calendar.nameEn')} required error={Boolean(err('name.en'))} helperText={err('name.en')} slotProps={{ htmlInput: { dir: 'ltr', lang: 'en' } }} />
        <TextField {...register('name.ar')} label={t('calendar.nameAr')} required error={Boolean(err('name.ar'))} helperText={err('name.ar')} slotProps={arabicInput} />
        <Controller control={control} name="recurring" render={({ field }) => <FormControlLabel control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={t('calendar.recurring')} />} />
      </Box>
    </FormDialog>
  );
}

function Holidays({ readOnly }: { readOnly: boolean }) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  // The current year, read once (rendering stays pure).
  const [thisYear] = useState(() => new Date().getFullYear());
  const [year, setYear] = useState(String(thisYear));
  const [status, setStatus] = useState<'' | Holiday['status']>('');
  const query = useHolidays({ page: 1, pageSize: 100, filters: { year: year || undefined, status: status || undefined } });
  const changeStatus = useHolidayStatus();
  const feedback = useFeedback();
  const [editing, setEditing] = useState<Holiday | 'new' | null>(null);
  const [toggling, setToggling] = useState<Holiday | null>(null);
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(String);

  let body;
  if (query.isPending) body = <Skeleton variant="rounded" height={160} />;
  else if (query.isError)
    body = (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {t('form.loadError')}
      </Alert>
    );
  else
    body = (
      <TableContainer sx={{ overflowX: 'auto', position: 'relative' }}>
        <Table size="small" aria-label={t('calendar.holidays')}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>{t('calendar.date')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('calendar.name')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('calendar.recurringShort')}</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('calendar.status')}</TableCell>
              {!readOnly && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {query.data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    {t('calendar.noHolidays')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {query.data.items.map((h) => (
              <TableRow key={h.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(`${h.date}T00:00`, language, { dateStyle: 'medium' })}</TableCell>
                <TableCell>{h.name[language]}</TableCell>
                <TableCell>{h.recurring ? t('calendar.recurringShort') : t('calendar.oneTime')}</TableCell>
                <TableCell>
                  <Chip size="small" label={t(`calendar.statuses.${h.status}`)} color={h.status === 'active' ? 'success' : 'default'} variant="outlined" />
                </TableCell>
                {!readOnly && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" onClick={() => setEditing(h)} aria-label={`${t('actions.edit')}: ${h.name[language]}`}>
                      {t('actions.edit')}
                    </Button>
                    <Button size="small" color={h.status === 'active' ? 'error' : 'primary'} onClick={() => setToggling(h)} aria-label={`${h.status === 'active' ? t('actions.deactivate') : t('actions.activate')}: ${h.name[language]}`}>
                      {h.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );

  return (
    <Panel
      title={t('calendar.holidays')}
      subtitle={t('calendar.holidaysHint')}
      actions={
        !readOnly && (
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setEditing('new')}>
            {t('actions.add')}
          </Button>
        )
      }
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <TextField select size="small" label={t('calendar.year')} value={year} onChange={(e) => setYear(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">{t('calendar.allYears')}</MenuItem>
          {years.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label={t('calendar.status')} value={status} onChange={(e) => setStatus(e.target.value as '' | Holiday['status'])} sx={{ minWidth: 150 }}>
          <MenuItem value="">{t('calendar.allStatuses')}</MenuItem>
          <MenuItem value="active">{t('calendar.statuses.active')}</MenuItem>
          <MenuItem value="inactive">{t('calendar.statuses.inactive')}</MenuItem>
        </TextField>
      </Box>
      {body}
      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        {t('calendar.attendanceNote')}
      </Alert>
      {editing && (
        <HolidayDialog
          holiday={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            feedback.notify(t('calendar.savedHoliday'));
          }}
        />
      )}
      <ReasonDialog
        open={toggling !== null}
        title={toggling?.status === 'active' ? t('calendar.deactivateTitle') : t('calendar.activateTitle')}
        text={toggling ? (toggling.status === 'active' ? t('calendar.deactivateBody', { name: toggling.name[language] }) : t('calendar.activateBody', { name: toggling.name[language] })) : ''}
        confirmLabel={toggling?.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
        danger={toggling?.status === 'active'}
        pending={changeStatus.isPending}
        error={changeStatus.isError ? tc(`apiErrors.${isApiError(changeStatus.error) ? changeStatus.error.code : 'SERVER'}`) : undefined}
        onConfirm={(reason) =>
          toggling &&
          changeStatus.mutate(
            { id: toggling.id, status: toggling.status === 'active' ? 'inactive' : 'active', reason },
            {
              onSuccess: () => {
                setToggling(null);
                feedback.notify(t('calendar.statusChanged'));
              },
            },
          )
        }
        onClose={() => {
          changeStatus.reset();
          setToggling(null);
        }}
      />
      <Feedback message={feedback.message} close={feedback.close} />
    </Panel>
  );
}

/** Working days & holidays: the organisation's working week and the public holiday calendar. */
export function CalendarSection({ readOnly }: { readOnly: boolean }) {
  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <WorkingWeek readOnly={readOnly} />
      <Holidays readOnly={readOnly} />
    </Box>
  );
}
