import { Navigate, useParams } from 'react-router-dom';

/** Blog posts exist in English only: `/ar/<slug>/` → `/<slug>/`. */
export function ArabicPostRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/${slug ?? ''}/`} replace />;
}
