import { useState } from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useDepartmentOptions } from '@/modules/organization/hooks/useDepartmentOptions';
import { useCreatePosition, useUpdatePosition } from '@/modules/organization/hooks/useOrganization';
import { positionFormSchema, toPositionInput, type PositionFormValues } from '@/modules/organization/schemas/organizationSchemas';
import { EMPLOYMENT_LEVELS, type Position } from '@/modules/organization/types/organization';
import { applyServerErrors, errorText, fieldErrorText } from '@/modules/organization/utils/serverErrors';
import { FormDialog } from '@/modules/shared/FormDialog';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';

const FIELDS = ['code', 'titleEn', 'titleAr', 'departmentId', 'level', 'description'] as const;

/** Create / edit a position. Mount it only while open. */
export function PositionFormDialog({ position, onClose, onSaved }: { position?: Position; onClose: () => void; onSaved: (created: boolean) => void }) {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const [formError, setFormError] = useState<string>();
  const { options } = useDepartmentOptions({ keep: position?.department.id ?? null });

  const { register, control, handleSubmit, formState, setError } = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: {
      code: position?.code ?? '',
      titleEn: position?.title.en ?? '',
      titleAr: position?.title.ar ?? '',
      departmentId: position?.department.id ?? '',
      // '' until chosen: the schema reports "required".
      level: position?.level ?? ('' as PositionFormValues['level']),
      description: position?.description ?? '',
    },
  });
  const field = (name: (typeof FIELDS)[number], helper?: string) => textFieldProps(register, formState, name, (reason) => fieldErrorText(t, reason), helper);

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    const input = toPositionInput(positionFormSchema.parse(values));
    const handlers = {
      onSuccess: () => onSaved(!position),
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (position) update.mutate({ id: position.id, input }, handlers);
    else create.mutate(input, handlers);
  });

  return (
    <FormDialog
      open
      title={position ? t('forms.editPositionTitle') : t('forms.createPositionTitle')}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={position ? t('actions.save') : t('actions.create')}
      pending={create.isPending || update.isPending}
      error={formError}
    >
      <TextField label={t('fields.code')} required autoFocus {...field('code', t('forms.codeHint'))} slotProps={latinInput} />
      <TextField label={t('fields.titleEn')} required {...field('titleEn')} slotProps={latinInput} />
      <TextField label={t('fields.titleAr')} required {...field('titleAr')} slotProps={arabicInput} />
      <Controller
        control={control}
        name="departmentId"
        render={({ field: department, fieldState }) => (
          <TextField
            select
            required
            label={t('fields.department')}
            value={department.value}
            onChange={department.onChange}
            onBlur={department.onBlur}
            inputRef={department.ref}
            error={Boolean(fieldState.error)}
            helperText={fieldErrorText(t, fieldState.error?.message)}
          >
            <MenuItem value="" disabled>
              {t('forms.selectDepartment')}
            </MenuItem>
            {options.map((o) => (
              <MenuItem key={o.value} value={o.value} disabled={o.disabled} sx={{ pl: 2 + o.depth * 2 }}>
                {o.active ? o.label : t('forms.inactiveOption', { name: o.label })}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        control={control}
        name="level"
        render={({ field: level, fieldState }) => (
          <TextField
            select
            required
            label={t('fields.level')}
            value={level.value}
            onChange={level.onChange}
            onBlur={level.onBlur}
            inputRef={level.ref}
            error={Boolean(fieldState.error)}
            helperText={fieldErrorText(t, fieldState.error?.message)}
          >
            <MenuItem value="" disabled>
              {t('forms.selectLevel')}
            </MenuItem>
            {EMPLOYMENT_LEVELS.map((l) => (
              <MenuItem key={l} value={l}>
                {t(`levels.${l}`)}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <TextField label={t('fields.description')} multiline minRows={3} {...field('description')} />
    </FormDialog>
  );
}
