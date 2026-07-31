import { describe, expect, test } from 'bun:test';
import { TrafficGenerator } from '../../../skeletons/traffic-generator';
import { handleRequest } from '../src/api/router';
import { createRepositories } from '../src/repositories/factory';
import { createSQLiteConnection } from '../src/repositories/sqlite/db';

describe('Workloads Skeleton & Traffic Generator', () => {
  const db = createSQLiteConnection(':memory:');
  const repos = createRepositories({ driver: 'sqlite', sqliteInstance: db });
  const generator = new TrafficGenerator();

  test('deve gerar lote de payloads OTLP para as 5 aplicações skeleton', () => {
    const batch = generator.generateBatch(15);

    expect(batch.tracesPayloads).toHaveLength(15);
    expect(batch.logsPayloads.length).toBeGreaterThan(0);
  });

  test('deve alimentar a API OTLP com o tráfego gerado e popular a topologia', async () => {
    const batch = generator.generateBatch(10);

    for (const payload of batch.tracesPayloads) {
      const req = new Request('http://localhost:4000/v1/traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await handleRequest(req, repos);
      expect(res.status).toBe(200);
    }

    const topoReq = new Request('http://localhost:4000/api/v1/topology', { method: 'GET' });
    const topoRes = await handleRequest(topoReq, repos);
    const topoBody = (await topoRes.json()) as { count: number };

    expect(topoRes.status).toBe(200);
    expect(topoBody.count).toBeGreaterThan(0);
  });
});
