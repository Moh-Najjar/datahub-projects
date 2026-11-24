import { mockRequest } from '@/core/api/mock/mockRequest';
import { evaluationsMock } from '../mock/evaluationsMock';
import type { CreateEvaluationInput, EvaluationDto, UpdateEvaluationInput } from '../types/evaluation';
import { usesMockData } from '@/core/config/api';
import { evaluationsHttpApi } from './evaluationsHttp';

/** The ONLY data entry point of the Evaluations module (the real backend over HTTP, or the simulated one — same types). */
const mockEvaluationsApi = {
  listForUser: (userId: string, signal?: AbortSignal): Promise<EvaluationDto[]> => mockRequest(() => evaluationsMock.listForUser(userId), { signal }),
  create: (userId: string, input: CreateEvaluationInput): Promise<EvaluationDto> => mockRequest(() => evaluationsMock.create(userId, input)),
  update: (evaluationId: string, input: UpdateEvaluationInput): Promise<EvaluationDto> => mockRequest(() => evaluationsMock.update(evaluationId, input)),
  remove: (evaluationId: string): Promise<void> => mockRequest(() => evaluationsMock.remove(evaluationId)),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const evaluationsApi: typeof mockEvaluationsApi = usesMockData ? mockEvaluationsApi : evaluationsHttpApi;
