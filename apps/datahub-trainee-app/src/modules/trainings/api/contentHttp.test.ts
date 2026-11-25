import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttpAuth } from '@/core/api/http';
import { materialsHttpApi } from './contentHttp';

// The real HTTP mapping of materials; only `fetch` is replaced. The answer is the backend's real shape (2026-11-25).
const TRAINING = '453e6bdb-1cda-414f-8f92-1a3d0b3f562d';
const answer = {
  success: true,
  data: [
    { id: 'm-text', trainingId: TRAINING, type: 'Text', sortOrder: 0, title: 'title1', textContent: 'content1', links: [] },
    { id: 'm-link', trainingId: TRAINING, type: 'Link', sortOrder: 1, title: 'google', textContent: null, links: ['https://www.google.com/?zx=1', 'https://mail.google.com/mail/u/0/#inbox'] },
  ],
  error: null,
  meta: null,
};

beforeEach(() => {
  configureHttpAuth({ getAccessToken: () => 'test-token', onUnauthorized: vi.fn() });
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify(answer), { headers: { 'Content-Type': 'application/json' } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe('materials over HTTP', () => {
  it('reads links answered as plain address strings', async () => {
    const materials = await materialsHttpApi.list(TRAINING);
    const link = materials.find((m) => m.id === 'm-link')!;
    expect(link.type).toBe('link');
    expect(link.links.map((l) => l.url)).toEqual(['https://www.google.com/?zx=1', 'https://mail.google.com/mail/u/0/#inbox']);
    expect(link.links.every((l) => l.title === null)).toBe(true);
    expect(materials.find((m) => m.id === 'm-text')!.links).toEqual([]);
  });
});
