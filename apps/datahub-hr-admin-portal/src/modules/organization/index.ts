/*
 * Public API of Organization Management for other modules (pure re-exports). Employee Management uses it for
 * department / position / location options, query keys to refresh after employee changes, country names and
 * links to department pages — organization data is never duplicated elsewhere.
 */
export { organizationKeys, useDepartmentHierarchy, useLocations, usePositions } from './hooks/useOrganization';
export { useDepartmentOptions, type DepartmentOption } from './hooks/useDepartmentOptions';
export { countryName, LOCATION_COUNTRIES } from './utils/countries';
export { orgPaths } from './paths';
export type { Location, Position, RecordStatus } from './types/organization';
/** For Reports & Analytics: the department hierarchy and locations (names, top-level departments). */
export { organizationApi } from './api/organizationApi';
export type { HierarchyNode } from './types/organization';
