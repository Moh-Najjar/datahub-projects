import { actorForUser } from '@/core/api/mock/identity';
import { setCurrentActor } from '@/core/auth/actor';
import type { TrainingActor } from '@/core/auth/trainingPolicy';

/** Backend tests: make the simulated backend see this directory user as the caller (a real backend reads the token). */
export function actAs(userId: string): TrainingActor {
  const actor = actorForUser(userId);
  if (!actor) throw new Error(`No such seeded user: ${userId}`);
  setCurrentActor(actor);
  return actor;
}
