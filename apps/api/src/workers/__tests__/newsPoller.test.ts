/**
 * Testes do worker `newsPoller`.
 *
 * Roda a cada 5min (DATA_GOVERNANCE.md - TTL editorial).
 * Comportamento equivalente ao currencyPoller, mas:
 *  - Itens NOVOS desde a ultima rodada disparam NEWS_ALERT (broadcast).
 *  - Itens repetidos NAO sao re-broadcastados (deduplicado por id).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startNewsPoller, stopNewsPoller } from '../newsPoller';

const mockGetHeadlines = vi.fn();
const mockBroadcastNews = vi.fn();

beforeEach(() => {
  mockGetHeadlines.mockReset();
  mockBroadcastNews.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  // Cancela qualquer timer remanescente.
  stopNewsPoller();
  vi.useRealTimers();
});

describe('newsPoller', () => {
  it('deve chamar getHeadlines na primeira tick (sem esperar 5min)', async () => {
    // Boot rapido - frontend nao fica vazio aguardando 5min.
    mockGetHeadlines.mockResolvedValueOnce([]);
    startNewsPoller({
      service: { getHeadlines: mockGetHeadlines } as never,
      broadcaster: { broadcastNews: mockBroadcastNews } as never,
      keywords: ['forex'],
      intervalMs: 300000,
    });
    await vi.runOnlyPendingTimersAsync();
    expect(mockGetHeadlines).toHaveBeenCalledTimes(1);
  });

  it('deve broadcast apenas itens cujo id ainda nao foi visto', async () => {
    // Deduplicacao por id - economia de banda WS.
    const item1 = { id: '1', headline: 'h1', source: 's', url: 'https://x.com/1', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 1 };
    const item2 = { id: '2', headline: 'h2', source: 's', url: 'https://x.com/2', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 2 };
    // Tick 1: retorna so o item1.
    mockGetHeadlines.mockResolvedValueOnce([item1]);
    // Tick 2: retorna item1 (ja visto) + item2 (novo).
    mockGetHeadlines.mockResolvedValueOnce([item1, item2]);
    startNewsPoller({
      service: { getHeadlines: mockGetHeadlines } as never,
      broadcaster: { broadcastNews: mockBroadcastNews } as never,
      keywords: ['forex'],
      intervalMs: 300000,
    });
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(300000);
    // Total deve ser 2 (item1 + item2), nao 3.
    expect(mockBroadcastNews).toHaveBeenCalledTimes(2);
    expect(mockBroadcastNews).toHaveBeenCalledWith(item1);
    expect(mockBroadcastNews).toHaveBeenCalledWith(item2);
  });

  it('NAO deve broadcastar quando getHeadlines retorna lista vazia', async () => {
    // Sem novidade = sem mensagem.
    mockGetHeadlines.mockResolvedValueOnce([]);
    startNewsPoller({
      service: { getHeadlines: mockGetHeadlines } as never,
      broadcaster: { broadcastNews: mockBroadcastNews } as never,
      keywords: ['forex'],
      intervalMs: 300000,
    });
    await vi.runOnlyPendingTimersAsync();
    expect(mockBroadcastNews).not.toHaveBeenCalled();
  });

  it('NAO deve crashar quando getHeadlines lanca', async () => {
    // Robustez - falha em uma rodada nao para o worker.
    mockGetHeadlines.mockRejectedValueOnce(new Error('news api down'));
    expect(() => {
      startNewsPoller({
        service: { getHeadlines: mockGetHeadlines } as never,
        broadcaster: { broadcastNews: mockBroadcastNews } as never,
        keywords: ['forex'],
        intervalMs: 300000,
      });
    }).not.toThrow();
    await vi.runOnlyPendingTimersAsync();
    // Sem broadcast.
    expect(mockBroadcastNews).not.toHaveBeenCalled();
  });

  it('deve continuar tickando mesmo apos erro em uma rodada', async () => {
    // Falha transitoria nao deve cancelar o poller.
    mockGetHeadlines
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce([{ id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 1 }]);
    startNewsPoller({
      service: { getHeadlines: mockGetHeadlines } as never,
      broadcaster: { broadcastNews: mockBroadcastNews } as never,
      keywords: ['forex'],
      intervalMs: 300000,
    });
    await vi.runOnlyPendingTimersAsync();
    await vi.advanceTimersByTimeAsync(300000);
    // Segunda tick conseguiu broadcast.
    expect(mockBroadcastNews).toHaveBeenCalledTimes(1);
  });
});

describe('stopNewsPoller', () => {
  it('deve cancelar o intervalo (graceful shutdown)', async () => {
    // Necessario para SIGTERM no Railway.
    mockGetHeadlines.mockResolvedValue([]);
    startNewsPoller({
      service: { getHeadlines: mockGetHeadlines } as never,
      broadcaster: { broadcastNews: mockBroadcastNews } as never,
      keywords: ['forex'],
      intervalMs: 300000,
    });
    await vi.runOnlyPendingTimersAsync();
    const callsBefore = mockGetHeadlines.mock.calls.length;
    stopNewsPoller();
    await vi.advanceTimersByTimeAsync(600000);
    expect(mockGetHeadlines.mock.calls.length).toBe(callsBefore);
  });
});
