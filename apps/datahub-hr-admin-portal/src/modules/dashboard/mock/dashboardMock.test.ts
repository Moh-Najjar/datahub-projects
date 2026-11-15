import { describe, expect, it } from 'vitest';
import { DEMO_TEAM_DEPARTMENT_ID, DEPARTMENTS, headcountHistory, HISTORY_MONTHS, monthKey } from './dataset';
import * as mock from './dashboardMock';

const NOW = new Date('2026-06-15T10:30:00');
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
const team = DEPARTMENTS.find((d) => d.id === DEMO_TEAM_DEPARTMENT_ID)!;

describe('dashboard mock data is internally consistent', () => {
  for (const scope of ['organization', 'team'] as const) {
    const departments = scope === 'organization' ? DEPARTMENTS : [team];
    const summary = mock.summary(scope, NOW);
    const growth = mock.employeeGrowth(scope, NOW);
    const attendance = mock.attendanceOverview(scope, NOW);
    const leave = mock.leaveOverview(scope, NOW);
    const pending = mock.pendingActions(scope);
    const pendingCount = (type: string) => pending.items.find((i) => i.type === type)?.count;

    describe(`${scope} scope`, () => {
      it('total employees = sum of departments = last point of the growth chart', () => {
        const expected = sum(departments.map((d) => d.active + d.inactive));
        expect(summary.totalEmployees.current).toBe(expected);
        expect(growth.months.at(-1)!.headcount).toBe(expected);
      });

      it('previous-period totals and new hires come from the same monthly history', () => {
        expect(summary.totalEmployees.previous).toBe(growth.months.at(-2)!.headcount);
        expect(summary.newHires.current).toBe(sum(departments.map((d) => d.hires[HISTORY_MONTHS - 1]!)));
        expect(summary.newHires.previous).toBe(sum(departments.map((d) => d.hires[HISTORY_MONTHS - 2]!)));
      });

      it('active employees = total − inactive', () => {
        expect(summary.activeEmployees.current).toBe(summary.totalEmployees.current - sum(departments.map((d) => d.inactive)));
      });

      it('attendance groups add up to the active headcount; on-leave KPI and rate match the chart', () => {
        expect(attendance.present + attendance.late + attendance.absent + attendance.onLeave).toBe(summary.activeEmployees.current);
        expect(summary.onLeaveToday.current).toBe(attendance.onLeave);
        const expected = summary.activeEmployees.current - attendance.onLeave;
        expect(summary.attendanceRate.current).toBeCloseTo(((expected - attendance.absent) / expected) * 100, 1);
      });

      it('pending leave approvals = pending requests in the leave chart', () => {
        expect(pendingCount('leave-approvals')).toBe(sum(leave.months.map((m) => m.pending)));
      });

      it('growth covers the last 12 months in order, ending this month, with the previous year aligned', () => {
        expect(growth.months.map((m) => m.month)).toEqual(Array.from({ length: 12 }, (_, i) => monthKey(NOW, 11 - i)));
        const history = departments.map(headcountHistory);
        expect(growth.months[0]!.previousYear).toBe(sum(history.map((h) => h[0]!)));
      });
    });
  }

  it('organisation: open positions KPI = pending open positions; payroll changes = joiners + leavers this month', () => {
    const summary = mock.summary('organization', NOW);
    const pending = mock.pendingActions('organization');
    expect(pending.items.find((i) => i.type === 'open-positions')!.count).toBe(summary.openPositions!.current);
    expect(pending.items.find((i) => i.type === 'payroll-changes')!.count).toBe(sum(DEPARTMENTS.map((d) => d.hires[HISTORY_MONTHS - 1]! + d.exits[HISTORY_MONTHS - 1]!)));
  });

  it('department distribution adds up to the organisation total and is sorted largest first', () => {
    const { departments } = mock.departmentHeadcount();
    expect(sum(departments.map((d) => d.headcount))).toBe(mock.summary('organization', NOW).totalEmployees.current);
    expect(departments.map((d) => d.headcount)).toEqual([...departments.map((d) => d.headcount)].sort((a, b) => b - a));
  });

  it('team scope: only the manager’s department — no open positions, no payroll, own activity only', () => {
    const summary = mock.summary('team', NOW);
    expect(summary.department).toEqual(team.name);
    expect(summary.openPositions).toBeUndefined();
    expect(mock.pendingActions('team').items.map((i) => i.type)).not.toContain('payroll-changes');
    const orgIds = new Set(mock.recentActivity('organization', NOW, 100).items.map((i) => i.id));
    const teamItems = mock.recentActivity('team', NOW, 100).items;
    expect(teamItems.length).toBeGreaterThan(0);
    expect(teamItems.every((i) => orgIds.has(i.id))).toBe(true);
    expect(teamItems.length).toBeLessThan(orgIds.size);
  });

  it('recent activity is newest first and limited', () => {
    const items = mock.recentActivity('organization', NOW).items;
    expect(items).toHaveLength(8);
    const times = items.map((i) => Date.parse(i.occurredAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('is deterministic (same figures on every run)', () => {
    expect(mock.summary('organization', NOW)).toEqual(mock.summary('organization', NOW));
    expect(mock.employeeGrowth('organization', NOW)).toEqual(mock.employeeGrowth('organization', NOW));
  });
});
