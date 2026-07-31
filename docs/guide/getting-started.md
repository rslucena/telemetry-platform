# Getting Started

This guide walks you through setting up and running **Observability Pro** on your local environment or server.

## Prerequisites

Before starting, ensure you have the following installed:

- **[Bun](https://bun.sh/)** (version 1.0.0 or higher)
- **Node.js** (version 18+ for Next.js 15 App Router compatibility)
- **Docker & Docker Compose** *(optional, for running the OpenTelemetry Collector container)*

## 1. Repository Installation

Clone the repository and install all monorepo dependencies using Bun Workspaces:

```bash
# Clone the repository
git clone https://github.com/rslucena/telemetry-platform.git
cd telemetry-platform

# Install monorepo dependencies
bun install
```

## 2. Launch Development Servers

Run the parallel development server script:

```bash
bun run dev
```

This single command starts both applications concurrently:
- 🚀 **Backend Server (Bun API)**: `http://localhost:4000`
- 💻 **Frontend Dashboard (Next.js 15)**: `http://localhost:3000`

### Expected Console Output

```text
🚀 Telemetry Backend Server running on http://0.0.0.0:4000
   ▲ Next.js 15.5.22
   - Local:        http://localhost:3000
   - Network:      http://192.168.31.16:3000

 ✓ Ready in 1.5s
```

## 3. (Optional) Start OpenTelemetry Collector

If you want to collect OTLP gRPC (`4317`) or HTTP (`4318`) signals from external workloads:

```bash
docker compose up -d
```

## 4. Accessing the Dashboard

Open your browser and navigate to `http://localhost:3000`. You can explore the following views:

### Service Catalog (`/services`)
![Service Catalog](/images/service_catalog.png)

### Cross-Cloud Topology Map (`/topology`)
![Topology Map](/images/topology_map.png)

### Traces & Waterfall Explorer (`/traces`)
![Traces Waterfall](/images/traces_waterfall.png)
