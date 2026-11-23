import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { useAuth } from '@/core/context/authContext';
import { settingsApi } from '@/modules/settings/api/settingsApi';
import type { AuditFilters, Holiday, HolidayFilters, HolidayInput, SettingsCaller, SettingsSection, SettingsValues } from '@/modules/settings/types/settings';

/*
 * Server state of System Settings. Keys hold the caller (user + role) so nothing is shared across users; every write
 * invalidates `['settings']` (values, overview, audit) and, for the holiday calendar, `['leave']` (leave quotes and the
 * leave calendar count days with it).
 */

export const settingsKeys = {
  all: ['settings'] as const,
  overview: (c: SettingsCaller) => ['settings', 'overview', c.userId, c.role] as const,
  section: (c: SettingsCaller, s: SettingsSection) => ['settings', 'section', c.userId, c.role, s] as const,
  workingWeek: () => ['settings', 'working-week'] as const,
  security: (c: SettingsCaller) => ['settings', 'security-status', c.userId, c.role] as const,
  holidays: (c: SettingsCaller, p: ListParams<HolidayFilters>) => ['settings', 'holidays', c.userId, c.role, p] as const,
  audit: (c: SettingsCaller, p: ListParams<AuditFilters>) => ['settings', 'audit', c.userId, c.role, p] as const,
};

export function useSettingsCaller(): SettingsCaller {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const role = user?.role ?? 'employee';
  const en = user?.name.en ?? '';
  const ar = user?.name.ar ?? '';
  return useMemo(() => ({ userId, role, name: { en, ar } }), [userId, role, en, ar]);
}

export function useSettingsOverview() {
  const caller = useSettingsCaller();
  return useQuery({ queryKey: settingsKeys.overview(caller), queryFn: ({ signal }) => settingsApi.getSettingsOverview(caller, signal) });
}

export function useSettingsSection<S extends SettingsSection>(section: S, enabled = true) {
  const caller = useSettingsCaller();
  return useQuery({ queryKey: settingsKeys.section(caller, section), queryFn: ({ signal }) => settingsApi.getSettings(section, caller, signal), enabled });
}

/** The organisation's working week (every signed-in role; Attendance uses it as the default of new shifts). */
export function useWorkingWeek(enabled = true) {
  return useQuery({ queryKey: settingsKeys.workingWeek(), queryFn: ({ signal }) => settingsApi.getWorkingWeek(signal), enabled, staleTime: 5 * 60_000 });
}

export function useSecurityStatus() {
  const caller = useSettingsCaller();
  return useQuery({ queryKey: settingsKeys.security(caller), queryFn: ({ signal }) => settingsApi.getSecurityStatus(caller, signal) });
}

export function useHolidays(params: ListParams<HolidayFilters>) {
  const caller = useSettingsCaller();
  return useQuery({ queryKey: settingsKeys.holidays(caller, params), queryFn: ({ signal }) => settingsApi.getHolidays(params, caller, signal), placeholderData: keepPreviousData });
}

export function useAuditLog(params: ListParams<AuditFilters>, enabled = true) {
  const caller = useSettingsCaller();
  return useQuery({ queryKey: settingsKeys.audit(caller, params), queryFn: ({ signal }) => settingsApi.getAuditLog(params, caller, signal), placeholderData: keepPreviousData, enabled });
}

function useInvalidate() {
  const client = useQueryClient();
  return (alsoLeave = false) => Promise.all([client.invalidateQueries({ queryKey: settingsKeys.all }), alsoLeave ? client.invalidateQueries({ queryKey: ['leave'] }) : null]);
}

export function useUpdateSettings<S extends SettingsSection>(section: S) {
  const caller = useSettingsCaller();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ values, reason }: { values: SettingsValues[S]; reason: string }) => settingsApi.updateSettings(section, values, reason, caller),
    onSuccess: () => invalidate(),
  });
}

export function useResetSettings<S extends SettingsSection>(section: S) {
  const caller = useSettingsCaller();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (reason: string) => settingsApi.resetSettings(section, reason, caller), onSuccess: () => invalidate() });
}

export function useResetAllSettings() {
  const caller = useSettingsCaller();
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (reason: string) => settingsApi.resetAllSettings(reason, caller), onSuccess: () => invalidate(true) });
}

export function useSaveHoliday() {
  const caller = useSettingsCaller();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input, reason }: { id: string | null; input: HolidayInput; reason: string }) => (id ? settingsApi.updateHoliday(id, input, reason, caller) : settingsApi.createHoliday(input, reason, caller)),
    onSuccess: () => invalidate(true),
  });
}

export function useHolidayStatus() {
  const caller = useSettingsCaller();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: Holiday['status']; reason: string }) => settingsApi.updateHolidayStatus(id, status, reason, caller),
    onSuccess: () => invalidate(true),
  });
}
