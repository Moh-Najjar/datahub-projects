import type { BlogCover, BlogStatus } from '@/modules/blog/types/blog';

/*
 * TEMPORARY development storage for blog management (no backend yet). Only CHANGES are stored, in this browser's
 * localStorage, on top of the exported posts (data/seed.ts):
 * - `posts`: new posts and edited exported posts (full content), keyed by post id;
 * - `deleted`: ids of exported posts that were deleted;
 * - `status`: publish state of exported posts that were not otherwise edited.
 * Read and written ONLY by the blog service (api/blogApi.ts).
 */

export interface StoredPost {
  id: string;
  status: BlogStatus;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  categories: string[];
  tags: string[];
  date: string;
  modified: string;
  cover: BlogCover | null;
  html: string;
}

export interface BlogStoreState {
  posts: Record<string, StoredPost>;
  deleted: string[];
  status: Record<string, BlogStatus>;
}

const STORAGE_KEY = 'datahub-website.blog.v1';
const EMPTY: BlogStoreState = { posts: {}, deleted: [], status: {} };

/** Raised when the browser refuses to store more data (localStorage is limited to a few MB). */
export class BlogStorageFullError extends Error {
  constructor() {
    super('Browser storage is full');
    this.name = 'BlogStorageFullError';
  }
}

let state: BlogStoreState | undefined;
let version = 0;
const listeners = new Set<() => void>();

function readStorage(): BlogStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BlogStoreState>;
    return { posts: parsed.posts ?? {}, deleted: parsed.deleted ?? [], status: parsed.status ?? {} };
  } catch {
    // Unavailable storage (private mode) or unreadable data: behave as "no changes".
    return EMPTY;
  }
}

function changed() {
  version++;
  for (const listener of listeners) listener();
}

// Another tab changed the blog: re-read it on next access.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    state = undefined;
    changed();
  });
}

export const blogStore = {
  read(): BlogStoreState {
    state ??= readStorage();
    return state;
  },
  /** Saves the whole state; throws `BlogStorageFullError` when the browser refuses (nothing changes then). */
  write(next: BlogStoreState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new BlogStorageFullError();
    }
    state = next;
    changed();
  },
  isPristine(): boolean {
    const s = blogStore.read();
    return Object.keys(s.posts).length === 0 && s.deleted.length === 0 && Object.keys(s.status).length === 0;
  },
  /** Increases on every change (here or in another tab): readers use it to drop cached results. */
  version: () => version,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
