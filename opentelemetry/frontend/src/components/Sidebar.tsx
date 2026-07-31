'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileText,
  Flame,
  GitFork,
  Layers,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const groups = [
    {
      label: 'OVERVIEW',
      items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'OBSERVE',
      items: [
        { href: '/services', label: 'Service Catalog', icon: Layers },
        { href: '/topology', label: 'Topology Map', icon: GitFork },
        { href: '/traces', label: 'Traces', icon: Activity },
        { href: '/logs', label: 'Logs', icon: FileText },
        { href: '/metrics', label: 'Metrics', icon: BarChart3 },
      ],
    },
    {
      label: 'PROFILING',
      items: [{ href: '/profiling', label: 'Continuous Profiling', icon: Flame }],
    },
    {
      label: 'RELIABILITY',
      items: [
        { href: '/slos', label: 'SLOs & Error Budgets', icon: ShieldCheck },
        { href: '/incidents', label: 'Incidents & Alerts', icon: AlertTriangle },
        { href: '/root-cause', label: 'Root Cause Analysis (RCA)', icon: Zap },
      ],
    },

    {
      label: 'SYSTEM',
      items: [{ href: '/settings', label: 'Settings', icon: Settings }],
    },
  ];

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--surface-low)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 40,
        userSelect: 'none',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '18px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--surface-border)',
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cpu style={{ width: '16px', height: '16px', color: '#002e6a' }} />
            </div>
            <div>
              <div
                className="font-display"
                style={{
                  fontWeight: 700,
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                Observability<span style={{ color: 'var(--accent)' }}> Pro</span>
              </div>
              <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                OTel Vantage Platform
              </div>
            </div>
          </div>
        )}
        {collapsed && (
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Cpu style={{ width: '16px', height: '16px', color: '#002e6a' }} />
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }}>
        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: '20px' }}>
            {!collapsed && (
              <div
                className="font-mono"
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '0 12px 8px 12px',
                }}
              >
                {group.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: collapsed ? '8px 0' : '8px 12px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'var(--surface-container)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse Toggle Footer */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
        }}
      >
        <button
          type="button"
          aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          onClick={() => setCollapsed(!collapsed)}
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
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
