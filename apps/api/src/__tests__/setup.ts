/**
 * Setup global dos testes do backend.
 *
 * Aqui injetamos variaveis de ambiente sinteticas para os testes,
 * evitando que qualquer teste leia .env real e/ou faca chamadas a APIs externas
 * (em conformidade com SECURITY.md - jamais usar credenciais reais em CI).
 */

import { vi, beforeEach } from 'vitest';

// Variaveis fake - nao sao validas para chamadas reais, apenas para satisfazer Zod env check.
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.EXCHANGE_RATE_API_KEY = 'test-exchange-key';
process.env.OPEN_EXCHANGE_RATES_APP_ID = 'test-oer-id';
process.env.NEWS_API_KEY = 'test-news-key';
process.env.GNEWS_API_KEY = 'test-gnews-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379/0';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.FRONTEND_URL = 'http://localhost:5173';

// Antes de cada teste, limpa qualquer mock acumulado para garantir isolamento.
beforeEach(() => {
  vi.clearAllMocks();
});
