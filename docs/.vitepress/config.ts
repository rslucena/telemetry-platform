import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Observability Pro',
  description: 'OTel Vantage Platform — Distributed OpenTelemetry Observability Suite',
  base: '/telemetry-platform/',
  appearance: 'dark',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/images/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#a5c2ff' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'Observability Pro | OTel Vantage Platform' }],
    ['meta', { name: 'og:description', content: 'Distributed OpenTelemetry Observability Suite built with Bun & Next.js 15' }],
  ],

  themeConfig: {
    logo: '/images/logo-icon.svg',
    siteTitle: 'Observability Pro',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'REST API', link: '/api/services-api' },
      { text: 'DevOps', link: '/devops/otel-collector-setup' },
      { text: 'Reference', link: '/reference/slo-burn-rates' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'User Guide',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'APM Agent Integration', link: '/guide/apm-agent-integration' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture & Engine Design',
          items: [
            { text: 'Monorepo Architecture', link: '/architecture/' },
            { text: 'OTLP Ingestion Flow', link: '/architecture/otlp-ingestion-flow' },
            { text: 'Correlation & RCA Engine', link: '/architecture/correlation-engine' },
            { text: 'Database Schema (bun:sqlite)', link: '/architecture/database-schema' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'REST API Specification',
          items: [
            { text: 'Service Catalog & Keys API', link: '/api/services-api' },
            { text: 'Traces & Waterfall API', link: '/api/traces-api' },
            { text: 'Metrics, Logs & Exemplars API', link: '/api/metrics-logs-api' },
            { text: 'SLOs & Incidents API', link: '/api/slos-incidents-api' },
          ],
        },
      ],
      '/devops/': [
        {
          text: 'DevOps & Deployment',
          items: [
            { text: 'OpenTelemetry Collector Setup', link: '/devops/otel-collector-setup' },
            { text: 'Production Deployment Guide', link: '/devops/deployment-guide' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Technical Reference',
          items: [
            { text: 'SLO, Error Budget & Burn Rates', link: '/reference/slo-burn-rates' },
            { text: 'OpenTelemetry Specification Mapping', link: '/reference/otlp-spec-mapping' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/rslucena/telemetry-platform' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Rodrigo Lucena. Observability Pro — OTel Vantage Platform.',
    },
  },
});
