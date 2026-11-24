import { describe, expect, it } from 'vitest';
import { SEED_DEPARTMENTS as D, SEED_USERS as U } from '@/core/api/mock/seedData';
import { db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { actAs } from '@/test/actors';
import { rankingsMock } from './rankingsMock';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const list = (over: Record<string, unknown> = {}) => rankingsMock.list({ page: 1, pageSize: 100, ...over }).items;

describe('rankings (original calculation and ordering)', () => {
  it('ranks active Trainee / Employee / Intern people only', () => {
    actAs(U.superAdmin);
    const names = list().map((e) => e.userName);
    expect(names).not.toContain('Layla Haddad'); // SuperAdmin
    expect(names).not.toContain('Omar Nasser'); // DepartmentAdmin
    expect(names).not.toContain('Khaled Issa'); // inactive
    expect(names).toHaveLength(11);
  });

  it('orders evaluated people by their latest total, highest first, then the rest by name', () => {
    actAs(U.superAdmin);
    const entries = list();
    const evaluated = entries.filter((e) => e.latestTotal !== null);
    expect(evaluated.map((e) => e.userName)).toEqual(['Hadi Mansour', 'Noor Aldeen', 'Tariq Awad', 'Yousef Darwish']);
    expect(evaluated.map((e) => e.latestTotal)).toEqual([85, 82, 76, 74]);
    // everyone without an evaluation comes after, alphabetically
    const rest = entries.slice(evaluated.length).map((e) => e.userName);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
    expect(entries.slice(evaluated.length).every((e) => e.latestTotal === null && e.position === null)).toBe(true);
  });

  it('uses the MOST RECENT evaluation, not the best or the average', () => {
    actAs(U.superAdmin);
    // Yousef has two evaluations: 25 days ago (66) and 6 days ago (74) — the latest counts.
    const yousef = list().find((e) => e.userName === 'Yousef Darwish')!;
    expect(yousef).toMatchObject({ latestTotal: 74, latestMaxTotal: 100, evaluationCount: 2 });
    // add a newer, lower evaluation: the ranking follows the newest date
    db().evaluations.push({ id: 'evl-new', userId: U.yousef, evaluatedByUserId: U.superAdmin, enrollmentId: null, evaluatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: null, categories: [{ id: 'c', categoryName: 'Only', criteria: '', score: 3 }] });
    const after = list().find((e) => e.userName === 'Yousef Darwish')!;
    expect(after).toMatchObject({ latestTotal: 3, latestMaxTotal: 10, evaluationCount: 3 });
  });

  it('numbers positions in ranking order and keeps them when filters narrow the view', () => {
    actAs(U.superAdmin);
    expect(list().filter((e) => e.position !== null).map((e) => e.position)).toEqual([1, 2, 3, 4]);
    const tariq = list({ filters: { departmentId: D.software } }).find((e) => e.userName === 'Tariq Awad')!;
    expect(tariq.position).toBe(3); // global position, not "1st of Software Development"
  });

  it('searches and filters by role and department; paginates', () => {
    actAs(U.superAdmin);
    expect(list({ search: 'noor' }).map((e) => e.userName)).toEqual(['Noor Aldeen']);
    expect(list({ filters: { role: 'Intern' } }).every((e) => e.role === 'Intern')).toBe(true);
    expect(rankingsMock.list({ page: 2, pageSize: 5 }).items).toHaveLength(5);
    expect(rankingsMock.list({ page: 1, pageSize: 5 }).total).toBe(11);
  });
});

describe('rankings: department scope', () => {
  it('a DepartmentAdmin sees their department\'s people and people enrolled in its trainings — nobody else', () => {
    actAs(U.adminDataEngineering);
    const names = list().map((e) => e.userName).sort();
    // Data Engineering users + anyone enrolled in a DE training (all DE users are; Tariq/Sara are not)
    expect(names).toEqual(['Lina Barakat', 'Noor Aldeen', 'Yousef Darwish', 'Ziad Tamimi']);
  });

  it('only counts evaluations of the admin\'s own department context', () => {
    actAs(U.adminAi);
    const yousef = list().find((e) => e.userName === 'Yousef Darwish')!; // enrolled in an AI training
    // Yousef's evaluations are all Data Engineering context (his department; Data Engineering enrollment), so none count for AI
    expect(yousef).toMatchObject({ latestTotal: null, evaluationCount: 0, position: null });
    const hadi = list().find((e) => e.userName === 'Hadi Mansour')!;
    expect(hadi.latestTotal).toBe(85);
  });

  it('learners cannot see rankings', () => {
    actAs(U.noor);
    expect(error(() => list()).code).toBe('FORBIDDEN');
  });
});
