import { navItem } from '@/core/routes/navigation';

/** URLs inside Performance (the base path comes from the navigation map). */
const base = navItem('performance').path;
const id = (value: string) => encodeURIComponent(value);

export const performancePaths = {
  overview: base,
  my: `${base}/my`,
  reviews: `${base}/reviews`,
  review: (reviewId: string) => `${base}/reviews/${id(reviewId)}`,
  goals: `${base}/goals`,
  cycles: `${base}/cycles`,
  cycle: (cycleId: string) => `${base}/cycles/${id(cycleId)}`,
  development: `${base}/development`,
  plan: (planId: string) => `${base}/development/${id(planId)}`,
  competencies: `${base}/competencies`,
};
