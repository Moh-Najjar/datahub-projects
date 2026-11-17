import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useUpdateDepartment } from '@/modules/organization/hooks/useOrganization';
import type { Department } from '@/modules/organization/types/organization';
import { applyServerErrors, errorText } from '@/modules/organization/utils/serverErrors';
import { FormDialog } from '@/modules/shared/FormDialog';
import { ManagerField } from '@/modules/organization/components/common/ManagerField';

/** Assign or change (or clear) a department's manager; the rest of the department is saved unchanged. */
export function AssignManagerDialog({ department, onClose, onSaved }: { department: Department; onClose: () => void; onSaved: (department: Department) => void }) {
  const { t } = useTranslation('organization');
  const { t: tCommon } = useTranslation();
  const update = useUpdateDepartment();
  const [formError, setFormError] = useState<string>();
  const { control, handleSubmit, setError } = useForm<{ managerId: string }>({ defaultValues: { managerId: department.manager?.id ?? '' } });

  const onSubmit = handleSubmit(({ managerId }) => {
    setFormError(undefined);
    update.mutate(
      {
        id: department.id,
        input: { code: department.code, name: department.name, description: department.description, parentId: department.parent?.id ?? null, managerId: managerId || null },
      },
      {
        onSuccess: onSaved,
        onError: (error) => {
          if (!applyServerErrors(error, ['managerId'], setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });

  return (
    <FormDialog open title={t('forms.assignManagerTitle')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.save')} pending={update.isPending} error={formError}>
      <ManagerField control={control} name="managerId" current={department.manager} />
    </FormDialog>
  );
}
