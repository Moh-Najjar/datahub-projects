export interface EvaluationCategoryDto {
  id: string;
  categoryName: string;
  criteria: string;
  /** 1–10. */
  score: number;
}

export interface EvaluationDto {
  id: string;
  userId: string;
  userName: string;
  evaluatedByUserId: string;
  evaluatedByUserName: string | null;
  enrollmentId: string | null;
  trainingId: string | null;
  trainingTitle: string | null;
  /** The enrollment's training department, else the person's own department. */
  departmentName: string | null;
  evaluatedAt: string;
  /** Sum of the category scores. */
  total: number;
  /** Number of categories × 10. */
  maxTotal: number;
  createdAt: string;
  updatedAt: string | null;
  categories: EvaluationCategoryDto[];
}

export interface EvaluationCategoryInput {
  categoryName: string;
  criteria: string;
  score: number;
}

export interface CreateEvaluationInput {
  /** Optional: one of the person's enrollments. */
  enrollmentId?: string | null;
  evaluatedAt: string;
  categories: EvaluationCategoryInput[];
}

export interface UpdateEvaluationInput {
  evaluatedAt: string;
  categories: EvaluationCategoryInput[];
}
