/*
 * File rules of the original Training Portal (AppConstants): at most 100 MB per file, and only these extensions.
 * Used by the forms (instant feedback) and by the simulated backend (the rule's owner).
 */

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp4', '.mov', '.avi', '.mkv',
  '.zip', '.rar', '.7z',
  '.png', '.jpg', '.jpeg', '.gif', '.svg',
  '.cs', '.ts', '.tsx', '.js', '.jsx', '.py', '.sql', '.json', '.txt', '.md',
] as const;

export type FileProblem = 'file.empty' | 'file.tooLarge' | 'file.extension';

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase();
}

/** The first rule a file breaks, or `null` when it is acceptable. */
export function fileProblem(file: { fileName: string; fileSizeBytes: number }): FileProblem | null {
  if (file.fileSizeBytes <= 0) return 'file.empty';
  if (file.fileSizeBytes > MAX_FILE_SIZE_BYTES) return 'file.tooLarge';
  if (!(ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(extensionOf(file.fileName))) return 'file.extension';
  return null;
}

/** The value for an `<input type="file" accept>`. */
export const FILE_ACCEPT = ALLOWED_FILE_EXTENSIONS.join(',');

/** Metadata of browser `File` objects (the bytes stay in the browser). */
export function toFileInputs(files: readonly File[]): { fileName: string; contentType: string; fileSizeBytes: number }[] {
  return files.map((file) => ({ fileName: file.name, contentType: file.type || 'application/octet-stream', fileSizeBytes: file.size }));
}

/** True when every file passes the original rules (and there is at least one when `required`). */
export function filesAreValid(files: readonly File[], required = false): boolean {
  if (required && files.length === 0) return false;
  return files.every((f) => fileProblem({ fileName: f.name, fileSizeBytes: f.size }) === null);
}
