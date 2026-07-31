---
title: Correlation & Automated RCA Engine
description: Automated Root Cause Analysis engine flow and heuristic scoring algorithm
---

# Correlation & Automated RCA Engine

The **Correlation Engine** and **Root Cause Engine** analyze cross-signal telemetry to automatically identify the origin of operational incidents.

<script setup>
import { MarkerType } from '@vue-flow/core'

const edgeStyle = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-1)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }
const edgeStyleAlt = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-2)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }

const rcaNodes = [
  { id: 'incidentTrigger', label: 'Incident Trigger / SLO Breach', position: { x: 40, y: 120 } },
  { id: 'timeWindow', label: '15m Telemetry Window Collector', position: { x: 260, y: 120 } },
  { id: 'dbHypo', label: 'DB Query Saturation (Confidence 87%)', position: { x: 520, y: 40 } },
  { id: 'cloudHypo', label: 'Cross-Cloud Latency (Confidence 82%)', position: { x: 520, y: 120 } },
  { id: 'exceptionHypo', label: 'App Exception Burst (Confidence 65%)', position: { x: 520, y: 200 } },
  { id: 'reportOutput', label: 'RCA Report & Mitigation Guide', position: { x: 800, y: 120 } }
]

const rcaEdges = [
  { id: 're1', source: 'incidentTrigger', target: 'timeWindow', label: 'Analyze Window', ...edgeStyle },
  { id: 're2', source: 'timeWindow', target: 'dbHypo', ...edgeStyleAlt },
  { id: 're3', source: 'timeWindow', target: 'cloudHypo', ...edgeStyle },
  { id: 're4', source: 'timeWindow', target: 'exceptionHypo', ...edgeStyleAlt },
  { id: 're5', source: 'dbHypo', target: 'reportOutput', label: 'Rank #1', ...edgeStyle },
  { id: 're6', source: 'cloudHypo', target: 'reportOutput', label: 'Rank #2', ...edgeStyleAlt },
  { id: 're7', source: 'exceptionHypo', target: 'reportOutput', label: 'Rank #3', ...edgeStyle }
]
</script>

## Automated RCA Flow

<InteractiveFlow :nodes="rcaNodes" :edges="rcaEdges" height="340px" />

---

## Hypothesis Scoring Algorithm

1. **Database Failure Hypothesis**:
   - Evaluates spans with `db.system` attribute.
   - Measures average database latency vs 50ms baseline.
   - Counts failed SQL queries (`statusCode == 2`).
   - Assigns 87% confidence if SQL driver errors exist, 72% for latency spikes.

2. **Downstream Dependency Failure Hypothesis**:
   - Inspects topology dependency graph for target service.
   - Evaluates cross-cloud latency P95 (GCP -> AWS).
   - Assigns 82% confidence for cross-cloud failures, 68% for internal dependency failures.

3. **Internal Application Exception Burst**:
   - Counts application error logs (`severityNumber == 17`).
   - Assigns 65% confidence when error logs match the incident timeline.
