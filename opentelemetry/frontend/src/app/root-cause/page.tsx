'use client';

import type { RCAReport } from '@telemetry/types';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  ExternalLink,
  MemoryStick,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

interface RCACandidate {
  id: string;
  title: string;
  type: 'database' | 'service' | 'infrastructure' | 'external';
  confidence: number;
  summary: string;
  delta: string;
  traceId?: string;
  suggestedAction?: string;
}

interface EvidenceNode {
  id: string;
  label: string;
  detail: string;
  type: 'root' | 'propagation' | 'impact';
  traceId?: string;
  logQuery?: string;
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80
      ? 'var(--status-critical)'
      : value >= 60
        ? 'var(--status-degraded)'
        : 'var(--text-muted)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          backgroundColor: 'var(--surface)',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '9999px',
            boxShadow: value >= 60 ? `0 0 8px ${color}55` : 'none',
            transition: 'width 0.8s ease',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 700,
          color,
          minWidth: '40px',
        }}
      >
        {value}%
      </span>
    </div>
  );
}

function PropagationNode({ node, isLast }: { node: EvidenceNode; isLast: boolean }) {
  const isRoot = node.type === 'root';
  const isImpact = node.type === 'impact';

  const borderColor = isRoot
    ? 'var(--status-critical)'
    : isImpact
      ? 'var(--surface-border)'
      : 'var(--surface-border)';

  const Icon = isRoot ? Database : isImpact ? Users : Activity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Node Card */}
      <div
        style={{
          width: '320px',
          border: `${isRoot ? '2px' : '1px'} solid ${borderColor}`,
          borderRadius: '8px',
          padding: '16px',
          backgroundColor: isRoot ? 'var(--bg-dark)' : 'var(--surface)',
          boxShadow: isRoot ? '0 0 16px var(--status-critical)15' : 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px',
            borderBottom: isRoot ? '1px solid var(--surface-border)' : 'none',
            paddingBottom: isRoot ? '8px' : '0',
          }}
        >
          <Icon
            size={18}
            style={{
              color: isRoot ? 'var(--status-critical)' : 'var(--text-muted)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            {node.label}
          </span>
          {isRoot && (
            <span className="badge badge-critical" style={{ marginLeft: 'auto', fontSize: '10px' }}>
              ROOT CAUSE
            </span>
          )}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          {node.detail}
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {node.traceId && (
            <Link
              href={`/traces?traceId=${node.traceId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-glow)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--accent)',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={11} />
              Open Trace
            </Link>
          )}
          {node.logQuery && (
            <Link
              href={`/logs?query=${encodeURIComponent(node.logQuery)}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--surface-container)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
                textDecoration: 'none',
              }}
            >
              <Search size={11} />
              Search Logs
            </Link>
          )}
        </div>
      </div>

      {/* Connector Arrow */}
      {!isLast && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            height: '48px',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: '1px',
              flex: 1,
              background:
                'linear-gradient(to bottom, var(--accent) 0%, var(--accent) 50%, transparent 50%)',
              backgroundSize: '1px 8px',
            }}
          />
          <ArrowDown
            size={14}
            style={{
              color: 'var(--accent)',
              position: 'absolute',
              bottom: '4px',
              animation: 'pulse 2s infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}

function RootCauseContent() {
  const searchParams = useSearchParams();
  const incidentId = searchParams.get('incidentId') || 'inc-0';

  const [report, setReport] = useState<RCAReport | null>(null);
  const [candidates, setCandidates] = useState<RCACandidate[]>([]);
  const [evidenceNodes, setEvidenceNodes] = useState<EvidenceNode[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRCAReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/v1/root-cause/${incidentId}`);
      if (res.ok) {
        const json: RCAReport = await res.json();
        setReport(json);

        if (json.hypotheses && json.hypotheses.length > 0) {
          const mappedCandidates: RCACandidate[] = json.hypotheses.map((h, i) => ({
            id: `hypo-${i}`,
            title: `${h.serviceName} - ${h.causeType}`,
            type: h.causeType.toLowerCase().includes('db') ? 'database' : 'service',
            confidence: h.confidencePercent,
            summary: h.summary,
            delta: `Rank #${h.rank}`,
            traceId:
              h.evidences.find((e) => e.traceId)?.traceId || json.causalFactors?.[0]?.traceId,
            suggestedAction: h.suggestedAction,
          }));
          setCandidates(mappedCandidates);
          setSelectedCandidateId(mappedCandidates[0].id);

          const topHypo = json.hypotheses[0];
          const mappedEvidence: EvidenceNode[] = topHypo.evidences.map((e, idx) => ({
            id: `ev-${idx}`,
            label: `${e.type.toUpperCase()}: ${e.description}`,
            detail: `Baseline: ${e.baselineValue || 'N/A'} | Observado: ${e.anomalyValue || 'N/A'}`,
            type: idx === 0 ? 'root' : 'propagation',
            traceId: e.traceId,
            logQuery: `service=${topHypo.serviceName}`,
          }));

          mappedEvidence.push({
            id: 'ev-impact',
            label: 'Incident Impact',
            detail: `Incident ${json.incidentId} evaluated on service target`,
            type: 'impact',
          });

          setEvidenceNodes(mappedEvidence);
        }
      }
    } catch {
      setReport(null);
      setCandidates([]);
      setEvidenceNodes([]);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchRCAReport();
  }, [fetchRCAReport]);

  const activeCandidate = candidates.find((c) => c.id === selectedCandidateId) ?? candidates[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '20px' }}>
        <Link
          href="/incidents"
          className="font-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--accent)',
            marginBottom: '12px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          ← Back to Incidents & Alerts Dashboard
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <Search size={16} style={{ color: 'var(--accent)' }} />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Root Cause Analysis (Single View Detail)
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Incident #{incidentId}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  className="pulse-status"
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-critical)',
                  }}
                />
                <span className="badge badge-critical">CRITICAL</span>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {activeCandidate ? activeCandidate.title : 'Root Cause Evaluation'} ·{' '}
                <strong style={{ color: 'var(--status-healthy)' }}>
                  {activeCandidate?.confidence ?? 0}% confidence
                </strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {activeCandidate?.traceId && (
              <Link
                href={`/traces?traceId=${activeCandidate.traceId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--surface)',
                  textDecoration: 'none',
                }}
              >
                <ExternalLink size={14} />
                Open Trace Detail
              </Link>
            )}
            <button
              type="button"
              onClick={fetchRCAReport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'var(--accent)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#000',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Re-Analyze RCA
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px',
            gap: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            Executing statistical Root Cause analysis for "{incidentId}"...
          </span>
        </div>
      ) : candidates.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: '48px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <AlertTriangle size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            No root cause hypotheses identified in the selected period
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '500px' }}>
            No statistical anomalies or trace/log failures were detected for incident {incidentId}.
          </p>
        </div>
      ) : (
        /* Bento Grid */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Left: RCA Candidates + Evidence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-muted)',
              }}
            >
              <TrendingUp size={16} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Evidence Chain
              </span>
            </div>

            {/* Candidates Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Ranked Root Cause Candidates:
              </div>
              {candidates.map((candidate) => {
                const isSelected = candidate.id === selectedCandidateId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => setSelectedCandidateId(candidate.id)}
                    className="glass-panel"
                    style={{
                      textAlign: 'left',
                      padding: '16px',
                      borderRadius: '6px',
                      border: isSelected
                        ? '1px solid var(--accent)'
                        : '1px solid var(--surface-border)',
                      backgroundColor: isSelected ? 'var(--surface-container)' : 'var(--surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}
                      >
                        {candidate.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent)',
                        }}
                      >
                        {candidate.delta}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        marginBottom: '10px',
                        lineHeight: 1.4,
                      }}
                    >
                      {candidate.summary}
                    </p>
                    <ConfidenceBar value={candidate.confidence} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Interactive Propagation Graph */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} style={{ color: 'var(--accent)' }} />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Failure Propagation Graph
                </span>
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                backgroundColor: 'var(--bg-dark)',
              }}
            >
              {evidenceNodes.map((node, index) => (
                <PropagationNode
                  key={node.id}
                  node={node}
                  isLast={index === evidenceNodes.length - 1}
                />
              ))}
            </div>

            {/* Suggested Action Card */}
            {activeCandidate?.suggestedAction && (
              <div
                className="glass-panel"
                style={{
                  padding: '20px',
                  borderLeft: '4px solid var(--accent)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Mitigation Recommendation
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {activeCandidate.suggestedAction}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RootCausePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
          Loading Root Cause Analysis...
        </div>
      }
    >
      <RootCauseContent />
    </Suspense>
  );
}
