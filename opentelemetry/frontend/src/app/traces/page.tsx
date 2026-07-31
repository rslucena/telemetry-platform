'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import type { SpanData } from '@telemetry/types';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  Code2,
  Copy,
  Database,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Server,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

interface TraceRow {
  traceId: string;
  rootService: string;
  rootOperation: string;
  durationMs: number;
  statusCode: number;
  statusMessage?: string;
  spanCount: number;
  timestamp: string;
  hasCrossCloud: boolean;
  spans: {
    spanId: string;
    parentSpanId?: string;
    name: string;
    serviceName: string;
    cloudProvider: 'gcp' | 'aws';
    durationMs: number;
    offsetMs: number;
    statusCode: number;
    statusMessage?: string;
    attributes: Record<string, string | number | boolean>;
  }[];
}

function groupSpansIntoTraces(spans: SpanData[]): TraceRow[] {
  const byTrace = new Map<string, SpanData[]>();
  for (const span of spans) {
    const list = byTrace.get(span.traceId) ?? [];
    list.push(span);
    byTrace.set(span.traceId, list);
  }

  const rows: TraceRow[] = [];
  for (const [traceId, traceSpans] of byTrace) {
    const root = traceSpans.find((s) => !s.parentSpanId) ?? traceSpans[0];
    const getCloud = (s: SpanData): 'gcp' | 'aws' => {
      const attrs = (s.attributes || {}) as Record<string, unknown>;
      const p = String(attrs.cloudProvider ?? attrs['cloud.provider'] ?? '');
      return p === 'aws' ? 'aws' : 'gcp';
    };
    const providers = new Set(traceSpans.map(getCloud));
    const hasError = traceSpans.some((s) => s.statusCode === 2);
    const traceStatusCode = hasError ? 2 : (root.statusCode ?? 0);
    const errorSpan = traceSpans.find((s) => s.statusCode === 2);
    const statusMessage =
      errorSpan?.statusMessage ||
      root.statusMessage ||
      (hasError ? 'Execution Error in downstream span' : undefined);

    rows.push({
      traceId,
      rootService: root.serviceName,
      rootOperation: root.name,
      durationMs: root.durationMs ?? 0,
      statusCode: traceStatusCode,
      statusMessage,
      spanCount: traceSpans.length,
      timestamp: root.startTime ? new Date(root.startTime).toISOString() : new Date().toISOString(),
      hasCrossCloud: providers.size > 1,
      spans: traceSpans.map((s) => ({
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        name: s.name,
        serviceName: s.serviceName,
        cloudProvider: getCloud(s),
        durationMs: s.durationMs ?? 0,
        offsetMs: Math.max(0, s.startTime - root.startTime),
        statusCode: s.statusCode ?? 0,
        statusMessage:
          s.statusMessage ||
          (s.attributes?.['error.message'] ? String(s.attributes['error.message']) : undefined),
        attributes: (s.attributes as Record<string, string | number | boolean>) ?? {},
      })),
    });
  }
  return rows;
}

