import { ApiError } from '@/core/api/types';
import type { TrainingActor } from './trainingPolicy';

/*
 * "Who is calling" for the SIMULATED backend. A real backend derives this from the access token on every request;
 * the mock has no token to read, so the AuthProvider tells it (`setCurrentActor`). Only mock handlers read it.
 */

let current: TrainingActor | null = null;

export function setCurrentActor(actor: TrainingActor | null): void {
  current = actor;
}

export function getCurrentActor(): TrainingActor | null {
  return current;
}

/** The caller, or an `UNAUTHORIZED` error (no session). */
export function requireActor(): TrainingActor {
  if (!current) throw new ApiError('UNAUTHORIZED');
  return current;
}
