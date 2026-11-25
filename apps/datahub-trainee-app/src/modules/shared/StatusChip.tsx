import Chip from '@mui/material/Chip';
import type { AssignmentStatus, EnrollmentStatus, Role, TrainingStatus } from '@/core/domain/training';
import { useT } from '@/i18n/useT';

type Tone = 'success' | 'warning' | 'info' | 'default' | 'error' | 'primary';

const TONES = {
  training: { draft: 'warning', published: 'success', archived: 'default' },
  enrollment: { assigned: 'info', 'in-progress': 'primary', completed: 'success' },
  assignment: { upcoming: 'info', open: 'success', closed: 'default' },
  role: { SuperAdmin: 'primary', DepartmentAdmin: 'info', Trainee: 'default', Employee: 'default', Intern: 'default' },
} as const satisfies Record<string, Record<string, Tone>>;

type StatusChipProps =
  | { kind: 'training'; value: TrainingStatus }
  | { kind: 'enrollment'; value: EnrollmentStatus }
  | { kind: 'assignment'; value: AssignmentStatus }
  | { kind: 'role'; value: Role; /** The backend role's own name, shown instead of the translated app role. */ label?: string | null };

/** A translated, colour-coded status label. The colour is never the only signal: the text is always shown. */
export function StatusChip(props: StatusChipProps) {
  const t = useT();
  const labels: Record<string, string> =
    props.kind === 'training' ? t.enums.trainingStatus : props.kind === 'enrollment' ? t.enums.enrollmentStatus : props.kind === 'assignment' ? t.enums.assignmentStatus : t.roles;
  const tone: Tone = (TONES[props.kind] as Record<string, Tone>)[props.value] ?? 'default';
  // Tonal pills: a light tint with the tone's dark text (AA contrast), neutral grey for the default tone.
  return (
    <Chip
      size="small"
      label={(props.kind === 'role' && props.label) || (labels[props.value] ?? props.value)}
      sx={{
        fontWeight: 700,
        px: 0.5,
        bgcolor: tone === 'default' ? 'grey.100' : `${tone}.light`,
        color: tone === 'default' ? 'text.secondary' : tone === 'primary' ? 'primary.dark' : `${tone}.main`,
      }}
    />
  );
}
