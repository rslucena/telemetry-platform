import type { Database } from 'bun:sqlite';
import type {
  ExemplarData,
  LogRecordData,
  MetricData,
  MetricType,
  RCAReport,
  RootCauseType,
  SLOConfig,
  ServiceDependency,
  ServiceNode,
  SpanData,
} from '@telemetry/types';
import type {
  LogFilter,
  LogRepository,
  MetadataRepository,
  MetricFilter,
  MetricRepository,
  ProfileRecord,
  ProfileRepository,
  TraceFilter,
  TraceRepository,
} from '../interfaces';

type SQLParam = string | number | boolean | null | undefined;
type DBRow = Record<string, unknown>;

function resolveServiceKey(db: Database, input: string): string {
  if (!input) return input;
  const row = db
    .query('SELECT id FROM services WHERE id = ? OR name = ? LIMIT 1')
    .get(input, input) as DBRow | null;
  return row?.id ? String(row.id) : input;
}

export class SQLiteTraceRepository implements TraceRepository {
  constructor(private db: Database) {}

  async insertSpans(spans: SpanData[]): Promise<void> {
    if (spans.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO spans (
        trace_id, span_id, parent_span_id, name, kind, start_time, end_time,
        duration_ms, status_code, status_message, service_key,
        attributes_json, events_json, links_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: SpanData[]) => {
      for (const span of items) {
        stmt.run(
          span.traceId,
          span.spanId,
          span.parentSpanId || null,
          span.name,
          span.kind,
          span.startTime,
          span.endTime,
          span.durationMs,
          span.statusCode,
          span.statusMessage || null,
          span.serviceName,
          JSON.stringify(span.attributes || {}),
          JSON.stringify(span.events || []),
          JSON.stringify(span.links || []),
        );
      }
    });

    transaction(spans);
  }

  async getTraceById(traceId: string): Promise<SpanData[]> {
    const rows = this.db
      .query(
        'SELECT t.*, s.name as service_human_name FROM spans t LEFT JOIN services s ON (t.service_key = s.id OR t.service_key = s.name) WHERE t.trace_id = ? ORDER BY t.start_time ASC',
      )
      .all(traceId) as DBRow[];
    return rows.map((r) => this.mapSpanRow(r));
  }

  async getSpanById(spanId: string): Promise<SpanData | null> {
    const row = this.db
      .query(
        'SELECT t.*, s.name as service_human_name FROM spans t LEFT JOIN services s ON (t.service_key = s.id OR t.service_key = s.name) WHERE t.span_id = ?',
      )
      .get(spanId) as DBRow | null;
    return row ? this.mapSpanRow(row) : null;
  }

  async findTraces(filter: TraceFilter): Promise<SpanData[]> {
    const conditions: string[] = [];
    const params: SQLParam[] = [];

    if (filter.serviceName) {
      const serviceKey = resolveServiceKey(this.db, filter.serviceName);
      conditions.push('(t.service_key = ? OR t.service_key = ? OR s.name = ?)');
      params.push(filter.serviceName, serviceKey, filter.serviceName);
    }

    if (filter.name) {
      conditions.push('t.name LIKE ?');
      params.push(`%${filter.name}%`);
    }
    if (filter.minDurationMs !== undefined) {
      conditions.push('t.duration_ms >= ?');
      params.push(filter.minDurationMs);
    }
    if (filter.maxDurationMs !== undefined) {
      conditions.push('t.duration_ms <= ?');
      params.push(filter.maxDurationMs);
    }
    if (filter.statusCode !== undefined) {
      conditions.push('t.status_code = ?');
      params.push(filter.statusCode);
    }
    if (filter.startTimeMs !== undefined) {
      conditions.push('t.start_time >= ?');
      params.push(filter.startTimeMs);
    }
    if (filter.endTimeMs !== undefined) {
      conditions.push('t.start_time <= ?');
      params.push(filter.endTimeMs);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(1000, Number(filter.limit) || 100));
    const limitClause = `LIMIT ${safeLimit}`;

    const sql = `SELECT t.*, s.name as service_human_name FROM spans t LEFT JOIN services s ON (t.service_key = s.id OR t.service_key = s.name) ${whereClause} ORDER BY t.start_time DESC ${limitClause}`;
    const rows = this.db.query(sql).all(...params) as DBRow[];

    return rows.map((r) => this.mapSpanRow(r));
  }

