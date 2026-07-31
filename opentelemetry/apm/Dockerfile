# ═══════════════════════════════════════════════════════════════════════════
# Telemetry APM Agent — Imagem Docker Pré-Compilada
# ═══════════════════════════════════════════════════════════════════════════
#
# Esta imagem contém os SDKs OpenTelemetry pré-instalados e compilados.
# Os microsserviços clientes simplesmente copiam /opt/apm via COPY --from
# e adicionam -r /opt/apm/dist/register.js ao CMD, sem compilar nada.
#
# Variáveis obrigatórias no docker-compose do cliente:
#   OTEL_SERVICE_KEY                → UUID do serviço (cadastrado na UI de Settings)
#   OTEL_EXPORTER_OTLP_ENDPOINT    → URL do backend (ex: http://host.docker.internal:4000)
# ═══════════════════════════════════════════════════════════════════════════

FROM node:22-alpine AS builder

WORKDIR /build

# Instala dependências de build (apenas para compilar módulos nativos futuros se necessário)
RUN apk add --no-cache python3 make g++

# Copia apenas os manifests primeiro (aproveitando cache do Docker)
COPY package.json ./

# Instala todas as dependências OTel SDK
RUN npm install

# Copia os fontes TypeScript e compila
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────
# Stage final: imagem enxuta, apenas o necessário para COPY --from
# ─────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS final

WORKDIR /opt/apm

# Copia apenas node_modules compilados e dist gerado
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/package.json ./package.json

# Label de versão para rastreabilidade
LABEL org.opencontainers.image.title="Telemetry APM Agent"
LABEL org.opencontainers.image.description="OpenTelemetry APM Agent for Node.js microservices"
LABEL org.opencontainers.image.version="1.0.0"

# A imagem não executa nada por si só — serve como fonte para COPY --from
CMD ["echo", "Telemetry APM Agent image ready. Use COPY --from in your Dockerfile."]
