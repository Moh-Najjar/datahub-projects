import type enAuth from './locales/en/auth.json';
import type enCommon from './locales/en/common.json';
import type enDashboard from './locales/en/dashboard.json';

/** Type-checked translation keys: `t('nav.items.dashboard')` compiles, a typo does not. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      auth: typeof enAuth;
      dashboard: typeof enDashboard;
    };
  }
}