function TracesContent() {
  const { cloudFilter, lastRefreshedAt } = useTelemetry();
  const searchParams = useSearchParams();
  const traceIdParam = searchParams.get('traceId');
  const serviceNameParam = searchParams.get('serviceName');
  const initialQuery = traceIdParam || serviceNameParam || '';

  const [traces, setTraces] = useState<TraceRow[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceRow | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<TraceRow['spans'][0] | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ERROR' | 'OK'>('ALL');
  const [expandedSpans, setExpandedSpans] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const fetchTraces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/traces');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const rows = groupSpansIntoTraces(json.data as SpanData[]);
          setTraces(rows);
          if (rows.length > 0) {
            let target = rows[0];
            if (traceIdParam) {
              const found = rows.find((r) =>
                r.traceId.toLowerCase().includes(traceIdParam.toLowerCase()),
              );
              if (found) target = found;
            } else if (serviceNameParam) {
              const found = rows.find(
                (r) =>
                  r.rootService.toLowerCase().includes(serviceNameParam.toLowerCase()) ||
                  r.spans.some((s) =>
                    s.serviceName.toLowerCase().includes(serviceNameParam.toLowerCase()),
                  ),
              );
              if (found) target = found;
            }
            setSelectedTrace(target);
            const targetSpan =
              target.spans.find((s) => s.statusCode === 2) ?? target.spans[0] ?? null;
            setSelectedSpan(targetSpan);
          }
        }
      }
    } catch {
      // Backend offline
    } finally {
      setLoading(false);
    }
  }, [traceIdParam, serviceNameParam]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastRefreshedAt triggers manual refresh
  useEffect(() => {
    fetchTraces();
  }, [fetchTraces, lastRefreshedAt]);

  const filteredTraces = traces.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.traceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.rootService.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.rootOperation.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ERROR' && t.statusCode === 2) ||
      (statusFilter === 'OK' && t.statusCode !== 2);

    const matchesCloud =
      cloudFilter === 'all' || t.spans.some((s) => s.cloudProvider === cloudFilter);

    return matchesSearch && matchesStatus && matchesCloud;
  });

  const expandAll = () => {
    if (!selectedTrace) return;
    const next: Record<string, boolean> = {};
    for (const s of selectedTrace.spans) {
      next[s.spanId] = true;
    }
    setExpandedSpans(next);
  };

  const collapseAll = () => {
    setExpandedSpans({});
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: 'calc(100vh - 110px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            className="font-display"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              letterSpacing: '-0.01em',
            }}
          >
            <Activity style={{ color: 'var(--accent)' }} size={20} />
            Distributed Traces & Waterfall Explorer
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Inspect microsecond end-to-end request latency timelines, SQL queries and cross-cloud
            execution paths.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTraces}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface-container)',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-primary)',
            padding: '6px 14px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          <RefreshCw size={14} className={loading ? 'pulse-status' : ''} />
          <span>Refresh Traces</span>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0 }}>
        <div
          className="glass-panel"
          style={{
            width: '320px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: 'var(--surface-dim)',
          }}
        >
          <div
            style={{
              padding: '12px',
              borderBottom: '1px solid var(--surface-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: 'var(--surface-container-low)',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '9px',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trace ID or service..."
                className="font-mono"
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  backgroundColor: 'var(--bg-dark)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {(['ALL', 'ERROR', 'OK'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className="font-mono"
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    backgroundColor:
                      statusFilter === st ? 'var(--surface-container)' : 'transparent',
                    border:
                      statusFilter === st
                        ? '1px solid var(--accent)'
                        : '1px solid var(--surface-border)',
                    color: statusFilter === st ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {filteredTraces.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                }}
              >
                No traces found matching criteria.
              </div>
            ) : (
              filteredTraces.map((t) => {
                const isSelected = selectedTrace?.traceId === t.traceId;
                const isError = t.statusCode === 2;

                return (
                  <button
                    type="button"
                    key={t.traceId}
                    onClick={() => {
                      setSelectedTrace(t);
                      setSelectedSpan(t.spans[0]);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--surface-border)',
                      backgroundColor: isSelected ? 'var(--surface-container)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        className="font-mono"
                        style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}
                      >
                        {t.rootService}
                      </span>
                      <span className={`badge ${isError ? 'badge-critical' : 'badge-healthy'}`}>
                        {t.durationMs.toFixed(1)}ms
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        className="font-mono"
                        style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                      >
                        {t.rootOperation}
                      </span>
                      <span
                        className="font-mono"
                        style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                      >
                        {t.spanCount} spans
                      </span>
                    </div>

                    <div
                      className="font-mono"
                      style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}
                    >
                      ID: {t.traceId.slice(0, 12)}...
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selectedTrace ? (
          <div
            className="glass-panel"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--surface-dim)',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--surface-border)',
                backgroundColor: 'var(--surface-container-low)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2
                    className="font-display"
                    style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    Trace{' '}
                    <span className="font-mono" style={{ color: 'var(--accent)' }}>
                      {selectedTrace.traceId.slice(0, 16)}...
                    </span>
                  </h2>
                  <span
                    className={`badge ${selectedTrace.statusCode === 2 ? 'badge-critical' : 'badge-healthy'}`}
                  >
                    {selectedTrace.statusCode === 2 ? 'Error' : 'Success'}
                  </span>
                  {selectedTrace.hasCrossCloud && (
                    <span className="badge badge-unknown">
                      <Cloud size={10} /> Cross-Cloud
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                  <div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Total Duration
                    </span>
                    <div
                      className="font-mono"
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}
                    >
                      {selectedTrace.durationMs.toFixed(2)} ms
                    </div>
                  </div>

                  <div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Spans
                    </span>
                    <div
                      className="font-mono"
                      style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}
                    >
                      {selectedTrace.spanCount}
                    </div>
                  </div>

                  <div>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Timestamp
                    </span>
                    <div
                      className="font-mono"
                      style={{ fontSize: '12px', color: 'var(--text-primary)', marginTop: '2px' }}
                    >
                      {new Date(selectedTrace.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={expandAll}
                  className="font-mono"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--surface-border)',
                    color: 'var(--accent)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="font-mono"
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--surface-border)',
                    color: 'var(--text-muted)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Collapse All
                </button>
              </div>
            </div>

            <div
              className="font-mono"
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--surface-border)',
                backgroundColor: 'var(--bg-dark)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  width: '38%',
                  padding: '8px 14px',
                  borderRight: '1px solid var(--surface-border)',
                  fontWeight: 600,
                }}
              >
                SERVICE & OPERATION
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>0ms</span>
                <span>{(selectedTrace.durationMs * 0.25).toFixed(1)}ms</span>
                <span>{(selectedTrace.durationMs * 0.5).toFixed(1)}ms</span>
                <span>{(selectedTrace.durationMs * 0.75).toFixed(1)}ms</span>
                <span>{selectedTrace.durationMs.toFixed(1)}ms</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {selectedTrace.spans.map((span, idx) => {
                const isSelectedSpan = selectedSpan?.spanId === span.spanId;
                const isErrorSpan = span.statusCode === 2;
                const leftPercent = (span.offsetMs / (selectedTrace.durationMs || 1)) * 100;
                const widthPercent = Math.max(
                  3,
                  (span.durationMs / (selectedTrace.durationMs || 1)) * 100,
                );

                return (
                  <button
                    type="button"
                    key={span.spanId}
                    onClick={() => setSelectedSpan(span)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--surface-border)',
                      backgroundColor: isSelectedSpan
                        ? 'var(--surface-container)'
                        : isErrorSpan
                          ? 'rgba(255, 180, 171, 0.05)'
                          : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        width: '38%',
                        padding: '8px 14px',
                        paddingLeft: `${14 + (span.parentSpanId ? 16 : 0)}px`,
                        borderRight: '1px solid var(--surface-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {isErrorSpan ? (
                        <AlertTriangle size={13} style={{ color: 'var(--status-critical)' }} />
                      ) : (
                        <div
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: span.cloudProvider === 'gcp' ? '#4285F4' : '#FF9900',
                          }}
                        />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span
                          className="font-mono"
                          style={{
                            fontWeight: isErrorSpan ? 700 : 500,
                            color: isErrorSpan ? 'var(--status-critical)' : 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        >
                          {span.serviceName}
                        </span>
                        <span
                          className="font-mono"
                          style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                        >
                          {span.name}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        padding: '8px 14px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          height: '8px',
                          borderRadius: '2px',
                          backgroundColor: isErrorSpan
                            ? 'var(--status-critical)'
                            : idx === 0
                              ? 'var(--accent)'
                              : 'var(--status-healthy)',
                        }}
                      />
                      <span
                        className="font-mono"
                        style={{
                          position: 'absolute',
                          left: `${leftPercent + widthPercent + 1.5}%`,
                          fontSize: '10px',
                          color: isErrorSpan ? 'var(--status-critical)' : 'var(--text-muted)',
                        }}
                      >
                        {span.durationMs.toFixed(1)}ms
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className="glass-panel"
            style={{ flex: 1, padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}
          >
            Select a trace from the left panel to inspect its waterfall timeline.
          </div>
        )}

        {/* Right Panel: Selected Span Details Inspector */}
        {selectedSpan && (
          <div
            className="glass-panel"
            style={{
              width: '340px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              backgroundColor: 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '10px',
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  SPAN DETAILS
                </span>
                <h3
                  className="font-mono"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                >
                  {selectedSpan.serviceName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpan(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span className="badge badge-healthy">{selectedSpan.durationMs.toFixed(2)} ms</span>
              <span className="badge badge-unknown">
                {selectedSpan.cloudProvider.toUpperCase()}
              </span>
              {selectedSpan.statusCode === 2 && <span className="badge badge-critical">Error</span>}
            </div>

            {/* Span Identifiers */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                backgroundColor: 'var(--bg-dark)',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
              }}
            >
              <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                SPAN ID
              </span>
              <span
                className="font-mono"
                style={{ fontSize: '11px', color: 'var(--text-primary)' }}
              >
                {selectedSpan.spanId}
              </span>
            </div>

            {/* Error Details & Code Location Card */}
            {(selectedSpan.statusCode === 2 || selectedSpan.statusMessage) && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  backgroundColor: 'rgba(147, 0, 10, 0.25)',
                  border: '1px solid var(--status-critical)',
                  padding: '10px',
                  borderRadius: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--status-critical)',
                  }}
                >
                  <AlertTriangle size={14} />
                  <span
                    className="font-mono"
                    style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}
                  >
                    ERROR DETAILS & CODE LOCATION
                  </span>
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '11px',
                    color: 'var(--status-critical)',
                    fontWeight: 600,
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedSpan.statusMessage ||
                    String(
                      selectedSpan.attributes['exception.message'] ||
                        selectedSpan.attributes['error.message'] ||
                        'HTTP 500 Internal Server Error',
                    )}
                </div>
                {(() => {
                  const stack = String(
                    selectedSpan.attributes['exception.stacktrace'] ||
                      selectedSpan.attributes['error.stack'] ||
                      '',
                  );
                  const stackMatch =
                    stack.match(/\(([^)]+:\d+:\d+)\)/) || stack.match(/at ([^\s]+\:\d+\:\d+)/);
                  const filePath =
                    (selectedSpan.attributes['code.filepath'] as string) ||
                    (stackMatch ? stackMatch[1] : null) ||
                    (selectedSpan.attributes['http.target'] as string) ||
                    (selectedSpan.attributes['url.path'] as string) ||
                    null;
                  const lineNo = selectedSpan.attributes['code.lineno'];

                  if (!filePath) return null;

                  return (
                    <div
                      className="font-mono"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-primary)',
                        marginTop: '4px',
                        opacity: 0.9,
                      }}
                    >
                      📍 Location: <strong>{String(filePath)}</strong>
                      {lineNo ? `:${lineNo}` : ''}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Semantic Attributes Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span
                className="font-mono"
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                ATTRIBUTES
              </span>

              {Object.keys(selectedSpan.attributes).length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  No extra attributes recorded.
                </div>
              ) : (
                Object.entries(selectedSpan.attributes).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '6px 8px',
                      backgroundColor: 'var(--bg-dark)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '4px',
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{ fontSize: '10px', color: 'var(--accent)' }}
                    >
                      {k}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        wordBreak: 'break-all',
                      }}
                    >
                      {String(v)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Cross-Page Correlation Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              <Link
                href={`/services?name=${selectedSpan.serviceName}`}
                className="font-mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'var(--surface-container)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
              >
                <span>View Service Details</span>
                <ArrowRight size={14} />
              </Link>

              <Link
                href={`/logs?searchQuery=${selectedSpan.serviceName}`}
                className="font-mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'var(--surface-container)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'var(--accent)',
                }}
              >
                <span>View Service Logs</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TracesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading Traces...</div>
      }
    >
      <TracesContent />
    </Suspense>
  );
}
