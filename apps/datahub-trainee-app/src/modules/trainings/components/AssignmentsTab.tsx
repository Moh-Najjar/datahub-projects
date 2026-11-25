import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { fill } from '@/i18n';
import { useT } from '@/i18n/useT';
import { ConfirmDialog } from '@/modules/shared/ConfirmDialog';
import { useFeedback } from '@/modules/shared/hooks/feedbackContext';
import { EmptyState, ErrorState, SkeletonBlock } from '@/modules/shared/states';
import { useAssignmentMutations, useAssignments } from '../hooks/useTrainings';
import { AssignmentCard } from './AssignmentCard';
import type { AssignmentDto } from '../types/content';
import { AssignmentDialog, AttachmentsDialog, SubmissionsDialog } from './AssignmentDialogs';

type Dialog = { kind: 'edit'; assignment: AssignmentDto | null } | { kind: 'attach'; assignment: AssignmentDto } | { kind: 'submissions'; assignment: AssignmentDto };

/** Assignments of a training. Authors manage them and read submissions; learners submit while an assignment is open. */
export function AssignmentsTab({ trainingId, canAuthor, canSubmit }: { trainingId: string; canAuthor: boolean; canSubmit: boolean }) {
  const t = useT();
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
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 2 }} spacing={{ xs: 1.5, sm: 2 }}>
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
              <AssignmentCard
                assignment={assignment}
                trainingId={trainingId}
                canAuthor={canAuthor}
                canSubmit={canSubmit}
                onEdit={() => setDialog({ kind: 'edit', assignment })}
                onDelete={() => setDeleting(assignment)}
                onAttach={() => setDialog({ kind: 'attach', assignment })}
                onSubmissions={() => setDialog({ kind: 'submissions', assignment })}
                onRemoveFile={(file) => setDeletingFile({ assignment, id: file.id, name: file.fileName })}
              />
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
