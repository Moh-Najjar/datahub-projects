import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { usesMockData } from '@/core/config/api';
import { useT } from '@/i18n/useT';
import { FormDialog } from '@/modules/shared/FormDialog';
import { applyServerErrors, reasonMessage } from '@/modules/shared/utils/apiMessage';
import { isApiError } from '@/core/api/types';
import { useMaterialMutations } from '../hooks/useTrainings';
import { fileMaterialSchema, linkMaterialSchema, textMaterialSchema, type FileMaterialFormValues, type LinkMaterialFormValues, type TextMaterialFormValues } from '../schemas/trainingSchemas';
import type { FileItemDto, MaterialDto } from '../types/content';
import { filesAreValid, toFileInputs } from '../utils/files';
import { FilePicker } from './FilePicker';

interface BaseProps {
  trainingId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** The first translated message of a failed request for one field of the backend's reply. */
function fieldMessage(t: ReturnType<typeof useT>, error: unknown, field: string): string | undefined {
  if (!isApiError(error)) return undefined;
  const reason = error.fieldErrors?.[field]?.[0];
  return reason ? reasonMessage(t, reason) : undefined;
}

/** Add or edit a TEXT material (title ≤ 200, content required; plain multi-line text). */
export function TextMaterialDialog({ trainingId, material, onClose, onSaved }: BaseProps & { material: MaterialDto | null }) {
  const t = useT();
  const { addText, updateText } = useMaterialMutations(trainingId);
  const [failure, setFailure] = useState<unknown>(null);
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<TextMaterialFormValues>({ resolver: zodResolver(textMaterialSchema(t)), defaultValues: { title: material?.title ?? '', content: material?.textContent ?? '' } });
  useEffect(() => setFocus('title'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      if (material) await updateText.mutateAsync({ id: material.id, input: values });
      else await addText.mutateAsync(values);
      onSaved();
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['title', 'content'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={material ? t.content.editText : t.content.addText} submitLabel={material ? t.common.save : t.common.add} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="md">
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label={t.content.fields.title} required error={!!errors.title} helperText={errors.title?.message} {...register('title')} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label={t.content.fields.content} required multiline minRows={8} error={!!errors.content} helperText={errors.content?.message ?? t.content.plainTextNote} {...register('content')} slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
    </FormDialog>
  );
}

/** Add or edit a LINK material: a title and one or more absolute links (each with an optional label). */
export function LinkMaterialDialog({ trainingId, material, onClose, onSaved }: BaseProps & { material: MaterialDto | null }) {
  const t = useT();
  const { addLinks, updateLinks } = useMaterialMutations(trainingId);
  const [failure, setFailure] = useState<unknown>(null);
  const { register, control, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<LinkMaterialFormValues>({
    resolver: zodResolver(linkMaterialSchema(t)),
    defaultValues: { title: material?.title ?? '', links: material?.links.length ? material.links.map((l) => ({ title: l.title ?? '', url: l.url })) : [{ title: '', url: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'links' });
  useEffect(() => setFocus('title'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    const input = { title: values.title, links: values.links.map((l) => ({ title: l.title || null, url: l.url })) };
    try {
      if (material) await updateLinks.mutateAsync({ id: material.id, input });
      else await addLinks.mutateAsync(input);
      onSaved();
      onClose();
    } catch (error) {
      if (!applyServerErrors(t, error, setError, ['title'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={material ? t.content.editLinks : t.content.addLinks} submitLabel={material ? t.common.save : t.common.add} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="md">
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label={t.content.fields.title} required error={!!errors.title} helperText={errors.title?.message} {...register('title')} slotProps={{ inputLabel: { shrink: true } }} />
        {fields.map((field, index) => (
          <Stack key={field.id} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
            <TextField label={t.content.fields.linkLabel} error={!!errors.links?.[index]?.title} helperText={errors.links?.[index]?.title?.message} {...register(`links.${index}.title`)} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1 }} />
            <TextField label={t.content.fields.url} required type="url" placeholder="https://" error={!!errors.links?.[index]?.url} helperText={errors.links?.[index]?.url?.message} {...register(`links.${index}.url`)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }} sx={{ flex: 2 }} />
            <Tooltip title={t.content.removeLink}>
              <span>
                <IconButton aria-label={t.content.removeLink} disabled={fields.length === 1} onClick={() => remove(index)} sx={{ mt: { sm: 0.5 } }}>
                  <DeleteOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ))}
        {errors.links?.root?.message || (typeof errors.links?.message === 'string' && errors.links.message) ? <span role="alert">{errors.links?.root?.message ?? (errors.links?.message as string)}</span> : null}
        <Button startIcon={<AddIcon />} onClick={() => append({ title: '', url: '' })} sx={{ alignSelf: 'flex-start' }}>
          {t.content.addAnotherLink}
        </Button>
      </Stack>
    </FormDialog>
  );
}

/** Create a FILE material (title + one or more files) or, when editing, rename the group. */
export function FileMaterialDialog({ trainingId, material, onClose, onSaved }: BaseProps & { material: MaterialDto | null }) {
  const t = useT();
  const { addFiles, renameFiles } = useMaterialMutations(trainingId);
  const [files, setFiles] = useState<File[]>([]);
  const [filesError, setFilesError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<FileMaterialFormValues>({ resolver: zodResolver(fileMaterialSchema(t)), defaultValues: { title: material?.title ?? '' } });
  useEffect(() => setFocus('title'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    setFilesError(undefined);
    if (!material && !filesAreValid(files, true)) {
      setFilesError(files.length === 0 ? t.apiReasons['file.required'] : t.files.fixInvalid);
      return;
    }
    try {
      if (material) await renameFiles.mutateAsync({ id: material.id, title: values.title });
      else await addFiles.mutateAsync({ title: values.title, files: toFileInputs(files) });
      onSaved();
      onClose();
    } catch (error) {
      const message = fieldMessage(t, error, 'files');
      if (message) setFilesError(message);
      else if (!applyServerErrors(t, error, setError, ['title'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={material ? t.content.renameFiles : t.content.addFiles} description={material || !usesMockData ? undefined : t.files.simulated} submitLabel={material ? t.common.save : t.common.add} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="sm">
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label={t.content.fields.title} required error={!!errors.title} helperText={errors.title?.message} {...register('title')} slotProps={{ inputLabel: { shrink: true } }} />
        {!material && <FilePicker files={files} onChange={setFiles} label={t.files.choose} required error={filesError} />}
      </Stack>
    </FormDialog>
  );
}

/** Add more files to an existing file material. */
export function AddFilesDialog({ trainingId, material, onClose, onSaved }: BaseProps & { material: MaterialDto }) {
  const t = useT();
  const { addFileItems } = useMaterialMutations(trainingId);
  const [files, setFiles] = useState<File[]>([]);
  const [filesError, setFilesError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setFailure(null);
    setFilesError(undefined);
    if (!filesAreValid(files, true)) {
      setFilesError(files.length === 0 ? t.apiReasons['file.required'] : t.files.fixInvalid);
      return;
    }
    setPending(true);
    try {
      await addFileItems.mutateAsync({ id: material.id, files: toFileInputs(files) });
      onSaved();
      onClose();
    } catch (error) {
      const message = fieldMessage(t, error, 'files');
      if (message) setFilesError(message);
      else setFailure(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <FormDialog open title={t.content.addMoreFiles} description={material.title} submitLabel={t.common.add} isSubmitting={pending} error={failure} onClose={onClose} onSubmit={submit} maxWidth="sm">
      <FilePicker files={files} onChange={setFiles} label={t.files.choose} required error={filesError} />
    </FormDialog>
  );
}

/** Edit the optional title of one file of a file material. */
export function FileTitleDialog({ trainingId, material, file, onClose, onSaved }: BaseProps & { material: MaterialDto; file: FileItemDto }) {
  const t = useT();
  const { updateFileItem } = useMaterialMutations(trainingId);
  const [value, setValue] = useState(file.title ?? '');
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setPending(true);
    setFailure(null);
    try {
      await updateFileItem.mutateAsync({ id: material.id, fileId: file.id, title: value.trim() || null });
      onSaved();
      onClose();
    } catch (error) {
      setFailure(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <FormDialog open title={t.content.editFileTitle} description={file.fileName} submitLabel={t.common.save} isSubmitting={pending} error={failure} onClose={onClose} onSubmit={submit} maxWidth="xs">
      <TextField label={t.content.fields.fileTitle} value={value} onChange={(e) => setValue(e.target.value)} autoFocus slotProps={{ inputLabel: { shrink: true }, htmlInput: { maxLength: 200 } }} sx={{ mt: 1 }} />
    </FormDialog>
  );
}
