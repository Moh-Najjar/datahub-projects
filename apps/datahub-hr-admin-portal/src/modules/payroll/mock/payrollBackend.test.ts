import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/api/types';
import type { Role } from '@/core/config/permissions';
import { employeeRecords, getEmployee, listEmployees } from '@/modules/employees/mock/employeesMock';
import { approveRequest, cancelRequest, createRequest, rejectRequest } from '@/modules/leave/mock/leaveMock';
import { orgTables } from '@/modules/organization/mock/organizationMock';
import { payrollApi as api } from '@/modules/payroll/api/payrollApi';
import type { PayrollRun, PayrollScope, RunInput } from '@/modules/payroll/types/payroll';
import { divRound } from '@/modules/payroll/utils/money';

type LeaveScope = Parameters<typeof createRequest>[1];

/* The simulated payroll backend on a fixed clock: Monday 16 Nov 2026, 10:30 (local). */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 30));
});
afterEach(() => vi.useRealTimers());

const users: Record<Role, string> = { 'system-admin': 'usr-0001', 'hr-admin': 'usr-0002', 'hr-manager': 'usr-0003', 'department-manager': 'usr-0004', employee: 'usr-0005', recruiter: 'usr-0006', 'payroll-officer': 'usr-0007' };
const ORG_ROLES: Role[] = ['system-admin', 'hr-admin', 'hr-manager', 'payroll-officer'];
const scopeOf = (role: Role, kind: PayrollScope['kind'] = ORG_ROLES.includes(role) ? 'organization' : 'own'): PayrollScope => ({ kind, userId: users[role], role });
const ADMIN = scopeOf('system-admin');
const HR = scopeOf('hr-admin');
const HRM = scopeOf('hr-manager');
const OFFICER = scopeOf('payroll-officer');
const EMPLOYEE = scopeOf('employee'); // Sami Odeh (emp-0025)

async function rejects(promise: Promise<unknown>, code: ApiError['code'], field?: string, reason?: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, 'expected an error').toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe(code);
  if (field) expect((error as ApiError).fieldErrors?.[field], JSON.stringify((error as ApiError).fieldErrors)).toContain(reason);
}
const runs = async (filters: Record<string, string> = {}) => (await api.getPayrollRuns({ page: 1, pageSize: 100, filters }, HR)).items;
const runOf = async (month: string, departmentId: string | null) => (await runs({ month })).find((r) => (r.department?.id ?? null) === departmentId && r.status !== 'cancelled')!;
const nov = (departmentId: string | null): RunInput => ({ periodStart: '2026-11-01', periodEnd: '2026-11-30', paymentDate: '2026-11-30', payFrequency: 'monthly', departmentId, currency: 'JOD' });
const dec = (departmentId: string | null): RunInput => ({ periodStart: '2026-12-01', periodEnd: '2026-12-31', paymentDate: '2026-12-31', payFrequency: 'monthly', departmentId, currency: 'JOD' });
function topLevel(departmentId: string): string {
  let d = orgTables.departments().find((x) => x.id === departmentId);
  while (d?.parentId) d = orgTables.departments().find((x) => x.id === d!.parentId);
  return d!.id;
}
/** Calculate → validate → submit (by the payroll officer). */
async function prepare(id: string, scope = OFFICER): Promise<PayrollRun> {
  await api.calculatePayrollRun(id, scope);
  await api.validatePayrollRun(id, scope);
  return api.submitPayrollForApproval(id, scope);
}

