import type { ServiceDependency, SpanData } from '@telemetry/types';
import type { MetadataRepository, TraceRepository } from '../repositories/interfaces';

export class TopologyEngine {
  constructor(
    private metadataRepo?: MetadataRepository,
    private traceRepo?: TraceRepository,
  ) {}

  /**
   * Processa uma lista de Spans para extrair o grafo de dependências entre serviços
   */
  async processSpans(spans: SpanData[]): Promise<ServiceDependency[]> {
    if (spans.length === 0) return [];

    // Mapeia spans por ID para busca rápida de pai -> filho
    const spanMap = new Map<string, SpanData>();
    for (const span of spans) {
      spanMap.set(span.spanId, span);
    }

    // Mapa de dependências agregadas (chave: "sourceService->targetService")
    const edgeMap = new Map<
      string,
      {
        sourceService: string;
        targetService: string;
        callCount: number;
        errorCount: number;
        durationsMs: number[];
        sourceCloudProvider?: 'gcp' | 'aws' | 'azure' | 'local';
        targetCloudProvider?: 'gcp' | 'aws' | 'azure' | 'local';
        protocol?: 'http' | 'grpc' | 'messaging' | 'db';
      }
    >();

    for (const span of spans) {
      if (!span.parentSpanId) continue;

      let parentSpan = spanMap.get(span.parentSpanId);
      if (!parentSpan && this.traceRepo) {
        parentSpan = (await this.traceRepo.getSpanById(span.parentSpanId)) || undefined;
      }

      if (!parentSpan) continue;

      const sourceService = parentSpan.serviceName;
      const targetService = span.serviceName;

      // Apenas conexões entre serviços diferentes formam bordas do grafo
      if (sourceService === targetService) continue;

      const edgeKey = `${sourceService}->${targetService}`;
      const existing = edgeMap.get(edgeKey) || {
        sourceService,
        targetService,
        callCount: 0,
        errorCount: 0,
        durationsMs: [],
        sourceCloudProvider:
          (parentSpan.attributes['cloud.provider'] as
            | ServiceDependency['sourceCloudProvider']
            | undefined) || 'gcp',
        targetCloudProvider:
          (span.attributes['cloud.provider'] as
            | ServiceDependency['targetCloudProvider']
            | undefined) || 'aws',
        protocol: (span.attributes['db.system'] ? 'db' : 'http') as ServiceDependency['protocol'],
      };

      existing.callCount += 1;
      if (span.statusCode === 2) {
        // StatusCode.ERROR
        existing.errorCount += 1;
      }
      existing.durationsMs.push(span.durationMs);

      edgeMap.set(edgeKey, existing);
    }

    const dependencies: ServiceDependency[] = [];

    for (const edge of edgeMap.values()) {
      edge.durationsMs.sort((a, b) => a - b);
      const avgLatencyMs =
        edge.durationsMs.reduce((acc, v) => acc + v, 0) / (edge.durationsMs.length || 1);

      const p50LatencyMs = this.percentile(edge.durationsMs, 0.5);
      const p95LatencyMs = this.percentile(edge.durationsMs, 0.95);
      const p99LatencyMs = this.percentile(edge.durationsMs, 0.99);

      const isCrossCloud =
        Boolean(edge.sourceCloudProvider && edge.targetCloudProvider) &&
        edge.sourceCloudProvider !== edge.targetCloudProvider;

      const estimatedEgressBytes = isCrossCloud ? edge.callCount * 1024 : edge.callCount * 256;

      const dep: ServiceDependency = {
        sourceService: edge.sourceService,
        targetService: edge.targetService,
        callCount: edge.callCount,
        errorCount: edge.errorCount,
        avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
        p50LatencyMs: Math.round(p50LatencyMs * 100) / 100,
        p95LatencyMs: Math.round(p95LatencyMs * 100) / 100,
        p99LatencyMs: Math.round(p99LatencyMs * 100) / 100,
        isCrossCloud,
        sourceCloudProvider: edge.sourceCloudProvider,
        targetCloudProvider: edge.targetCloudProvider,
        protocol: edge.protocol,
        estimatedEgressBytes,
      };

      dependencies.push(dep);

      if (this.metadataRepo) {
        await this.metadataRepo.saveDependency(dep);
      }
    }

    return dependencies;
  }

  private percentile(arr: number[], pct: number): number {
    if (arr.length === 0) return 0;
    const index = Math.floor(pct * (arr.length - 1));
    return arr[index] || arr[0];
  }
}
