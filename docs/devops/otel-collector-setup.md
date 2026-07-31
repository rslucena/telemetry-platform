# OpenTelemetry Collector Setup

The OpenTelemetry Collector (`otel/opentelemetry-collector-contrib`) receives telemetry signals via OTLP gRPC/HTTP and exports them to **Observability Pro**.

## Collector Configuration (`otel-collector-config.yaml`)

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

exporters:
  otlphttp/telemetry:
    endpoint: http://host.docker.internal:4000
    headers:
      x-service-key: otel-collector-shared-key

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/telemetry]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/telemetry]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/telemetry]
```
