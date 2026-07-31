'use client';

import { CheckCircle2, Layers, RefreshCw, Server } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

export default function OverviewPage() {
  const [activeServicesCount, setActiveServicesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/v1/settings/services');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const activeOnly = json.data.filter(
            (s: { status?: string }) => s.status !== 'deactivated',
          );
          setActiveServicesCount(activeOnly.length);
        }
      }
    } catch {
      // Backend offline
      setActiveServicesCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1
            className="font-display"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            System Overview
          </h1>
          <span className="badge badge-healthy">Operational</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
          Real-time telemetry metrics overview across cloud workload instances.
        </p>
      </div>

      {/* KPI Card */}
      <div style={{ maxWidth: '360px' }}>
        <Link
          href="/services"
          className="glass-panel"
          style={{ padding: '20px', display: 'block', textDecoration: 'none' }}
        >
          <div
            className="font-mono"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            <span>ACTIVE SERVICES</span>
            <Layers size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: '28px',
              fontWeight: 700,
              margin: '10px 0 4px 0',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <RefreshCw
                size={20}
                className="pulse-status"
                style={{ color: 'var(--text-muted)' }}
              />
            ) : (
              activeServicesCount
            )}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--status-healthy)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCircle2 size={13} /> View in Service Catalog →
          </div>
        </Link>
      </div>
    </div>
  );
}
