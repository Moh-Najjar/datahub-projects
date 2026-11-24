import { mockRequest } from '@/core/api/mock/mockRequest';
import { evaluationsMock } from '../mock/evaluationsMock';
import type { CreateEvaluationInput, EvaluationDto, UpdateEvaluationInput } from '../types/evaluation';

/** The ONLY data entry point of the Evaluations module (today: the simulated backend; later: HTTP, same types). */
export const evaluationsApi = {
  listForUser: (userId: string, signal?: AbortSignal): Promise<EvaluationDto[]> => mockRequest(() => evaluationsMock.listForUser(userId), { signal }),
  create: (userId: string, input: CreateEvaluationInput): Promise<EvaluationDto> => mockRequest(() => evaluationsMock.create(userId, input)),
  update: (evaluationId: string, input: UpdateEvaluationInput): Promise<EvaluationDto> => mockRequest(() => evaluationsMock.update(evaluationId, input)),
  remove: (evaluationId: string): Promise<void> => mockRequest(() => evaluationsMock.remove(evaluationId)),
};
