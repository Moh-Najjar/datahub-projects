import { MAX_SCORE } from '@/core/config/evaluationDefaults';

/*
 * Evaluation scoring and ranking rules of the original Training Portal — preserved exactly (not reinvented):
 *  - every category is scored 1–10; an evaluation's total is the SUM of its category scores;
 *  - its maximum is (number of categories × 10);
 *  - a person's ranking uses their MOST RECENT evaluation (by evaluation date);
 *  - order: people with an evaluation first, then higher latest TOTAL first (the raw sum, not a percentage),
 *    then by name.
 */

export const evaluationTotal = (categories: readonly { score: number }[]): number => categories.reduce((sum, c) => sum + c.score, 0);

export const evaluationMaxTotal = (categories: readonly unknown[]): number => categories.length * MAX_SCORE;

export interface RankableEntry {
  userName: string;
  latestTotal: number | null;
}

/** The original ordering: evaluated first → latest total (desc) → name (asc). */
export function compareRanking(a: RankableEntry, b: RankableEntry): number {
  const aHas = a.latestTotal !== null;
  const bHas = b.latestTotal !== null;
  if (aHas !== bHas) return aHas ? -1 : 1;
  if (aHas && bHas && a.latestTotal !== b.latestTotal) return (b.latestTotal as number) - (a.latestTotal as number);
  return a.userName.localeCompare(b.userName);
}

/** The latest evaluation (by `evaluatedAt`) of a list, or undefined. */
export function latestEvaluation<T extends { evaluatedAt: string }>(evaluations: readonly T[]): T | undefined {
  return [...evaluations].sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt))[0];
}
