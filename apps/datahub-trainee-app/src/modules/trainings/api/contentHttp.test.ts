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

/** A tiny stateful fake of the materials endpoints, strict like the real one about the order list. */
function fakeBackend() {
  const materials = answer.data.map((m) => ({ ...m, links: [...m.links] }));
  const calls: string[] = [];
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 300 ? { success: true, data } : data), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input), 'http://api.test');
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push(`${method} ${url.pathname}`);
      if (method === 'GET' && url.pathname.endsWith('/materials')) return json(materials);
      if (method === 'POST' && url.pathname.endsWith(`/trainings/${TRAINING}/materials`)) {
        materials.push({ id: 'm-new', trainingId: TRAINING, type: 'Link', sortOrder: 9, title: body.title, textContent: null, links: [] });
        return json('m-new');
      }
      const linkMatch = /\/materials\/([^/]+)\/links$/.exec(url.pathname);
      if (method === 'POST' && linkMatch) {
        materials.find((m) => m.id === linkMatch[1])!.links.push(body.url);
        return json('link-id');
      }
      if (method === 'DELETE') {
        materials.splice(materials.findIndex((m) => url.pathname.endsWith(`/materials/${m.id}`)), 1);
        return new Response(null, { status: 204 });
      }
      if (method === 'PUT' && url.pathname.endsWith('/materials/order')) {
        const ids: string[] = body.materialIds;
        const same = ids.length === materials.length && materials.every((m) => ids.includes(m.id));
        if (!same) return json({ success: false, error: { code: 'Academy.MaterialNotFound', message: 'The material order does not match the training materials.' } }, 404);
        materials.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 204 }); // PUT /materials/{id} (title)
    }),
  );
  return { materials, calls };
}

describe('materials over HTTP', () => {
  it('editing the addresses of links without ids replaces the material in place (old deleted before reordering)', async () => {
    const backend = fakeBackend();
    await materialsHttpApi.list(TRAINING);
    const saved = await materialsHttpApi.updateLinks('m-link', {
      title: 'URL Title',
      links: [{ url: 'https://www.google.com/?zx=1' }, { url: 'https://mail.google.com/mail/u/0/#inbox' }, { url: 'https://example.com/new' }],
    });
    expect(saved.id).toBe('m-new');
    expect(saved.links.map((l) => l.url)).toEqual(['https://www.google.com/?zx=1', 'https://mail.google.com/mail/u/0/#inbox', 'https://example.com/new']);
    // Same place as before (second), the old one gone, and no refused order request.
    expect(backend.materials.map((m) => m.id)).toEqual(['m-text', 'm-new']);
    const deleteAt = backend.calls.indexOf(`DELETE /api/v1/academy/materials/m-link`);
    const orderAt = backend.calls.findIndex((c) => c.startsWith('PUT') && c.endsWith('/materials/order'));
    expect(deleteAt).toBeGreaterThan(-1);
    expect(orderAt).toBeGreaterThan(deleteAt);
  });

  it('changing only the title keeps the links material as it is', async () => {
    const backend = fakeBackend();
    await materialsHttpApi.list(TRAINING);
    const saved = await materialsHttpApi.updateLinks('m-link', { title: 'Renamed', links: [{ url: 'https://www.google.com/?zx=1' }, { url: 'https://mail.google.com/mail/u/0/#inbox' }] });
    expect(saved.id).toBe('m-link');
    expect(backend.calls.some((c) => c.startsWith('DELETE') || c.endsWith('/order'))).toBe(false);
  });

  it('reads links answered as plain address strings', async () => {
    const materials = await materialsHttpApi.list(TRAINING);
    const link = materials.find((m) => m.id === 'm-link')!;
    expect(link.type).toBe('link');
    expect(link.links.map((l) => l.url)).toEqual(['https://www.google.com/?zx=1', 'https://mail.google.com/mail/u/0/#inbox']);
    expect(link.links.every((l) => l.title === null)).toBe(true);
    expect(materials.find((m) => m.id === 'm-text')!.links).toEqual([]);
  });
});
