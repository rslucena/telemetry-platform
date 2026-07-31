import { describe, expect, test } from 'bun:test';

describe('Telas de Log Explorer, Metrics & Continuous Profiling', () => {
  test('deve validar que as páginas de logs, métricas e profiling estão corretamente exportadas', async () => {
    const logsPageModule = await import('../../frontend/src/app/logs/page');
    expect(logsPageModule.default).toBeDefined();

    const metricsPageModule = await import('../../frontend/src/app/metrics/page');
    expect(metricsPageModule.default).toBeDefined();

    const profilingPageModule = await import('../../frontend/src/app/profiling/page');
    expect(profilingPageModule.default).toBeDefined();
  });
});
