# APM Agent Integration

Learn how to connect your microservices to **Observability Pro** with zero application code changes using the pre-compiled APM Agent.

## 1. Register Service in Settings

1. Navigate to `http://localhost:3000/settings`.
2. Click **Register New Service**.
3. Enter your service name (e.g., `checkout-api`), environment, and GitHub repository URL.
4. Copy the generated **ID Service Key (UUID v4)** (e.g., `srv-c1234567-89ab-4cde-8f01-23456789abcd`).

---

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

---

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

---

## 4. Manual Node.js / Bun SDK Setup

If you prefer initializing OpenTelemetry programmatically in code:

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
