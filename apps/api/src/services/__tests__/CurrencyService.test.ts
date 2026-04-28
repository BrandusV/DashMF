/**
 * Testes do CurrencyService.
 *
 * Camada que coordena adapters externos + cache. Usado pelo poller (30s) e pelas rotas REST.
 *
 * Politica:
 *  1. Tenta cache primeiro (Redis, TTL 30s).
 *  2. Se miss, chama adapter primario (ExchangeRate-API).
 *  3. Em falha, faz fallback para BCB (apenas pares com BRL).
 *  4. Persiste resultado no cache antes de retornar.
 *
 * ROADMAP.md - cobertura >= 80% nos services e regra inegociavel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CurrencyService } from '../CurrencyService';

// Mocks dos adapters e do cache - injetados via construtor.
const mockExchangeRate = { fetchQuote: vi.fn() };
const mockBCB = { fetchPtax: vi.fn() };
const mockCache = { get: vi.fn(), set: vi.fn(), del: vi.fn() };

beforeEach(() => {
  // Reseta todos os mocks para evitar vazamento entre testes.
  mockExchangeRate.fetchQuote.mockReset();
  mockBCB.fetchPtax.mockReset();
  mockCache.get.mockReset();
  mockCache.set.mockReset();
  mockCache.del.mockReset();
});

describe('CurrencyService.getQuote', () => {
  it('deve retornar a cotacao do cache quando disponivel (cache hit)', async () => {
    // Cache hit - nao deve chamar nenhuma API externa.
    const cached = { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0, timestamp: 1 };
    mockCache.get.mockResolvedValueOnce(cached);
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    // Solicita a cotacao.
    const quote = await service.getQuote('USD', 'BRL');
    // Deve retornar exatamente o que estava no cache.
    expect(quote).toEqual(cached);
    // Nenhum adapter deve ter sido tocado - economia de quota.
    expect(mockExchangeRate.fetchQuote).not.toHaveBeenCalled();
  });

  it('deve consultar ExchangeRate-API quando ha cache miss', async () => {
    // Cache miss.
    mockCache.get.mockResolvedValueOnce(null);
    // Adapter retorna cotacao.
    const fresh = { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0, timestamp: 1 };
    mockExchangeRate.fetchQuote.mockResolvedValueOnce(fresh);
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    const quote = await service.getQuote('USD', 'BRL');
    // Deve ter chamado o adapter primario.
    expect(mockExchangeRate.fetchQuote).toHaveBeenCalledWith('USD', 'BRL');
    expect(quote).toEqual(fresh);
  });

  it('deve gravar resultado fresh no cache com TTL de 30s', async () => {
    // Cache miss + adapter ok.
    mockCache.get.mockResolvedValueOnce(null);
    const fresh = { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0, timestamp: 1 };
    mockExchangeRate.fetchQuote.mockResolvedValueOnce(fresh);
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    await service.getQuote('USD', 'BRL');
    // Verifica que apos buscar, o service grava no cache (TTL 30s).
    expect(mockCache.set).toHaveBeenCalledWith('quote:USD/BRL', fresh, 30);
  });

  it('deve fazer fallback para BCB quando ExchangeRate-API falha (par com BRL)', async () => {
    // Cache miss + adapter primario falhando.
    mockCache.get.mockResolvedValueOnce(null);
    mockExchangeRate.fetchQuote.mockRejectedValueOnce(new Error('rate limit'));
    // BCB responde com PTAX.
    const ptax = { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0, timestamp: 1 };
    mockBCB.fetchPtax.mockResolvedValueOnce(ptax);
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    const quote = await service.getQuote('USD', 'BRL');
    // BCB deve ter sido chamado como fallback.
    expect(mockBCB.fetchPtax).toHaveBeenCalledWith('USD');
    expect(quote).toEqual(ptax);
  });

  it('deve lancar erro se ambos os adapters falharem (sem cache disponivel)', async () => {
    // Cenario de catastrofe: nenhuma fonte disponivel.
    mockCache.get.mockResolvedValueOnce(null);
    mockExchangeRate.fetchQuote.mockRejectedValueOnce(new Error('down'));
    mockBCB.fetchPtax.mockRejectedValueOnce(new Error('down'));
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    // O chamador (rota REST) recebera 503.
    await expect(service.getQuote('USD', 'BRL')).rejects.toThrow();
  });

  it('NAO deve fazer fallback para BCB em pares sem BRL (ex: BTC/USD)', async () => {
    // BCB nao tem cotacao de BTC - fallback nao se aplica.
    mockCache.get.mockResolvedValueOnce(null);
    mockExchangeRate.fetchQuote.mockRejectedValueOnce(new Error('down'));
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    // BCB nem deve ser tocado.
    await expect(service.getQuote('BTC', 'USD')).rejects.toThrow();
    expect(mockBCB.fetchPtax).not.toHaveBeenCalled();
  });

  it('deve calcular changePct comparando com a ultima cotacao em cache', async () => {
    // Para o widget colorir verde/vermelho (P2 do MVP), precisa do delta.
    // Primeira chamada: cache vazio, mas existe cotacao anterior salva como historico.
    mockCache.get
      .mockResolvedValueOnce(null) // cache atual
      .mockResolvedValueOnce({ mid: 5.00 }); // ultima cotacao registrada
    mockExchangeRate.fetchQuote.mockResolvedValueOnce({
      pair: 'USD/BRL', bid: 5.09, ask: 5.11, mid: 5.10, changePct: 0, timestamp: 2,
    });
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    const quote = await service.getQuote('USD', 'BRL');
    // Variacao = (5.10 - 5.00) / 5.00 * 100 = 2%.
    expect(quote.changePct).toBeCloseTo(2);
  });
});

describe('CurrencyService.getMultipleQuotes', () => {
  it('deve buscar varios pares em paralelo', async () => {
    // Otimizacao: nao fazer N chamadas sequenciais.
    mockCache.get.mockResolvedValue(null);
    mockExchangeRate.fetchQuote.mockResolvedValue({
      pair: 'USD/BRL', bid: 1, ask: 1, mid: 1, changePct: 0, timestamp: 1,
    });
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    const results = await service.getMultipleQuotes([
      { base: 'USD', quote: 'BRL' },
      { base: 'EUR', quote: 'BRL' },
      { base: 'GBP', quote: 'BRL' },
    ]);
    // Deve retornar 3 cotacoes.
    expect(results).toHaveLength(3);
    // Deve ter feito 3 chamadas (paralelas).
    expect(mockExchangeRate.fetchQuote).toHaveBeenCalledTimes(3);
  });

  it('deve continuar mesmo se uma das cotacoes falhar (Promise.allSettled)', async () => {
    // Robustez: 1 par quebrado nao pode anular o broadcast inteiro.
    mockCache.get.mockResolvedValue(null);
    mockExchangeRate.fetchQuote
      .mockResolvedValueOnce({ pair: 'USD/BRL', bid: 1, ask: 1, mid: 1, changePct: 0, timestamp: 1 })
      .mockRejectedValueOnce(new Error('eur down'))
      .mockResolvedValueOnce({ pair: 'GBP/BRL', bid: 1, ask: 1, mid: 1, changePct: 0, timestamp: 1 });
    const service = new CurrencyService(mockExchangeRate as never, mockBCB as never, mockCache as never);
    // BCB tambem falhara para o EUR (mockado para nao retornar).
    mockBCB.fetchPtax.mockRejectedValue(new Error('down'));
    const results = await service.getMultipleQuotes([
      { base: 'USD', quote: 'BRL' },
      { base: 'EUR', quote: 'BRL' },
      { base: 'GBP', quote: 'BRL' },
    ]);
    // Apenas as 2 cotacoes que deram certo.
    expect(results).toHaveLength(2);
  });
});
