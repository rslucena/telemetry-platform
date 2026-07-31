import type { SLOConfig } from '@telemetry/types';
import { CorrelationEngine } from '../correlation/correlation-engine';
import { FlamegraphDiffEngine, ProfilingEngine } from '../profiling/profiling-engine';
import { RootCauseEngine } from '../rca/root-cause-engine';
import { AlertEngine, IncidentEngine } from '../reliability/alert-incident-engine';
import { SloEngine } from '../reliability/slo-engine';
import type { ProfileRecord, Repositories } from '../repositories';
import { handleOtlpLogs, handleOtlpMetrics, handleOtlpTraces } from './otlp-handler';

export async function handleRequest(req: Request, repos: Repositories): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // Tratamento de requisições CORS Preflight (OPTIONS)
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    // 1. Health & Readiness & Reset
    if (pathname === '/api/v1/health' || pathname === '/api/v1/ready') {
      return jsonResponse({ status: 'ok', timestamp: Date.now(), service: 'telemetry-backend' });
    }

    if (method === 'POST' && pathname === '/api/v1/reset') {
      await repos.metadata.purgeAllData();
      return jsonResponse({ message: 'Database reset successfully. All tables purged.' });
    }

    // 2. OTLP Ingestion Webhooks
    if (method === 'POST' && pathname === '/v1/traces') {
      const res = await handleOtlpTraces(req, repos);
      return withCors(res);
    }
    if (method === 'POST' && pathname === '/v1/metrics') {
      const res = await handleOtlpMetrics(req, repos);
      return withCors(res);
    }
    if (method === 'POST' && pathname === '/v1/logs') {
      const res = await handleOtlpLogs(req, repos);
      return withCors(res);
    }

    // 3. Overview Endpoint
    if (pathname === '/api/v1/overview') {
      const services = await repos.metadata.getServices();
      const slos = await repos.metadata.getSLOs();
      const rcaReports = await repos.metadata.getRCAReports(5);
      const recentTraces = await repos.traces.findTraces({ limit: 10 });
      const recentLogs = await repos.logs.searchLogs({ limit: 10 });

      return jsonResponse({
        healthScore: 98.5,
        totalServices: services.length,
        activeAlerts: rcaReports.length,
        slosBreached: slos.filter((s) => s.targetPercentage < 99.0).length,
        recentTracesCount: recentTraces.length,
        recentLogsCount: recentLogs.length,
        timestamp: Date.now(),
      });
    }

    // 4. Services Endpoints
    if (pathname === '/api/v1/services') {
      const services = await repos.metadata.getServices();
      return jsonResponse({ data: services });
    }
    if (pathname.startsWith('/api/v1/services/')) {
      const serviceName = decodeURIComponent(pathname.substring('/api/v1/services/'.length));
      const services = await repos.metadata.getServices();
      const service = services.find((s) => s.name === serviceName);
      if (!service) {
        return jsonResponse({ error: 'Service not found' }, 404);
      }
      const traces = await repos.traces.findTraces({ serviceName, limit: 20 });
      const logs = await repos.logs.searchLogs({ serviceName, limit: 20 });
      return jsonResponse({ service, traces, logs });
    }

    // 5. Topology Endpoint
    if (pathname === '/api/v1/topology') {
      let topology = await repos.metadata.getServiceTopology();
      let services = await repos.metadata.getServices();

      const crossCloudOnly = url.searchParams.get('crossCloudOnly') === 'true';
      const cloudProvider = url.searchParams.get('cloudProvider');

      if (crossCloudOnly) {
        topology = topology.filter((edge) => edge.isCrossCloud);
      }
      if (cloudProvider) {
        services = services.filter((s) => s.cloudProvider === cloudProvider);
      }

      return jsonResponse({ nodes: services, edges: topology, count: topology.length });
    }

    // 6. Traces Endpoints
    if (pathname === '/api/v1/traces') {
      const serviceName = url.searchParams.get('serviceName') || undefined;
      const minDurationMs = url.searchParams.get('minDurationMs')
        ? Number(url.searchParams.get('minDurationMs'))
        : undefined;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50;

      const traces = await repos.traces.findTraces({ serviceName, minDurationMs, limit });
      return jsonResponse({ data: traces, count: traces.length });
    }
    if (pathname.startsWith('/api/v1/traces/')) {
      const traceId = pathname.substring('/api/v1/traces/'.length);
      const spans = await repos.traces.getTraceById(traceId);
      if (spans.length === 0) {
        return jsonResponse({ error: 'Trace not found' }, 404);
      }
      return jsonResponse({ traceId, spans, spanCount: spans.length });
    }

    // 7. Logs & Metrics Endpoints
    if (pathname === '/api/v1/logs') {
      const serviceName = url.searchParams.get('serviceName') || undefined;
      const traceId = url.searchParams.get('traceId') || undefined;
      const query = url.searchParams.get('query') || undefined;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50;

      const logs = await repos.logs.searchLogs({ serviceName, traceId, query, limit });
      return jsonResponse({ data: logs, count: logs.length });
    }

    if (pathname === '/api/v1/metrics') {
      const name = url.searchParams.get('name') || undefined;
      const serviceName = url.searchParams.get('serviceName') || undefined;
      const startTimeMs = url.searchParams.get('startTimeMs')
        ? Number(url.searchParams.get('startTimeMs'))
        : undefined;
      const endTimeMs = url.searchParams.get('endTimeMs')
        ? Number(url.searchParams.get('endTimeMs'))
        : undefined;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 200;

      const metrics = await repos.metrics.queryMetrics({
        name,
        serviceName,
        startTimeMs,
        endTimeMs,
        limit,
      });
      return jsonResponse({ data: metrics, count: metrics.length });
    }

    // 8. Profiles & Flamegraph Endpoints
    if (method === 'POST' && pathname === '/api/v1/profiles') {
      const body = (await req.json()) as ProfileRecord;
      const profilingEngine = new ProfilingEngine(repos);
      await profilingEngine.ingestProfile(body);
      return jsonResponse({ status: 'ok', id: body.id });
    }

    if (method === 'GET' && pathname === '/api/v1/profiles/diff') {
      const profileAId = url.searchParams.get('profileA');
      const profileBId = url.searchParams.get('profileB');

      if (!profileAId || !profileBId) {
        return jsonResponse({ error: 'Parameters profileA and profileB are required' }, 400);
      }

      const profilingEngine = new ProfilingEngine(repos);
      const profA = await repos.profiles.getFlamegraph(profileAId);
      const profB = await repos.profiles.getFlamegraph(profileBId);

      if (!profA || !profB) {
        return jsonResponse({ error: 'One or both profiles were not found' }, 404);
      }

      const treeA = await profilingEngine.getFlamegraphTree(profileAId);
      const treeB = await profilingEngine.getFlamegraphTree(profileBId);

      if (!treeA || !treeB) {
        return jsonResponse({ error: 'Error parsing flamegraph trees' }, 400);
      }

      const diffEngine = new FlamegraphDiffEngine();
      const diff = diffEngine.compareProfiles(profA, profB, treeA, treeB);
      return jsonResponse(diff);
    }

    if (pathname === '/api/v1/profiles') {
      const serviceName = url.searchParams.get('serviceName') || undefined;
      const profileType = url.searchParams.get('profileType') || undefined;
      const profiles = await repos.profiles.getProfiles(serviceName, profileType);
      return jsonResponse({ data: profiles });
    }

    if (pathname.startsWith('/api/v1/profiles/')) {
      const rest = pathname.substring('/api/v1/profiles/'.length);
      const profilingEngine = new ProfilingEngine(repos);

      if (rest.endsWith('/flamegraph')) {
        const profileId = rest.substring(0, rest.length - '/flamegraph'.length);
        const tree = await profilingEngine.getFlamegraphTree(profileId);
        if (!tree) return jsonResponse({ error: 'Flamegraph not found' }, 404);
        return jsonResponse(tree);
      }

      const profile = await repos.profiles.getFlamegraph(rest);
      if (!profile) {
        return jsonResponse({ error: 'Profile not found' }, 404);
      }
      return jsonResponse(profile);
    }

    // 9. SLOs, Alerts & Incidents Endpoints
    if (pathname === '/api/v1/slos') {
      if (method === 'POST') {
        const body = (await req.json()) as SLOConfig;
        await repos.metadata.saveSLO(body);
        return jsonResponse({ status: 'ok', slo: body });
      }
      const sloEngine = new SloEngine(repos);
      const statuses = await sloEngine.evaluateAllSLOs();
      return jsonResponse({ data: statuses, count: statuses.length });
    }

    if (pathname === '/api/v1/alerts' || pathname === '/api/v1/incidents') {
      const sloEngine = new SloEngine(repos);
      const alertEngine = new AlertEngine(repos);
      const incidentEngine = new IncidentEngine(repos);

      const sloStatuses = await sloEngine.evaluateAllSLOs();
      const rawIncidents = await alertEngine.evaluateSLOAlerts(sloStatuses);
      const dependencies = await repos.metadata.getServiceTopology();
      const groupedIncidents = incidentEngine.groupIncidentsByTopology(rawIncidents, dependencies);

      return jsonResponse({ data: groupedIncidents, count: groupedIncidents.length });
    }

    // 10. Root Cause Analysis Endpoint
    if (pathname.startsWith('/api/v1/root-cause/')) {
      const incidentId = pathname.substring('/api/v1/root-cause/'.length);
      const rcaReports = await repos.metadata.getRCAReports();
      let report = rcaReports.find((r) => r.incidentId === incidentId);

      if (!report) {
        const sloEngine = new SloEngine(repos);
        const alertEngine = new AlertEngine(repos);
        const incidentEngine = new IncidentEngine(repos);

        const sloStatuses = await sloEngine.evaluateAllSLOs();
        const rawIncidents = await alertEngine.evaluateSLOAlerts(sloStatuses);
        const dependencies = await repos.metadata.getServiceTopology();
        const groupedIncidents = incidentEngine.groupIncidentsByTopology(
          rawIncidents,
          dependencies,
        );

        let targetIncident = groupedIncidents.find((i) => i.id === incidentId);
        if (!targetIncident) {
          const slos = await repos.metadata.getSLOs();
          const services = await repos.metadata.getServices();
          const matchedSlo = slos.find(
            (s) => incidentId.includes(s.id) || incidentId.includes(s.serviceName),
          );
          const matchedSvc = services.find(
            (s) => incidentId.includes(s.id) || incidentId.includes(s.name),
          );
          const resolvedServiceName =
            matchedSlo?.serviceName || matchedSvc?.name || services[0]?.name || 'checkout-api';

          targetIncident = {
            id: incidentId,
            title: matchedSlo
              ? `Reliability Incident on SLO ${matchedSlo.name}`
              : `Performance Incident on ${resolvedServiceName}`,
            serviceName: resolvedServiceName,
            severity: 'CRITICAL' as const,
            status: 'open' as const,
            createdAt: Date.now() - 300000,
            description: 'Dynamic root cause analysis generated by RCA engine',
          };
        }

        const rcaEngine = new RootCauseEngine(repos);
        report = await rcaEngine.analyzeIncident(targetIncident);
      }

      return jsonResponse(report);
    }

    // 11. Cross-Signal Correlation Endpoints
    if (pathname.startsWith('/api/v1/correlation/')) {
      const correlationEngine = new CorrelationEngine(repos);

      if (pathname.startsWith('/api/v1/correlation/trace/') && pathname.endsWith('/logs')) {
        const traceId = pathname.substring(
          '/api/v1/correlation/trace/'.length,
          pathname.length - '/logs'.length,
        );
        const logs = await correlationEngine.getLogsForTrace(traceId);
        return jsonResponse({ traceId, logs, count: logs.length });
      }

      if (pathname.startsWith('/api/v1/correlation/log/') && pathname.endsWith('/trace')) {
        const logId = pathname.substring(
          '/api/v1/correlation/log/'.length,
          pathname.length - '/trace'.length,
        );
        const result = await correlationEngine.getTraceForLog(logId);
        if (!result) {
          return jsonResponse({ error: 'Trace associated with log not found' }, 404);
        }
        return jsonResponse(result);
      }

      if (pathname.startsWith('/api/v1/correlation/exemplars/')) {
        const metricName = pathname.substring('/api/v1/correlation/exemplars/'.length);
        const exemplars = await correlationEngine.getExemplarsForMetric(metricName);
        return jsonResponse({ metricName, exemplars, count: exemplars.length });
      }

      if (pathname.startsWith('/api/v1/correlation/context/')) {
        const traceId = pathname.substring('/api/v1/correlation/context/'.length);
        const context = await correlationEngine.getCorrelatedContext(traceId);
        return jsonResponse(context);
      }
    }

    // 12. Settings & Service Key Management Endpoints

    if (pathname === '/api/v1/settings/services') {
      if (method === 'GET') {
        const services = await repos.metadata.getServices();
        return jsonResponse({ data: services });
      }

      if (method === 'POST') {
        const body = (await req.json()) as {
          name?: string;
          githubUrl?: string;
          environment?: string;
        };
        const newUuid = `srv-${crypto.randomUUID()}`;
        const newService = {
          id: newUuid,
          name: body.name || 'new-service',
          githubUrl: body.githubUrl || 'https://github.com/company/new-service',
          environment: body.environment || 'production',
          version: 'v1.0.0',
          status: 'active',
          instanceCount: 1,
          lifecycleState: 'active',
          firstSeenMs: Date.now(),
          lastSeenMs: Date.now(),
        };
        await repos.metadata.saveServiceNode(newService);
        return jsonResponse({ data: newService, message: 'Service registered successfully' }, 201);
      }
    }

    if (pathname.startsWith('/api/v1/settings/services/') && pathname.endsWith('/rotate')) {
      if (method === 'POST') {
        const oldId = decodeURIComponent(
          pathname.substring(
            '/api/v1/settings/services/'.length,
            pathname.length - '/rotate'.length,
          ),
        );
        const services = await repos.metadata.getServices();
        const existing = services.find((s) => s.id === oldId || s.name === oldId);
        if (!existing) {
          return jsonResponse({ error: 'Service not found' }, 404);
        }
        const newUuid = `srv-${crypto.randomUUID()}`;
        const updated = {
          ...existing,
          id: newUuid,
          lastSeenMs: Date.now(),
        };
        await repos.metadata.saveServiceNode(updated);
        return jsonResponse({
          data: updated,
          previousKey: oldId,
          message: 'Key rotated successfully',
        });
      }
    }

    if (pathname.startsWith('/api/v1/settings/services/') && pathname.endsWith('/toggle-status')) {
      if (method === 'POST') {
        const serviceId = decodeURIComponent(
          pathname.substring(
            '/api/v1/settings/services/'.length,
            pathname.length - '/toggle-status'.length,
          ),
        );
        const services = await repos.metadata.getServices();
        const existing = services.find((s) => s.id === serviceId || s.name === serviceId);
        if (!existing) {
          return jsonResponse({ error: 'Service not found' }, 404);
        }
        const newStatus = existing.status === 'active' ? 'deactivated' : 'active';
        const updated = {
          ...existing,
          status: newStatus,
          lifecycleState: newStatus,
        };
        await repos.metadata.saveServiceNode(updated);
        return jsonResponse({
          data: updated,
          message: `Service status updated to ${newStatus}`,
        });
      }
    }

    if (
      pathname.startsWith('/api/v1/settings/services/') &&
      !pathname.endsWith('/rotate') &&
      !pathname.endsWith('/toggle-status')
    ) {
      if (method === 'PUT' || method === 'POST') {
        const serviceId = decodeURIComponent(
          pathname.substring('/api/v1/settings/services/'.length),
        );
        const body = (await req.json()) as {
          name?: string;
          githubUrl?: string;
          environment?: string;
        };

        const services = await repos.metadata.getServices();
        const existing = services.find((s) => s.id === serviceId || s.name === serviceId);
        if (!existing) {
          return jsonResponse({ error: 'Service not found' }, 404);
        }

        const updated = {
          ...existing,
          name: body.name || existing.name,
          githubUrl: body.githubUrl !== undefined ? body.githubUrl : existing.githubUrl,
          environment: body.environment || existing.environment,
          lastSeenMs: Date.now(),
        };

        await repos.metadata.saveServiceNode(updated);
        return jsonResponse({
          data: updated,
          message: 'Service updated successfully',
        });
      }
    }

    return jsonResponse({ error: 'Route not found' }, 404);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: 'Internal server error', details: message }, 500);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, W3C-TraceParent, W3C-TraceState, traceparent, tracestate, x-service-key, x-telemetry-key',
  };
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
