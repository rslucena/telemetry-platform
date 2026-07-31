---
title: Embedded SQLite Database Schema
description: bun:sqlite schema ERD entity relationships and performance index optimizations
---

# Embedded SQLite Database Schema

**Observability Pro** uses **`bun:sqlite`** with Write-Ahead Logging (WAL) for sub-millisecond local reads and writes.

<script setup>
import { MarkerType } from '@vue-flow/core'

const edgeStyle = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-1)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }
const edgeStyleAlt = { type: 'smoothstep', style: { stroke: 'var(--vp-c-brand-2)', strokeWidth: 2 }, animated: true, markerEnd: MarkerType.ArrowClosed }

const dbNodes = [
  { id: 'services', label: 'SERVICES (id, name, env, status)', position: { x: 300, y: 120 } },
  { id: 'spans', label: 'SPANS (span_id, trace_id, duration_ms)', position: { x: 50, y: 40 } },
  { id: 'metrics', label: 'METRICS (id, name, value, timestamp)', position: { x: 550, y: 40 } },
  { id: 'logs', label: 'LOGS (id, severity, body, trace_id)', position: { x: 50, y: 200 } },
  { id: 'slos', label: 'SLOS (id, target_percentage, window)', position: { x: 550, y: 200 } },
  { id: 'dependencies', label: 'DEPENDENCIES (source_key, target_key)', position: { x: 300, y: 270 } }
]

const dbEdges = [
  { id: 'dbe1', source: 'services', target: 'spans', label: '1 : N (emits)', ...edgeStyle },
  { id: 'dbe2', source: 'services', target: 'metrics', label: '1 : N (emits)', ...edgeStyleAlt },
  { id: 'dbe3', source: 'services', target: 'logs', label: '1 : N (emits)', ...edgeStyle },
  { id: 'dbe4', source: 'services', target: 'slos', label: '1 : N (has)', ...edgeStyleAlt },
  { id: 'dbe5', source: 'services', target: 'dependencies', label: '1 : N (source/target)', ...edgeStyle }
]
</script>

## Entity Relationship Interactive Diagram

<InteractiveFlow :nodes="dbNodes" :edges="dbEdges" height="360px" />

---

## Performance Optimizations

1. **Pragma Configurations**:
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA foreign_keys = ON;
   PRAGMA temp_store = MEMORY;
   ```

2. **Indexes**:
   - `idx_spans_trace_id` on `spans(trace_id)`
   - `idx_spans_service_key` on `spans(service_key)`
   - `idx_spans_start_time` on `spans(start_time)`
   - `idx_logs_trace_id` on `logs(trace_id)`
   - `idx_metrics_name_service` on `metrics(name, service_key)`
