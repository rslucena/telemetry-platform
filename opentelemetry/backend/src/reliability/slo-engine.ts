import type { SLOConfig, SLOStatus } from '@telemetry/types';
import type { Repositories } from '../repositories/interfaces';

export class SloEngine {
  constructor(private repos: Repositories) {}

  /**
   * Calcula o status em tempo real de um SLO específico
   */
  async calculateSLOStatus(slo: SLOConfig, nowMs = Date.now()): Promise<SLOStatus> {
    const windowMs = slo.windowPeriodDays * 24 * 60 * 60 * 1000;
    const startTimeMs = nowMs - windowMs;

    const spans = await this.repos.traces.findTraces({
      serviceName: slo.serviceName,
      startTimeMs,
      limit: 10000,
    });

    const totalEvents = spans.length;
    let successfulEvents = 0;

    if (totalEvents === 0) {
      // Sem telemetria no período, assume SLO 100% preservado
      return {
        sloId: slo.id,
        sloName: slo.name,
        serviceName: slo.serviceName,
        targetPercentage: slo.targetPercentage,
        sliValue: 100,
        errorBudgetRemaining: 100,
        burnRate: 0,
        windowPeriodDays: slo.windowPeriodDays,
        status: 'ok',
      };
    }

    if (slo.indicatorType === 'availability' || slo.indicatorType === 'error_rate') {
      successfulEvents = spans.filter((s) => s.statusCode !== 2).length; // 2 = ERROR
    } else if (slo.indicatorType === 'latency' && slo.thresholdMs) {
      const threshold = slo.thresholdMs;
      successfulEvents = spans.filter((s) => s.durationMs <= threshold).length;
    } else {
      successfulEvents = spans.filter((s) => s.statusCode !== 2).length;
    }

    const sliFraction = successfulEvents / totalEvents;
    const sliValue = Math.round(sliFraction * 10000) / 100; // ex: 99.94

    const targetFraction = slo.targetPercentage / 100;
    const allowedUnreliability = 1 - targetFraction;
    const actualUnreliability = 1 - sliFraction;

    const burnRate =
      allowedUnreliability > 0
        ? Math.round((actualUnreliability / allowedUnreliability) * 100) / 100
        : 0;

    let errorBudgetRemaining = 100;
    if (slo.targetPercentage < 100) {
      const budgetConsumedFraction = actualUnreliability / allowedUnreliability;
      errorBudgetRemaining = Math.max(0, Math.round((1 - budgetConsumedFraction) * 10000) / 100);
    }

    let status: 'ok' | 'warning' | 'breached' = 'ok';
    if (errorBudgetRemaining <= 0) {
      status = 'breached';
    } else if (burnRate > 1.0 || errorBudgetRemaining < 20) {
      status = 'warning';
    }

    return {
      sloId: slo.id,
      sloName: slo.name,
      serviceName: slo.serviceName,
      targetPercentage: slo.targetPercentage,
      sliValue,
      errorBudgetRemaining,
      burnRate,
      windowPeriodDays: slo.windowPeriodDays,
      status,
    };
  }

  /**
   * Avalia todos os SLOs cadastrados no sistema
   */
  async evaluateAllSLOs(): Promise<SLOStatus[]> {
    const slos = await this.repos.metadata.getSLOs();
    const statuses: SLOStatus[] = [];

    for (const slo of slos) {
      const status = await this.calculateSLOStatus(slo);
      statuses.push(status);
    }

    return statuses;
  }
}
