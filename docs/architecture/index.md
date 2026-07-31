---
title: System Architecture & Design
description: In-depth technical architecture, interactive VueFlow component graphs, data pipelines, and storage layer design of Observability Pro
---

# System Architecture & Design

**Observability Pro** is engineered as a high-throughput, low-footprint distributed observability platform. The system uses a modern Bun workspace monorepo architecture, enforcing strict boundary separation between **OTLP Telemetry Ingestion**, **Analytical Correlation Engines**, **Embedded Storage**, and the **Next.js 15 App Router Frontend**.

<script setup>
import { MarkerType } from '@vue-flow/core'

const styleBlue = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-1)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }
const styleCyan = { type: 'smoothstep', style: { stroke: '#38bdf8', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }
const stylePurple = { type: 'smoothstep', style: { stroke: '#c084fc', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }

// 1. Overall System Topology Nodes & Edges
const systemNodes = [
  { id: 'gcpRun', label: 'GCP Cloud Run (OTel SDK)', position: { x: 40, y: 30 } },
  { id: 'awsEcs', label: 'AWS ECS Cluster (OTel SDK)', position: { x: 40, y: 130 } },
  { id: 'ec2OnPrem', label: 'EC2 / Bare Metal APM Agent', position: { x: 40, y: 230 } },
  { id: 'collector', label: 'OTel Collector (4317 gRPC / 4318 HTTP)', position: { x: 300, y: 80 } },
  { id: 'bunServer', label: 'Bun API Server & Ingestion (Port 4000)', position: { x: 300, y: 210 } },
  { id: 'sqlite', label: 'Embedded bun:sqlite (WAL Mode)', position: { x: 600, y: 40 } },
  { id: 'rcaEngine', label: 'Root Cause & Correlation Engine', position: { x: 600, y: 140 } },
  { id: 'sloEngine', label: 'SLO & Error Budget Evaluator', position: { x: 600, y: 240 } },
  { id: 'nextUI', label: 'Next.js 15 UI Dashboard (Port 3000)', position: { x: 880, y: 140 } }
]

const systemEdges = [
  { id: 'se1', source: 'gcpRun', target: 'collector', label: 'OTLP gRPC', ...styleBlue },
  { id: 'se2', source: 'awsEcs', target: 'collector', label: 'OTLP HTTP', ...styleBlue },
  { id: 'se3', source: 'ec2OnPrem', target: 'bunServer', label: 'Direct OTLP', ...styleCyan },
  { id: 'se4', source: 'collector', target: 'bunServer', label: 'Batch OTLP JSON', ...styleBlue },
  { id: 'se5', source: 'bunServer', target: 'sqlite', label: 'Sub-ms Writes', ...styleCyan },
  { id: 'se6', source: 'bunServer', target: 'rcaEngine', label: 'Heuristic Stream', ...stylePurple },
  { id: 'se7', source: 'bunServer', target: 'sloEngine', label: 'Window Evaluation', ...styleBlue },
  { id: 'se8', source: 'nextUI', target: 'bunServer', label: 'REST / SSE Queries', ...styleCyan }
]

// 2. Monorepo Layer Component Nodes & Edges
const layerNodes = [
  { id: 'packagesTypes', label: '@telemetry/types (Shared Schemas & DTOs)', position: { x: 50, y: 40 } },
  { id: 'backendApi', label: 'opentelemetry/backend (Bun API & OTLP Webhooks)', position: { x: 400, y: 40 } },
  { id: 'sqliteDriver', label: 'SQLite Repositories (bun:sqlite Driver)', position: { x: 400, y: 160 } },
  { id: 'rcaCore', label: 'Correlation Engine (RCA & Alerting)', position: { x: 400, y: 270 } },
  { id: 'frontendUi', label: 'opentelemetry/frontend (Next.js 15 App Router)', position: { x: 780, y: 40 } },
  { id: 'apmAgent', label: 'telemetry-apm-agent (Docker Zero-Code Image)', position: { x: 780, y: 160 } }
]

const layerEdges = [
  { id: 'le1', source: 'packagesTypes', target: 'backendApi', label: 'Type Import', ...styleBlue },
  { id: 'le2', source: 'packagesTypes', target: 'frontendUi', label: 'Type Import', ...styleCyan },
  { id: 'le3', source: 'backendApi', target: 'sqliteDriver', label: 'Data Access', ...styleBlue },
  { id: 'le4', source: 'backendApi', target: 'rcaCore', label: 'Event Stream', ...stylePurple },
  { id: 'le5', source: 'frontendUi', target: 'backendApi', label: 'Fetch / React Query', ...styleCyan },
  { id: 'le6', source: 'apmAgent', target: 'backendApi', label: 'OTEL Export', ...styleBlue }
]
</script>

## System Architecture Diagram

The interactive diagram below illustrates the end-to-end data topology from multi-cloud microservices to the analytical engines and Next.js frontend UI:

<InteractiveFlow :nodes="systemNodes" :edges="systemEdges" height="380px" />

---

## Architectural Principles

### 1. Zero-Vendor Lock-In (Standard OTLP Protocols)
All telemetry signals (Traces, Metrics, Logs, and Profiles) adhere strictly to the **OpenTelemetry (OTLP v1.0)** specification. Any standard OpenTelemetry SDK or Collector container can stream data directly into the backend without requiring proprietary SDK wrappers.

### 2. High-Throughput Ingestion Pipeline
The ingestion layer is powered by **Bun**, exploiting native asynchronous I/O primitives. OTLP HTTP webhooks handle incoming JSON batch payloads concurrently, delegating trace extraction and dependency calculation without blocking the main event loop.

### 3. Embedded Low-Latency Storage (`bun:sqlite`)
Instead of requiring heavy external database clusters for local development and edge deployments, Observability Pro embeds **`bun:sqlite`**. The database engine is configured with:
- **Write-Ahead Logging (WAL)** mode for concurrent readers and single writer.
- **Synchronous = NORMAL** for high IOPS throughput.
- **Memory Temp Store & Pre-indexed queries** for sub-millisecond trace span lookups.

---

## Layered Monorepo Component Flow

<InteractiveFlow :nodes="layerNodes" :edges="layerEdges" height="360px" />

---

## Monorepo Component Matrix

| Package / Directory | Technology | Responsibility |
| :--- | :--- | :--- |
| **`opentelemetry/backend`** | Bun 1.1+, TypeScript | REST API endpoints, OTLP webhook receivers (`/v1/traces`, `/v1/metrics`, `/v1/logs`), Service Key validation, and Root Cause Analysis. |
| **`opentelemetry/frontend`** | Next.js 15, React 19, Recharts | Interactive UI dashboard, Service Catalog, SVG Topology Map, Traces Waterfall, SLO Error Budget trackers, and Settings. |
| **`packages/types`** | TypeScript DTOs | Shared protocol interfaces (`ServiceNode`, `SpanData`, `LogRecordData`, `RCAReport`, `SLODefinition`). |
| **`opentelemetry/apm`** | Node.js, OTel SDK | Pre-compiled zero-code Docker APM wrapper (`/opt/apm/dist/register.js`) for client microservices. |
| **`infrastructure`** | Docker Compose, OTel Collector | Configuration manifests for OpenTelemetry Collector (`otel-collector-config.yaml`) and mock microservices. |

---

## Data Lifecycle & Ingestion Sequence

```text
[ Client Application / Microservice ]
               │
               ▼  1. Generates Spans, Logs & Metrics (OTLP)
[ OpenTelemetry Collector / Direct OTLP ]
               │
               ▼  2. HTTP POST /v1/traces (Header: x-service-key)
[ Bun Ingestion Router ] ─── 3. Validate Service Key UUID
               │
               ├──► 4. Extract Resource Attributes (cloud.provider, service.name)
               ├──► 5. Upsert Service Node in Catalog
               ├──► 6. Batch Insert Spans into `bun:sqlite` DB
               ├──► 7. Compute Dependency Graph Edge (Source -> Target)
               └──► 8. Stream Spans to Root Cause & SLO Evaluator Engines
```

---

## Monorepo Directory Tree

```text
telemetry-platform/
├── opentelemetry/
│   ├── backend/                # Bun REST API & OTLP Ingestion Webhooks
│   │   ├── src/
│   │   │   ├── api/            # HTTP Routers & OTLP Handlers
│   │   │   ├── catalog/        # Service Catalog & Metadata Engine
│   │   │   ├── rca/            # Root Cause Analysis Heuristic Engine
│   │   │   ├── reliability/    # SLO & Error Budget Alert Engine
│   │   │   ├── repositories/   # SQLite Repositories & WAL Storage
│   │   │   └── topology/       # Dependency Graph Computation
│   │   └── test/               # Backend Unit & Integration Tests
│   ├── frontend/               # Next.js 15 App Router Dashboard UI
│   │   └── src/
│   │       ├── app/            # App Router Pages (/services, /topology, /traces, /root-cause, etc.)
│   │       ├── components/     # UI Components, Header, Sidebar, Command Palette
│   │       └── context/        # React TelemetryContext Provider
│   └── apm/                    # Pre-compiled Docker APM Agent
├── packages/
│   └── types/                  # Shared TypeScript schemas (@telemetry/types)
├── infrastructure/             # OTel Collector docker manifests
├── docs/                       # VitePress Documentation Site + VueFlow
├── .github/workflows/          # GitHub Actions CI/CD & GitHub Pages Deploy
├── docker-compose.yml          # Container composition for local development
├── biome.json                  # Global Linter & Formatter configuration
└── package.json                # Bun workspace root configuration
```
