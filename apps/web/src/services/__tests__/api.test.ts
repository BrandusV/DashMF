/**
 * Testes do servico REST do frontend (`services/api.ts`).
 *
 * Cliente HTTP fino que:
 *  - Le base URL de import.meta.env.VITE_API_URL.
 *  - Valida respostas com schemas Zod compartilhados (defesa contra backend bugado).
 *  - Aplica timeout (5s - DATA_GOVERNANCE.md).
 *  - Aborta requisicoes em flight quando o componente desmonta (AbortController).
 *
 * NUNCA faz chamadas reais nos testes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchQuotes, fetchNews } from '../api';

const mockFetch = vi.fn();
beforeEach(() => {
  // Reseta e plug em global.fetch.
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  // VITE_API_URL fake.
  vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
});

describe('fetchQuotes', () => {
  it('deve fazer GET /quotes?pairs=... com os pares informados', async () => {
    // URL precisa estar correta para o backend devolver os pares pedidos.
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await fetchQuotes(['USD/BRL', 'EUR/BRL']);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/quotes?pairs=USD%2FBRL%2CEUR%2FBRL'),
      expect.any(Object),
    );
  });

  it('deve retornar lista de Quote validada', async () => {
    // Resposta valida = parse passa.
    const data = [{ pair: 'USD/BRL', bid: 5, ask: 5.1, mid: 5.05, changePct: 0, timestamp: 1 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });
    const quotes = await fetchQuotes(['USD/BRL']);
    expect(quotes).toEqual(data);
  });

  it('deve lancar erro quando schema rejeita a resposta', async () => {
    // Backend bugado mandando bid negativo - frontend deve recusar.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ pair: 'USD/BRL', bid: -1, ask: 5, mid: 2, changePct: 0, timestamp: 1 }],
    });
    await expect(fetchQuotes(['USD/BRL'])).rejects.toThrow();
  });

  it('deve lancar erro para HTTP nao-2xx', async () => {
    // 5xx do backend deve subir para o caller decidir como mostrar.
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    await expect(fetchQuotes(['USD/BRL'])).rejects.toThrow();
  });

  it('deve usar AbortController quando signal e passado', async () => {
    // Cancelamento previne setState apos unmount.
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    const ctrl = new AbortController();
    await fetchQuotes(['USD/BRL'], { signal: ctrl.signal });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: ctrl.signal }),
    );
  });

  it('deve aplicar timeout de 5s quando nao recebe resposta', async () => {
    // Mock que nunca resolve.
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));
    // Timeout custom curto para velocidade do teste.
    await expect(fetchQuotes(['USD/BRL'], { timeoutMs: 50 })).rejects.toThrow(/timeout/i);
  });
});

describe('fetchNews', () => {
  it('deve fazer GET /news quando keywords nao sao passadas', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await fetchNews();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/news($|\?)/),
      expect.any(Object),
    );
  });

  it('deve montar query ?keywords=forex,economia', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await fetchNews(['forex', 'economia']);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('keywords=forex%2Ceconomia'),
      expect.any(Object),
    );
  });

  it('deve validar resposta com newsItemSchema', async () => {
    // URL invalida = rejeicao.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: '1', headline: 'h', source: 's', url: 'javascript:alert(1)', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 }],
    });
    await expect(fetchNews()).rejects.toThrow();
  });
});
