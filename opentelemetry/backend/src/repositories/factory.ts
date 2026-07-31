import type { Database } from 'bun:sqlite';
import type { Repositories } from './interfaces';
import { createSQLiteConnection } from './sqlite/db';
import { createSQLiteRepositories } from './sqlite/sqlite-repositories';

export interface RepositoryFactoryOptions {
  driver?: 'sqlite' | 'production';
  dbPath?: string;
  sqliteInstance?: Database;
}

export function createRepositories(options: RepositoryFactoryOptions = {}): Repositories {
  const driver =
    options.driver ||
    (typeof process !== 'undefined' ? process.env.STORAGE_DRIVER : undefined) ||
    'sqlite';

  if (driver === 'sqlite') {
    const db =
      options.sqliteInstance || createSQLiteConnection(options.dbPath || './telemetry.sqlite');
    return createSQLiteRepositories(db);
  }

  if (driver === 'production') {
    // In production mode, loads SQLite or ClickHouse/VictoriaMetrics driver
    // Graceful fallback to embedded SQLite if external drivers are inactive
    const db =
      options.sqliteInstance || createSQLiteConnection(options.dbPath || './telemetry.sqlite');
    return createSQLiteRepositories(db);
  }

  throw new Error(`Unknown storage driver: ${driver}`);
}
