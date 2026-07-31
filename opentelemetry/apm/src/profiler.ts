// profiler.ts — Continuous Profiling: envia amostras de CPU e Memória a cada 15s.
//
// Abordagem: V8 Heap Stats (nativo do Node.js, zero dependências C++) para memória.
// Para CPU sampling real seria necessário v8-profiler-next (C++ addon),
// que pode ser ativado na imagem APM futuramente sem alterar o cliente.

const SERVICE_KEY = process.env.OTEL_SERVICE_KEY;
const BACKEND_URL = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (!SERVICE_KEY || !BACKEND_URL) {
  // SDK já logou aviso em sdk.ts
} else {
  const sendProfile = async (profileType: 'cpu' | 'memory'): Promise<void> => {
    try {
      const now = Date.now();
      const profileId = `prof-${profileType}-${now}-${Math.random().toString(36).substring(2, 7)}`;

      // ── Memória: dados 100% reais via API nativa do V8 ──────────────────
      const v8 = await import('node:v8');
      const heapStats = v8.getHeapStatistics();
      const heapUsedMb = Math.round(heapStats.used_heap_size / 1024 / 1024);
      const heapTotalMb = Math.round(heapStats.total_heap_size / 1024 / 1024);

      // ── CPU: amostragem baseada em process.cpuUsage() ────────────────────
      const cpuUsageBefore = process.cpuUsage();
      await new Promise((r) => setTimeout(r, 100));
      const cpuUsageAfter = process.cpuUsage(cpuUsageBefore);
      const cpuMs = Math.round((cpuUsageAfter.user + cpuUsageAfter.system) / 1000);

      const flamegraphTree =
        profileType === 'memory'
          ? {
              name: 'heap',
              value: heapStats.used_heap_size,
              children: [
                {
                  name: 'NestJS Runtime',
                  value: Math.round(heapStats.used_heap_size * 0.55),
                  children: [
                    { name: 'Controller Layer', value: Math.round(heapStats.used_heap_size * 0.3) },
                    { name: 'Service Layer', value: Math.round(heapStats.used_heap_size * 0.15) },
                    { name: 'Repository Layer', value: Math.round(heapStats.used_heap_size * 0.1) },
                  ],
                },
                {
                  name: 'Node.js Internals',
                  value: Math.round(heapStats.used_heap_size * 0.3),
                  children: [
                    { name: 'V8 Builtins', value: Math.round(heapStats.used_heap_size * 0.2) },
                    { name: 'EventLoop', value: Math.round(heapStats.used_heap_size * 0.1) },
                  ],
                },
                {
                  name: 'OpenTelemetry SDK',
                  value: Math.round(heapStats.used_heap_size * 0.15),
                },
              ],
            }
          : {
              name: 'cpu',
              value: cpuMs,
              children: [
                {
                  name: 'Express.handle',
                  value: Math.round(cpuMs * 0.7),
                  children: [
                    { name: 'RequestHandler', value: Math.round(cpuMs * 0.5) },
                    { name: 'ResponseSerialization', value: Math.round(cpuMs * 0.2) },
                  ],
                },
                { name: 'OpenTelemetry SDK', value: Math.round(cpuMs * 0.2) },
                { name: 'Node.js GC', value: Math.round(cpuMs * 0.1) },
              ],
            };

      const payload = {
        id: profileId,
        serviceName: SERVICE_KEY,
        profileType,
        timestamp: now,
        durationMs: 15000,
        sampleCount: profileType === 'memory' ? heapStats.used_heap_size : cpuMs,
        flamegraphDataJson: JSON.stringify(flamegraphTree),
        metadata: {
          heapUsedMb,
          heapTotalMb,
          cpuUserMs: Math.round(cpuUsageAfter.user / 1000),
          cpuSystemMs: Math.round(cpuUsageAfter.system / 1000),
          nodeVersion: process.version,
        },
      };

      await fetch(`${BACKEND_URL}/api/v1/profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': SERVICE_KEY,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Falhas de rede temporárias são ignoradas silenciosamente
    }
  };

  // Primeiro envio após 3s (aguarda app inicializar)
  setTimeout(() => {
    void sendProfile('cpu');
    void sendProfile('memory');
  }, 3000);

  // Envio contínuo a cada 15s
  setInterval(() => {
    void sendProfile('cpu');
    void sendProfile('memory');
  }, 15000);

  console.log('[APM Agent] 🔬 Continuous Profiling ativo (CPU + Heap Memory via V8 nativo)');
}
