'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  BarChart3,
  Calendar,
  Clock,
  Cloud,
  Cpu,
  ExternalLink,
  HardDrive,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Server,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const TIME_RANGES = ['Today', '15m', '30m', '1h', '6h', '12h', '2d', '6d', '15d', '30d'] as const;

const INSTANCE_COLORS = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#A142F4', '#FF9900'];

interface ActiveService {
  name: string;
  cloudProvider: 'gcp' | 'aws';
  tech: string;
  instanceCount: number;
  instances: string[];
  status: 'healthy' | 'warning' | 'critical';
}

const ACTIVE_SERVICES: ActiveService[] = [];

interface InstanceMetric {
  instanceName: string;
  cpuPercent: number;
  memoryMb: number;
}

interface MetricTimelinePoint {
  time: string;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  instances: number;
  cpuPercent: number;
  memoryMb: number;
  maxConcurrent: number;
  instanceMetrics: InstanceMetric[];
  exemplarTraceId?: string;
}

interface SvgLineChartProps {
  height?: number;
  timeline: MetricTimelinePoint[];
  series: {
    name: string;
    color: string;
    getValue: (pt: MetricTimelinePoint) => number;
  }[];
  yAxisMax: number;
  unit: string;
  showExemplars?: boolean;
}

function SvgLineChart({
  height = 140,
  timeline,
  series,
  yAxisMax,
  unit,
  showExemplars = false,
}: SvgLineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) return null;

  const chartWidth = 500;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const drawableWidth = chartWidth - paddingLeft - paddingRight;
  const drawableHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) =>
    paddingLeft + (idx / Math.max(1, timeline.length - 1)) * drawableWidth;
  const getY = (val: number) =>
    paddingTop + drawableHeight - (Math.min(val, yAxisMax) / yAxisMax) * drawableHeight;

  const activePoint = hoveredIdx !== null ? timeline[hoveredIdx] : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        style={{ width: '100%', height: `${height}px`, overflow: 'visible' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <title>Metric Line Chart</title>

        {/* Grid Y-Axis Ticks Lines & Values */}
        {[0, 0.5, 1].map((ratio) => {
          const val = Math.round(yAxisMax * (1 - ratio));
          const y = paddingTop + ratio * drawableHeight;
          return (
            <g key={ratio}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="var(--surface-border)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 6}
                y={y + 3}
                fill="var(--text-muted)"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="end"
              >
                {val}
                {unit}
              </text>
            </g>
          );
        })}

        {/* X-Axis Time Ticks (Espaçados uniformemente, máximo 5 rótulos) */}
        {(() => {
          const total = timeline.length;
          if (total === 0) return null;
          const maxTicks = 5;
          const step = Math.max(1, Math.floor(total / (maxTicks - 1)));

          return timeline.map((pt, idx) => {
            if (idx !== 0 && idx % step !== 0 && idx !== total - 1) return null;
            const x = getX(idx);
            return (
              <text
                key={`tick-${pt.time}-${idx}`}
                x={x}
                y={height - 5}
                fill="var(--text-muted)"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {pt.time}
              </text>
            );
          });
        })()}

        {/* Series Line Paths */}
        {series.map((s) => {
          const pointsSvg = timeline
            .map((pt, idx) => `${getX(idx)},${getY(s.getValue(pt))}`)
            .join(' ');

          return (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsSvg}
              />
              {timeline.map((pt, idx) => (
                <circle
                  key={`circle-${s.name}-${pt.time}-${idx}`}
                  cx={getX(idx)}
                  cy={getY(s.getValue(pt))}
                  r="3"
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}

        {/* Exemplar Diamond Markers */}
        {showExemplars &&
          timeline.map((pt, idx) => {
            if (!pt.exemplarTraceId) return null;
            const x = getX(idx);
            const y = getY(pt.p99) - 12;
            return (
              <g key={`exemplar-${pt.time}-${idx}`}>
                <rect
                  x={x - 6}
                  y={y - 6}
                  width="12"
                  height="12"
                  fill="var(--accent)"
                  transform={`rotate(45 ${x} ${y})`}
                  rx="2"
                />
                <text
                  x={x}
                  y={y + 3}
                  fill="#00285d"
                  fontSize="8"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  ❖
                </text>
              </g>
            );
          })}

        {/* Hover Vertical Guide Line & Capture Rects */}
        {hoveredIdx !== null && (
          <line
            x1={getX(hoveredIdx)}
            y1={paddingTop}
            x2={getX(hoveredIdx)}
            y2={height - paddingBottom}
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {timeline.map((pt, idx) => {
          const x = getX(idx);
          const colWidth = drawableWidth / timeline.length;
          return (
            <rect
              key={`hover-zone-${pt.time}-${idx}`}
              x={x - colWidth / 2}
              y={0}
              width={colWidth}
              height={height}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIdx(idx)}
            />
          );
        })}
      </svg>

      {/* Floating Hover Tooltip Box */}
      {hoveredIdx !== null && activePoint && (
        <div
          className="glass-panel font-mono"
          style={{
            position: 'absolute',
            top: '0px',
            left: `${Math.min(Math.max(getX(hoveredIdx) - 80, 10), 300)}px`,
            backgroundColor: 'rgba(10, 15, 26, 0.95)',
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            padding: '8px 12px',
            zIndex: 30,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontSize: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
            TIMESTAMP: {activePoint.time}
          </div>
          {series.map((s) => (
            <div
              key={s.name}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}
            >
              <span style={{ color: s.color, fontWeight: 600 }}>{s.name}:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                {s.getValue(activePoint)}
                {unit}
              </span>
            </div>
          ))}
          {activePoint.exemplarTraceId && (
            <div style={{ marginTop: '2px', color: 'var(--accent)', fontWeight: 700 }}>
              ❖ Trace: {activePoint.exemplarTraceId.slice(0, 12)}...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricsContent() {
  const { cloudFilter, lastRefreshedAt } = useTelemetry();
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get('serviceName') || '';

  const [servicesList, setServicesList] = useState<ActiveService[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
  const [maximizedChart, setMaximizedChart] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<MetricTimelinePoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:4000/api/v1/settings/services');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const mapped: ActiveService[] = json.data.map(
            (s: Record<string, unknown>, i: number) => ({
              name: String(s.name ?? `service-${i}`),
              cloudProvider: (s.cloudProvider === 'aws' ? 'aws' : 'gcp') as 'gcp' | 'aws',
              tech: String(s.environment ?? 'Cloud Run'),
              instanceCount: Number(s.instanceCount ?? 1),
              instances: ['inst-01'],
              status: (s.status === 'deactivated'
                ? 'critical'
                : 'healthy') as ActiveService['status'],
            }),
          );
          setServicesList(mapped);
          if (mapped.length > 0 && !selectedService) {
            const initialName = mapped.find((s) => s.name === serviceParam)?.name ?? mapped[0].name;
            setSelectedService(initialName);
          }
        }
      }
    } catch {
      setServicesList([]);
    }
  }, [selectedService, serviceParam]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const currentServiceObj = servicesList.find((s) => s.name === selectedService) ?? servicesList[0];

  const filteredServices = servicesList.filter(
    (s) =>
      (cloudFilter === 'all' || s.cloudProvider === cloudFilter) &&
      s.name.toLowerCase().includes(serviceSearch.toLowerCase()),
  );

  const fetchMetrics = useCallback(async () => {
    if (!selectedService) return;
    setLoading(true);
    try {
      let startTimeMs: number | undefined;
      const now = Date.now();
      if (selectedTimeRange === '5m') startTimeMs = now - 5 * 60 * 1000;
      else if (selectedTimeRange === '15m') startTimeMs = now - 15 * 60 * 1000;
      else if (selectedTimeRange === '1h') startTimeMs = now - 60 * 60 * 1000;
      else if (selectedTimeRange === '6h') startTimeMs = now - 6 * 60 * 60 * 1000;
      else if (selectedTimeRange === '24h') startTimeMs = now - 24 * 60 * 60 * 1000;
      else if (selectedTimeRange === 'today' || selectedTimeRange === 'Today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        startTimeMs = d.getTime();
      }

      const url = new URL('http://localhost:4000/api/v1/metrics');
      url.searchParams.set('serviceName', selectedService);
      if (startTimeMs) url.searchParams.set('startTimeMs', String(startTimeMs));

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const mapped: MetricTimelinePoint[] = json.data.map(
            (m: Record<string, unknown>, i: number) => {
              const timeStr =
                typeof m.time === 'string'
                  ? m.time
                  : typeof m.timestamp === 'number'
                    ? new Date(m.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : `Point ${i + 1}`;
              const val = Number(m.value ?? 1);
              return {
                time: timeStr,
                rps: Number(m.rps ?? (val > 0 ? val : 1)),
                p50: Number(m.p50 ?? 18),
                p95: Number(m.p95 ?? 65),
                p99: Number(m.p99 ?? 120),
                instances: Number(m.instances ?? 1),
                cpuPercent: Number(m.cpuPercent ?? 24),
                memoryMb: Number(m.memoryMb ?? 180),
                maxConcurrent: Number(m.maxConcurrent ?? 12),
                instanceMetrics: Array.isArray(m.instanceMetrics)
                  ? (m.instanceMetrics as InstanceMetric[])
                  : [{ instanceName: 'inst-01', cpuPercent: 24, memoryMb: 180 }],
                exemplarTraceId: m.exemplarTraceId ? String(m.exemplarTraceId) : undefined,
              };
            },
          );
          let finalTimeline = mapped;
          if (mapped.length > 24) {
            const bucketSize = Math.ceil(mapped.length / 24);
            const downsampled: MetricTimelinePoint[] = [];
            for (let i = 0; i < mapped.length; i += bucketSize) {
              const chunk = mapped.slice(i, i + bucketSize);
              const lastPoint = chunk[chunk.length - 1];
              downsampled.push({
                ...lastPoint,
                rps: Number((chunk.reduce((sum, p) => sum + p.rps, 0) / chunk.length).toFixed(1)),
                p50: Number((chunk.reduce((sum, p) => sum + p.p50, 0) / chunk.length).toFixed(1)),
                p95: Number((chunk.reduce((sum, p) => sum + p.p95, 0) / chunk.length).toFixed(1)),
                p99: Number((chunk.reduce((sum, p) => sum + p.p99, 0) / chunk.length).toFixed(1)),
              });
            }
            finalTimeline = downsampled;
          }
          setTimeline(finalTimeline);
        } else {
          setTimeline([]);
        }
      } else {
        setTimeline([]);
      }
    } catch {
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [selectedService, selectedTimeRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

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
            <BarChart3 style={{ color: 'var(--accent)' }} size={20} />
            Metrics Explorer & Cross-Signal Exemplars
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Select an active service on the left to analyze requests, latencies, CPU, memory, and
            cross-signal exemplars.
          </p>
        </div>

        {/* Global Time Range Selector Toolbar & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '4px',
              padding: '2px',
              gap: '2px',
            }}
          >
            <Calendar
              size={13}
              style={{ color: 'var(--text-muted)', marginLeft: '6px', marginRight: '4px' }}
            />
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedTimeRange(range)}
                className="font-mono"
                style={{
                  padding: '3px 7px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: selectedTimeRange === range ? 700 : 500,
                  cursor: 'pointer',
                  backgroundColor:
                    selectedTimeRange === range ? 'var(--surface-container)' : 'transparent',
                  border: selectedTimeRange === range ? '1px solid var(--accent)' : 'none',
                  color: selectedTimeRange === range ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchMetrics}
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
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Metrics Grid */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Sidebar: Active Services List with Text Search */}
        <div
          className="glass-panel"
          style={{
            width: '260px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'var(--surface-low)',
            border: '1px solid var(--surface-border)',
            borderRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              ACTIVE SERVICES ({filteredServices.length})
            </span>
          </div>

          {/* Text Search Input */}
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Filter service..."
              className="font-mono"
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                backgroundColor: 'var(--bg-dark)',
                border: '1px solid var(--surface-border)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '11px',
              }}
            />
          </div>

          {/* Selectable Active Services List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredServices.map((service) => {
              const isSelected = selectedService === service.name;
              return (
                <button
                  key={service.name}
                  type="button"
                  onClick={() => {
                    setSelectedService(service.name);
                    setSelectedScope('ALL');
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    textAlign: 'left',
                    backgroundColor: isSelected ? 'var(--surface-container)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    border: isSelected
                      ? '1px solid var(--surface-border)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Cloud
                        size={12}
                        style={{ color: service.cloudProvider === 'gcp' ? '#4285F4' : '#FF9900' }}
                      />
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                      >
                        {service.name}
                      </span>
                    </div>

                    <span
                      className={`badge ${
                        service.status === 'critical'
                          ? 'badge-critical'
                          : service.status === 'warning'
                            ? 'badge-warning'
                            : 'badge-healthy'
                      }`}
                      style={{ fontSize: '9px', padding: '1px 5px' }}
                    >
                      {service.instanceCount} Inst
                    </span>
                  </div>

                  <span
                    className="font-mono"
                    style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                  >
                    {service.tech}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Panel: Scope Control Bar + Grid of 6 Specific Metrics Charts */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scope Control Bar (Aggregated vs Specific Instance) */}
          <div
            className="glass-panel"
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={16} style={{ color: 'var(--accent)' }} />
              <div>
                <h2
                  className="font-mono"
                  style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  {currentServiceObj?.name ?? 'No Service Selected'}
                </h2>
                <span
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  {currentServiceObj
                    ? `${currentServiceObj.cloudProvider.toUpperCase()} • ${currentServiceObj.tech} • ${currentServiceObj.instanceCount} Active Instances`
                    : 'Instrument applications or register services in Settings'}
                </span>
              </div>
            </div>

            {/* Scope Filter Selector: All vs Specific Instance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                SCOPE:
              </span>
              <button
                type="button"
                onClick={() => setSelectedScope('ALL')}
                className="font-mono"
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor:
                    selectedScope === 'ALL' ? 'var(--surface-container)' : 'transparent',
                  border:
                    selectedScope === 'ALL'
                      ? '1px solid var(--accent)'
                      : '1px solid var(--surface-border)',
                  color: selectedScope === 'ALL' ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                All (Aggregated)
              </button>

              {(currentServiceObj?.instances ?? []).map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => setSelectedScope(inst)}
                  className="font-mono"
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor:
                      selectedScope === inst ? 'var(--surface-container)' : 'transparent',
                    border:
                      selectedScope === inst
                        ? '1px solid var(--accent)'
                        : '1px solid var(--surface-border)',
                    color: selectedScope === inst ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>

          {/* Grid of 6 Specific Metrics Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Chart 1: Request Count (RPS) */}
            <div
              className="glass-panel"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} style={{ color: 'var(--accent)' }} />
                  <span
                    className="font-mono"
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    1. REQUEST COUNT (RPS)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-healthy" style={{ fontSize: '10px' }}>
                    {timeline[timeline.length - 1]?.rps ?? 0} req/s
                  </span>
                  <button
                    type="button"
                    onClick={() => setMaximizedChart('rps')}
                    title="Maximize Chart"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              <SvgLineChart
                height={140}
                timeline={timeline}
                series={[
                  { name: 'RPS Throughput', color: 'var(--accent)', getValue: (pt) => pt.rps },
                ]}
                yAxisMax={1000}
                unit=" req/s"
              />
            </div>

            {/* Chart 2: Request Latency (P50, P95, P99 Line Chart with Exemplars ❖) */}
            <div
              className="glass-panel"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} style={{ color: 'var(--status-critical)' }} />
                  <span
                    className="font-mono"
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    2. REQUEST LATENCY (P50, P95, P99)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    className="font-mono"
                    style={{ display: 'flex', gap: '6px', fontSize: '9px' }}
                  >
                    <span style={{ color: 'var(--status-healthy)' }}>● P50</span>
                    <span style={{ color: 'var(--status-warning)' }}>● P95</span>
                    <span style={{ color: 'var(--status-critical)' }}>● P99</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMaximizedChart('latency')}
                    title="Maximize Chart"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              <SvgLineChart
                height={140}
                timeline={timeline}
                series={[
                  { name: 'P50 Median', color: 'var(--status-healthy)', getValue: (pt) => pt.p50 },
                  { name: 'P95', color: 'var(--status-warning)', getValue: (pt) => pt.p95 },
                  {
                    name: 'P99 Outlier',
                    color: 'var(--status-critical)',
                    getValue: (pt) => pt.p99,
                  },
                ]}
                yAxisMax={350}
                unit="ms"
                showExemplars={true}
              />
            </div>

            {/* Chart 3: Active Instance Count */}
            <div
              className="glass-panel"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} style={{ color: 'var(--accent)' }} />
                  <span
                    className="font-mono"
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    3. ACTIVE INSTANCE COUNT
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-healthy" style={{ fontSize: '10px' }}>
                    {currentServiceObj?.instanceCount ?? 0} Replicas
                  </span>

                  <button
                    type="button"
                    onClick={() => setMaximizedChart('instances')}
                    title="Maximize Chart"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              <SvgLineChart
                height={140}
                timeline={timeline}
                series={[
                  {
                    name: 'Active Replicas',
                    color: '#4285F4',
                    getValue: (pt) => pt.instances,
                  },
                ]}
                yAxisMax={5}
                unit=" inst"
              />
            </div>

            {/* Chart 4: CPU Utilization per Instance (%) - Distinct Line Per Instance */}
            <div
              className="glass-panel"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu
                    size={14}
                    style={{
                      color:
                        (timeline[timeline.length - 1]?.cpuPercent ?? 0) > 80
                          ? 'var(--status-critical)'
                          : 'var(--accent)',
                    }}
                  />
                  <span
                    className="font-mono"
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    4. CPU UTILIZATION PER INSTANCE (%)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setMaximizedChart('cpu')}
                    title="Maximize Chart"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              <SvgLineChart
                height={140}
                timeline={timeline}
                series={(currentServiceObj?.instances ?? []).map((inst, idx) => ({
                  name: inst,
                  color: INSTANCE_COLORS[idx % INSTANCE_COLORS.length],
                  getValue: (pt) =>
                    pt.instanceMetrics.find((m) => m.instanceName === inst)?.cpuPercent ??
                    pt.cpuPercent,
                }))}
                yAxisMax={100}
                unit="%"
              />
            </div>

            {/* Chart 5: Memory Usage per Instance (MB) - Distinct Line Per Instance */}
            <div
              className="glass-panel"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HardDrive size={14} style={{ color: 'var(--accent)' }} />
                  <span
                    className="font-mono"
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    5. MEMORY USAGE PER INSTANCE (MB)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setMaximizedChart('memory')}
                    title="Maximize Chart"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              <SvgLineChart
                height={140}
                timeline={timeline}
                series={(currentServiceObj?.instances ?? []).map((inst, idx) => ({
                  name: inst,
                  color: INSTANCE_COLORS[idx % INSTANCE_COLORS.length],
                  getValue: (pt) =>
                    pt.instanceMetrics.find((m) => m.instanceName === inst)?.memoryMb ??
                    pt.memoryMb,
                }))}
                yAxisMax={500}
                unit=" MB"
              />
            </div>

            {/* Chart 6: Max Concurrent Requests */}
            <div
              className="glass-panel"
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} style={{ color: 'var(--accent)' }} />
                  <span
                    className="font-mono"
                    style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    6. MAX CONCURRENT REQUESTS
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-healthy" style={{ fontSize: '10px' }}>
                    {timeline[timeline.length - 1]?.maxConcurrent ?? 0} Active
                  </span>
                  <button
                    type="button"
                    onClick={() => setMaximizedChart('concurrency')}
                    title="Maximize Chart"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={13} />
                  </button>
                </div>
              </div>

              <SvgLineChart
                height={140}
                timeline={timeline}
                series={[
                  {
                    name: 'Max Concurrent',
                    color: 'var(--accent)',
                    getValue: (pt) => pt.maxConcurrent,
                  },
                ]}
                yAxisMax={70}
                unit=" req"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Maximized Chart Modal Dialog Overlay */}
      {maximizedChart && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '940px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              backgroundColor: 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}
                >
                  MAXIMIZED METRIC VIEW • {(currentServiceObj?.name ?? 'SERVICE').toUpperCase()} (
                  {selectedScope})
                </span>
                <h2
                  className="font-mono"
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                >
                  {maximizedChart === 'rps'
                    ? '1. REQUEST COUNT (RPS THROUGHPUT)'
                    : maximizedChart === 'latency'
                      ? '2. REQUEST LATENCY PERCENTILES & CROSS-SIGNAL EXEMPLARS'
                      : maximizedChart === 'instances'
                        ? '3. ACTIVE INSTANCE REPLICA COUNT'
                        : maximizedChart === 'cpu'
                          ? '4. CPU UTILIZATION PER INSTANCE (%)'
                          : maximizedChart === 'memory'
                            ? '5. MEMORY USAGE PER INSTANCE (MB)'
                            : '6. MAX CONCURRENT ACTIVE REQUESTS'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMaximizedChart(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <Minimize2 size={20} />
              </button>
            </div>

            {/* Time Range Selector inside Maximized Modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                TIME RANGE:
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-dark)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '4px',
                  padding: '2px',
                  gap: '2px',
                }}
              >
                {TIME_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSelectedTimeRange(range)}
                    className="font-mono"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: selectedTimeRange === range ? 700 : 500,
                      cursor: 'pointer',
                      backgroundColor:
                        selectedTimeRange === range ? 'var(--surface-container)' : 'transparent',
                      border: selectedTimeRange === range ? '1px solid var(--accent)' : 'none',
                      color: selectedTimeRange === range ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* High Resolution Line Chart Visualization (280px height) */}
            <SvgLineChart
              height={280}
              timeline={timeline}
              series={
                maximizedChart === 'rps'
                  ? [{ name: 'RPS Throughput', color: 'var(--accent)', getValue: (pt) => pt.rps }]
                  : maximizedChart === 'latency'
                    ? [
                        {
                          name: 'P50 Median',
                          color: 'var(--status-healthy)',
                          getValue: (pt) => pt.p50,
                        },
                        { name: 'P95', color: 'var(--status-warning)', getValue: (pt) => pt.p95 },
                        {
                          name: 'P99 Outlier',
                          color: 'var(--status-critical)',
                          getValue: (pt) => pt.p99,
                        },
                      ]
                    : maximizedChart === 'instances'
                      ? [
                          {
                            name: 'Active Replicas',
                            color: '#4285F4',
                            getValue: (pt) => pt.instances,
                          },
                        ]
                      : maximizedChart === 'cpu'
                        ? (currentServiceObj?.instances ?? []).map((inst, idx) => ({
                            name: inst,
                            color: INSTANCE_COLORS[idx % INSTANCE_COLORS.length],
                            getValue: (pt) =>
                              pt.instanceMetrics.find((m) => m.instanceName === inst)?.cpuPercent ??
                              pt.cpuPercent,
                          }))
                        : maximizedChart === 'memory'
                          ? (currentServiceObj?.instances ?? []).map((inst, idx) => ({
                              name: inst,
                              color: INSTANCE_COLORS[idx % INSTANCE_COLORS.length],
                              getValue: (pt) =>
                                pt.instanceMetrics.find((m) => m.instanceName === inst)?.memoryMb ??
                                pt.memoryMb,
                            }))
                          : [
                              {
                                name: 'Max Concurrent',
                                color: 'var(--accent)',
                                getValue: (pt) => pt.maxConcurrent,
                              },
                            ]
              }
              yAxisMax={
                maximizedChart === 'rps'
                  ? 1000
                  : maximizedChart === 'latency'
                    ? 350
                    : maximizedChart === 'instances'
                      ? 5
                      : maximizedChart === 'cpu'
                        ? 100
                        : maximizedChart === 'memory'
                          ? 500
                          : 70
              }
              unit={
                maximizedChart === 'rps'
                  ? ' req/s'
                  : maximizedChart === 'latency'
                    ? 'ms'
                    : maximizedChart === 'instances'
                      ? ' inst'
                      : maximizedChart === 'cpu'
                        ? '%'
                        : maximizedChart === 'memory'
                          ? ' MB'
                          : ' req'
              }
              showExemplars={maximizedChart === 'latency'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MetricsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading Metrics...</div>
      }
    >
      <MetricsContent />
    </Suspense>
  );
}
