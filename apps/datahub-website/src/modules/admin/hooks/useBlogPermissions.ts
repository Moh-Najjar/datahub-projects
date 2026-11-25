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
/** The backend's permissions for the contact inquiries (CRM). */
export const INQUIRY_PERMISSIONS = { view: 'crm.inquiries.view', manage: 'crm.inquiries.manage' } as const;

/** May the signed-in user read the website's contact inquiries? (The backend authorises the request itself.) */
export function useCanViewInquiries(): boolean {
  const session = useWorkspaceSession();
  return hasPermission(session, INQUIRY_PERMISSIONS.view) || hasPermission(session, INQUIRY_PERMISSIONS.manage);
}

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
