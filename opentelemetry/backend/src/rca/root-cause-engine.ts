import type { Incident, RCAEvidence, RCAHypothesis, RCAReport } from '@telemetry/types';
import { RootCauseType } from '@telemetry/types';
import type { Repositories } from '../repositories/interfaces';

export class RootCauseEngine {
  constructor(private repos: Repositories) {}

  /**
   * Performs statistical and heuristic root cause analysis for an incident
   */
  async analyzeIncident(incident: Incident): Promise<RCAReport> {
    const serviceName = incident.serviceName;
    const now = Date.now();
    const windowStart = incident.createdAt - 15 * 60 * 1000; // 15 mins prior to incident

    // 1. Collect Spans and Logs in window
    const spans = await this.repos.traces.findTraces({
      serviceName,
      startTimeMs: windowStart,
      limit: 1000,
    });

    const logs = await this.repos.logs.searchLogs({
      serviceName,
      severityNumber: 17, // ERROR
    });

    const dependencies = await this.repos.metadata.getServiceTopology();

    // 2. Identify initial anomaly timestamp in timeline
    let firstAnomalyTimestamp = incident.createdAt;
    let anomalyTraceId: string | undefined = incident.traceId;

    const errorSpans = spans.filter((s) => s.statusCode === 2);
    if (errorSpans.length > 0) {
      errorSpans.sort((a, b) => a.startTime - b.startTime);
      firstAnomalyTimestamp = errorSpans[0].startTime;
      anomalyTraceId = errorSpans[0].traceId;
    } else if (logs.length > 0) {
      logs.sort((a, b) => a.timestamp - b.timestamp);
      firstAnomalyTimestamp = logs[0].timestamp;
      anomalyTraceId = logs[0].traceId;
    }

    // 3. Build ranked hypotheses with empirical evidence
    const hypotheses: RCAHypothesis[] = [];

    // Hypothesis 1: Database / Storage Failure
    const dbSpans = spans.filter((s) => s.attributes['db.system']);
    if (dbSpans.length > 0) {
      const dbErrors = dbSpans.filter((s) => s.statusCode === 2);
      const avgDbLatency =
        dbSpans.reduce((acc, s) => acc + s.durationMs, 0) / (dbSpans.length || 1);

      const dbSystem = String(dbSpans[0].attributes['db.system']);
      const evidences: RCAEvidence[] = [
        {
          type: 'span',
          description: `Total of ${dbSpans.length} queries executed on ${dbSystem} database`,
          baselineValue: '50ms',
          anomalyValue: `${Math.round(avgDbLatency)}ms`,
          traceId: dbSpans[0].traceId,
        },
      ];

      if (dbErrors.length > 0) {
        evidences.push({
          type: 'log',
          description: `${dbErrors.length} queries failed with SQL driver error`,
          anomalyValue: `${dbErrors.length} failures`,
          traceId: dbErrors[0].traceId,
        });
      }

      const confidence = dbErrors.length > 0 ? 87 : 72;
      hypotheses.push({
        rank: 1,
        serviceName: `${serviceName}-${dbSystem}`,
        causeType: RootCauseType.LATENCY_SPIKE,
        confidencePercent: confidence,
        summary: `Database query saturation or high latency on ${dbSystem}`,
        evidences,
        suggestedAction: 'Check database pool connections, slow query indexes, and IOPS metrics.',
      });
    }

    // Hypothesis 2: Downstream Cross-Cloud Dependency Failure
    const downstreamDeps = dependencies.filter((d) => d.sourceService === serviceName);
    for (const dep of downstreamDeps) {
      const evidences: RCAEvidence[] = [
        {
          type: 'topology',
          description: `Dependency edge ${dep.sourceService} -> ${dep.targetService}`,
          baselineValue: '100% OK',
          anomalyValue: `${dep.errorCount} observed errors`,
        },
      ];

      if (dep.isCrossCloud) {
        evidences.push({
          type: 'metric',
          description: `Cross-Cloud edge (${dep.sourceCloudProvider} -> ${dep.targetCloudProvider}) showed P95 latency of ${dep.p95LatencyMs}ms`,
          baselineValue: `${dep.avgLatencyMs}ms`,
          anomalyValue: `${dep.p95LatencyMs}ms`,
        });
      }

      const confidence = dep.isCrossCloud ? 82 : 68;
      hypotheses.push({
        rank: hypotheses.length + 1,
        serviceName: dep.targetService,
        causeType: RootCauseType.DEPENDENCY_FAILURE,
        confidencePercent: confidence,
        summary: `Instability or latency in downstream dependency '${dep.targetService}'`,
        evidences,
        suggestedAction: `Investigate metrics and logs for downstream service '${dep.targetService}'.`,
      });
    }

    // Hypothesis 3: Internal Application Exception Burst
    const internalErrors = spans.filter((s) => s.statusCode === 2).length;
    const internalEvidences: RCAEvidence[] = [
      {
        type: 'log',
        description: `Recorded ${logs.length} error logs on service ${serviceName}`,
        anomalyValue: `${logs.length} errors`,
        traceId: logs[0]?.traceId,
      },
    ];

    hypotheses.push({
      rank: hypotheses.length + 1,
      serviceName,
      causeType: RootCauseType.ERROR_BURST,
      confidencePercent: internalErrors > 0 ? 65 : 45,
      summary: `Burst of internal exceptions/errors in application ${serviceName}`,
      evidences: internalEvidences,
      suggestedAction: 'Analyze log stack traces in Correlation Engine to identify line of error.',
    });

    // Rank hypotheses by descending confidence score
    hypotheses.sort((a, b) => b.confidencePercent - a.confidencePercent);
    hypotheses.forEach((h, index) => {
      h.rank = index + 1;
    });

    const topHypothesis = hypotheses[0];
    const report: RCAReport = {
      incidentId: incident.id,
      rootCauseType: topHypothesis ? topHypothesis.causeType : RootCauseType.ERROR_BURST,
      confidenceScore: topHypothesis ? topHypothesis.confidencePercent / 100 : 0.5,
      summary: topHypothesis
        ? topHypothesis.summary
        : `Unspecified error on service ${serviceName}`,
      primaryService: topHypothesis ? topHypothesis.serviceName : serviceName,
      firstAnomalyTimestamp,
      causalFactors: hypotheses.map((h) => ({
        serviceName: h.serviceName,
        metricOrSpan: h.evidences[0]?.description || h.summary,
        impactScore: h.confidencePercent / 100,
        explanation: h.summary,
        traceId: anomalyTraceId,
      })),
      hypotheses,
      suggestedAction: topHypothesis
        ? topHypothesis.suggestedAction
        : 'Check system logs and metrics.',
    };

    await this.repos.metadata.saveRCAReport(report);
    return report;
  }
}
