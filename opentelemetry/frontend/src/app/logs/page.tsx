'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cloud,
  ExternalLink,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Server,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

interface LogItem {
  id: string;
  timestamp: string;
  severity: 'ERROR' | 'WARN' | 'INFO';
  serviceName: string;
  cloudProvider: 'gcp' | 'aws';
  message: string;
  traceId?: string;
  spanId?: string;
  attributes: Record<string, string | number | boolean>;
}

function LogsContent() {
  const { cloudFilter, lastRefreshedAt } = useTelemetry();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('searchQuery') || '';

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO'>('ALL');
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/logs');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const mapped: LogItem[] = json.data.map((r: Record<string, unknown>, i: number) => {
            const tsNum = typeof r.timestamp === 'number' ? r.timestamp : Number(r.timestamp);
            const formattedTs =
              !Number.isNaN(tsNum) && tsNum > 0
                ? new Date(tsNum > 1e14 ? Math.floor(tsNum / 1_000_000) : tsNum).toISOString()
                : typeof r.timestamp === 'string'
                  ? r.timestamp
                  : new Date().toISOString();

            const sevStr = String(r.severityText || r.severity_text || '').toUpperCase();
            const sevNum = Number(r.severityNumber || r.severity_number || 0);
            const severity: LogItem['severity'] =
              sevStr.includes('ERR') ||
              sevStr.includes('CRIT') ||
              sevStr.includes('ALERT') ||
              sevStr.includes('EMERG') ||
              sevNum >= 17
                ? 'ERROR'
                : sevStr.includes('WARN') || sevNum >= 13
                  ? 'WARN'
                  : 'INFO';

            return {
              id: String(r.id || `log-${i}`),
              timestamp: formattedTs,
              severity,
              serviceName: String(r.serviceName ?? r.service_name ?? 'unknown'),
              cloudProvider: String(r.cloudProvider ?? 'gcp') as 'gcp' | 'aws',
              message: String(r.body ?? r.message ?? ''),
              traceId: r.traceId ? String(r.traceId) : undefined,
              spanId: r.spanId ? String(r.spanId) : undefined,
              attributes: (r.attributes as Record<string, string | number | boolean>) ?? {},
            };
          });
          setLogs(mapped);
        }
      }
    } catch {
      // Backend offline — estado vazio
    } finally {
      setLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastRefreshedAt triggers manual refresh
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, lastRefreshedAt]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(log.traceId?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSeverity = severityFilter === 'ALL' || log.severity === severityFilter;
    const matchesCloud = cloudFilter === 'all' || log.cloudProvider === cloudFilter;

    return matchesSearch && matchesSeverity && matchesCloud;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
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
            <FileText style={{ color: 'var(--accent)' }} size={20} />
            Correlated Logs & Events Explorer
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Search, filter and jump directly between structured log entries and correlated W3C trace
            spans.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
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
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '12px', top: '9px', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log message, service or traceId..."
            className="font-mono"
            style={{
              width: '100%',
              padding: '7px 12px 7px 36px',
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '12px',
            }}
          />
        </div>

        {/* Severity Filter Buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['ALL', 'ERROR', 'WARN', 'INFO'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className="font-mono"
              style={{
                padding: '5px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor:
                  severityFilter === sev ? 'var(--surface-container)' : 'transparent',
                border:
                  severityFilter === sev
                    ? '1px solid var(--accent)'
                    : '1px solid var(--surface-border)',
                color: severityFilter === sev ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}
        >
          <thead>
            <tr
              className="font-mono"
              style={{
                borderBottom: '1px solid var(--surface-border)',
                backgroundColor: 'var(--bg-dark)',
                color: 'var(--text-muted)',
                fontSize: '11px',
              }}
            >
              <th style={{ padding: '10px 14px', fontWeight: 600, width: '180px' }}>TIMESTAMP</th>
              <th style={{ padding: '10px 14px', fontWeight: 600, width: '90px' }}>SEVERITY</th>
              <th style={{ padding: '10px 14px', fontWeight: 600, width: '160px' }}>SERVICE</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>LOG MESSAGE</th>
              <th
                style={{
                  padding: '10px 14px',
                  fontWeight: 600,
                  width: '200px',
                  textAlign: 'right',
                }}
              >
                CORRELATED TRACE
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}
                >
                  No logs found for the current query.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isError = log.severity === 'ERROR';
                const isWarn = log.severity === 'WARN';
                const isSelected = selectedLog?.id === log.id;

                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedLog(log);
                      }
                    }}
                    tabIndex={0}
                    style={{
                      borderBottom: '1px solid var(--surface-border)',
                      backgroundColor: isSelected ? 'var(--surface-container)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td
                      className="font-mono"
                      style={{
                        padding: '10px 14px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className={`badge ${
                          isError ? 'badge-critical' : isWarn ? 'badge-warning' : 'badge-healthy'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cloud
                          size={12}
                          style={{ color: log.cloudProvider === 'gcp' ? '#4285F4' : '#FF9900' }}
                        />
                        <span
                          className="font-mono"
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        >
                          {log.serviceName}
                        </span>
                      </div>
                    </td>

                    <td
                      className="font-mono"
                      style={{
                        padding: '10px 14px',
                        fontSize: '12px',
                        color: isError ? 'var(--status-critical)' : 'var(--text-primary)',
                      }}
                    >
                      {log.message}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {log.traceId ? (
                        <Link
                          href={`/traces?traceId=${log.traceId}`}
                          className="font-mono"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent)',
                            fontWeight: 500,
                          }}
                        >
                          Trace: {log.traceId.slice(0, 10)}... →
                        </Link>
                      ) : (
                        <span
                          className="font-mono"
                          style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                        >
                          No trace ID
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Log Details Drawer Inspector */}
      {selectedLog && (
        <div
          className="glass-panel"
          style={{
            width: '340px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: 'var(--surface-low)',
            border: '1px solid var(--surface-border)',
            borderRadius: '4px',
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
                LOG ENTRY DETAILS
              </span>
              <h2
                className="font-mono"
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginTop: '2px',
                }}
              >
                {selectedLog.serviceName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLog(null)}
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
            <span
              className={`badge ${selectedLog.severity === 'ERROR' ? 'badge-critical' : selectedLog.severity === 'WARN' ? 'badge-warning' : 'badge-healthy'}`}
            >
              {selectedLog.severity}
            </span>
            <span className="badge badge-healthy">{selectedLog.cloudProvider.toUpperCase()}</span>
            <span className="badge badge-unknown">
              {new Date(selectedLog.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              backgroundColor: 'var(--bg-dark)',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid var(--surface-border)',
            }}
          >
            <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              MESSAGE BODY
            </span>
            <p
              className="font-mono"
              style={{
                fontSize: '12px',
                color:
                  selectedLog.severity === 'ERROR'
                    ? 'var(--status-critical)'
                    : 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {selectedLog.message}
            </p>
          </div>

          {selectedLog.traceId && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                backgroundColor: 'var(--bg-dark)',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
              }}
            >
              <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                CORRELATED TRACE ID
              </span>
              <Link
                href={`/traces?traceId=${selectedLog.traceId}`}
                className="font-mono"
                style={{
                  fontSize: '11px',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{selectedLog.traceId}</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          )}

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

            {Object.keys(selectedLog.attributes).length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                No extra attributes recorded.
              </div>
            ) : (
              Object.entries(selectedLog.attributes).map(([k, v]) => (
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
                  <span className="font-mono" style={{ fontSize: '10px', color: 'var(--accent)' }}>
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

          <Link
            href={`/services?name=${selectedLog.serviceName}`}
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
              marginTop: '6px',
            }}
          >
            <span>View Service Details</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense
      fallback={<div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading Logs...</div>}
    >
      <LogsContent />
    </Suspense>
  );
}
