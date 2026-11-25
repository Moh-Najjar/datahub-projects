import { createdId, http, type DownloadedFile } from '@/core/api/http';
import { arr, asRaw, bool, listOf, num, str, token, type Raw } from '@/core/api/read';
import { ApiError } from '@/core/api/types';
import { currentTrainingPermissions } from '@/core/auth/apiIdentity';
import { computeAssignmentStatus } from '@/core/utils/assignmentStatus';
import type { MaterialType } from '@/core/domain/training';
import type {
  AssignmentDto,
  AssignmentSubmissionDto,
  CreateAssignmentInput,
  FileInput,
  FileItemDto,
  FileKind,
  FileMaterialInput,
  LinkItemDto,
  LinkMaterialInput,
  MaterialDto,
  SubmissionInput,
  SubmissionOverviewEntry,
  TextMaterialInput,
  UpdateAssignmentInput,
} from '../types/content';
import type { ReorderInput } from '../types/training';

/*
 * Training content on the real backend (`/api/v1/academy/…`): materials (text / links / files) and assignments with
 * their attachments and submissions. Files are real uploads (multipart, one request per file, part name `file`).
 * - Material / assignment endpoints are addressed by id only, but `PUT` replaces the record: the last list read keeps
 *   each record (and its training) so updates start from it.
 * - Not available in the backend (2026-11-24): renaming ONE file of a material (→ "not supported").
 * Response fields are read tolerantly (Swagger has no response models).
 */

const A = '/api/v1/academy';
const LANGUAGE = 'en';

// ---- shared mapping ---------------------------------------------------------------------------------------------

function fileOf(o: Raw): FileItemDto {
  return {
    id: str(o, 'id', 'fileId') ?? '',
    title: str(o, 'title'),
    fileName: str(o, 'fileName', 'originalFileName', 'name') ?? '',
    contentType: str(o, 'contentType', 'mimeType') ?? 'application/octet-stream',
    fileSizeBytes: num(o, 'fileSizeBytes', 'sizeBytes', 'size', 'length') ?? 0,
  };
}

function materialTypeOf(value: string | null): MaterialType {
  const t = token(value);
  if (t.includes('link') || t === 'url') return 'link';
  if (t.includes('file') || t === 'document' || t === 'video' || t === 'attachment') return 'file';
  return 'text';
}

/** Download endpoints (Bearer). */
const FILE_PATHS: Record<FileKind, string> = { material: 'material-files', assignment: 'assignment-attachments', submission: 'submission-attachments' };

export const filesHttpApi = {
  /** A stored file's content (or a link to it) — see `http.download`. */
  download: (kind: FileKind, fileId: string, signal?: AbortSignal): Promise<DownloadedFile> => http.download(`${A}/${FILE_PATHS[kind]}/${encodeURIComponent(fileId)}`, signal),
};

const backendMaterialType: Record<MaterialType, string> = { text: 'Text', link: 'Link', file: 'File' };

async function upload(path: string, files: readonly FileInput[]): Promise<void> {
  for (const f of files) {
    if (!f.file) throw new ApiError('BAD_REQUEST', 'file.required');
    await http.upload(path, [f.file], f.title ? { title: f.title } : {});
  }
}

// ---- materials --------------------------------------------------------------------------------------------------

/** materialId → { trainingId, raw record } from the latest list read. */
const materialRecords = new Map<string, { trainingId: string; raw: Raw }>();

/**
 * A material's links. Verified 2026-11-25: `links` is an array of plain address strings (no id, no label) —
 * `"links": ["https://…"]`. Objects (`{ id, title, url }`) are read too, in case the backend adds them later.
 */
function linksOf(o: Raw, materialId: string): LinkItemDto[] {
  const items = Array.isArray(o.links) ? (o.links as unknown[]) : [];
  const links = items.flatMap((item): LinkItemDto[] => {
    if (typeof item === 'string') return item.trim() ? [{ id: '', title: null, url: item.trim() }] : [];
    const l = asRaw(item);
    const url = str(l, 'url', 'uri', 'linkUrl', 'href', 'address');
    return url ? [{ id: str(l, 'id', 'linkId') ?? '', title: str(l, 'title', 'name', 'label'), url }] : [];
  });
  const single = str(o, 'url');
  if (links.length === 0 && single) links.push({ id: materialId, title: null, url: single });
  return links;
}

