import { useMemo } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { LoginRequest } from '@/modules/auth/api/authApi';
import { createLoginSchema, type LoginValues } from '@/modules/auth/schemas/loginSchema';

/** Email + password form. The password is only passed to the (mock) login call — never kept or stored. */
export function LoginForm({ onSubmit, pending }: { onSubmit: (request: LoginRequest) => void; pending: boolean }) {
  const { t } = useTranslation('auth');
  const schema = useMemo(() => createLoginSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  return (
    <Stack component="form" noValidate spacing={2} onSubmit={handleSubmit(onSubmit)}>
      <TextField
        {...register('email')}
        label={t('login.email')}
        type="email"
        autoComplete="username"
        fullWidth
        error={!!errors.email}
        helperText={errors.email?.message}
        slotProps={{ htmlInput: { dir: 'ltr' } }}
      />
      <TextField
        {...register('password')}
        label={t('login.password')}
        type="password"
        autoComplete="current-password"
        fullWidth
        error={!!errors.password}
        helperText={errors.password?.message}
      />
      <Button type="submit" variant="contained" size="large" disabled={pending}>
        {pending ? t('login.submitting') : t('login.submit')}
      </Button>
    </Stack>
  );
}
