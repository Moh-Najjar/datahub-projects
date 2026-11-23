import { ApiError } from '@/core/api/types';
import { SAVED_LIMIT, SAVED_NAME_MAX, type ReportsCaller, type SavedReport, type SavedReportInput } from '@/modules/reports/types/reports';

/*
 * SIMULATED storage of saved report CONFIGURATIONS (name, report or builder settings, filters) — never results or
 * any HR data. In memory only (reset on reload); each configuration belongs to the user who saved it and is visible
 * only to them. Access to the report itself is re-checked by the reports API whenever it is saved or run.
 */

const NAME_MAX = SAVED_NAME_MAX;

interface Row extends SavedReport {
  ownerId: string;
}

let rows: Row[] = [];
let next = 1;

export function resetSavedReportsMock() {
  rows = [];
  next = 1;
}

const invalid = (fieldErrors: Record<string, string[]>) => {
  throw new ApiError('VALIDATION', 'Invalid saved report', fieldErrors);
};
const strip = ({ ownerId: _owner, ...report }: Row): SavedReport => report;

function checkName(name: string, ownerId: string, exceptId: string | null) {
  const trimmed = name.trim();
  if (!trimmed) invalid({ name: ['required'] });
  if (trimmed.length > NAME_MAX) invalid({ name: ['tooLong'] });
  if (rows.some((r) => r.ownerId === ownerId && r.id !== exceptId && r.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) invalid({ name: ['duplicate'] });
  return trimmed;
}

const owned = (id: string, caller: ReportsCaller) => {
  const row = rows.find((r) => r.id === id && r.ownerId === caller.userId);
  if (!row) throw new ApiError('NOT_FOUND', 'Saved report not found');
  return row;
};

export function listSaved(caller: ReportsCaller): SavedReport[] {
  return rows
    .filter((r) => r.ownerId === caller.userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
    .map(strip);
}

export function createSaved(input: SavedReportInput, caller: ReportsCaller): SavedReport {
  const name = checkName(input.name, caller.userId, null);
  if (rows.filter((r) => r.ownerId === caller.userId).length >= SAVED_LIMIT) invalid({ name: ['limit'] });
  const now = new Date().toISOString();
  const row: Row = { id: `srp-${String(next++).padStart(4, '0')}`, ownerId: caller.userId, name, kind: input.kind, reportId: input.reportId, filters: input.filters, builder: input.builder, createdAt: now, updatedAt: now };
  rows.push(row);
  return strip(row);
}

export function updateSaved(id: string, input: SavedReportInput, caller: ReportsCaller): SavedReport {
  const row = owned(id, caller);
  const name = checkName(input.name, caller.userId, id);
  Object.assign(row, { name, kind: input.kind, reportId: input.reportId, filters: input.filters, builder: input.builder, updatedAt: new Date().toISOString() });
  return strip(row);
}

export function deleteSaved(id: string, caller: ReportsCaller): void {
  const row = owned(id, caller);
  rows = rows.filter((r) => r !== row);
}

export function getSaved(id: string, caller: ReportsCaller): SavedReport {
  return strip(owned(id, caller));
}