async function toMaterial(trainingId: string, o: Raw): Promise<MaterialDto> {
  const id = str(o, 'id', 'materialId') ?? '';
  const type = materialTypeOf(str(o, 'type', 'materialType'));
  let files = arr(o, 'files', 'attachments').map(fileOf);
  if (type === 'file' && files.length === 0 && !Array.isArray(o.files)) files = listOf(await http.get(`${A}/materials/${id}/files`).catch(() => [])).map(fileOf);
  const links = linksOf(o, id);
  materialRecords.set(id, { trainingId, raw: o });
  return {
    id,
    trainingId,
    type,
    title: str(o, 'title') ?? '',
    sortOrder: num(o, 'sortOrder') ?? 0,
    textContent: str(o, 'textContent', 'content'),
    files,
    links,
    uploadedByUserName: str(o, 'uploadedByUserName', 'createdByUserName'),
    createdAt: str(o, 'createdAtUtc', 'createdAt') ?? new Date(0).toISOString(),
  };
}

async function listMaterials(trainingId: string, signal?: AbortSignal): Promise<MaterialDto[]> {
  const rows = listOf(await http.get(`${A}/trainings/${trainingId}/materials`, { query: { languageCode: LANGUAGE }, signal }));
  return (await Promise.all(rows.map((o) => toMaterial(trainingId, o)))).sort((a, b) => a.sortOrder - b.sortOrder);
}

function materialRecord(materialId: string) {
  const record = materialRecords.get(materialId);
  if (!record) throw new ApiError('NOT_FOUND', 'material.notFound');
  return record;
}

async function reloadMaterial(trainingId: string, materialId: string): Promise<MaterialDto> {
  const found = (await listMaterials(trainingId)).find((m) => m.id === materialId);
  if (!found) throw new ApiError('NOT_FOUND', 'material.notFound');
  return found;
}

async function createMaterial(trainingId: string, type: MaterialType, title: string, textContent: string | null): Promise<string> {
  const count = (await listMaterials(trainingId)).length;
  return createdId(await http.post(`${A}/trainings/${trainingId}/materials`, { trainingId, type: backendMaterialType[type], sortOrder: count + 1, isRequired: false, languageCode: LANGUAGE, title: title.trim(), textContent }));
}

/** `PUT /materials/{id}` with the current record's fields and the changes. */
async function putMaterial(materialId: string, changes: { title?: string; textContent?: string | null; sortOrder?: number }): Promise<void> {
  const { raw } = materialRecord(materialId);
  await http.put(`${A}/materials/${materialId}`, {
    moduleId: str(raw, 'moduleId'),
    type: str(raw, 'type') ?? backendMaterialType[materialTypeOf(str(raw, 'type'))],
    sortOrder: changes.sortOrder ?? num(raw, 'sortOrder') ?? 0,
    estimatedDurationMinutes: num(raw, 'estimatedDurationMinutes'),
    isRequired: bool(raw, 'isRequired') ?? false,
    isPublished: bool(raw, 'isPublished') ?? true,
    languageCode: LANGUAGE,
    title: (changes.title ?? str(raw, 'title') ?? '').trim(),
    textContent: changes.textContent !== undefined ? changes.textContent : str(raw, 'textContent'),
    url: str(raw, 'url'),
  });
}

async function addLinks(materialId: string, links: LinkMaterialInput['links']): Promise<void> {
  let n = 0;
  for (const link of links) await http.post(`${A}/materials/${materialId}/links`, { title: link.title?.trim() || null, url: link.url.trim(), sortOrder: ++n });
}

