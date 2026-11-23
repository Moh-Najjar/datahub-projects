import { hasPermission, useWorkspaceSession } from '@/modules/portals';

/** The backend's blog permissions (access-token claims). */
export const BLOG_PERMISSIONS = {
  view: 'cms.blogs.view',
  create: 'cms.blogs.create',
  update: 'cms.blogs.update',
  delete: 'cms.blogs.delete',
  publish: 'cms.blogs.publish',
} as const;

export type BlogPermissions = Record<keyof typeof BLOG_PERMISSIONS, boolean>;

/**
 * What the signed-in user may do in Blogs Admin, from the backend's permissions. It only decides what the screens
 * offer: the backend authorises every request itself (403 otherwise).
 */
export function useBlogPermissions(): BlogPermissions {
  const session = useWorkspaceSession();
  return {
    view: hasPermission(session, BLOG_PERMISSIONS.view),
    create: hasPermission(session, BLOG_PERMISSIONS.create),
    update: hasPermission(session, BLOG_PERMISSIONS.update),
    delete: hasPermission(session, BLOG_PERMISSIONS.delete),
    publish: hasPermission(session, BLOG_PERMISSIONS.publish),
  };
}
