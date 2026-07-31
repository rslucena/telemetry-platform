import { describe, expect, test } from 'bun:test';
import { sanitizeAttributeValue, sanitizeAttributes, sanitizeSqlQuery } from '../src/index';

describe('OpenTelemetry Collector & Pipeline Utilities', () => {
  test('sanitizeAttributeValue deve mascarar e-mails, senhas e tokens JWT', () => {
    expect(sanitizeAttributeValue('user_email', 'user@example.com')).toBe('[MASKED_EMAIL]');
    expect(sanitizeAttributeValue('password', 'super-secret-123')).toBe('[REDACTED]');
    expect(sanitizeAttributeValue('authorization', 'Bearer secret-token')).toBe('[REDACTED]');
  });

  test('sanitizeAttributes deve limpar mapa de atributos mantendo dados seguros', () => {
    const rawAttrs = {
      'http.method': 'POST',
      'http.status_code': 200,
      email: 'admin@company.io',
      password: 'my-password',
      'service.name': 'order-service',
    };

    const sanitized = sanitizeAttributes(rawAttrs);

    expect(sanitized['http.method']).toBe('POST');
    expect(sanitized['http.status_code']).toBe(200);
    expect(sanitized.email).toBe('[MASKED_EMAIL]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized['service.name']).toBe('order-service');
  });

  test('sanitizeSqlQuery deve remover valores literais de consultas SQL', () => {
    const rawSql = "SELECT * FROM users WHERE email = 'user@example.com' AND age > 21";
    const sanitized = sanitizeSqlQuery(rawSql);

    expect(sanitized).toBe("SELECT * FROM users WHERE email = '?' AND age > ?");
  });
});
