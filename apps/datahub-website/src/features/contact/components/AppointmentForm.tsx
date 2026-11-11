import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import NativeSelect from '@mui/material/NativeSelect';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Controller, useForm } from 'react-hook-form';
import { useLocalized } from '@/i18n/LocaleContext';
import { UI } from '@/i18n/ui';
import { submitAppointment } from '@/features/contact/services/appointment';
import { createAppointmentSchema, type AppointmentValues } from '@/features/contact/schemas/appointmentSchema';

/** Contact Form 7 field look on the original: grey filled box, 56px high, 5px radius. */
const Field = styled(InputBase)(({ theme }) => ({
  width: '100%',
  fontSize: 15,
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.brand.bgInput,
  border: `1px solid ${theme.palette.brand.bgInput}`,
  borderRadius: 5,
  transition: 'border-color .3s, background-color .3s',
  '& input, & select, & textarea': { padding: '3px 20px', boxSizing: 'border-box' },
  '& input, & select': { height: 54 },
  '& textarea': { padding: '12px 20px' },
  '& ::placeholder': { color: theme.palette.text.secondary, opacity: 1 },
  '&.Mui-focused': { borderColor: theme.palette.info.main, backgroundColor: theme.palette.common.white },
  '&.Mui-error': { borderColor: '#dc3232' },
}));

/** CF7 inline validation tip. */
const Tip = ({ id, children }: { id: string; children?: string }) =>
  children ? (
    <Typography id={id} role="alert" sx={{ mt: '5px', color: '#dc3232', fontSize: '1em', textAlign: 'left' }}>
      {children}
    </Typography>
  ) : null;

type Status = 'idle' | 'invalid' | 'not-configured' | 'sent' | 'failed';

interface AppointmentFormProps {
  /** Contact page variant adds a free-text message field. */
  withMessage?: boolean;
  messagePlaceholder?: string;
  /** Hide the "Book appointment / Let's collaborate." header (contact page). */
  showHeader?: boolean;
  /** Page-specific labels captured from the original form (contact page variant). */
  overrides?: {
    name?: string;
    email?: string;
    inquiry?: string;
    inquiryOptions?: string[];
    submit?: string;
  };
  /** The contact page's submit button sits at the start, the footer's is centred. */
  submitAlign?: 'center' | 'start';
}

/**
 * "Book appointment" form from the original footer. Validates on the client (React Hook Form + Zod)
 * and reports truthfully what happened to the submission.
 */
