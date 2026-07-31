---
layout: home

hero:
  name: "Observability Pro"
  text: "OTel Vantage Platform"
  tagline: Distributed OpenTelemetry Observability Suite built with Bun & Next.js 15
  image:
    src: /images/logo.svg
    alt: Observability Pro Logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Architecture Overview
      link: /architecture/
    - theme: alt
      text: GitHub
      link: https://github.com/rslucena/telemetry-platform

features:
  - icon: 📊
    title: Service Catalog & Health
    details: Real-time monitoring of Requests Per Second (RPS), error rates, and P50/P95/P99 latency distribution across microservices.
  - icon: 🗺️
    title: Cross-Cloud Topology Map
    details: Interactive SVG graph displaying dependency edges and data flow across GCP Cloud Run, AWS ECS, EC2, and local clusters.
  - icon: 🕵️
    title: OTLP Trace Waterfall
    details: In-depth request tracing with interactive waterfall charts and per-span attribute inspection for immediate bottleneck detection.
  - icon: 🔍
    title: Automated Root Cause Analysis
    details: Heuristic correlation engine that automatically analyzes error bursts, latency spikes, and downstream failures to pinpoint root cause.
  - icon: 🎯
    title: SLOs & Error Budgets
    details: Service Level Objectives tracking with real-time error budget burn rate evaluation and proactive incident alert grouping.
  - icon: 🔑
    title: APM Service Key Management
    details: Embedded registration of microservices, UUID key rotation, GitHub repository linking, and zero-code APM agent integration.
---
