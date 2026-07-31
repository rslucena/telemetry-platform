'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cloud,
  Cpu,
  Database,
  FileText,
  Filter,
  GitFork,
  Layers,
  RefreshCw,
  Server,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface MapNode {
  id: string;
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue';
  cloudProvider: 'gcp' | 'aws';
  cloudRegion: string;
  cloudPlatform: string;
  status: 'healthy' | 'degraded' | 'critical';
  rps: number;
  p95LatencyMs: number;
  errorRate: number;
  x: number;
  y: number;
}

interface MapEdge {
  id: string;
  source: string;
  target: string;
  rps: number;
  latencyMs: number;
  isCrossCloud: boolean;
  sourceCloud: string;
  targetCloud: string;
}

const defaultNodes: MapNode[] = [];
const defaultEdges: MapEdge[] = [];

export default function TopologyPage() {
  const { cloudFilter, lastRefreshedAt } = useTelemetry();
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<MapEdge[]>([]);
  const [crossCloudOnly, setCrossCloudOnly] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTopology = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/topology');
      if (res.ok) {
        const json = await res.json();
        if (json.nodes && Array.isArray(json.nodes)) {
          const mappedNodes: MapNode[] = json.nodes.map(
            (s: Record<string, unknown>, idx: number) => ({
              id: String(s.id ?? s.name ?? `node-${idx}`),
              name: String(s.name ?? `service-${idx}`),
              type: 'service',
              cloudProvider: (s.cloudProvider === 'aws' ? 'aws' : 'gcp') as 'gcp' | 'aws',
              cloudRegion: String(s.cloudRegion ?? 'us-central1'),
              cloudPlatform: String(s.cloudPlatform ?? 'gcp_cloud_run'),
              status: (s.status === 'degraded' || s.status === 'critical'
                ? s.status
                : 'healthy') as MapNode['status'],
              rps: Number(s.rps ?? 0),
              p95LatencyMs: Number(s.p95LatencyMs ?? 0),
              errorRate: Number(s.errorRate ?? 0),
              x: 120 + (idx % 4) * 200,
              y: 140 + Math.floor(idx / 4) * 160,
            }),
          );
          setNodes(mappedNodes);
        } else {
          setNodes([]);
        }

        if (json.edges && Array.isArray(json.edges)) {
          setEdges(json.edges);
        } else {
          setEdges([]);
        }
      }
    } catch {
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lastRefreshedAt) {
      fetchTopology();
    }
  }, [fetchTopology, lastRefreshedAt]);

  const filteredNodes = nodes.filter((n) => {
    if (cloudFilter === 'all') return true;
    return n.cloudProvider === cloudFilter;
  });

  const filteredEdges = edges.filter((e) => {
    if (crossCloudOnly && !e.isCrossCloud) return false;
    if (cloudFilter !== 'all') {
      return e.sourceCloud === cloudFilter || e.targetCloud === cloudFilter;
    }
    return true;
  });

  const getNodeColor = (n: MapNode) => {
    if (n.status === 'critical') return 'var(--status-critical)';
    if (n.status === 'degraded') return 'var(--status-degraded)';
    return n.cloudProvider === 'gcp' ? '#4285F4' : '#FF9900';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        height: 'calc(100vh - 110px)',
      }}
    >
      {/* Topology Header */}
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
            <GitFork style={{ color: 'var(--accent)' }} size={20} />
            Topology Map & Cross-Cloud Dependency Graph
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Interactive dependency visualizer tracing HTTP/gRPC requests between GCP Cloud Run, AWS
            ECS & EC2 workloads.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setCrossCloudOnly(!crossCloudOnly)}
            className="font-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: crossCloudOnly ? 'var(--surface-container)' : 'transparent',
              border: crossCloudOnly
                ? '1px solid var(--accent)'
                : '1px solid var(--surface-border)',
              color: crossCloudOnly ? 'var(--accent)' : 'var(--text-muted)',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            <Filter size={13} />
            <span>{crossCloudOnly ? 'Cross-Cloud Only: ON' : 'Filter: All Dependencies'}</span>
          </button>

          <button
            type="button"
            onClick={fetchTopology}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-primary)',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <RefreshCw size={14} className={loading ? 'pulse-status' : ''} />
            <span>Sync Topology</span>
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0, position: 'relative' }}>
        <div
          className="glass-panel"
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-darker)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Legend Overlay */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              backgroundColor: 'var(--surface-card)',
              backdropFilter: 'blur(8px)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--surface-border)',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
              MAP LEGEND
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#4285F4',
                }}
              />{' '}
              GCP Cloud Run
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#FF9900',
                }}
              />{' '}
              AWS ECS / EC2
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '2px',
                  backgroundColor: 'var(--accent)',
                  strokeDasharray: '4',
                }}
              />{' '}
              Cross-Cloud Edge
            </div>
          </div>

          <svg
            width="100%"
            height="100%"
            viewBox="0 0 840 460"
            style={{ width: '100%', height: '100%' }}
          >
            <title>Multicloud Service Topology Map</title>
            <defs>
              <linearGradient id="crossCloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="100%" stopColor="#FF9900" />
              </linearGradient>

              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-muted)" />
              </marker>
              <marker
                id="arrowCross"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
              </marker>
            </defs>

            {/* Edge Connecting Lines */}
            {filteredEdges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              return (
                <g key={edge.id}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={
                      edge.isCrossCloud ? 'url(#crossCloudGradient)' : 'var(--surface-border-light)'
                    }
                    strokeWidth={edge.isCrossCloud ? 2.5 : 1.5}
                    strokeDasharray={edge.isCrossCloud ? '6 4' : 'none'}
                    markerEnd={edge.isCrossCloud ? 'url(#arrowCross)' : 'url(#arrow)'}
                  />

                  {/* Edge Metrics Badge */}
                  <g transform={`translate(${midX - 35}, ${midY - 12})`}>
                    <rect
                      width="70"
                      height="20"
                      rx="4"
                      fill="var(--bg-dark)"
                      stroke={edge.isCrossCloud ? 'var(--accent)' : 'var(--surface-border)'}
                      strokeWidth="1"
                    />
                    <text
                      x="35"
                      y="13"
                      textAnchor="middle"
                      fill={edge.isCrossCloud ? 'var(--accent)' : 'var(--text-secondary)'}
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="var(--font-mono)"
                    >
                      {edge.latencyMs}ms
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Topology Nodes */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const color = getNodeColor(node);

              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: Interactive SVG node component
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r="24"
                    fill="var(--surface)"
                    stroke={isSelected ? 'var(--accent)' : color}
                    strokeWidth={isSelected ? 3 : 2}
                  />

                  {node.type === 'database' ? (
                    <Database x="-10" y="-10" size={20} color={color} />
                  ) : node.type === 'cache' ? (
                    <Zap x="-10" y="-10" size={20} color={color} />
                  ) : (
                    <Server x="-10" y="-10" size={20} color={color} />
                  )}

                  {/* Node Label */}
                  <text
                    y="40"
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {node.name}
                  </text>

                  <text
                    y="52"
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize="9"
                    fontFamily="var(--font-mono)"
                  >
                    {node.rps} RPS • P95 {node.p95LatencyMs}ms
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Side Drawer Panel */}
        {selectedNode && (
          <div
            className="glass-panel"
            style={{
              width: '320px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                {selectedNode.name}
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
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

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className={`badge badge-${selectedNode.status}`}>{selectedNode.status}</span>
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-dark)',
                  color: 'var(--text-secondary)',
                }}
              >
                {selectedNode.cloudProvider} ({selectedNode.cloudRegion})
              </span>
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--surface-border)',
                  paddingBottom: '6px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Platform</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {selectedNode.cloudPlatform}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--surface-border)',
                  paddingBottom: '6px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Throughput</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {selectedNode.rps} RPS
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--surface-border)',
                  paddingBottom: '6px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>P95 Latency</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {selectedNode.p95LatencyMs}ms
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--surface-border)',
                  paddingBottom: '6px',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Error Rate</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color:
                      selectedNode.errorRate > 1 ? 'var(--status-critical)' : 'var(--text-primary)',
                  }}
                >
                  {selectedNode.errorRate}%
                </span>
              </div>
            </div>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}
            >
              <Link
                href={`/traces?serviceName=${selectedNode.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--accent)',
                  color: '#000',
                  padding: '8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                <Activity size={14} />
                <span>Explore Traces</span>
              </Link>
              <Link
                href={`/logs?serviceName=${selectedNode.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--surface-hover)',
                  border: '1px solid var(--surface-border)',
                  color: 'var(--text-primary)',
                  padding: '8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <FileText size={14} />
                <span>Inspect Logs</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
