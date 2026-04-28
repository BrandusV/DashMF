/**
 * Testes da rota REST GET /news.
 *
 * Bootstrap inicial do feed de noticias antes do WS conectar.
 * NewsService gerencia cache de 5min (DATA_GOVERNANCE.md secao 1.2).
 *
 * Feature P1 do MVP segundo o ROADMAP.md.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../server';

const mockGetHeadlines = vi.fn();
const mockFilterByPair = vi.fn();

// Mock do NewsService - rota nao chama adapters diretamente.
vi.mock('../../services/NewsService', () => ({
  NewsService: vi.fn().mockImplementation(() => ({
    getHeadlines: mockGetHeadlines,
    filterByPair: mockFilterByPair,
  })),
}));

let app: FastifyInstance;

beforeEach(async () => {
  mockGetHeadlines.mockReset();
  mockFilterByPair.mockReset();
  app = await buildServer();
});

afterEach(async () => {
  await app.close();
});

describe('GET /news', () => {
  it('deve responder 200 com lista de noticias', async () => {
    // Caso feliz: service devolve algumas headlines.
    const items = [
      { id: '1', headline: 'Fed mantem juros', source: 'Reuters', url: 'https://r.com/1', impactedPairs: ['USD/BRL'], sentiment: 'neutral', publishedAt: 1 },
    ];
    mockGetHeadlines.mockResolvedValueOnce(items);
    const res = await app.inject({ method: 'GET', url: '/news' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(items);
  });

  it('deve aceitar ?keywords=forex,economia e repassar ao service', async () => {
    // Cliente pode customizar a busca.
    mockGetHeadlines.mockResolvedValueOnce([]);
    await app.inject({ method: 'GET', url: '/news?keywords=forex,economia' });
    expect(mockGetHeadlines).toHaveBeenCalledWith(['forex', 'economia']);
  });

  it('deve usar keywords padrao quando nenhuma e fornecida', async () => {
    // Default = forex + economia + cambio - listadas em DATA_GOVERNANCE.md.
    mockGetHeadlines.mockResolvedValueOnce([]);
    await app.inject({ method: 'GET', url: '/news' });
    // Service e chamado com array nao vazio.
    expect(mockGetHeadlines).toHaveBeenCalledWith(expect.arrayContaining(['forex']));
  });

  it('deve filtrar por par quando ?pair=USD/BRL e informado', async () => {
    // Feature de filtragem alinhada com V1 do ROADMAP, mas a rota ja prepara.
    const all = [{ id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: ['USD/BRL'], sentiment: 'neutral', publishedAt: 1 }];
    mockGetHeadlines.mockResolvedValueOnce(all);
    mockFilterByPair.mockReturnValueOnce(all);
    await app.inject({ method: 'GET', url: '/news?pair=USD/BRL' });
    // O filtro deve ter sido aplicado.
    expect(mockFilterByPair).toHaveBeenCalledWith(all, 'USD/BRL');
  });

  it('deve responder 400 para ?pair invalido (fora do schema)', async () => {
    // Validacao antes de chegar no service.
    const res = await app.inject({ method: 'GET', url: '/news?pair=usd/brl' });
    expect(res.statusCode).toBe(400);
  });

  it('deve responder 503 quando ambos os adapters falham', async () => {
    // Service lanca quando nao tem fonte disponivel.
    mockGetHeadlines.mockRejectedValueOnce(new Error('news api down'));
    const res = await app.inject({ method: 'GET', url: '/news' });
    expect(res.statusCode).toBe(503);
  });

  it('deve setar Cache-Control max-age=300 para alinhar com TTL Redis (5min)', async () => {
    // DATA_GOVERNANCE.md - noticias TTL 5min.
    mockGetHeadlines.mockResolvedValueOnce([]);
    const res = await app.inject({ method: 'GET', url: '/news' });
    expect(res.headers['cache-control']).toMatch(/max-age=300/);
  });

  it('NAO deve vazar a chave de API em mensagens de erro (SECURITY.md)', async () => {
    // Mensagens upstream podem conter o token.
    mockGetHeadlines.mockRejectedValueOnce(new Error('newsapi.org/v2?apiKey=TOPSECRET fail'));
    const res = await app.inject({ method: 'GET', url: '/news' });
    expect(res.body).not.toContain('TOPSECRET');
  });
});

describe('GET /news - rate limiting', () => {
  it('deve aplicar rate limit (SECURITY.md - 60 req/min)', async () => {
    // News e endpoint cacheado, mas ainda assim tem teto.
    mockGetHeadlines.mockResolvedValue([]);
    let saw429 = false;
    for (let i = 0; i < 80; i++) {
      const res = await app.inject({ method: 'GET', url: '/news' });
      if (res.statusCode === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });
});
