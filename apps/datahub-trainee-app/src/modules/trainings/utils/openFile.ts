import type { DownloadedFile } from '@/core/api/http';
import { extensionOf } from './files';

/*
 * Showing a stored file in the browser. Files need the Bearer token, so they are fetched first (`filesApi.download`)
 * and then shown from memory (an object URL): in a new tab when the browser can display the type (PDF, images, plain
 * text, audio, video), otherwise saved under its original name.
 */

const PREVIEW_TYPES = /^(application\/pdf|image\/(png|jpe?g|gif|svg\+xml|webp)|text\/plain|video\/(mp4|webm|quicktime)|audio\/)/i;
const PREVIEW_EXTENSIONS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.md': 'text/plain',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

/** The type to show a file as: its content type when the browser can display it, else one implied by its extension. */
export function previewTypeOf(file: { fileName: string; contentType: string | null }): string | null {
  if (file.contentType && PREVIEW_TYPES.test(file.contentType)) return file.contentType;
  return PREVIEW_EXTENSIONS[extensionOf(file.fileName)] ?? null;
}

/** Saves an in-memory file under `fileName` (or opens a link the API returned). */
function save(href: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Delivers a downloaded file: into `tab` (a tab opened during the click, so the browser does not block it) when the
 * file is to be shown, otherwise as a saved file.
 */
export function deliverFile(downloaded: DownloadedFile, file: { fileName: string; contentType: string | null }, tab: Window | null): void {
  if (downloaded.kind === 'url') {
    if (tab) tab.location.href = downloaded.url;
    else save(downloaded.url, file.fileName);
    return;
  }
  const type = (tab && previewTypeOf({ fileName: file.fileName, contentType: downloaded.contentType ?? file.contentType })) || downloaded.blob.type || 'application/octet-stream';
  // Re-typed so the browser displays it (APIs often answer `application/octet-stream`).
  const blob = downloaded.blob.type === type ? downloaded.blob : new Blob([downloaded.blob], { type });
  const href = URL.createObjectURL(blob);
  if (tab) tab.location.href = href;
  else save(href, file.fileName);
  // The tab / download has read it by then.
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
