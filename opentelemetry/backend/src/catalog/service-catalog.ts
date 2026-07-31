import type { ServiceNode } from '@telemetry/types';
import type { MetadataRepository } from '../repositories/interfaces';

export interface ResourceAttributes {
  'service.name'?: string;
  'service.namespace'?: string;
  'service.version'?: string;
  'service.instance.id'?: string;
  'cloud.provider'?: string;
  'cloud.region'?: string;
  'cloud.platform'?: string;
  'faas.name'?: string;
  'faas.version'?: string;
  'k8s.cluster.name'?: string;
  'k8s.namespace.name'?: string;
  deployment_environment?: string;
  [key: string]: string | number | boolean | undefined;
}

export class ServiceCatalogEngine {
  private servicesMap = new Map<string, ServiceNode>();

  constructor(private metadataRepo?: MetadataRepository) {}

  /**
   * Processa os atributos de recurso recebidos de telemetria (Traces, Metrics, Logs)
   */
  async processTelemetryResource(
    serviceName: string,
    attributes: ResourceAttributes = {},
    timestamp = Date.now(),
  ): Promise<ServiceNode> {
    const existing = this.servicesMap.get(serviceName);

    const providerRaw = String(attributes['cloud.provider'] || '').toLowerCase();
    let cloudProvider: ServiceNode['cloudProvider'] = 'local';
    if (providerRaw.includes('gcp') || providerRaw.includes('google')) cloudProvider = 'gcp';
    else if (providerRaw.includes('aws') || providerRaw.includes('amazon')) cloudProvider = 'aws';
    else if (providerRaw.includes('azure')) cloudProvider = 'azure';

    const platformRaw = String(
      attributes['cloud.platform'] || attributes['faas.name'] || '',
    ).toLowerCase();
    const isServerless =
      platformRaw.includes('cloud_run') ||
      platformRaw.includes('lambda') ||
      platformRaw.includes('faas') ||
      Boolean(attributes['faas.name']);

    const cloudRegion = (attributes['cloud.region'] as string) || 'us-central1';
    const cloudPlatform =
      (attributes['cloud.platform'] as string) || (isServerless ? 'serverless' : 'k8s');
    const version = (attributes['service.version'] as string) || existing?.version || 'v1.0.0';
    const namespace =
      (attributes['service.namespace'] as string) || (attributes['k8s.namespace.name'] as string);
    const environment =
      (attributes.deployment_environment as string) || existing?.environment || 'production';

    const firstSeenMs = existing?.firstSeenMs || timestamp;
    const lastSeenMs = timestamp;

    const node: ServiceNode = {
      id: existing?.id || `svc-${serviceName}`,
      name: serviceName,
      namespace,
      environment,
      version,
      status: existing?.status || 'healthy',
      cloudProvider,
      cloudRegion,
      cloudPlatform,
      isServerless,
      firstSeenMs,
      lastSeenMs,
      instanceCount: Math.max(1, (existing?.instanceCount || 0) + (existing ? 0 : 1)),
      lifecycleState: 'active',
      metricsSummary: existing?.metricsSummary || {
        rps: 0,
        errorRate: 0,
        p95LatencyMs: 0,
      },
    };

    if (this.metadataRepo) {
      const dbServices = await this.metadataRepo.getServices();
      const existingDb = dbServices.find((s) => s.id === serviceName || s.name === serviceName);
      if (!existingDb) {
        await this.metadataRepo.saveServiceNode(node);
        return node;
      }

      const updatedNode: ServiceNode = {
        ...existingDb,
        lastSeenMs: timestamp,
        cloudProvider: cloudProvider !== 'local' ? cloudProvider : existingDb.cloudProvider,
        cloudRegion: cloudRegion || existingDb.cloudRegion,
        cloudPlatform: cloudPlatform || existingDb.cloudPlatform,
        isServerless,
        lifecycleState: 'active',
      };
      await this.metadataRepo.saveServiceNode(updatedNode);
      return updatedNode;
    }

    return node;
  }

  /**
   * Atualiza e verifica o estado do ciclo de vida das cargas de trabalho (incluindo scaled-to-zero)
   */
  async updateLifecycleStates(now = Date.now(), idleThresholdMs = 300000): Promise<ServiceNode[]> {
    const servicesToEvaluate: ServiceNode[] = this.metadataRepo
      ? await this.metadataRepo.getServices()
      : Array.from(this.servicesMap.values());

    const updatedServices: ServiceNode[] = [];

    for (const node of servicesToEvaluate) {
      const idleTimeMs = now - (node.lastSeenMs || now);

      if (idleTimeMs > idleThresholdMs) {
        if (node.isServerless) {
          node.lifecycleState = 'scaled-to-zero';
          node.instanceCount = 0;
        } else {
          node.lifecycleState = 'inactive';
          node.status = 'degraded';
        }
      } else {
        node.lifecycleState = 'active';
      }

      this.servicesMap.set(node.name, node);
      if (this.metadataRepo) {
        await this.metadataRepo.saveServiceNode(node);
      }

      updatedServices.push(node);
    }

    return updatedServices;
  }

  getServices(): ServiceNode[] {
    return Array.from(this.servicesMap.values());
  }

  getService(serviceName: string): ServiceNode | undefined {
    return this.servicesMap.get(serviceName);
  }
}
