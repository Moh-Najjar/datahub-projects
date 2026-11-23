import type { Localized } from '@datahub/shared-types';
import { createMockStore } from '@/core/api/mock/store';
import { hash, initialShiftId, prng, SHIFT_SEED } from '@/modules/attendance/mock/seed';
import { employeeRecords } from '@/modules/employees/mock/employeesMock';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import type { LeaveDocument, LeaveHistoryEntry, LeaveStatus, LeaveType, NamedRef } from '@/modules/leave/types/leave';
import { addDays, allocationFor, countLeaveDays, datesBetween, overlaps } from '@/modules/leave/utils/rules';
import { settingsData } from '@/modules/settings/mock/settingsMock';
import { LEAVE_TYPE_SEED, SEED_REJECTION_REASONS } from './seed';

/*
 * The leave DATA of the simulated backend (lowest layer): leave types, requests and the "approved leave on a date"
 * index. Attendance reads `leaveData.approvedOn()` so approved leave shows as "On leave" there — this file must never
 * import the attendance mock (only its pure seed), which keeps the dependency one-way:
 *   leaveMock (rules) → attendanceMock (schedule, punches) → leaveStore (data) → employees / organization mocks.
 *
 * Requests are generated for the EXISTING employees, deterministically (hash of employee id + year) relative to today:
 * past approved leave, people on leave today, pending and future requests, rejected sick leave, cancellations,
 * unpaid leave, low and exhausted balances. Every seeded request respects the same rules as new ones.
 */

export interface LeaveRow {
  id: string;
  number: string;
  employeeId: string;
  employee: { name: Localized<string>; employeeNumber: string; department: NamedRef };
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  document: LeaveDocument | null;
  status: LeaveStatus;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: Localized<string> | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  history: LeaveHistoryEntry[];
  /**
   * Balance movements caused by this request (internal; the balance history is built from it). Seeded rows have none:
   * their movements are derived from `history` (their days never changed).
   */
  ledger?: LedgerEntry[];
}

export interface LedgerEntry {
  at: string;
  type: 'reserved' | 'released' | 'used' | 'restored';
  days: number;
}

export const leaveTypes = createMockStore<LeaveType>(LEAVE_TYPE_SEED, 'lt');

let rows: LeaveRow[] | null = null;
let approvedIndex = new Map<string, Map<string, string>>();
let nextNumber = 1;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const todayIso = () => localDate(Date.now());
/** ISO timestamp at a local time of day on `date`. */
const at = (date: string, hour: number, minute = 0) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, minute).toISOString();
};

const deptRef = (id: string): NamedRef => ({ id, name: orgTables.departments().find((d) => d.id === id)?.name ?? { en: id, ar: id } });

export function employeeSnapshot(employeeId: string): LeaveRow['employee'] {
  const e = employeeRecords.get(employeeId)!;
  return { name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId) };
}

function rebuildIndex() {
  approvedIndex = new Map();
  for (const r of rows ?? []) {
    if (r.status !== 'approved') continue;
    let byDate = approvedIndex.get(r.employeeId);
    if (!byDate) approvedIndex.set(r.employeeId, (byDate = new Map()));
    for (const d of datesBetween(r.startDate, r.endDate)) byDate.set(d, r.id);
  }
}

/* Seed generation ------------------------------------------------------------------------------------- */

type Employee = ReturnType<typeof employeeRecords.all>[number];

/** The employee's working days from the initial shift rule (same rule the attendance seed uses). */
function seedWorkingDay(e: Employee) {
  const shift = SHIFT_SEED.find((s) => s.id === initialShiftId(e.id, e.departmentId))!;
  return (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return shift.workDays.includes(new Date(y, m - 1, d).getDay() as 0);
  };
}

function managerName(e: Employee): Localized<string> {
  const manager = e.managerId ? employeeRecords.get(e.managerId) : undefined;
  return employeeRecords.fullName(manager ?? employeeRecords.get('emp-0003')!);
}

