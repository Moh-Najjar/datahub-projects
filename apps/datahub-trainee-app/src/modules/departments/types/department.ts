export interface DepartmentDto {
  id: string;
  name: string;
  userCount: number;
  trainingCount: number;
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
