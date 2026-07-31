import { Database } from 'bun:sqlite';

export function createSQLiteConnection(dbPath = ':memory:'): Database {
  const db = new Database(dbPath, { create: true });

  // Configurações de alta performance e consistência para SQLite
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA synchronous = NORMAL;');
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA temp_store = MEMORY;');

  // Schema das Tabelas de Telemetria
  db.run(`
    CREATE TABLE IF NOT EXISTS spans (
      trace_id TEXT NOT NULL,
      span_id TEXT NOT NULL PRIMARY KEY,
      parent_span_id TEXT,
      name TEXT NOT NULL,
      kind INTEGER NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      duration_ms REAL NOT NULL,
      status_code INTEGER NOT NULL,
      status_message TEXT,
      service_key TEXT NOT NULL,
      attributes_json TEXT NOT NULL,
      events_json TEXT NOT NULL,
      links_json TEXT NOT NULL
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_spans_trace_id ON spans(trace_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_spans_service_key ON spans(service_key);');
  db.run('CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);');

  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT,
      type TEXT NOT NULL,
      service_key TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      value REAL NOT NULL,
      attributes_json TEXT NOT NULL,
      buckets_json TEXT,
      exemplars_json TEXT
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_metrics_name_service ON metrics(name, service_key);');
  db.run('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);');

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      observed_timestamp INTEGER NOT NULL,
      trace_id TEXT,
      span_id TEXT,
      severity_number INTEGER NOT NULL,
      severity_text TEXT NOT NULL,
      service_key TEXT NOT NULL,
      body TEXT NOT NULL,
      attributes_json TEXT NOT NULL
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_logs_trace_id ON logs(trace_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_logs_service_key ON logs(service_key);');
  db.run('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);');

  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      service_key TEXT NOT NULL,
      profile_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      duration_ms REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      flamegraph_data_json TEXT NOT NULL
    );
  `);

  db.run(
    'CREATE INDEX IF NOT EXISTS idx_profiles_service_type ON profiles(service_key, profile_type);',
  );

  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      github_url TEXT,
      namespace TEXT,
      environment TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      cloud_provider TEXT,
      cloud_region TEXT,
      cloud_platform TEXT,
      is_serverless INTEGER,
      first_seen_ms INTEGER,
      last_seen_ms INTEGER,
      instance_count INTEGER,
      lifecycle_state TEXT,
      metrics_summary_json TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dependencies (
      source_service TEXT NOT NULL,
      target_service TEXT NOT NULL,
      call_count INTEGER NOT NULL,
      error_count INTEGER NOT NULL,
      avg_latency_ms REAL NOT NULL,
      p50_latency_ms REAL,
      p95_latency_ms REAL,
      p99_latency_ms REAL,
      is_cross_cloud INTEGER,
      source_cloud_provider TEXT,
      target_cloud_provider TEXT,
      protocol TEXT,
      estimated_egress_bytes INTEGER,
      PRIMARY KEY (source_service, target_service)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS slos (
      id TEXT PRIMARY KEY,
      service_id TEXT,
      name TEXT NOT NULL,
      service_key TEXT,
      service_name TEXT NOT NULL,
      target_percentage REAL NOT NULL,
      window_period_days INTEGER NOT NULL,
      indicator_type TEXT NOT NULL,
      threshold_ms REAL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rca_reports (
      incident_id TEXT PRIMARY KEY,
      root_cause_type TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      summary TEXT NOT NULL,
      primary_service TEXT NOT NULL,
      causal_factors_json TEXT NOT NULL,
      suggested_action TEXT NOT NULL
    );
  `);

  try {
    db.run('ALTER TABLE slos ADD COLUMN service_name TEXT;');
  } catch {
    // Coluna service_name já existe no schema SQLite
  }

  return db;
}
