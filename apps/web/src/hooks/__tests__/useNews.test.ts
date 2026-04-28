/**
 * Testes do hook `useNews`.
 *
 * Mesma estrutura de useCurrencies, mas para o newsStore:
 *  - Bootstrap REST (GET /news).
 *  - Cada NEWS_ALERT recebido adiciona no topo da lista.
 *  - Lista cap em 50 itens (UX + bandwidth - DATA_GOVERNANCE.md).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNews } from '../useNews';

const mockFetchNews = vi.fn();
vi.mock('../../services/api', () => ({
  fetchNews: (...args: unknown[]) => mockFetchNews(...args),
}));

const wsState: { status: string; lastMessage: unknown; send: ReturnType<typeof vi.fn> } = {
  status: 'online',
  lastMessage: null,
  send: vi.fn(),
};
vi.mock('../useWebSocket', () => ({
  useWebSocket: () => wsState,
}));

beforeEach(() => {
  // Estado limpo a cada teste.
  mockFetchNews.mockReset();
  wsState.status = 'online';
  wsState.lastMessage = null;
  wsState.send.mockReset();
});

describe('useNews', () => {
  it('deve fazer bootstrap REST de noticias ao montar', async () => {
    // Sem isso, NewsFeed inicia vazio.
    mockFetchNews.mockResolvedValueOnce([
      { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 },
    ]);
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });

  it('deve adicionar NEWS_ALERT no TOPO da lista', async () => {
    // UX: noticias mais recentes ficam visiveis primeiro.
    mockFetchNews.mockResolvedValueOnce([
      { id: 'old', headline: 'antigo', source: 's', url: 'https://x.com/old', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 },
    ]);
    const { result, rerender } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => {
      wsState.lastMessage = {
        type: 'NEWS_ALERT',
        payload: { id: 'new', headline: 'novo', source: 's', url: 'https://x.com/new', impactedPairs: [], sentiment: 'neutral', publishedAt: 2 },
      };
      rerender();
    });
    await waitFor(() => expect(result.current.items[0].id).toBe('new'));
  });

  it('NAO deve duplicar quando NEWS_ALERT chega com id ja existente', async () => {
    // Defesa contra retransmissao do servidor.
    const existing = { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 1 };
    mockFetchNews.mockResolvedValueOnce([existing]);
    const { result, rerender } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => {
      wsState.lastMessage = { type: 'NEWS_ALERT', payload: existing };
      rerender();
    });
    expect(result.current.items).toHaveLength(1);
  });

  it('deve limitar a lista a 50 itens (cap de memoria)', async () => {
    // ARCHITECTURE.md - cap defensivo no cliente espelha o do servidor.
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `i${i}`, headline: `h${i}`, source: 's', url: `https://x.com/${i}`,
      impactedPairs: [], sentiment: 'neutral' as const, publishedAt: i,
    }));
    mockFetchNews.mockResolvedValueOnce(many);
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.items.length).toBeLessThanOrEqual(50));
  });
});
