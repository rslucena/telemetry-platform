const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const JWT_REGEX = /^(?:Bearer\s+)?eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/i;
const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'credit_card',
  'ssn',
  'private_key',
  'access_token',
  'refresh_token',
  'x-service-key',
  'x-telemetry-key',
  'client_secret',
]);

/**
 * Sanitiza um valor genérico substituindo e-mails, tokens JWT e senhas por tags [REDACTED]/[MASKED_EMAIL]
 */
export function sanitizeAttributeValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const lowerKey = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lowerKey)) {
    return '[REDACTED]';
  }

  if (JWT_REGEX.test(value)) {
    return '[REDACTED_JWT_TOKEN]';
  }

  if (EMAIL_REGEX.test(value)) {
    return '[MASKED_EMAIL]';
  }

  return value;
}

/**
 * Sanitiza um mapa de atributos (Record<string, unknown>)
 */
export function sanitizeAttributes(
  attributes: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const sanitized = sanitizeAttributeValue(key, value);
    if (
      typeof sanitized === 'string' ||
      typeof sanitized === 'number' ||
      typeof sanitized === 'boolean'
    ) {
      result[key] = sanitized;
    } else {
      result[key] = String(sanitized);
    }
  }

  return result;
}

/**
 * Sanitiza parâmetros literais em queries SQL (ex: WHERE id = 123 -> WHERE id = ?)
 */
export function sanitizeSqlQuery(sql: string): string {
  return sql
    .replace(/'[^']*'/g, "'?'") // strings literais
    .replace(/\b\d+\b/g, '?'); // números literais
}
