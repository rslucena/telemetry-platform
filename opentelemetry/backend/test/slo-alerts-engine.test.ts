import { describe, expect, test } from 'bun:test';
import { SpanKind, StatusCode } from '@telemetry/types';
import { AlertEngine, IncidentEngine } from '../src/reliability/alert-incident-engine';
import { SloEngine } from '../src/reliability/slo-engine';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Motores de Confiabilidade (SLO, Alertas e Incidentes)', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const sloEngine = new SloEngine(repos);
  const alertEngine = new AlertEngine(repos);
  const incidentEngine = new IncidentEngine(repos);

  test('deve calcular SLI, Error Budget restante (%) e Burn Rate corretamente', async () => {
    const slo = {
      id: 'slo-checkout-latency',
      name: 'Checkout Latency < 300ms',
      serviceName: 'checkout-service',
      targetPercentage: 99.0,
      windowPeriodDays: 30,
      indicatorType: 'latency' as const,
      thresholdMs: 300,
    };

    await repos.metadata.saveSLO(slo);

    const now = Date.now();
    // Inserir 10 spans: 8 rápidos (< 300ms) e 2 lentos (> 300ms) -> SLI = 80%
    const spans = [];
    for (let i = 0; i < 8; i++) {
      spans.push({
        traceId: `t-fast-${i}`,
        spanId: `s-fast-${i}`,
        name: 'POST /checkout',
        kind: SpanKind.SERVER,
        startTime: now - 1000,
        endTime: now - 900,
        durationMs: 100,
        statusCode: StatusCode.OK,
        serviceName: 'checkout-service',
        attributes: {},
        events: [],
        links: [],
      });
    }
    for (let i = 0; i < 2; i++) {
      spans.push({
        traceId: `t-slow-${i}`,
        spanId: `s-slow-${i}`,
        name: 'POST /checkout',
        kind: SpanKind.SERVER,
        startTime: now - 1000,
        endTime: now - 500,
        durationMs: 500,
        statusCode: StatusCode.OK,
        serviceName: 'checkout-service',
        attributes: {},
        events: [],
        links: [],
      });
    }

    await repos.traces.insertSpans(spans);

    const status = await sloEngine.calculateSLOStatus(slo, now);

    expect(status.sliValue).toBe(80);
    expect(status.targetPercentage).toBe(99.0);
    expect(status.errorBudgetRemaining).toBe(0); // 80% < 99% -> esgotado
    expect(status.burnRate).toBeGreaterThan(1.0);
    expect(status.status).toBe('breached');
  });

  test('deve agrupar alertas de serviços dependentes em um único incidente de causa raiz', async () => {
    await repos.metadata.saveDependency({
      sourceService: 'frontend-api',
      targetService: 'payment-service',
      callCount: 100,
      errorCount: 10,
      avgLatencyMs: 150,
    });

    const slo1 = {
      id: 'slo-frontend',
      name: 'Frontend Availability',
      serviceName: 'frontend-api',
      targetPercentage: 99.9,
      windowPeriodDays: 30,
      indicatorType: 'availability' as const,
    };

    const slo2 = {
      id: 'slo-payment',
      name: 'Payment Availability',
      serviceName: 'payment-service',
      targetPercentage: 99.9,
      windowPeriodDays: 30,
      indicatorType: 'availability' as const,
    };

    const now = Date.now();
    await repos.traces.insertSpans([
      {
        traceId: 't-err-1',
        spanId: 's-err-1',
        name: 'GET /api',
        kind: SpanKind.SERVER,
        startTime: now - 100,
        endTime: now,
        durationMs: 100,
        statusCode: StatusCode.ERROR,
        serviceName: 'frontend-api',
        attributes: {},
        events: [],
        links: [],
      },
      {
        traceId: 't-err-2',
        spanId: 's-err-2',
        name: 'POST /pay',
        kind: SpanKind.SERVER,
        startTime: now - 100,
        endTime: now,
        durationMs: 100,
        statusCode: StatusCode.ERROR,
        serviceName: 'payment-service',
        attributes: {},
        events: [],
        links: [],
      },
    ]);

    const status1 = await sloEngine.calculateSLOStatus(slo1, now);
    const status2 = await sloEngine.calculateSLOStatus(slo2, now);

    const rawAlerts = await alertEngine.evaluateSLOAlerts([status1, status2]);
    expect(rawAlerts.length).toBeGreaterThanOrEqual(1);

    const dependencies = await repos.metadata.getServiceTopology();
    const grouped = incidentEngine.groupIncidentsByTopology(rawAlerts, dependencies);

    expect(grouped.length).toBeLessThan(rawAlerts.length);
    expect(grouped[0].relatedServices).toContain('payment-service');
  });
});
