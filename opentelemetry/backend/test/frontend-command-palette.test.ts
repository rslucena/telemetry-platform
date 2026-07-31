import { describe, expect, test } from 'bun:test';

describe('Top Bar & Command Palette (⌘K)', () => {
  test('deve validar que os componentes de frontend e contexto estão devidamente exportados', async () => {
    const contextModule = await import('../../frontend/src/context/TelemetryContext');
    expect(contextModule.TelemetryProvider).toBeDefined();
    expect(contextModule.useTelemetry).toBeDefined();

    const sidebarModule = await import('../../frontend/src/components/Sidebar');
    expect(sidebarModule.Sidebar).toBeDefined();

    const headerModule = await import('../../frontend/src/components/Header');
    expect(headerModule.Header).toBeDefined();

    const paletteModule = await import('../../frontend/src/components/CommandPalette');
    expect(paletteModule.CommandPalette).toBeDefined();
  });
});
