# Production Deployment Guide

Guide for deploying **Observability Pro** backend and frontend in production.

## 1. Production Build Commands

```bash
# Build Backend Bun bundle
bun --cwd opentelemetry/backend build

# Build Frontend Next.js production bundle
bun --cwd opentelemetry/frontend build
```

---

## 2. Docker Composition for Standalone Server

```yaml
version: '3.8'

services:
  telemetry-backend:
    build:
      context: ./opentelemetry/backend
    environment:
      - PORT=4000
      - STORAGE_DRIVER=sqlite
      - DB_PATH=/data/telemetry.sqlite
    volumes:
      - telemetry-data:/data
    ports:
      - "4000:4000"

  telemetry-frontend:
    build:
      context: ./opentelemetry/frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://telemetry-backend:4000
    ports:
      - "3000:3000"

volumes:
  telemetry-data:
```
