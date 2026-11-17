import { navItem } from '@/core/routes/navigation';

/** URLs inside Organization Management (the base path comes from the navigation map). */
const base = navItem('organization').path;

export const orgPaths = {
  overview: base,
  departments: `${base}/departments`,
  department: (id: string) => `${base}/departments/${encodeURIComponent(id)}`,
  positions: `${base}/positions`,
  locations: `${base}/locations`,
  location: (id: string) => `${base}/locations/${encodeURIComponent(id)}`,
  hierarchy: `${base}/hierarchy`,
};
