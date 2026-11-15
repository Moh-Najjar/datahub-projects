import { describe, expect, it, vi } from 'vitest';

describe('ECharts React integration', () => {
  // Regression guard: the CommonJS entry (`lib/core`) reached the production bundle as a `{ default }`
  // object and crashed the dashboard (React error #130). The ESM entry must export the component itself.
  it('imports a renderable component from echarts-for-react', async () => {
    const real = await vi.importActual<{ default: unknown }>('echarts-for-react/esm/core');
    expect(typeof real.default).toBe('function');
    expect((real.default as { prototype?: { render?: unknown } }).prototype?.render).toBeTypeOf('function');
  });
});
