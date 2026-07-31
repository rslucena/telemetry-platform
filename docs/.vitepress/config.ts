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
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/guide/' },
          { text: 'Why Observability Pro?', link: '/guide/why-observability-pro' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'APM Agent Integration', link: '/guide/apm-agent-integration' },
          { text: 'FAQ', link: '/guide/faq' },
        ],
      },
      { text: 'Architecture', link: '/architecture/' },
      {
        text: 'Reference & API',
        items: [
          { text: 'REST API Specification', link: '/api/services-api' },
          { text: 'DevOps & Collector Setup', link: '/devops/otel-collector-setup' },
          { text: 'Glossary & Core Concepts', link: '/reference/glossary' },
          { text: 'SLO & Error Budgets', link: '/reference/slo-burn-rates' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/guide/' },
          { text: 'Why Observability Pro?', link: '/guide/why-observability-pro' },
          { text: 'Quickstart & Installation', link: '/guide/getting-started' },
          { text: 'APM Agent Integration', link: '/guide/apm-agent-integration' },
          { text: 'Frequently Asked Questions (FAQ)', link: '/guide/faq' },
        ],
      },
      {
        text: 'Architecture & Engine Design',
        collapsed: false,
        items: [
          { text: 'Monorepo Architecture', link: '/architecture/' },
          { text: 'OTLP Ingestion Flow', link: '/architecture/otlp-ingestion-flow' },
          { text: 'Correlation & RCA Engine', link: '/architecture/correlation-engine' },
          { text: 'Database Schema (bun:sqlite)', link: '/architecture/database-schema' },
        ],
      },
      {
        text: 'REST API Specification',
        collapsed: true,
        items: [
          { text: 'Service Catalog & Keys API', link: '/api/services-api' },
          { text: 'Traces & Waterfall API', link: '/api/traces-api' },
          { text: 'Metrics, Logs & Exemplars API', link: '/api/metrics-logs-api' },
          { text: 'SLOs & Incidents API', link: '/api/slos-incidents-api' },
        ],
      },
      {
        text: 'DevOps & Reference',
        collapsed: true,
        items: [
          { text: 'OpenTelemetry Collector Setup', link: '/devops/otel-collector-setup' },
          { text: 'Production Deployment Guide', link: '/devops/deployment-guide' },
          { text: 'Glossary & Core Concepts', link: '/reference/glossary' },
          { text: 'SLO, Error Budget & Burn Rates', link: '/reference/slo-burn-rates' },
          { text: 'OpenTelemetry Spec Mapping', link: '/reference/otlp-spec-mapping' },
        ],
      },
    ],

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
