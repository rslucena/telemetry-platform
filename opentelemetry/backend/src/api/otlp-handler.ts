import type { LogRecordData, MetricData, SpanData } from '@telemetry/types';
import { MetricType } from '@telemetry/types';
import { type ResourceAttributes, ServiceCatalogEngine } from '../catalog/service-catalog';
import type { Repositories } from '../repositories';
import { TopologyEngine } from '../topology/topology-engine';

type GenericRecord = Record<string, unknown>;

export async function handleOtlpTraces(req: Request, repos: Repositories): Promise<Response> {
  try {
    const body = (await req.json()) as GenericRecord;
    const spansToInsert: SpanData[] = [];
    const catalogEngine = new ServiceCatalogEngine(repos.metadata);

    const headerKey = req.headers.get('x-service-key') || '';
    const isValidKey = await validateServiceKey(headerKey, repos);
    if (!isValidKey) {
      console.warn(
        `[OTEL Authorization Failed] Service Key "${headerKey}" is not registered in Settings or is deactivated.`,
      );
      return Response.json(
        { error: 'Unauthorized: Service Key is invalid or not registered in Settings' },
        { status: 401 },
      );
    }

    const resourceSpans = body.resourceSpans as GenericRecord[] | undefined;
    if (resourceSpans && Array.isArray(resourceSpans)) {
      for (const rs of resourceSpans) {
        const resource = rs.resource as GenericRecord | undefined;
        const attributesArr = resource?.attributes as GenericRecord[] | undefined;
        const parsedResourceAttrs = parseAttributes(attributesArr);
        const serviceKey =
          headerKey ||
          (parsedResourceAttrs['service.name'] as string) ||
          (parsedResourceAttrs['service.key'] as string) ||
          'unknown-service';

        await catalogEngine.processTelemetryResource(
          serviceKey,
          parsedResourceAttrs as ResourceAttributes,
        );

        const scopeSpans = rs.scopeSpans as GenericRecord[] | undefined;
        if (scopeSpans && Array.isArray(scopeSpans)) {
          for (const ss of scopeSpans) {
            const spans = ss.spans as GenericRecord[] | undefined;
            if (spans && Array.isArray(spans)) {
              for (const s of spans) {
                const startTimeMs = Math.floor(
                  Number(s.startTimeUnixNano || Date.now() * 1e6) / 1e6,
                );
                const endTimeMs = Math.floor(Number(s.endTimeUnixNano || Date.now() * 1e6) / 1e6);
                const statusObj = s.status as GenericRecord | undefined;

                spansToInsert.push({
                  traceId: String(s.traceId),
                  spanId: String(s.spanId),
                  parentSpanId: s.parentSpanId ? String(s.parentSpanId) : undefined,
                  name: String(s.name || 'unnamed-span'),
                  kind: Number(s.kind || 1),
                  startTime: startTimeMs,
                  endTime: endTimeMs,
                  durationMs: Math.max(0, endTimeMs - startTimeMs),
                  statusCode: Number(statusObj?.code || 0),
                  statusMessage: statusObj?.message ? String(statusObj.message) : undefined,
                  serviceName: serviceKey,
                  attributes: parseAttributes(s.attributes as GenericRecord[]),
                  events: [],
                  links: [],
                });
              }
            }
          }
        }
      }
    }

    if (spansToInsert.length > 0) {
      await repos.traces.insertSpans(spansToInsert);
      const topologyEngine = new TopologyEngine(repos.metadata, repos.traces);
      await topologyEngine.processSpans(spansToInsert);
    }

    return Response.json({ partialSuccess: {} }, { status: 200 });
  } catch (error) {
    return Response.json({ error: 'Erro ao processar payload OTLP Traces' }, { status: 400 });
  }
}

