import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListParams } from '@/core/api/types';
import { documentsApi, type ComplianceFilters } from '@/modules/documents/api/documentsApi';
import type { CategoryFilters, CategoryInput, DocumentFilters, DocumentInput, DocumentsScope, DocumentUpdate, ExpiryFilters, OwnerType, RecordStatus, RequiredRuleInput } from '@/modules/documents/types/documents';
import { useDocumentsAccess } from './useDocumentsAccess';

/**
 * Query keys: `['documents', <resource>, scope, …]` — the scope (user + role) is part of every read key, so documents
 * visible to one user are never served from another user's cache entry.
 */
export const documentKeys = {
  all: ['documents'] as const,
  overview: (s: DocumentsScope) => [...documentKeys.all, 'overview', s] as const,
  list: (s: DocumentsScope, p: ListParams<DocumentFilters>) => [...documentKeys.all, 'list', s, p] as const,
  detail: (s: DocumentsScope, id: string) => [...documentKeys.all, 'detail', s, id] as const,
  employee: (s: DocumentsScope, id: string) => [...documentKeys.all, 'employee', s, id] as const,
  my: (s: DocumentsScope) => [...documentKeys.all, 'my', s] as const,
  candidate: (s: DocumentsScope, id: string) => [...documentKeys.all, 'candidate', s, id] as const,
  categories: (s: DocumentsScope, p: ListParams<CategoryFilters>) => [...documentKeys.all, 'categories', s, p] as const,
  expiring: (s: DocumentsScope, p: ListParams<ExpiryFilters>) => [...documentKeys.all, 'expiring', s, p] as const,
  expirySummary: (s: DocumentsScope) => [...documentKeys.all, 'expiry-summary', s] as const,
  settings: (s: DocumentsScope) => [...documentKeys.all, 'settings', s] as const,
  rules: (s: DocumentsScope) => [...documentKeys.all, 'rules', s] as const,
  compliance: (s: DocumentsScope, p: ListParams<ComplianceFilters>) => [...documentKeys.all, 'compliance', s, p] as const,
  owners: (s: DocumentsScope, type: OwnerType, search: string) => [...documentKeys.all, 'owners', s, type, search] as const,
};

/* Queries -------------------------------------------------------------------------------------------------- */

export function useDocumentsOverview() {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.overview(scope), queryFn: ({ signal }) => documentsApi.getDocumentsOverview(scope, signal), staleTime: 60_000 });
}
export function useDocumentList(params: ListParams<DocumentFilters>, enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.list(scope, params), queryFn: ({ signal }) => documentsApi.getDocuments(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useDocument(id: string) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.detail(scope, id), queryFn: ({ signal }) => documentsApi.getDocumentById(id, scope, signal) });
}
export function useEmployeeDocuments(employeeId: string, enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.employee(scope, employeeId), queryFn: ({ signal }) => documentsApi.getEmployeeDocuments(employeeId, scope, signal), enabled });
}
export function useMyDocuments() {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.my(scope), queryFn: ({ signal }) => documentsApi.getMyDocuments(scope, signal) });
}
export function useCandidateDocuments(candidateId: string, enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.candidate(scope, candidateId), queryFn: ({ signal }) => documentsApi.getCandidateDocuments(candidateId, scope, signal), enabled });
}
export function useDocumentCategories(params: ListParams<CategoryFilters>, enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.categories(scope, params), queryFn: ({ signal }) => documentsApi.getDocumentCategories(params, scope, signal), placeholderData: keepPreviousData, enabled, staleTime: 60_000 });
}
/** Every category (for selects and filters), sorted by code. */
export const useAllCategories = (enabled = true) => useDocumentCategories({ page: 1, pageSize: 100, sortBy: 'code', sortDirection: 'asc' }, enabled);
export function useExpiringDocuments(params: ListParams<ExpiryFilters>) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.expiring(scope, params), queryFn: ({ signal }) => documentsApi.getExpiringDocuments(params, scope, signal), placeholderData: keepPreviousData });
}
export function useExpirySummary() {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.expirySummary(scope), queryFn: ({ signal }) => documentsApi.getDocumentExpirySummary(scope, signal) });
}
export function useDocumentSettings() {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.settings(scope), queryFn: ({ signal }) => documentsApi.getDocumentSettings(scope, signal) });
}
export function useRequiredRules(enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.rules(scope), queryFn: ({ signal }) => documentsApi.getRequiredDocuments(scope, signal), enabled });
}
export function useComplianceList(params: ListParams<ComplianceFilters>, enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.compliance(scope, params), queryFn: ({ signal }) => documentsApi.getComplianceList(params, scope, signal), placeholderData: keepPreviousData, enabled });
}
export function useOwnerOptions(type: OwnerType, search: string, enabled = true) {
  const { scope } = useDocumentsAccess();
  return useQuery({ queryKey: documentKeys.owners(scope, type, search), queryFn: ({ signal }) => documentsApi.getOwnerOptions(search, type, scope, signal), placeholderData: keepPreviousData, enabled });
}

