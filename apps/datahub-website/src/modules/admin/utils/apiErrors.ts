import { isAdminBlogNotFound, isBlogConflict, isForbidden, isInvalidTaxonomy, isNetworkError, isSignInRequired } from '@/core/hooks/useAdminBlogs';
import { ADMIN_TEXT } from '@/modules/admin/data/adminText';

const V = ADMIN_TEXT.validation;

/** A short, actionable message for a failed Blogs Admin request. */
export function adminErrorMessage(error: unknown): string {
  if (isSignInRequired(error)) return V.signInRequired;
  if (isForbidden(error)) return V.forbidden;
  if (isBlogConflict(error)) return V.conflict;
  if (isInvalidTaxonomy(error)) return V.invalidTaxonomy;
  if (isAdminBlogNotFound(error)) return V.notFound;
  if (isNetworkError(error)) return V.network;
  return V.generic;
}
