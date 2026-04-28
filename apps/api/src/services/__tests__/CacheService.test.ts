/**
 * Testes do CacheService (wrapper sobre ioredis).
 *
 * Cache central usado por CurrencyService e NewsService.
 * - TTL 30s para cotacoes (DATA_GOVERNANCE.md 1.3).
 * - TTL 5min para noticias.
 * - Falhas de Redis NAO devem derrubar a aplicacao - degradacao gracioso.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheService } from '../CacheService';

// Mock simples de ioredis - em vez de subir Redis real.
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
};

beforeEach(() => {
  // Reseta todos os mocks de Redis antes de cada teste.
  Object.values(mockRedis).forEach((fn) => typeof fn === 'function' && fn.mockReset());
});

describe('CacheService.get', () => {
  it('deve retornar o valor parseado quando a chave existe', async () => {
    // Redis devolve JSON serializado.
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ pair: 'USD/BRL', mid: 5.12 }));
    const cache = new CacheService(mockRedis as never);
    const value = await cache.get('quote:USD/BRL');
    // Deve retornar o objeto desserializado.
    expect(value).toEqual({ pair: 'USD/BRL', mid: 5.12 });
  });

  it('deve retornar null quando a chave nao existe', async () => {
    // Redis retorna null para chave inexistente.
    mockRedis.get.mockResolvedValueOnce(null);
    const cache = new CacheService(mockRedis as never);
    expect(await cache.get('quote:XXX/YYY')).toBeNull();
  });

  it('deve retornar null e logar erro quando Redis esta indisponivel (degradacao gracioso)', async () => {
    // Falha de conexao nao pode quebrar o fluxo - service usa fallback.
    mockRedis.get.mockRejectedValueOnce(new Error('Connection refused'));
    const cache = new CacheService(mockRedis as never);
    // O get nao deve lancar - apenas retorna null.
    expect(await cache.get('quote:USD/BRL')).toBeNull();
  });

  it('deve retornar null para JSON corrompido (sem propagar SyntaxError)', async () => {
    // Defesa: dado corrompido em cache nao pode crashar a API.
    mockRedis.get.mockResolvedValueOnce('{invalid json');
    const cache = new CacheService(mockRedis as never);
    expect(await cache.get('quote:USD/BRL')).toBeNull();
  });
});

describe('CacheService.set', () => {
  it('deve serializar o valor como JSON e setar TTL em segundos', async () => {
    // Redis SET com EX (expiracao em segundos).
    const cache = new CacheService(mockRedis as never);
    await cache.set('quote:USD/BRL', { mid: 5.12 }, 30);
    // Verifica que SET foi chamado com EX 30.
    expect(mockRedis.set).toHaveBeenCalledWith('quote:USD/BRL', JSON.stringify({ mid: 5.12 }), 'EX', 30);
  });

  it('deve aceitar TTL padrao de 30s para cotacoes quando nao especificado', async () => {
    // DATA_GOVERNANCE.md fixa TTL 30s para cotacoes.
    const cache = new CacheService(mockRedis as never);
    await cache.set('quote:USD/BRL', { mid: 5.12 });
    expect(mockRedis.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'EX', 30);
  });

  it('NAO deve lancar erro quando Redis esta indisponivel (degradacao gracioso)', async () => {
    // Producao nao pode cair se o cache cair.
    mockRedis.set.mockRejectedValueOnce(new Error('Connection refused'));
    const cache = new CacheService(mockRedis as never);
    // Apenas retorna - operacao silenciosamente skipada.
    await expect(cache.set('k', 'v')).resolves.toBeUndefined();
  });
});

describe('CacheService.del', () => {
  it('deve invalidar a chave no Redis', async () => {
    const cache = new CacheService(mockRedis as never);
    await cache.del('quote:USD/BRL');
    expect(mockRedis.del).toHaveBeenCalledWith('quote:USD/BRL');
  });
});

describe('CacheService - chaves namespaced', () => {
  it('deve gerar chave de cotacao no padrao "quote:{pair}"', () => {
    // Padronizacao do namespace evita colisao com chaves de outras features.
    expect(CacheService.quoteKey('USD/BRL')).toBe('quote:USD/BRL');
  });

  it('deve gerar chave de noticia no padrao "news:{queryHash}"', () => {
    // Noticias sao cacheadas por consulta - hash garante chave estavel.
    const key = CacheService.newsKey(['forex', 'economia']);
    expect(key).toMatch(/^news:[a-f0-9]+$/);
  });
});
