---
title: Platform Overview
description: Observability Pro core signals, capabilities, and interactive component architecture
---

# Platform Overview

Welcome to **Observability Pro (OTel Vantage Platform)** — an end-to-end distributed observability suite designed for modern microservice architectures.

## What is Observability Pro?

**Observability Pro** is a high-performance monorepo platform built on **Bun**, **Next.js 15**, and **`bun:sqlite`**, designed to ingest, process, store, and visualize OpenTelemetry (OTLP) signals without relying on costly third-party SaaS vendors.

### Core Signals Supported

| Signal | Standard | Description | UI View |
| :--- | :--- | :--- | :--- |
| **Traces** | OpenTelemetry OTLP | Distributed request tracing with span parent-child relationships. | `/traces` |
| **Metrics** | OpenTelemetry OTLP | System and application indicators (RPS, error rate, latencies). | `/metrics` |
| **Logs** | OpenTelemetry OTLP | Structured log records with trace context correlation (`trace_id`). | `/logs` |
| **Profiling** | Continuous Profiling | CPU and Memory profiles for application performance profiling. | `/profiling` |
| **SLOs** | Reliability Spec | Service Level Objectives, Error Budgets, and Burn Rates. | `/slos` |

---

<script setup>
import { MarkerType } from '@vue-flow/core'

const edgeStyle = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-1)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }
const edgeStyleAlt = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-2)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }

const overviewNodes = [
  { id: 'clients', label: 'Client Microservices', position: { x: 50, y: 120 } },
  { id: 'collector', label: 'OpenTelemetry Collector', position: { x: 270, y: 120 } },
  { id: 'backend', label: 'Observability Pro Backend (Bun)', position: { x: 510, y: 120 } },
  { id: 'db', label: 'Embedded bun:sqlite DB (WAL)', position: { x: 770, y: 40 } },
  { id: 'rca', label: 'Automated Root Cause Engine', position: { x: 770, y: 120 } },
  { id: 'slo', label: 'SLO & Error Budget Evaluator', position: { x: 770, y: 200 } },
  { id: 'dashboard', label: 'Next.js 15 UI Dashboard', position: { x: 1030, y: 120 } }
]

const overviewEdges = [
  { id: 'oe1', source: 'clients', target: 'collector', label: 'OTLP gRPC/HTTP', ...edgeStyle },
  { id: 'oe2', source: 'collector', target: 'backend', label: 'OTLP JSON', ...edgeStyleAlt },
  { id: 'oe3', source: 'backend', target: 'db', label: 'High-Speed Writes', ...edgeStyle },
  { id: 'oe4', source: 'backend', target: 'rca', label: 'Correlation', ...edgeStyleAlt },
  { id: 'oe5', source: 'backend', target: 'slo', label: 'Metrics Stream', ...edgeStyle },
  { id: 'oe6', source: 'db', target: 'dashboard', label: 'REST Queries', ...edgeStyleAlt }
]
</script>

## Core Capabilities & Interactive Flow

<InteractiveFlow :nodes="overviewNodes" :edges="overviewEdges" height="340px" />

1. **Unified Monitoring**: Single pane of glass for all cross-cloud microservices (AWS, GCP, Azure, On-prem).
2. **Automated Root Cause Analysis (RCA)**: Algorithmic correlation across logs, metrics, and traces to identify failing dependencies.
3. **Embedded Low-Footprint Storage**: Built-in `bun:sqlite` engine configured with Write-Ahead Logging (WAL) for sub-millisecond local reads and writes.
