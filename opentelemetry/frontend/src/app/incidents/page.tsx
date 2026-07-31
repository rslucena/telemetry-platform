'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldOff,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type AlertStatus = 'firing' | 'acknowledged' | 'resolved';

interface Alert {
  id: string;
  name: string;
  service: string;
  severity: 'critical' | 'warning' | 'info';
  status: AlertStatus;
  firedAt: string;
  summary: string;
  incidentId?: string;
}

interface Incident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  status: 'active' | 'investigating' | 'resolved';
  affectedServices: string[];
  startedAt: string;
  duration: string;
  impactedUsers: number;
  rcaReady: boolean;
}

export default function IncidentsPage() {
  const { cloudFilter } = useTelemetry();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'incidents'>('alerts');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/incidents');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const mappedIncidents: Incident[] = json.data.map(
            (r: Record<string, unknown>, i: number) => ({
              id: String(r.id ?? `inc-${i}`),
              title: String(r.title ?? r.description ?? 'Incident'),
              severity: String(r.severity ?? 'medium').toLowerCase() as Incident['severity'],
              status: (r.status === 'open'
                ? 'active'
                : String(r.status ?? 'active')) as Incident['status'],
              affectedServices: Array.isArray(r.affectedServices)
                ? (r.affectedServices as string[])
                : [String(r.serviceName ?? 'unknown')],
              startedAt: r.createdAt
                ? new Date(Number(r.createdAt)).toISOString()
                : new Date().toISOString(),
              duration: r.durationMs ? `${Math.round(Number(r.durationMs) / 60000)}m` : '—',
              impactedUsers: Number(r.impactedUsers ?? 0),
              rcaReady: Boolean(r.rcaReady ?? false),
            }),
          );
          setIncidents(mappedIncidents);

          // Derivar alertas a partir dos incidentes
          const derivedAlerts: Alert[] = mappedIncidents.map((inc, i) => ({
            id: `alrt-${i}`,
            name: inc.title.slice(0, 50),
            service: inc.affectedServices[0] ?? 'unknown',
            severity:
              inc.severity === 'critical'
                ? 'critical'
                : inc.severity === 'high'
                  ? 'warning'
                  : 'info',
            status:
              inc.status === 'active'
                ? 'firing'
                : inc.status === 'investigating'
                  ? 'acknowledged'
                  : 'resolved',
            firedAt: inc.startedAt,
            summary: inc.title,
            incidentId: inc.id,
          }));
          setAlerts(derivedAlerts);
        }
      }
    } catch {
      // Backend offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldOff style={{ color: 'var(--status-critical)' }} />
            Alerts & Incident Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Active alerts, acknowledged states and grouped incident timelines across all
            environments.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live indicator */}
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
            <span style={{ fontSize: '12px', color: 'var(--status-critical)', fontWeight: 600 }}>
              {alerts.filter((a) => a.status === 'firing').length} ACTIVE ALERTS
            </span>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              color: 'var(--text-primary)',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            <RefreshCw size={14} className={loading ? 'pulse-status' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--surface-border)',
          paddingBottom: '0',
        }}
      >
        {(['alerts', 'incidents'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === tab ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'alerts' ? `Alerts (${alerts.length})` : `Incidents (${incidents.length})`}
          </button>
        ))}
      </div>

      {/* Alerts Panel */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.map((alert) => {
            const isFiring = alert.status === 'firing';
            const isResolved = alert.status === 'resolved';
            const borderColor =
              alert.severity === 'critical'
                ? 'var(--status-critical)'
                : alert.severity === 'warning'
                  ? 'var(--status-degraded)'
                  : 'var(--status-healthy)';

            return (
              <div
                key={alert.id}
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  borderLeft: `3px solid ${isResolved ? 'var(--surface-border)' : borderColor}`,
                  opacity: isResolved ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                <div style={{ paddingTop: '2px', flexShrink: 0 }}>
                  {isResolved ? (
                    <CheckCircle2 size={20} style={{ color: 'var(--status-healthy)' }} />
                  ) : alert.severity === 'critical' ? (
                    <AlertTriangle size={20} style={{ color: 'var(--status-critical)' }} />
                  ) : (
                    <Bell size={20} style={{ color: 'var(--status-degraded)' }} />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}
                      >
                        {alert.name}
                      </span>
                      <span
                        className={`badge ${
                          alert.severity === 'critical'
                            ? 'badge-critical'
                            : alert.severity === 'warning'
                              ? 'badge-degraded'
                              : 'badge-healthy'
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                      <span
                        className={`badge ${
                          isFiring
                            ? 'badge-critical'
                            : isResolved
                              ? 'badge-healthy'
                              : 'badge-degraded'
                        }`}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                      >
                        {alert.status.toUpperCase()}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {alert.firedAt}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    {alert.summary}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Service:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{alert.service}</strong>
                    </span>
                    {alert.incidentId && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('incidents')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          color: 'var(--accent)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <ArrowRight size={12} />
                        See Incident {alert.incidentId}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incidents Panel */}
      {activeTab === 'incidents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {incidents.map((inc) => {
            const isActive = inc.status === 'active';
            const borderColor =
              inc.severity === 'critical'
                ? 'var(--status-critical)'
                : inc.severity === 'high'
                  ? 'var(--status-degraded)'
                  : 'var(--text-muted)';

            return (
              <div
                key={inc.id}
                className="glass-panel"
                style={{
                  padding: '20px 24px',
                  borderLeft: `3px solid ${isActive ? borderColor : 'var(--surface-border)'}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        #{inc.id}
                      </span>
                      <span className={`badge ${isActive ? 'badge-critical' : 'badge-healthy'}`}>
                        {inc.status.toUpperCase()}
                      </span>
                      <span
                        className={`badge ${inc.severity === 'critical' ? 'badge-critical' : inc.severity === 'high' ? 'badge-degraded' : 'badge-healthy'}`}
                      >
                        {inc.severity.toUpperCase()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {inc.title}
                    </h3>
                  </div>

                  <Link
                    href={`/root-cause?incidentId=${inc.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: 'var(--accent)',
                      color: '#00285d',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '12px',
                      flexShrink: 0,
                      marginLeft: '16px',
                      textDecoration: 'none',
                    }}
                  >
                    <Zap size={14} />
                    Analyze Root Cause (RCA)
                  </Link>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '24px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} />
                    Started {inc.startedAt} · Duration {inc.duration}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} />
                    {inc.impactedUsers} users impacted
                  </span>
                  <span>
                    Services:{' '}
                    {inc.affectedServices.map((s) => (
                      <strong key={s} style={{ color: 'var(--text-primary)', marginRight: '4px' }}>
                        {s}
                      </strong>
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