describe('seed and overview', () => {
  it('11 past months of payroll (paid, last one approved) and this month in every workflow state', async () => {
    const all = await runs();
    const past = all.filter((r) => r.department === null).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    expect(past.map((r) => r.periodStart.slice(0, 7))).toEqual(['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(past.slice(0, 10).every((r) => r.status === 'paid')).toBe(true);
    expect(past.at(-1)!.status).toBe('approved');
    const current = Object.fromEntries(all.filter((r) => r.periodStart === '2026-11-01').map((r) => [r.department!.id, r.status]));
    expect(current).toEqual({ 'dep-eng': 'pending-approval', 'dep-sales': 'calculated', 'dep-fin': 'rejected', 'dep-ops': 'draft', 'dep-support': 'cancelled' });
  });

  it('dashboard figures come from the same runs as the reports (one dataset)', async () => {
    const s = await api.getPayrollSummary(HR);
    expect(s.currency).toBe('JOD');
    expect(s.latest!.month).toBe('2026-10');
    expect(s.pendingRuns).toBe(3); // draft + calculated + rejected
    expect(s.awaitingApproval).toBe(1);
    const report = await api.getPayrollReports({ page: 1, pageSize: 100, filters: { type: 'summary', fromMonth: '2026-10', toMonth: '2026-10', departmentId: '', locationId: '', employeeId: '' } }, HR);
    expect(report.totals.gross).toBe(s.latest!.gross);
    expect(report.totals.net).toBe(s.latest!.net);
    expect(report.totals.deductions).toBe(s.latest!.deductions);
    const october = await runOf('2026-10', null);
    expect(s.latest!.gross).toBe(october.totals!.gross);
    expect(s.monthly.find((m) => m.month === '2026-10')!.net).toBe(october.totals!.net);
    expect(s.byDepartment.reduce((sum, d) => sum + d.gross, 0)).toBe(s.latest!.gross);
    expect(s.salaryRanges.reduce((sum, r) => sum + r.employees, 0)).toBe(s.totalEmployees);
    // Run totals are the sums of their lines.
    const lines = (await api.getPayrollDetails(october.id, { page: 1, pageSize: 100 }, HR)).items;
    expect(lines.length).toBeGreaterThan(0);
    const all = await Promise.all(Array.from({ length: Math.ceil(october.totals!.employees / 100) }, (_, i) => api.getPayrollDetails(october.id, { page: i + 1, pageSize: 100 }, HR)));
    expect(all.flatMap((p) => p.items).reduce((sum, l) => sum + l.net, 0)).toBe(october.totals!.net);
  });
});

describe('payroll runs', () => {
  it('prevents duplicate runs for overlapping periods and the same employees', async () => {
    await rejects(api.createPayrollRun(nov(null), HR), 'VALIDATION', 'month', 'duplicatePeriod');
    await rejects(api.createPayrollRun(nov('dep-eng'), HR), 'VALIDATION', 'month', 'duplicatePeriod');
    // A cancelled run releases its period; other departments are free.
    expect((await api.createPayrollRun(nov('dep-support'), OFFICER)).status).toBe('draft');
    expect((await api.createPayrollRun(nov('dep-hr'), OFFICER)).number).toMatch(/^PR-2026-\d{4}$/);
    await rejects(api.createPayrollRun({ ...nov('dep-eng-swd') }, HR), 'VALIDATION', 'departmentId', 'topLevelOnly');
    await rejects(api.createPayrollRun({ ...nov('dep-it'), periodStart: '2026-11-02' }, HR), 'VALIDATION', 'periodStart', 'calendarMonth');
    await rejects(api.createPayrollRun({ ...nov('dep-it'), paymentDate: '2026-10-30' }, HR), 'VALIDATION', 'paymentDate', 'paymentDateRange');
  });

  it('draft → calculated → validated → pending approval → approved → paid; every transition recorded', async () => {
    const draft = await runOf('2026-11', 'dep-ops');
    await rejects(api.submitPayrollForApproval(draft.id, OFFICER), 'VALIDATION', 'status', 'notCalculated');
    const calculated = await api.calculatePayrollRun(draft.id, OFFICER);
    expect(calculated.status).toBe('calculated');
    expect(calculated.totals!.employees).toBeGreaterThan(0);
    expect(calculated.issues.some((i) => i.code === 'periodNotEnded')).toBe(true); // 16 Nov: warning only
    await rejects(api.submitPayrollForApproval(draft.id, OFFICER), 'VALIDATION', 'status', 'notValidated');
    await api.validatePayrollRun(draft.id, OFFICER);
    const pending = await api.submitPayrollForApproval(draft.id, OFFICER);
    expect(pending.status).toBe('pending-approval');
    // The Payroll Officer processes but never approves; HR approves.
    expect(pending.can.approve).toBe(false);
    await rejects(api.approvePayrollRun(draft.id, OFFICER), 'FORBIDDEN');
    const approved = await api.approvePayrollRun(draft.id, HR);
    expect(approved).toMatchObject({ status: 'approved', approvedBy: { en: expect.any(String) } });
    const paid = await api.markPayrollAsPaid(draft.id, OFFICER);
    expect(paid.status).toBe('paid');
    expect(paid.history.map((h) => h.action)).toEqual(['created', 'calculated', 'validated', 'submitted', 'approved', 'paid']);
    expect(paid.history.every((h) => h.by.en && h.at)).toBe(true);
  });

  it('creators never approve their own run; only hr.payroll.approve roles decide', async () => {
    const own = await api.createPayrollRun(dec(null), HR);
    await prepare(own.id, HR);
    const view = await api.getPayrollRunById(own.id, HR);
    expect(view.can.approve).toBe(false);
    expect(view.approvalBlockedReason).toBe('ownRun');
    await rejects(api.approvePayrollRun(own.id, HR), 'VALIDATION', 'status', 'ownRun');
    await rejects(api.rejectPayrollRun(own.id, 'Not by myself please', HR), 'VALIDATION', 'status', 'ownRun');
    await rejects(api.approvePayrollRun(own.id, HRM), 'FORBIDDEN');
    expect((await api.approvePayrollRun(own.id, ADMIN)).status).toBe('approved');
  });

  it('rejection needs a reason; a rejected run is corrected and resubmitted', async () => {
    const run = await runOf('2026-11', 'dep-eng');
    await rejects(api.rejectPayrollRun(run.id, ' ', HR), 'VALIDATION', 'reason', 'reasonTooShort');
    const rejected = await api.rejectPayrollRun(run.id, 'Check the overtime notes first.', HR);
    expect(rejected).toMatchObject({ status: 'rejected', rejectionReason: 'Check the overtime notes first.' });
    await rejects(api.markPayrollAsPaid(run.id, OFFICER), 'VALIDATION', 'status', 'notApproved');
    expect((await api.calculatePayrollRun(run.id, OFFICER)).history.at(-1)!.action).toBe('recalculated');
    await api.validatePayrollRun(run.id, OFFICER);
    expect((await api.submitPayrollForApproval(run.id, OFFICER)).status).toBe('pending-approval');
    // Editing a rejected run returns it to draft and discards the calculation.
    const fin = await runOf('2026-11', 'dep-fin');
    const edited = await api.updatePayrollRun(fin.id, { ...nov('dep-fin'), paymentDate: '2026-12-02' }, OFFICER);
    expect(edited).toMatchObject({ status: 'draft', totals: null, paymentDate: '2026-12-02' });
  });

  it('paid runs are immutable: no recalculation, edit or cancellation', async () => {
    const paid = await runOf('2026-09', null);
    expect(paid.status).toBe('paid');
    expect(paid.can).toMatchObject({ edit: false, calculate: false, cancel: false });
    await rejects(api.calculatePayrollRun(paid.id, HR), 'VALIDATION', 'status', 'notCalculable');
    await rejects(api.updatePayrollRun(paid.id, nov(null), HR), 'VALIDATION', 'status', 'notEditable');
    await rejects(api.cancelPayrollRun(paid.id, 'Should not be possible', HR), 'VALIDATION', 'status', 'notCancellable');
    const draft = await runOf('2026-11', 'dep-ops');
    await rejects(api.cancelPayrollRun(draft.id, '', OFFICER), 'VALIDATION', 'reason', 'reasonTooShort');
    expect((await api.cancelPayrollRun(draft.id, 'Created for the wrong month.', OFFICER)).status).toBe('cancelled');
  });

  it('calculations are snapshots: later changes never alter them (validation warns before resubmission)', async () => {
    const paid = await runOf('2026-09', null);
    const before = await api.getPayrollDetails(paid.id, { page: 1, pageSize: 20 }, HR);
    await api.updatePayrollPolicy({ dailyRateDivisor: 26 }, HR);
    const sales = await runOf('2026-11', 'dep-sales');
    const line = (await api.getPayrollDetails(sales.id, { page: 1, pageSize: 1, sortBy: 'net', sortDirection: 'desc' }, HR)).items[0]!;
    const detail = await api.getEmployeeCompensation(line.employeeId, HR);
    await api.updateEmployeeCompensation(line.employeeId, { structureId: detail.current!.structure.id, basicSalary: detail.current!.basicSalary + 100_000, effectiveFrom: '2026-11-20', reason: 'promotion', note: '' }, HR);
    // The paid run and the calculated line are unchanged…
    expect((await api.getPayrollDetails(paid.id, { page: 1, pageSize: 20 }, HR)).items).toEqual(before.items);
    expect((await api.getPayrollLine(sales.id, line.employeeId, HR)).net).toBe(line.net);
    // …validation reports that inputs changed; recalculating applies them.
    expect((await api.validatePayrollRun(sales.id, OFFICER)).issues.map((i) => i.code)).toContain('inputsChanged');
    await api.calculatePayrollRun(sales.id, OFFICER);
    const after = await api.getPayrollLine(sales.id, line.employeeId, HR);
    expect(after.basic).toBe(line.basic + divRound(100_000 * 11, 30)); // 20–30 Nov at the new salary
    expect(after.inputs.policy.dailyRateDivisor).toBe(26);
  });
});

describe('leave and attendance integration', () => {
  const ME: LeaveScope = { kind: 'own', userId: 'usr-0005', role: 'employee' };
  const LEAVE_HR: LeaveScope = { kind: 'organization', userId: 'usr-0002', role: 'hr-admin' };
  const request = (leaveTypeId: string, startDate: string, endDate: string, submit = true) => createRequest({ leaveTypeId, startDate, endDate, reason: 'Personal matters for the demo.', document: null, submit }, ME);

  it('only APPROVED unpaid leave is deducted (pending, rejected, cancelled and paid leave are not)', async () => {
    const approved = request('lt-03', '2026-12-07', '2026-12-08');
    approveRequest(approved.id, LEAVE_HR);
    approveRequest(request('lt-01', '2026-12-10', '2026-12-10').id, LEAVE_HR); // paid annual leave
    request('lt-03', '2026-12-14', '2026-12-14'); // pending
    rejectRequest(request('lt-03', '2026-12-15', '2026-12-15').id, 'Not possible during the year-end close.', LEAVE_HR);
    const cancelled = request('lt-03', '2026-12-16', '2026-12-16');
    approveRequest(cancelled.id, LEAVE_HR);
    cancelRequest(cancelled.id, ME);

    const sami = employeeRecords.get('emp-0025')!;
    const run = await api.createPayrollRun(dec(topLevel(sami.departmentId)), OFFICER);
    await api.calculatePayrollRun(run.id, OFFICER);
    const line = await api.getPayrollLine(run.id, 'emp-0025', HR);
    const unpaid = line.deductionItems.filter((d) => d.category === 'unpaid-leave');
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0]!.sources).toEqual([approved.id]);
    const basic = line.inputs.compensation.at(-1)!.basicSalary;
    expect(unpaid[0]!.amount).toBe(divRound(basic * approved.days, 30));
    expect(line.inputs.unpaidLeaveDays).toBe(approved.days);
    expect(line.inputs.leave.map((l) => [l.typeCode, l.paid])).toEqual([
      ['UNPAID', false],
      ['ANNUAL', true],
    ]);
  });

  it('absences cost nothing until an absence deduction is explicitly enabled; then only absent days count', async () => {
    const candidates = ['dep-support', 'dep-hr', 'dep-it', 'dep-mkt'];
    const created = await Promise.all(candidates.map((dep) => api.createPayrollRun(nov(dep), OFFICER)));
    let found: { runId: string; employeeId: string; absent: number; deductions: number } | null = null;
    for (const r of created) {
      await api.calculatePayrollRun(r.id, OFFICER);
      const lines = (await api.getPayrollDetails(r.id, { page: 1, pageSize: 100 }, HR)).items;
      for (const l of lines) {
        const full = await api.getPayrollLine(r.id, l.employeeId, HR);
        if (full.inputs.attendance.absentDates.length > 0) found ??= { runId: r.id, employeeId: l.employeeId, absent: full.inputs.attendance.absentDates.length, deductions: full.deductions };
        expect(full.deductionItems.some((d) => d.category === 'absence')).toBe(false);
      }
    }
    expect(found, 'seeded attendance has absences').not.toBeNull();
    await api.updateDeductionTypeStatus('ded-02', 'active', HR);
    await api.calculatePayrollRun(found!.runId, OFFICER);
    const after = await api.getPayrollLine(found!.runId, found!.employeeId, HR);
    const absence = after.deductionItems.find((d) => d.category === 'absence')!;
    expect(absence.amount).toBe(divRound(after.inputs.compensation.at(-1)!.basicSalary * after.inputs.absenceDays, 30));
    expect(after.inputs.absenceDays).toBe(found!.absent);
    expect(after.issues).toContain('attendanceIncomplete');
    // Two active absence types would deduct the same day twice.
    const second = await api.createDeductionType({ code: 'ABS-2', name: { en: 'Absence 2', ar: 'غياب ٢' }, description: '', category: 'absence', calculation: 'daily-rate', amount: null, percentage: null, currency: 'JOD', recurrence: 'recurring', maxAmount: null }, HR);
    expect(second.status).toBe('inactive');
    await rejects(api.updateDeductionTypeStatus(second.id, 'active', HR), 'VALIDATION', 'status', 'duplicateSystemType');
  }, 30_000);
});

