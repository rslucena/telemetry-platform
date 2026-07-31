import type { SpanContext } from '@telemetry/types';

/**
 * Gera um Trace ID W3C de 128 bits (32 caracteres hexadecimais)
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Gera um Span ID W3C de 64 bits (16 caracteres hexadecimais)
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Faz o parse do cabeçalho W3C `traceparent`
 * Formato: version(2)-traceId(32)-parentSpanId(16)-traceFlags(2)
 * Exemplo: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */
export function parseTraceParent(header?: string | null): SpanContext | null {
  if (!header || typeof header !== 'string') return null;

  const parts = header.trim().split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, traceFlagsHex] = parts;

  if (version !== '00') return null;
  if (traceId.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(traceId)) return null;
  if (spanId.length !== 16 || !/^[0-9a-fA-F]{16}$/.test(spanId)) return null;
  if (traceFlagsHex.length !== 2 || !/^[0-9a-fA-F]{2}$/.test(traceFlagsHex)) return null;

  const traceFlags = Number.parseInt(traceFlagsHex, 16);

  return {
    traceId,
    spanId,
    traceFlags,
  };
}

/**
 * Formata um SpanContext no formato de cabeçalho W3C `traceparent`
 */
export function formatTraceParent(context: SpanContext): string {
  const version = '00';
  const traceId = context.traceId.padStart(32, '0');
  const spanId = context.spanId.padStart(16, '0');
  const traceFlagsHex = (context.traceFlags & 0xff).toString(16).padStart(2, '0');

  return `${version}-${traceId}-${spanId}-${traceFlagsHex}`;
}

/**
 * Faz o parse do cabeçalho `tracestate` em chave-valor
 */
export function parseTraceState(header?: string | null): Record<string, string> {
  if (!header || typeof header !== 'string') return {};

  const state: Record<string, string> = {};
  const pairs = header.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.trim().split('=');
    if (key && value) {
      state[key.trim()] = value.trim();
    }
  }

  return state;
}

/**
 * Formata um objeto de pares chave-valor no cabeçalho `tracestate`
 */
export function formatTraceState(state: Record<string, string>): string {
  return Object.entries(state)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
}

export * from './sanitizer';