  private mapSpanRow(row: DBRow): SpanData {
    return {
      traceId: String(row.trace_id),
      spanId: String(row.span_id),
      parentSpanId: row.parent_span_id ? String(row.parent_span_id) : undefined,
      name: String(row.name),
      kind: Number(row.kind),
      startTime: Number(row.start_time),
      endTime: Number(row.end_time),
      durationMs: Number(row.duration_ms),
      statusCode: Number(row.status_code),
      statusMessage: row.status_message ? String(row.status_message) : undefined,
      serviceName: String(row.service_human_name || row.service_key),

      attributes: JSON.parse(String(row.attributes_json || '{}')),
      events: JSON.parse(String(row.events_json || '[]')),
      links: JSON.parse(String(row.links_json || '[]')),
    };
  }
}

export class SQLiteMetricRepository implements MetricRepository {
  constructor(private db: Database) {}

  async insertMetrics(metrics: MetricData[]): Promise<void> {
    if (metrics.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (
        id, name, description, unit, type, service_key, timestamp, value,
        attributes_json, buckets_json, exemplars_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: MetricData[]) => {
      for (const m of items) {
        stmt.run(
          m.id,
          m.name,
          m.description || null,
          m.unit || null,
          m.type,
          m.serviceName,
          m.timestamp,
          m.value,
          JSON.stringify(m.attributes || {}),
          m.buckets ? JSON.stringify(m.buckets) : null,
          m.exemplars ? JSON.stringify(m.exemplars) : null,
        );
      }
    });

    transaction(metrics);
  }

  async queryMetrics(filter: MetricFilter): Promise<MetricData[]> {
    const conditions: string[] = [];
    const params: SQLParam[] = [];

    if (filter.name) {
      conditions.push('m.name = ?');
      params.push(filter.name);
    }
    if (filter.serviceName) {
      const serviceKey = resolveServiceKey(this.db, filter.serviceName);
      conditions.push('m.service_key = ?');
      params.push(serviceKey);
    }

    if (filter.metricType) {
      conditions.push('m.type = ?');
      params.push(filter.metricType);
    }
    if (filter.startTimeMs) {
      conditions.push('m.timestamp >= ?');
      params.push(filter.startTimeMs);
    }
    if (filter.endTimeMs) {
      conditions.push('m.timestamp <= ?');
      params.push(filter.endTimeMs);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ? `LIMIT ${filter.limit}` : 'LIMIT 200';

    const sql = `SELECT m.*, s.name as service_human_name FROM metrics m LEFT JOIN services s ON m.service_key = s.id ${where} ORDER BY m.timestamp ASC ${limit}`;
    const rows = this.db.query(sql).all(...params) as DBRow[];

    return rows.map((r) => this.mapMetricRow(r));
  }

  async getMetricSeries(
    name: string,
    serviceName: string,
    startTimeMs: number,
    endTimeMs: number,
  ): Promise<MetricData[]> {
    return this.queryMetrics({ name, serviceName, startTimeMs, endTimeMs });
  }

  async getExemplars(traceId: string): Promise<ExemplarData[]> {
    const rows = this.db
      .query(
        'SELECT exemplars_json FROM metrics WHERE exemplars_json IS NOT NULL AND exemplars_json LIKE ?',
      )
      .all(`%${traceId}%`) as DBRow[];
    const exemplars: ExemplarData[] = [];

    for (const r of rows) {
      if (r.exemplars_json) {
        const parsed = JSON.parse(String(r.exemplars_json)) as ExemplarData[];
        exemplars.push(...parsed.filter((e) => e.traceId === traceId));
      }
    }

    return exemplars;
  }

  private mapMetricRow(row: DBRow): MetricData {
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : undefined,
      unit: row.unit ? String(row.unit) : undefined,
      type: row.type as MetricType,
      serviceName: String(row.service_human_name || row.service_key),

      timestamp: Number(row.timestamp),
      value: Number(row.value),
      attributes: JSON.parse(String(row.attributes_json || '{}')),
      buckets: row.buckets_json ? JSON.parse(String(row.buckets_json)) : undefined,
      exemplars: row.exemplars_json ? JSON.parse(String(row.exemplars_json)) : undefined,
    };
  }
}

export class SQLiteLogRepository implements LogRepository {
  constructor(private db: Database) {}

  async insertLogs(logs: LogRecordData[]): Promise<void> {
    if (logs.length === 0) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO logs (
        id, timestamp, observed_timestamp, trace_id, span_id,
        severity_number, severity_text, service_key, body, attributes_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: LogRecordData[]) => {
      for (const l of items) {
        stmt.run(
          l.id,
          l.timestamp,
          l.observedTimestamp,
          l.traceId || null,
          l.spanId || null,
          l.severityNumber,
          l.severityText,
          l.serviceName,
          l.body,
          JSON.stringify(l.attributes || {}),
        );
      }
    });

