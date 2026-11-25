import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttpAuth, http } from './http';
import { ApiError } from './types';

// The real HTTP client's file download; only `fetch` is replaced.
const onUnauthorized = vi.fn();
beforeEach(() => configureHttpAuth({ getAccessToken: () => 'test-token', onUnauthorized }));
afterEach(() => {
  vi.unstubAllGlobals();
  onUnauthorized.mockReset();
});

const answer = (response: Response) => {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('http.download', () => {
  it('fetches the file with the Bearer token and returns its bytes', async () => {
    const fetchMock = answer(
      new Response('%PDF-1.7', { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="guide.pdf"' } }),
    );
    const file = await http.download('/api/v1/academy/assignment-attachments/f1');
    expect(file).toMatchObject({ kind: 'blob', contentType: 'application/pdf', fileName: 'guide.pdf' });
    expect(file.kind === 'blob' ? await file.blob.text() : null).toBe('%PDF-1.7');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(init?.credentials).toBe('omit');
  });

  it('follows a download link answered as JSON (envelope or bare)', async () => {
    answer(
      new Response(JSON.stringify({ success: true, data: { downloadUrl: 'https://store.example.test/f1?sig=x', fileName: 'a.docx' } }), { headers: { 'Content-Type': 'application/json' } }),
    );
    expect(await http.download('/x')).toEqual({ kind: 'url', url: 'https://store.example.test/f1?sig=x', fileName: 'a.docx' });
  });

  it('turns failures into ApiError (404 → NOT_FOUND with the backend code; 401 ends the session)', async () => {
    answer(new Response(JSON.stringify({ success: false, error: { code: 'Academy.FileNotFound', message: 'Not found' } }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    const error = await http.download('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', reason: 'Academy.FileNotFound' });

    answer(new Response('', { status: 401 }));
    await expect(http.download('/x')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