describe('compensation', () => {
  it('every change is a new record; history is never overwritten; periods never overlap', async () => {
    const list = await api.getEmployeeCompensations({ page: 1, pageSize: 5, filters: { status: 'active', employmentStatus: 'active' } }, HR);
    const id = list.items[0]!.employeeId;
    const before = await api.getEmployeeCompensation(id, HR);
    const current = before.current!;
    const updated = await api.updateEmployeeCompensation(id, { structureId: current.structure.id, basicSalary: current.basicSalary + 50_125, effectiveFrom: '2027-01-01', reason: 'annual-review', note: '' }, HR);
    expect(updated.history).toHaveLength(before.history.length + 1);
    expect(updated.history[0]).toMatchObject({ effectiveFrom: '2027-01-01', effectiveTo: null, state: 'scheduled', basicSalary: current.basicSalary + 50_125 });
    expect(updated.history[1]).toMatchObject({ id: current.id, basicSalary: current.basicSalary, effectiveTo: '2026-12-31', state: 'current' });
    expect(updated.history.slice(1).map((h) => [h.id, h.basicSalary, h.effectiveFrom])).toEqual(before.history.map((h) => [h.id, h.basicSalary, h.effectiveFrom]));
    await rejects(api.updateEmployeeCompensation(id, { structureId: current.structure.id, basicSalary: 900_000, effectiveFrom: '2026-12-15', reason: 'adjustment', note: 'x' }, HR), 'VALIDATION', 'effectiveFrom', 'overlapsExisting');
    await rejects(api.updateEmployeeCompensation(id, { structureId: 'sal-10', basicSalary: 900_000, effectiveFrom: '2027-02-01', reason: 'adjustment', note: '' }, HR), 'VALIDATION', 'note', 'noteRequired');
    await rejects(api.updateEmployeeCompensation(id, { structureId: 'sal-11', basicSalary: 900_000, effectiveFrom: '2027-02-01', reason: 'promotion', note: '' }, HR), 'VALIDATION', 'structureId', 'structureInactive');
  });

  it('no change may reach into an approved or paid period; the structure must suit the employment type', async () => {
    const list = await api.getEmployeeCompensations({ page: 1, pageSize: 50, filters: { status: 'active', employmentStatus: 'active' } }, HR);
    const full = list.items.find((r) => r.employee.employmentType === 'full-time' && r.current!.effectiveFrom < '2026-10-01')!;
    await rejects(api.updateEmployeeCompensation(full.employeeId, { structureId: full.current!.structure.id, basicSalary: 1_000_000, effectiveFrom: '2026-10-15', reason: 'promotion', note: '' }, HR), 'VALIDATION', 'effectiveFrom', 'periodClosed');
    await rejects(api.updateEmployeeCompensation(full.employeeId, { structureId: 'sal-09', basicSalary: 500_000, effectiveFrom: '2026-12-01', reason: 'promotion', note: '' }, HR), 'VALIDATION', 'structureId', 'employmentTypeNotAllowed');
  });

  it('salaries stay out of the general employee listing and profile', async () => {
    const employees = listEmployees({ page: 1, pageSize: 5 }, { kind: 'organization', role: 'hr-admin' });
    const profile = getEmployee(employees.items[0]!.id, { kind: 'organization', role: 'hr-admin' });
    for (const value of [employees.items[0], profile]) expect(JSON.stringify(value)).not.toMatch(/salary|compensation|allowance/i);
  });
});