    transaction(logs);
  }

  async searchLogs(filter: LogFilter): Promise<LogRecordData[]> {
    const conditions: string[] = [];
    const params: SQLParam[] = [];

    if (filter.serviceName) {
      const serviceKey = resolveServiceKey(this.db, filter.serviceName);
      conditions.push('l.service_key = ?');
      params.push(serviceKey);
    }

    if (filter.traceId) {
      conditions.push('l.trace_id = ?');
      params.push(filter.traceId);
    }
    if (filter.severityNumber !== undefined) {
      conditions.push('l.severity_number >= ?');
      params.push(filter.severityNumber);
    }
    if (filter.query) {
      conditions.push('l.body LIKE ?');
      params.push(`%${filter.query}%`);
    }
    if (filter.startTimeMs) {
      conditions.push('l.timestamp >= ?');
      params.push(filter.startTimeMs);
    }
    if (filter.endTimeMs) {
      conditions.push('l.timestamp <= ?');
      params.push(filter.endTimeMs);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit ? `LIMIT ${filter.limit}` : 'LIMIT 100';

    const sql = `SELECT l.*, s.name as service_human_name FROM logs l LEFT JOIN services s ON l.service_key = s.id ${where} ORDER BY l.timestamp DESC ${limit}`;
    const rows = this.db.query(sql).all(...params) as DBRow[];

    return rows.map((r) => this.mapLogRow(r));
  }

  async getLogById(id: string): Promise<LogRecordData | null> {
    const row = this.db
      .query(
        'SELECT l.*, s.name as service_human_name FROM logs l LEFT JOIN services s ON l.service_key = s.id WHERE l.id = ?',
      )
      .get(id) as DBRow | null;
    return row ? this.mapLogRow(row) : null;
  }

  private mapLogRow(row: DBRow): LogRecordData {
    return {
      id: String(row.id),
      timestamp: Number(row.timestamp),
      observedTimestamp: Number(row.observed_timestamp),
      traceId: row.trace_id ? String(row.trace_id) : undefined,
      spanId: row.span_id ? String(row.span_id) : undefined,
      severityNumber: Number(row.severity_number),
      severityText: String(row.severity_text),
      serviceName: String(row.service_human_name || row.service_key),
      body: String(row.body),
      attributes: JSON.parse(String(row.attributes_json || '{}')),
    };
  }
}

export class SQLiteProfileRepository implements ProfileRepository {
  constructor(private db: Database) {}

  async insertProfile(profile: ProfileRecord): Promise<void> {
    this.db
      .prepare(`
      INSERT OR REPLACE INTO profiles (
        id, service_key, profile_type, timestamp, duration_ms, sample_count, flamegraph_data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        profile.id,
        profile.serviceName,
        profile.profileType,
        profile.timestamp,
        profile.durationMs,
        profile.sampleCount,
        profile.flamegraphDataJson,
      );
  }

  async getProfiles(
    serviceName?: string,
    profileType?: string,
    limit = 50,
  ): Promise<ProfileRecord[]> {
    const conditions: string[] = [];
    const params: SQLParam[] = [];

    if (serviceName && serviceName !== 'all') {
      const serviceKey = resolveServiceKey(this.db, serviceName);
      conditions.push('p.service_key = ?');
      params.push(serviceKey);
    }

    if (profileType) {
      conditions.push('p.profile_type = ?');
      params.push(profileType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT p.*, s.name as service_human_name FROM profiles p LEFT JOIN services s ON p.service_key = s.id ${where} ORDER BY p.timestamp DESC LIMIT ${limit}`;
    const rows = this.db.query(sql).all(...params) as DBRow[];

    return rows.map((r) => ({
      id: String(r.id),
      serviceName: String(r.service_human_name || r.service_key),
      profileType: r.profile_type as ProfileRecord['profileType'],
      timestamp: Number(r.timestamp),
      durationMs: Number(r.duration_ms),
      sampleCount: Number(r.sample_count),
      flamegraphDataJson: String(r.flamegraph_data_json),
    }));
  }

  async getFlamegraph(profileId: string): Promise<ProfileRecord | null> {
    const row = this.db
      .query(
        'SELECT p.*, s.name as service_human_name FROM profiles p LEFT JOIN services s ON p.service_key = s.id WHERE p.id = ?',
      )
      .get(profileId) as DBRow | null;
    if (!row) return null;
    return {
      id: String(row.id),
      serviceName: String(row.service_human_name || row.service_key),
      profileType: row.profile_type as ProfileRecord['profileType'],
      timestamp: Number(row.timestamp),
      durationMs: Number(row.duration_ms),
      sampleCount: Number(row.sample_count),
      flamegraphDataJson: String(row.flamegraph_data_json),
    };
  }
}

export class SQLiteMetadataRepository implements MetadataRepository {
  constructor(private db: Database) {}

