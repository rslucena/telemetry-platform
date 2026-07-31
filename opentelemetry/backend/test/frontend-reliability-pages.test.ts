import { describe, expect, test } from 'bun:test';

describe('Telas de SLO Dashboard, Alertas, Incidentes e RCA Workspace', () => {
  test('deve validar que as páginas de slos, incidents e root-cause estão corretamente exportadas', async () => {
    const slosPageModule = await import('../../frontend/src/app/slos/page');
    expect(slosPageModule.default).toBeDefined();

    const incidentsPageModule = await import('../../frontend/src/app/incidents/page');
    expect(incidentsPageModule.default).toBeDefined();

    const rootCausePageModule = await import('../../frontend/src/app/root-cause/page');
    expect(rootCausePageModule.default).toBeDefined();
  });
});