export const materialsHttpApi = {
  list: listMaterials,
  async addText(trainingId: string, input: TextMaterialInput): Promise<MaterialDto> {
    return reloadMaterial(trainingId, await createMaterial(trainingId, 'text', input.title, input.content));
  },
  async addLinks(trainingId: string, input: LinkMaterialInput): Promise<MaterialDto> {
    const id = await createMaterial(trainingId, 'link', input.title, null);
    await addLinks(id, input.links);
    return reloadMaterial(trainingId, id);
  },
  async addFiles(trainingId: string, input: FileMaterialInput): Promise<MaterialDto> {
    const id = await createMaterial(trainingId, 'file', input.title, null);
    await upload(`${A}/materials/${id}/files`, input.files);
    return reloadMaterial(trainingId, id);
  },
  async updateText(materialId: string, input: TextMaterialInput): Promise<MaterialDto> {
    const { trainingId } = materialRecord(materialId);
    await putMaterial(materialId, { title: input.title, textContent: input.content });
    return reloadMaterial(trainingId, materialId);
  },
  async updateLinks(materialId: string, input: LinkMaterialInput): Promise<MaterialDto> {
    const { trainingId } = materialRecord(materialId);
    const current = await reloadMaterial(trainingId, materialId);
    await putMaterial(materialId, { title: input.title });
    const sameAddresses = JSON.stringify(current.links.map((l) => l.url)) === JSON.stringify(input.links.map((l) => l.url.trim()));
    if (sameAddresses) return reloadMaterial(trainingId, materialId);
    if (current.links.every((l) => l.id && l.id !== materialId)) {
      // Links with ids: remove the old ones, add the new list in order.
      for (const link of current.links) await http.delete(`${A}/material-links/${link.id}`);
      await addLinks(materialId, input.links);
      return reloadMaterial(trainingId, materialId);
    }
    // The backend lists links without ids (2026-11-25), so they cannot be removed one by one: replace the material —
    // a new links material at the same place, then the old one is deleted.
    const order = (await listMaterials(trainingId)).map((m) => m.id);
    const replacement = await createMaterial(trainingId, 'link', input.title, null);
    await addLinks(replacement, input.links);
    // Delete the old one BEFORE reordering: the order must list exactly the training's current materials.
    await http.delete(`${A}/materials/${materialId}`);
    materialRecords.delete(materialId);
    const existing = new Set((await listMaterials(trainingId)).map((m) => m.id));
    const wanted = order.map((id) => (id === materialId ? replacement : id)).filter((id) => existing.has(id));
    // Anything added meanwhile goes last; if the order is still refused, the links are saved anyway (the item stays last).
    await http
      .put(`${A}/trainings/${trainingId}/materials/order`, { materialIds: [...wanted, ...[...existing].filter((id) => !wanted.includes(id))] })
      .catch(() => undefined);
    return reloadMaterial(trainingId, replacement);
  },
  async renameFiles(materialId: string, title: string): Promise<MaterialDto> {
    const { trainingId } = materialRecord(materialId);
    await putMaterial(materialId, { title });
    return reloadMaterial(trainingId, materialId);
  },
  async addFileItems(materialId: string, files: FileInput[]): Promise<MaterialDto> {
    const { trainingId } = materialRecord(materialId);
    await upload(`${A}/materials/${materialId}/files`, files);
    return reloadMaterial(trainingId, materialId);
  },
  updateFileItem(): Promise<MaterialDto> {
    // The backend has no endpoint to rename one file of a material.
    return Promise.reject(new ApiError('BAD_REQUEST', 'api.notSupported'));
  },
  async deleteFileItem(_materialId: string, fileId: string): Promise<void> {
    await http.delete(`${A}/material-files/${fileId}`);
  },
  async remove(materialId: string): Promise<void> {
    await http.delete(`${A}/materials/${materialId}`);
    materialRecords.delete(materialId);
  },
  async reorder(trainingId: string, input: ReorderInput): Promise<void> {
    await http.put(`${A}/trainings/${trainingId}/materials/order`, { materialIds: input.orderedIds });
  },
};

// ---- assignments and submissions --------------------------------------------------------------------------------

/** assignmentId → { trainingId, raw record } from the latest list read. */
const assignmentRecords = new Map<string, { trainingId: string; raw: Raw }>();

