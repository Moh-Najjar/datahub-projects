import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_USERS as U } from '@/core/api/mock/seedData';
import { commit, db } from '@/core/api/mock/mockDatabase';
import { ApiError } from '@/core/api/types';
import { computeAssignmentStatus } from '@/core/utils/assignmentStatus';
import { actAs } from '@/test/actors';
import { assignmentsMock } from './assignmentsMock';
import { materialsMock } from './materialsMock';
import { fileProblem, MAX_FILE_SIZE_BYTES } from '../utils/files';

const error = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected an ApiError');
};
const file = (over: Record<string, unknown> = {}) => ({ fileName: 'notes.pdf', contentType: 'application/pdf', fileSizeBytes: 2048, ...over });
const HOUR = 3_600_000;
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR).toISOString();

describe('file rules (original: ≤ 100 MB, allowed extensions, not empty)', () => {
  it('accepts allowed files and refuses the rest', () => {
    expect(fileProblem({ fileName: 'a.PDF', fileSizeBytes: 10 })).toBeNull();
    expect(fileProblem({ fileName: 'script.py', fileSizeBytes: 10 })).toBeNull();
    expect(fileProblem({ fileName: 'a.exe', fileSizeBytes: 10 })).toBe('file.extension');
    expect(fileProblem({ fileName: 'noextension', fileSizeBytes: 10 })).toBe('file.extension');
    expect(fileProblem({ fileName: 'a.pdf', fileSizeBytes: 0 })).toBe('file.empty');
    expect(fileProblem({ fileName: 'a.pdf', fileSizeBytes: MAX_FILE_SIZE_BYTES })).toBeNull();
    expect(fileProblem({ fileName: 'a.pdf', fileSizeBytes: MAX_FILE_SIZE_BYTES + 1 })).toBe('file.tooLarge');
  });
});

