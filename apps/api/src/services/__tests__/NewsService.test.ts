/**
 * Testes do NewsService.
 *
 * Coordena adapters de noticias (NewsAPI primario, GNews fallback).
 * Cache TTL 5min (DATA_GOVERNANCE.md - Conteudo Editorial).
 *
 * Feature P1 do MVP - alimenta o NewsFeed do frontend e o broadcast WS.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsService } from '../NewsService';

const mockNewsAPI = { fetchHeadlines: vi.fn() };
const mockGNews = { fetchHeadlines: vi.fn() };
const mockCache = { get: vi.fn(), set: vi.fn(), del: vi.fn() };

beforeEach(() => {
  // Limpa mocks para garantir isolamento.
  mockNewsAPI.fetchHeadlines.mockReset();
  mockGNews.fetchHeadlines.mockReset();
  mockCache.get.mockReset();
  mockCache.set.mockReset();
  mockCache.del.mockReset();
});

describe('NewsService.getHeadlines', () => {
  it('deve retornar lista do cache quando disponivel', async () => {
    // Cache hit - economiza quota da NewsAPI.
    const cached = [{ id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 }];
    mockCache.get.mockResolvedValueOnce(cached);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    const news = await service.getHeadlines(['forex']);
    // Deve retornar exatamente o cache.
    expect(news).toEqual(cached);
    // Nenhum adapter deve ter sido chamado.
    expect(mockNewsAPI.fetchHeadlines).not.toHaveBeenCalled();
  });

  it('deve consultar NewsAPI em cache miss', async () => {
    mockCache.get.mockResolvedValueOnce(null);
    mockNewsAPI.fetchHeadlines.mockResolvedValueOnce([
      { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 },
    ]);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    await service.getHeadlines(['forex']);
    // Verifica chamada do adapter primario com keywords corretas.
    expect(mockNewsAPI.fetchHeadlines).toHaveBeenCalledWith(['forex']);
  });

  it('deve gravar no cache com TTL 300s (5min) apos sucesso', async () => {
    mockCache.get.mockResolvedValueOnce(null);
    const items = [{ id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 }];
    mockNewsAPI.fetchHeadlines.mockResolvedValueOnce(items);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    await service.getHeadlines(['forex']);
    // TTL 300s conforme DATA_GOVERNANCE.md.
    expect(mockCache.set).toHaveBeenCalledWith(expect.stringMatching(/^news:/), items, 300);
  });

  it('deve fazer fallback para GNews quando NewsAPI falha', async () => {
    mockCache.get.mockResolvedValueOnce(null);
    mockNewsAPI.fetchHeadlines.mockRejectedValueOnce(new Error('rate limit'));
    const fromGNews = [{ id: '2', headline: 'gn', source: 'GNews', url: 'https://g.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 }];
    mockGNews.fetchHeadlines.mockResolvedValueOnce(fromGNews);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    const news = await service.getHeadlines(['forex']);
    // GNews deve ter sido chamado.
    expect(mockGNews.fetchHeadlines).toHaveBeenCalled();
    expect(news).toEqual(fromGNews);
  });

  it('deve deduplicar noticias com mesmo id (mesma URL hash) entre NewsAPI e GNews', async () => {
    // Embora o fallback so chame uma fonte por vez, o service tambem deve mesclar
    // novas com cache antigo sem duplicar.
    const old = [{ id: '1', headline: 'h1', source: 's', url: 'https://a.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 }];
    const fresh = [
      { id: '1', headline: 'h1', source: 's', url: 'https://a.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 2 }, // duplicada
      { id: '2', headline: 'h2', source: 's', url: 'https://b.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 3 },
    ];
    mockCache.get
      .mockResolvedValueOnce(null) // cache miss para a query
      .mockResolvedValueOnce(old); // mas existe cache historico
    mockNewsAPI.fetchHeadlines.mockResolvedValueOnce(fresh);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    const news = await service.getHeadlines(['forex']);
    // Deve ter apenas 2 itens unicos.
    expect(news).toHaveLength(2);
    // A versao mais recente do duplicado deve ter ganhado.
    const item1 = news.find((n) => n.id === '1');
    expect(item1?.publishedAt).toBe(2);
  });

  it('deve ordenar por publishedAt desc (mais recentes primeiro)', async () => {
    mockCache.get.mockResolvedValueOnce(null);
    mockNewsAPI.fetchHeadlines.mockResolvedValueOnce([
      { id: '1', headline: 'antigo', source: 's', url: 'https://a.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 100 },
      { id: '2', headline: 'novo', source: 's', url: 'https://b.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 200 },
    ]);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    const news = await service.getHeadlines(['forex']);
    // O mais recente deve vir primeiro.
    expect(news[0].id).toBe('2');
    expect(news[1].id).toBe('1');
  });

  it('deve limitar resultado a 50 itens (evita payload gigante no WS)', async () => {
    mockCache.get.mockResolvedValueOnce(null);
    // Gera 100 noticias falsas.
    const many = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      headline: `h${i}`,
      source: 's',
      url: `https://x${i}.com`,
      impactedPairs: [],
      sentiment: 'neutral' as const,
      publishedAt: i,
    }));
    mockNewsAPI.fetchHeadlines.mockResolvedValueOnce(many);
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    const news = await service.getHeadlines(['forex']);
    // Cap defensivo - controla bandwidth e tempo de render no frontend.
    expect(news.length).toBeLessThanOrEqual(50);
  });
});

describe('NewsService.filterByPair', () => {
  it('deve filtrar noticias que impactam o par solicitado', async () => {
    // Feature P1 do V1, mas a logica vive aqui.
    const all = [
      { id: '1', headline: 'usd', source: 's', url: 'https://a.com', impactedPairs: ['USD/BRL'], sentiment: 'neutral' as const, publishedAt: 1 },
      { id: '2', headline: 'eur', source: 's', url: 'https://b.com', impactedPairs: ['EUR/BRL'], sentiment: 'neutral' as const, publishedAt: 2 },
    ];
    const service = new NewsService(mockNewsAPI as never, mockGNews as never, mockCache as never);
    const filtered = service.filterByPair(all, 'USD/BRL');
    // So a primeira noticia impacta USD/BRL.
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });
});
