# Metrics, Logs & Exemplars API

Endpoints for querying metrics time-series, correlated structured logs, and exemplars.

![Metrics Explorer](/images/metrics.png)


## 1. Search Structured Logs
`GET /api/v1/logs`

### Query Parameters
- `serviceName`: Filter by service.
- `traceId`: Filter logs linked to a specific trace.
- `query`: Text search in log message body.
- `limit`: Default 50.


## 2. Query Metrics Time-Series
`GET /api/v1/metrics`

### Query Parameters
- `name`: Metric identifier (e.g., `http.server.duration`).
- `serviceName`: Filter by service.
- `startTimeMs` & `endTimeMs`: Time range window.
