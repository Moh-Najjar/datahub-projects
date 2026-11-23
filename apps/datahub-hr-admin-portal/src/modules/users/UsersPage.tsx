import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ModuleTabs } from '@/modules/shared/ModuleTabs';
import { PageHeader } from '@/modules/shared/PageHeader';
import { PermissionMatrix } from '@/modules/users/components/PermissionMatrix';
import { RolesSection } from '@/modules/users/components/RolesSection';
import { UserDetails } from '@/modules/users/components/UserDetails';
import { UserDirectory } from '@/modules/users/components/UserDirectory';
import { usersPaths } from '@/modules/users/paths';

type Tab = 'users' | 'roles' | 'permissions';
const currentTab = (pathname: string): Tab => (pathname.startsWith(usersPaths.roles) ? 'roles' : pathname.startsWith(usersPaths.permissions) ? 'permissions' : 'users');

/**
 * Users & Roles (`/users/*`): one lazy-loaded page for `identity.users.manage` (System Administrator). Accounts, roles and the
 * permission matrix; the users API checks `identity.users.manage` on every call.
 */
export default function UsersPage() {
  const { t } = useTranslation('users');
  const { pathname } = useLocation();
  const tab = currentTab(pathname);
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Alert severity="info" sx={{ mb: 2.5 }}>
        {t('demoNotice')}
      </Alert>
      <ModuleTabs
        label={t('tabs.label')}
        value={tab}
        tabs={[
          { key: 'users', to: usersPaths.users, label: t('tabs.users') },
          { key: 'roles', to: usersPaths.roles, label: t('tabs.roles') },
          { key: 'permissions', to: usersPaths.permissions, label: t('tabs.permissions') },
        ]}
      />
      <Routes>
        <Route index element={<UserDirectory />} />
        <Route path="accounts/:userId" element={<UserDetails />} />
        <Route path="roles" element={<RolesSection />} />
        <Route path="permissions" element={<PermissionMatrix />} />
        <Route path="*" element={<Navigate to={usersPaths.users} replace />} />
      </Routes>
    </>
  );
}