describe('training content (materials)', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('adds a text material last in the order', () => {
    const before = materialsMock.list('trn-0002').length;
    const added = materialsMock.addText('trn-0002', { title: 'Week 1', content: 'Read chapter 1.' });
    expect(added).toMatchObject({ type: 'text', sortOrder: before, uploadedByUserName: 'Omar Nasser' });
    expect(materialsMock.list('trn-0002').at(-1)!.id).toBe(added.id);
  });

  it('adds link and file materials and validates them', () => {
    const links = materialsMock.addLinks('trn-0002', { title: 'Docs', links: [{ title: 'Spec', url: 'https://example.test/spec' }, { url: 'http://example.test' }] });
    expect(links.links).toHaveLength(2);
    expect(error(() => materialsMock.addLinks('trn-0002', { title: 'Bad', links: [{ url: 'not a url' }] })).fieldErrors).toEqual({ links: ['link.invalid'] });
    expect(error(() => materialsMock.addLinks('trn-0002', { title: 'Bad', links: [{ url: 'ftp://example.test/x' }] })).fieldErrors).toEqual({ links: ['link.invalid'] });
    expect(error(() => materialsMock.addLinks('trn-0002', { title: 'None', links: [] })).fieldErrors).toEqual({ links: ['link.required'] });

    const files = materialsMock.addFiles('trn-0002', { title: 'Slides', files: [file(), file({ fileName: 'deck.pptx' })] });
    expect(files.files).toHaveLength(2);
    expect(error(() => materialsMock.addFiles('trn-0002', { title: 'Slides', files: [file({ fileName: 'virus.exe' })] })).fieldErrors).toEqual({ files: ['file.extension'] });
    expect(error(() => materialsMock.addFiles('trn-0002', { title: 'Slides', files: [file({ fileSizeBytes: MAX_FILE_SIZE_BYTES + 1 })] })).fieldErrors).toEqual({ files: ['file.tooLarge'] });
    expect(error(() => materialsMock.addFiles('trn-0002', { title: 'Slides', files: [] })).fieldErrors).toEqual({ files: ['file.required'] });
  });

  it('validates titles (required, ≤ 200) and text content', () => {
    expect(error(() => materialsMock.addText('trn-0002', { title: '', content: 'x' })).fieldErrors).toEqual({ title: ['field.required'] });
    expect(error(() => materialsMock.addText('trn-0002', { title: 'x'.repeat(201), content: 'x' })).fieldErrors).toEqual({ title: ['field.tooLong'] });
    expect(error(() => materialsMock.addText('trn-0002', { title: 'ok', content: '   ' })).fieldErrors).toEqual({ content: ['field.required'] });
  });

  it('edits text and link materials, renames file groups and edits file items', () => {
    expect(materialsMock.updateText('mat-0004', { title: 'Before you start (v2)', content: 'Updated.' })).toMatchObject({ title: 'Before you start (v2)', textContent: 'Updated.' });
    expect(materialsMock.updateLinks('mat-0005', { title: 'Docs', links: [{ url: 'https://example.test/new' }] }).links.map((l) => l.url)).toEqual(['https://example.test/new']);
    expect(materialsMock.renameFiles('mat-0003', { title: 'Lab files (week 1)' }).title).toBe('Lab files (week 1)');
    expect(materialsMock.updateFileItem('mat-0003', 'fil-0002', { title: 'Instructions' }).files.find((f) => f.id === 'fil-0002')!.title).toBe('Instructions');
    expect(materialsMock.addFileItems('mat-0003', [file()]).files).toHaveLength(3);
    materialsMock.deleteFileItem('mat-0003', 'fil-0001');
    expect(materialsMock.list('trn-0001').find((m) => m.id === 'mat-0003')!.files.map((f) => f.id)).not.toContain('fil-0001');
  });

  it('refuses the wrong endpoint for a material type', () => {
    expect(error(() => materialsMock.updateText('mat-0002', { title: 'x', content: 'y' })).reason).toBe('material.wrongType');
  });

  it('reorders materials (drag and drop) and deletes them', () => {
    materialsMock.reorder('trn-0001', { orderedIds: ['mat-0003', 'mat-0001', 'mat-0002'] });
    expect(materialsMock.list('trn-0001').map((m) => m.id)).toEqual(['mat-0003', 'mat-0001', 'mat-0002']);
    materialsMock.remove('mat-0001');
    expect(materialsMock.list('trn-0001').map((m) => m.id)).toEqual(['mat-0003', 'mat-0002']);
    expect(error(() => materialsMock.reorder('trn-0001', { orderedIds: ['mat-9999'] })).code).toBe('NOT_FOUND');
  });

  it('is restricted to authors of the training\'s department', () => {
    actAs(U.adminAi);
    expect(error(() => materialsMock.addText('trn-0001', { title: 'x', content: 'y' })).code).toBe('FORBIDDEN');
    expect(error(() => materialsMock.list('trn-0001')).code).toBe('FORBIDDEN');
    expect(error(() => materialsMock.remove('mat-0001')).code).toBe('FORBIDDEN');
  });

  it('lets a learner read the content only of trainings they are enrolled in', () => {
    actAs(U.ziad); // enrolled in trn-0001 only
    expect(materialsMock.list('trn-0001').length).toBe(3);
    expect(error(() => materialsMock.list('trn-0002')).reason).toBe('training.notEnrolled');
    expect(error(() => materialsMock.addText('trn-0001', { title: 'x', content: 'y' })).code).toBe('FORBIDDEN');
    expect(error(() => materialsMock.remove('mat-0001')).code).toBe('FORBIDDEN');
  });
});

