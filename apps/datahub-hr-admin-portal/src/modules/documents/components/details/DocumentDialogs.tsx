import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/i18n/useLanguage';
import { FormDialog } from '@/modules/shared/FormDialog';
import { textFieldProps } from '@/modules/shared/formFields';
import { applyServerErrors } from '@/modules/shared/utils/serverErrors';
import { useAllCategories, useUpdateDocument } from '@/modules/documents/hooks/useDocuments';
import { categoryProblems, documentFormSchema, reasonFormSchema, toDocumentUpdate, type DocumentFormValues, type ReasonFormValues } from '@/modules/documents/schemas/documentSchemas';
import { CONFIDENTIALITY_LEVELS, type Document } from '@/modules/documents/types/documents';
import { todayIso } from '@/modules/documents/utils/rules';
import { errorText, fieldErrorText } from '@/modules/documents/utils/serverErrors';

const FIELDS = ['categoryId', 'name', 'documentNumber', 'issueDate', 'expiryDate', 'issuingAuthority', 'description', 'confidentiality'] as const;
const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;

/** Edit metadata (files and owner never change here: a new file is a replacement). */
export function EditDocumentDialog({ document: doc, onClose, onDone }: { document: Document; onClose: () => void; onDone: (d: Document) => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const mutation = useUpdateDocument();
  const categories = useAllCategories();
  const [formError, setFormError] = useState<string>();
  const { register, control, handleSubmit, formState, setError } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      ownerId: doc.owner.id,
      categoryId: doc.category.id,
      name: doc.name,
      documentNumber: doc.documentNumber ?? '',
      issueDate: doc.issueDate ?? '',
      expiryDate: doc.expiryDate ?? '',
      issuingAuthority: doc.issuingAuthority,
      description: doc.description,
      confidentiality: doc.confidentiality,
    },
  });
  const [categoryId, confidentiality] = useWatch({ control, name: ['categoryId', 'confidentiality'] });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<DocumentFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const items = (categories.data?.items ?? []).filter((c) => c.appliesTo.includes(doc.owner.type) && (c.status === 'active' || c.id === doc.category.id));
  const category = items.find((c) => c.id === categoryId);
  const onSubmit = handleSubmit((v) => {
    setFormError(undefined);
    if (category) {
      const problems = categoryProblems({ issueDate: v.issueDate || null, expiryDate: v.expiryDate || null, documentNumber: v.documentNumber }, category, todayIso());
      if (problems) {
        for (const [field, reasons] of Object.entries(problems)) setError(field as Path<DocumentFormValues>, { type: 'validate', message: reasons[0] });
        return;
      }
    }
    mutation.mutate(
      { id: doc.id, input: toDocumentUpdate(documentFormSchema.parse(v)) },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (!applyServerErrors(error, FIELDS, setError)) setFormError(errorText(t, tCommon, error));
        },
      },
    );
  });
  return (
    <FormDialog open maxWidth="md" title={t('edit.title')} onClose={onClose} onSubmit={onSubmit} submitLabel={t('actions.save')} pending={mutation.isPending} error={formError}>
      {doc.verificationStatus === 'verified' && <Alert severity="info">{t('edit.reviewHint')}</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
        <TextField select required label={t('fields.category')} {...text('categoryId')} value={categoryId}>
          {items.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name[language]}
            </MenuItem>
          ))}
        </TextField>
        <TextField label={t('fields.name')} required {...text('name')} />
        <TextField label={t('fields.documentNumber')} required={category?.requiresNumber} {...text('documentNumber')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
        <TextField label={t('fields.issuingAuthority')} {...text('issuingAuthority')} />
        <TextField label={t('fields.issueDate')} type="date" {...text('issueDate')} slotProps={dateSlot} />
        <TextField label={t('fields.expiryDate')} type="date" required={category?.tracksExpiry} {...text('expiryDate')} slotProps={dateSlot} />
        <TextField select label={t('fields.confidentiality')} {...text('confidentiality')} value={confidentiality}>
          {CONFIDENTIALITY_LEVELS.map((c) => (
            <MenuItem key={c} value={c}>
              {t(`confidentiality.${c}`)}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />
    </FormDialog>
  );
}

/** A required text (reject reason, replacement request, archive reason, internal note). */
export function TextDialog({ title, hint, label, submitLabel, pending, error, onSubmit, onClose }: { title: string; hint: string; label: string; submitLabel: string; pending: boolean; error?: string; onSubmit: (text: string) => void; onClose: () => void }) {
  const { t } = useTranslation('documents');
  const { register, handleSubmit, formState } = useForm<ReasonFormValues>({ resolver: zodResolver(reasonFormSchema), defaultValues: { reason: '' } });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  return (
    <FormDialog open title={title} onClose={onClose} onSubmit={handleSubmit((v) => onSubmit(v.reason.trim()))} submitLabel={submitLabel} pending={pending} error={error}>
      <Alert severity="info">{hint}</Alert>
      <TextField label={label} required multiline minRows={3} {...textFieldProps(register, formState, 'reason', translate)} slotProps={{ htmlInput: { maxLength: 500 } }} />
    </FormDialog>
  );
}
