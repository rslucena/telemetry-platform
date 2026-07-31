# OpenTelemetry v1.0 Specification Mapping

Mapping of OpenTelemetry Semantic Conventions to **Observability Pro** entities.

---

## Semantic Attribute Mapping

| OpenTelemetry Attribute | Observability Pro Field | Description |
| :--- | :--- | :--- |
| `service.name` | `serviceName` | Human-readable microservice identifier. |
| `service.namespace` | `namespace` | Kubernetes or application logical namespace. |
| `service.version` | `version` | Application semver release code. |
| `cloud.provider` | `cloudProvider` | Cloud vendor (`gcp`, `aws`, `azure`, `local`). |
| `cloud.region` | `cloudRegion` | Cloud deployment region (`us-central1`, `us-east-1`). |
| `cloud.platform` | `cloudPlatform` | Workload platform (`k8s`, `serverless`, `ec2`). |
| `db.system` | `attributes["db.system"]` | Database system (`postgresql`, `mysql`, `redis`). |
| `http.status_code` | `attributes["http.status_code"]` | HTTP status code for web requests. |
