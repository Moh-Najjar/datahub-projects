import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { radius, tint } from '@/core/theme/tokens';
import { fill } from '@/i18n';
import { formatDateTime, formatNumber, formatRelative } from '@/i18n/format';
import { useLocale } from '@/i18n/LocaleContext';
import { useT } from '@/i18n/useT';
import { StatusChip } from '@/modules/shared/StatusChip';
import type { AssignmentDto, FileItemDto } from '../types/content';
import { FileList } from './FileList';
import { SubmissionPanel } from './SubmissionPanel';

interface AssignmentCardProps {
  assignment: AssignmentDto;
  trainingId: string;
  canAuthor: boolean;
  canSubmit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAttach: () => void;
  onSubmissions: () => void;
  onRemoveFile: (file: FileItemDto) => void;
}

/** A small uppercase section label. */
function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, minHeight: 30 }}>
      <Typography component="h4" variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em', lineHeight: 1.5 }}>
        {children}
      </Typography>
      {action}
    </Stack>
  );
}

/** One labelled date of the schedule ("OPENS · Nov 25, 2026, 02:00 PM"). */
function ScheduleItem({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * One assignment: title + status, the schedule (opens / closes, with a relative hint), the instructions, the attached
 * files (open or download each), and — for authors — the submission progress; learners get their submission panel.
 */
export function AssignmentCard({ assignment, trainingId, canAuthor, canSubmit, onEdit, onDelete, onAttach, onSubmissions, onRemoveFile }: AssignmentCardProps) {
  const t = useT();
  const { locale } = useLocale();
  const T = t.assignments;
  const due =
    assignment.status === 'upcoming'
      ? fill(T.dueUpcoming, { when: formatRelative(assignment.opensAt, locale) })
      : assignment.status === 'open'
        ? fill(T.dueOpen, { when: formatRelative(assignment.closesAt, locale) })
        : fill(T.dueClosed, { when: formatRelative(assignment.closesAt, locale) });
  const submitted = assignment.submissionCount;
  const total = assignment.traineeCount;

  return (
    <Card component="article" aria-label={assignment.title} sx={{ p: { xs: 2, sm: 2.5 } }}>
      {/* Header */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: `${radius.md}px`, display: 'grid', placeItems: 'center', bgcolor: 'primary.light', color: 'primary.main' }}>
          <AssignmentOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere', lineHeight: 1.3 }}>
              {assignment.title}
            </Typography>
            <StatusChip kind="assignment" value={assignment.status} />
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 600, color: assignment.status === 'open' ? 'warning.main' : 'text.secondary' }}>
            {due}
          </Typography>
        </Box>
        {canAuthor && (
          <Stack direction="row" sx={{ flexShrink: 0 }}>
            <Tooltip title={t.common.edit}>
              <IconButton size="small" aria-label={`${t.common.edit}: ${assignment.title}`} onClick={onEdit}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={t.common.delete}>
              <IconButton size="small" color="error" aria-label={`${t.common.delete}: ${assignment.title}`} onClick={onDelete}>
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      {/* Schedule */}
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          borderRadius: `${radius.md}px`,
          bgcolor: 'grey.50',
          border: 1,
          borderColor: 'divider',
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        }}
      >
        <ScheduleItem label={T.opens} value={formatDateTime(assignment.opensAt, locale)} />
        <ScheduleItem label={T.closes} value={formatDateTime(assignment.closesAt, locale)} />
      </Box>

      {/* Instructions */}
      <Box sx={{ mt: 2.5 }}>
        <SectionLabel>{T.instructions}</SectionLabel>
        {assignment.description.trim() ? (
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{assignment.description}</Typography>
        ) : (
          <Typography color="text.secondary">{T.noInstructions}</Typography>
        )}
      </Box>

      {/* Attachments */}
      {(assignment.attachments.length > 0 || canAuthor) && (
        <Box sx={{ mt: 2.5 }}>
          <SectionLabel
            action={
              canAuthor ? (
                <Button size="small" startIcon={<AddIcon />} onClick={onAttach} aria-label={`${T.addFiles}: ${assignment.title}`}>
                  {T.addFiles}
                </Button>
              ) : undefined
            }
          >
            {fill(T.attachmentsCount, { count: formatNumber(assignment.attachments.length, locale) })}
          </SectionLabel>
          {assignment.attachments.length > 0 ? (
            <FileList files={assignment.attachments} kind="assignment" label={T.attachments} onRemove={canAuthor ? onRemoveFile : undefined} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {T.noAttachments}
            </Typography>
          )}
        </Box>
      )}

      {/* Submissions (authors) */}
      {canAuthor && (
        <>
          <Divider sx={{ my: 2.5 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {T.submissionsLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {total > 0 ? fill(T.submissions.count, { submitted: formatNumber(submitted, locale), total: formatNumber(total, locale) }) : T.submissions.noTrainees}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={total > 0 ? Math.min(100, (submitted / total) * 100) : 0}
                aria-label={T.submissionsLabel}
                sx={{ bgcolor: total > 0 ? undefined : tint.info }}
              />
            </Box>
            <Button variant="outlined" onClick={onSubmissions} sx={{ flexShrink: 0 }}>
              {T.submissions.view}
            </Button>
          </Stack>
        </>
      )}

      {canSubmit && <SubmissionPanel trainingId={trainingId} assignment={assignment} />}
    </Card>
  );
}
