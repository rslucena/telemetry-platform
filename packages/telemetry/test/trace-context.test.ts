import { describe, expect, test } from 'bun:test';
import {
  formatTraceParent,
  formatTraceState,
  generateSpanId,
  generateTraceId,
  parseTraceParent,
  parseTraceState,
} from '../src/index';

describe('W3C TraceContext Utilities', () => {
  test('generateTraceId deve gerar 32 caracteres hexadecimais válidos', () => {
    const traceId = generateTraceId();
    expect(traceId).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
  });

  test('generateSpanId deve gerar 16 caracteres hexadecimais válidos', () => {
    const spanId = generateSpanId();
    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
  });

  test('parseTraceParent deve analisar corretamente um cabeçalho válido', () => {
    const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const parsed = parseTraceParent(header);

    expect(parsed).not.toBeNull();
    expect(parsed?.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(parsed?.spanId).toBe('00f067aa0ba902b7');
    expect(parsed?.traceFlags).toBe(1);
  });

  test('parseTraceParent deve retornar null para formato inválido', () => {
    expect(parseTraceParent('invalid-header')).toBeNull();
    expect(parseTraceParent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull(); // versão inválida
  });

  test('formatTraceParent deve formatar SpanContext corretamente', () => {
    const context = {
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
    };

    const header = formatTraceParent(context);
    expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  });

  test('parseTraceState e formatTraceState devem ser bidirecionais', () => {
    const raw = 'congo=t61rcWkgMzE,rojo=00f0';
    const state = parseTraceState(raw);
    expect(state).toEqual({ congo: 't61rcWkgMzE', rojo: '00f0' });

    const formatted = formatTraceState(state);
    expect(formatted).toBe('congo=t61rcWkgMzE,rojo=00f0');
  });
});
