# SLOs & Incidents API

Endpoints for managing Service Level Objectives, error budgets, and topology-correlated incidents.

![SLOs & Error Budgets](/images/slos.png)

![Incidents Management](/images/incident.png)


## 1. List SLO Statuses
`GET /api/v1/slos`

## 2. Create SLO
`POST /api/v1/slos`

### Request Body
```json
{
  "id": "slo-checkout-availability",
  "name": "Checkout API Availability Target",
  "serviceName": "checkout-api",
  "targetPercentage": 99.9,
  "windowPeriodDays": 30,
  "indicatorType": "availability"
}
```

## 3. List Incidents & Alerts
`GET /api/v1/incidents` or `GET /api/v1/alerts`

Returns topology-grouped incidents with severity classification (`CRITICAL`, `WARNING`, `INFO`).