  async saveServiceNode(node: ServiceNode): Promise<void> {
    this.db
      .prepare(`
      INSERT OR REPLACE INTO services (
        id, name, github_url, namespace, environment, version, status,
        cloud_provider, cloud_region, cloud_platform, is_serverless,
        first_seen_ms, last_seen_ms, instance_count, lifecycle_state, metrics_summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        node.id,
        node.name,
        node.githubUrl || null,
        node.namespace || null,
        node.environment,
        node.version,
        node.status,
        node.cloudProvider || null,
        node.cloudRegion || null,
        node.cloudPlatform || null,
        node.isServerless ? 1 : 0,
        node.firstSeenMs || null,
        node.lastSeenMs || null,
        node.instanceCount || 1,
        node.lifecycleState || 'active',
        node.metricsSummary ? JSON.stringify(node.metricsSummary) : null,
      );
  }

  async getServices(): Promise<ServiceNode[]> {
    const rows = this.db.query('SELECT * FROM services').all() as DBRow[];
    const humanNames = new Set(
      rows
        .map((r) => String(r.name))
        .filter((name) => !name.startsWith('srv-') && !name.startsWith('svc-srv-')),
    );
    const filteredRows = rows.filter((r) => {
      const name = String(r.name);
      if (name.startsWith('srv-') || name.startsWith('svc-srv-')) {
        return humanNames.size === 0;
      }
      return true;
    });

    return filteredRows.map((r) => {
      const serviceName = String(r.name);

      // Calcular estatísticas dinâmicas da tabela de spans para este serviço
      const stats = this.db
        .query(
          `SELECT 
             COUNT(*) as total_spans,
             SUM(CASE WHEN status_code = 2 THEN 1 ELSE 0 END) as error_spans,
             AVG(duration_ms) as avg_duration,
             MAX(duration_ms) as max_duration
           FROM spans 
           WHERE service_key = ?`,
        )
        .get(String(r.id)) as DBRow | null;

      let metricsSummary = r.metrics_summary_json
        ? JSON.parse(String(r.metrics_summary_json))
        : undefined;

      const totalSpans = Number(stats?.total_spans || 0);
      if (totalSpans > 0) {
        const errorSpans = Number(stats?.error_spans || 0);
        const avgDuration = Number(stats?.avg_duration || 0);
        metricsSummary = {
          rps: Number((totalSpans / 10).toFixed(1)),
          errorRate: Number(((errorSpans / totalSpans) * 100).toFixed(2)),
          p95LatencyMs: Number((avgDuration * 1.25).toFixed(1)),
        };
      } else if (!metricsSummary) {
        metricsSummary = {
          rps: 0,
          errorRate: 0,
          p95LatencyMs: 0,
        };
      }

      return {
        id: String(r.id),
        name: serviceName,
        githubUrl: r.github_url ? String(r.github_url) : undefined,
        namespace: r.namespace ? String(r.namespace) : undefined,
        environment: String(r.environment),
        version: String(r.version),
        status: r.status as ServiceNode['status'],
        cloudProvider: r.cloud_provider
          ? (r.cloud_provider as ServiceNode['cloudProvider'])
          : 'gcp',

        cloudRegion: r.cloud_region ? String(r.cloud_region) : undefined,
        cloudPlatform: r.cloud_platform ? String(r.cloud_platform) : undefined,
        isServerless: Boolean(r.is_serverless),
        firstSeenMs: r.first_seen_ms ? Number(r.first_seen_ms) : undefined,
        lastSeenMs: r.last_seen_ms ? Number(r.last_seen_ms) : undefined,
        instanceCount: r.instance_count ? Number(r.instance_count) : 1,
        lifecycleState: r.lifecycle_state
          ? (r.lifecycle_state as ServiceNode['lifecycleState'])
          : 'active',
        metricsSummary,
      };
    });
  }

  async saveDependency(dep: ServiceDependency): Promise<void> {
    this.db
      .prepare(`
      INSERT OR REPLACE INTO dependencies (
        source_service, target_service, call_count, error_count, avg_latency_ms,
        p50_latency_ms, p95_latency_ms, p99_latency_ms, is_cross_cloud,
        source_cloud_provider, target_cloud_provider, protocol, estimated_egress_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        dep.sourceService,
        dep.targetService,
        dep.callCount,
        dep.errorCount,
        dep.avgLatencyMs,
        dep.p50LatencyMs || dep.avgLatencyMs,
        dep.p95LatencyMs || dep.avgLatencyMs,
        dep.p99LatencyMs || dep.avgLatencyMs,
        dep.isCrossCloud ? 1 : 0,
        dep.sourceCloudProvider || null,
        dep.targetCloudProvider || null,
        dep.protocol || 'http',
        dep.estimatedEgressBytes || 0,
      );
  }

  async getServiceTopology(): Promise<ServiceDependency[]> {
    const rows = this.db.query('SELECT * FROM dependencies').all() as DBRow[];
    return rows.map((r) => ({
      sourceService: String(r.source_service),
      targetService: String(r.target_service),
      callCount: Number(r.call_count),
      errorCount: Number(r.error_count),
      avgLatencyMs: Number(r.avg_latency_ms),
      p50LatencyMs: r.p50_latency_ms ? Number(r.p50_latency_ms) : Number(r.avg_latency_ms),
      p95LatencyMs: r.p95_latency_ms ? Number(r.p95_latency_ms) : Number(r.avg_latency_ms),
      p99LatencyMs: r.p99_latency_ms ? Number(r.p99_latency_ms) : Number(r.avg_latency_ms),
      isCrossCloud: Boolean(r.is_cross_cloud),
      sourceCloudProvider: r.source_cloud_provider
        ? (r.source_cloud_provider as ServiceDependency['sourceCloudProvider'])
        : undefined,
      targetCloudProvider: r.target_cloud_provider
        ? (r.target_cloud_provider as ServiceDependency['targetCloudProvider'])
        : undefined,
      protocol: r.protocol ? (r.protocol as ServiceDependency['protocol']) : 'http',
      estimatedEgressBytes: r.estimated_egress_bytes ? Number(r.estimated_egress_bytes) : 0,
    }));
  }

  async saveSLO(slo: SLOConfig): Promise<void> {
    const serviceKey = resolveServiceKey(this.db, slo.serviceName);
    this.db
      .prepare(`
      INSERT OR REPLACE INTO slos (id, service_id, name, service_key, service_name, target_percentage, window_period_days, indicator_type, threshold_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        slo.id,
        serviceKey,
        slo.name,
        serviceKey,
        slo.serviceName,
        slo.targetPercentage,
        slo.windowPeriodDays,
        slo.indicatorType,
        slo.thresholdMs || null,
      );
  }

  async getSLOs(): Promise<SLOConfig[]> {
    const rows = this.db.query('SELECT * FROM slos').all() as DBRow[];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      serviceName: String(r.service_name),
      targetPercentage: Number(r.target_percentage),
      windowPeriodDays: Number(r.window_period_days),
      indicatorType: r.indicator_type as SLOConfig['indicatorType'],
      thresholdMs: r.threshold_ms ? Number(r.threshold_ms) : undefined,
    }));
  }

  async saveRCAReport(report: RCAReport): Promise<void> {
    this.db
      .prepare(`
      INSERT OR REPLACE INTO rca_reports (
        incident_id, root_cause_type, confidence_score, summary, primary_service,
        causal_factors_json, suggested_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        report.incidentId,
        report.rootCauseType,
        report.confidenceScore,
        report.summary,
        report.primaryService,
        JSON.stringify(report.causalFactors),
        report.suggestedAction,
      );
  }

  async getRCAReports(limit = 20): Promise<RCAReport[]> {
    const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 20));
    const rows = this.db.query('SELECT * FROM rca_reports LIMIT ?').all(safeLimit) as DBRow[];
    return rows.map((r) => ({
      incidentId: String(r.incident_id),
      rootCauseType: r.root_cause_type as RootCauseType,
      confidenceScore: Number(r.confidence_score),
      summary: String(r.summary),
      primaryService: String(r.primary_service),
      causalFactors: JSON.parse(String(r.causal_factors_json)),
      suggestedAction: String(r.suggested_action),
    }));
  }

  async purgeAllData(): Promise<void> {
    this.db.run('DELETE FROM spans;');
    this.db.run('DELETE FROM logs;');
    this.db.run('DELETE FROM metrics;');
    this.db.run('DELETE FROM slos;');
    this.db.run('DELETE FROM services;');
    this.db.run('DELETE FROM profiles;');
    this.db.run('DELETE FROM rca_reports;');
    this.db.run('DELETE FROM dependencies;');
  }
}

export function createSQLiteRepositories(db: Database) {
  return {
    traces: new SQLiteTraceRepository(db),
    metrics: new SQLiteMetricRepository(db),
    logs: new SQLiteLogRepository(db),
    profiles: new SQLiteProfileRepository(db),
    metadata: new SQLiteMetadataRepository(db),
  };
}
