import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { organizationApi } from '@/modules/organization/api/organizationApi';
import type {
  DepartmentFilters,
  DepartmentInput,
  LocationFilters,
  LocationInput,
  PositionFilters,
  PositionInput,
  RecordStatus,
} from '@/modules/organization/types/organization';

/**
 * Query keys: `['organization', <resource>, …]`. Invalidating a resource prefix (e.g. `departments()`)
 * refreshes its lists, details and hierarchy together.
 */
export const organizationKeys = {
  all: ['organization'] as const,
  summary: () => [...organizationKeys.all, 'summary'] as const,
  departments: () => [...organizationKeys.all, 'departments'] as const,
  departmentList: (params: ListParams<DepartmentFilters>) => [...organizationKeys.departments(), 'list', params] as const,
  department: (id: string) => [...organizationKeys.departments(), 'detail', id] as const,
  hierarchy: () => [...organizationKeys.departments(), 'hierarchy'] as const,
  positions: () => [...organizationKeys.all, 'positions'] as const,
  positionList: (params: ListParams<PositionFilters>) => [...organizationKeys.positions(), 'list', params] as const,
  position: (id: string) => [...organizationKeys.positions(), 'detail', id] as const,
  locations: () => [...organizationKeys.all, 'locations'] as const,
  locationList: (params: ListParams<LocationFilters>) => [...organizationKeys.locations(), 'list', params] as const,
  location: (id: string) => [...organizationKeys.locations(), 'detail', id] as const,
  managers: (search: string) => [...organizationKeys.all, 'managers', search] as const,
};

/* Queries ---------------------------------------------------------------------------------------- */

export function useOrganizationSummary() {
  return useQuery({ queryKey: organizationKeys.summary(), queryFn: ({ signal }) => organizationApi.getOrganizationSummary(signal) });
}

/** Lists keep showing the previous page while the next one loads (no flicker when paging/sorting). */
export function useDepartments(params: ListParams<DepartmentFilters>) {
  return useQuery({ queryKey: organizationKeys.departmentList(params), queryFn: ({ signal }) => organizationApi.getDepartments(params, signal), placeholderData: keepPreviousData });
}

export function useDepartment(id: string) {
  return useQuery({ queryKey: organizationKeys.department(id), queryFn: ({ signal }) => organizationApi.getDepartmentById(id, signal) });
}

export function useDepartmentHierarchy(enabled = true) {
  return useQuery({ queryKey: organizationKeys.hierarchy(), queryFn: ({ signal }) => organizationApi.getDepartmentHierarchy(signal), enabled });
}

export function usePositions(params: ListParams<PositionFilters>, enabled = true) {
  return useQuery({ queryKey: organizationKeys.positionList(params), queryFn: ({ signal }) => organizationApi.getPositions(params, signal), placeholderData: keepPreviousData, enabled });
}

export function useLocations(params: ListParams<LocationFilters>, enabled = true) {
  return useQuery({ queryKey: organizationKeys.locationList(params), queryFn: ({ signal }) => organizationApi.getLocations(params, signal), placeholderData: keepPreviousData, enabled });
}

export function useLocation(id: string) {
  return useQuery({ queryKey: organizationKeys.location(id), queryFn: ({ signal }) => organizationApi.getLocationById(id, signal) });
}

/** Interim manager lookup (see `organizationApi.getManagerOptions`). */
export function useManagerOptions(search: string, enabled = true) {
  return useQuery({ queryKey: organizationKeys.managers(search), queryFn: ({ signal }) => organizationApi.getManagerOptions(search, signal), enabled, staleTime: 5 * 60_000 });
}

/* Mutations -------------------------------------------------------------------------------------- */

function invalidate(client: QueryClient, keys: readonly QueryKey[]) {
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

/** What a department change makes stale: departments (lists, details, hierarchy), positions (they show department names) and the overview. */
const DEPARTMENT_DEPENDENTS = [organizationKeys.departments(), organizationKeys.positions(), organizationKeys.summary()];
const POSITION_DEPENDENTS = [organizationKeys.positions(), organizationKeys.summary()];
const LOCATION_DEPENDENTS = [organizationKeys.locations(), organizationKeys.summary()];

export function useCreateDepartment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: DepartmentInput) => organizationApi.createDepartment(input),
    onSuccess: () => invalidate(client, DEPARTMENT_DEPENDENTS),
  });
}

export function useUpdateDepartment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DepartmentInput }) => organizationApi.updateDepartment(id, input),
    onSuccess: (department) => {
      client.setQueryData(organizationKeys.department(department.id), department);
      return invalidate(client, DEPARTMENT_DEPENDENTS);
    },
  });
}

export function useUpdateDepartmentStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) => organizationApi.updateDepartmentStatus(id, status),
    onSuccess: (department) => {
      client.setQueryData(organizationKeys.department(department.id), department);
      return invalidate(client, DEPARTMENT_DEPENDENTS);
    },
  });
}

export function useCreatePosition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: PositionInput) => organizationApi.createPosition(input),
    onSuccess: () => invalidate(client, POSITION_DEPENDENTS),
  });
}

export function useUpdatePosition() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PositionInput }) => organizationApi.updatePosition(id, input),
    onSuccess: () => invalidate(client, POSITION_DEPENDENTS),
  });
}

export function useUpdatePositionStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) => organizationApi.updatePositionStatus(id, status),
    onSuccess: () => invalidate(client, POSITION_DEPENDENTS),
  });
}

export function useCreateLocation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationInput) => organizationApi.createLocation(input),
    onSuccess: () => invalidate(client, LOCATION_DEPENDENTS),
  });
}

export function useUpdateLocation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LocationInput }) => organizationApi.updateLocation(id, input),
    onSuccess: (location) => {
      client.setQueryData(organizationKeys.location(location.id), location);
      return invalidate(client, LOCATION_DEPENDENTS);
    },
  });
}

export function useUpdateLocationStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordStatus }) => organizationApi.updateLocationStatus(id, status),
    onSuccess: (location) => {
      client.setQueryData(organizationKeys.location(location.id), location);
      return invalidate(client, LOCATION_DEPENDENTS);
    },
  });
}
