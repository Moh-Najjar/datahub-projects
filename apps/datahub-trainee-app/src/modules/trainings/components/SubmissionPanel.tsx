import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { isApiError } from '@/core/api/types';
import { fill } from '@/i18n';
import { formatDateTime, formatFileSize } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { apiErrorMessage, reasonMessage } from '@/modules/shared/utils/apiMessage';
import { useAssignmentMutations } from '../hooks/useTrainings';
import { submissionSchema, type SubmissionFormValues } from '../schemas/trainingSchemas';
import type { AssignmentDto } from '../types/content';
import { filesAreValid, toFileInputs } from '../utils/files';
import { FilePicker } from './FilePicker';

/**
 * The learner's submission for one assignment: their text and files, editable only while the assignment is Open
 * (original rule) — before it opens or after it closes, the submission is read-only.
 */
export function SubmissionPanel({ trainingId, assignment }: { trainingId: string; assignment: AssignmentDto }) {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useFeedback();
  const { submit, deleteSubmissionAttachment } = useAssignmentMutations(trainingId);
  const mine = assignment.mySubmission;
  const open = assignment.status === 'open';
  const [files, setFiles] = useState<File[]>([]);
  const [filesError, setFilesError] = useState<string | undefined>();
  const [failure, setFailure] = useState<unknown>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SubmissionFormValues>({ resolver: zodResolver(submissionSchema(t)), defaultValues: { textResponse: mine?.textResponse ?? '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    setFilesError(undefined);
    if (!filesAreValid(files)) {
      setFilesError(t.files.fixInvalid);
      return;
    }
    try {
      await submit.mutateAsync({ id: assignment.id, input: { textResponse: values.textResponse, files: toFileInputs(files) } });
      setFiles([]);
      feedback.success(mine ? t.assignments.submission.updated : t.assignments.submission.sent);
    } catch (error) {
      const reason = isApiError(error) ? error.fieldErrors?.files?.[0] : undefined;
      if (reason) setFilesError(reasonMessage(t, reason));
      else setFailure(error);
    }
  });

  const removeAttachment = async (attachmentId: string) => {
    try {
      await deleteSubmissionAttachment.mutateAsync({ id: assignment.id, attachmentId });
      feedback.success(t.assignments.submission.fileRemoved);
    } catch (error) {
      feedback.error(apiErrorMessage(t, error));
    }
  };

  return (
    <Box sx={{ mt: 2, p: 2, borderRadius: 1, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
      <Stack direction="row" useFlexGap spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="subtitle2" component="h4">
          {t.assignments.submission.title}
        </Typography>
        {mine ? <Chip size="small" color="success" variant="outlined" label={fill(t.assignments.submission.submittedOn, { date: formatDateTime(mine.updatedAt ?? mine.submittedAt, locale) })} /> : <Chip size="small" variant="outlined" label={t.assignments.submission.none} />}
      </Stack>

      {mine && mine.attachments.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 1.5 }}>
          {mine.attachments.map((file) => (
            <Chip key={file.id} size="small" variant="outlined" label={`${file.fileName} · ${formatFileSize(file.fileSizeBytes, locale)}`} onDelete={open ? () => removeAttachment(file.id) : undefined} deleteIcon={<CloseIcon aria-label={fill(t.files.remove, { name: file.fileName })} />} />
          ))}
        </Stack>
      )}

      {open ? (
        <Box component="form" onSubmit={onSubmit} noValidate>
          <Stack spacing={2}>
            <TextField label={t.assignments.submission.answer} multiline minRows={3} error={!!errors.textResponse} helperText={errors.textResponse?.message} {...register('textResponse')} slotProps={{ inputLabel: { shrink: true } }} />
            <FilePicker files={files} onChange={setFiles} label={t.assignments.submission.attach} error={filesError} />
            {failure != null && <Alert severity="error">{apiErrorMessage(t, failure)}</Alert>}
            <Box>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? t.common.saving : mine ? t.assignments.submission.update : t.assignments.submission.submit}
              </Button>
            </Box>
          </Stack>
        </Box>
      ) : (
        <Stack spacing={1}>
          {mine?.textResponse && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{mine.textResponse}</Typography>}
          <Alert severity="info" icon={false} sx={{ alignItems: 'flex-start' }}>
            {assignment.status === 'upcoming' ? fill(t.assignments.submission.opensLater, { date: formatDateTime(assignment.opensAt, locale) }) : t.assignments.submission.closed}
          </Alert>
        </Stack>
      )}
    </Box>
  );
}
