---
title: Frequently Asked Questions (FAQ)
description: Common questions about database performance, data reset, security, and integration
---

# Frequently Asked Questions (FAQ)

Answers to common technical and operational questions about **Observability Pro**.

### 1. Is `bun:sqlite` performant enough for production telemetry?
**Yes.** `bun:sqlite` is compiled natively in C with SQLite Write-Ahead Logging (WAL) mode enabled by default. WAL mode permits high-frequency concurrent reads while handling non-blocking writes. It handles tens of thousands of telemetry span writes per second with sub-millisecond query latencies on modern SSDs.

### 2. How do I reset or clear test telemetry data?
You can clear all stored database tables (services, spans, metrics, logs, profiles, SLOs, and RCA reports) in two ways:

#### Option A: Via API Endpoint
Send an HTTP POST request to the reset endpoint:
```bash
curl -X POST http://localhost:4000/api/v1/reset
```

#### Option B: Deleting SQLite Files
Stop the backend process and delete the local database files:
```bash
rm -f telemetry.sqlite*
```
*(The backend automatically recreates clean tables upon next startup).*

### 3. Do I need to modify my microservice source code to send data?
**No.** Using the pre-compiled **APM Agent** (`telemetry-apm-agent:latest`), Node.js microservices automatically capture HTTP requests, database queries, exceptions, and system metrics using runtime flags (`node -r /opt/apm/dist/register.js`). Zero application code modifications are required.

### 4. How does Service Key authorization work?
Every incoming OTLP payload requires a valid **Service Key (UUID v4)** passed via the `x-service-key` HTTP header. Service Keys are registered in the UI under **Settings > Services**. Requests with unregistered or deactivated keys are rejected with HTTP 401 Unauthorized.

### 5. Can I run Observability Pro behind a Reverse Proxy / HTTPS?
**Yes.** You can place standard reverse proxies like Nginx, Caddy, or Traefik in front of the Bun backend (`:4000`) and Next.js frontend (`:3000`) to enforce SSL/TLS encryption.

### 6. Where are raw database files stored?
By default, the SQLite database is created in the repository root as `./telemetry.sqlite`. You can customize the storage location using environment variables:
```bash
DB_PATH=/var/lib/telemetry/production.sqlite STORAGE_DRIVER=sqlite bun run start
```
