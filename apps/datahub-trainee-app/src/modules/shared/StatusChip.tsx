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
  | { kind: 'role'; value: Role };

/** A translated, colour-coded status label. The colour is never the only signal: the text is always shown. */
export function StatusChip(props: StatusChipProps) {
  const t = useT();
  const labels: Record<string, string> =
    props.kind === 'training' ? t.enums.trainingStatus : props.kind === 'enrollment' ? t.enums.enrollmentStatus : props.kind === 'assignment' ? t.enums.assignmentStatus : t.roles;
  const tone: Tone = (TONES[props.kind] as Record<string, Tone>)[props.value] ?? 'default';
  return (
    <Chip
      size="small"
      label={labels[props.value] ?? props.value}
      variant={tone === 'default' ? 'outlined' : 'filled'}
      color={tone === 'default' ? 'default' : tone}
      sx={{ fontWeight: 500 }}
    />
  );
}
