# Traces & Waterfall Spans API

Endpoints for querying OpenTelemetry traces, spans, and waterfall execution trees.

![Traces Waterfall](/images/traces_waterfall.png)


## 1. Query Traces List
`GET /api/v1/traces`

### Query Parameters
- `serviceName` *(optional)*: Filter by service name or UUID key.
- `minDurationMs` *(optional)*: Filter traces slower than threshold.
- `limit` *(optional, default 50)*: Number of traces returned.

---

## 2. Get Trace Details by ID
`GET /api/v1/traces/:traceId`

### Response (200 OK)
```json
{
  "traceId": "da769f1eb2fca912",
  "spanCount": 4,
  "spans": [
    {
      "traceId": "da769f1eb2fca912",
      "spanId": "s101",
      "name": "POST /api/v1/checkout",
      "kind": 1,
      "startTime": 1785530000000,
      "endTime": 1785530000120,
      "durationMs": 120,
      "statusCode": 1,
      "serviceName": "checkout-api",
      "attributes": {
        "http.method": "POST",
        "http.status_code": 200
      }
    }
  ]
}
```
