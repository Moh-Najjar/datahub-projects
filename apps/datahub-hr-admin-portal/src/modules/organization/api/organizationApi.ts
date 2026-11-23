import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/organization/mock/organizationMock';
import type {
  Department,
  DepartmentFilters,
  DepartmentInput,
  HierarchyNode,
  Location,
  LocationFilters,
  LocationInput,
  ManagerOption,
  OrganizationSummary,
  Position,
  PositionFilters,
  PositionInput,
  RecordStatus,
} from '@/modules/organization/types/organization';

/*
 * Organization API service — the ONLY entry point to organization data. Today every call runs against the
 * SIMULATED backend (`mock/`); with the .NET backend each body becomes an HTTP call returning the same types
 * (the backend contract is not defined yet, so no URLs are invented here).
 *
 * Every write must be authorized server-side (`organization.departments.manage`); hiding buttons in the UI is not security.
 * Failures are `ApiError`s: `NOT_FOUND`, and `VALIDATION` with `fieldErrors` (e.g. `{ code: ['duplicate'] }`).
 */

type Signal = AbortSignal | undefined;

export const organizationApi = {
  getOrganizationSummary: (signal?: Signal): Promise<OrganizationSummary> => mockRequest(() => mock.summary(), { signal }),

  /* Departments */
  getDepartments: (params: ListParams<DepartmentFilters>, signal?: Signal): Promise<Paginated<Department>> =>
    mockRequest(() => mock.listDepartments(params), { signal }),
  getDepartmentById: (id: string, signal?: Signal): Promise<Department> => mockRequest(() => mock.getDepartment(id), { signal }),
  /** Every unit (flat, any status) — for the hierarchy view and the parent selector. */
  getDepartmentHierarchy: (signal?: Signal): Promise<HierarchyNode[]> => mockRequest(() => mock.departmentHierarchy(), { signal }),
  createDepartment: (input: DepartmentInput): Promise<Department> => mockRequest(() => mock.createDepartment(input)),
  updateDepartment: (id: string, input: DepartmentInput): Promise<Department> => mockRequest(() => mock.updateDepartment(id, input)),
  updateDepartmentStatus: (id: string, status: RecordStatus): Promise<Department> => mockRequest(() => mock.updateDepartmentStatus(id, status)),

  /* Positions */
  getPositions: (params: ListParams<PositionFilters>, signal?: Signal): Promise<Paginated<Position>> =>
    mockRequest(() => mock.listPositions(params), { signal }),
  getPositionById: (id: string, signal?: Signal): Promise<Position> => mockRequest(() => mock.getPosition(id), { signal }),
  createPosition: (input: PositionInput): Promise<Position> => mockRequest(() => mock.createPosition(input)),
  updatePosition: (id: string, input: PositionInput): Promise<Position> => mockRequest(() => mock.updatePosition(id, input)),
  updatePositionStatus: (id: string, status: RecordStatus): Promise<Position> => mockRequest(() => mock.updatePositionStatus(id, status)),

  /* Locations */
  getLocations: (params: ListParams<LocationFilters>, signal?: Signal): Promise<Paginated<Location>> =>
    mockRequest(() => mock.listLocations(params), { signal }),
  getLocationById: (id: string, signal?: Signal): Promise<Location> => mockRequest(() => mock.getLocation(id), { signal }),
  createLocation: (input: LocationInput): Promise<Location> => mockRequest(() => mock.createLocation(input)),
  updateLocation: (id: string, input: LocationInput): Promise<Location> => mockRequest(() => mock.updateLocation(id, input)),
  updateLocationStatus: (id: string, status: RecordStatus): Promise<Location> => mockRequest(() => mock.updateLocationStatus(id, status)),

  /** INTERIM people lookup for "department manager" until Employee Management provides the employees API. */
  getManagerOptions: (search: string, signal?: Signal): Promise<ManagerOption[]> => mockRequest(() => mock.managerOptions(search), { signal }),
};
