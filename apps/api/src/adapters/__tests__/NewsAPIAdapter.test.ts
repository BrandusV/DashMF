/**
 * Testes do adapter da NewsAPI (https://newsapi.org).
 *
 * - Endpoint REST com API Key no header (DATA_GOVERNANCE.md 1.2).
 * - Free tier limitado a uso em desenvolvimento - producao requer plano Business.
 * - Filtra noticias relevantes a forex/economia.
 *
 * Feature P1 do MVP. Trabalha em conjunto com NewsService e o newsPoller (5 min).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsAPIAdapter } from '../NewsAPIAdapter';

const mockFetch = vi.fn();
beforeEach(() => {
  // Reseta mocks para isolamento dos testes.
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('NewsAPIAdapter.fetchHeadlines', () => {
  it('deve passar a API Key no header X-Api-Key (e nao em query param)', async () => {
    // Boa pratica: header e mais seguro que query string (nao vai para logs de proxy).
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ status: 'ok', articles: [] }),
    });
    const adapter = new NewsAPIAdapter('SECRET-KEY');
    await adapter.fetchHeadlines(['forex']);
    // Verifica o header.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'SECRET-KEY' }) }),
    );
  });

  it('NUNCA deve enviar a API Key como query string ?apiKey=', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'ok', articles: [] }) });
    const adapter = new NewsAPIAdapter('SECRET-KEY');
    await adapter.fetchHeadlines(['forex']);
    // A URL chamada NAO pode conter a chave (regra explicita de SECURITY.md).
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('apiKey=');
    expect(calledUrl).not.toContain('SECRET-KEY');
  });

  it('deve construir query "q" combinando keywords com OR', async () => {
    // NewsAPI espera operadores logicos no parametro q.
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'ok', articles: [] }) });
    const adapter = new NewsAPIAdapter('k');
    await adapter.fetchHeadlines(['forex', 'economia']);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    // O parametro q deve conter ambas as palavras com OR.
    expect(calledUrl).toMatch(/q=forex(%20|\+)OR(%20|\+)economia/);
  });

  it('deve normalizar articles em NewsItem com id estavel (hash da URL)', async () => {
    // Hashing da URL evita duplicatas mesmo se o mesmo titulo aparecer em fontes diferentes.
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        status: 'ok',
        articles: [{
          source: { name: 'Reuters' },
          title: 'Fed mantem juros',
          url: 'https://reuters.com/a',
          publishedAt: '2026-04-26T15:00:00Z',
        }],
      }),
    });
    const adapter = new NewsAPIAdapter('k');
    const news = await adapter.fetchHeadlines(['forex']);
    // Deve ter 1 noticia normalizada.
    expect(news).toHaveLength(1);
    // Campos do contrato NewsItem (ARCHITECTURE.md secao 3).
    expect(news[0]).toMatchObject({
      headline: 'Fed mantem juros',
      source: 'Reuters',
      url: 'https://reuters.com/a',
    });
    // O id deve ser deterministico para a mesma URL (hash).
    expect(news[0].id).toMatch(/^[a-f0-9]{8,}$/);
  });

  it('deve filtrar artigos sem URL (entradas malformadas da API)', async () => {
    // NewsAPI as vezes retorna entries com url=null - devem ser descartadas.
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        status: 'ok',
        articles: [
          { source: { name: 'X' }, title: 't1', url: null, publishedAt: '2026-04-26T15:00:00Z' },
          { source: { name: 'Y' }, title: 't2', url: 'https://y.com', publishedAt: '2026-04-26T15:00:00Z' },
        ],
      }),
    });
    const adapter = new NewsAPIAdapter('k');
    const news = await adapter.fetchHeadlines(['forex']);
    // Apenas o segundo entrou.
    expect(news).toHaveLength(1);
    expect(news[0].url).toBe('https://y.com');
  });

  it('deve marcar sentimento como "neutral" quando ainda nao houver analise (Fase MVP)', async () => {
    // V1 implementara analise real. No MVP todas as noticias sao neutras.
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        status: 'ok',
        articles: [{ source: { name: 'X' }, title: 't', url: 'https://x.com', publishedAt: '2026-04-26T15:00:00Z' }],
      }),
    });
    const adapter = new NewsAPIAdapter('k');
    const news = await adapter.fetchHeadlines(['forex']);
    // Default neutral.
    expect(news[0].sentiment).toBe('neutral');
  });

  it('deve detectar pares impactados pela presenca de simbolos no headline (USD, BRL, EUR...)', async () => {
    // Heuristica simples: se o titulo cita "USD/BRL" ou "real" ou "dolar", marca o par.
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        status: 'ok',
        articles: [{
          source: { name: 'X' },
          title: 'Dolar sobe frente ao real apos decisao do Fed',
          url: 'https://x.com',
          publishedAt: '2026-04-26T15:00:00Z',
        }],
      }),
    });
    const adapter = new NewsAPIAdapter('k');
    const news = await adapter.fetchHeadlines(['forex']);
    // Deve ter detectado USD/BRL.
    expect(news[0].impactedPairs).toContain('USD/BRL');
  });

  it('deve lancar erro quando a NewsAPI retorna status="error"', async () => {
    // Formato de erro proprio da NewsAPI.
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ status: 'error', code: 'apiKeyInvalid', message: 'invalid key' }),
    });
    const adapter = new NewsAPIAdapter('bad');
    // O service de cima pode entao decidir alternar para GNews.
    await expect(adapter.fetchHeadlines(['forex'])).rejects.toThrow();
  });

  it('deve respeitar timeout configurado', async () => {
    // API externa lenta nao pode bloquear o poller indefinidamente.
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));
    const adapter = new NewsAPIAdapter('k', { timeoutMs: 50 });
    await expect(adapter.fetchHeadlines(['forex'])).rejects.toThrow(/timeout/i);
  });
});
