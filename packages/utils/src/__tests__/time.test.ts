/**
 * Testes para utilitarios de tempo - usados pelos workers (poller 30s, poller 5min).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Funcoes a serem implementadas em packages/utils/src/time.ts.
import { sleep, withTimeout, exponentialBackoff } from '../time';

beforeEach(() => {
  // Tempo virtual - permite testar timers sem esperar de verdade.
  vi.useFakeTimers();
});

afterEach(() => {
  // Restaura timers reais para nao vazar entre suites.
  vi.useRealTimers();
});

describe('sleep', () => {
  it('deve resolver apos N milissegundos', async () => {
    // Promessa que so resolve quando o timer virtual avanca.
    const promise = sleep(1000);
    // Avanca o relogio virtual em 1s.
    vi.advanceTimersByTime(1000);
    // Apos o avanco, a promessa ja deve ter resolvido.
    await expect(promise).resolves.toBeUndefined();
  });

  it('deve rejeitar para tempo negativo', () => {
    // Evita chamadas absurdas que mascaram bugs.
    expect(() => sleep(-1)).toThrow();
  });
});

describe('withTimeout', () => {
  it('deve resolver com o valor da promessa quando ela termina antes do timeout', async () => {
    // Promessa rapida que resolve imediatamente.
    const promise = Promise.resolve('ok');
    // Encapsulada em withTimeout de 1s, deve preservar o valor.
    await expect(withTimeout(promise, 1000)).resolves.toBe('ok');
  });

  it('deve rejeitar com TimeoutError quando a promessa demora demais', async () => {
    // Promessa que nunca resolve, simulando API externa pendurada.
    const slow = new Promise(() => {});
    // Pegamos a referencia da promessa antes de avancar timers.
    const wrapped = withTimeout(slow, 5000);
    // Avanca alem do limite e captura a rejeicao.
    vi.advanceTimersByTime(5001);
    await expect(wrapped).rejects.toThrow(/timeout/i);
  });
});

describe('exponentialBackoff', () => {
  it('deve calcular delay 100, 200, 400, 800 para tentativas 1..4', () => {
    // Base 100ms, dobrando a cada tentativa - usado no useWebSocket reconnect.
    expect(exponentialBackoff(1, 100)).toBe(100);
    expect(exponentialBackoff(2, 100)).toBe(200);
    expect(exponentialBackoff(3, 100)).toBe(400);
    expect(exponentialBackoff(4, 100)).toBe(800);
  });

  it('deve aplicar teto maximo (cap) para evitar esperas eternas', () => {
    // Cap de 5s impede que apos 20 tentativas o usuario espere minutos.
    expect(exponentialBackoff(20, 100, 5000)).toBe(5000);
  });

  it('deve lancar erro para tentativa < 1', () => {
    // Tentativa zero ou negativa nao tem sentido fisico.
    expect(() => exponentialBackoff(0, 100)).toThrow();
  });
});
