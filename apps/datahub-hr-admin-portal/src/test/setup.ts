// Vitest setup: real i18n (English by default), instant mock API, clean DOM and storage between tests.
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import i18n from '@/i18n';
import { resetMockConfig, setMockConfig } from '@/core/api/mock/mockConfig';
import { recordedCharts } from './echartsStub';
import { setViewportWidth } from './matchMedia';

// jsdom cannot render charts: record what each chart receives instead (see echartsStub.ts).
vi.mock('echarts-for-react/esm/core', async () => ({ default: (await import('./echartsStub')).EChartsStub }));

beforeEach(() => {
  // No simulated latency in tests (mock.test.ts sets its own delays where it tests them).
  setMockConfig({ delayMs: { min: 0, max: 0 } });
  setViewportWidth(1280);
});

afterEach(async () => {
  cleanup();
  recordedCharts.length = 0;
  vi.restoreAllMocks();
  resetMockConfig();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-color-scheme');
  await i18n.changeLanguage('en');
});
