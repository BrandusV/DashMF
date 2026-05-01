/**
 * Testes do hook `useCurrencies`.
 *
 * Camada de leitura sobre o currencyStore (Zustand).
 * - Inicializa com bootstrap REST (GET /quotes?pairs=...).
 * - Subscreve ao WS e atualiza store em cada QUOTE_UPDATE.
 * - Expoe array ordenado por par para os componentes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCurrencies } from '../useCurrencies';
import { useCurrencyStore } from '../../store/currencyStore';

// Mock do servico REST.
const mockFetchQuotes = vi.fn();
vi.mock('../../services/api', () => ({
  fetchQuotes: (...args: unknown[]) => mockFetchQuotes(...args),
}));

// Mock do hook de WS - retornamos um lastMessage controlavel.
const wsState: { status: string; lastMessage: unknown; send: ReturnType<typeof vi.fn> } = {
  status: 'online',
  lastMessage: null,
  send: vi.fn(),
};
vi.mock('../useWebSocket', () => ({
  useWebSocket: () => wsState,
}));

beforeEach(() => {
  // Reset do estado simulado entre testes.
  mockFetchQuotes.mockReset();
  wsState.status = 'online';
  wsState.lastMessage = null;
  wsState.send.mockReset();
  // Reseta o store Zustand - como e singleton global (ADR-002 em
  // currencyStore.ts), sem reset o estado vaza entre testes e gera flakes.
  useCurrencyStore.setState({ quotes: [] });
});

describe('useCurrencies', () => {
  it('deve carregar bootstrap inicial via REST quando montar', async () => {
    // Sem isso, dashboard ficaria vazio enquanto WS conecta.
    mockFetchQuotes.mockResolvedValueOnce([
      { pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 },
    ]);
    const { result } = renderHook(() => useCurrencies(['USD/BRL']));
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));
    expect(mockFetchQuotes).toHaveBeenCalledWith(['USD/BRL']);
  });

  it('deve enviar SUBSCRIBE assim que o WS estiver online', () => {
    // Sem subscribe, backend nao envia QUOTE_UPDATE para este cliente.
    renderHook(() => useCurrencies(['USD/BRL']));
    expect(wsState.send).toHaveBeenCalledWith({
      type: 'SUBSCRIBE', payload: { pairs: ['USD/BRL'] },
    });
  });

  it('deve atualizar a cotacao quando chega QUOTE_UPDATE pelo WS', async () => {
    // Atualizacao em tempo real via store.
    mockFetchQuotes.mockResolvedValueOnce([]);
    const { result, rerender } = renderHook(() => useCurrencies(['USD/BRL']));
    // Simula chegada de mensagem.
    act(() => {
      wsState.lastMessage = {
        type: 'QUOTE_UPDATE',
        payload: { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0.5, timestamp: 1 },
      };
      rerender();
    });
    await waitFor(() => {
      const usd = result.current.quotes.find((q) => q.pair === 'USD/BRL');
      expect(usd?.changePct).toBe(0.5);
    });
  });

  it('NAO deve atualizar quando lastMessage e de outro tipo (NEWS_ALERT)', async () => {
    // Hook focado so em QUOTE_UPDATE.
    mockFetchQuotes.mockResolvedValueOnce([
      { pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 },
    ]);
    const { result, rerender } = renderHook(() => useCurrencies(['USD/BRL']));
    // Aguarda o bootstrap REST popular o store - sem isso, o `act` sincrono
    // abaixo le o store antes do setQuotes rodar e `find()` retorna undefined.
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));
    act(() => {
      wsState.lastMessage = { type: 'NEWS_ALERT', payload: { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 } };
      rerender();
    });
    // Quote nao mudou.
    const usd = result.current.quotes.find((q) => q.pair === 'USD/BRL');
    expect(usd?.changePct).toBe(0);
  });

  it('deve expor isLoading=true durante o bootstrap REST', async () => {
    // Componentes mostram skeleton enquanto carrega.
    let resolver!: (v: unknown) => void;
    mockFetchQuotes.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    const { result } = renderHook(() => useCurrencies(['USD/BRL']));
    expect(result.current.isLoading).toBe(true);
    await act(async () => { resolver([]); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
