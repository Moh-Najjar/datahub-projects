import { useState, type FormEvent, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { useLanguage } from '@/i18n/useLanguage';
import { formatDate } from '@/i18n/format';
import { Feedback } from '@/modules/shared/Feedback';
import { useFeedback } from '@/modules/shared/hooks/useFeedback';
import { Panel } from '@/modules/shared/Panel';
import { useResetSettings, useSettingsSection, useUpdateSettings } from '@/modules/settings/hooks/useSettings';
import { SECTION_SCHEMAS } from '@/modules/settings/schemas/settingsSchemas';
import type { SettingsSection, SettingsValues } from '@/modules/settings/types/settings';
import { ReasonDialog } from '@/modules/shared/ReasonDialog';

interface Props<S extends SettingsSection> {
  section: S;
  title: string;
  subtitle?: string;
  /** Read-only for this role (fields disabled, no actions). */
  readOnly?: boolean;
  /** A reason is required to save (sign-in & session). */
  reasonRequired?: boolean;
  children: (form: UseFormReturn<SettingsValues[S] & FieldValues>, disabled: boolean) => ReactNode;
}

/**
 * One editable settings section: loads the stored values, validates with the shared Zod schema (the API validates
 * again), confirms the save with a reason for the audit log, discards unsaved changes, restores the demo defaults.
 */
export function SectionEditor<S extends SettingsSection>({ section, title, subtitle, readOnly = false, reasonRequired = false, children }: Props<S>) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation();
  const { language } = useLanguage();
  const query = useSettingsSection(section);
  const update = useUpdateSettings(section);
  const reset = useResetSettings(section);
  const feedback = useFeedback();
  const [pendingValues, setPendingValues] = useState<SettingsValues[S] | null>(null);
  const [resetting, setResetting] = useState(false);
  type V = SettingsValues[S] & FieldValues;
  const form = useForm<V>({
    resolver: zodResolver(SECTION_SCHEMAS[section] as never) as never,
    // Follows the stored values (after a save or a reset); unsaved edits are kept while they are dirty.
    values: query.data?.values as V | undefined,
    resetOptions: { keepDirtyValues: false },
  });

  const apiError = (error: unknown) => (isApiError(error) ? tc(`apiErrors.${error.code}`) : tc('apiErrors.SERVER'));
  const save = (reason: string) => {
    if (!pendingValues) return;
    update.mutate(
      { values: pendingValues, reason },
      {
        onSuccess: () => {
          setPendingValues(null);
          feedback.notify(t('form.saved'));
        },
        onError: (error) => {
          if (isApiError(error) && error.code === 'VALIDATION' && error.fieldErrors) {
            const fieldEntries = Object.entries(error.fieldErrors).filter(([key]) => key !== 'reason');
            if (fieldEntries.length) {
              setPendingValues(null);
              for (const [key, reasons] of fieldEntries) form.setError(key as Path<V>, { type: 'server', message: reasons[0] });
            }
          }
        },
      },
    );
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => void form.handleSubmit((v) => setPendingValues(v as SettingsValues[S]))(e);
  const disabled = readOnly || update.isPending;
  const meta = query.data?.meta;

  let body: ReactNode;
  if (query.isPending) body = <Skeleton variant="rounded" height={220} />;
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
      <Box component="form" noValidate onSubmit={onSubmit} sx={{ display: 'grid', gap: 2.5, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {meta?.updatedAt && meta.updatedBy ? t('form.lastUpdated', { time: formatDate(meta.updatedAt, language, { dateStyle: 'medium', timeStyle: 'short' }), name: meta.updatedBy[language] }) : t('form.neverChanged')}
        </Typography>
        {children(form, disabled)}
        {!readOnly && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Button type="submit" variant="contained" disabled={update.isPending || !form.formState.isDirty}>
              {t('actions.save')}
            </Button>
            <Button onClick={() => form.reset(query.data?.values as V)} disabled={!form.formState.isDirty || update.isPending}>
              {t('actions.cancel')}
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<RestartAltOutlined />} color="inherit" onClick={() => setResetting(true)} disabled={update.isPending}>
              {t('actions.resetDefaults')}
            </Button>
            {form.formState.isDirty && (
              <Typography variant="body2" color="warning.main" role="status" sx={{ flexBasis: '100%' }}>
                {t('form.unsaved')}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );

  return (
    <Panel title={title} subtitle={subtitle}>
      {body}
      <ReasonDialog
        open={pendingValues !== null}
        title={t('form.confirmTitle')}
        text={t('form.confirmBody')}
        confirmLabel={t('actions.save')}
        reasonRequired={reasonRequired}
        pending={update.isPending}
        error={update.isError ? apiError(update.error) : undefined}
        onConfirm={save}
        onClose={() => {
          update.reset();
          setPendingValues(null);
        }}
      />
      <ReasonDialog
        open={resetting}
        title={t('form.resetTitle')}
        text={t('form.resetBody')}
        confirmLabel={t('actions.resetDefaults')}
        reasonRequired={reasonRequired}
        pending={reset.isPending}
        error={reset.isError ? apiError(reset.error) : undefined}
        onConfirm={(reason) =>
          reset.mutate(reason, {
            onSuccess: () => {
              setResetting(false);
              feedback.notify(t('form.resetDone'));
            },
          })
        }
        onClose={() => {
          reset.reset();
          setResetting(false);
        }}
      />
      <Feedback message={feedback.message} close={feedback.close} />
    </Panel>
  );
}
