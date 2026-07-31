# APM Agent Integration

Learn how to connect your microservices to **Observability Pro** with zero application code changes using the pre-compiled APM Agent.

## 1. Register Service in Settings

1. Navigate to `http://localhost:3000/settings`.
2. Click **Register New Service**.
3. Enter your service name (e.g., `checkout-api`), environment, and GitHub repository URL.
4. Copy the generated **ID Service Key (UUID v4)** (e.g., `srv-c1234567-89ab-4cde-8f01-23456789abcd`).

## 2. Zero-Code Integration via Dockerfile

Client microservices do not need to install any OpenTelemetry SDK packages directly in `package.json`. You can inject the pre-compiled APM agent during image build:

```dockerfile
# 1. Import pre-compiled APM agent image
FROM telemetry-apm-agent:latest AS apm-agent

# 2. Application build stage
FROM node:22-alpine
WORKDIR /usr/src

# Copy pre-compiled APM runtime (< 1 second)
COPY --from=apm-agent /opt/apm /opt/apm

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000

# -r injects APM agent prior to entry point execution
CMD ["node", "-r", "/opt/apm/dist/register.js", "dist/main"]
```

## 3. Environment Variable Configuration

Pass the Service Key and Backend Endpoint to your service via environment variables in `docker-compose.yml`:

```yaml
services:
  checkout-api:
    image: company/checkout-api:latest
    environment:
      - OTEL_SERVICE_KEY=srv-c1234567-89ab-4cde-8f01-23456789abcd
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4000
    ports:
      - "3001:3001"
```

## 4. Multi-Language Quickstart Cheat Sheet

Connect microservices in any programming language by configuring standard OpenTelemetry environment variables:

### 🐍 Python (Zero-Code)
```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
opentelemetry-bootstrap -a install

export OTEL_SERVICE_NAME="python-payment-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4000"
export OTEL_EXPORTER_OTLP_HEADERS="x-service-key=srv-xxxx-xxxx-xxxx"

opentelemetry-instrument python app.py
```

### ☕ Java (Zero-Code)
```bash
export OTEL_SERVICE_NAME="java-billing-service"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4000"
export OTEL_EXPORTER_OTLP_HEADERS="x-service-key=srv-xxxx-xxxx-xxxx"

java -javaagent:opentelemetry-javaagent.jar -jar target/app.jar
```

### 🐹 Go (Compile-Time SDK)
```go
import (
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
)

exporter, _ := otlptracehttp.New(ctx,
    otlptracehttp.WithEndpoint("localhost:4000"),
    otlptracehttp.WithHeaders(map[string]string{
        "x-service-key": "srv-xxxx-xxxx-xxxx",
    }),
)
```

### 🐘 PHP (Auto-Prepend)
In `php.ini`:
```ini
auto_prepend_file=/opt/apm/bootstrap.php
```

## 5. Programmatic Node.js / Bun SDK Setup

If you prefer initializing OpenTelemetry programmatically in TypeScript:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_KEY,
  traceExporter: new OTLPTraceExporter({
    url: 'http://telemetry-backend:4000/v1/traces',
    headers: {
      'x-service-key': process.env.OTEL_SERVICE_KEY,
    },
  }),
});

sdk.start();
```