describe('salary structures, allowances and deductions', () => {
  it('structure CRUD with unique codes and status changes', async () => {
    const created = await api.createSalaryStructure({ code: 'SAL-TEST', name: { en: 'Test', ar: 'اختبار' }, description: '', basicSalary: 1_000_500, currency: 'JOD', payFrequency: 'monthly', employmentTypes: ['full-time'] }, HR);
    expect(created).toMatchObject({ status: 'active', assignedEmployees: 0, basicSalary: 1_000_500 });
    await rejects(api.createSalaryStructure({ code: 'sal-test', name: { en: 'Dup', ar: 'مكرر' }, description: '', basicSalary: 1, currency: 'JOD', payFrequency: 'monthly', employmentTypes: ['full-time'] }, HR), 'VALIDATION', 'code', 'invalidCode');
    await rejects(api.createSalaryStructure({ code: 'SAL-MID', name: { en: 'Dup', ar: 'مكرر' }, description: '', basicSalary: 1, currency: 'JOD', payFrequency: 'monthly', employmentTypes: ['full-time'] }, HR), 'VALIDATION', 'code', 'duplicateCode');
    expect((await api.updateSalaryStructure(created.id, { ...created, basicSalary: 1_100_000 }, HR)).basicSalary).toBe(1_100_000);
    expect((await api.updateSalaryStructureStatus(created.id, 'inactive', HR)).status).toBe('inactive');
    const mid = await api.getSalaryStructureById('sal-03', HR);
    expect(mid.assignedEmployees).toBeGreaterThan(0);
    await rejects(api.updateSalaryStructure('sal-03', { ...mid, currency: 'USD', basicSalary: 100_000 }, HR), 'VALIDATION', 'currency', 'structureInUse');
    await rejects(api.createSalaryStructure({ ...created, code: 'SAL-X' }, OFFICER).then(() => api.createSalaryStructure({ ...created, code: 'SAL-Y' }, HRM)), 'FORBIDDEN');
  });

  it('allowances: assignment with effective dates, no overlap, end date, types in use stay active', async () => {
    const type = await api.createAllowanceType({ code: 'REMOTE', name: { en: 'Remote work allowance', ar: 'بدل العمل عن بعد' }, description: '', calculation: 'percentage', amount: null, percentage: 250, currency: 'JOD', recurrence: 'recurring', taxable: false }, OFFICER);
    const employee = (await api.getEmployeeCompensations({ page: 1, pageSize: 1, filters: { status: 'active', employmentStatus: 'active' } }, HR)).items[0]!.employeeId;
    const assigned = await api.assignEmployeeAllowance(employee, { typeId: type.id, amount: null, percentage: 300, effectiveFrom: '2026-12-01', effectiveTo: null, note: 'Example' }, OFFICER);
    expect(assigned).toMatchObject({ percentage: 300, state: 'scheduled', type: { code: 'REMOTE' } });
    await rejects(api.assignEmployeeAllowance(employee, { typeId: type.id, amount: null, percentage: 300, effectiveFrom: '2027-01-01', effectiveTo: null, note: '' }, OFFICER), 'VALIDATION', 'effectiveFrom', 'overlapsExisting');
    await rejects(api.assignEmployeeAllowance(employee, { typeId: type.id, amount: null, percentage: 300, effectiveFrom: '2026-10-01', effectiveTo: '2026-10-31', note: '' }, OFFICER), 'VALIDATION', 'effectiveFrom', 'periodClosed');
    await rejects(api.updateAllowanceTypeStatus(type.id, 'inactive', OFFICER), 'VALIDATION', 'status', 'typeInUse');
    const ended = await api.endEmployeeAssignment(assigned.id, '2027-03-31', 'Project ends', OFFICER);
    expect(ended.effectiveTo).toBe('2027-03-31');
    expect(ended.history.map((h) => h.action)).toEqual(['assigned', 'ended']);
    expect((await api.getEmployeeAllowances(employee, HR)).some((a) => a.id === assigned.id)).toBe(true);
  });

  it('system and statutory deductions are policies, not individual assignments; statutory ones are illustrative', async () => {
    const candidates = (await api.getEmployeeCompensations({ page: 1, pageSize: 50, filters: { status: 'active', employmentStatus: 'active' } }, HR)).items;
    let employee = '';
    for (const c of candidates) if (!employee && !(await api.getEmployeeDeductions(c.employeeId, HR)).some((d) => d.type.code === 'LOAN')) employee = c.employeeId;
    for (const typeId of ['ded-01', 'ded-02', 'ded-05']) await rejects(api.assignEmployeeDeduction(employee, { typeId, amount: null, percentage: 100, effectiveFrom: '2026-12-01', effectiveTo: null, note: '' }, HR), 'VALIDATION', 'typeId', 'notAssignable');
    const types = (await api.getDeductionTypes({ page: 1, pageSize: 20 }, HR)).items;
    expect(types.find((t) => t.category === 'statutory')).toMatchObject({ illustrative: true, status: 'inactive' });
    expect(types.find((t) => t.category === 'absence')!.status).toBe('inactive');
    const loan = await api.assignEmployeeDeduction(employee, { typeId: 'ded-04', amount: 75_000, percentage: null, effectiveFrom: '2026-12-01', effectiveTo: '2027-05-31', note: 'Example loan' }, HR);
    expect(loan).toMatchObject({ amount: 75_000, type: { category: 'loan', maxAmount: 200_000 } });
  });
});