/* Mutations (every change invalidates the documents cache; uploads also refresh other modules' views of them) ----- */

function useWrite<TVars, TResult>(fn: (vars: TVars, scope: DocumentsScope) => Promise<TResult>) {
  const { scope } = useDocumentsAccess();
  const client = useQueryClient();
  return useMutation({ mutationFn: (vars: TVars) => fn(vars, scope), onSuccess: () => client.invalidateQueries({ queryKey: documentKeys.all }) });
}

export const useCreateDocument = () => useWrite((input: DocumentInput, s) => documentsApi.createDocument(input, s));
export const useUpdateDocument = () => useWrite(({ id, input }: { id: string; input: DocumentUpdate }, s) => documentsApi.updateDocument(id, input, s));
export const useReplaceDocument = () => useWrite(({ id, input }: { id: string; input: Omit<DocumentInput, 'ownerType' | 'ownerId'> }, s) => documentsApi.replaceDocument(id, input, s));
export const useArchiveDocument = () => useWrite(({ id, reason }: { id: string; reason: string }, s) => documentsApi.archiveDocument(id, reason, s));
export const useVerifyDocument = () => useWrite((id: string, s) => documentsApi.verifyDocument(id, s));
export const useRejectDocument = () => useWrite(({ id, reason }: { id: string; reason: string }, s) => documentsApi.rejectDocument(id, reason, s));
export const useRequestReplacement = () => useWrite(({ id, reason }: { id: string; reason: string }, s) => documentsApi.requestDocumentReplacement(id, reason, s));
export const useAddNote = () => useWrite(({ id, text }: { id: string; text: string }, s) => documentsApi.addDocumentNote(id, text, s));
export const useCreateCategory = () => useWrite((input: CategoryInput, s) => documentsApi.createDocumentCategory(input, s));
export const useUpdateCategory = () => useWrite(({ id, input }: { id: string; input: CategoryInput }, s) => documentsApi.updateDocumentCategory(id, input, s));
export const useUpdateCategoryStatus = () => useWrite(({ id, status }: { id: string; status: RecordStatus }, s) => documentsApi.updateDocumentCategoryStatus(id, status, s));
export const useCreateRule = () => useWrite((input: RequiredRuleInput, s) => documentsApi.createRequiredDocumentRule(input, s));
export const useUpdateRule = () => useWrite(({ id, input }: { id: string; input: RequiredRuleInput }, s) => documentsApi.updateRequiredDocumentRule(id, input, s));
export const useUpdateRuleStatus = () => useWrite(({ id, status }: { id: string; status: RecordStatus }, s) => documentsApi.updateRequiredDocumentRuleStatus(id, status, s));
export const useUpdateSettings = () => useWrite((input: { expiryWarningDays: number }, s) => documentsApi.updateDocumentSettings(input, s));
