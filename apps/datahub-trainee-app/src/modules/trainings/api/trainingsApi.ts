import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import { assignmentsMock } from '../mock/assignmentsMock';
import { materialsMock } from '../mock/materialsMock';
import { trainingsMock } from '../mock/trainingsMock';
import type {
  AssignmentDto,
  AssignmentSubmissionDto,
  CreateAssignmentInput,
  FileInput,
  FileMaterialInput,
  LinkMaterialInput,
  MaterialDto,
  SubmissionInput,
  SubmissionOverviewEntry,
  TextMaterialInput,
  UpdateAssignmentInput,
  FileKind,
} from '../types/content';
import type { CreateTrainingInput, ReorderInput, TrainingDto, TrainingFilters, TrainingOption, TrainingRosterEntry, UpdateTrainingInput } from '../types/training';
import { usesMockData } from '@/core/config/api';
import { trainingsHttpApi } from './trainingsHttp';
import { materialsHttpApi, assignmentsHttpApi, filesHttpApi } from './contentHttp';
import type { DownloadedFile } from '@/core/api/http';
import { ApiError } from '@/core/api/types';

/**
 * The ONLY data entry points of the Trainings module (the real backend over HTTP, or the simulated one — same types).
 * `trainingsApi` — trainings; `materialsApi` — training content; `assignmentsApi` — assignments and submissions.
 */
const mockTrainingsApi = {
  list: (params: ListParams<TrainingFilters>, signal?: AbortSignal): Promise<Paginated<TrainingDto>> => mockRequest(() => trainingsMock.list(params), { signal }),
  options: (signal?: AbortSignal): Promise<TrainingOption[]> => mockRequest(() => trainingsMock.options(), { signal }),
  get: (id: string, signal?: AbortSignal): Promise<TrainingDto> => mockRequest(() => trainingsMock.get(id), { signal }),
  create: (input: CreateTrainingInput): Promise<TrainingDto> => mockRequest(() => trainingsMock.create(input)),
  update: (id: string, input: UpdateTrainingInput): Promise<TrainingDto> => mockRequest(() => trainingsMock.update(id, input)),
  remove: (id: string): Promise<void> => mockRequest(() => trainingsMock.remove(id)),
  reorder: (input: ReorderInput): Promise<void> => mockRequest(() => trainingsMock.reorder(input)),
  roster: (id: string, signal?: AbortSignal): Promise<TrainingRosterEntry[]> => mockRequest(() => trainingsMock.roster(id), { signal }),
};

const mockMaterialsApi = {
  list: (trainingId: string, signal?: AbortSignal): Promise<MaterialDto[]> => mockRequest(() => materialsMock.list(trainingId), { signal }),
  addText: (trainingId: string, input: TextMaterialInput): Promise<MaterialDto> => mockRequest(() => materialsMock.addText(trainingId, input)),
  addLinks: (trainingId: string, input: LinkMaterialInput): Promise<MaterialDto> => mockRequest(() => materialsMock.addLinks(trainingId, input)),
  addFiles: (trainingId: string, input: FileMaterialInput): Promise<MaterialDto> => mockRequest(() => materialsMock.addFiles(trainingId, input)),
  updateText: (materialId: string, input: TextMaterialInput): Promise<MaterialDto> => mockRequest(() => materialsMock.updateText(materialId, input)),
  updateLinks: (materialId: string, input: LinkMaterialInput): Promise<MaterialDto> => mockRequest(() => materialsMock.updateLinks(materialId, input)),
  renameFiles: (materialId: string, title: string): Promise<MaterialDto> => mockRequest(() => materialsMock.renameFiles(materialId, { title })),
  addFileItems: (materialId: string, files: FileInput[]): Promise<MaterialDto> => mockRequest(() => materialsMock.addFileItems(materialId, files)),
  updateFileItem: (materialId: string, fileId: string, title: string | null): Promise<MaterialDto> => mockRequest(() => materialsMock.updateFileItem(materialId, fileId, { title })),
  deleteFileItem: (materialId: string, fileId: string): Promise<void> => mockRequest(() => materialsMock.deleteFileItem(materialId, fileId)),
  remove: (materialId: string): Promise<void> => mockRequest(() => materialsMock.remove(materialId)),
  reorder: (trainingId: string, input: ReorderInput): Promise<void> => mockRequest(() => materialsMock.reorder(trainingId, input)),
};

const mockAssignmentsApi = {
  list: (trainingId: string, signal?: AbortSignal): Promise<AssignmentDto[]> => mockRequest(() => assignmentsMock.list(trainingId), { signal }),
  create: (trainingId: string, input: CreateAssignmentInput): Promise<AssignmentDto> => mockRequest(() => assignmentsMock.create(trainingId, input)),
  update: (assignmentId: string, input: UpdateAssignmentInput): Promise<AssignmentDto> => mockRequest(() => assignmentsMock.update(assignmentId, input)),
  remove: (assignmentId: string): Promise<void> => mockRequest(() => assignmentsMock.remove(assignmentId)),
  addAttachments: (assignmentId: string, files: FileInput[]): Promise<AssignmentDto> => mockRequest(() => assignmentsMock.addAttachments(assignmentId, files)),
  deleteAttachment: (assignmentId: string, attachmentId: string): Promise<void> => mockRequest(() => assignmentsMock.deleteAttachment(assignmentId, attachmentId)),
  submissions: (trainingId: string, assignmentId: string, signal?: AbortSignal): Promise<SubmissionOverviewEntry[]> => mockRequest(() => assignmentsMock.submissions(trainingId, assignmentId), { signal }),
  submit: (trainingId: string, assignmentId: string, input: SubmissionInput): Promise<AssignmentSubmissionDto> => mockRequest(() => assignmentsMock.submit(trainingId, assignmentId, input)),
  deleteSubmissionAttachment: (trainingId: string, assignmentId: string, attachmentId: string): Promise<void> => mockRequest(() => assignmentsMock.deleteSubmissionAttachment(trainingId, assignmentId, attachmentId)),
};

/** Stored files. The simulated backend keeps file names and sizes only — there is nothing to open. */
const mockFilesApi = {
  download: (_kind: FileKind, _fileId: string, signal?: AbortSignal): Promise<DownloadedFile> =>
    mockRequest(() => {
      throw new ApiError('NOT_FOUND', 'file.simulated');
    }, { signal }),
};

// Real backend by default; the simulated one in tests and with `VITE_TRAINEE_DATA=mock` (core/config/api.ts).
export const trainingsApi: typeof mockTrainingsApi = usesMockData ? mockTrainingsApi : trainingsHttpApi;
export const materialsApi: typeof mockMaterialsApi = usesMockData ? mockMaterialsApi : materialsHttpApi;
export const assignmentsApi: typeof mockAssignmentsApi = usesMockData ? mockAssignmentsApi : assignmentsHttpApi;
export const filesApi: typeof mockFilesApi = usesMockData ? mockFilesApi : filesHttpApi;