describe('payslips and self-service', () => {
  it('payslips only from approved or paid runs; they match the payroll line', async () => {
    const sales = await runOf('2026-11', 'dep-sales');
    await rejects(api.generatePayslip(sales.id, undefined, OFFICER), 'VALIDATION', 'status', 'notApproved');
    const october = await runOf('2026-10', null);
    expect(october.payslipsGenerated).toBe(october.totals!.employees);
    const eng = await runOf('2026-11', 'dep-eng');
    await api.approvePayrollRun(eng.id, HR);
    const { generated, run } = await api.generatePayslip(eng.id, undefined, OFFICER);
    expect(generated).toBe(run.totals!.employees);
    expect((await api.generatePayslip(eng.id, undefined, OFFICER)).generated).toBe(0); // never issued twice
    const slip = (await api.getPayslips({ page: 1, pageSize: 1, filters: { runId: eng.id } }, HR)).items[0]!;
    const line = await api.getPayrollLine(eng.id, slip.employeeId, HR);
    expect([slip.gross, slip.deductions, slip.net]).toEqual([line.gross, line.deductions, line.net]);
    expect((await api.getPayslipById(slip.id, HR)).company.en).toMatch(/fictional/);
  });

  it('employees see only their own payslips; other payslips are not found (no URL leaks)', async () => {
    const mine = await api.getMyPayslips({ page: 1, pageSize: 50 }, EMPLOYEE);
    expect(mine.total).toBe(11);
    expect(mine.items.every((p) => p.employeeId === 'emp-0025')).toBe(true);
    expect((await api.getPayslips({ page: 1, pageSize: 50 }, EMPLOYEE)).total).toBe(11);
    const other = (await api.getPayslips({ page: 1, pageSize: 1, filters: { month: '2026-10' } }, HR)).items.find((p) => p.employeeId !== 'emp-0025')!;
    await rejects(api.getPayslipById(other.id, EMPLOYEE), 'NOT_FOUND');
    expect((await api.getPayslipById(mine.items[0]!.id, EMPLOYEE)).employeeId).toBe('emp-0025');
    const my = await api.getMyPayroll(EMPLOYEE);
    expect(my.employee.id).toBe('emp-0025');
    expect(my.current?.basicSalary).toBeGreaterThan(0);
    expect(my.history).toHaveLength(11);
    expect(my.history[0]!.periodStart).toBe('2026-10-01');
    expect((await api.getSalaryHistory('emp-0025', EMPLOYEE)).length).toBeGreaterThan(0);
    await rejects(api.getSalaryHistory('emp-0001', EMPLOYEE), 'FORBIDDEN');
  });
});

