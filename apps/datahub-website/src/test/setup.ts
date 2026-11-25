// Vitest setup: a clean DOM, storage and mocks for every test.
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Pages are lazy chunks and MUI renders a lot: allow more than the default 1 s for async queries.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
});
