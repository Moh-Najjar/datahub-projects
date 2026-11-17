/*
 * Images chosen in the admin. Uploads are resized in the browser to the article width (≤1170px, like the exported
 * posts) and encoded as WebP, so they stay small enough for the browser's temporary storage. Nothing is uploaded.
 */

const MAX_WIDTH = 1170;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface PreparedImage {
  src: string;
  width: number;
  height: number;
}

export type ImageError = 'notImage' | 'tooLarge' | 'loadFailed';

export class ImagePrepareError extends Error {
  readonly reason: ImageError;
  constructor(reason: ImageError) {
    super(reason);
    this.reason = reason;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImagePrepareError('loadFailed'));
    reader.readAsDataURL(blob);
  });
}

/** Resizes and encodes an uploaded image as a WebP data URL. */
export async function prepareUpload(file: File): Promise<PreparedImage> {
  if (!TYPES.includes(file.type)) throw new ImagePrepareError('notImage');
  if (file.size > MAX_FILE_BYTES) throw new ImagePrepareError('tooLarge');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImagePrepareError('loadFailed');
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new ImagePrepareError('loadFailed');
  return { src: await blobToDataUrl(blob), width, height };
}

/** Accepted image addresses: https/http or a site path. */
export const isImageUrl = (url: string) => /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(url.trim());

/** Loads an image address to learn its size (fails when it cannot be displayed). */
export function measureImage(src: string): Promise<PreparedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new ImagePrepareError('loadFailed'));
    img.src = src;
  });
}
