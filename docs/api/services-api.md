# Service Catalog & Keys API

Endpoints for retrieving microservices catalog data, registering new services, updating metadata, and rotating UUID keys.

![Service Keys & Settings](/images/settings.png)

## 1. List All Services
`GET /api/v1/services` or `GET /api/v1/settings/services`

### Response (200 OK)
```json
{
  "data": [
    {
      "id": "srv-95105a4f-49cb-435b-9d02-6d96d356d6d9",
      "name": "checkout-api",
      "githubUrl": "https://github.com/company/checkout-api",
      "environment": "production",
      "version": "v1.0.0",
      "status": "active",
      "cloudProvider": "gcp",
      "cloudRegion": "us-central1",
      "cloudPlatform": "k8s",
      "isServerless": false,
      "metricsSummary": {
        "rps": 266.4,
        "errorRate": 0.3,
        "p95LatencyMs": 117.9
      }
    }
  ]
}
```

## 2. Register New Service
`POST /api/v1/settings/services`

### Request Body
```json
{
  "name": "payment-service",
  "githubUrl": "https://github.com/company/payment-service",
  "environment": "production"
}
```

## 3. Update Service Metadata
`PUT /api/v1/settings/services/:id`

### Request Body
```json
{
  "name": "payment-service-v2",
  "githubUrl": "https://github.com/company/payment-service-v2",
  "environment": "staging"
}
```

## 4. Rotate Service Key
`POST /api/v1/settings/services/:id/rotate`

Generates a new UUID v4 key for the service and revokes the previous key.
