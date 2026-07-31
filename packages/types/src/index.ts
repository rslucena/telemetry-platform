// Trace & Span Interfaces
export enum SpanKind {
  INTERNAL = 0,
  SERVER = 1,
  CLIENT = 2,
  PRODUCER = 3,
  CONSUMER = 4,
}

export enum StatusCode {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  tracestate?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface SpanLink {
  context: SpanContext;
  attributes?: Record<string, string | number | boolean>;
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime: number;
  durationMs: number;
  statusCode: StatusCode;
  statusMessage?: string;
  serviceName: string;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  links: SpanLink[];
}

// Metric & Exemplar Interfaces
export enum MetricType {
  COUNTER = 'COUNTER',
  GAUGE = 'GAUGE',
  HISTOGRAM = 'HISTOGRAM',
}

export interface ExemplarData {
  traceId: string;
  spanId: string;
  timestamp: number;
  value: number;
  filteredAttributes?: Record<string, string | number | boolean>;
}

export interface HistogramBucket {
  explicitBound: number;
  count: number;
}

export interface MetricData {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  type: MetricType;
  serviceName: string;
  timestamp: number;
  value: number;
  attributes: Record<string, string | number | boolean>;
  buckets?: HistogramBucket[];
  exemplars?: ExemplarData[];
}

// Log Interfaces
export enum SeverityNumber {
  TRACE = 1,
  DEBUG = 5,
  INFO = 9,
  WARN = 13,
  ERROR = 17,
  FATAL = 21,
}

export interface LogRecordData {
  id: string;
  timestamp: number;
  observedTimestamp: number;
  traceId?: string;
  spanId?: string;
  severityNumber: SeverityNumber;
  severityText: string;
  serviceName: string;
  body: string;
  attributes: Record<string, string | number | boolean>;
}

// Profiling & Flamegraph Interfaces
export interface FlamegraphNode {
  name: string;
  value: number; // total self or cumulative time/samples
  children?: FlamegraphNode[];
  selfTimeMs?: number;
}

export interface ProfileDiffFunction {
  name: string;
  valueA: number;
  valueB: number;
  deltaMs: number;
  deltaPercent: number;
}

export interface ProfileDiffReport {
  profileAId: string;
  profileBId: string;
  serviceName: string;
  profileType: 'cpu' | 'memory' | 'goroutine' | 'mutex';
  totalDeltaMs: number;
  totalDeltaPercent: number;
  regressedFunctions: ProfileDiffFunction[];
  improvedFunctions: ProfileDiffFunction[];
}

export interface ServiceNode {
  id: string;
  name: string;
  githubUrl?: string;
  namespace?: string;
  environment: string;
  version: string;
  status: 'healthy' | 'degraded' | 'critical';
  cloudProvider?: 'gcp' | 'aws' | 'azure' | 'local';
  cloudRegion?: string;
  cloudPlatform?: string;
  isServerless?: boolean;
  firstSeenMs?: number;
  lastSeenMs?: number;
  instanceCount?: number;
  lifecycleState?: 'active' | 'scaled-to-zero' | 'inactive';
  metricsSummary?: {
    rps: number;
    errorRate: number;
    p95LatencyMs: number;
  };
}

export interface ServiceDependency {
  sourceService: string;
  targetService: string;
  callCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  isCrossCloud?: boolean;
  sourceCloudProvider?: 'gcp' | 'aws' | 'azure' | 'local';
  targetCloudProvider?: 'gcp' | 'aws' | 'azure' | 'local';
  protocol?: 'http' | 'grpc' | 'messaging' | 'db';
  estimatedEgressBytes?: number;
}

// SLO & Incident Interfaces
export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export interface SLOConfig {
  id: string;
  name: string;
  serviceName: string;
  targetPercentage: number; // e.g. 99.9
  windowPeriodDays: number; // e.g. 30
  indicatorType: 'latency' | 'availability' | 'error_rate';
  thresholdMs?: number;
}

export interface SLOStatus {
  sloId: string;
  sloName: string;
  serviceName: string;
  targetPercentage: number;
  sliValue: number; // e.g. 99.94
  errorBudgetRemaining: number; // 0 to 100%
  burnRate: number; // 1.0 = normal, > 1.0 = burning faster
  windowPeriodDays: number;
  status: 'ok' | 'warning' | 'breached';
}

export interface Incident {
  id: string;
  title: string;
  serviceName: string;
  severity: AlertSeverity;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'silenced';
  createdAt: number;
  resolvedAt?: number;
  description: string;
  traceId?: string;
  relatedServices?: string[];
  alertCount?: number;
}

// Root Cause Analysis (RCA) Interfaces
export enum RootCauseType {
  LATENCY_SPIKE = 'LATENCY_SPIKE',
  ERROR_BURST = 'ERROR_BURST',
  RESOURCE_EXHAUSTION = 'RESOURCE_EXHAUSTION',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',
}

export interface CausalFactor {
  serviceName: string;
  metricOrSpan: string;
  impactScore: number; // 0.0 to 1.0
  explanation: string;
  traceId?: string;
}

export interface RCAEvidence {
  type: 'metric' | 'span' | 'log' | 'topology';
  description: string;
  baselineValue?: string | number;
  anomalyValue?: string | number;
  traceId?: string;
}

export interface RCAHypothesis {
  rank: number;
  serviceName: string;
  causeType: RootCauseType;
  confidencePercent: number; // 0 to 100%
  summary: string;
  evidences: RCAEvidence[];
  suggestedAction: string;
}

export interface RCAReport {
  incidentId: string;
  rootCauseType: RootCauseType;
  confidenceScore: number; // 0.0 to 1.0 (or 0-100)
  summary: string;
  primaryService: string;
  firstAnomalyTimestamp?: number;
  causalFactors: CausalFactor[];
  hypotheses: RCAHypothesis[];
  suggestedAction: string;
}
