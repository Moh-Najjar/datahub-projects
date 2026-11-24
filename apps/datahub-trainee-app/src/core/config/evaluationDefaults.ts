/** Scoring rules of the original Training Portal — preserved exactly. */
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
/** Initial score of every category in a new evaluation form. */
export const DEFAULT_SCORE = 5;

export interface EvaluationCategoryTemplate {
  categoryName: string;
  criteria: string;
}

/**
 * The ten default evaluation categories of the original Training Portal (verbatim). The UI shows them from the
 * translations (`evaluations.defaults`); this list seeds the simulated data.
 */
export const DEFAULT_EVALUATION_CATEGORIES: readonly EvaluationCategoryTemplate[] = [
  { categoryName: 'Presentation Skills', criteria: 'Clarity of explanations' },
  {
    categoryName: 'Technical Understanding',
    criteria: 'Demonstrates understanding of data engineering concepts, architecture, SQL, ETL, Python, data modeling.',
  },
  {
    categoryName: 'Ownership & Accountability',
    criteria: 'Takes responsibility for assigned tasks; follows through to completion; communicates blockers promptly',
  },
  { categoryName: 'Time Management', criteria: 'Delivers demos within allocated time and meets deadlines.' },
  { categoryName: 'English Fluency (Verbal)', criteria: 'Smooth speech and good vocabulary.' },
  {
    categoryName: 'AI Usage Ethics',
    criteria: 'Uses AI to accelerate work, not replace thinking; explains AI-generated code; debugs manually',
  },
  {
    categoryName: 'Receptiveness to Feedback',
    criteria: 'Accepts criticism without defensiveness; applies feedback consistently in future work.',
  },
  { categoryName: 'Going Beyond Expectations', criteria: 'Delivers bonus work unasked' },
  { categoryName: 'Documentation Quality', criteria: 'Produces clear technical documentation/Solution' },
  {
    categoryName: 'Curiosity & Continuous Learning',
    criteria: 'Actively explores topics beyond assigned work; asks insightful questions;',
  },
];
