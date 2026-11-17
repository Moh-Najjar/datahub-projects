import { useState } from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useDepartmentOptions } from '@/modules/organization/hooks/useDepartmentOptions';
import { useCreateDepartment, useUpdateDepartment } from '@/modules/organization/hooks/useOrganization';
import { departmentFormSchema, toDepartmentInput, type DepartmentFormValues } from '@/modules/organization/schemas/organizationSchemas';
import type { Department } from '@/modules/organization/types/organization';
import { applyServerErrors, errorText, fieldErrorText } from '@/modules/organization/utils/serverErrors';
import { FormDialog } from '@/modules/shared/FormDialog';
import { ManagerField } from '@/modules/organization/components/common/ManagerField';
import { arabicInput, latinInput, textFieldProps } from '@/modules/shared/formFields';

const FIELDS = ['code', 'nameEn', 'nameAr', 'description', 'parentId', 'managerId'] as const;

interface DepartmentFormDialogProps {
  /** Edit this department; create a new one when omitted. */
  department?: Department;
  /** Pre-selected parent when creating a subdepartment. */
  defaultParentId?: string;
  onClose: () => void;
  onSaved: (department: Department, created: boolean) => void;
}

/** Create / edit a department. Mount it only while open, so each opening starts from fresh values. */
export function DepartmentFormDialog({ department, defaultParentId, onClose, onSaved }: DepartmentFormDialogProps) {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const [formError, setFormError] = useState<string>();
  const { options } = useDepartmentOptions({ excludeTreeOf: department?.id, keep: department?.parent?.id ?? null });

  const { register, control, handleSubmit, formState, setError } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      code: department?.code ?? '',
      nameEn: department?.name.en ?? '',
      nameAr: department?.name.ar ?? '',
      description: department?.description ?? '',
      parentId: department?.parent?.id ?? defaultParentId ?? '',
      managerId: department?.manager?.id ?? '',
    },
  });
  const field = (name: (typeof FIELDS)[number], helper?: string) => textFieldProps(register, formState, name, (reason) => fieldErrorText(t, reason), helper);
  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    const input = toDepartmentInput(departmentFormSchema.parse(values));
    const handlers = {
      onSuccess: (saved: Department) => onSaved(saved, !department),
      onError: (error: Error) => {
        if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
      },
    };
    if (department) update.mutate({ id: department.id, input }, handlers);
    else create.mutate(input, handlers);
  });

  return (
    <FormDialog
      open
      title={department ? t('forms.editDepartmentTitle') : t('forms.createDepartmentTitle')}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={department ? t('actions.save') : t('actions.create')}
      pending={pending}
      error={formError}
    >
      <TextField label={t('fields.code')} required autoFocus {...field('code', t('forms.codeHint'))} slotProps={latinInput} />
      <TextField label={t('fields.nameEn')} required {...field('nameEn')} slotProps={latinInput} />
      <TextField label={t('fields.nameAr')} required {...field('nameAr')} slotProps={arabicInput} />
      <Controller
        control={control}
        name="parentId"
        render={({ field: parent, fieldState }) => (
          <TextField
            select
            label={t('fields.parent')}
            value={parent.value}
            onChange={parent.onChange}
            onBlur={parent.onBlur}
            inputRef={parent.ref}
            error={Boolean(fieldState.error)}
            helperText={fieldErrorText(t, fieldState.error?.message) ?? t('forms.parentHint')}
          >
            <MenuItem value="">{t('forms.noParent')}</MenuItem>
            {options.map((o) => (
              <MenuItem key={o.value} value={o.value} disabled={o.disabled} sx={{ pl: 2 + o.depth * 2 }}>
                {o.active ? o.label : t('forms.inactiveOption', { name: o.label })}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <ManagerField control={control} name="managerId" current={department?.manager} />
      <TextField label={t('fields.description')} multiline minRows={3} {...field('description')} />
    </FormDialog>
  );
}