function generate(): LeaveRow[] {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const out: Omit<LeaveRow, 'id' | 'number'>[] = [];
  const typeById = new Map(LEAVE_TYPE_SEED.map((t) => [t.id, t]));

  for (const e of employeeRecords.all()) {
    if (e.hireDate > today) continue;
    const inactiveSince = employeeRecords.inactiveSince(e.id);
    const r = prng(hash(`${e.id}|leave|${year}`));
    const working = seedWorkingDay(e);
    const mine: Omit<LeaveRow, 'id' | 'number'>[] = [];
    const earliest = e.hireDate > yearStart ? e.hireDate : yearStart;
    const lastPast = addDays(inactiveSince && inactiveSince <= today ? inactiveSince : today, -1);
    const employee = { name: employeeRecords.fullName(e), employeeNumber: e.employeeNumber, department: deptRef(e.departmentId) };

    const reserved = (typeId: string) => mine.filter((x) => x.leaveTypeId === typeId && (x.status === 'approved' || x.status === 'pending')).reduce((s, x) => s + x.days, 0);
    const randomDate = (from: string, to: string) => {
      const span = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
      return span < 0 ? null : addDays(from, Math.floor(r() * (span + 1)));
    };

    /** Places a request of `count` working days starting on the first working day ≥ `from`. */
    const place = (typeId: string, from: string | null, count: number, status: LeaveStatus, latestEnd = yearEnd) => {
      if (!from || count < 1) return;
      const type = typeById.get(typeId)!;
      let start = from;
      while (start <= latestEnd && !working(start)) start = addDays(start, 1);
      let end = start;
      let counted = 0;
      for (let d = start; d <= latestEnd && counted < count; d = addDays(d, 1)) {
        end = d;
        counted = countLeaveDays(start, d, working, type, settingsData.holidayCalendar()).days;
      }
      if (counted < count || end > latestEnd || start < earliest) return;
      if (inactiveSince && end >= inactiveSince) return;
      const { days } = countLeaveDays(start, end, working, type, settingsData.holidayCalendar());
      if (type.maxConsecutiveDays !== null && days > type.maxConsecutiveDays) return;
      const allocation = allocationFor(type, e, year);
      if (allocation !== null && (status === 'approved' || status === 'pending') && reserved(typeId) + days > allocation) return;
      if (allocation === 0) return;
      if (mine.some((x) => overlaps(x, { startDate: start, endDate: end }))) return;

      const lead = 3 + Math.floor(r() * 12);
      let submitted = addDays(start, -lead);
      if (submitted > today) submitted = today;
      if (submitted < e.hireDate) submitted = e.hireDate;
      const createdAt = at(submitted, 9, Math.floor(r() * 50));
      const decidedDay = addDays(submitted, 1 + Math.floor(r() * 2)) > today ? today : addDays(submitted, 1 + Math.floor(r() * 2));
      const decidedAt = at(decidedDay, 14, Math.floor(r() * 50));
      const approver = managerName(e);
      const history: LeaveHistoryEntry[] = [{ at: createdAt, action: 'created', by: employee.name, note: '' }];
      const row: Omit<LeaveRow, 'id' | 'number'> = {
        employeeId: e.id,
        employee,
        leaveTypeId: typeId,
        startDate: start,
        endDate: end,
        days,
        reason: '',
        document: type.requiresDocument ? { fileName: `${type.code.toLowerCase()}-${e.employeeNumber}.pdf`, sizeBytes: 90_000 + Math.floor(r() * 400_000) } : null,
        status,
        createdAt,
        submittedAt: status === 'draft' ? null : createdAt,
        decidedAt: null,
        decidedBy: null,
        rejectionReason: null,
        cancelledAt: null,
        history,
      };
      if (status !== 'draft') history.push({ at: createdAt, action: 'submitted', by: employee.name, note: '' });
      if (status === 'approved') {
        // Types without approval are approved on submission (no approver).
        Object.assign(row, { decidedAt, decidedBy: type.requiresApproval ? approver : null });
        history.push({ at: decidedAt, action: 'approved', by: type.requiresApproval ? approver : employee.name, note: '' });
      }
      if (status === 'rejected') {
        const reason = SEED_REJECTION_REASONS[Math.floor(r() * SEED_REJECTION_REASONS.length)]!;
        Object.assign(row, { decidedAt, decidedBy: approver, rejectionReason: reason });
        history.push({ at: decidedAt, action: 'rejected', by: approver, note: reason });
      }
      if (status === 'cancelled') {
        row.cancelledAt = decidedAt;
        history.push({ at: decidedAt, action: 'cancelled', by: employee.name, note: '' });
      }
      mine.push(row);
    };

    const annual = typeById.get('lt-01')!;
    const annualDays = allocationFor(annual, e, year) ?? 0;
    const pastRange = (lengthDays = 0) => randomDate(earliest, addDays(lastPast, -lengthDays));
    const p = r();
    // Exhausted / low balances first (large requests need room).
    if (p < 0.03) place('lt-01', pastRange(annualDays * 2), annualDays, 'approved', lastPast);
    else if (p < 0.08) place('lt-01', pastRange(annualDays * 2), Math.max(1, annualDays - 1 - Math.floor(r() * 2)), 'approved', lastPast);
    if (r() < 0.5) place('lt-01', pastRange(10), 2 + Math.floor(r() * 5), 'approved', lastPast);
    if (r() < 0.035) place('lt-01', addDays(today, -Math.floor(r() * 3)), 3 + Math.floor(r() * 4), 'approved'); // on leave today
    if (r() < 0.15) place('lt-01', addDays(today, 7 + Math.floor(r() * 45)), 1 + Math.floor(r() * 5), 'pending');
    if (r() < 0.1) place('lt-01', addDays(today, 10 + Math.floor(r() * 70)), 2 + Math.floor(r() * 4), 'approved');
    if (r() < 0.18) place('lt-02', pastRange(5), 1 + Math.floor(r() * 3), 'approved', lastPast);
    if (r() < 0.04) place('lt-02', pastRange(5), 1 + Math.floor(r() * 2), 'rejected', lastPast);
    if (r() < 0.06) place('lt-01', r() < 0.5 ? pastRange(6) : addDays(today, 5 + Math.floor(r() * 30)), 2 + Math.floor(r() * 3), 'cancelled');
    if (r() < 0.03) place('lt-03', pastRange(8), 2 + Math.floor(r() * 4), 'approved', lastPast);
    if (r() < 0.04) place('lt-07', pastRange(3), 1, 'approved', lastPast);
    if (r() < 0.03) place('lt-01', addDays(today, 20 + Math.floor(r() * 40)), 2, 'draft');
    if (e.gender === 'female' && r() < 0.012) place('lt-04', pastRange(60), 40, 'approved', lastPast);
    if (e.gender === 'male' && r() < 0.02) place('lt-05', pastRange(4), 2, 'approved', lastPast);
    out.push(...mine);
  }

  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.employeeId.localeCompare(b.employeeId));
  return out.map((row, i) => ({ ...row, id: `lv-${pad(i + 1, 5)}`, number: `LR-${year}-${pad(i + 1, 4)}` }));
}

