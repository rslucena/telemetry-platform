import type { Incident, SLOStatus, ServiceDependency } from '@telemetry/types';
import { AlertSeverity } from '@telemetry/types';
import type { Repositories } from '../repositories/interfaces';

export class AlertEngine {
  constructor(private repos: Repositories) {}

  /**
   * Evaluates SLO status and generates alerts on warning or Error Budget breaches
   */
  async evaluateSLOAlerts(sloStatuses: SLOStatus[]): Promise<Incident[]> {
    const incidents: Incident[] = [];
    const now = Date.now();

    for (const slo of sloStatuses) {
      if (slo.status === 'ok') continue;

      const severity = slo.status === 'breached' ? AlertSeverity.CRITICAL : AlertSeverity.WARNING;
      const title =
        slo.status === 'breached'
          ? `SLO Breached: Error Budget exhausted for ${slo.serviceName}`
          : `Reliability Alert: High Burn Rate (${slo.burnRate}x) on ${slo.serviceName}`;

      incidents.push({
        id: `inc-${slo.sloId}-${now}`,
        title,
        serviceName: slo.serviceName,
        severity,
        status: 'open',
        createdAt: now,
        description: `SLO '${slo.sloName}' reached status '${slo.status}'. Current SLI: ${slo.sliValue}%, Error Budget Remaining: ${slo.errorBudgetRemaining}%, Burn Rate: ${slo.burnRate}x.`,
        relatedServices: [slo.serviceName],
        alertCount: 1,
      });
    }

    return incidents;
  }
}

export class IncidentEngine {
  constructor(private repos: Repositories) {}

  /**
   * Groups multiple alerts/incidents from related topology services into a single Root Incident
   */
  groupIncidentsByTopology(incidents: Incident[], dependencies: ServiceDependency[]): Incident[] {
    if (incidents.length <= 1) return incidents;

    const groupedMap = new Map<string, Incident>();

    for (const inc of incidents) {
      let rootIncidentKey = inc.serviceName;

      // Check if incident service depends on another already alerted service
      for (const dep of dependencies) {
        if (dep.targetService === inc.serviceName) {
          const parentInc = incidents.find((i) => i.serviceName === dep.sourceService);
          if (parentInc) {
            rootIncidentKey = parentInc.serviceName;
            break;
          }
        }
      }

      const existing = groupedMap.get(rootIncidentKey);
      if (!existing) {
        groupedMap.set(rootIncidentKey, {
          ...inc,
          relatedServices: Array.from(new Set([inc.serviceName])),
        });
      } else {
        existing.alertCount = (existing.alertCount || 1) + 1;
        const currentServices = existing.relatedServices || [existing.serviceName];
        if (!currentServices.includes(inc.serviceName)) {
          currentServices.push(inc.serviceName);
        }
        existing.relatedServices = currentServices;
        if (inc.severity === AlertSeverity.CRITICAL) {
          existing.severity = AlertSeverity.CRITICAL;
        }
        existing.description += ` | Correlated alert on ${inc.serviceName}`;
        groupedMap.set(rootIncidentKey, existing);
      }
    }

    return Array.from(groupedMap.values());
  }
}
