import { FILE_TYPES, type DocumentCategory, type DocumentStatus, type ExpiryStatus, type FileType, type VerificationStatus } from '@/modules/documents/types/documents';

/*
 * Pure document rules shared by the simulated backend, the UI (upload validation before "sending") and tests. The real
 * backend must implement the same checks: the UI checks are a convenience, never a security measure.
 */

const pad = (n: number) => String(n).padStart(2, '0');
export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && formatDate(new Date(`${v}T00:00`)) === v;
export const todayIso = () => formatDate(new Date());
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}
/** Whole days from `from` to `to` (negative when `to` is earlier). DST-safe (UTC days). */
export function daysBetween(from: string, to: string): number {
  const utc = (v: string) => {
    const [y, m, d] = v.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}
export function addMonths(month: string, count: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + count, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Expiry, independent of the review decision. `thresholdDays` = the configured warning window (initially 30). */
export function expiryStatusOf(expiryDate: string | null, today: string, thresholdDays: number): ExpiryStatus {
  if (!expiryDate) return 'no-expiry';
  const days = daysBetween(today, expiryDate);
  if (days < 0) return 'expired';
  return days <= thresholdDays ? 'expiring-soon' : 'valid';
}

/** Overall status: an expired document is never shown as verified / pending (it cannot be treated as valid). */
export function overallStatus(verification: VerificationStatus, expiry: ExpiryStatus): DocumentStatus {
  if ((verification === 'verified' || verification === 'pending-review') && expiry === 'expired') return 'expired';
  return verification;
}

/** Archived and superseded documents are history: they never satisfy requirements or appear in "current" lists. */
export const isCurrent = (v: VerificationStatus) => v !== 'archived' && v !== 'superseded';

/** Lower-case extension of a file name if it is one of the known types. */
export function fileTypeOf(fileName: string): FileType | null {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  const ext = match?.[1]?.toLowerCase();
  return ext && (FILE_TYPES as readonly string[]).includes(ext) ? (ext as FileType) : null;
}

export const MAX_FILES = 5;

/** Reason a file is refused for the category (`fileType`, `fileSize`, `emptyFile`), or null. */
export function fileProblem(file: { name: string; sizeBytes: number }, category: Pick<DocumentCategory, 'allowedFileTypes' | 'maxFileSizeMb'>): 'fileType' | 'fileSize' | 'emptyFile' | null {
  const type = fileTypeOf(file.name);
  if (!type || !category.allowedFileTypes.includes(type)) return 'fileType';
  if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0) return 'emptyFile';
  if (file.sizeBytes > category.maxFileSizeMb * 1024 * 1024) return 'fileSize';
  return null;
}

/** "1.4 MB" / "820 KB" (Latin digits). */
export function fileSizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
