import type {
  ExemplarData,
  HistogramBucket,
  LogRecordData,
  MetricData,
  MetricType,
  RCAReport,
  SLOConfig,
  SLOStatus,
  ServiceDependency,
  ServiceNode,
  SeverityNumber,
  SpanData,
} from '@telemetry/types';

export interface TraceFilter {
  serviceName?: string;
  name?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  statusCode?: number;
  startTimeMs?: number;
  endTimeMs?: number;
  limit?: number;
}

export interface TraceRepository {
  insertSpans(spans: SpanData[]): Promise<void>;
  getTraceById(traceId: string): Promise<SpanData[]>;
  getSpanById(spanId: string): Promise<SpanData | null>;
  findTraces(filter: TraceFilter): Promise<SpanData[]>;
}

export interface MetricFilter {
  name?: string;
  serviceName?: string;
  metricType?: MetricType;
  startTimeMs?: number;
  endTimeMs?: number;
  limit?: number;
}

export interface MetricRepository {
  insertMetrics(metrics: MetricData[]): Promise<void>;
  queryMetrics(filter: MetricFilter): Promise<MetricData[]>;
  getMetricSeries(
    name: string,
    serviceName: string,
    startTimeMs: number,
    endTimeMs: number,
  ): Promise<MetricData[]>;
  getExemplars(traceId: string): Promise<ExemplarData[]>;
}

export interface LogFilter {
  serviceName?: string;
  traceId?: string;
  severityNumber?: SeverityNumber;
  query?: string;
  startTimeMs?: number;
  endTimeMs?: number;
  limit?: number;
}

export interface LogRepository {
  insertLogs(logs: LogRecordData[]): Promise<void>;
  searchLogs(filter: LogFilter): Promise<LogRecordData[]>;
  getLogById(id: string): Promise<LogRecordData | null>;
}

export interface ProfileRecord {
  id: string;
  serviceName: string;
  profileType: 'cpu' | 'memory' | 'goroutine' | 'mutex';
  timestamp: number;
  durationMs: number;
  sampleCount: number;
  flamegraphDataJson: string;
}

export interface ProfileRepository {
  insertProfile(profile: ProfileRecord): Promise<void>;
  getProfiles(serviceName: string, profileType?: string, limit?: number): Promise<ProfileRecord[]>;
  getFlamegraph(profileId: string): Promise<ProfileRecord | null>;
}

export interface MetadataRepository {
  saveServiceNode(node: ServiceNode): Promise<void>;
  getServices(): Promise<ServiceNode[]>;
  saveDependency(dep: ServiceDependency): Promise<void>;
  getServiceTopology(): Promise<ServiceDependency[]>;
  saveSLO(slo: SLOConfig): Promise<void>;
  getSLOs(): Promise<SLOConfig[]>;
  saveRCAReport(report: RCAReport): Promise<void>;
  getRCAReports(limit?: number): Promise<RCAReport[]>;
  purgeAllData(): Promise<void>;
}

export interface Repositories {
  traces: TraceRepository;
  metrics: MetricRepository;
  logs: LogRepository;
  profiles: ProfileRepository;
  metadata: MetadataRepository;
}
