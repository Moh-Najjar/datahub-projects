import { useAuth } from '@/core/context/authContext';
import type { SettingsCategory } from '@/modules/settings/types/settings';

/**
 * What the signed-in role may do in System Settings (existing permissions only — no new permission):
 * - `hr.settings.manage` (System Administrator, HR Administrator) → every settings page;
 * - sign-in & session settings and the demo reset also need `identity.users.manage` (System Administrator);
 * - module summaries show figures only with that module's read permission (payroll: `hr.payroll.view`).
 * UI only — the settings API applies the same rules on every call.
 */
export function useSettingsAccess() {
  const { can } = useAuth();
  const manage = can('hr.settings.manage');
  const system = manage && can('identity.users.manage');
  const visible = (category: SettingsCategory): boolean => {
    if (!manage) return false;
    if (category === 'payroll') return can('hr.payroll.view');
    return true;
  };
  return { manage, system, visible, canEditSecurity: system, canResetAll: system };
}
