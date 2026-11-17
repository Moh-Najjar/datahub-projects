import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AttachFileOutlined from '@mui/icons-material/AttachFileOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/context/authContext';
import { formatNumber } from '@/i18n/format';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useCreateLeaveRequest, useLeaveQuote, useLeaveTypes, useUpdateLeaveRequest } from '@/modules/leave/hooks/useLeave';
import { leaveRequestFormSchema, type LeaveRequestFormValues } from '@/modules/leave/schemas/leaveSchemas';
import type { LeaveRequest, LeaveRequestInput } from '@/modules/leave/types/leave';
import { isDate } from '@/modules/leave/utils/rules';
import { formatDay, formatDays, todayIso } from '@/modules/leave/utils/format';
import { errorText, fieldErrorText } from '@/modules/leave/utils/serverErrors';

const FIELDS = ['employeeId', 'leaveTypeId', 'startDate', 'endDate', 'reason', 'document'] as const;
const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/**
 * New request / edit a draft or a pending request. Requests are always for the signed-in employee: the permission
 * matrix has no "request on behalf" permission, so the employee field is fixed. Days and the balance summary come
 * from the API (the employee's own working days, holidays per leave type); the API re-checks every rule on save.
 */
export function RequestFormDialog({ request, onClose, onDone }: { request?: LeaveRequest; onClose: () => void; onDone: (r: LeaveRequest, submitted: boolean) => void }) {
  const { t } = useTranslation('leave');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const create = useCreateLeaveRequest();
  const update = useUpdateLeaveRequest();
  const mutation = request ? update : create;
  const types = useLeaveTypes({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc', filters: { status: 'active' } });
  const [formError, setFormError] = useState<string>();
  const [today] = useState(() => todayIso());
  const { register, control, handleSubmit, formState, setError, setValue } = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestFormSchema),
    defaultValues: request
      ? { employeeId: request.employeeId, leaveTypeId: request.leaveType.id, startDate: request.startDate, endDate: request.endDate, reason: request.reason ?? '', document: request.document }
      : { employeeId: '', leaveTypeId: '', startDate: today, endDate: today, reason: '', document: null },
  });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const [leaveTypeId, startDate, endDate, document] = useWatch({ control, name: ['leaveTypeId', 'startDate', 'endDate', 'document'] });
  const typeOptions = useMemo(() => {
    const list = types.data?.items ?? [];
    // An edited request keeps its type selectable even if it was deactivated since (the API decides).
    return request && !list.some((x) => x.id === request.leaveType.id) ? [{ id: request.leaveType.id, name: request.leaveType.name, requiresDocument: false, annualAllocation: null, maxConsecutiveDays: null, paid: request.leaveType.paid, requiresApproval: true, excludesPublicHolidays: false }, ...list] : list;
  }, [types.data, request]);
  const type = typeOptions.find((x) => x.id === leaveTypeId);
  const quoteReady = Boolean(leaveTypeId) && isDate(startDate) && isDate(endDate) && endDate >= startDate && startDate.slice(0, 4) === endDate.slice(0, 4);
  const quoteInput: LeaveRequestInput = { leaveTypeId, startDate, endDate, reason: '', document: null, submit: false };
  const quote = useLeaveQuote(quoteInput, quoteReady, request?.id);
  const canDraft = !request || request.status === 'draft';

  const save = (submit: boolean) =>
    handleSubmit((v) => {
    setFormError(undefined);
    const input: LeaveRequestInput = { leaveTypeId: v.leaveTypeId, startDate: v.startDate, endDate: v.endDate, reason: v.reason, document: v.document, submit };
    const callbacks = {
      onSuccess: (r: LeaveRequest) => onDone(r, submit),
      onError: (error: unknown) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (request) update.mutate({ id: request.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  const n = (v: number) => formatNumber(v, language, { maximumFractionDigits: 1 });
  const q = quote.data;
  const b = q?.balance;

  return (
    <FormDialog
      open
      maxWidth="md"
      title={request ? t('form.editTitle', { number: request.number }) : t('form.newTitle')}
      onClose={onClose}
      onSubmit={(e) => void save(true)(e)}
      submitLabel={request?.status === 'pending' ? t('actions.save') : t('actions.submit')}
      secondaryAction={
        canDraft
          ? {
              label: t('actions.saveDraft'),
              onClick: () => void save(false)(),
            }
          : undefined
      }
      pending={mutation.isPending}
      error={formError}
    >
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 280px)' } }}>
        <Stack spacing={2.5}>
          <TextField
            label={t('fields.employee')}
            value={user?.name[language] ?? ''}
            slotProps={{ input: { readOnly: true } }}
            error={Boolean(formState.errors.employeeId)}
            helperText={translate(formState.errors.employeeId?.message) ?? t('form.selfOnly')}
          />
          <Controller
            control={control}
            name="leaveTypeId"
            render={({ field, fieldState }) => (
              <TextField select required label={t('fields.leaveType')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} error={Boolean(fieldState.error)} helperText={translate(fieldState.error?.message)}>
                {typeOptions.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name[language]}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label={t('fields.startDate')} type="date" required {...textFieldProps(register, formState, 'startDate', translate)} slotProps={dateSlot} />
            <TextField label={t('fields.endDate')} type="date" required {...textFieldProps(register, formState, 'endDate', translate)} slotProps={dateSlot} />
          </Box>
          <TextField label={t('fields.reason')} multiline minRows={2} {...textFieldProps(register, formState, 'reason', translate, t('form.reasonHint'))} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
              {t('fields.document')}
              {type?.requiresDocument ? ' *' : ''}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Button component="label" variant="outlined" size="small" startIcon={<AttachFileOutlined />}>
                {t('form.attach')}
                <input
                  type="file"
                  hidden
                  aria-label={t('fields.document')}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    // SIMULATED: only the file name and size are kept; the file itself is never read or uploaded.
                    if (file) setValue('document', { fileName: file.name, sizeBytes: Math.max(1, file.size) }, { shouldValidate: formState.isSubmitted });
                    e.target.value = '';
                  }}
                />
              </Button>
              {document && <Chip size="small" label={document.fileName} onDelete={() => setValue('document', null)} dir="ltr" />}
            </Box>
            <Typography variant="caption" color={formState.errors.document ? 'error' : 'text.secondary'} role={formState.errors.document ? 'alert' : undefined} sx={{ display: 'block', mt: 0.5 }}>
              {translate(formState.errors.document?.message as string | undefined) ?? (type?.requiresDocument ? t('form.documentRequired') : t('form.documentSimulated'))}
            </Typography>
          </Box>
        </Stack>

        <Box component="aside" aria-label={t('form.summary')} aria-live="polite" sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', alignSelf: 'start' }}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
            {t('form.summary')}
          </Typography>
          {!quoteReady ? (
            <Typography variant="body2" color="text.secondary">
              {t('form.summaryHint')}
            </Typography>
          ) : quote.isError ? (
            <Typography variant="body2" color="error">
              {errorText(t, tCommon, quote.error)}
            </Typography>
          ) : !q ? (
            <Typography variant="body2" color="text.secondary">
              {tCommon('shell.loading')}
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ opacity: quote.isFetching ? 0.6 : 1 }}>
              <Row label={t('form.daysRequested')} value={formatDays(t, q.days, language)} strong />
              {q.excludedHolidays.length > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('form.holidaysExcluded', { list: q.excludedHolidays.map((h) => `${h.name[language]} (${formatDay(h.date, language)})`).join(', ') })}
                </Typography>
              )}
              {b && (
                <>
                  <Row label={t('fields.allocated')} value={b.allocated === null ? t('balances.noLimit') : n(b.allocated)} />
                  <Row label={t('fields.used')} value={n(b.used)} />
                  <Row label={t('fields.pending')} value={n(b.pending)} />
                  <Row label={t('fields.remaining')} value={b.remaining === null ? t('balances.noLimit') : n(b.remaining)} />
                  <Row label={t('form.remainingAfter')} value={q.remainingAfter === null ? t('balances.noLimit') : n(q.remainingAfter)} strong />
                </>
              )}
              {q.remainingAfter !== null && q.remainingAfter < 0 && <Alert severity="warning">{t('form.notEnough')}</Alert>}
              {type && (
                <Typography variant="caption" color="text.secondary">
                  {[type.paid ? t('types.paid') : t('types.unpaid'), type.requiresApproval ? t('types.needsApproval') : t('types.autoApproved'), type.maxConsecutiveDays ? t('types.maxDays', { days: formatDays(t, type.maxConsecutiveDays, language) }) : null].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </FormDialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 600 : 400 }}>
        {value}
      </Typography>
    </Box>
  );
}
