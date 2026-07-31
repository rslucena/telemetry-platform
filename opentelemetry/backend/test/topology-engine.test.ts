import { describe, expect, test } from 'bun:test';
import { SpanKind, StatusCode } from '@telemetry/types';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';
import { TopologyEngine } from '../src/topology/topology-engine';

describe('Motor de Topologia (Service Map) & Latência Cross-Cloud', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const topologyEngine = new TopologyEngine(repos.metadata, repos.traces);

  test('deve construir conexões entre serviços e identificar bordas cross-cloud', async () => {
    const parentSpan = {
      traceId: 'trace-cross-1',
      spanId: 'span-parent-1',
      name: 'POST /checkout',
      kind: SpanKind.SERVER,
      startTime: 1000,
      endTime: 1200,
      durationMs: 200,
      statusCode: StatusCode.OK,
      serviceName: 'checkout-service',
      attributes: { 'cloud.provider': 'gcp' },
      events: [],
      links: [],
    };

    const childSpan = {
      traceId: 'trace-cross-1',
      spanId: 'span-child-1',
      parentSpanId: 'span-parent-1',
      name: 'SELECT * FROM orders',
      kind: SpanKind.CLIENT,
      startTime: 1050,
      endTime: 1150,
      durationMs: 100,
      statusCode: StatusCode.OK,
      serviceName: 'payment-database-aws',
      attributes: { 'cloud.provider': 'aws', 'db.system': 'postgresql' },
      events: [],
      links: [],
    };

    await repos.traces.insertSpans([parentSpan, childSpan]);

    const dependencies = await topologyEngine.processSpans([parentSpan, childSpan]);

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0].sourceService).toBe('checkout-service');
    expect(dependencies[0].targetService).toBe('payment-database-aws');
    expect(dependencies[0].isCrossCloud).toBe(true);
    expect(dependencies[0].sourceCloudProvider).toBe('gcp');
    expect(dependencies[0].targetCloudProvider).toBe('aws');
    expect(dependencies[0].estimatedEgressBytes).toBeGreaterThan(0);
  });

  test('deve calcular percentis de latência P50, P95 e P99 corretamente', async () => {
    const parentSpan = {
      traceId: 'trace-perf',
      spanId: 'span-p-1',
      name: 'GET /api',
      kind: SpanKind.SERVER,
      startTime: 0,
      endTime: 10,
      durationMs: 10,
      statusCode: StatusCode.OK,
      serviceName: 'gateway',
      attributes: {},
      events: [],
      links: [],
    };

    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const childSpans = durations.map((d, i) => ({
      traceId: 'trace-perf',
      spanId: `span-c-${i}`,
      parentSpanId: 'span-p-1',
      name: 'RPC call',
      kind: SpanKind.CLIENT,
      startTime: 0,
      endTime: d,
      durationMs: d,
      statusCode: StatusCode.OK,
      serviceName: 'user-service',
      attributes: {},
      events: [],
      links: [],
    }));

    const dependencies = await topologyEngine.processSpans([parentSpan, ...childSpans]);

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0].callCount).toBe(10);
    expect(dependencies[0].p50LatencyMs).toBeLessThanOrEqual(60);
    expect(dependencies[0].p95LatencyMs).toBeGreaterThanOrEqual(90);
  });
});
