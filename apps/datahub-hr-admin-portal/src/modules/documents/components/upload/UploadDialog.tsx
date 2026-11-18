import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { isApiError } from '@/core/api/types';
import { useLanguage } from '@/i18n/useLanguage';
import { textFieldProps } from '@/modules/shared/formFields';
import { useAllCategories, useCreateDocument, useOwnerOptions, useReplaceDocument } from '@/modules/documents/hooks/useDocuments';
import { useDocumentsAccess } from '@/modules/documents/hooks/useDocumentsAccess';
import { categoryProblems, documentFormSchema, toDocumentUpdate, type DocumentFormValues } from '@/modules/documents/schemas/documentSchemas';
import { CONFIDENTIALITY_LEVELS, type Document, type OwnerOption, type OwnerType } from '@/modules/documents/types/documents';
import { fileProblem, fileSizeText, fileTypeOf, MAX_FILES, todayIso } from '@/modules/documents/utils/rules';
import { errorText, fieldErrorText } from '@/modules/documents/utils/serverErrors';
import { Code } from '../common/Chips';

interface PickedFile {
  key: string;
  name: string;
  sizeBytes: number;
}

export type UploadMode = { kind: 'create'; owner?: OwnerOption } | { kind: 'replace'; document: Document };

const FIELDS = ['ownerId', 'categoryId', 'name', 'documentNumber', 'issueDate', 'expiryDate', 'issuingAuthority', 'description', 'confidentiality'] as const;
const dateSlot = { inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } } as const;
const STEP_MS = 120;

/**
 * SIMULATED upload: files are only described (name, size, type) and checked against the category; the progress bar is
 * a simulation and nothing is transferred or stored. Cancelling before completion sends nothing.
 */
