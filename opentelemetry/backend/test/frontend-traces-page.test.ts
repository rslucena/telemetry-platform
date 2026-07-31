import { describe, expect, test } from 'bun:test';

describe('Telas de Trace Explorer & Waterfall Trace Detail', () => {
  test('deve validar que a página de traces está corretamente exportada', async () => {
    const tracesPageModule = await import('../../frontend/src/app/traces/page');
    expect(tracesPageModule.default).toBeDefined();
  });
});
