'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Cloud,
  ExternalLink,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const TIME_RANGES = ['Today', '15m', '30m', '1h', '6h', '12h', '2d', '6d', '15d', '30d'] as const;

interface ActiveService {
  id: string; // ID Service Key (UUID v4)
  name: string;
  githubUrl: string;
  cloudProvider: 'gcp' | 'aws';
  tech: string;
  instanceCount: number;
  instances: string[];
  status: 'healthy' | 'warning' | 'critical';
}

export interface SLOItem {
  id: string;
  serviceId: string;
  serviceName: string;
  githubUrl: string;
  name: string;
  cloudProvider: 'gcp' | 'aws';
  objective: number;
  currentSLI: number;
  errorBudgetRemaining: number;
  burnRate: number;
  indicatorType: 'availability' | 'latency' | 'error_rate' | 'custom_metric' | 'error-rate';
  thresholdMs?: number;
  correlatedTraceId?: string;
  status: 'healthy' | 'at-risk' | 'breached';
}

const ACTIVE_SERVICES: ActiveService[] = [];
const INITIAL_SLOS: SLOItem[] = [];

function BurnRateBar({ rate, status }: { rate: number; status: SLOItem['status'] }) {
  const max = 15;
  const pct = Math.min((rate / max) * 100, 100);
  const color =
    status === 'healthy'
      ? 'var(--status-healthy)'
      : status === 'at-risk'
        ? 'var(--status-warning)'
        : 'var(--status-critical)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          flex: 1,
          height: '6px',
          backgroundColor: 'var(--bg-dark)',
          borderRadius: '4px',
          overflow: 'hidden',
          border: '1px solid var(--surface-border)',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: '4px',
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span
        className="font-mono"
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color,
          minWidth: '40px',
          textAlign: 'right',
        }}
      >
        {rate}×
      </span>
    </div>
  );
}

