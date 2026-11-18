import { mockRequest } from '@/core/api/mock/mockRequest';
import type { ListParams, Paginated } from '@/core/api/types';
import * as mock from '@/modules/documents/mock/documentsMock';
import type {
  CategoryFilters,
  CategoryInput,
  Document,
  DocumentCategory,
  DocumentFilters,
  DocumentInput,
  DocumentsOverview,
  DocumentSettings,
  DocumentsScope,
  DocumentSummary,
  DocumentUpdate,
  EmployeeCompliance,
  EmployeeDocuments,
  ExpiryFilters,
  ExpirySummary,
  HistoryEntry,
  OwnerOption,
  OwnerType,
  RecordStatus,
  RequiredRule,
  RequiredRuleInput,
} from '@/modules/documents/types/documents';

/*
 * Documents API service — the ONLY entry point to document data. Every call runs against the SIMULATED backend (`mock/`);
 * with the .NET backend each body becomes an HTTP call returning the same types (no URLs are invented before the contract
 * exists). `scope` exists only because the mock has no token: the real backend derives it from the session and checks
 * access, confidentiality and ownership on EVERY request.
 *
 * FILES: this phase sends file NAMES and SIZES only — never the content — and nothing is stored or downloadable. A future
 * backend must accept the content in an authenticated upload, scan and store it encrypted, and serve downloads only
 * through an authorised, audited request (see `FileRef` in types/documents.ts).
 */

type Signal = AbortSignal | undefined;
const run = <T>(handler: () => T, signal?: Signal) => mockRequest(handler, { signal });

export type ComplianceFilters = mock.ComplianceFilters;

export const documentsApi = {
  /* Documents */
  getDocumentsOverview: (scope: DocumentsScope, signal?: Signal): Promise<DocumentsOverview> => run(() => mock.overview(scope), signal),
  getDocuments: (params: ListParams<DocumentFilters>, scope: DocumentsScope, signal?: Signal): Promise<Paginated<DocumentSummary>> => run(() => mock.listDocuments(params, scope), signal),
  getDocumentById: (id: string, scope: DocumentsScope, signal?: Signal): Promise<Document> => run(() => mock.getDocument(id, scope), signal),
  /** SIMULATED upload: metadata and file names/sizes only. */
  createDocument: (input: DocumentInput, scope: DocumentsScope): Promise<Document> => run(() => mock.createDocument(input, scope)),
  updateDocument: (id: string, input: DocumentUpdate, scope: DocumentsScope): Promise<Document> => run(() => mock.updateDocument(id, input, scope)),
  archiveDocument: (id: string, reason: string, scope: DocumentsScope): Promise<Document> => run(() => mock.archiveDocument(id, reason, scope)),
  replaceDocument: (id: string, input: Omit<DocumentInput, 'ownerType' | 'ownerId'>, scope: DocumentsScope): Promise<Document> => run(() => mock.replaceDocument(id, input, scope)),
  getEmployeeDocuments: (employeeId: string, scope: DocumentsScope, signal?: Signal): Promise<EmployeeDocuments> => run(() => mock.employeeDocuments(employeeId, scope), signal),
  /** Self-service: the caller's own documents. */
  getMyDocuments: (scope: DocumentsScope, signal?: Signal): Promise<EmployeeDocuments> => run(() => mock.myDocuments(scope), signal),
  getCandidateDocuments: (candidateId: string, scope: DocumentsScope, signal?: Signal): Promise<DocumentSummary[]> => run(() => mock.candidateDocuments(candidateId, scope), signal),
  getOwnerOptions: (search: string, type: OwnerType, scope: DocumentsScope, signal?: Signal): Promise<OwnerOption[]> => run(() => mock.ownerOptions(search, type, scope), signal),

  /* Categories */
  getDocumentCategories: (params: ListParams<CategoryFilters>, scope: DocumentsScope, signal?: Signal): Promise<Paginated<DocumentCategory>> => run(() => mock.listCategories(params, scope), signal),
  createDocumentCategory: (input: CategoryInput, scope: DocumentsScope): Promise<DocumentCategory> => run(() => mock.createCategory(input, scope)),
  updateDocumentCategory: (id: string, input: CategoryInput, scope: DocumentsScope): Promise<DocumentCategory> => run(() => mock.updateCategory(id, input, scope)),
  updateDocumentCategoryStatus: (id: string, status: RecordStatus, scope: DocumentsScope): Promise<DocumentCategory> => run(() => mock.updateCategoryStatus(id, status, scope)),

  /* Verification */
  verifyDocument: (id: string, scope: DocumentsScope): Promise<Document> => run(() => mock.verifyDocument(id, scope)),
  rejectDocument: (id: string, reason: string, scope: DocumentsScope): Promise<Document> => run(() => mock.rejectDocument(id, reason, scope)),
  requestDocumentReplacement: (id: string, reason: string, scope: DocumentsScope): Promise<Document> => run(() => mock.requestReplacement(id, reason, scope)),
  addDocumentNote: (id: string, text: string, scope: DocumentsScope): Promise<Document> => run(() => mock.addNote(id, text, scope)),
  getDocumentHistory: (id: string, scope: DocumentsScope, signal?: Signal): Promise<HistoryEntry[]> => run(() => mock.documentHistory(id, scope), signal),

  /* Expiry */
  getExpiringDocuments: (params: ListParams<ExpiryFilters>, scope: DocumentsScope, signal?: Signal): Promise<Paginated<DocumentSummary>> => run(() => mock.expiringDocuments(params, scope), signal),
  getExpiredDocuments: (params: ListParams<Omit<ExpiryFilters, 'window'>>, scope: DocumentsScope, signal?: Signal): Promise<Paginated<DocumentSummary>> => run(() => mock.expiredDocuments(params, scope), signal),
  getDocumentExpirySummary: (scope: DocumentsScope, signal?: Signal): Promise<ExpirySummary> => run(() => mock.expirySummary(scope), signal),
  getDocumentSettings: (scope: DocumentsScope, signal?: Signal): Promise<DocumentSettings> => run(() => mock.getSettings(scope), signal),
  updateDocumentSettings: (input: { expiryWarningDays: number }, scope: DocumentsScope): Promise<DocumentSettings> => run(() => mock.updateSettings(input, scope)),

  /* Compliance */
  getRequiredDocuments: (scope: DocumentsScope, signal?: Signal): Promise<RequiredRule[]> => run(() => mock.listRules(scope), signal),
  createRequiredDocumentRule: (input: RequiredRuleInput, scope: DocumentsScope): Promise<RequiredRule> => run(() => mock.createRule(input, scope)),
  updateRequiredDocumentRule: (id: string, input: RequiredRuleInput, scope: DocumentsScope): Promise<RequiredRule> => run(() => mock.updateRule(id, input, scope)),
  updateRequiredDocumentRuleStatus: (id: string, status: RecordStatus, scope: DocumentsScope): Promise<RequiredRule> => run(() => mock.updateRuleStatus(id, status, scope)),
  getEmployeeDocumentCompliance: (employeeId: string, scope: DocumentsScope, signal?: Signal): Promise<EmployeeCompliance> => run(() => mock.employeeCompliance(employeeId, scope), signal),
  getComplianceList: (params: ListParams<ComplianceFilters>, scope: DocumentsScope, signal?: Signal): Promise<Paginated<EmployeeCompliance>> => run(() => mock.complianceList(params, scope), signal),
};