export async function handleOtlpMetrics(req: Request, repos: Repositories): Promise<Response> {
  try {
    const body = (await req.json()) as GenericRecord;
    const metricsToInsert: MetricData[] = [];
    const catalogEngine = new ServiceCatalogEngine(repos.metadata);

    const headerKey = req.headers.get('x-service-key') || '';
    const isValidKey = await validateServiceKey(headerKey, repos);
    if (!isValidKey) {
      console.warn(
        `[OTEL Authorization Failed] Service Key "${headerKey}" is not registered in Settings or is deactivated.`,
      );
      return Response.json(
        { error: 'Unauthorized: Service Key is invalid or not registered in Settings' },
        { status: 401 },
      );
    }

    const resourceMetrics = body.resourceMetrics as GenericRecord[] | undefined;
    if (resourceMetrics && Array.isArray(resourceMetrics)) {
      for (const rm of resourceMetrics) {
        const resource = rm.resource as GenericRecord | undefined;
        const attributesArr = resource?.attributes as GenericRecord[] | undefined;
        const parsedResourceAttrs = parseAttributes(attributesArr);
        const serviceKey =
          headerKey ||
          (parsedResourceAttrs['service.name'] as string) ||
          (parsedResourceAttrs['service.key'] as string) ||
          'unknown-service';

        await catalogEngine.processTelemetryResource(
          serviceKey,
          parsedResourceAttrs as ResourceAttributes,
        );

        const scopeMetrics = rm.scopeMetrics as GenericRecord[] | undefined;
        if (scopeMetrics && Array.isArray(scopeMetrics)) {
          for (const sm of scopeMetrics) {
            const metrics = sm.metrics as GenericRecord[] | undefined;
            if (metrics && Array.isArray(metrics)) {
              for (const m of metrics) {
                const timestamp = Date.now();
                metricsToInsert.push({
                  id: `metric-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
                  name: String(m.name || 'unnamed_metric'),
                  description: m.description ? String(m.description) : undefined,
                  unit: m.unit ? String(m.unit) : undefined,
                  type: MetricType.COUNTER,
                  serviceName: serviceKey,
                  timestamp,
                  value: 1.0,
                  attributes: {},
                });
              }
            }
          }
        }
      }
    }

    if (metricsToInsert.length > 0) {
      await repos.metrics.insertMetrics(metricsToInsert);
    }

    return Response.json({ partialSuccess: {} }, { status: 200 });
  } catch (error) {
    return Response.json({ error: 'Erro ao processar payload OTLP Metrics' }, { status: 400 });
  }
}

export async function handleOtlpLogs(req: Request, repos: Repositories): Promise<Response> {
  try {
    const body = (await req.json()) as GenericRecord;
    const logsToInsert: LogRecordData[] = [];
    const catalogEngine = new ServiceCatalogEngine(repos.metadata);

    const headerKey = req.headers.get('x-service-key') || '';
    const isValidKey = await validateServiceKey(headerKey, repos);
    if (!isValidKey) {
      console.warn(
        `[OTEL Authorization Failed] Service Key "${headerKey}" is not registered in Settings or is deactivated.`,
      );
      return Response.json(
        { error: 'Unauthorized: Service Key is invalid or not registered in Settings' },
        { status: 401 },
      );
    }

    const resourceLogs = body.resourceLogs as GenericRecord[] | undefined;
    if (resourceLogs && Array.isArray(resourceLogs)) {
      for (const rl of resourceLogs) {
        const resource = rl.resource as GenericRecord | undefined;
        const attributesArr = resource?.attributes as GenericRecord[] | undefined;
        const parsedResourceAttrs = parseAttributes(attributesArr);
        const serviceKey =
          headerKey ||
          (parsedResourceAttrs['service.name'] as string) ||
          (parsedResourceAttrs['service.key'] as string) ||
          'unknown-service';

        await catalogEngine.processTelemetryResource(
          serviceKey,
          parsedResourceAttrs as ResourceAttributes,
        );

        const scopeLogs = rl.scopeLogs as GenericRecord[] | undefined;
        if (scopeLogs && Array.isArray(scopeLogs)) {
          for (const sl of scopeLogs) {
            const logRecords = sl.logRecords as GenericRecord[] | undefined;
            if (logRecords && Array.isArray(logRecords)) {
              for (const log of logRecords) {
                const timestamp = Math.floor(Number(log.timeUnixNano || Date.now() * 1e6) / 1e6);
                const bodyObj = log.body as GenericRecord | undefined;

                logsToInsert.push({
                  id: `log-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
                  timestamp,
                  observedTimestamp: timestamp,
                  traceId: log.traceId ? String(log.traceId) : undefined,
                  spanId: log.spanId ? String(log.spanId) : undefined,
                  severityNumber: Number(log.severityNumber || 9),
                  severityText: String(log.severityText || 'INFO'),
                  serviceName: serviceKey,
                  body: bodyObj?.stringValue
                    ? String(bodyObj.stringValue)
                    : JSON.stringify(log.body || ''),
                  attributes: parseAttributes(log.attributes as GenericRecord[]),
                });
              }
            }
          }
        }
      }
    }

    if (logsToInsert.length > 0) {
      await repos.logs.insertLogs(logsToInsert);
    }

    return Response.json({ partialSuccess: {} }, { status: 200 });
  } catch (error) {
    return Response.json({ error: 'Erro ao processar payload OTLP Logs' }, { status: 400 });
  }
}

function parseAttributes(attrsArr?: GenericRecord[]): Record<string, string | number | boolean> {
  if (!attrsArr || !Array.isArray(attrsArr)) return {};
  const res: Record<string, string | number | boolean> = {};

  for (const attr of attrsArr) {
    if (!attr || !attr.key) continue;
    const val = attr.value as GenericRecord | string | number | boolean | undefined;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      res[String(attr.key)] = val;
      continue;
    }
    if (val && typeof val === 'object') {
      if (val.stringValue !== undefined) res[String(attr.key)] = String(val.stringValue);
      else if (val.intValue !== undefined) res[String(attr.key)] = Number(val.intValue);
      else if (val.doubleValue !== undefined) res[String(attr.key)] = Number(val.doubleValue);
      else if (val.boolValue !== undefined) res[String(attr.key)] = Boolean(val.boolValue);
      else if (val.arrayValue !== undefined) res[String(attr.key)] = JSON.stringify(val.arrayValue);
    }
  }

  return res;
}

async function validateServiceKey(headerKey: string, repos: Repositories): Promise<boolean> {
  if (!headerKey) return true;
  try {
    const services = await repos.metadata.getServices();
    if (services.length === 0) return true;
    const matched = services.find(
      (s) => (s.id === headerKey || s.name === headerKey) && s.status !== 'deactivated',
    );
    return Boolean(matched);
  } catch {
    return true;
  }
}
