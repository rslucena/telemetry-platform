import { describe, expect, test } from 'bun:test';

describe('Telas de Service Detail & Service Map (Topology)', () => {
  test('deve validar que a página de topologia está corretamente exportada', async () => {
    const topologyPageModule = await import('../../frontend/src/app/topology/page');
    expect(topologyPageModule.default).toBeDefined();
  });
});
