/**
 * Testes do worker `currencyPoller`.
 *
 * Roda em background a cada 30s (DATA_GOVERNANCE.md - TTL cotacoes).
 * Para cada par monitorado: chama CurrencyService.getQuote e dispara broadcast.
 *
 * Politica:
 *  - Erro em 1 par NAO interrompe os demais.
 *  - Worker tem que ser cancelavel (graceful shutdown).
 *  - Intervalo configuravel via env (POLL_INTERVAL_MS, default 30000).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startCurrencyPoller, stopCurrencyPoller } from '../currencyPoller';

const mockGetQuote = vi.fn();
const mockGetMultipleQuotes = vi.fn();
const mockBroadcastQuote = vi.fn();

beforeEach(() => {
  // Mocks zerados a cada teste.
  mockGetQuote.mockReset();
  mockGetMultipleQuotes.mockReset();
  mockBroadcastQuote.mockReset();
  // Fake timers para controlar setInterval.
  vi.useFakeTimers();
});

afterEach(() => {
  // Garante que nenhum intervalo continua rodando entre testes.
  stopCurrencyPoller();
  vi.useRealTimers();
});

describe('currencyPoller', () => {
  it('deve chamar getMultipleQuotes na primeira tick (sem aguardar 30s)', async () => {
    // Importante: tick imediato evita "tela vazia" enquanto frontend espera.
    mockGetMultipleQuotes.mockResolvedValueOnce([]);
    startCurrencyPoller({
      service: { getQuote: mockGetQuote, getMultipleQuotes: mockGetMultipleQuotes } as never,
      broadcaster: { broadcastQuote: mockBroadcastQuote } as never,
      pairs: [{ base: 'USD', quote: 'BRL' }],
      intervalMs: 30000,
    });
    // Microtask flush para a Promise resolver.
    await vi.runOnlyPendingTimersAsync();
    expect(mockGetMultipleQuotes).toHaveBeenCalledTimes(1);
  });

  it('deve repetir a busca a cada intervalMs', async () => {
    // Simula 3 ticks - 90s de execucao.
    mockGetMultipleQuotes.mockResolvedValue([]);
    startCurrencyPoller({
      service: { getQuote: mockGetQuote, getMultipleQuotes: mockGetMultipleQuotes } as never,
      broadcaster: { broadcastQuote: mockBroadcastQuote } as never,
      pairs: [{ base: 'USD', quote: 'BRL' }],
      intervalMs: 30000,
    });
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(30000);
    await vi.advanceTimersByTimeAsync(30000);
    // 1 (imediato) + 2 (intervalos) = 3.
    expect(mockGetMultipleQuotes).toHaveBeenCalledTimes(3);
  });

  it('deve broadcast cada cotacao retornada (1 send por par)', async () => {
    // Espera 1:1 entre quote e broadcast.
    const quotes = [
      { pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 },
      { pair: 'EUR/BRL', bid: 6, ask: 6, mid: 6, changePct: 0, timestamp: 1 },
    ];
    mockGetMultipleQuotes.mockResolvedValueOnce(quotes);
    startCurrencyPoller({
      service: { getQuote: mockGetQuote, getMultipleQuotes: mockGetMultipleQuotes } as never,
      broadcaster: { broadcastQuote: mockBroadcastQuote } as never,
      pairs: [{ base: 'USD', quote: 'BRL' }, { base: 'EUR', quote: 'BRL' }],
      intervalMs: 30000,
    });
    await vi.runOnlyPendingTimersAsync();
    expect(mockBroadcastQuote).toHaveBeenCalledTimes(2);
    expect(mockBroadcastQuote).toHaveBeenCalledWith(quotes[0]);
    expect(mockBroadcastQuote).toHaveBeenCalledWith(quotes[1]);
  });

  it('NAO deve crashar quando getMultipleQuotes lanca erro', async () => {
    // Worker e robusto - falha de fonte nao derruba o servico.
    mockGetMultipleQuotes.mockRejectedValueOnce(new Error('all sources down'));
    expect(() => {
      startCurrencyPoller({
        service: { getQuote: mockGetQuote, getMultipleQuotes: mockGetMultipleQuotes } as never,
        broadcaster: { broadcastQuote: mockBroadcastQuote } as never,
        pairs: [{ base: 'USD', quote: 'BRL' }],
        intervalMs: 30000,
      });
    }).not.toThrow();
    await vi.runOnlyPendingTimersAsync();
    // Erro silencioso (logado mas nao propagado).
    expect(mockBroadcastQuote).not.toHaveBeenCalled();
  });

  it('deve respeitar pairs configuradas no startup', async () => {
    // Worker nao pode poluir tabelas de outras moedas.
    mockGetMultipleQuotes.mockResolvedValueOnce([]);
    startCurrencyPoller({
      service: { getQuote: mockGetQuote, getMultipleQuotes: mockGetMultipleQuotes } as never,
      broadcaster: { broadcastQuote: mockBroadcastQuote } as never,
      pairs: [{ base: 'USD', quote: 'BRL' }, { base: 'EUR', quote: 'BRL' }],
      intervalMs: 30000,
    });
    await vi.runOnlyPendingTimersAsync();
    expect(mockGetMultipleQuotes).toHaveBeenCalledWith([
      { base: 'USD', quote: 'BRL' },
      { base: 'EUR', quote: 'BRL' },
    ]);
  });
});

describe('stopCurrencyPoller', () => {
  it('deve cancelar o setInterval (nao chama mais o service)', async () => {
    // Graceful shutdown - obrigatorio para deploy/restart limpo.
    mockGetMultipleQuotes.mockResolvedValue([]);
    startCurrencyPoller({
      service: { getQuote: mockGetQuote, getMultipleQuotes: mockGetMultipleQuotes } as never,
      broadcaster: { broadcastQuote: mockBroadcastQuote } as never,
      pairs: [{ base: 'USD', quote: 'BRL' }],
      intervalMs: 30000,
    });
    await vi.runOnlyPendingTimersAsync();
    const callsBefore = mockGetMultipleQuotes.mock.calls.length;
    stopCurrencyPoller();
    // Avanca o relogio - se o stop funcionou, contador nao aumenta.
    await vi.advanceTimersByTimeAsync(60000);
    expect(mockGetMultipleQuotes.mock.calls.length).toBe(callsBefore);
  });
});
