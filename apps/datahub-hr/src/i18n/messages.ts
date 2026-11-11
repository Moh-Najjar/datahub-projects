import type { Locale, Localized } from '@datahub/shared-types';

/** UI strings for DataHubHR. Every key must exist in both languages (enforced by `Localized`). */
export interface Messages {
  organizationName: string;
}

export const MESSAGES: Localized<Messages> = {
  en: { organizationName: 'Datahub Analytics' },
  ar: { organizationName: 'داتا هب أناليتكس' },
};

export const getMessages = (locale: Locale): Messages => MESSAGES[locale];
