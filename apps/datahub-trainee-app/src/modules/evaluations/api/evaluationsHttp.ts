import { createdId, http } from '@/core/api/http';
import { arr, asRaw, listOf, num, str, type Raw } from '@/core/api/read';
import { ApiError } from '@/core/api/types';
import { MAX_SCORE } from '@/core/config/evaluationDefaults';
import type { CreateEvaluationInput, EvaluationCategoryInput, EvaluationDto, UpdateEvaluationInput } from '../types/evaluation';

/*
 * Evaluations on the real backend (`/api/v1/academy/evaluations…`). The backend ties an evaluation to an ENROLLMENT;
 * the app evaluates a person (training optional) — without a chosen training, the person's most recent enrollment is
 * used, and a person without any enrollment cannot be evaluated (→ message). Category scores are the evaluation's
 * `scores` (score out of the original portal's MAX_SCORE); the total is their sum.
 * Create = `POST /evaluations` then `PUT /evaluations/{id}` with the date and the scores (the create body has neither).
 * Response fields are read tolerantly (Swagger has no response models).
 */

const A = '/api/v1/academy';

const scoresBody = (categories: readonly EvaluationCategoryInput[]) =>
  categories.map((c, i) => ({ categoryName: c.categoryName, criteria: c.criteria, score: c.score, maxScore: MAX_SCORE, weight: null, comments: null, sortOrder: i + 1 }));

const total = (categories: readonly EvaluationCategoryInput[]) => categories.reduce((sum, c) => sum + c.score, 0);

async function toDto(userId: string, o: Raw, signal?: AbortSignal): Promise<EvaluationDto> {
  const id = str(o, 'id', 'evaluationId') ?? '';
  let scores = arr(o, 'scores', 'categories');
  if (scores.length === 0 && !Array.isArray(o.scores) && id) scores = listOf(await http.get(`${A}/evaluations/${id}/scores`, { signal }).catch(() => []));
  const categories = scores
    .sort((a, b) => (num(a, 'sortOrder') ?? 0) - (num(b, 'sortOrder') ?? 0))
    .map((s, i) => ({ id: str(s, 'id') ?? `${id}-${i}`, categoryName: str(s, 'categoryName') ?? '', criteria: str(s, 'criteria') ?? '', score: num(s, 'score') ?? 0 }));
  const sum = categories.reduce((n, c) => n + c.score, 0);
  const max = scores.reduce((n, s) => n + (num(s, 'maxScore') ?? MAX_SCORE), 0);
  return {
    id,
    userId: str(o, 'userId') ?? userId,
    userName: str(o, 'userDisplayName', 'userName', 'traineeName') ?? '',
    evaluatedByUserId: str(o, 'evaluatedByUserId', 'evaluatorUserId', 'createdByUserId') ?? '',
    evaluatedByUserName: str(o, 'evaluatedByUserName', 'evaluatorName', 'createdByUserName'),
    enrollmentId: str(o, 'enrollmentId'),
    trainingId: str(o, 'trainingId'),
    trainingTitle: str(o, 'trainingTitle', 'trainingName'),
    departmentName: str(o, 'departmentName', 'department'),
    evaluatedAt: str(o, 'evaluatedAtUtc', 'evaluatedAt', 'createdAtUtc') ?? new Date(0).toISOString(),
    total: num(o, 'overallScore', 'total') ?? sum,
    maxTotal: num(o, 'maxTotal') ?? max,
    createdAt: str(o, 'createdAtUtc', 'createdAt') ?? new Date(0).toISOString(),
    updatedAt: str(o, 'updatedAtUtc', 'updatedAt'),
    categories,
  };
}

async function listForUser(userId: string, signal?: AbortSignal): Promise<EvaluationDto[]> {
  const rows = listOf(await http.get(`${A}/users/${userId}/evaluations`, { signal }));
  return (await Promise.all(rows.map((o) => toDto(userId, o, signal)))).sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
}

async function find(userId: string, evaluationId: string): Promise<EvaluationDto> {
  const found = (await listForUser(userId)).find((e) => e.id === evaluationId);
  if (!found) throw new ApiError('NOT_FOUND', 'evaluation.notFound');
  return found;
}

/** userId of an evaluation, remembered from the latest list read (the update / delete endpoints take only its id). */
const owners = new Map<string, string>();

export const evaluationsHttpApi = {
  async listForUser(userId: string, signal?: AbortSignal): Promise<EvaluationDto[]> {
    const list = await listForUser(userId, signal);
    for (const e of list) owners.set(e.id, userId);
    return list;
  },
  async create(userId: string, input: CreateEvaluationInput): Promise<EvaluationDto> {
    let enrollmentId = input.enrollmentId ?? null;
    if (!enrollmentId) {
      const latest = listOf(await http.get(`${A}/enrollments`, { query: { userId } })).sort((a, b) => (str(b, 'assignedAtUtc', 'createdAtUtc') ?? '').localeCompare(str(a, 'assignedAtUtc', 'createdAtUtc') ?? ''))[0];
      enrollmentId = latest ? str(latest, 'id', 'enrollmentId') : null;
    }
    if (!enrollmentId) throw new ApiError('VALIDATION', 'evaluation.enrollmentRequired', { enrollmentId: ['evaluation.enrollmentRequired'] });
    const id = createdId(await http.post(`${A}/evaluations`, { enrollmentId, overallScore: total(input.categories), status: 'Submitted' }));
    await http.put(`${A}/evaluations/${id}`, { overallScore: total(input.categories), status: 'Submitted', evaluatedAtUtc: new Date(input.evaluatedAt).toISOString(), scores: scoresBody(input.categories) });
    owners.set(id, userId);
    return find(userId, id);
  },
  async update(evaluationId: string, input: UpdateEvaluationInput): Promise<EvaluationDto> {
    await http.put(`${A}/evaluations/${evaluationId}`, { overallScore: total(input.categories), status: 'Submitted', evaluatedAtUtc: new Date(input.evaluatedAt).toISOString(), scores: scoresBody(input.categories) });
    const userId = owners.get(evaluationId);
    if (!userId) {
      // Not read through this app yet: return what was saved.
      const saved = asRaw({ id: evaluationId, overallScore: total(input.categories), evaluatedAtUtc: input.evaluatedAt, scores: scoresBody(input.categories) });
      return toDto('', saved);
    }
    return find(userId, evaluationId);
  },
  async remove(evaluationId: string): Promise<void> {
    await http.delete(`${A}/evaluations/${evaluationId}`);
    owners.delete(evaluationId);
  },
};
