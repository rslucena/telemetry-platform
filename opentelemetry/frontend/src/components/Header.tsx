'use client';

import type { CloudFilter, EnvironmentFilter, TimeRangeFilter } from '@/context/TelemetryContext';
import { useTelemetry } from '@/context/TelemetryContext';
import {
  Bell,
  Clock,
  Cloud,
  Command,
  Database,
  Globe,
  RefreshCw,
  Server,
  Wifi,
} from 'lucide-react';

export function Header() {
  const {
    cloudFilter,
    setCloudFilter,
    environmentFilter,
    setEnvironmentFilter,
    timeRange,
    setTimeRange,
    setCommandPaletteOpen,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    triggerRefresh,
  } = useTelemetry();

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: 'var(--surface-low)',
        borderBottom: '1px solid var(--surface-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Quick Search & Command Palette Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--surface-border)',
            borderRadius: '4px',
            padding: '5px 12px',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            minWidth: '260px',
          }}
        >
          <Command size={14} style={{ color: 'var(--accent)' }} />
          <span>Search services, traces, logs...</span>
          <kbd
            className="font-mono"
            style={{
              marginLeft: 'auto',
              backgroundColor: 'var(--surface-container)',
              border: '1px solid var(--surface-border)',
              padding: '1px 5px',
              borderRadius: '2px',
              fontSize: '10px',
              color: 'var(--text-secondary)',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Cloud Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '4px',
              padding: '4px 8px',
            }}
          >
            <Cloud size={13} style={{ color: 'var(--accent)' }} />
            <select
              value={cloudFilter}
              onChange={(e) => setCloudFilter(e.target.value as CloudFilter)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                All Clouds
              </option>
              <option value="gcp" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                GCP Cloud Run
              </option>
              <option value="aws" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                AWS ECS / EC2
              </option>
            </select>
          </div>

          {/* Environment Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '4px',
              padding: '4px 8px',
            }}
          >
            <Globe size={13} style={{ color: 'var(--status-healthy)' }} />
            <select
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value as EnvironmentFilter)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="production" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Production
              </option>
              <option value="staging" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Staging
              </option>
              <option value="dev" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Development
              </option>
            </select>
          </div>

          {/* Time Range Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-dark)',
              border: '1px solid var(--surface-border)',
              borderRadius: '4px',
              padding: '4px 8px',
            }}
          >
            <Clock size={13} style={{ color: 'var(--status-degraded)' }} />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRangeFilter)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="5m" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Last 5 min
              </option>
              <option value="15m" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Last 15 min
              </option>
              <option value="1h" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Last 1 hour
              </option>
              <option value="6h" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Last 6 hours
              </option>
              <option value="24h" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Last 24 hours
              </option>
              <option value="7d" style={{ background: '#1e2020', color: '#e3e2e2' }}>
                Last 7 days
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* System Status Indicators & Live Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Live Auto-Refresh Toggle */}
        <button
          type="button"
          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          title={
            autoRefreshEnabled
              ? 'Auto-refresh active (5s). Click to pause.'
              : 'Auto-refresh paused. Click to enable.'
          }
          className={`badge ${autoRefreshEnabled ? 'badge-healthy pulse-status' : 'badge-unknown'}`}
          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
        >
          <RefreshCw size={11} className={autoRefreshEnabled ? 'pulse-status' : ''} />
          <span>{autoRefreshEnabled ? 'LIVE (5s)' : 'PAUSED'}</span>
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <Server size={14} style={{ color: 'var(--status-healthy)' }} />
          <span>
            Bun:{' '}
            <strong style={{ color: 'var(--text-primary)' }} className="font-mono">
              :4000
            </strong>
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <Database size={14} style={{ color: 'var(--accent)' }} />
          <span>
            Engine:{' '}
            <strong style={{ color: 'var(--text-primary)' }} className="font-mono">
              SQLite WAL
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={triggerRefresh}
          title="Manual Sync Now"
          style={{
            background: 'var(--surface-container)',
            border: '1px solid var(--surface-border)',
            color: 'var(--text-secondary)',
            borderRadius: '4px',
            padding: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Bell size={15} />
        </button>
      </div>
    </header>
  );
}