export function AppointmentForm({ withMessage = false, messagePlaceholder, showHeader = true, overrides, submitAlign = 'center' }: AppointmentFormProps) {
  const ui = useLocalized(UI);
  const labels = {
    name: overrides?.name ?? ui.appointment.name,
    email: overrides?.email ?? ui.appointment.email,
    inquiry: overrides?.inquiry ?? ui.appointment.inquiry,
    inquiryOptions: overrides?.inquiryOptions?.length ? overrides.inquiryOptions : ui.appointment.inquiryOptions,
    submit: overrides?.submit ?? ui.appointment.submit,
  };
  const uid = useId();
  const [status, setStatus] = useState<Status>('idle');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentValues>({
    resolver: zodResolver(createAppointmentSchema(ui.validation)),
    defaultValues: { name: '', email: '', inquiry: '', message: '', website: '' },
    mode: 'onTouched',
  });

  const onValid = async (values: AppointmentValues) => {
    try {
      const result = await submitAppointment(values);
      setStatus(result);
      if (result === 'sent') reset();
    } catch {
      setStatus('failed');
    }
  };

  const response = {
    idle: null,
    invalid: { text: ui.validation.summary, color: '#ffb900' },
    'not-configured': { text: ui.submission.notConfigured, color: '#ffb900' },
    sent: { text: ui.submission.success, color: '#46b450' },
    failed: { text: ui.submission.failure, color: '#dc3232' },
  }[status];

  const ids = { name: `${uid}-name`, email: `${uid}-email`, inquiry: `${uid}-inquiry`, message: `${uid}-message` };

  return (
    <Box component="form" noValidate onSubmit={handleSubmit(onValid, () => setStatus('invalid'))} sx={{ textAlign: 'center' }}>
      {showHeader && (
        <>
          <Typography component="h4" variant="h4" sx={{ lineHeight: 1.42 }}>
            {ui.appointment.title}
          </Typography>
          <Typography sx={{ mt: '10px', mb: '36px' }}>{ui.appointment.description}</Typography>
        </>
      )}

      <Stack spacing={4}>
        <Box>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Field
                {...field}
                placeholder={labels.name}
                error={Boolean(errors.name)}
                autoComplete="name"
                inputProps={{ 'aria-label': labels.name, 'aria-invalid': Boolean(errors.name), 'aria-describedby': errors.name ? `${ids.name}-tip` : undefined }}
              />
            )}
          />
          <Tip id={`${ids.name}-tip`}>{errors.name?.message}</Tip>
        </Box>

        <Box>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Field
                {...field}
                type="email"
                placeholder={labels.email}
                error={Boolean(errors.email)}
                autoComplete="email"
                inputProps={{ 'aria-label': labels.email, 'aria-invalid': Boolean(errors.email), 'aria-describedby': errors.email ? `${ids.email}-tip` : undefined }}
              />
            )}
          />
          <Tip id={`${ids.email}-tip`}>{errors.email?.message}</Tip>
        </Box>

        {/* Honeypot: hidden from people and assistive tech, bots fill it in. */}
        <Controller
          name="website"
          control={control}
          render={({ field }) => (
            <Box component="input" {...field} type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" sx={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
          )}
        />

        <Box>
          <Controller
            name="inquiry"
            control={control}
            render={({ field }) => (
              <NativeSelect
                {...field}
                input={<Field error={Boolean(errors.inquiry)} />}
                IconComponent={ArrowDropDownIcon}
                inputProps={{ 'aria-label': labels.inquiry, 'aria-invalid': Boolean(errors.inquiry), 'aria-describedby': errors.inquiry ? `${ids.inquiry}-tip` : undefined }}
                sx={{ '& .MuiNativeSelect-icon': { right: 14, color: 'text.secondary' }, '& select': { pr: '44px !important' } }}
              >
                <option value="">{labels.inquiry}</option>
                {labels.inquiryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
          <Tip id={`${ids.inquiry}-tip`}>{errors.inquiry?.message}</Tip>
        </Box>

        {withMessage && (
          <Controller
            name="message"
            control={control}
            render={({ field }) => (
              <Field {...field} multiline minRows={5} placeholder={messagePlaceholder} inputProps={{ 'aria-label': messagePlaceholder }} />
            )}
          />
        )}
      </Stack>

      <Box sx={{ textAlign: submitAlign === 'start' ? 'left' : 'center' }}>
      <Button
        type="submit"
        disabled={isSubmitting}
        sx={{
          mt: submitAlign === 'start' ? '30px' : '27px',
          width: submitAlign === 'start' ? 'auto' : 220,
          px: submitAlign === 'start' ? '41px' : undefined,
          maxWidth: '100%',
          height: 56,
          fontWeight: 600,
          color: 'common.white',
          bgcolor: 'primary.main',
          border: 1,
          borderColor: 'primary.main',
          '&:hover': { bgcolor: 'primary.dark', borderColor: 'primary.dark' },
          '&.Mui-disabled': { color: 'common.white', opacity: 0.7 },
        }}
      >
        {isSubmitting ? ui.appointment.sending : labels.submit}
      </Button>
      </Box>

      {response && (
        <Typography role="status" sx={{ mt: '20px', p: '0.2em 1em', border: `2px solid ${response.color}`, fontSize: 14, textAlign: 'left' }}>
          {response.text}
        </Typography>
      )}
    </Box>
  );
}
