import { describe, expect, test } from 'bun:test';
import { AlertSeverity, SpanKind, StatusCode } from '@telemetry/types';
import { RootCauseEngine } from '../src/rca/root-cause-engine';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Motor de Análise de Causa Raiz (RCA)', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const rcaEngine = new RootCauseEngine(repos);

  test('deve identificar falha no banco de dados como hipótese de maior confiança e compilar evidências', async () => {
    const now = Date.now();

    await repos.traces.insertSpans([
      {
        traceId: 'trace-db-crash',
        spanId: 'span-db-1',
        name: 'SELECT * FROM users',
        kind: SpanKind.CLIENT,
        startTime: now - 5000,
        endTime: now - 3000,
        durationMs: 2000,
        statusCode: StatusCode.ERROR,
        serviceName: 'user-service',
        attributes: { 'db.system': 'postgresql' },
        events: [],
        links: [],
      },
    ]);

    const incident = {
      id: 'inc-user-service-crash',
      title: 'Surto de Erro no User Service',
      serviceName: 'user-service',
      severity: AlertSeverity.CRITICAL,
      status: 'open' as const,
      createdAt: now,
      description: 'Latência do banco de dados excedeu o limiar',
      traceId: 'trace-db-crash',
    };

    const report = await rcaEngine.analyzeIncident(incident);

    expect(report.incidentId).toBe('inc-user-service-crash');
    expect(report.hypotheses).not.toBeEmpty();

    const topHypothesis = report.hypotheses[0];
    expect(topHypothesis.confidencePercent).toBeGreaterThanOrEqual(70);
    expect(topHypothesis.serviceName).toContain('postgresql');
    expect(topHypothesis.evidences).not.toBeEmpty();
    expect(topHypothesis.evidences[0].description).toContain('postgresql');
  });
});