async function submissionOf(o: Raw): Promise<AssignmentSubmissionDto> {
  const id = str(o, 'id', 'submissionId') ?? '';
  let attachments = arr(o, 'attachments', 'files').map(fileOf);
  if (attachments.length === 0 && !Array.isArray(o.attachments) && id) attachments = listOf(await http.get(`${A}/submissions/${id}/attachments`).catch(() => [])).map(fileOf);
  return {
    id,
    assignmentId: str(o, 'assignmentId') ?? '',
    userId: str(o, 'userId', 'submittedByUserId') ?? '',
    textResponse: str(o, 'textResponse') ?? '',
    submittedAt: str(o, 'submittedAtUtc', 'createdAtUtc', 'submittedAt') ?? new Date(0).toISOString(),
    updatedAt: str(o, 'updatedAtUtc', 'updatedAt'),
    attachments,
  };
}

/** The caller's own submission (404 / none → null). */
async function mySubmission(assignmentId: string, signal?: AbortSignal): Promise<AssignmentSubmissionDto | null> {
  try {
    const data = await http.get(`${A}/assignments/${assignmentId}/my-submission`, { signal });
    return data ? submissionOf(asRaw(data)) : null;
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')) return null;
    throw error;
  }
}

async function toAssignment(trainingId: string, o: Raw, learner: boolean, signal?: AbortSignal): Promise<AssignmentDto> {
  const id = str(o, 'id', 'assignmentId') ?? '';
  const opensAt = str(o, 'opensAtUtc', 'opensAt') ?? new Date(0).toISOString();
  const closesAt = str(o, 'closesAtUtc', 'closesAt') ?? new Date(0).toISOString();
  let attachments = arr(o, 'attachments', 'files').map(fileOf);
  if (attachments.length === 0 && !Array.isArray(o.attachments)) attachments = listOf(await http.get(`${A}/assignments/${id}/attachments`, { signal }).catch(() => [])).map(fileOf);
  assignmentRecords.set(id, { trainingId, raw: o });
  return {
    id,
    trainingId,
    title: str(o, 'title') ?? '',
    description: str(o, 'description') ?? '',
    opensAt,
    closesAt,
    status: computeAssignmentStatus(opensAt, closesAt),
    createdByUserName: str(o, 'createdByUserName'),
    createdAt: str(o, 'createdAtUtc', 'createdAt') ?? new Date(0).toISOString(),
    attachments,
    mySubmission: learner ? await mySubmission(id, signal) : null,
    submissionCount: num(o, 'submissionCount') ?? 0,
    traineeCount: num(o, 'traineeCount', 'enrollmentCount') ?? 0,
  };
}

/** Learners (people who submit assignments) see their own submission on each assignment. */
const isLearner = () => currentTrainingPermissions().includes('assignments.submit');

async function listAssignments(trainingId: string, signal?: AbortSignal): Promise<AssignmentDto[]> {
  const rows = listOf(await http.get(`${A}/trainings/${trainingId}/assignments`, { query: { languageCode: LANGUAGE }, signal }));
  return (await Promise.all(rows.map((o) => toAssignment(trainingId, o, isLearner(), signal)))).sort((a, b) => a.opensAt.localeCompare(b.opensAt));
}

function assignmentRecord(assignmentId: string) {
  const record = assignmentRecords.get(assignmentId);
  if (!record) throw new ApiError('NOT_FOUND', 'assignment.notFound');
  return record;
}

async function reloadAssignment(trainingId: string, assignmentId: string): Promise<AssignmentDto> {
  const found = (await listAssignments(trainingId)).find((a) => a.id === assignmentId);
  if (!found) throw new ApiError('NOT_FOUND', 'assignment.notFound');
  return found;
}

const assignmentBody = (raw: Raw, input: { title: string; description: string; opensAt: string; closesAt: string }) => ({
  moduleId: str(raw, 'moduleId'),
  opensAtUtc: new Date(input.opensAt).toISOString(),
  closesAtUtc: new Date(input.closesAt).toISOString(),
  maxScore: num(raw, 'maxScore') ?? 100,
  passingScore: num(raw, 'passingScore'),
  maxAttempts: num(raw, 'maxAttempts') ?? 1,
  allowLateSubmission: bool(raw, 'allowLateSubmission') ?? false,
  isRequired: bool(raw, 'isRequired') ?? true,
  languageCode: LANGUAGE,
  title: input.title.trim(),
  description: input.description.trim(),
});

