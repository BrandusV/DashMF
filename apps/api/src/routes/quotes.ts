/**
 * Rotas REST de cotacao.
 *
 *  - GET /quotes/:base/:target   : cotacao de um par especifico.
 *  - GET /quotes?pairs=A/B,C/D    : varios pares em uma chamada (cap 20).
 *
 * Politicas (SECURITY.md, ARCHITECTURE.md, DATA_GOVERNANCE.md):
 *  - Rate limit 60 req/min por IP.
 *  - Cache-Control max-age=30 alinhado com TTL do Redis.
 *  - 400 para formato invalido (par fora de ISO-4217 ou case incorreto).
 *  - 404 para par fora da whitelist do MVP.
 *  - 503 quando ambos os adapters falham, sem vazar mensagem upstream
 *    (que poderia conter chave de API ou path interno).
 */
import type { FastifyPluginAsync } from 'fastify';
import type { CurrencyService } from '../services/CurrencyService';

interface QuotesRoutesOptions {
  currencyService: CurrencyService;
}

// Whitelist do MVP. Ampliar conforme ROADMAP.md (V1 inclui cripto e exoticos).
// 'AAA' fora desta lista forca 404 mesmo com formato valido - sinaliza ao
// cliente que o par nao e suportado, em vez de tentar inutilmente.
const SUPPORTED_CURRENCIES = new Set([
  'USD', 'BRL', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD',
  'NZD', 'CNY', 'MXN', 'ARS', 'BTC', 'ETH',
]);

const ISO_CODE = /^[A-Z]{3}$/;
const PAIR_REGEX = /^[A-Z]{3}\/[A-Z]{3}$/;
const MAX_PAIRS_PER_REQUEST = 20;
const CACHE_CONTROL_HEADER = 'public, max-age=30';
// Mensagem generica - detalhe do erro fica em log interno, nunca no body.
const SERVICE_UNAVAILABLE_BODY = { error: 'temporarily unavailable' };

const RATE_LIMIT_CONFIG = {
  config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
};

export const quotesRoutes: FastifyPluginAsync<QuotesRoutesOptions> = async (app, opts) => {
  const { currencyService } = opts;

  app.get<{ Params: { base: string; target: string } }>(
    '/quotes/:base/:target',
    RATE_LIMIT_CONFIG,
    async (req, reply) => {
      const { base, target } = req.params;
      // Caso fora do formato ISO (ex: minusculas) - 400 sem nem chamar service.
      if (!ISO_CODE.test(base) || !ISO_CODE.test(target)) {
        return reply.code(400).send({ error: 'invalid pair format' });
      }
      // Formato OK mas par nao suportado pelo MVP - 404.
      if (!SUPPORTED_CURRENCIES.has(base) || !SUPPORTED_CURRENCIES.has(target)) {
        return reply.code(404).send({ error: 'pair not supported' });
      }
      try {
        const quote = await currencyService.getQuote(base, target);
        return reply.header('Cache-Control', CACHE_CONTROL_HEADER).send(quote);
      } catch (err) {
        // Log interno preserva contexto; resposta NUNCA carrega detalhe upstream.
        app.log.error({ err }, 'getQuote failed');
        return reply.code(503).send(SERVICE_UNAVAILABLE_BODY);
      }
    },
  );

  app.get<{ Querystring: { pairs?: string } }>(
    '/quotes',
    RATE_LIMIT_CONFIG,
    async (req, reply) => {
      const raw = req.query.pairs;
      if (!raw) {
        return reply.code(400).send({ error: 'pairs query parameter is required' });
      }
      const list = raw.split(',').filter(Boolean);
      if (list.length === 0) {
        return reply.code(400).send({ error: 'pairs is empty' });
      }
      // Cap arquitetural antes da validacao individual - falha barato.
      if (list.length > MAX_PAIRS_PER_REQUEST) {
        return reply
          .code(400)
          .send({ error: `max ${MAX_PAIRS_PER_REQUEST} pairs per request` });
      }
      const parsed: Array<{ base: string; quote: string }> = [];
      for (const entry of list) {
        if (!PAIR_REGEX.test(entry)) {
          return reply.code(400).send({ error: `invalid pair: ${entry}` });
        }
        const [base, target] = entry.split('/');
        parsed.push({ base, quote: target });
      }
      try {
        const quotes = await currencyService.getMultipleQuotes(parsed);
        return reply.header('Cache-Control', CACHE_CONTROL_HEADER).send(quotes);
      } catch (err) {
        app.log.error({ err }, 'getMultipleQuotes failed');
        return reply.code(503).send(SERVICE_UNAVAILABLE_BODY);
      }
    },
  );
};
