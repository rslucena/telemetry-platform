import { describe, expect, test } from 'bun:test';
import { FlamegraphDiffEngine, ProfilingEngine } from '../src/profiling/profiling-engine';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Continuous Profiling Engine & Flame Graphs', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const profilingEngine = new ProfilingEngine(repos);

  test('deve converter collapsed stack traces em uma árvore hierárquica FlamegraphNode', () => {
    const collapsedText = `
      root;checkout-service;processPayment;validateCard 120
      root;checkout-service;processPayment;authorize 80
      root;checkout-service;dbQuery 40
    `;

    const tree = profilingEngine.parseCollapsedStacks(collapsedText, 'checkout-service');

    expect(tree.name).toBe('checkout-service');
    expect(tree.value).toBe(240);
    expect(tree.children).toBeDefined();
    expect(tree.children?.length).toBe(1);

    const rootChild = tree.children?.[0]; // "root"
    expect(rootChild?.name).toBe('root');

    const svcChild = rootChild?.children?.[0]; // "checkout-service"
    expect(svcChild?.name).toBe('checkout-service');
    expect(svcChild?.children).toHaveLength(2); // processPayment e dbQuery
  });

  test('deve calcular a comparação diferencial entre o Perfil A e o Perfil B (Diff Engine)', async () => {
    const profA = {
      id: 'prof-v1',
      serviceName: 'order-service',
      profileType: 'cpu' as const,
      timestamp: 1000,
      durationMs: 1000,
      sampleCount: 200,
      flamegraphDataJson: 'root;order-service;computeTax 100\nroot;order-service;saveDb 100',
    };

    const profB = {
      id: 'prof-v2',
      serviceName: 'order-service',
      profileType: 'cpu' as const,
      timestamp: 2000,
      durationMs: 1300,
      sampleCount: 260,
      flamegraphDataJson: 'root;order-service;computeTax 200\nroot;order-service;saveDb 60',
    };

    await profilingEngine.ingestProfile(profA);
    await profilingEngine.ingestProfile(profB);

    const treeA = await profilingEngine.getFlamegraphTree('prof-v1');
    const treeB = await profilingEngine.getFlamegraphTree('prof-v2');

    if (!treeA || !treeB) throw new Error('Trees devem estar definidas');

    const diffEngine = new FlamegraphDiffEngine();
    const diff = diffEngine.compareProfiles(profA, profB, treeA, treeB);

    expect(diff.profileAId).toBe('prof-v1');
    expect(diff.profileBId).toBe('prof-v2');
    expect(diff.totalDeltaMs).toBe(300);

    // computeTax aumentou de 100 para 200 (+100ms / +100%)
    const regressedTax = diff.regressedFunctions.find((f) => f.name === 'computeTax');
    expect(regressedTax).toBeDefined();
    expect(regressedTax?.deltaMs).toBe(100);

    // saveDb diminuiu de 100 para 60 (-40ms)
    const improvedDb = diff.improvedFunctions.find((f) => f.name === 'saveDb');
    expect(improvedDb).toBeDefined();
    expect(improvedDb?.deltaMs).toBe(-40);
  });
});
