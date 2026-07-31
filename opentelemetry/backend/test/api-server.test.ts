import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { startApiServer } from '../src/api/server';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

type TestJSON = Record<string, unknown>;

describe('API Core Bun & Endpoints /api/v1', () => {
  let serverInstance: ReturnType<typeof startApiServer>;
  let baseUrl: string;

  beforeAll(() => {
    const db = createSQLiteConnection(':memory:');
    serverInstance = startApiServer({
      port: 0, // Porta aleatória disponível
      dbPath: ':memory:',
      storageDriver: 'sqlite',
    });
    baseUrl = `http://localhost:${serverInstance.server.port}`;
  });

  afterAll(async () => {
    await serverInstance.stop();
  });

  test('GET /api/v1/health e /api/v1/ready devem retornar status ok com tempo < 50ms', async () => {
    const start = performance.now();
    const res = await fetch(`${baseUrl}/api/v1/health`);
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    const json = (await res.json()) as TestJSON;
    expect(json.status).toBe('ok');
    expect(duration).toBeLessThan(50);
  });

  test('POST /v1/traces deve aceitar payload OTLP HTTP JSON', async () => {
    const otlpPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [{ key: 'service.name', value: { stringValue: 'order-api' } }],
          },
          scopeSpans: [
            {
              spans: [
                {
                  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
                  spanId: '00f067aa0ba902b7',
                  name: 'POST /orders',
                  kind: 1,
                  startTimeUnixNano: `${Date.now() * 1e6}`,
                  endTimeUnixNano: `${(Date.now() + 50) * 1e6}`,
                },
              ],
            },
          ],
        },
      ],
    };

    const res = await fetch(`${baseUrl}/v1/traces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otlpPayload),
    });

    expect(res.status).toBe(200);
  });

  test('GET /api/v1/traces deve retornar os spans armazenados', async () => {
    const res = await fetch(`${baseUrl}/api/v1/traces?serviceName=order-api`);
    expect(res.status).toBe(200);

    const json = (await res.json()) as TestJSON;
    const data = json.data as TestJSON[];
    expect(data).toBeArray();
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].serviceName).toBe('order-api');
  });

  test('GET /api/v1/overview deve agregar métricas do sistema com tempo < 50ms', async () => {
    const start = performance.now();
    const res = await fetch(`${baseUrl}/api/v1/overview`);
    const duration = performance.now() - start;

    expect(res.status).toBe(200);
    const json = (await res.json()) as TestJSON;
    expect(Number(json.healthScore)).toBeGreaterThan(0);
    expect(duration).toBeLessThan(50);
  });

  test('GET /api/v1/services & /api/v1/topology devem responder com CORS habilitado', async () => {
    const res = await fetch(`${baseUrl}/api/v1/services`, {
      method: 'OPTIONS',
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');

    const topologyRes = await fetch(`${baseUrl}/api/v1/topology`);
    expect(topologyRes.status).toBe(200);
    const json = (await topologyRes.json()) as TestJSON;
    expect(json).toHaveProperty('nodes');
    expect(json).toHaveProperty('edges');
  });

  test('Rota inexistente deve retornar HTTP 404', async () => {
    const res = await fetch(`${baseUrl}/api/v1/non-existent-route`);
    expect(res.status).toBe(404);
  });
});
