import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { fill } from '@/i18n';
import { formatDateTime, formatFileSize, formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { EmptyState, ErrorState, SkeletonBlock } from '@/modules/shared/states';
import { StatusChip } from '@/modules/shared/StatusChip';
import { useAssignmentMutations, useAssignments } from '../hooks/useTrainings';
import type { AssignmentDto } from '../types/content';
import { AssignmentDialog, AttachmentsDialog, SubmissionsDialog } from './AssignmentDialogs';
import { SubmissionPanel } from './SubmissionPanel';

type Dialog = { kind: 'edit'; assignment: AssignmentDto | null } | { kind: 'attach'; assignment: AssignmentDto } | { kind: 'submissions'; assignment: AssignmentDto };

/** Assignments of a training. Authors manage them and read submissions; learners submit while an assignment is open. */
export function AssignmentsTab({ trainingId, canAuthor, canSubmit }: { trainingId: string; canAuthor: boolean; canSubmit: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const feedback = useFeedback();
  const query = useAssignments(trainingId);
  const mutations = useAssignmentMutations(trainingId);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState<AssignmentDto | null>(null);
  const [deletingFile, setDeletingFile] = useState<{ assignment: AssignmentDto; id: string; name: string } | null>(null);
  const common = { trainingId, onClose: () => setDialog(null), onSaved: () => feedback.success(t.assignments.saved) };

  const newButton = canAuthor ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ kind: 'edit', assignment: null })}>
      {t.assignments.new}
    </Button>
  ) : null;

  if (query.isLoading) return <SkeletonBlock lines={4} height={32} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} dense />;
  const assignments = query.data ?? [];

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }} spacing={2}>
        <Typography color="text.secondary">{canAuthor ? t.assignments.hintAuthor : t.assignments.hintLearner}</Typography>
        {newButton}
      </Stack>
      {assignments.length === 0 ? (
        <Card>
          <EmptyState icon={<AssignmentOutlinedIcon />} title={t.assignments.empty.title} description={canAuthor ? t.assignments.empty.bodyAuthor : t.assignments.empty.bodyLearner} action={newButton ?? undefined} />
        </Card>
      ) : (
        <Stack spacing={2} component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }} aria-label={t.assignments.title}>
          {assignments.map((assignment) => (
            <Box component="li" key={assignment.id}>
              <Card component="article" aria-label={assignment.title} sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>
                        {assignment.title}
                      </Typography>
                      <StatusChip kind="assignment" value={assignment.status} />
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.75, color: 'text.secondary' }}>
                      <EventAvailableOutlinedIcon fontSize="small" aria-hidden />
                      <Typography variant="body2">{fill(t.assignments.window, { opens: formatDateTime(assignment.opensAt, locale), closes: formatDateTime(assignment.closesAt, locale) })}</Typography>
                    </Stack>
                  </Box>
                  {canAuthor && (
                    <Stack direction="row" sx={{ flexShrink: 0 }}>
                      <Tooltip title={t.assignments.attach}>
                        <IconButton size="small" aria-label={`${t.assignments.attach}: ${assignment.title}`} onClick={() => setDialog({ kind: 'attach', assignment })}>
                          <AttachFileIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t.common.edit}>
                        <IconButton size="small" aria-label={`${t.common.edit}: ${assignment.title}`} onClick={() => setDialog({ kind: 'edit', assignment })}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t.common.delete}>
                        <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${assignment.title}`} onClick={() => setDeleting(assignment)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>
                <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{assignment.description}</Typography>
                {assignment.attachments.length > 0 && (
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }} aria-label={t.assignments.attachments}>
                    {assignment.attachments.map((file) => (
                      <Chip
                        key={file.id}
                        size="small"
                        variant="outlined"
                        icon={<AttachFileIcon />}
                        label={`${file.fileName} · ${formatFileSize(file.fileSizeBytes, locale)}`}
                        onDelete={canAuthor ? () => setDeletingFile({ assignment, id: file.id, name: file.fileName }) : undefined}
                      />
                    ))}
                  </Stack>
                )}
                {canAuthor && (
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 2 }}>
                    <Button size="small" variant="outlined" onClick={() => setDialog({ kind: 'submissions', assignment })}>
                      {t.assignments.submissions.view}
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      {fill(t.assignments.submissions.count, { submitted: formatNumber(assignment.submissionCount, locale), total: formatNumber(assignment.traineeCount, locale) })}
                    </Typography>
                  </Stack>
                )}
                {canSubmit && <SubmissionPanel trainingId={trainingId} assignment={assignment} />}
              </Card>
            </Box>
          ))}
        </Stack>
      )}

      {dialog?.kind === 'edit' && <AssignmentDialog {...common} assignment={dialog.assignment} />}
      {dialog?.kind === 'attach' && <AttachmentsDialog {...common} assignment={dialog.assignment} />}
      {dialog?.kind === 'submissions' && <SubmissionsDialog trainingId={trainingId} assignment={dialog.assignment} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title={t.assignments.delete.title}
        message={fill(t.assignments.delete.message, { title: deleting?.title ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await mutations.remove.mutateAsync(deleting.id);
          feedback.success(t.assignments.deleted);
        }}
        onClose={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={deletingFile !== null}
        title={t.content.deleteFile.title}
        message={fill(t.content.deleteFile.message, { name: deletingFile?.name ?? '' })}
        confirmLabel={t.common.delete}
        destructive
        onConfirm={async () => {
          if (!deletingFile) return;
          await mutations.deleteAttachment.mutateAsync({ id: deletingFile.assignment.id, attachmentId: deletingFile.id });
          feedback.success(t.assignments.saved);
        }}
        onClose={() => setDeletingFile(null)}
      />
    </Box>
  );
}
