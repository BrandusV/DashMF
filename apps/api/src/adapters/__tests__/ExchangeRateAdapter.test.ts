/**
 * Testes do adapter da ExchangeRate-API.
 *
 * Responsabilidades do adapter (ExchangeRateAdapter.ts a ser criado):
 *  - chamar https://v6.exchangerate-api.com/v6/{KEY}/latest/{base}
 *  - validar resposta com Zod
 *  - normalizar para o formato Quote interno
 *  - lidar com erros de rede e rate limit (DATA_GOVERNANCE.md)
 *
 * NUNCA fazer chamadas HTTP reais nos testes - sempre mock fetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// Classe a ser implementada apos os testes (TDD).
import { ExchangeRateAdapter } from '../ExchangeRateAdapter';

// Mock global do fetch - nenhum teste deve sair pela rede.
const mockFetch = vi.fn();
beforeEach(() => {
  // Reseta o fetch e injeta no global.
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('ExchangeRateAdapter.fetchQuote', () => {
  it('deve fazer GET no endpoint correto com a chave da API no path', async () => {
    // Resposta sintetica no formato esperado da ExchangeRate-API.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', base_code: 'USD', conversion_rates: { BRL: 5.12 } }),
    });
    // Instancia com chave fake - chave real fica em process.env.
    const adapter = new ExchangeRateAdapter('fake-key');
    // Chama o adapter pedindo USD -> BRL.
    await adapter.fetchQuote('USD', 'BRL');
    // Verifica que a URL contem a base e a chave.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v6/fake-key/latest/USD'),
      expect.any(Object),
    );
  });

  it('deve retornar Quote com pair, bid, ask, mid, changePct e timestamp', async () => {
    // Resposta com taxa BRL = 5.12.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', base_code: 'USD', conversion_rates: { BRL: 5.12 } }),
    });
    const adapter = new ExchangeRateAdapter('k');
    // Executa a chamada.
    const quote = await adapter.fetchQuote('USD', 'BRL');
    // O par deve estar no formato canonico.
    expect(quote.pair).toBe('USD/BRL');
    // bid e ask devem ser derivados (mid = 5.12, spread sintetico para free tier).
    expect(quote.bid).toBeLessThanOrEqual(quote.ask);
    // O mid deve refletir a taxa central retornada pela API.
    expect(quote.mid).toBeCloseTo(5.12, 2);
    // Timestamp deve ser epoch ms recente.
    expect(quote.timestamp).toBeGreaterThan(0);
  });

  it('deve lancar erro quando a API responde com status != 200', async () => {
    // Simula erro HTTP 500 da API externa.
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) });
    const adapter = new ExchangeRateAdapter('k');
    // O erro precisa ser lancado para o service decidir entre fallback ou cache.
    await expect(adapter.fetchQuote('USD', 'BRL')).rejects.toThrow();
  });

  it('deve lancar erro quando a API retorna result="error"', async () => {
    // ExchangeRate-API usa formato proprio de erro (result=error).
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'error', 'error-type': 'invalid-key' }),
    });
    const adapter = new ExchangeRateAdapter('bad-key');
    // Deve traduzir para Error com a causa apontada.
    await expect(adapter.fetchQuote('USD', 'BRL')).rejects.toThrow(/invalid-key/);
  });

  it('deve lancar erro quando o par solicitado nao existe nas conversion_rates', async () => {
    // API responde sucesso mas sem o par pedido.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ result: 'success', base_code: 'USD', conversion_rates: { EUR: 0.92 } }),
    });
    const adapter = new ExchangeRateAdapter('k');
    // Como BRL nao foi retornado, o adapter sinaliza inconsistencia.
    await expect(adapter.fetchQuote('USD', 'BRL')).rejects.toThrow();
  });

  it('deve aplicar timeout (DATA_GOVERNANCE.md: max 5s para APIs externas)', async () => {
    // Mock que nunca resolve, simulando API pendurada.
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));
    const adapter = new ExchangeRateAdapter('k', { timeoutMs: 50 });
    // Deve abortar antes do tempo se nao houver resposta.
    await expect(adapter.fetchQuote('USD', 'BRL')).rejects.toThrow(/timeout/i);
  });

  it('NAO deve logar a chave da API em mensagens de erro (SECURITY.md)', async () => {
    // Mock que falha.
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const adapter = new ExchangeRateAdapter('SUPER-SECRET-KEY');
    // Captura a excecao.
    try {
      await adapter.fetchQuote('USD', 'BRL');
    } catch (e) {
      // A chave NUNCA pode aparecer no message - regra de SECURITY.md.
      expect((e as Error).message).not.toContain('SUPER-SECRET-KEY');
    }
  });
});
