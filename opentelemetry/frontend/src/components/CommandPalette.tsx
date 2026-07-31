'use client';

import { useTelemetry } from '@/context/TelemetryContext';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  FileText,
  Flame,
  GitFork,
  Layers,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useTelemetry();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const items = [
    { label: 'Go to Overview Dashboard', category: 'Navigation', href: '/', icon: Activity },
    { label: 'Service Catalog', category: 'Observe', href: '/services', icon: Layers },
    { label: 'Topology Map (Service Map)', category: 'Observe', href: '/topology', icon: GitFork },
    { label: 'Traces Explorer', category: 'Observe', href: '/traces', icon: Activity },
    { label: 'Logs Explorer', category: 'Observe', href: '/logs', icon: FileText },
    { label: 'Metrics Explorer', category: 'Observe', href: '/metrics', icon: BarChart3 },
    {
      label: 'Continuous Profiling & Flamegraphs',
      category: 'Observe',
      href: '/profiling',
      icon: Flame,
    },
    { label: 'SLOs & Error Budgets', category: 'Reliability', href: '/slos', icon: ShieldCheck },
    {
      label: 'Incidents & Alerts',
      category: 'Reliability',
      href: '/incidents',
      icon: AlertTriangle,
    },
    {
      label: 'Root Cause Analysis (RCA)',
      category: 'Reliability',
      href: '/root-cause',
      icon: Search,
    },
    {
      label: 'checkout-api (GCP Cloud Run)',
      category: 'Services',
      href: '/services?name=checkout-api',
      icon: Layers,
    },
    {
      label: 'payment-service (AWS ECS)',
      category: 'Services',
      href: '/services?name=payment-service',
      icon: Layers,
    },
    {
      label: 'notification-fn (GCP Serverless)',
      category: 'Services',
      href: '/services?name=notification-fn',
      icon: Layers,
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const handleSelect = (href: string) => {
    router.push(href);
    setCommandPaletteOpen(false);
  };

  const handleKeyDownInInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex].href);
    }
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: Backdrop overlay container
    <div
      role="button"
      tabIndex={0}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(4, 5, 8, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={() => setCommandPaletteOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setCommandPaletteOpen(false);
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: Custom modal container */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--surface-border-light)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid var(--surface-border)',
            gap: '12px',
          }}
        >
          <Search size={18} style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownInInput}
            placeholder="Type a command, search services, traces, or incidents..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '15px',
            }}
          />
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
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

        {/* Results List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No matching results found for "{query}"
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  type="button"
                  key={`${item.category}-${item.label}`}
                  onClick={() => handleSelect(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--surface-hover)' : 'transparent',
                    border: 'none',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon
                      size={16}
                      style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: isSelected ? 600 : 400,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-dark)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight size={14} style={{ color: 'var(--accent)' }} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Command Palette Footer */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--bg-dark)',
            borderTop: '1px solid var(--surface-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>
              <kbd
                style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: '3px' }}
              >
                ↑↓
              </kbd>{' '}
              Navigate
            </span>
            <span>
              <kbd
                style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: '3px' }}
              >
                ↵
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd
                style={{ background: 'var(--surface)', padding: '1px 4px', borderRadius: '3px' }}
              >
                ESC
              </kbd>{' '}
              Close
            </span>
          </div>
          <span>Telemetry.AI Universal Command</span>
        </div>
      </div>
    </div>
  );
}