function SLOsContent() {
  const { cloudFilter, lastRefreshedAt } = useTelemetry();
  const searchParams = useSearchParams();
  const serviceParam = searchParams.get('serviceName') || '';

  const [servicesList, setServicesList] = useState<ActiveService[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedScope, setSelectedScope] = useState<string>('ALL');
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('1h');
  const [slos, setSlos] = useState<SLOItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State for + Create New SLO Modal
  const [formServiceId, setFormServiceId] = useState('');
  const [formSloName, setFormSloName] = useState('');
  const [formIndicatorType, setFormIndicatorType] = useState<
    'availability' | 'latency' | 'error_rate' | 'custom_metric'
  >('availability');
  const [formObjective, setFormObjective] = useState('99.9');
  const [formThresholdMs, setFormThresholdMs] = useState('200');
  const [formMetricName, setFormMetricName] = useState('redis.cache.hit_ratio');

  const fetchServicesAndSLOs = useCallback(async () => {
    setLoading(true);
    let fetchedServicesList: ActiveService[] = [];
    try {
      const resSvc = await fetch('http://localhost:4000/api/v1/settings/services');
      if (resSvc.ok) {
        const jsonSvc = await resSvc.json();
        if (jsonSvc.data && Array.isArray(jsonSvc.data)) {
          fetchedServicesList = jsonSvc.data.map((s: Record<string, unknown>, i: number) => ({
            id: String(s.id ?? `srv-${i}`),
            name: String(s.name ?? `service-${i}`),
            githubUrl: String(s.githubUrl ?? s.github_url ?? 'https://github.com/company/service'),
            cloudProvider: (s.cloudProvider === 'aws' ? 'aws' : 'gcp') as 'gcp' | 'aws',
            tech: String(s.environment ?? 'Cloud Run'),
            instanceCount: Number(s.instanceCount ?? 1),
            instances: ['inst-01'],
            status: (s.status === 'deactivated'
              ? 'critical'
              : 'healthy') as ActiveService['status'],
          }));
          setServicesList(fetchedServicesList);
          if (fetchedServicesList.length > 0 && !selectedServiceId) {
            const initialId =
              fetchedServicesList.find((s) => s.name === serviceParam)?.id ??
              fetchedServicesList[0].id;
            setSelectedServiceId(initialId);
            setFormServiceId(initialId);
          }
        }
      }

      const resSlo = await fetch('http://localhost:4000/api/v1/slos');
      if (resSlo.ok) {
        const jsonSlo = await resSlo.json();
        if (jsonSlo.data && Array.isArray(jsonSlo.data)) {
          const mappedSlos: SLOItem[] = jsonSlo.data.map(
            (r: Record<string, unknown>, i: number) => {
              const svcName = String(r.serviceName ?? r.service_name ?? 'unknown');
              const matchedSvc = fetchedServicesList.find(
                (s) => s.name === svcName || s.id === svcName,
              );
              const sloStatusRaw = String(r.status ?? 'healthy');
              const status: SLOItem['status'] =
                sloStatusRaw === 'breached'
                  ? 'breached'
                  : sloStatusRaw === 'warning' || sloStatusRaw === 'at-risk'
                    ? 'at-risk'
                    : 'healthy';

              return {
                id: String(r.id ?? r.sloId ?? `slo-${i}`),
                serviceId: String(matchedSvc?.id ?? svcName),
                serviceName: svcName,
                githubUrl: String(matchedSvc?.githubUrl ?? 'https://github.com/company/service'),
                name: String(r.name ?? r.sloName ?? `SLO Rule ${i}`),
                cloudProvider: (matchedSvc?.cloudProvider === 'aws' ? 'aws' : 'gcp') as
                  | 'gcp'
                  | 'aws',
                objective: Number(r.objective ?? r.targetPercentage ?? 99.9),
                currentSLI: Number(r.currentSLI ?? r.sliValue ?? 100),
                errorBudgetRemaining: Number(
                  r.errorBudgetRemaining ?? r.error_budget_remaining ?? 100,
                ),
                burnRate: Number(r.burnRate ?? r.burn_rate ?? 0),
                indicatorType: (r.indicatorType ??
                  r.indicator_type ??
                  'availability') as SLOItem['indicatorType'],
                thresholdMs: r.thresholdMs ? Number(r.thresholdMs) : undefined,
                status,
              };
            },
          );
          setSlos(mappedSlos);
        }
      }
    } catch {
      setServicesList([]);
      setSlos([]);
    } finally {
      setLoading(false);
    }
  }, [selectedServiceId, serviceParam]);

  useEffect(() => {
    fetchServicesAndSLOs();
  }, [fetchServicesAndSLOs]);

  const currentServiceObj = servicesList.find((s) => s.id === selectedServiceId) ?? servicesList[0];

  const filteredServices = servicesList.filter(
    (s) =>
      (cloudFilter === 'all' || s.cloudProvider === cloudFilter) &&
      (s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.id.toLowerCase().includes(serviceSearch.toLowerCase())),
  );

  const activeSLOs = currentServiceObj
    ? slos.filter(
        (s) =>
          s.serviceId === currentServiceObj.id ||
          s.serviceName === currentServiceObj.name ||
          s.serviceId === currentServiceObj.name,
      )
    : slos;

  const counts = {
    healthy: slos.filter((s) => s.status === 'healthy').length,
    atRisk: slos.filter((s) => s.status === 'at-risk').length,
    breached: slos.filter((s) => s.status === 'breached').length,
  };

  const handleCreateSLO = async (e: React.FormEvent) => {
    e.preventDefault();
    const svc =
      servicesList.find((s) => s.id === formServiceId || s.name === formServiceId) ??
      servicesList[0];
    if (!svc) return;

    const targetObjective = Number(formObjective) || 99.9;
    const thresholdMs = formIndicatorType === 'latency' ? Number(formThresholdMs) : undefined;

    const newSloPayload = {
      id: `slo-${Date.now()}`,
      name: formSloName || 'Custom SLO Rule',
      serviceName: svc.name,
      targetPercentage: targetObjective,
      windowPeriodDays: 30,
      indicatorType: formIndicatorType,
      thresholdMs,
    };

    try {
      await fetch('http://localhost:4000/api/v1/slos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSloPayload),
      });
    } catch {
      // Backend offline fallback
    }

    const newSloItem: SLOItem = {
      id: newSloPayload.id,
      serviceId: svc.id,
      serviceName: svc.name,
      githubUrl: svc.githubUrl,
      name: newSloPayload.name,
      cloudProvider: svc.cloudProvider,
      objective: targetObjective,
      currentSLI: targetObjective,
      errorBudgetRemaining: 100,
      burnRate: 0.0,
      indicatorType: formIndicatorType,
      thresholdMs,
      status: 'healthy',
    };

    setSlos((prev) => [newSloItem, ...prev]);
    setShowCreateModal(false);
    setFormSloName('');
  };

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
            <ShieldAlert style={{ color: 'var(--accent)' }} size={20} />
            SLO Dashboard & Error Budget Tracker
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Select an active service by its immutable ID Service Key (UUID) to monitor SLOs and
            Error Budgets.
          </p>
        </div>

        {/* Controls: + Create New SLO + Time Range + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--accent)',
              border: 'none',
              color: '#00285d',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <Plus size={14} />
            <span>Create New SLO</span>
          </button>

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
            onClick={fetchServicesAndSLOs}
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

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          {
            label: 'Healthy SLOs',
            count: counts.healthy,
            color: 'var(--status-healthy)',
            Icon: CheckCircle2,
          },
          {
            label: 'At Risk SLOs',
            count: counts.atRisk,
            color: 'var(--status-warning)',
            Icon: TrendingUp,
          },
          {
            label: 'Breached SLOs',
            count: counts.breached,
            color: 'var(--status-critical)',
            Icon: AlertTriangle,
          },
        ].map(({ label, count, color, Icon }) => (
          <div
            key={label}
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <Icon style={{ color, flexShrink: 0 }} size={24} />
            <div>
              <div className="font-mono" style={{ fontSize: '24px', fontWeight: 800, color }}>
                {count}
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Layout: Left Sidebar + Right SLO View */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Sidebar: Active Services List with ID Service Key UUID */}
        <div
          className="glass-panel"
          style={{
            width: '280px',
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

          {/* Text Search Input (Searches Name & ID Service Key UUID) */}
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Search Name or UUID..."
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
              const isSelected = selectedServiceId === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.id);
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

                  {/* ID Service Key UUID Badge & GitHub Repository Link */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '2px',
                    }}
                  >
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '9px',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-dark)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        border: '1px solid var(--surface-border)',
                      }}
                    >
                      {service.id.slice(0, 14)}...
                    </span>

                    <a
                      href={service.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono"
                      style={{
                        fontSize: '9px',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        textDecoration: 'none',
                      }}
                    >
                      <span>GitHub</span>
                      <ExternalLink size={9} />
                    </a>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Panel: Scope Bar + Service Metadata Header + SLO Table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scope & Service Metadata Header Bar */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2
                    className="font-mono"
                    style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    {currentServiceObj?.name ?? 'No Service Selected'}
                  </h2>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '10px',
                      color: 'var(--accent)',
                      backgroundColor: 'var(--bg-dark)',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      border: '1px solid var(--surface-border)',
                    }}
                  >
                    {currentServiceObj ? currentServiceObj.id : 'No Key'}
                  </span>
                  {currentServiceObj && (
                    <a
                      href={currentServiceObj.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        textDecoration: 'none',
                      }}
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    {currentServiceObj
                      ? `${currentServiceObj.cloudProvider.toUpperCase()} • ${currentServiceObj.tech} • ${currentServiceObj.instanceCount} Active Instances`
                      : 'Instrument applications or register services in Settings'}
                  </span>
                  {currentServiceObj && (
                    <a
                      href={currentServiceObj.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono"
                      style={{
                        fontSize: '11px',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        textDecoration: 'none',
                      }}
                    >
                      <span>GitHub Repository</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Instance Scope Selector */}
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

          {/* SLO Table Card */}
          <div className="glass-panel" style={{ overflow: 'hidden', padding: '0' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '12px',
              }}
            >
              <thead>
                <tr
                  className="font-mono"
                  style={{
                    borderBottom: '1px solid var(--surface-border)',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>SLO NAME</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '110px' }}>TARGET</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '110px' }}>
                    CURRENT SLI
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '180px' }}>
                    ERROR BUDGET REMAINING
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '160px' }}>
                    BURN RATE
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      fontWeight: 600,
                      width: '110px',
                      textAlign: 'center',
                    }}
                  >
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSLOs.map((slo) => {
                  const budgetColor =
                    slo.errorBudgetRemaining === 0
                      ? 'var(--status-critical)'
                      : slo.errorBudgetRemaining < 30
                        ? 'var(--status-warning)'
                        : 'var(--status-healthy)';

                  return (
                    <tr key={slo.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            className="font-mono"
                            style={{ fontWeight: 700, color: 'var(--text-primary)' }}
                          >
                            {slo.name}
                          </span>
                          {slo.correlatedTraceId && (
                            <Link
                              href={`/traces?traceId=${slo.correlatedTraceId}`}
                              className="font-mono"
                              style={{
                                fontSize: '10px',
                                color: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                textDecoration: 'none',
                              }}
                            >
                              <span>
                                ❖ Correlated Trace: {slo.correlatedTraceId.slice(0, 8)}...
                              </span>
                              <ExternalLink size={9} />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td
                        className="font-mono"
                        style={{
                          padding: '14px 16px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {slo.objective}%
                      </td>
                      <td
                        className="font-mono"
                        style={{
                          padding: '14px 16px',
                          fontWeight: 700,
                          color:
                            slo.currentSLI >= slo.objective
                              ? 'var(--status-healthy)'
                              : 'var(--status-critical)',
                        }}
                      >
                        {slo.currentSLI}%
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              flex: 1,
                              height: '6px',
                              backgroundColor: 'var(--bg-dark)',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              border: '1px solid var(--surface-border)',
                            }}
                          >
                            <div
                              style={{
                                width: `${slo.errorBudgetRemaining}%`,
                                height: '100%',
                                backgroundColor: budgetColor,
                                borderRadius: '4px',
                              }}
                            />
                          </div>
                          <span
                            className="font-mono"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: budgetColor,
                              minWidth: '40px',
                              textAlign: 'right',
                            }}
                          >
                            {slo.errorBudgetRemaining}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <BurnRateBar rate={slo.burnRate} status={slo.status} />
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span
                          className={`badge ${
                            slo.status === 'healthy'
                              ? 'badge-healthy'
                              : slo.status === 'at-risk'
                                ? 'badge-warning'
                                : 'badge-critical'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          {slo.status === 'at-risk' ? 'AT RISK' : slo.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Dialog: + Create New SLO */}
      {showCreateModal && (
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
              width: '560px',
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
                  SLO CONFIGURATION MODAL
                </span>
                <h2
                  className="font-mono"
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                >
                  Create Service Level Objective (SLO)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Create Form */}
            <form
              onSubmit={handleCreateSLO}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              {/* Service Select (Displaying Name & ID Service Key UUID) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="slo-service-id"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  SELECT TARGET SERVICE (ID SERVICE KEY UUID):
                </label>
                <select
                  id="slo-service-id"
                  value={formServiceId}
                  onChange={(e) => setFormServiceId(e.target.value)}
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  {servicesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* SLO Rule Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="slo-rule-name"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  SLO RULE NAME:
                </label>
                <input
                  id="slo-rule-name"
                  type="text"
                  required
                  placeholder="e.g. P95 Latency < 200ms or HTTP 2xx Success Rate"
                  value={formSloName}
                  onChange={(e) => setFormSloName(e.target.value)}
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Indicator Type Select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="slo-indicator-type"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  SLI INDICATOR TYPE:
                </label>
                <select
                  id="slo-indicator-type"
                  value={formIndicatorType}
                  onChange={(e) =>
                    setFormIndicatorType(
                      e.target.value as 'availability' | 'latency' | 'error_rate' | 'custom_metric',
                    )
                  }
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                >
                  <option value="availability">
                    Availability / HTTP Success Rate (2xx/3xx/4xx)
                  </option>
                  <option value="latency">Response Latency Threshold (ms)</option>
                  <option value="error_rate">Error Rate Ratio (5xx & Exceptions)</option>
                  <option value="custom_metric">Custom OTel Metric (Gauge / Counter)</option>
                </select>
              </div>

              {/* Custom OTel Metric Name (if custom_metric) */}
              {formIndicatorType === 'custom_metric' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="slo-custom-metric"
                    className="font-mono"
                    style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    CUSTOM OTEL METRIC NAME / QUERY:
                  </label>
                  <input
                    id="slo-custom-metric"
                    type="text"
                    required
                    placeholder="e.g. redis.cache.hit_ratio or kafka.consumer.lag"
                    value={formMetricName}
                    onChange={(e) => setFormMetricName(e.target.value)}
                    className="font-mono"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-dark)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Target Objective % */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="slo-target-objective"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  TARGET OBJECTIVE (%):
                </label>
                <input
                  id="slo-target-objective"
                  type="number"
                  step="0.1"
                  min="50"
                  max="100"
                  required
                  value={formObjective}
                  onChange={(e) => setFormObjective(e.target.value)}
                  className="font-mono"
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--bg-dark)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Threshold ms (if latency) */}
              {formIndicatorType === 'latency' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label
                    htmlFor="slo-threshold-ms"
                    className="font-mono"
                    style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    LATENCY THRESHOLD (MS):
                  </label>
                  <input
                    id="slo-threshold-ms"
                    type="number"
                    required
                    value={formThresholdMs}
                    onChange={(e) => setFormThresholdMs(e.target.value)}
                    className="font-mono"
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-dark)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Submit Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="font-mono"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '4px',
                    border: '1px solid var(--surface-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="font-mono"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: '#00285d',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Save SLO Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SLOsPage() {
  return (
    <Suspense
      fallback={<div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading SLOs...</div>}
    >
      <SLOsContent />
    </Suspense>
  );
}