export function UploadDialog({ mode, onClose, onDone }: { mode: UploadMode; onClose: () => void; onDone: (d: Document) => void }) {
  const { t } = useTranslation('documents');
  const { t: tCommon } = useTranslation();
  const { language } = useLanguage();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const { canWrite, canWriteCandidates } = useDocumentsAccess();
  const replacing = mode.kind === 'replace' ? mode.document : null;
  const presetOwner = mode.kind === 'create' ? mode.owner : undefined;
  const [ownerType, setOwnerType] = useState<OwnerType>(replacing?.owner.type ?? presetOwner?.type ?? (canWrite ? 'employee' : 'candidate'));
  const [owner, setOwner] = useState<OwnerOption | null>(presetOwner ?? null);
  const [ownerSearch, setOwnerSearch] = useState('');
  const owners = useOwnerOptions(ownerType, ownerSearch, !replacing && !presetOwner);
  const categories = useAllCategories();
  const create = useCreateDocument();
  const replace = useReplaceDocument();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [fileError, setFileError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const { register, control, handleSubmit, formState, setError, setValue, getValues } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      ownerId: replacing?.owner.id ?? presetOwner?.id ?? '',
      categoryId: replacing?.category.id ?? '',
      name: replacing?.name ?? '',
      documentNumber: replacing?.documentNumber ?? '',
      issueDate: '',
      expiryDate: '',
      issuingAuthority: replacing?.issuingAuthority ?? '',
      description: '',
      confidentiality: replacing?.confidentiality ?? 'standard',
    },
  });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const confidentiality = useWatch({ control, name: 'confidentiality' });
  const translate = (reason: string | undefined) => fieldErrorText(t, reason);
  const text = (name: Path<DocumentFormValues>, helper?: string) => textFieldProps(register, formState, name, translate, helper);
  const ownerEmploymentType = replacing ? null : (owner?.employmentType ?? null);
  const options = useMemo(
    () => (categories.data?.items ?? []).filter((c) => c.status === 'active' && c.appliesTo.includes(ownerType) && (!ownerEmploymentType || c.employmentTypes.includes(ownerEmploymentType))),
    [categories.data, ownerType, ownerEmploymentType],
  );
  const category = (categories.data?.items ?? []).find((c) => c.id === categoryId);
  const uploading = progress !== null;
  const pending = uploading || create.isPending || replace.isPending;

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    // Only the name and size are read: the content never leaves the browser (simulated storage).
    const picked = [...list].map((f) => ({ key: `f${counter.current++}`, name: f.name, sizeBytes: f.size }));
    setFiles((current) => [...current, ...picked].slice(0, MAX_FILES));
    if (files.length + picked.length > MAX_FILES) setFileError(t('validation.tooManyFiles'));
    else setFileError(undefined);
  };
  const problemOf = (f: PickedFile) => (category ? fileProblem(f, category) : null);

  const cancelUpload = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(null);
  };

  const send = (v: DocumentFormValues) => {
    const update = toDocumentUpdate(documentFormSchema.parse(v));
    const payload = { ...update, files: files.map((f) => ({ name: f.name, sizeBytes: f.sizeBytes })) };
    const onError = (error: Error) => {
      if (isApiError(error) && error.code === 'VALIDATION' && error.fieldErrors) {
        let applied = false;
        for (const [field, reasons] of Object.entries(error.fieldErrors)) {
          if (field === 'files' && reasons[0]) {
            setFileError(translate(reasons[0]));
            applied = true;
          } else if (field === 'ownerId' && reasons[0] && (replacing || presetOwner)) {
            // No owner picker in this mode: show the reason (e.g. an inactive owner) as a visible message.
            setFormError(translate(reasons[0]));
            applied = true;
          } else if ((FIELDS as readonly string[]).includes(field) && reasons[0]) {
            setError(field as Path<DocumentFormValues>, { type: 'server', message: reasons[0] }, { shouldFocus: !applied });
            applied = true;
          }
        }
        if (applied) return;
      }
      setFormError(errorText(t, tCommon, error));
    };
    if (replacing) replace.mutate({ id: replacing.id, input: payload }, { onSuccess: onDone, onError });
    else create.mutate({ ...payload, ownerType, ownerId: v.ownerId }, { onSuccess: onDone, onError });
  };

  // handleSubmit runs inside the submit EVENT (not during render): the transfer timer is only touched by handlers.
  const onValid = (v: DocumentFormValues) => {
    setFormError(undefined);
    if (!category) return;
    const problems = categoryProblems({ issueDate: v.issueDate || null, expiryDate: v.expiryDate || null, documentNumber: v.documentNumber, files }, category, todayIso());
    if (problems) {
      let first = true;
      for (const [field, reasons] of Object.entries(problems)) {
        if (field === 'files') setFileError(translate(reasons[0]));
        else setError(field as Path<DocumentFormValues>, { type: 'validate', message: reasons[0] }, { shouldFocus: first });
        first = false;
      }
      return;
    }
    startSimulatedTransfer();
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => void handleSubmit(onValid)(e);

  /** Simulated transfer: a progress bar, then the metadata is sent. Cancelling stops it and sends nothing. */
  function startSimulatedTransfer() {
    let value = 0;
    setProgress(0);
    const id = setInterval(() => {
      value += 20;
      if (value < 100) {
        setProgress(value);
        return;
      }
      clearInterval(id);
      timer.current = null;
      setProgress(null);
      send(getValues());
    }, STEP_MS);
    timer.current = id;
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!pending) addFiles(e.dataTransfer.files);
  };

  return (
    <Dialog open onClose={pending ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="md" aria-labelledby={titleId} slotProps={{ paper: { component: 'form', noValidate: true, onSubmit } as object }}>
      <DialogTitle id={titleId}>{replacing ? t('upload.replaceTitle', { name: replacing.name }) : t('upload.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Alert severity="warning">{t('upload.simulatedNotice')}</Alert>
          {replacing && <Alert severity="info">{t('upload.replaceHint')}</Alert>}
          {formError && (
            <Alert severity="error" role="alert">
              {formError}
            </Alert>
          )}
          {!replacing && !presetOwner && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
              {canWrite && canWriteCandidates && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={ownerType}
                  onChange={(_, v: OwnerType | null) => {
                    if (!v) return;
                    setOwnerType(v);
                    setOwner(null);
                    setValue('ownerId', '');
                    setValue('categoryId', '');
                  }}
                  aria-label={t('fields.ownerType')}
                >
                  <ToggleButton value="employee">{t('ownerType.employee')}</ToggleButton>
                  <ToggleButton value="candidate">{t('ownerType.candidate')}</ToggleButton>
                </ToggleButtonGroup>
              )}
              <Controller
                control={control}
                name="ownerId"
                render={({ fieldState }) => (
                  <Autocomplete
                    sx={{ flex: '1 1 260px', minWidth: 0 }}
                    options={owners.data ?? []}
                    value={owner}
                    filterOptions={(x) => x}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    getOptionLabel={(o) => `${o.name[language]} (${o.number})`}
                    onInputChange={(_, v) => setOwnerSearch(v)}
                    onChange={(_, v) => {
                      setOwner(v);
                      setValue('ownerId', v?.id ?? '', { shouldValidate: formState.isSubmitted });
                    }}
                    renderInput={(params) => <TextField {...params} required label={ownerType === 'employee' ? t('fields.employee') : t('fields.candidate')} error={Boolean(fieldState.error)} helperText={translate(fieldState.error?.message)} />}
                  />
                )}
              />
            </Box>
          )}
          {(replacing || presetOwner) && (
            <Typography variant="body2">
              {t('fields.owner')}: <strong>{(replacing?.owner.name ?? presetOwner!.name)[language]}</strong> <Code>{replacing?.owner.number ?? presetOwner!.number}</Code>
            </Typography>
          )}

          <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <Controller
              control={control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <TextField
                  select
                  required
                  label={t('fields.category')}
                  value={field.value}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const c = options.find((x) => x.id === e.target.value);
                    if (c) {
                      setValue('confidentiality', c.defaultConfidentiality);
                      if (!getValues('name')) setValue('name', c.name[language]);
                    }
                  }}
                  disabled={Boolean(replacing)}
                  error={Boolean(fieldState.error)}
                  helperText={translate(fieldState.error?.message) ?? (category ? t('upload.categoryRules', { types: category.allowedFileTypes.join(', '), size: category.maxFileSizeMb }) : undefined)}
                >
                  {(replacing && category ? [category] : options).map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name[language]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField label={t('fields.name')} required {...text('name')} />
            <TextField label={t('fields.documentNumber')} required={category?.requiresNumber} {...text('documentNumber')} slotProps={{ htmlInput: { dir: 'ltr' } }} />
            <TextField label={t('fields.issuingAuthority')} {...text('issuingAuthority')} />
            <TextField label={t('fields.issueDate')} type="date" {...text('issueDate')} slotProps={dateSlot} />
            <TextField label={t('fields.expiryDate')} type="date" required={category?.tracksExpiry} {...text('expiryDate', category?.tracksExpiry ? t('upload.expiryTracked') : undefined)} slotProps={dateSlot} />
            <TextField select label={t('fields.confidentiality')} {...text('confidentiality')} value={confidentiality}>
              {CONFIDENTIALITY_LEVELS.map((c) => (
                <MenuItem key={c} value={c}>
                  {t(`confidentiality.${c}`)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <TextField label={t('fields.description')} multiline minRows={2} {...text('description')} />

          <Box
            onDragOver={(e) => {
              e.preventDefault();
              if (!pending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            sx={{ border: 2, borderStyle: 'dashed', borderColor: dragging ? 'primary.main' : fileError ? 'error.main' : 'divider', borderRadius: 2, p: 3, textAlign: 'center', bgcolor: dragging ? 'action.hover' : 'transparent' }}
          >
            <UploadFileOutlined color="action" />
            <Typography sx={{ mt: 1 }}>{t('upload.dropHere')}</Typography>
            <Button sx={{ mt: 1 }} variant="outlined" size="small" disabled={pending} onClick={() => inputRef.current?.click()}>
              {t('upload.chooseFiles')}
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              aria-label={t('upload.chooseFiles')}
              data-testid="document-file-input"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {category ? t('upload.allowed', { types: category.allowedFileTypes.join(', '), size: category.maxFileSizeMb, max: MAX_FILES }) : t('upload.chooseCategoryFirst')}
            </Typography>
          </Box>
          {fileError && (
            <Alert severity="error" role="alert">
              {fileError}
            </Alert>
          )}
          {files.length > 0 && (
            <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={t('upload.selectedFiles')}>
              {files.map((f) => {
                const problem = problemOf(f);
                return (
                  <Box component="li" key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, border: 1, borderColor: problem ? 'error.main' : 'divider', borderRadius: 1, minWidth: 0 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        <Code>{f.name}</Code>
                      </Typography>
                      <Typography variant="caption" color={problem ? 'error' : 'text.secondary'}>
                        <span dir="ltr">
                          {(fileTypeOf(f.name) ?? '?').toUpperCase()} · {fileSizeText(f.sizeBytes)}
                        </span>
                        {problem ? ` · ${translate(problem)}` : ''}
                      </Typography>
                      {uploading && <LinearProgress variant="determinate" value={progress ?? 0} aria-label={t('upload.progress', { name: f.name })} sx={{ mt: 0.5 }} />}
                    </Box>
                    <IconButton size="small" aria-label={t('upload.removeFile', { name: f.name })} disabled={pending} onClick={() => setFiles((list) => list.filter((x) => x.key !== f.key))}>
                      <CloseOutlined fontSize="small" />
                    </IconButton>
                  </Box>
                );
              })}
            </Stack>
          )}
          {uploading && (
            <Typography variant="body2" role="status">
              {t('upload.uploading', { percent: progress })}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {uploading ? (
          <Button color="error" onClick={cancelUpload}>
            {t('upload.cancelUpload')}
          </Button>
        ) : (
          <Button onClick={onClose} disabled={pending}>
            {tCommon('actions.cancel')}
          </Button>
        )}
        <Button type="submit" variant="contained" disabled={pending || files.some((f) => problemOf(f) !== null)}>
          {pending ? tCommon('actions.saving') : replacing ? t('actions.uploadReplacement') : t('actions.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