describe('permissions and data scope', () => {
  it('employee, recruiter and department manager: own payroll only', async () => {
    for (const role of ['employee', 'recruiter', 'department-manager'] as Role[]) {
      const own = scopeOf(role);
      await rejects(api.getPayrollSummary(own), 'FORBIDDEN');
      await rejects(api.getPayrollRuns({ page: 1, pageSize: 10 }, own), 'FORBIDDEN');
      await rejects(api.getEmployeeCompensations({ page: 1, pageSize: 10 }, own), 'FORBIDDEN');
      await rejects(api.getEmployeeCompensation('emp-0002', own), 'FORBIDDEN');
      await rejects(api.getAllowanceTypes({ page: 1, pageSize: 10 }, own), 'FORBIDDEN');
      await rejects(api.getPayrollReports({ page: 1, pageSize: 10, filters: { type: 'summary', fromMonth: '2026-01', toMonth: '2026-10', departmentId: '', locationId: '', employeeId: '' } }, own), 'FORBIDDEN');
      await rejects(api.exportPayrollReport({ type: 'employee', fromMonth: '2026-01', toMonth: '2026-10', departmentId: '', locationId: '', employeeId: '' }, 'en', own), 'FORBIDDEN');
      // Claiming organization scope without hr.payroll.view is refused too.
      await rejects(api.getPayrollRuns({ page: 1, pageSize: 10 }, scopeOf(role, 'organization')), 'FORBIDDEN');
      const my = await api.getMyPayroll(own);
      expect(my.history.every((h) => h.id.endsWith(my.employee.id.slice(4)))).toBe(true);
    }
  });

  it('HR Manager reads but never writes; Payroll Officer writes but never approves', async () => {
    expect((await api.getPayrollSummary(HRM)).latest).not.toBeNull();
    await rejects(api.createPayrollRun(nov('dep-hr'), HRM), 'FORBIDDEN');
    await rejects(api.updatePayrollPolicy({ dailyRateDivisor: 30 }, HRM), 'FORBIDDEN');
    const run = await runOf('2026-11', 'dep-eng');
    expect((await api.getPayrollRunById(run.id, HRM)).can).toMatchObject({ approve: false, calculate: false, cancel: false });
    expect((await api.getPayrollRunById(run.id, OFFICER)).can.approve).toBe(false);
    expect((await api.getPayrollRunById(run.id, HR)).can.approve).toBe(true);
  });
});

