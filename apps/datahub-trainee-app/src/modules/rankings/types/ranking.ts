import type { Role } from '@/core/domain/training';

export interface RankingEntryDto {
  /** Position among everyone ranked in the caller's scope (1 = best); null while the person has no evaluation. */
  position: number | null;
  userId: string;
  userName: string;
  role: Role;
  departmentId: string | null;
  departmentName: string | null;
  /** Sum of the scores of the person's MOST RECENT evaluation. */
  latestTotal: number | null;
  /** That evaluation's maximum (categories × 10). */
  latestMaxTotal: number | null;
  latestEvaluatedAt: string | null;
  evaluationCount: number;
}

export interface RankingFilters {
  departmentId: string;
  role: Role;
}
