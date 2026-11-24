// Vitest setup: instant mock API, a fresh mock database and a clean DOM/storage for every test.
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetMockConfig, setMockConfig } from '@/core/api/mock/mockConfig';
import { resetMockDatabase } from '@/core/api/mock/mockDatabase';
import { setCurrentActor } from '@/core/auth/actor';
import { setViewportWidth } from './matchMedia';

// Routed pages are lazy chunks; with every test file running in parallel, loading one can take over the default 1 s.
configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement printing, scrolling into view or layout-based APIs.
window.print = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetMockDatabase();
  setMockConfig({ delayMs: { min: 0, max: 0 } });
  setViewportWidth(1280);
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetMockConfig();
  resetMockDatabase();
  setCurrentActor(null);
  localStorage.clear();
  sessionStorage.clear();
});
