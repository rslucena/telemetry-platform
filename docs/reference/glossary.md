---
title: Observability Glossary & Key Concepts
description: Clear, illustrated explanations of OpenTelemetry signals, latency quantiles, SLOs, and RCA terms
---

# Observability Glossary & Key Concepts

A beginner-friendly reference for core telemetry terminology used throughout **Observability Pro**.

## Telemetry Signals & Structural Terms

### 🔍 Trace
A **Trace** represents the complete journey of a single request as it travels through a distributed system across multiple microservices, databases, and message queues.

### ⏱️ Span
A **Span** is a single unit of work within a trace. It measures the start time, duration, and status of a specific execution step (e.g., executing a SQL query or making an external HTTP call).

```text
[ Trace: User Checkout Request (Total: 250ms) ]
 ├── [ Span 1: POST /api/checkout (120ms) ]
 ├── [ Span 2: SELECT * FROM users (15ms) ]
 └── [ Span 3: POST /v1/charge (115ms) ]
```

### 📊 Latency Quantiles (P50, P95, P99)
- **P50 (Median)**: 50% of all requests are faster than this value. Represents normal user experience.
- **P95 (95th Percentile)**: 95% of requests are faster than this value. Highlights latency for slower users.
- **P99 (99th Percentile)**: 99% of requests are faster than this value. Pinpoints tail latency spikes during heavy traffic.

## Reliability & Incident Terms

### 🎯 SLO (Service Level Objective)
A target performance goal set for a microservice over a rolling window (e.g., *"99.9% of checkout requests must succeed without error over 30 days"*).

### ⏳ Error Budget
The allowed amount of unreliability before breaching an SLO.
$$\text{Error Budget} = 100\% - \text{SLO Target}$$
*Example: A 99.9% target allows a 0.1% Error Budget.*

### 🔥 Burn Rate
The rate at which a service is consuming its Error Budget.
- **Burn Rate = 1.0**: Consuming budget at the exact expected rate.
- **Burn Rate > 14.4**: Critical burn rate! 100% of the budget will be exhausted within 2 days.

### 🧠 Root Cause Analysis (RCA)
Automated algorithmic correlation that cross-references error spikes, latency anomalies, and downstream dependency failures to identify the exact root service causing an outage.

### 🔗 Exemplar
A sample Trace ID attached directly to a Metric data point, allowing engineers to click directly from a metric chart peak to the exact execution trace.
