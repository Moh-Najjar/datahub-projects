import { describe, expect, it } from 'vitest';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { actAs } from '@/test/actors';
import { certificatesMock } from './certificatesMock';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const list = (over: Record<string, unknown> = {}) => certificatesMock.list({ page: 1, pageSize: 50, ...over });
const enrollmentOf = (userId: string, trainingId: string) => db().enrollments.find((e) => e.userId === userId && e.trainingId === trainingId)!;

describe('certificates', () => {
  it('a learner sees only their own, and only for completed trainings', () => {
    actAs(U.noor);
    const certs = list().items;
    expect(certs.map((c) => c.trainingTitle)).toEqual(['SQL & Data Modeling Foundations']);
    expect(certs[0]).toMatchObject({ traineeName: 'Noor Aldeen', departmentName: 'Data Engineering', trainerName: 'Omar Nasser', durationHours: 24 });
  });

  it('carries the trainee, the training, the completion date and a unique reference', () => {
    actAs(U.superAdmin);
    const all = list().items;
    expect(all).toHaveLength(3);
    expect(new Set(all.map((c) => c.reference)).size).toBe(3);
    for (const c of all) {
      expect(c.reference).toMatch(/^DH-CERT-\d{4}-\d{8}$/);
      expect(Date.parse(c.completedAt)).not.toBeNaN();
    }
  });

  it('is not available before completion', () => {
    actAs(U.yousef);
    const inProgress = enrollmentOf(U.yousef, 'trn-0001');
    expect(error(() => certificatesMock.get(inProgress.id)).reason).toBe('certificate.notEligible');
  });

  it('becomes available the moment the enrollment is completed', () => {
    actAs(U.superAdmin);
    const e = enrollmentOf(U.yousef, 'trn-0001');
    expect(list({ search: 'yousef' }).total).toBe(0);
    e.status = 'completed';
    e.progress = 100;
    e.completedAt = new Date().toISOString();
    expect(certificatesMock.get(e.id).traineeName).toBe('Yousef Darwish');
    expect(list({ search: 'yousef' }).total).toBe(1);
  });

  it('a learner cannot open someone else\'s certificate', () => {
    actAs(U.yousef);
    const noors = enrollmentOf(U.noor, 'trn-0001');
    expect(error(() => certificatesMock.get(noors.id)).reason).toBe('certificate.notYours');
  });

  it('a DepartmentAdmin sees certificates of their department\'s trainings only', () => {
    actAs(U.adminDataEngineering);
    expect(list().items.map((c) => c.traineeName)).toEqual(['Noor Aldeen']);
    const software = enrollmentOf(U.tariq, 'trn-0006');
    expect(error(() => certificatesMock.get(software.id)).code).toBe('FORBIDDEN');
  });

  it('searches by person, training and reference; unknown enrollment is Not Found', () => {
    actAs(U.superAdmin);
    expect(list({ search: 'hadi' }).items.map((c) => c.traineeName)).toEqual(['Hadi Mansour']);
    const ref = list().items[0]!.reference;
    expect(list({ search: ref }).items).toHaveLength(1);
    expect(error(() => certificatesMock.get('enr-9999')).code).toBe('NOT_FOUND');
  });
});
