/** URLs of Users & Roles (`/users/*`). */
export const usersPaths = {
  users: '/users',
  user: (id: string) => `/users/accounts/${encodeURIComponent(id)}`,
  roles: '/users/roles',
  permissions: '/users/permissions',
};
