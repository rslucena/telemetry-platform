'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  Calendar,
  Clock,
  Cloud,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  HardDrive,
  Layers,
  RefreshCw,
  Search,
  Server,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const TIME_RANGES = ['Today', '15m', '30m', '1h', '6h', '12h', '2d', '6d', '15d', '30d'] as const;

interface ActiveService {
  name: string;
  cloudProvider: 'gcp' | 'aws';
  tech: string;
  instanceCount: number;
  instances: string[];
  status: 'healthy' | 'warning' | 'critical';
}

const ACTIVE_SERVICES: ActiveService[] = [];

interface FlameNode {
  id?: string;
  name: string;
  value?: number;
  fileLocation?: string;
  cpuPercent?: number;
  durationMs?: number;
  category?: 'app' | 'db' | 'network' | 'gc' | 'crypto';
  exemplarTraceId?: string;
  children?: FlameNode[];
}

function FlameBlock({
  node,
  filterSearch,
  parentValue,
  depth = 0,
}: {
  node: FlameNode;
  filterSearch: string;
  parentValue?: number;
  depth?: number;
}) {
  const isMatched =
    filterSearch.trim().length > 0 && node.name.toLowerCase().includes(filterSearch.toLowerCase());

  // 1. Resolver valor / duração / amostragem
  const val = typeof node.durationMs === 'number' ? node.durationMs : (node.value ?? 0);

  // 2. Resolver porcentagem de CPU / Memória
  let computedPercent = node.cpuPercent;
  if (typeof computedPercent !== 'number') {
    if (parentValue && parentValue > 0) {
      computedPercent = Math.round((val / parentValue) * 100);
    } else {
      computedPercent = 100;
    }
  }
  const displayPercent = Math.max(1, Math.min(100, computedPercent));

  // 3. Inferir categoria com base no nome da função se não estiver definida
  const inferCategory = (
    name: string,
    cat?: string,
  ): 'app' | 'db' | 'network' | 'gc' | 'crypto' => {
    if (cat === 'app' || cat === 'db' || cat === 'network' || cat === 'gc' || cat === 'crypto') {
      return cat;
    }
    const lower = name.toLowerCase();
    if (
      lower.includes('db') ||
      lower.includes('postgres') ||
      lower.includes('redis') ||
      lower.includes('query') ||
      lower.includes('sql') ||
      lower.includes('repository')
    ) {
      return 'db';
    }
    if (
      lower.includes('gc') ||
      lower.includes('v8') ||
      lower.includes('heap') ||
      lower.includes('memory') ||
      lower.includes('runtime')
    ) {
      return 'gc';
    }
    if (
      lower.includes('crypto') ||
      lower.includes('jwt') ||
      lower.includes('auth') ||
      lower.includes('token') ||
      lower.includes('hash')
    ) {
      return 'crypto';
    }
    if (
      lower.includes('express') ||
      lower.includes('http') ||
      lower.includes('fetch') ||
      lower.includes('request') ||
      lower.includes('response') ||
      lower.includes('handler') ||
      lower.includes('api')
    ) {
      return 'network';
    }
    return 'app';
  };

  const category = inferCategory(node.name, node.category);

  // Paleta vibrante e harmoniosa por categoria e profundidade de nível
  const getCategoryColor = (cat: string, isMatch: boolean, d: number) => {
    if (isMatch) return 'var(--accent)';
    switch (cat) {
      case 'app':
        return d % 2 === 0 ? '#E53935' : '#D81B60'; // Magenta / Coral
      case 'db':
        return d % 2 === 0 ? '#1E88E5' : '#0288D1'; // Azul Elétrico / Ciano
      case 'network':
        return d % 2 === 0 ? '#FB8C00' : '#F57C00'; // Âmbar / Laranja Quente
      case 'crypto':
        return d % 2 === 0 ? '#8E24AA' : '#7B1FA2'; // Roxo Intenso
      case 'gc':
        return d % 2 === 0 ? '#43A047' : '#388E3C'; // Verde Esmeralda
      default:
        return d % 2 === 0 ? '#E53935' : '#D81B60';
    }
  };

  const bg = getCategoryColor(category, isMatched, depth);
  const locationText = node.fileLocation ? `(${node.fileLocation})` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <div
        className="glass-panel font-mono"
        style={{
          width: `${Math.max(displayPercent, 8)}%`,
          backgroundColor: bg,
          color: isMatched ? '#00285d' : '#ffffff',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: isMatched ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
          boxShadow: isMatched ? '0 0 12px rgba(173, 198, 255, 0.8)' : 'none',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {node.name}
          </span>
          {locationText && (
            <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 400 }}>{locationText}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>
            {displayPercent}% ({val > 0 ? val : '<1'}ms)
          </span>
          {node.exemplarTraceId && (
            <Link
              href={`/traces?traceId=${node.exemplarTraceId}`}
              title={`Trace Exemplar: ${node.exemplarTraceId}`}
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>❖ Trace</span>
              <ExternalLink size={9} />
            </Link>
          )}
        </div>
      </div>

      {node.children && node.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '16px' }}>
          {node.children.map((child, idx) => (
            <FlameBlock
              key={child.id ? `${child.id}-${idx}` : `child-${idx}`}
              node={child}
              filterSearch={filterSearch}
              parentValue={val > 0 ? val : parentValue}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfilingContent() {
  const { cloudFilter, lastRefreshedAt } = useTelemetry();
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get('serviceName') || '';
  const traceIdParam = searchParams.get('traceId') || '';

  const [servicesList, setServicesList] = useState<ActiveService[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [functionSearch, setFunctionSearch] = useState('');
  const [traceIdFilter, setTraceIdFilter] = useState(traceIdParam);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
  const [profileType, setProfileType] = useState<'cpu' | 'memory'>('cpu');
  const [profileNodes, setProfileNodes] = useState<FlameNode[]>([]);
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

  const currentProfileNodes = profileNodes;

  const fetchProfile = useCallback(async () => {
    if (!selectedService) return;
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:4000/api/v1/profiles?serviceName=${selectedService}&profileType=${profileType}&timeRange=${selectedTimeRange}`,
      );
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const latest = json.data[0];
          let parsedData: FlameNode[] = [];
          if (latest.flamegraphDataJson) {
            try {
              const parsed = JSON.parse(latest.flamegraphDataJson);
              parsedData = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              parsedData = [];
            }
          }
          setProfileNodes(parsedData);
        } else {
          setProfileNodes([]);
        }
      } else {
        setProfileNodes([]);
      }
    } catch {
      setProfileNodes([]);
    } finally {
      setLoading(false);
    }
  }, [selectedService, profileType, selectedTimeRange]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastRefreshedAt triggers manual refresh
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, lastRefreshedAt]);

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
            <Flame style={{ color: 'var(--status-critical)' }} size={20} />
            Continuous Profiling & Flame Graphs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Analyze CPU call stacks and heap memory hot spots aggregated by service or correlated to
            a specific request.
          </p>
        </div>

        {/* Controls: Trace ID Filter + CPU/Memory Toggle + Time Range + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Correlated Trace ID Filter Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={traceIdFilter}
              onChange={(e) => setTraceIdFilter(e.target.value)}
              placeholder="Correlate Trace ID..."
              className="font-mono"
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                backgroundColor: 'var(--bg-dark)',
                border: traceIdFilter
                  ? '1px solid var(--accent)'
                  : '1px solid var(--surface-border)',
                borderRadius: '4px',
                color: traceIdFilter ? 'var(--accent)' : 'var(--text-primary)',
                outline: 'none',
                fontSize: '11px',
              }}
            />
          </div>

          {/* Profile Type Toggle */}

          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '4px',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setProfileType('cpu')}
              className="font-mono"
              style={{
                padding: '4px 10px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor: profileType === 'cpu' ? 'var(--surface-container)' : 'transparent',
                color: profileType === 'cpu' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              CPU Execution
            </button>
            <button
              type="button"
              onClick={() => setProfileType('memory')}
              className="font-mono"
              style={{
                padding: '4px 10px',
                borderRadius: '3px',
                border: 'none',
                backgroundColor:
                  profileType === 'memory' ? 'var(--surface-container)' : 'transparent',
                color: profileType === 'memory' ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Heap Memory
            </button>
          </div>

          {/* Time Range Selector */}
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
            onClick={fetchProfile}
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
            <span>Sync Profile</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Flame Graph View */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Sidebar: Active Services List */}
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

        {/* Right Main Panel: Scope Bar + Flame Graph Visualization */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scope Bar */}
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

            {/* Instance Scope Buttons */}
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

          {/* Correlated Trace ID Notification Card (When active) */}
          {traceIdFilter && (
            <div
              className="glass-panel font-mono"
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(173, 198, 255, 0.1)',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                  PER-REQUEST MODE
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Filtering Flame Graph to exact execution path of Trace ID: {traceIdFilter}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTraceIdFilter('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  textDecoration: 'underline',
                }}
              >
                Clear Filter (Back to Aggregated)
              </button>
            </div>
          )}

          {/* Flame Graph Container */}
          <div
            className="glass-panel"
            style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3
                  className="font-mono"
                  style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  FLAME GRAPH CALL STACK VIEW ({profileType.toUpperCase()})
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Width represents CPU execution time % or heap memory allocation volume.
                </p>
              </div>

              {/* Function Search Filter inside Flame Graph */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search
                  size={13}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '8px',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  value={functionSearch}
                  onChange={(e) => setFunctionSearch(e.target.value)}
                  placeholder="Highlight function..."
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
            </div>

            {/* Flame Stack Visualization */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: 'var(--bg-dark)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
              }}
            >
              {loading ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 24px',
                    gap: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <RefreshCw
                    size={24}
                    className="animate-spin"
                    style={{ color: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    Buscando amostras de profiling ({profileType.toUpperCase()}) para "
                    {selectedService}"...
                  </span>
                </div>
              ) : currentProfileNodes.length > 0 ? (
                currentProfileNodes.map((rootNode, idx) => (
                  <FlameBlock
                    key={rootNode.id ? `${rootNode.id}-${idx}` : `root-${idx}`}
                    node={rootNode}
                    filterSearch={functionSearch}
                  />
                ))
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 24px',
                    textAlign: 'center',
                    gap: '12px',
                  }}
                >
                  <Flame size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Nenhuma informação de profiling disponível para "
                    {selectedService || 'o serviço selecionado'}"
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      maxWidth: '520px',
                      lineHeight: 1.5,
                    }}
                  >
                    Aguardando ou processando telemetrias enviadas pelo agente APM ou microsserviços
                    na janela de tempo (
                    <strong style={{ color: 'var(--accent)' }}>{selectedTimeRange}</strong>).
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading Profiling...</div>
      }
    >
      <ProfilingContent />
    </Suspense>
  );
}
