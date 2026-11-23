import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/settings/mock/settingsMock';
import type {
  AuditEntry,
  AuditFilters,
  Holiday,
  HolidayFilters,
  HolidayInput,
  SecurityStatus,
  SettingsCaller,
  SettingsDocument,
  SettingsOverview,
  SettingsSection,
  SettingsValues,
} from '@/modules/settings/types/settings';

/*
 * System Settings API service — the module's only data entry point (MOCK: in-memory, validated and audited by
 * `mock/settingsMock.ts`). The real backend keeps the same contract; it derives the caller from the token.
 */

type Signal = AbortSignal | undefined;

export const settingsApi = {
  getSettingsOverview: (caller: SettingsCaller, signal?: Signal): Promise<SettingsOverview> => mockRequest(() => mock.overview(caller), { signal }),
  getSettings: <S extends SettingsSection>(section: S, caller: SettingsCaller, signal?: Signal): Promise<SettingsDocument<S>> => mockRequest(() => mock.getSection(section, caller), { signal }),
  updateSettings: <S extends SettingsSection>(section: S, values: SettingsValues[S], reason: string, caller: SettingsCaller): Promise<SettingsDocument<S>> => mockRequest(() => mock.updateSection(section, values, reason, caller)),
  resetSettings: <S extends SettingsSection>(section: S, reason: string, caller: SettingsCaller): Promise<SettingsDocument<S>> => mockRequest(() => mock.resetSection(section, reason, caller)),
  /** Demo reset of every settings section and the holiday calendar (no other data is touched). */
  resetAllSettings: (reason: string, caller: SettingsCaller): Promise<{ sections: number; holidays: number }> => mockRequest(() => mock.resetAllSettings(reason, caller)),
  /** The organisation's working week (any signed-in role: new shifts start with it). */
  getWorkingWeek: (signal?: Signal): Promise<SettingsValues['workingWeek']> => mockRequest(() => mock.workingWeek(), { signal }),
  getSecurityStatus: (caller: SettingsCaller, signal?: Signal): Promise<SecurityStatus> => mockRequest(() => mock.securityStatus(caller), { signal }),

  getHolidays: (params: ListParams<HolidayFilters>, caller: SettingsCaller, signal?: Signal): Promise<Paginated<Holiday>> => mockRequest(() => mock.listHolidays(params, caller), { signal }),
  createHoliday: (input: HolidayInput, reason: string, caller: SettingsCaller): Promise<Holiday> => mockRequest(() => mock.createHoliday(input, reason, caller)),
  updateHoliday: (id: string, input: HolidayInput, reason: string, caller: SettingsCaller): Promise<Holiday> => mockRequest(() => mock.updateHoliday(id, input, reason, caller)),
  updateHolidayStatus: (id: string, status: Holiday['status'], reason: string, caller: SettingsCaller): Promise<Holiday> => mockRequest(() => mock.updateHolidayStatus(id, status, reason, caller)),

  getAuditLog: (params: ListParams<AuditFilters>, caller: SettingsCaller, signal?: Signal): Promise<Paginated<AuditEntry>> => mockRequest(() => mock.listAudit(params, caller), { signal }),
};
