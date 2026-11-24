export interface DepartmentDto {
  id: string;
  name: string;
  /** `null` = unknown (the real backend has no per-department counts). */
  userCount: number | null;
  trainingCount: number | null;
}

export interface DepartmentInput {
  name: string;
}

/** Id + name, for selects and filters in other modules. */
export interface DepartmentOption {
  id: string;
  name: string;
}

/** The departments list has no filters (search and sort only). */
export type DepartmentFilters = Record<string, never>;