describe('reports and CSV export', () => {
  it('neutralises spreadsheet formulas, keeps decimals exact and follows the language', async () => {
    const type = await api.createAllowanceType({ code: 'INJ', name: { en: '=HYPERLINK("x")', ar: '@بدل تجريبي' }, description: '', calculation: 'fixed', amount: 12_345, percentage: null, currency: 'JOD', recurrence: 'one-time', taxable: false }, HR);
    const run = await api.createPayrollRun(nov('dep-hr'), OFFICER);
    const employeeId = (await api.getEmployeeCompensations({ page: 1, pageSize: 1, filters: { departmentId: 'dep-hr', status: 'active', employmentStatus: 'active' } }, HR)).items[0]!.employeeId;
    await api.assignEmployeeAllowance(employeeId, { typeId: type.id, amount: 12_345, percentage: null, effectiveFrom: '2026-11-05', effectiveTo: null, note: '' }, HR);
    await prepare(run.id);
    await api.approvePayrollRun(run.id, HR);
    const filters = { type: 'allowances' as const, fromMonth: '2026-11', toMonth: '2026-11', departmentId: 'dep-hr', locationId: '', employeeId: '' };
    const en = await api.exportPayrollReport(filters, 'en', HR);
    expect(en.content.startsWith('﻿')).toBe(true);
    expect(en.content).toContain('"\'=HYPERLINK(""x"")","INJ"');
    expect(en.content).toContain('"12.345"');
    expect(en.content).toContain('"Amount (JOD)"');
    const ar = await api.exportPayrollReport(filters, 'ar', HR);
    expect(ar.content).toContain('"\'@بدل تجريبي"');
    expect(ar.content).toContain('"المبلغ (JOD)"');
    expect(en.fileName).toBe('payroll-allowances-2026-11_2026-11.csv');
  });

  it('report filters: department, employee and period range validation', async () => {
    const base = { type: 'employee' as const, fromMonth: '2026-01', toMonth: '2026-10', departmentId: '', locationId: '', employeeId: '' };
    const all = await api.getPayrollReports({ page: 1, pageSize: 10, filters: base }, HR);
    const eng = await api.getPayrollReports({ page: 1, pageSize: 10, filters: { ...base, departmentId: 'dep-eng' } }, HR);
    expect(eng.total).toBeLessThan(all.total);
    const one = await api.getPayrollReports({ page: 1, pageSize: 10, filters: { ...base, type: 'history', employeeId: 'emp-0025' } }, HR);
    expect(one.total).toBe(10);
    expect(one.rows.every((r) => r.employeeNumber === 'EMP-0025')).toBe(true);
    await rejects(api.getPayrollReports({ page: 1, pageSize: 10, filters: { ...base, toMonth: '2025-01' } }, HR), 'VALIDATION', 'toMonth', 'endBeforeStart');
    await rejects(api.getPayrollReports({ page: 1, pageSize: 10, filters: { ...base, fromMonth: '2022-01' } }, HR), 'VALIDATION', 'toMonth', 'rangeTooLong');
  });
});
