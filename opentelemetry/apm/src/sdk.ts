// sdk.ts — Inicializa o OpenTelemetry NodeSDK completo.
// Configurado 100% via variáveis de ambiente — sem Service Key hardcoded.
//
// Variáveis obrigatórias no docker-compose do microsserviço cliente:
//   OTEL_SERVICE_KEY               → chave UUID do serviço cadastrada na plataforma
//   OTEL_EXPORTER_OTLP_ENDPOINT    → URL base do backend de telemetria (ex: http://host.docker.internal:4000)

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { SeverityNumber, logs } from '@opentelemetry/api-logs';

const SERVICE_KEY = process.env.OTEL_SERVICE_KEY;
const BACKEND_URL = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (!SERVICE_KEY || !BACKEND_URL) {
  console.warn(
    '[APM Agent] ⚠️  OTEL_SERVICE_KEY ou OTEL_EXPORTER_OTLP_ENDPOINT não definidos. ' +
      'O agente APM está desativado para este container.',
  );
} else {
  const authHeaders = { 'x-service-key': SERVICE_KEY };

  const sdk = new NodeSDK({
    serviceName: SERVICE_KEY,

    // ── Traces ──────────────────────────────────────────────────────────────
    traceExporter: new OTLPTraceExporter({
      url: `${BACKEND_URL}/v1/traces`,
      headers: authHeaders,
    }),

    // ── Métricas (exportadas a cada 1s) ─────────────────────────────────────
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${BACKEND_URL}/v1/metrics`,
        headers: authHeaders,
      }),
      exportIntervalMillis: 1000,
    }),

    // ── Logs ─────────────────────────────────────────────────────────────
    logRecordProcessor: new SimpleLogRecordProcessor(
      new OTLPLogExporter({
        url: `${BACKEND_URL}/v1/logs`,
        headers: authHeaders,
      }),
    ),

    // ── Auto-instrumentações (HTTP, NestJS, Express, Fastify, gRPC, DB...) ─
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // desabilita FS noise
      }),
    ],
  });

  sdk.start();

  // ── Interceptor automático de console.log/error/warn para OTLP Logs ───────
  const otelLogger = logs.getLogger('apm-console-logger');

  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  const origInfo = console.info;

  function emitOtelLogRecord(
    severityNumber: SeverityNumber,
    severityText: string,
    args: unknown[],
  ) {
    try {
      const msg = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ');

      if (msg.includes('[APM Agent]')) return;

      otelLogger.emit({
        body: msg,
        severityNumber,
        severityText,
        timestamp: Date.now(),
      });
    } catch {
      // Ignorar erros na captura
    }
  }

  console.log = (...args: unknown[]) => {
    origLog.apply(console, args);
    emitOtelLogRecord(SeverityNumber.INFO, 'INFO', args);
  };

  console.error = (...args: unknown[]) => {
    origError.apply(console, args);
    emitOtelLogRecord(SeverityNumber.ERROR, 'ERROR', args);
  };

  console.warn = (...args: unknown[]) => {
    origWarn.apply(console, args);
    emitOtelLogRecord(SeverityNumber.WARN, 'WARN', args);
  };

  console.info = (...args: unknown[]) => {
    origInfo.apply(console, args);
    emitOtelLogRecord(SeverityNumber.INFO, 'INFO', args);
  };

  // Garante flush antes do processo encerrar
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('[APM Agent] 🔴 SDK encerrado com sucesso.'))
      .catch((err) => console.error('[APM Agent] Erro ao encerrar SDK:', err))
      .finally(() => process.exit(0));
  });

  console.log(
    `[APM Agent] 📡 OpenTelemetry APM ativo | Service Key: ${SERVICE_KEY} | Backend: ${BACKEND_URL}`,
  );
}
