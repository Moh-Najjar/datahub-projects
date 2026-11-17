import { navItem } from '@/core/routes/navigation';

/** URLs inside Employee Management (the base path comes from the navigation map). */
const base = navItem('employees').path;

export const employeePaths = {
  directory: base,
  create: `${base}/new`,
  profile: (id: string) => `${base}/${encodeURIComponent(id)}`,
  edit: (id: string) => `${base}/${encodeURIComponent(id)}/edit`,
};
