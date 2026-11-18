// Vitest setup: real i18n (English by default), instant mock API, clean DOM and storage between tests.
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import i18n from '@/i18n';
import { resetMockConfig, setMockConfig } from '@/core/api/mock/mockConfig';
import { resetAttendanceMock } from '@/modules/attendance/mock/attendanceMock';
import { resetDocumentsMock } from '@/modules/documents/mock/documentsMock';
import { resetEmployeesMock } from '@/modules/employees/mock/employeesMock';
import { resetLeaveStore } from '@/modules/leave/mock/leaveStore';
import { resetOrganizationMock } from '@/modules/organization/mock/organizationMock';
import { resetPayrollMock } from '@/modules/payroll/mock/payrollMock';
import { resetPerformanceMock } from '@/modules/performance/mock/performanceMock';
import { resetRecruitmentMock } from '@/modules/recruitment/mock/recruitmentMock';
import { recordedCharts } from './echartsStub';
import { setViewportWidth } from './matchMedia';

// jsdom cannot render charts: record what each chart receives instead (see echartsStub.ts).
vi.mock('echarts-for-react/esm/core', async () => ({ default: (await import('./echartsStub')).EChartsStub }));

// Routed pages are lazy chunks; with every test file running in parallel, loading one can take over the default
// 1 s. findBy*/waitFor wait up to 5 s by default (they still resolve as soon as the condition holds).
configure({ asyncUtilTimeout: 5000 });

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
  // Simulated backends keep data in memory: restore their seeds so tests stay independent.
  resetOrganizationMock();
  resetEmployeesMock();
  resetAttendanceMock();
  resetLeaveStore();
  resetRecruitmentMock();
  resetPerformanceMock();
  resetPayrollMock();
  resetDocumentsMock();
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-color-scheme');
  await i18n.changeLanguage('en');
});
