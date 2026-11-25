/**
 * Backend request paths. The host is `API_BASE_URL` in `core/config/api.ts`
 * (empty in development, so Vite proxies `/api` to `VITE_API_URL`).
 * Every API call builds its URL from this file.
 */

function segment(value: string): string {
  return encodeURIComponent(value);
}

export const apiPaths = {
  auth: {
    /** `POST` email + password. Returns the access token. */
    login: '/api/v1/auth/login',
    /** `GET` applications the signed-in user may open. Send the new token explicitly. */
    portals: '/api/v1/auth/portals',
    /** `POST` (anonymous) `{ token, newPassword }` → 204. Activates an invited account (single-use, expiring token). */
    activateInvitation: '/api/v1/auth/activate-invitation',
  },
  blogs: {
    /** `GET` published posts. Query: `pageNumber`, `pageSize`. */
    list: '/api/v1/blogs',
    /** `GET` one published post by its slug. */
    bySlug: (slug: string) => `/api/v1/blogs/${segment(slug)}`,
    /** `GET` every category. Create and update send these ids in `categoryIds`. */
    categories: '/api/v1/blogs/categories',
    /** `GET` every tag. Create and update send these ids in `tagIds`. */
    tags: '/api/v1/blogs/tags',
    admin: {
      /** `GET` every post (drafts included). Query: `pageNumber`, `pageSize`, optional `search`, `status`. */
      list: '/api/v1/admin/blogs',
      /** `GET` one post, `PUT` to replace it, `DELETE` to soft-delete it. */
      byId: (id: string) => `/api/v1/admin/blogs/${segment(id)}`,
      /** `POST` publish a draft. Body: `{ rowVersion }`. */
      publish: (id: string) => `/api/v1/admin/blogs/${segment(id)}/publish`,
      /** `POST` return a post to draft. Body: `{ rowVersion }`. */
      unpublish: (id: string) => `/api/v1/admin/blogs/${segment(id)}/unpublish`,
    },
  },
} as const;
