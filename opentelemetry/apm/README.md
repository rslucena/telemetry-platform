# Telemetry APM Agent — Pre-compiled Docker Image

Docker image encapsulating pre-compiled OpenTelemetry SDKs (Traces, Metrics, Logs, Continuous Profiling).

Client microservices **do not need to install any OTel dependencies** — they simply copy `/opt/apm` via `COPY --from` in their Dockerfile.

---

## How to use in a client microservice

```dockerfile
# 1. Import pre-compiled APM agent
FROM telemetry-apm-agent:latest AS apm-agent

# 2. Normal application build
FROM node:22-alpine
WORKDIR /usr/src

# Copy agent (< 1 second, zero compilation)
COPY --from=apm-agent /opt/apm /opt/apm

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000

# -r injects APM before application runs — zero TypeScript code modifications required
CMD ["node", "-r", "/opt/apm/dist/register.js", "dist/main"]
```

## Required environment variables in client docker-compose

```yaml
environment:
  - OTEL_SERVICE_KEY=srv-xxxx-xxxx-xxxx   # UUID registered in Settings UI
  - OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4000
```

> **Important:** The `OTEL_SERVICE_KEY` must be previously registered in the Telemetry Platform under **Settings > Services**. Requests from unregistered services are rejected with HTTP 401.

---

## Building the APM image

```bash
# In telemetry project root:
docker build -t telemetry-apm-agent:latest ./apm-image-build
```

## Signals collected automatically

| Signal | Mechanism | Platform View |
|:---|:---|:---|
| **Traces** | `OTLPTraceExporter` + auto-instrumentations (HTTP, NestJS, Express, DB) | `/traces` |
| **Metrics** | `OTLPMetricExporter` — export every 5s | `/metrics` |
| **Logs** | `OTLPLogExporter` — captures application loggers | `/logs` |
| **Profiling** | `process.cpuUsage()` + `v8.getHeapStatistics()` — every 15s | `/profiling` |

---

## Support for other languages/runtimes

| Runtime | Injection mechanism equivalent to `node -r` |
|:---|:---|
| **PHP** | `auto_prepend_file=/opt/apm/bootstrap.php` in `php.ini` |
| **Python** | `PYTHONSTARTUP=/opt/apm/startup.py` or `sitecustomize.py` |
| **Java** | `-javaagent:/opt/apm/opentelemetry-javaagent.jar` |
| **Go** | Directly compiled — compile-time instrumentation |
