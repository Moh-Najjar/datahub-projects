import { forbidden, invalid, notFound } from '@/core/api/mock/access';
import type { DbAssignment, DbSubmission } from '@/core/api/mock/dbTypes';
import { commit, db, newId } from '@/core/api/mock/mockDatabase';
import { isLearnerRole } from '@/core/auth/trainingPolicy';
import type { AssignmentDto, AssignmentSubmissionDto, CreateAssignmentInput, FileInput, SubmissionInput, SubmissionOverviewEntry, UpdateAssignmentInput } from '../types/content';
import { computeAssignmentStatus } from '@/core/utils/assignmentStatus';
import { authorTraining, storeFiles, viewTraining } from './contentAccess';

/*
 * Simulated Assignments backend — the rules of the original AssignmentService / AssignmentSubmissionService:
 *  - SuperAdmin / the department's DepartmentAdmin create, edit and delete assignments (title ≤ 200, a description,
 *    and a closing time AFTER the opening time) and attach files;
 *  - the status (Upcoming / Open / Closed) is computed from the times on every read;
 *  - only Trainee / Employee / Intern can submit, only while the assignment is Open, with text ≤ 4000 characters and
 *    files (≤ 100 MB, allowed extensions); resubmitting updates their one submission;
 *  - staff see every enrolled person with their submission (or none yet).
 * Files are SIMULATED: metadata only.
 */

function submissionDto(submission: DbSubmission): AssignmentSubmissionDto {
  return { id: submission.id, assignmentId: submission.assignmentId, userId: submission.userId, textResponse: submission.textResponse, submittedAt: submission.submittedAt, updatedAt: submission.updatedAt, attachments: submission.attachments };
}

function toDto(assignment: DbAssignment, viewerId: string, viewerIsLearner: boolean): AssignmentDto {
  const database = db();
  const enrolled = database.enrollments.filter((e) => e.trainingId === assignment.trainingId);
  const submissions = database.submissions.filter((s) => s.assignmentId === assignment.id);
  const mine = viewerIsLearner ? submissions.find((s) => s.userId === viewerId) : undefined;
  return {
    id: assignment.id,
    trainingId: assignment.trainingId,
    title: assignment.title,
    description: assignment.description,
    opensAt: assignment.opensAt,
    closesAt: assignment.closesAt,
    status: computeAssignmentStatus(assignment.opensAt, assignment.closesAt),
    createdByUserName: database.users.find((u) => u.id === assignment.createdByUserId)?.fullName ?? null,
    createdAt: assignment.createdAt,
    attachments: assignment.attachments,
    mySubmission: mine ? submissionDto(mine) : null,
    submissionCount: submissions.filter((s) => enrolled.some((e) => e.userId === s.userId)).length,
    traineeCount: enrolled.length,
  };
}

function cleanCore(input: UpdateAssignmentInput): UpdateAssignmentInput {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) invalid('title', 'field.required');
  if (title.length > 200) invalid('title', 'field.tooLong');
  if (!description) invalid('description', 'field.required');
  const opens = Date.parse(input.opensAt);
  const closes = Date.parse(input.closesAt);
  if (Number.isNaN(opens)) invalid('opensAt', 'field.date');
  if (Number.isNaN(closes)) invalid('closesAt', 'field.date');
  if (closes <= opens) invalid('closesAt', 'assignment.closeBeforeOpen');
  return { title, description, opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString() };
}

/** The assignment, after checking the caller may author its training. */
function authorAssignment(assignmentId: string): DbAssignment {
  const assignment = db().assignments.find((a) => a.id === assignmentId) ?? notFound('assignment.notFound');
  authorTraining(assignment.trainingId);
  return assignment;
}

function inTraining(trainingId: string, assignmentId: string): DbAssignment {
  return db().assignments.find((a) => a.id === assignmentId && a.trainingId === trainingId) ?? notFound('assignment.notFound');
}

