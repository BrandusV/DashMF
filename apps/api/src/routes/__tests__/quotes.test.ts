/**
 * Testes da rota REST GET /quotes.
 *
 * Endpoint historico/sob demanda usado por:
 *  - Frontend ao iniciar (fetch inicial antes do WS conectar)
 *  - ChartPanel da fase V1 (range historico)
 *
 * Nao substitui o WS - serve como fallback e bootstrap.
 * Rate limit ativo (SECURITY.md secao 3 - 60 req/min por IP).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
// Bootstrap em src/server.ts - injeta o CurrencyService via decorator do Fastify.
import { buildServer } from '../../server';

// Mock do CurrencyService - rota nao deve falar com adapters diretamente.
const mockGetQuote = vi.fn();
const mockGetMultipleQuotes = vi.fn();

vi.mock('../../services/CurrencyService', () => ({
  CurrencyService: vi.fn().mockImplementation(() => ({
    getQuote: mockGetQuote,
    getMultipleQuotes: mockGetMultipleQuotes,
  })),
}));

let app: FastifyInstance;

beforeEach(async () => {
  // Limpa qualquer mock acumulado para isolar os testes.
  mockGetQuote.mockReset();
  mockGetMultipleQuotes.mockReset();
  app = await buildServer();
});

afterEach(async () => {
  // Fecha o servidor para liberar conexoes.
  await app.close();
});

describe('GET /quotes/:pair', () => {
  it('deve responder 200 com a cotacao no formato Quote', async () => {
    // Service retorna cotacao valida.
    const quote = { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0.1, timestamp: 1 };
    mockGetQuote.mockResolvedValueOnce(quote);
    const res = await app.inject({ method: 'GET', url: '/quotes/USD/BRL' });
    expect(res.statusCode).toBe(200);
    // Body deve corresponder exatamente ao Quote validado pelo schema.
    expect(res.json()).toEqual(quote);
  });

  it('deve responder 400 para par invalido (formato fora de ISO-4217)', async () => {
    // Schema Zod rejeita - rota nao deve nem chamar o service.
    const res = await app.inject({ method: 'GET', url: '/quotes/usd/brl' });
    expect(res.statusCode).toBe(400);
    expect(mockGetQuote).not.toHaveBeenCalled();
  });

  it('deve responder 404 quando o par nao e suportado pelo MVP (fora dos 20 pares)', async () => {
    // Limite arquitetural ARCHITECTURE.md secao 7.
    const res = await app.inject({ method: 'GET', url: '/quotes/AAA/BBB' });
    expect(res.statusCode).toBe(404);
  });

  it('deve responder 503 quando todas as fontes falham', async () => {
    // Service lanca quando nao tem cache nem adapters disponiveis.
    mockGetQuote.mockRejectedValueOnce(new Error('all sources down'));
    const res = await app.inject({ method: 'GET', url: '/quotes/USD/BRL' });
    expect(res.statusCode).toBe(503);
    // Mensagem amigavel para o cliente, sem stack trace.
    expect(res.json()).toMatchObject({ error: expect.any(String) });
  });

  it('NAO deve vazar mensagem de erro detalhada do adapter (SECURITY.md)', async () => {
    // Mensagem de upstream pode conter chave de API ou path interno.
    mockGetQuote.mockRejectedValueOnce(new Error('exchangerate-api.com/v6/SECRET-KEY/...'));
    const res = await app.inject({ method: 'GET', url: '/quotes/USD/BRL' });
    expect(res.body).not.toContain('SECRET-KEY');
  });
});

describe('GET /quotes (multiplos pares)', () => {
  it('deve aceitar query param ?pairs=USD/BRL,EUR/BRL e retornar array', async () => {
    // Otimizacao: cliente pega varios em uma chamada (reduz round-trips).
    const quotes = [
      { pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0, timestamp: 1 },
      { pair: 'EUR/BRL', bid: 5.50, ask: 5.52, mid: 5.51, changePct: 0, timestamp: 1 },
    ];
    mockGetMultipleQuotes.mockResolvedValueOnce(quotes);
    const res = await app.inject({ method: 'GET', url: '/quotes?pairs=USD/BRL,EUR/BRL' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(quotes);
    // Verifica que o service recebeu os pares parseados.
    expect(mockGetMultipleQuotes).toHaveBeenCalledWith([
      { base: 'USD', quote: 'BRL' },
      { base: 'EUR', quote: 'BRL' },
    ]);
  });

  it('deve responder 400 quando ?pairs esta vazio', async () => {
    // Sem pares = bug do cliente; nao silenciar.
    const res = await app.inject({ method: 'GET', url: '/quotes?pairs=' });
    expect(res.statusCode).toBe(400);
  });

  it('deve responder 400 quando ?pairs contem mais de 20 pares (limite MVP)', async () => {
    // ARCHITECTURE.md secao 7 - 20 pares e o teto.
    const muitos = Array.from({ length: 21 }, (_, i) => `AA${i.toString().padStart(1, '0')}/BBB`).join(',');
    const res = await app.inject({ method: 'GET', url: `/quotes?pairs=${muitos}` });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /quotes - rate limiting', () => {
  it('deve aplicar rate limit de 60 req/min por IP (SECURITY.md)', async () => {
    // Mock retorna sempre rapido para nao ser o gargalo.
    mockGetQuote.mockResolvedValue({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    let saw429 = false;
    // Dispara 80 chamadas rapidas - rate limit deve bloquear apos 60.
    for (let i = 0; i < 80; i++) {
      const res = await app.inject({ method: 'GET', url: '/quotes/USD/BRL' });
      if (res.statusCode === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });
});

describe('GET /quotes - cache headers', () => {
  it('deve setar Cache-Control max-age=30 para alinhar com TTL do Redis', async () => {
    // DATA_GOVERNANCE.md - cotacoes tem TTL 30s.
    mockGetQuote.mockResolvedValueOnce({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    const res = await app.inject({ method: 'GET', url: '/quotes/USD/BRL' });
    expect(res.headers['cache-control']).toMatch(/max-age=30/);
  });
});
