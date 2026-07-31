'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import type { ServiceNode } from '@telemetry/types';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Cloud,
  Cpu,
  ExternalLink,
  FileText,
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

function ServicesContent() {
  const { cloudFilter, environmentFilter, lastRefreshedAt } = useTelemetry();
  const searchParams = useSearchParams();
  const nameParam = searchParams.get('name');

  const [services, setServices] = useState<ServiceNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceNode | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/services');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          setServices(json.data);
        }
      }
    } catch {
      // Backend offline — estado vazio, aguardando conexão
    } finally {
      setLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastRefreshedAt triggers manual refresh
  useEffect(() => {
    fetchServices();
  }, [fetchServices, lastRefreshedAt]);

  // Sincronizar o serviço selecionado pelo parâmetro da URL ?name=
  useEffect(() => {
    if (nameParam && services.length > 0) {
      const found = services.find((s) => s.name.toLowerCase() === nameParam.toLowerCase());
      if (found) {
        setSelectedService(found);
      }
    }
  }, [nameParam, services]);

  const filteredServices = services.filter((svc) => {
    const matchesSearch =
      svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(svc.cloudPlatform?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCloud =
      cloudFilter === 'all' ||
      !svc.cloudProvider ||
      svc.cloudProvider.toLowerCase() === cloudFilter ||
      (cloudFilter === 'gcp' && svc.cloudProvider === 'local');

    const matchesEnv =
      !environmentFilter ||
      (environmentFilter as string) === 'all' ||
      svc.environment.toLowerCase() === environmentFilter.toLowerCase() ||
      svc.environment === 'development' ||
      svc.environment === 'production';

    return matchesSearch && matchesCloud && matchesEnv;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
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
            <Layers style={{ color: 'var(--accent)' }} size={20} />
            Service Catalog & Multicloud Workloads
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Discover and monitor all microservices and serverless functions deployed across GCP and
            AWS.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchServices}
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
          <span>Refresh Catalog</span>
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
            placeholder="Filter services by name or platform..."
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

        <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredServices.length}</strong> of {services.length} services
        </div>
      </div>

      {/* Services Table & Layout Main Container */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div className="glass-panel" style={{ flex: 1, overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
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
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>SERVICE NAME</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>CLOUD & REGION</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>PLATFORM</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>VERSION</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>RPS</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>ERROR RATE</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>P95 LATENCY</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>LIFECYCLE</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}
                  >
                    No services match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => {
                  const isHealthy = svc.status === 'healthy';
                  const isCritical = svc.status === 'critical';
                  const isScaledToZero = svc.lifecycleState === 'scaled-to-zero';
                  const isSelected = selectedService?.id === svc.id;

                  return (
                    <tr
                      key={svc.id}
                      onClick={() => setSelectedService(svc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedService(svc);
                        }
                      }}
                      tabIndex={0}
                      style={{
                        borderBottom: '1px solid var(--surface-border)',
                        backgroundColor: isSelected ? 'var(--surface-container)' : 'transparent',
                        borderLeft: isSelected
                          ? '3px solid var(--accent)'
                          : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: isCritical
                                ? 'var(--status-critical)'
                                : isHealthy
                                  ? 'var(--status-healthy)'
                                  : 'var(--status-degraded)',
                            }}
                          />
                          <span
                            className="font-mono"
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                            }}
                          >
                            {svc.name}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        <div
                          className="font-mono"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            textTransform: 'uppercase',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}
                        >
                          <Cloud
                            size={13}
                            style={{ color: svc.cloudProvider === 'gcp' ? '#4285F4' : '#FF9900' }}
                          />
                          <span>{svc.cloudProvider || 'local'}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            ({svc.cloudRegion || 'us-central1'})
                          </span>
                        </div>
                      </td>

                      <td
                        className="font-mono"
                        style={{
                          padding: '10px 14px',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                        }}
                      >
                        {svc.cloudPlatform || 'k8s'}
                      </td>

                      <td
                        className="font-mono"
                        style={{
                          padding: '10px 14px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {svc.version}
                      </td>

                      <td
                        className="font-mono"
                        style={{
                          padding: '10px 14px',
                          fontWeight: 600,
                          fontSize: '12px',
                        }}
                      >
                        {svc.metricsSummary?.rps.toFixed(1) || '0.0'}
                      </td>

                      <td
                        className="font-mono"
                        style={{
                          padding: '10px 14px',
                          fontSize: '12px',
                          color:
                            (svc.metricsSummary?.errorRate || 0) > 1
                              ? 'var(--status-critical)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {(svc.metricsSummary?.errorRate || 0).toFixed(2)}%
                      </td>

                      <td className="font-mono" style={{ padding: '10px 14px', fontSize: '12px' }}>
                        {svc.metricsSummary?.p95LatencyMs
                          ? `${svc.metricsSummary.p95LatencyMs.toFixed(1)}ms`
                          : '0ms'}
                      </td>

                      <td style={{ padding: '10px 14px' }}>
                        {isScaledToZero ? (
                          <span className="badge badge-unknown">
                            <Zap size={10} /> Scaled to Zero
                          </span>
                        ) : (
                          <span className="badge badge-healthy">
                            <Server size={10} /> {svc.instanceCount || 1} Instances
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <Link
                          href={`/traces?serviceName=${svc.name}`}
                          className="font-mono"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent)',
                            fontWeight: 500,
                          }}
                        >
                          View Traces →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Service Details Drawer Panel */}
        {selectedService && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor:
                      selectedService.status === 'critical'
                        ? 'var(--status-critical)'
                        : selectedService.status === 'healthy'
                          ? 'var(--status-healthy)'
                          : 'var(--status-degraded)',
                  }}
                />
                <h2
                  className="font-mono"
                  style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  {selectedService.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
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
              <span className="badge badge-healthy">
                {selectedService.cloudProvider?.toUpperCase() || 'LOCAL'} (
                {selectedService.cloudRegion})
              </span>
              <span className="badge badge-unknown">{selectedService.cloudPlatform}</span>
              <span className="badge badge-healthy">{selectedService.environment}</span>
            </div>

            {/* RED Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-dark)',
                  borderRadius: '4px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  THROUGHPUT
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    marginTop: '2px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {selectedService.metricsSummary?.rps.toFixed(1) || '0.0'} RPS
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-dark)',
                  borderRadius: '4px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  P95 LATENCY
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    marginTop: '2px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {selectedService.metricsSummary?.p95LatencyMs.toFixed(1) || '0.0'} ms
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-dark)',
                  borderRadius: '4px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  ERROR RATE
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    marginTop: '2px',
                    color:
                      (selectedService.metricsSummary?.errorRate || 0) > 1
                        ? 'var(--status-critical)'
                        : 'var(--text-primary)',
                  }}
                >
                  {(selectedService.metricsSummary?.errorRate || 0).toFixed(2)}%
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-dark)',
                  borderRadius: '4px',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  INSTANCES
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    marginTop: '2px',
                    color: 'var(--text-primary)',
                  }}
                >
                  {selectedService.instanceCount || 1}
                </div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <Link
                href={`/traces?serviceName=${selectedService.name}`}
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={14} /> Correlated Traces
                </span>
                <ArrowRight size={14} />
              </Link>

              <Link
                href={`/logs?searchQuery=${selectedService.name}`}
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Service Logs
                </span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
          Loading Service Catalog...
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}
