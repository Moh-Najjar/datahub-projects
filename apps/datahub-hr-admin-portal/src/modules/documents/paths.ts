import { navItem } from '@/core/routes/navigation';

/** URLs inside Documents (the base path comes from the navigation map). */
const base = navItem('documents').path;
const id = (value: string) => encodeURIComponent(value);

export const documentPaths = {
  overview: base,
  directory: `${base}/directory`,
  /** Directory pre-filtered by a search term (e.g. a leave request number). */
  search: (term: string) => `${base}/directory?search=${id(term)}`,
  document: (documentId: string) => `${base}/directory/${id(documentId)}`,
  expiry: `${base}/expiry`,
  required: `${base}/required`,
  categories: `${base}/categories`,
  my: `${base}/my`,
};
