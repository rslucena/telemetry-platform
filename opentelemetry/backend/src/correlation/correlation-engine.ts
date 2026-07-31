import type { ExemplarData, LogRecordData, SpanData } from '@telemetry/types';
import type { ProfileRecord, Repositories } from '../repositories/interfaces';

export interface CorrelatedTraceContext {
  traceId: string;
  spans: SpanData[];
  logs: LogRecordData[];
  exemplars: ExemplarData[];
  profiles: ProfileRecord[];
}

export class CorrelationEngine {
  constructor(private repos: Repositories) {}

  /**
   * Obtém os logs correlacionados a um Trace ID específico
   */
  async getLogsForTrace(traceId: string): Promise<LogRecordData[]> {
    return this.repos.logs.searchLogs({ traceId });
  }

  /**
   * Obtém o Trace e seus Spans a partir do ID de um registro de Log
   */
  async getTraceForLog(logId: string): Promise<{ log: LogRecordData; spans: SpanData[] } | null> {
    const log = await this.repos.logs.getLogById(logId);
    if (!log || !log.traceId) return null;

    const spans = await this.repos.traces.getTraceById(log.traceId);
    return { log, spans };
  }

  /**
   * Recupera os Exemplars vinculados a uma determinada métrica
   */
  async getExemplarsForMetric(metricName: string): Promise<ExemplarData[]> {
    const metrics = await this.repos.metrics.queryMetrics({ name: metricName });
    const exemplars: ExemplarData[] = [];

    for (const m of metrics) {
      if (m.exemplars && Array.isArray(m.exemplars)) {
        exemplars.push(...m.exemplars);
      }
    }

    return exemplars;
  }

  /**
   * Conecta um Trace ID a perfis de CPU/Memória do serviço no mesmo intervalo de tempo
   */
  async getProfilesForTrace(traceId: string): Promise<ProfileRecord[]> {
    const spans = await this.repos.traces.getTraceById(traceId);
    if (spans.length === 0) return [];

    const serviceName = spans[0].serviceName;
    const profiles = await this.repos.profiles.getProfiles(serviceName);

    const minTime = spans[0].startTime - 60000; // janela de 1 minuto antes
    const maxTime = spans[spans.length - 1].endTime + 60000;

    return profiles.filter((p) => p.timestamp >= minTime && p.timestamp <= maxTime);
  }

  /**
   * Retorna o contexto de correlação cruzada completo (Cross-Signal Correlation Context)
   */
  async getCorrelatedContext(traceId: string): Promise<CorrelatedTraceContext> {
    const spans = await this.repos.traces.getTraceById(traceId);
    const logs = await this.getLogsForTrace(traceId);
    const exemplars = await this.repos.metrics.getExemplars(traceId);
    const profiles = await this.getProfilesForTrace(traceId);

    return {
      traceId,
      spans,
      logs,
      exemplars,
      profiles,
    };
  }
}
