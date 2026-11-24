import { createdId, http } from '@/core/api/http';
import { queryCollection } from '@/core/api/listing';
import { asRaw, listOf, str, type Raw } from '@/core/api/read';
import type { ListParams, Paginated } from '@/core/api/types';
import type { DepartmentDto, DepartmentFilters, DepartmentInput, DepartmentOption } from '../types/department';

/*
 * Departments on the real backend: the shared Organization API (`/api/v1/organization/departments`, also used by HR).
 * It has no counts of users / trainings per department (shown as unknown) and no paging (done here).
 * Create needs a `code` (derived from the name); update needs the record's `rowVersion` (read first).
 */

const BASE = '/api/v1/organization/departments';

function toDto(o: Raw): DepartmentDto {
  return { id: str(o, 'id') ?? '', name: str(o, 'name', 'nameEn') ?? '', userCount: null, trainingCount: null };
}

/** Upper-case code from the name (`Data Engineering` → `DATA-ENGINEERING`), as the backend requires one. */
const codeOf = (name: string) => name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'DEPT';

const all = async (signal?: AbortSignal) => listOf(await http.get(BASE, { query: { includeInactive: false }, signal })).map(toDto);

export const departmentsHttpApi = {
  async list(params: ListParams<DepartmentFilters>, signal?: AbortSignal): Promise<Paginated<DepartmentDto>> {
    return queryCollection(await all(signal), params, { searchFields: (d) => [d.name], sorters: { name: (a, b) => a.name.localeCompare(b.name) }, defaultSort: (a, b) => a.name.localeCompare(b.name) });
  },
  async options(signal?: AbortSignal): Promise<DepartmentOption[]> {
    return (await all(signal)).map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name));
  },
  async create(input: DepartmentInput): Promise<DepartmentDto> {
    const id = createdId(await http.post(BASE, { code: codeOf(input.name), name: input.name.trim() }));
    return toDto(asRaw(await http.get(`${BASE}/${id}`)));
  },
  async update(id: string, input: DepartmentInput): Promise<DepartmentDto> {
    const current = asRaw(await http.get(`${BASE}/${id}`));
    await http.put(`${BASE}/${id}`, { code: str(current, 'code') ?? codeOf(input.name), name: input.name.trim(), nameAr: str(current, 'nameAr'), parentDepartmentId: str(current, 'parentDepartmentId'), rowVersion: str(current, 'rowVersion') });
    return toDto(asRaw(await http.get(`${BASE}/${id}`)));
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};
