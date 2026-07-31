import { describe, expect, test } from 'bun:test';

describe('Telas de Overview & Services Explorer UI', () => {
  test('deve validar que a página de serviços está corretamente exportada', async () => {
    const servicesPageModule = await import('../../frontend/src/app/services/page');
    expect(servicesPageModule.default).toBeDefined();
  });
});
