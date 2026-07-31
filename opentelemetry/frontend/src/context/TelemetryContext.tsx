'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type CloudFilter = 'all' | 'gcp' | 'aws' | 'azure';
export type EnvironmentFilter = 'production' | 'staging' | 'dev';
export type TimeRangeFilter = '5m' | '15m' | '1h' | '6h' | '24h' | '7d';

interface TelemetryContextType {
  cloudFilter: CloudFilter;
  setCloudFilter: (c: CloudFilter) => void;
  environmentFilter: EnvironmentFilter;
  setEnvironmentFilter: (e: EnvironmentFilter) => void;
  timeRange: TimeRangeFilter;
  setTimeRange: (t: TimeRangeFilter) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  lastRefreshedAt: number;
  triggerRefresh: () => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [cloudFilter, setCloudFilter] = useState<CloudFilter>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<EnvironmentFilter>('production');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('15m');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());

  const triggerRefresh = useCallback(() => {
    setLastRefreshedAt(Date.now());
  }, []);

  // Automatic polling every 1 second when autoRefreshEnabled is true
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      setLastRefreshedAt(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled]);

  return (
    <TelemetryContext.Provider
      value={{
        cloudFilter,
        setCloudFilter,
        environmentFilter,
        setEnvironmentFilter,
        timeRange,
        setTimeRange,
        commandPaletteOpen,
        setCommandPaletteOpen,
        autoRefreshEnabled,
        setAutoRefreshEnabled,
        lastRefreshedAt,
        triggerRefresh,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
