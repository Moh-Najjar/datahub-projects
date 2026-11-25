import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './safeUrl';

describe('safeHttpUrl', () => {
  it('keeps http(s) addresses and completes a bare domain', () => {
    expect(safeHttpUrl('https://google.com/search?q=1')).toBe('https://google.com/search?q=1');
    expect(safeHttpUrl(' http://example.com ')).toBe('http://example.com/');
    expect(safeHttpUrl('www.google.com')).toBe('https://www.google.com/');
  });

  it('refuses empty, relative and non-web addresses (they would reopen this app or run code)', () => {
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl('/trainings')).toBeNull();
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,hi')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
  });
});
