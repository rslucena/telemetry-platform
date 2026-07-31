import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  OTEL_RECEIVER_HTTP_PORT: z.coerce.number().default(4318),
  OTEL_RECEIVER_GRPC_PORT: z.coerce.number().default(4317),
  SQLITE_DB_PATH: z.string().default('./telemetry.sqlite'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function loadEnvConfig(customEnv?: Record<string, string | undefined>): EnvConfig {
  const envSource = customEnv || (typeof process !== 'undefined' ? process.env : {});
  const result = EnvSchema.safeParse(envSource);

  if (!result.success) {
    console.error('❌ Falha na validação de variáveis de ambiente:', result.error.format());
    throw new Error('Configuração de ambiente inválida');
  }

  return result.data;
}

export const envConfig = loadEnvConfig();
