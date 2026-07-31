import { describe, expect, test } from 'bun:test';
import { MetricType, SeverityNumber, SpanKind, StatusCode } from '@telemetry/types';
import { CorrelationEngine } from '../src/correlation/correlation-engine';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Motor de Correlação Cross-Signal & Exemplars', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const correlationEngine = new CorrelationEngine(repos);

  test('deve vincular Logs a um Trace ID e permitir navegação bidirecional Log ↔ Trace', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';

    await repos.traces.insertSpans([
      {
        traceId,
        spanId,
        name: 'POST /checkout',
        kind: SpanKind.SERVER,
        startTime: 1000,
        endTime: 1200,
        durationMs: 200,
        statusCode: StatusCode.OK,
        serviceName: 'checkout-service',
        attributes: {},
        events: [],
        links: [],
      },
    ]);

    await repos.logs.insertLogs([
      {
        id: 'log-corr-1',
        timestamp: 1100,
        observedTimestamp: 1100,
        traceId,
        spanId,
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        serviceName: 'checkout-service',
        body: 'Erro ao conectar ao gateway de pagamento',
        attributes: {},
      },
    ]);

    const logsForTrace = await correlationEngine.getLogsForTrace(traceId);
    expect(logsForTrace).toHaveLength(1);
    expect(logsForTrace[0].body).toContain('pagamento');

    const traceForLog = await correlationEngine.getTraceForLog('log-corr-1');
    expect(traceForLog).not.toBeNull();
    expect(traceForLog?.spans[0].traceId).toBe(traceId);
  });

  test('deve correlacionar pontos de métricas a Exemplars e ao contexto completo', async () => {
    const traceId = 'trace-exemplar-999';

    await repos.metrics.insertMetrics([
      {
        id: 'm-p99',
        name: 'http_server_duration_ms',
        type: MetricType.HISTOGRAM,
        serviceName: 'payment-service',
        timestamp: 2000,
        value: 1250,
        attributes: {},
        exemplars: [
          {
            traceId,
            spanId: 'span-p99',
            timestamp: 2000,
            value: 1250,
          },
        ],
      },
    ]);

    const exemplars = await correlationEngine.getExemplarsForMetric('http_server_duration_ms');
    expect(exemplars).toHaveLength(1);
    expect(exemplars[0].traceId).toBe(traceId);
    expect(exemplars[0].value).toBe(1250);

    const fullContext = await correlationEngine.getCorrelatedContext(traceId);
    expect(fullContext.traceId).toBe(traceId);
    expect(fullContext.exemplars).toHaveLength(1);
  });
});
