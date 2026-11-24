import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { formatDateTime, formatFileSize, toDateTimeInputValue } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { FormDialog } from '@/modules/shared/FormDialog';
import { ErrorState, LoadingState, EmptyState } from '@/modules/shared/states';
import { UserAvatar } from '@/modules/shared/UserAvatar';
import { applyServerErrors, reasonMessage } from '@/modules/shared/utils/apiMessage';
import { isApiError } from '@/core/api/types';
import { useAssignmentMutations, useSubmissions } from '../hooks/useTrainings';
import { assignmentSchema, type AssignmentFormValues } from '../schemas/trainingSchemas';
import type { AssignmentDto } from '../types/content';
import { filesAreValid, toFileInputs } from '../utils/files';
import { FilePicker } from './FilePicker';

interface BaseProps {
  trainingId: string;
  onClose: () => void;
  onSaved: () => void;
}

/** A sensible default for a new assignment: opens now, closes in a week. */
function defaultWindow(): { opensAt: string; closesAt: string } {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const closes = new Date(now.getTime() + 7 * 86_400_000);
  return { opensAt: toDateTimeInputValue(now), closesAt: toDateTimeInputValue(closes) };
}

/** Create or edit an assignment (title ≤ 200, description, closing time after opening time, attachments on create). */
export function AssignmentDialog({ trainingId, assignment, onClose, onSaved }: BaseProps & { assignment: AssignmentDto | null }) {
  const t = useT();
  const { create, update } = useAssignmentMutations(trainingId);
  const [files, setFiles] = useState<File[]>([]);
  const [filesError, setFilesError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const { register, handleSubmit, setError, setFocus, formState: { errors, isSubmitting } } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema(t)),
    defaultValues: assignment ? { title: assignment.title, description: assignment.description, opensAt: toDateTimeInputValue(assignment.opensAt), closesAt: toDateTimeInputValue(assignment.closesAt) } : { title: '', description: '', ...defaultWindow() },
  });
  useEffect(() => setFocus('title'), [setFocus]);

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    setFilesError(undefined);
    if (!assignment && !filesAreValid(files)) {
      setFilesError(t.files.fixInvalid);
      return;
    }
    const core = { title: values.title, description: values.description, opensAt: new Date(values.opensAt).toISOString(), closesAt: new Date(values.closesAt).toISOString() };
    try {
      if (assignment) await update.mutateAsync({ id: assignment.id, input: core });
      else await create.mutateAsync({ ...core, attachments: toFileInputs(files) });
      onSaved();
      onClose();
    } catch (error) {
      const fileReason = isApiError(error) ? error.fieldErrors?.attachments?.[0] : undefined;
      if (fileReason) setFilesError(reasonMessage(t, fileReason));
      else if (!applyServerErrors(t, error, setError, ['title', 'description', 'opensAt', 'closesAt'])) setFailure(error);
    }
  });

  return (
    <FormDialog open title={assignment ? t.assignments.edit : t.assignments.new} submitLabel={assignment ? t.common.save : t.common.create} isSubmitting={isSubmitting} error={failure} onClose={onClose} onSubmit={submit} maxWidth="md">
      <Stack spacing={2.5} sx={{ pt: 1 }}>
        <TextField label={t.assignments.fields.title} required error={!!errors.title} helperText={errors.title?.message} {...register('title')} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label={t.assignments.fields.description} required multiline minRows={4} error={!!errors.description} helperText={errors.description?.message} {...register('description')} slotProps={{ inputLabel: { shrink: true } }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
          <TextField label={t.assignments.fields.opensAt} type="datetime-local" required error={!!errors.opensAt} helperText={errors.opensAt?.message} {...register('opensAt')} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label={t.assignments.fields.closesAt} type="datetime-local" required error={!!errors.closesAt} helperText={errors.closesAt?.message} {...register('closesAt')} slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        {!assignment && <FilePicker files={files} onChange={setFiles} label={t.assignments.attach} error={filesError} />}
      </Stack>
    </FormDialog>
  );
}

/** Attach more files to an existing assignment. */
export function AttachmentsDialog({ trainingId, assignment, onClose, onSaved }: BaseProps & { assignment: AssignmentDto }) {
  const t = useT();
  const { addAttachments } = useAssignmentMutations(trainingId);
  const [files, setFiles] = useState<File[]>([]);
  const [filesError, setFilesError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setFilesError(undefined);
    setFailure(null);
    if (!filesAreValid(files, true)) {
      setFilesError(files.length === 0 ? t.apiReasons['file.required'] : t.files.fixInvalid);
      return;
    }
    setPending(true);
    try {
      await addAttachments.mutateAsync({ id: assignment.id, files: toFileInputs(files) });
      onSaved();
      onClose();
    } catch (error) {
      const reason = isApiError(error) ? error.fieldErrors?.attachments?.[0] : undefined;
      if (reason) setFilesError(reasonMessage(t, reason));
      else setFailure(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <FormDialog open title={t.assignments.attach} description={assignment.title} submitLabel={t.common.add} isSubmitting={pending} error={failure} onClose={onClose} onSubmit={submit} maxWidth="sm">
      <FilePicker files={files} onChange={setFiles} label={t.files.choose} required error={filesError} />
    </FormDialog>
  );
}

/** Staff view of one assignment: every enrolled person with their submission (or "not submitted"). */
export function SubmissionsDialog({ trainingId, assignment, onClose }: { trainingId: string; assignment: AssignmentDto; onClose: () => void }) {
  const t = useT();
  const { locale } = useLocale();
  const query = useSubmissions(trainingId, assignment.id);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="submissions-title">
      <DialogTitle id="submissions-title">
        {t.assignments.submissions.title}
        <Typography variant="body2" color="text.secondary" component="p">
          {assignment.title}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {query.isLoading && <LoadingState minHeight={160} />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} dense />}
        {query.data && query.data.length === 0 && <EmptyState dense title={t.assignments.submissions.noTrainees} />}
        {query.data && query.data.length > 0 && (
          <Stack spacing={1.5} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {query.data.map((entry) => (
              <Box component="li" key={entry.userId} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <UserAvatar name={entry.userName} size={32} />
                    <Typography sx={{ fontWeight: 600 }}>{entry.userName}</Typography>
                  </Stack>
                  {entry.submission ? (
                    <Chip size="small" color="success" variant="outlined" label={`${t.assignments.submissions.submittedAt} ${formatDateTime(entry.submission.updatedAt ?? entry.submission.submittedAt, locale)}`} />
                  ) : (
                    <Chip size="small" variant="outlined" label={t.assignments.submissions.notSubmitted} />
                  )}
                </Stack>
                {entry.submission && (
                  <Box sx={{ mt: 1.5 }}>
                    {entry.submission.textResponse ? (
                      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.submission.textResponse}</Typography>
                    ) : (
                      <Typography color="text.secondary">{t.assignments.submissions.noText}</Typography>
                    )}
                    {entry.submission.attachments.length > 0 && (
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
                        {entry.submission.attachments.map((file) => (
                          <Chip key={file.id} size="small" variant="outlined" label={`${file.fileName} · ${formatFileSize(file.fileSizeBytes, locale)}`} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        )}
        <Alert severity="info" sx={{ mt: 2 }}>
          {t.files.simulated}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t.common.close}</Button>
      </DialogActions>
    </Dialog>
  );
}
