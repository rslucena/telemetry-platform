import type { Server } from 'bun';
import { type Repositories, createRepositories } from '../repositories';
import { handleRequest } from './router';

export interface ServerOptions {
  port?: number;
  hostname?: string;
  repos?: Repositories;
  storageDriver?: 'sqlite' | 'production';
  dbPath?: string;
}

export function startApiServer(options: ServerOptions = {}): {
  server: Server;
  repos: Repositories;
  stop: () => Promise<void>;
} {
  const port = options.port ?? Number(process.env.API_PORT || 4000);
  const hostname = options.hostname ?? '0.0.0.0';
  const repos =
    options.repos ??
    createRepositories({
      driver: options.storageDriver,
      dbPath: options.dbPath,
    });

  const server = Bun.serve({
    port,
    hostname,
    async fetch(req: Request) {
      return handleRequest(req, repos);
    },
  });

  const stop = async () => {
    server.stop(true);
  };

  return { server, repos, stop };
}
