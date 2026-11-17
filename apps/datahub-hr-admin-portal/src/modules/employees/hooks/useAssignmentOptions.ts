import { useMemo } from 'react';
import { useLanguage } from '@/i18n/useLanguage';
import { useDepartmentOptions, useLocations, usePositions } from '@/modules/organization';

export interface AssignmentOption {
  value: string;
  label: string;
  depth?: number;
  /** Inactive records are listed (so a saved assignment stays visible) but selectable only when already saved. */
  active: boolean;
  disabled: boolean;
}

interface Current {
  departmentId?: string;
  positionId?: string;
  locationId?: string;
  reportingDepartmentId?: string;
}

/**
 * Department, position and location options for the employee form — read from the Organization Management API
 * (nothing is duplicated here). New assignments may only use ACTIVE records; the employee's saved values stay
 * selectable so editing other fields never forces a change. Positions are those of the selected department.
 */
export function useAssignmentOptions(selectedDepartmentId: string, current: Current = {}) {
  const { language } = useLanguage();
  const departments = useDepartmentOptions({ keep: current.departmentId ?? null });
  const reporting = useDepartmentOptions({ keep: current.reportingDepartmentId ?? null });
  const positions = usePositions(
    { page: 1, pageSize: 100, sortBy: `title.${language}`, sortDirection: 'asc', filters: { departmentId: selectedDepartmentId } },
    Boolean(selectedDepartmentId),
  );
  const locations = useLocations({ page: 1, pageSize: 100, sortBy: `name.${language}`, sortDirection: 'asc' });

  const positionOptions = useMemo<AssignmentOption[]>(
    () =>
      (positions.data?.items ?? [])
        // The organization filter includes subdepartments; an employee's position must belong to the department itself.
        .filter((p) => p.department.id === selectedDepartmentId)
        .map((p) => ({ value: p.id, label: p.title[language], active: p.status === 'active', disabled: p.status !== 'active' && p.id !== current.positionId })),
    [positions.data, selectedDepartmentId, language, current.positionId],
  );
  const locationOptions = useMemo<AssignmentOption[]>(
    () => (locations.data?.items ?? []).map((l) => ({ value: l.id, label: l.name[language], active: l.status === 'active', disabled: l.status !== 'active' && l.id !== current.locationId })),
    [locations.data, language, current.locationId],
  );

  return {
    departments: departments.options,
    reportingDepartments: reporting.options,
    positions: positionOptions,
    positionsLoading: Boolean(selectedDepartmentId) && positions.isFetching,
    locations: locationOptions,
  };
}