describe('assignment status is computed, never stored', () => {
  it('Upcoming before it opens, Closed after it closes, Open in between', () => {
    const opens = '2026-06-01T09:00:00Z';
    const closes = '2026-06-10T17:00:00Z';
    expect(computeAssignmentStatus(opens, closes, Date.parse('2026-05-31T23:59:59Z'))).toBe('upcoming');
    expect(computeAssignmentStatus(opens, closes, Date.parse('2026-06-01T09:00:00Z'))).toBe('open');
    expect(computeAssignmentStatus(opens, closes, Date.parse('2026-06-10T17:00:00Z'))).toBe('open');
    expect(computeAssignmentStatus(opens, closes, Date.parse('2026-06-10T17:00:01Z'))).toBe('closed');
  });
});

describe('assignments', () => {
  beforeEach(() => actAs(U.adminDataEngineering));

  it('lists the seeded assignments with their computed status', () => {
    const list = assignmentsMock.list('trn-0001');
    expect(list.map((a) => [a.id, a.status])).toEqual([['asg-0001', 'open'], ['asg-0002', 'upcoming']]);
    expect(assignmentsMock.list('trn-0002')[0]!.status).toBe('closed');
  });

  it('creates, edits and deletes an assignment', () => {
    const created = assignmentsMock.create('trn-0002', { title: 'Quiz', description: 'Ten questions.', opensAt: iso(-1), closesAt: iso(48), attachments: [file()] });
    expect(created).toMatchObject({ status: 'open', createdByUserName: 'Omar Nasser' });
    expect(created.attachments).toHaveLength(1);
    expect(assignmentsMock.update(created.id, { title: 'Quiz v2', description: 'Twelve questions.', opensAt: iso(5), closesAt: iso(50) })).toMatchObject({ title: 'Quiz v2', status: 'upcoming' });
    assignmentsMock.remove(created.id);
    expect(assignmentsMock.list('trn-0002').some((a) => a.id === created.id)).toBe(false);
  });

  it('requires the closing time to be after the opening time', () => {
    expect(error(() => assignmentsMock.create('trn-0002', { title: 'x', description: 'y', opensAt: iso(10), closesAt: iso(2), attachments: [] })).fieldErrors).toEqual({ closesAt: ['assignment.closeBeforeOpen'] });
    expect(error(() => assignmentsMock.create('trn-0002', { title: 'x', description: 'y', opensAt: iso(1), closesAt: iso(1), attachments: [] })).fieldErrors).toEqual({ closesAt: ['assignment.closeBeforeOpen'] });
  });

  it('validates the title, description and attachments', () => {
    expect(error(() => assignmentsMock.create('trn-0002', { title: '', description: 'y', opensAt: iso(1), closesAt: iso(5), attachments: [] })).fieldErrors).toEqual({ title: ['field.required'] });
    expect(error(() => assignmentsMock.create('trn-0002', { title: 'x', description: '', opensAt: iso(1), closesAt: iso(5), attachments: [] })).fieldErrors).toEqual({ description: ['field.required'] });
    expect(error(() => assignmentsMock.create('trn-0002', { title: 'x', description: 'y', opensAt: iso(1), closesAt: iso(5), attachments: [file({ fileName: 'x.exe' })] })).fieldErrors).toEqual({ attachments: ['file.extension'] });
  });

  it('adds and removes attachments', () => {
    expect(assignmentsMock.addAttachments('asg-0002', [file(), file({ fileName: 'b.docx' })]).attachments).toHaveLength(2);
    const id = assignmentsMock.list('trn-0001').find((a) => a.id === 'asg-0002')!.attachments[0]!.id;
    assignmentsMock.deleteAttachment('asg-0002', id);
    expect(assignmentsMock.list('trn-0001').find((a) => a.id === 'asg-0002')!.attachments).toHaveLength(1);
  });

  it('refuses authors of another department', () => {
    actAs(U.adminSoftware);
    expect(error(() => assignmentsMock.create('trn-0001', { title: 'x', description: 'y', opensAt: iso(1), closesAt: iso(5), attachments: [] })).code).toBe('FORBIDDEN');
    expect(error(() => assignmentsMock.remove('asg-0001')).code).toBe('FORBIDDEN');
  });
});