/** The caller's enrollment in a training (needed to submit). */
async function myEnrollmentId(trainingId: string): Promise<string> {
  const mine = listOf(await http.get(`${A}/me/enrollments`)).find((e) => str(e, 'trainingId') === trainingId);
  const id = mine ? str(mine, 'id', 'enrollmentId') : null;
  if (!id) throw new ApiError('FORBIDDEN', 'submission.notEnrolled');
  return id;
}

export const assignmentsHttpApi = {
  list: listAssignments,
  async create(trainingId: string, input: CreateAssignmentInput): Promise<AssignmentDto> {
    const id = createdId(await http.post(`${A}/trainings/${trainingId}/assignments`, { trainingId, ...assignmentBody({}, input) }));
    await upload(`${A}/assignments/${id}/attachments`, input.attachments);
    return reloadAssignment(trainingId, id);
  },
  async update(assignmentId: string, input: UpdateAssignmentInput): Promise<AssignmentDto> {
    const { trainingId, raw } = assignmentRecord(assignmentId);
    await http.put(`${A}/assignments/${assignmentId}`, assignmentBody(raw, input));
    return reloadAssignment(trainingId, assignmentId);
  },
  async remove(assignmentId: string): Promise<void> {
    await http.delete(`${A}/assignments/${assignmentId}`);
    assignmentRecords.delete(assignmentId);
  },
  async addAttachments(assignmentId: string, files: FileInput[]): Promise<AssignmentDto> {
    const { trainingId } = assignmentRecord(assignmentId);
    await upload(`${A}/assignments/${assignmentId}/attachments`, files);
    return reloadAssignment(trainingId, assignmentId);
  },
  async deleteAttachment(_assignmentId: string, attachmentId: string): Promise<void> {
    await http.delete(`${A}/assignment-attachments/${attachmentId}`);
  },
  /** Every enrolled person of the training with their submission (or none). */
  async submissions(trainingId: string, assignmentId: string, signal?: AbortSignal): Promise<SubmissionOverviewEntry[]> {
    const [enrolled, submitted] = await Promise.all([
      http.get(`${A}/enrollments`, { query: { trainingId }, signal }).then(listOf),
      http.get(`${A}/assignments/${assignmentId}/submissions`, { signal }).then(listOf),
    ]);
    const submissions = await Promise.all(submitted.map(submissionOf));
    return enrolled
      .map((e) => {
        const userId = str(e, 'userId') ?? '';
        const enrollmentId = str(e, 'id', 'enrollmentId');
        const submission = submissions.find((s, i) => s.userId === userId || str(submitted[i]!, 'enrollmentId') === enrollmentId) ?? null;
        return { userId, userName: str(e, 'userDisplayName', 'userName', 'displayName', 'traineeName') ?? '', submission };
      })
      .sort((a, b) => a.userName.localeCompare(b.userName));
  },
  async submit(trainingId: string, assignmentId: string, input: SubmissionInput): Promise<AssignmentSubmissionDto> {
    const existing = await mySubmission(assignmentId);
    const id = createdId(
      await http.post(`${A}/submissions`, { assignmentId, enrollmentId: await myEnrollmentId(trainingId), trainingId, attemptNumber: 1, textResponse: input.textResponse.trim(), submit: true }),
    );
    await upload(`${A}/submissions/${id}/attachments`, input.files);
    const saved = await mySubmission(assignmentId);
    if (saved) return saved;
    // The backend answered without the submission being readable yet: return what was sent.
    return { id, assignmentId, userId: '', textResponse: input.textResponse.trim(), submittedAt: existing?.submittedAt ?? new Date().toISOString(), updatedAt: existing ? new Date().toISOString() : null, attachments: [] };
  },
  async deleteSubmissionAttachment(_trainingId: string, _assignmentId: string, attachmentId: string): Promise<void> {
    await http.delete(`${A}/submission-attachments/${attachmentId}`);
  },
};
