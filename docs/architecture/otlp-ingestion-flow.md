---
title: OTLP Ingestion Pipelines
description: OTLP ingestion pipeline sequence and validation flow
---

# OTLP Ingestion Pipelines

This document details how OpenTelemetry Traces, Metrics, and Logs are received, authorized, parsed, and persisted.

<script setup>
import { MarkerType } from '@vue-flow/core'

const edgeStyle = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-1)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }
const edgeStyleAlt = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-2)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }

const flowNodes = [
  { id: 'app', label: 'Client Microservice', position: { x: 50, y: 120 } },
  { id: 'auth', label: 'Service Key Validator', position: { x: 280, y: 50 } },
  { id: 'router', label: 'OTLP Webhook Router', position: { x: 280, y: 190 } },
  { id: 'catalog', label: 'Service Catalog Engine', position: { x: 520, y: 50 } },
  { id: 'topology', label: 'Topology Engine', position: { x: 520, y: 190 } },
  { id: 'sqliteRepo', label: 'bun:sqlite Storage', position: { x: 760, y: 120 } }
]

const flowEdges = [
  { id: 'pe1', source: 'app', target: 'router', label: 'POST /v1/traces', ...edgeStyle },
  { id: 'pe2', source: 'router', target: 'auth', label: 'Validate Key (UUID)', ...edgeStyleAlt },
  { id: 'pe3', source: 'router', target: 'catalog', label: 'Extract Attributes', ...edgeStyle },
  { id: 'pe4', source: 'router', target: 'topology', label: 'Compute Dependency', ...edgeStyleAlt },
  { id: 'pe5', source: 'catalog', target: 'sqliteRepo', label: 'Save Service Node', ...edgeStyle },
  { id: 'pe6', source: 'topology', target: 'sqliteRepo', label: 'Save Spans & Edges', ...edgeStyleAlt }
]
</script>

## Ingestion Pipeline Flow

<InteractiveFlow :nodes="flowNodes" :edges="flowEdges" height="340px" />

## Signal Processing Details

### 1. Traces (`POST /v1/traces`)
- Extracts resource attributes (`service.name`, `cloud.provider`, `cloud.region`, `cloud.platform`).
- Automatically detects serverless vs containerized workloads (e.g., GCP Cloud Run, AWS ECS).
- Calculates span duration (`endTimeUnixNano - startTimeUnixNano`).
- Computes dependency edges between calling service (`sourceService`) and target (`targetService`).

### 2. Metrics (`POST /v1/metrics`)
- Ingests Counter, Gauge, and Histogram metrics.
- Stores metric timestamp, values, and JSON attributes.
- Links exemplars to trace IDs when available for cross-signal navigation.

### 3. Logs (`POST /v1/logs`)
- Receives structured log records with OpenTelemetry severity numbers (TRACE=1 to FATAL=21).
- Extracts `trace_id` and `span_id` for 1-click correlation from log record to waterfall trace view.
