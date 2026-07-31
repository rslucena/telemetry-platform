import { describe, expect, test } from 'bun:test';
import { ServiceCatalogEngine } from '../src/catalog/service-catalog';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Service Catalog & Metadados Multicloud', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const catalogEngine = new ServiceCatalogEngine(repos.metadata);

  test('deve identificar workloads GCP Cloud Run e marcar como serverless', async () => {
    const node = await catalogEngine.processTelemetryResource('payment-service', {
      'service.name': 'payment-service',
      'service.version': 'v2.1.0',
      'cloud.provider': 'gcp',
      'cloud.region': 'us-central1',
      'cloud.platform': 'gcp_cloud_run',
      deployment_environment: 'production',
    });

    expect(node.name).toBe('payment-service');
    expect(node.cloudProvider).toBe('gcp');
    expect(node.cloudPlatform).toBe('gcp_cloud_run');
    expect(node.isServerless).toBe(true);
    expect(node.lifecycleState).toBe('active');

    const persisted = await repos.metadata.getServices();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].cloudProvider).toBe('gcp');
  });

  test('deve identificar workloads AWS Lambda e rastrear versão', async () => {
    const node = await catalogEngine.processTelemetryResource('auth-lambda', {
      'service.name': 'auth-lambda',
      'cloud.provider': 'aws',
      'cloud.region': 'sa-east-1',
      'faas.name': 'auth-lambda',
      'faas.version': 'v1.0.4',
    });

    expect(node.cloudProvider).toBe('aws');
    expect(node.isServerless).toBe(true);
  });

  test('deve realizar transição para estado scaled-to-zero se o serviço serverless ficar inativo', async () => {
    const now = Date.now();
    const node = await catalogEngine.processTelemetryResource(
      'order-processor',
      {
        'service.name': 'order-processor',
        'cloud.provider': 'gcp',
        'cloud.platform': 'gcp_cloud_run',
      },
      now - 400000, // 400 segundos atrás (superou os 300s de limite)
    );

    expect(node.lifecycleState).toBe('active');

    const updated = await catalogEngine.updateLifecycleStates(now, 300000);
    const orderProcNode = updated.find((s) => s.name === 'order-processor');

    expect(orderProcNode).toBeDefined();
    expect(orderProcNode?.lifecycleState).toBe('scaled-to-zero');
    expect(orderProcNode?.instanceCount).toBe(0);
  });
});
