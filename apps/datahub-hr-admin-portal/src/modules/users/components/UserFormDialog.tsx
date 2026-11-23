import { useState, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { isApiError } from '@/core/api/types';
import { ROLES, type Role } from '@/core/config/permissions';
import { arabicInput, latinInput } from '@/modules/shared/formFields';
import { FormDialog } from '@/modules/shared/FormDialog';
import { useCreateUser, useUpdateUser } from '@/modules/users/hooks/useUsers';
import type { EmployeeChoice } from '@/modules/users/hooks/useEmployeeSearch';
import type { UserDetails } from '@/modules/users/types/users';
import { EmployeePicker } from './EmployeePicker';

const schema = z.object({
  nameEn: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  nameAr: z.string().trim().min(1, 'required').max(80, 'tooLong').regex(/[؀-ۿ]/, 'arabicRequired'),
  email: z.string().trim().max(160, 'tooLong').regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'invalidEmail'),
  role: z.enum(ROLES),
});
type Values = z.infer<typeof schema>;

/** Create an account (role, optional employee link) or edit an account's name and e-mail. */
export function UserFormDialog({ user, onClose, onDone }: { user: UserDetails | null; onClose: () => void; onDone: (u: UserDetails) => void }) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation();
  const create = useCreateUser();
  const update = useUpdateUser(user?.id ?? '');
  const mutation = user ? update : create;
  const [employee, setEmployee] = useState<EmployeeChoice | null>(null);
  const [employeeError, setEmployeeError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { nameEn: user?.name.en ?? '', nameAr: user?.name.ar ?? '', email: user?.email ?? '', role: user?.role ?? 'employee' },
  });
  const text = (reason: string | undefined) => (reason ? (t(`validation.${reason}` as never, { defaultValue: t('validation.invalid') }) as string) : undefined);
  const onError = (error: unknown) => {
    if (!isApiError(error) || !error.fieldErrors) return;
    const map: Record<string, keyof Values> = { 'name.en': 'nameEn', 'name.ar': 'nameAr', email: 'email', role: 'role' };
    for (const [k, r] of Object.entries(error.fieldErrors)) {
      if (k === 'employeeId') setEmployeeError(text(r[0]));
      else if (map[k]) setError(map[k], { type: 'server', message: r[0] });
    }
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) =>
    void handleSubmit((v) => {
      setEmployeeError(undefined);
      const identity = { name: { en: v.nameEn, ar: v.nameAr }, email: v.email };
      if (user) update.mutate({ input: identity, reason: '' }, { onSuccess: onDone, onError });
      else create.mutate({ input: { ...identity, role: v.role as Role, employeeId: employee?.id ?? null }, reason: '' }, { onSuccess: onDone, onError });
    })(e);
  const general = mutation.isError && !(isApiError(mutation.error) && mutation.error.code === 'VALIDATION') ? tc(`apiErrors.${isApiError(mutation.error) ? mutation.error.code : 'SERVER'}`) : undefined;
  const err = (k: keyof Values) => text(formState.errors[k]?.message);

  return (
    <FormDialog open title={user ? t('form.editTitle') : t('form.createTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={user ? t('form.save') : t('form.create')} pending={mutation.isPending} error={general}>
      <Box sx={{ display: 'grid', gap: 2 }}>
        <TextField {...register('nameEn')} label={t('form.nameEn')} required error={Boolean(err('nameEn'))} helperText={err('nameEn')} slotProps={latinInput} />
        <TextField {...register('nameAr')} label={t('form.nameAr')} required error={Boolean(err('nameAr'))} helperText={err('nameAr')} slotProps={arabicInput} />
        <TextField {...register('email')} type="email" label={t('form.email')} required error={Boolean(err('email'))} helperText={err('email')} slotProps={latinInput} />
        {!user && (
          <>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <TextField select {...field} label={t('form.role')} required>
                  {ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {tc(`roles.${r}`)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <EmployeePicker value={employee} onChange={setEmployee} error={employeeError} />
          </>
        )}
        <Alert severity="info" variant="outlined">
          {t('form.signInNote')}
        </Alert>
      </Box>
    </FormDialog>
  );
}