export const assignmentsMock = {
  list(trainingId: string): AssignmentDto[] {
    const { actor } = viewTraining(trainingId);
    return db()
      .assignments.filter((a) => a.trainingId === trainingId)
      .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt))
      .map((a) => toDto(a, actor.userId, isLearnerRole(actor.role)));
  },

  create(trainingId: string, input: CreateAssignmentInput): AssignmentDto {
    const { actor } = authorTraining(trainingId);
    const core = cleanCore(input);
    const assignment: DbAssignment = { id: newId('asg'), trainingId, ...core, createdByUserId: actor.userId, createdAt: new Date().toISOString(), attachments: storeFiles(input.attachments, 'attachments') };
    db().assignments.push(assignment);
    commit();
    return toDto(assignment, actor.userId, false);
  },

  update(assignmentId: string, input: UpdateAssignmentInput): AssignmentDto {
    const assignment = authorAssignment(assignmentId);
    Object.assign(assignment, cleanCore(input));
    commit();
    return toDto(assignment, '', false);
  },

  remove(assignmentId: string): void {
    const assignment = authorAssignment(assignmentId);
    const database = db();
    database.submissions = database.submissions.filter((s) => s.assignmentId !== assignment.id);
    database.assignments = database.assignments.filter((a) => a.id !== assignment.id);
    commit();
  },

  addAttachments(assignmentId: string, files: readonly FileInput[]): AssignmentDto {
    const assignment = authorAssignment(assignmentId);
    if (files.length === 0) invalid('attachments', 'file.required');
    assignment.attachments.push(...storeFiles(files, 'attachments'));
    commit();
    return toDto(assignment, '', false);
  },

  deleteAttachment(assignmentId: string, attachmentId: string): void {
    const assignment = authorAssignment(assignmentId);
    if (!assignment.attachments.some((f) => f.id === attachmentId)) notFound('file.notFound');
    assignment.attachments = assignment.attachments.filter((f) => f.id !== attachmentId);
    commit();
  },

  /** Staff: every enrolled person with their submission or none. */
  submissions(trainingId: string, assignmentId: string): SubmissionOverviewEntry[] {
    authorTraining(trainingId);
    inTraining(trainingId, assignmentId);
    const database = db();
    return database.enrollments
      .filter((e) => e.trainingId === trainingId)
      .map((e) => {
        const submission = database.submissions.find((s) => s.assignmentId === assignmentId && s.userId === e.userId);
        return { userId: e.userId, userName: database.users.find((u) => u.id === e.userId)?.fullName ?? '', submission: submission ? submissionDto(submission) : null } satisfies SubmissionOverviewEntry;
      })
      .sort((a, b) => a.userName.localeCompare(b.userName));
  },

  /** Learner: create or update their own submission — only while the assignment is Open. */
  submit(trainingId: string, assignmentId: string, input: SubmissionInput): AssignmentSubmissionDto {
    const { actor } = viewTraining(trainingId);
    if (!isLearnerRole(actor.role)) forbidden('submission.roleNotAllowed');
    const assignment = inTraining(trainingId, assignmentId);
    if (computeAssignmentStatus(assignment.opensAt, assignment.closesAt) !== 'open') invalid('assignment', 'assignment.notOpen');
    if (input.textResponse.length > 4000) invalid('textResponse', 'field.tooLong');
    const files = storeFiles(input.files, 'files');
    const database = db();
    const now = new Date().toISOString();
    let submission = database.submissions.find((s) => s.assignmentId === assignmentId && s.userId === actor.userId);
    if (submission) {
      submission.textResponse = input.textResponse;
      submission.updatedAt = now;
      submission.attachments.push(...files);
    } else {
      submission = { id: newId('sub'), assignmentId, userId: actor.userId, textResponse: input.textResponse, submittedAt: now, updatedAt: null, attachments: files };
      database.submissions.push(submission);
    }
    commit();
    return submissionDto(submission);
  },

  /** Learner: remove one file of their own submission — only while the assignment is Open. */
  deleteSubmissionAttachment(trainingId: string, assignmentId: string, attachmentId: string): void {
    const { actor } = viewTraining(trainingId);
    if (!isLearnerRole(actor.role)) forbidden('submission.roleNotAllowed');
    const assignment = inTraining(trainingId, assignmentId);
    if (computeAssignmentStatus(assignment.opensAt, assignment.closesAt) !== 'open') invalid('assignment', 'assignment.notOpen');
    const submission = db().submissions.find((s) => s.assignmentId === assignmentId && s.userId === actor.userId) ?? notFound('submission.notFound');
    if (!submission.attachments.some((f) => f.id === attachmentId)) notFound('file.notFound');
    submission.attachments = submission.attachments.filter((f) => f.id !== attachmentId);
    submission.updatedAt = new Date().toISOString();
    commit();
  },
};
