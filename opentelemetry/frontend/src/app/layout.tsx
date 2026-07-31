import './globals.css';
import { CommandPalette } from '@/components/CommandPalette';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { TelemetryProvider } from '@/context/TelemetryContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Telemetry Engine - Multicloud OpenTelemetry Platform',
  description: 'High-performance OpenTelemetry Observability Platform powered by Bun & Next.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TelemetryProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="main-content">
              <Header />
              <main className="page-container">{children}</main>
            </div>
          </div>
          <CommandPalette />
        </TelemetryProvider>
      </body>
    </html>
  );
}
