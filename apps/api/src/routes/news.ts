/**
 * Rotas REST de noticias.
 *
 *  - GET /news?keywords=...&pair=... : headlines filtradas por keywords e/ou par.
 *
 * Politicas:
 *  - Rate limit 60 req/min por IP (SECURITY.md secao 3).
 *  - Cache-Control max-age=300 alinhado com TTL Redis (DATA_GOVERNANCE.md 1.2).
 *  - Keywords padrao "forex/economia/cambio" - foco do dashboard FX.
 *  - 400 quando o `pair` informado nao casa com ISO-4217 (USD/BRL maiusculo).
 *  - 503 quando os adapters falham, sem vazar a chave de API no body.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { NewsService } from '../services/NewsService';
import type { Pair } from '@dashmf/types';

interface NewsRoutesOptions {
  newsService: NewsService;
}

const PAIR_REGEX = /^[A-Z]{3}\/[A-Z]{3}$/;
// Defaults extraidos do escopo do MVP (DATA_GOVERNANCE.md 1.2 - Conteudo).
const DEFAULT_KEYWORDS = ['forex', 'economia', 'cambio'];
const CACHE_CONTROL_HEADER = 'public, max-age=300';
const SERVICE_UNAVAILABLE_BODY = { error: 'temporarily unavailable' };

const RATE_LIMIT_CONFIG = {
  config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
};

export const newsRoutes: FastifyPluginAsync<NewsRoutesOptions> = async (app, opts) => {
  const { newsService } = opts;

  app.get<{ Querystring: { keywords?: string; pair?: string } }>(
    '/news',
    RATE_LIMIT_CONFIG,
    async (req, reply) => {
      const { keywords, pair } = req.query;
      // Valida pair antes de chamar service - economiza quota se invalido.
      if (pair && !PAIR_REGEX.test(pair)) {
        return reply.code(400).send({ error: 'invalid pair format' });
      }
      const kw = keywords ? keywords.split(',').filter(Boolean) : DEFAULT_KEYWORDS;
      try {
        const items = await newsService.getHeadlines(kw);
        // filterByPair sincroniza apenas quando ha par - V1 expandira o filtro
        // para incluir sentimento e janela temporal.
        const final = pair ? newsService.filterByPair(items, pair as Pair) : items;
        return reply.header('Cache-Control', CACHE_CONTROL_HEADER).send(final);
      } catch (err) {
        app.log.error({ err }, 'getHeadlines failed');
        return reply.code(503).send(SERVICE_UNAVAILABLE_BODY);
      }
    },
  );
};
