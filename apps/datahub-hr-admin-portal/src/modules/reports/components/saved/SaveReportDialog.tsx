import { useEffect, type FormEvent } from 'react';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { isApiError } from '@/core/api/types';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useSaveReport } from '@/modules/reports/hooks/useReports';
import { SAVED_NAME_MAX as NAME_MAX, type SavedReport, type SavedReportInput } from '@/modules/reports/types/reports';

const schema = z.object({ name: z.string().trim().min(1, 'required').max(NAME_MAX, 'tooLong') });
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The configuration to save (report + filters, or builder settings). */
  input: Omit<SavedReportInput, 'name'>;
  /** Rename / update this saved report instead of creating one. */
  existing: SavedReport | null;
  /** Rename only (the saved list): keep the existing configuration. */
  renameOnly?: boolean;
  defaultName: string;
  onDone: (saved: SavedReport, created: boolean) => void;
}

/** Save a report configuration (never its results), or update / rename one the user saved before. */
export function SaveReportDialog({ open, onClose, input, existing, renameOnly = false, defaultName, onDone }: Props) {
  const { t } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const save = useSaveReport();
  const { register, handleSubmit, formState, reset, setError } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: existing?.name ?? defaultName } });
  useEffect(() => {
    if (open) reset({ name: existing?.name ?? defaultName });
  }, [open, existing, defaultName, reset]);

  const submit = (values: Values, asNew: boolean) => {
    const id = asNew ? null : (existing?.id ?? null);
    const payload: SavedReportInput = renameOnly && existing ? { name: values.name, kind: existing.kind, reportId: existing.reportId, filters: existing.filters, builder: existing.builder } : { ...input, name: values.name };
    save.mutate(
      { id, input: payload },
      {
        onSuccess: (saved) => onDone(saved, id === null),
        onError: (error) => applyServerErrors(error, ['name'], setError),
      },
    );
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => void handleSubmit((v) => submit(v, false))(e);
  const translate = (reason: string | undefined) => (reason ? (t(`validation.${reason}` as never, { defaultValue: reason }) as string) : undefined);
  const general = save.isError && !(isApiError(save.error) && save.error.code === 'VALIDATION' && save.error.fieldErrors?.name) ? (isApiError(save.error) ? tc(`apiErrors.${save.error.code}`) : tc('apiErrors.SERVER')) : undefined;

  return (
    <FormDialog
      open={open}
      title={renameOnly ? t('saved.renameTitle') : t('saved.saveTitle')}
      onClose={() => {
        save.reset();
        onClose();
      }}
      onSubmit={onSubmit}
      submitLabel={existing ? t('actions.update') : t('actions.save')}
      pending={save.isPending}
      error={general}
      secondaryAction={existing && !renameOnly ? { label: t('actions.saveAsNew'), onClick: () => void handleSubmit((v) => submit(v, true))() } : undefined}
    >
      {!renameOnly && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('saved.saveHint')}
        </Typography>
      )}
      <TextField {...textFieldProps(register, formState, 'name', translate)} label={t('saved.name')} required fullWidth autoFocus slotProps={{ htmlInput: { maxLength: NAME_MAX } }} />
    </FormDialog>
  );
}
