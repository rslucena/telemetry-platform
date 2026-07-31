import { startApiServer } from './api/server';

export * from './api/server';
export * from './api/router';
export * from './repositories';

// Direct initialization when running with `bun run src/index.ts`
if (import.meta.main) {
  const { server } = startApiServer();
  console.log(`🚀 Telemetry Backend Server running on http://${server.hostname}:${server.port}`);
}