/* Access ---------------------------------------------------------------------------------------------- */

function ensure(): LeaveRow[] {
  if (!rows) {
    rows = generate();
    nextNumber = rows.length + 1;
    rebuildIndex();
  }
  return rows;
}

export const leaveData = {
  rows: (): readonly LeaveRow[] => ensure(),
  get: (id: string): LeaveRow | undefined => ensure().find((r) => r.id === id),
  insert(row: Omit<LeaveRow, 'id' | 'number'>): LeaveRow {
    const list = ensure();
    const year = row.startDate.slice(0, 4);
    const created: LeaveRow = { ...row, id: `lv-${pad(nextNumber, 5)}`, number: `LR-${year}-${pad(nextNumber, 4)}` };
    nextNumber++;
    list.push(created);
    rebuildIndex();
    return created;
  },
  replace(row: LeaveRow): LeaveRow {
    const list = ensure();
    rows = list.map((r) => (r.id === row.id ? row : r));
    rebuildIndex();
    return row;
  },
  /** The approved request covering `date` for the employee, if any (used by Attendance). */
  approvedOn(employeeId: string, date: string): string | null {
    ensure();
    return approvedIndex.get(employeeId)?.get(date) ?? null;
  },
  /** Public holidays: the organisation's calendar in System Settings (one source of truth). Requests keep the days
   * counted when they were made — a later calendar change affects new requests and quotes only. */
  get holidays() {
    return settingsData.holidayCalendar();
  },
};

/** Restore the initial state (tests). Requests are regenerated on next use, relative to the current date. */
export function resetLeaveStore(): void {
  leaveTypes.reset();
  rows = null;
  approvedIndex = new Map();
  nextNumber = 1;
}
