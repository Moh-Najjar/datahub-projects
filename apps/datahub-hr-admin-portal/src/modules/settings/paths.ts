import type { SettingsCategory } from '@/modules/settings/types/settings';

/** URLs of System Settings (`/settings/*`). */
export const settingsPaths = {
  overview: '/settings',
  category: (c: SettingsCategory) => `/settings/${c}`,
};
