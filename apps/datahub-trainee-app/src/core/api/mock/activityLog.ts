import type { TrainingActor } from '@/core/auth/trainingPolicy';
import { db, newId } from './mockDatabase';
import type { ActivityType, DbActivity } from './dbTypes';

/** Appends one event to the activity timeline (important business events only). Call before `commit()`. */
export function recordActivity(
  actor: TrainingActor,
  type: ActivityType,
  details: { trainingId?: string | null; userId?: string | null; progress?: number | null },
): DbActivity {
  const database = db();
  const training = details.trainingId ? database.trainings.find((t) => t.id === details.trainingId) : undefined;
  const user = details.userId ? database.users.find((u) => u.id === details.userId) : undefined;
  const entry: DbActivity = {
    id: newId('act'),
    type,
    at: new Date().toISOString(),
    actorId: actor.userId,
    actorName: actor.fullName,
    trainingId: training?.id ?? null,
    trainingTitle: training?.title ?? null,
    departmentId: training?.departmentId ?? user?.departmentId ?? null,
    userId: user?.id ?? null,
    userName: user?.fullName ?? null,
    progress: details.progress ?? null,
  };
  database.activities.push(entry);
  // Keep the log bounded so the stored database stays small.
  if (database.activities.length > 300) database.activities.splice(0, database.activities.length - 300);
  return entry;
}
