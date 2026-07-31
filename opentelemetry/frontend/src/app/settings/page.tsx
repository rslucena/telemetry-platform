'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Github,
  Key,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Slash,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface ServiceKeyRecord {
  id: string; // Service Key (UUID v4)
  name: string;
  githubUrl: string;
  environment: 'production' | 'staging' | 'development';
  status: 'active' | 'deactivated';
  createdAt: string;
  lastUsedAt: string;
  previousKeys: string[];
}

const INITIAL_SERVICES: ServiceKeyRecord[] = [];

export default function SettingsPage() {
  const { cloudFilter } = useTelemetry();
  const [services, setServices] = useState<ServiceKeyRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Active Tab: 'keys' | 'apm-snippet' | 'channels'
  const [activeTab, setActiveTab] = useState<'keys' | 'apm-snippet' | 'channels'>('keys');

  // Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceKeyRecord | null>(null);
  const [rotatingService, setRotatingService] = useState<ServiceKeyRecord | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formGithubUrl, setFormGithubUrl] = useState('');
  const [formEnv, setFormEnv] = useState<'production' | 'staging' | 'development'>('production');

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:4000/api/v1/settings/services');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const mapped: ServiceKeyRecord[] = json.data.map(
            (s: Record<string, unknown>, i: number) => ({
              id: String(s.id ?? `srv-${i}`),
              name: String(s.name ?? 'service'),
              githubUrl: String(
                s.githubUrl ?? s.github_url ?? 'https://github.com/company/service',
              ),
              environment: String(s.environment ?? 'production') as ServiceKeyRecord['environment'],
              status: (s.status === 'deactivated'
                ? 'deactivated'
                : 'active') as ServiceKeyRecord['status'],
              createdAt: '2026-01-15 10:30',
              lastUsedAt: 'Active (OTel Stream)',
              previousKeys: [],
            }),
          );
          setServices(mapped);
        }
      }
    } catch {
      // Backend offline fallback
      setServices([]);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(key);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleRegisterService = async (e: React.FormEvent) => {
    e.preventDefault();
    const randomUuid = `srv-${crypto.randomUUID()}`;
    const newRecord: ServiceKeyRecord = {
      id: randomUuid,
      name: formName || 'new-microservice',
      githubUrl: formGithubUrl || 'https://github.com/company/new-service',
      environment: formEnv,
      status: 'active',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      lastUsedAt: 'Never',
      previousKeys: [],
    };

    try {
      await fetch('http://localhost:4000/api/v1/settings/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          githubUrl: formGithubUrl,
          environment: formEnv,
        }),
      });
    } catch {
      // Offline
    }

    setServices((prev) => [newRecord, ...prev]);
    setShowRegisterModal(false);
    setFormName('');
    setFormGithubUrl('');
  };

  const promptRotateKey = (service: ServiceKeyRecord) => {
    setRotatingService(service);
    setShowRotateModal(true);
  };

  const confirmRotateKey = async () => {
    if (!rotatingService) return;
    const newUuid = `srv-${crypto.randomUUID()}`;

    try {
      await fetch(
        `http://localhost:4000/api/v1/settings/services/${encodeURIComponent(rotatingService.id)}/rotate`,
        {
          method: 'POST',
        },
      );
    } catch {
      // Offline
    }

    setServices((prev) =>
      prev.map((s) => {
        if (s.id === rotatingService.id) {
          return {
            ...s,
            previousKeys: [s.id, ...s.previousKeys],
            id: newUuid,
            status: 'active',
            lastUsedAt: 'Just now (Rotated)',
          };
        }
        return s;
      }),
    );
    setShowRotateModal(false);
    setRotatingService(null);
  };

  const handleToggleStatus = async (serviceId: string) => {
    try {
      await fetch(
        `http://localhost:4000/api/v1/settings/services/${encodeURIComponent(serviceId)}/toggle-status`,
        {
          method: 'POST',
        },
      );
    } catch {
      // Offline
    }

    setServices((prev) =>
      prev.map((s) => {
        if (s.id === serviceId) {
          const newStatus = s.status === 'active' ? 'deactivated' : 'active';
          return { ...s, status: newStatus };
        }
        return s;
      }),
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await fetch(
        `http://localhost:4000/api/v1/settings/services/${encodeURIComponent(editingService.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            githubUrl: formGithubUrl,
            environment: formEnv,
          }),
        },
      );
    } catch {
      // Offline
    }

    setServices((prev) =>
      prev.map((s) => {
        if (s.id === editingService.id) {
          return {
            ...s,
            name: formName,
            githubUrl: formGithubUrl,
            environment: formEnv,
          };
        }
        return s;
      }),
    );

    await fetchServices();

    setShowEditModal(false);
    setEditingService(null);
  };

  const openEditModal = (service: ServiceKeyRecord) => {
    setEditingService(service);
    setFormName(service.name);
    setFormGithubUrl(service.githubUrl);
    setFormEnv(service.environment);
    setShowEditModal(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
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
            <Settings style={{ color: 'var(--accent)' }} size={20} />
            System Settings & Service Key Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Register microservices, manage APM ID Service Keys (UUID), repository links, and
            security access policies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormName('');
            setFormGithubUrl('');
            setShowRegisterModal(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--accent)',
            border: 'none',
            color: '#00285d',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          <Plus size={15} />
          <span>Register New Service</span>
        </button>
      </div>

      {/* Settings Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--surface-border)',
        }}
      >
        {[
          { id: 'keys', label: 'Service Keys & APM Tokens', icon: Key },
          { id: 'apm-snippet', label: 'APM Agent Integration Guide', icon: Zap },
          { id: 'channels', label: 'Notification Channels (Slack / Webhooks)', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="font-mono"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Service Keys & Catalog */}
      {activeTab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search Filter Bar */}
          <div style={{ position: 'relative', width: '320px' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Service Name or UUID Key..."
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

          {/* Service Table Card */}
          <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
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
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>SERVICE NAME</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>
                    ID SERVICE KEY (UUID v4)
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '130px' }}>
                    GITHUB REPO
                  </th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '110px' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, width: '120px' }}>
                    LAST ACTIVITY
                  </th>
                  <th
                    style={{
                      padding: '12px 16px',
                      fontWeight: 600,
                      width: '220px',
                      textAlign: 'right',
                    }}
                  >
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((svc) => {
                  const isActive = svc.status === 'active';
                  return (
                    <tr
                      key={svc.id}
                      style={{
                        borderBottom: '1px solid var(--surface-border)',
                        opacity: isActive ? 1 : 0.6,
                        backgroundColor: isActive ? 'transparent' : 'rgba(255, 68, 68, 0.03)',
                      }}
                    >
                      {/* Service Name & Env */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            className="font-mono"
                            style={{
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              fontSize: '13px',
                            }}
                          >
                            {svc.name}
                          </span>
                          <span
                            className="badge badge-gcp"
                            style={{ fontSize: '9px', width: 'fit-content', padding: '1px 5px' }}
                          >
                            {svc.environment.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* ID Service Key (UUID) & Copy */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code
                            className="font-mono"
                            style={{
                              fontSize: '11px',
                              backgroundColor: 'var(--bg-dark)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--surface-border)',
                              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                            }}
                          >
                            {svc.id}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(svc.id)}
                            title="Copy ID Service Key"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color:
                                copiedKeyId === svc.id
                                  ? 'var(--status-healthy)'
                                  : 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                            }}
                          >
                            {copiedKeyId === svc.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        {svc.previousKeys.length > 0 && (
                          <span
                            className="font-mono"
                            style={{
                              fontSize: '9px',
                              color: 'var(--status-critical)',
                              marginTop: '2px',
                              display: 'block',
                            }}
                          >
                            ⚠ {svc.previousKeys.length} Revoked Key(s)
                          </span>
                        )}
                      </td>

                      {/* GitHub Link */}
                      <td style={{ padding: '14px 16px' }}>
                        <a
                          href={svc.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono"
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none',
                          }}
                        >
                          <Github size={12} />
                          <span>Repo Link</span>
                          <ExternalLink size={9} />
                        </a>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          className={`badge ${isActive ? 'badge-healthy' : 'badge-critical'}`}
                          style={{ fontSize: '10px' }}
                        >
                          {isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>

                      {/* Last Activity */}
                      <td
                        className="font-mono"
                        style={{
                          padding: '14px 16px',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                        }}
                      >
                        {svc.lastUsedAt}
                      </td>

                      {/* Action Buttons: Rotate Key, Edit, Deactivate */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '8px',
                          }}
                        >
                          {/* Rotate Key */}
                          <button
                            type="button"
                            onClick={() => promptRotateKey(svc)}
                            title="Regenerate New Key (Revokes Old Key)"
                            className="font-mono"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '3px',
                              border: '1px solid var(--surface-border)',
                              backgroundColor: 'var(--bg-dark)',
                              color: 'var(--status-warning)',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <RefreshCw size={10} />
                            <span>Rotate Key</span>
                          </button>

                          {/* Edit Metadata */}
                          <button
                            type="button"
                            onClick={() => openEditModal(svc)}
                            className="font-mono"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '3px',
                              border: '1px solid var(--surface-border)',
                              backgroundColor: 'var(--bg-dark)',
                              color: 'var(--text-primary)',
                              fontSize: '10px',
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>

                          {/* Toggle Active/Deactivated */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(svc.id)}
                            className="font-mono"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '3px',
                              border: 'none',
                              backgroundColor: isActive
                                ? 'rgba(234,67,53,0.15)'
                                : 'rgba(52,168,83,0.15)',
                              color: isActive ? 'var(--status-critical)' : 'var(--status-healthy)',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isActive ? 'Deactivate' : 'Enable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: APM Integration Guide */}
      {activeTab === 'apm-snippet' && (
        <div
          className="glass-panel"
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          <div>
            <h2
              className="font-mono"
              style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              OpenTelemetry APM Integration & Authentication
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Only the <code>ID Service Key (UUID)</code> is required in your repository APM agent
              configuration. The server validates the UUID upon receiving OTLP data and rejects
              invalid or revoked keys (HTTP 401 Unauthorized).
            </p>
          </div>

          {/* Code Snippet Box */}
          <div
            style={{
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}
            >
              ENVIRONMENT VARIABLE CONFIGURATION (OTEL_SERVICE_KEY):
            </span>
            <pre
              className="font-mono"
              style={{
                fontSize: '12px',
                color: '#e6edf3',
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: '12px',
                borderRadius: '4px',
                overflowX: 'auto',
              }}
            >
              {`# 1. Export Environment Variables in your container or server
export OTEL_SERVICE_KEY="srv-c1234567-89ab-4cde-8f01-23456789abcd"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://telemetry-backend:4000"

# 2. Node.js / Bun OpenTelemetry SDK Initialization:
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_KEY, // Pass UUID as Service Key
  traceExporter: new OTLPTraceExporter({
    url: 'http://telemetry-backend:4000/v1/traces',
    headers: {
      'x-service-key': process.env.OTEL_SERVICE_KEY,
    },
  }),
});
sdk.start();`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Notification Channels */}
      {activeTab === 'channels' && (
        <div
          className="glass-panel"
          style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div>
            <h2
              className="font-mono"
              style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              Communication & Notification Channels
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Configure Slack Webhooks, PagerDuty integration keys, and custom webhooks for SLO burn
              rate alerts.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-dark)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
              }}
            >
              <span
                className="font-mono"
                style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}
              >
                Slack Webhook (#checkout-alerts)
              </span>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                https://hooks.slack.com/services/T00/B00/XXXX
              </p>
              <span className="badge badge-healthy" style={{ marginTop: '8px', fontSize: '9px' }}>
                ACTIVE
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-dark)',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
              }}
            >
              <span
                className="font-mono"
                style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}
              >
                PagerDuty On-Call Integration
              </span>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Integration Key: pd-service-key-999
              </p>
              <span className="badge badge-healthy" style={{ marginTop: '8px', fontSize: '9px' }}>
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Register New Service */}
      {showRegisterModal && (
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
              width: '520px',
              backgroundColor: 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}
                >
                  SERVICE REGISTRATION MODAL
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
                  Register Microservice & Generate Key
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
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

            <form
              onSubmit={handleRegisterService}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="reg-svc-name"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  SERVICE NAME:
                </label>
                <input
                  id="reg-svc-name"
                  type="text"
                  required
                  placeholder="e.g. checkout-api or payment-service"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="reg-github-url"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  GITHUB REPOSITORY LINK:
                </label>
                <input
                  id="reg-github-url"
                  type="url"
                  required
                  placeholder="https://github.com/org/checkout-api"
                  value={formGithubUrl}
                  onChange={(e) => setFormGithubUrl(e.target.value)}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="reg-env"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  ENVIRONMENT:
                </label>
                <select
                  id="reg-env"
                  value={formEnv}
                  onChange={(e) => setFormEnv(e.target.value as typeof formEnv)}
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
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>

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
                  onClick={() => setShowRegisterModal(false)}
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
                  Generate Key & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Edit Service */}
      {showEditModal && editingService && (
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
              width: '520px',
              backgroundColor: 'var(--surface-low)',
              border: '1px solid var(--surface-border)',
              borderRadius: '6px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}
                >
                  EDIT SERVICE METADATA
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
                  Edit {editingService.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
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

            <form
              onSubmit={handleSaveEdit}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="edit-svc-name"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  SERVICE NAME:
                </label>
                <input
                  id="edit-svc-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label
                  htmlFor="edit-github-url"
                  className="font-mono"
                  style={{ fontSize: '11px', color: 'var(--text-muted)' }}
                >
                  GITHUB REPOSITORY LINK:
                </label>
                <input
                  id="edit-github-url"
                  type="url"
                  required
                  value={formGithubUrl}
                  onChange={(e) => setFormGithubUrl(e.target.value)}
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
                  onClick={() => setShowEditModal(false)}
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Confirm Key Rotation (Custom UI - No Browser Confirm) */}
      {showRotateModal && rotatingService && (
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
              width: '480px',
              backgroundColor: 'var(--surface-low)',
              border: '1px solid var(--status-warning)',
              borderRadius: '6px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 0 24px rgba(251, 188, 5, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
              <div>
                <span
                  className="font-mono"
                  style={{ fontSize: '10px', color: 'var(--status-warning)', fontWeight: 700 }}
                >
                  SECURITY WARNING ACTION
                </span>
                <h2
                  className="font-mono"
                  style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  Rotate ID Service Key for {rotatingService.name}?
                </h2>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-dark)',
                padding: '12px 14px',
                borderRadius: '4px',
                border: '1px solid var(--surface-border)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Generating a new ID Service Key will{' '}
              <strong>immediately revoke and deactivate</strong> the current active key (
              <code>{rotatingService.id}</code>).
              <br />
              <br />
              <span style={{ color: 'var(--status-critical)', fontWeight: 600 }}>
                ⚠ Any APM agent or service sending telemetry data using the old key will be rejected
                with HTTP 401 Unauthorized.
              </span>
            </div>

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowRotateModal(false);
                  setRotatingService(null);
                }}
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
                type="button"
                onClick={confirmRotateKey}
                className="font-mono"
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: 'var(--status-warning)',
                  color: '#000000',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Rotate & Revoke Old Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