describe('submissions', () => {
  it('a learner submits while the assignment is open, and resubmitting updates the same submission', () => {
    actAs(U.yousef);
    const first = assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'First draft', files: [] });
    expect(first.updatedAt).toBeNull();
    const second = assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'Final answer', files: [file({ fileName: 'schema.sql' })] });
    expect(second.id).toBe(first.id);
    expect(second.updatedAt).not.toBeNull();
    expect(second.textResponse).toBe('Final answer');
    expect(assignmentsMock.list('trn-0001')[0]!.mySubmission!.attachments).toHaveLength(1);
  });

  it('refuses a submission before the assignment opens or after it closes', () => {
    actAs(U.yousef);
    expect(error(() => assignmentsMock.submit('trn-0001', 'asg-0002', { textResponse: 'early', files: [] })).fieldErrors).toEqual({ assignment: ['assignment.notOpen'] });
    actAs(U.noor);
    expect(error(() => assignmentsMock.submit('trn-0002', 'asg-0003', { textResponse: 'late', files: [] })).fieldErrors).toEqual({ assignment: ['assignment.notOpen'] });
  });

  it('refuses more than 4000 characters and bad files', () => {
    actAs(U.yousef);
    expect(error(() => assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'x'.repeat(4001), files: [] })).fieldErrors).toEqual({ textResponse: ['field.tooLong'] });
    expect(assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'x'.repeat(4000), files: [] }).textResponse).toHaveLength(4000);
    expect(error(() => assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'ok', files: [file({ fileName: 'x.exe' })] })).fieldErrors).toEqual({ files: ['file.extension'] });
  });

  it('removes a file from the learner\'s own submission only while open', () => {
    actAs(U.noor);
    const added = assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'with file', files: [file()] });
    const attachmentId = added.attachments.at(-1)!.id;
    assignmentsMock.deleteSubmissionAttachment('trn-0001', 'asg-0001', attachmentId);
    expect(assignmentsMock.list('trn-0001')[0]!.mySubmission!.attachments).toHaveLength(0);
    expect(error(() => assignmentsMock.deleteSubmissionAttachment('trn-0002', 'asg-0003', 'fil-0005')).fieldErrors).toEqual({ assignment: ['assignment.notOpen'] });
  });

  it('only enrolled learners can submit; staff cannot', () => {
    actAs(U.ziad); // enrolled in trn-0001 only
    expect(error(() => assignmentsMock.submit('trn-0002', 'asg-0003', { textResponse: 'x', files: [] })).reason).toBe('training.notEnrolled');
    actAs(U.adminDataEngineering);
    expect(error(() => assignmentsMock.submit('trn-0001', 'asg-0001', { textResponse: 'x', files: [] })).reason).toBe('submission.roleNotAllowed');
  });

  it('staff see every enrolled person with their submission or none', () => {
    actAs(U.adminDataEngineering);
    const overview = assignmentsMock.submissions('trn-0001', 'asg-0001');
    expect(overview.map((o) => o.userName)).toEqual(['Lina Barakat', 'Noor Aldeen', 'Yousef Darwish', 'Ziad Tamimi']);
    expect(overview.find((o) => o.userName === 'Noor Aldeen')!.submission).not.toBeNull();
    expect(overview.find((o) => o.userName === 'Lina Barakat')!.submission).toBeNull();
    expect(assignmentsMock.list('trn-0001')[0]).toMatchObject({ submissionCount: 1, traineeCount: 4 });
  });

  it('learners cannot read the submissions overview', () => {
    actAs(U.noor);
    expect(error(() => assignmentsMock.submissions('trn-0001', 'asg-0001')).code).toBe('FORBIDDEN');
  });

  it('deleting an assignment deletes its submissions', () => {
    actAs(U.adminDataEngineering);
    assignmentsMock.remove('asg-0001');
    expect(db().submissions.some((s) => s.assignmentId === 'asg-0001')).toBe(false);
    commit();
  });
});
