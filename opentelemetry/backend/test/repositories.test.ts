import { describe, expect, test } from 'bun:test';
import { MetricType, SeverityNumber, SpanKind, StatusCode } from '@telemetry/types';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Storage Drivers & Persistence (SQLite)', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });

  test('TraceRepository: deve inserir e buscar spans por traceId e filtros', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const span1 = {
      traceId,
      spanId: '00f067aa0ba902b7',
      name: 'GET /api/users',
      kind: SpanKind.SERVER,
      startTime: 1000,
      endTime: 1200,
      durationMs: 200,
      statusCode: StatusCode.OK,
      serviceName: 'user-service',
      attributes: { 'http.status_code': 200 },
      events: [],
      links: [],
    };

    const span2 = {
      traceId,
      spanId: '00f067aa0ba902b8',
      parentSpanId: '00f067aa0ba902b7',
      name: 'SELECT * FROM users',
      kind: SpanKind.CLIENT,
      startTime: 1050,
      endTime: 1180,
      durationMs: 130,
      statusCode: StatusCode.OK,
      serviceName: 'user-service',
      attributes: { 'db.system': 'sqlite' },
      events: [],
      links: [],
    };

    await repos.traces.insertSpans([span1, span2]);

    const traceSpans = await repos.traces.getTraceById(traceId);
    expect(traceSpans).toHaveLength(2);
    expect(traceSpans[0].name).toBe('GET /api/users');

    const filtered = await repos.traces.findTraces({ minDurationMs: 150 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].spanId).toBe('00f067aa0ba902b7');
  });

  test('MetricRepository: deve salvar e consultar métricas e relacionar exemplares', async () => {
    const metric = {
      id: 'm1',
      name: 'http_requests_total',
      type: MetricType.COUNTER,
      serviceName: 'order-service',
      timestamp: 2000,
      value: 42,
      attributes: { env: 'production' },
      exemplars: [
        {
          traceId: 'trace-123',
          spanId: 'span-456',
          timestamp: 2000,
          value: 1.5,
        },
      ],
    };

    await repos.metrics.insertMetrics([metric]);

    const queried = await repos.metrics.queryMetrics({ name: 'http_requests_total' });
    expect(queried).toHaveLength(1);
    expect(queried[0].value).toBe(42);

    const exemplars = await repos.metrics.getExemplars('trace-123');
    expect(exemplars).toHaveLength(1);
    expect(exemplars[0].spanId).toBe('span-456');
  });

  test('LogRepository: deve armazenar logs e permitir busca por texto e severidade', async () => {
    const log1 = {
      id: 'log-1',
      timestamp: 3000,
      observedTimestamp: 3000,
      traceId: 'trace-999',
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      serviceName: 'auth-service',
      body: 'Falha na autenticação JWT do usuário',
      attributes: { user_id: 123 },
    };

    await repos.logs.insertLogs([log1]);

    const searchResults = await repos.logs.searchLogs({ query: 'autenticação' });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].serviceName).toBe('auth-service');
  });

  test('MetadataRepository: deve gerenciar topologia de serviços e SLOs', async () => {
    await repos.metadata.saveServiceNode({
      id: 's1',
      name: 'payment-service',
      environment: 'prod',
      version: 'v1.2.0',
      status: 'healthy',
    });

    const services = await repos.metadata.getServices();
    expect(services).toHaveLength(1);
    expect(services[0].name).toBe('payment-service');

    await repos.metadata.saveDependency({
      sourceService: 'checkout-service',
      targetService: 'payment-service',
      callCount: 1500,
      errorCount: 3,
      avgLatencyMs: 45.2,
    });

    const topology = await repos.metadata.getServiceTopology();
    expect(topology).toHaveLength(1);
    expect(topology[0].targetService).toBe('payment-service');
  });
});
