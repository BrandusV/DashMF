/**
 * Bootstrap do Fastify - constroi e devolve a instancia do servidor.
 *
 * Exposto como `buildServer()` para que os testes consigam subir o app sem
 * fazer .listen() (Fastify Inject roda os handlers em memoria, sem socket).
 *
 * Ordem dos middlewares respeita a recomendacao do Fastify:
 *  1. helmet (headers de seguranca)
 *  2. cors (politica entre origens)
 *  3. rate-limit (com global=false; cada rota opta por rateLimit no config)
 *  4. rotas
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { ExchangeRateAdapter } from './adapters/ExchangeRateAdapter';
import { BCBAdapter } from './adapters/BCBAdapter';
import { NewsAPIAdapter } from './adapters/NewsAPIAdapter';
import { CacheService } from './services/CacheService';
import { CurrencyService } from './services/CurrencyService';
import { NewsService } from './services/NewsService';
import { healthRoutes } from './routes/health';
import { quotesRoutes } from './routes/quotes';
import { newsRoutes } from './routes/news';
import { Broadcaster } from './websocket/broadcaster';
import { handleClientMessage } from './websocket/handlers';

export async function buildServer(): Promise<FastifyInstance> {
  // logger desligado nos testes para nao poluir o output do vitest.
  const app = Fastify({ logger: false });

  await app.register(helmet);
  await app.register(cors, { origin: process.env.FRONTEND_URL ?? '*' });
  // global: false -> rate limit so vale para rotas que opt-in via config.rateLimit.
  // Permite manter /health sem teto enquanto /quotes e /news sao limitados.
  await app.register(rateLimit, {
    global: false,
    max: 60,
    timeWindow: '1 minute',
  });
  // Plugin do WebSocket - decora app.websocketServer (instancia do ws.Server).
  await app.register(websocket);

  // Em test/dev sem Redis, usamos um stub que simula miss permanente.
  // Producao injeta um cliente ioredis real via REDIS_URL (ver server bootstrap).
  const fakeRedis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
  };
  const cache = new CacheService(fakeRedis as never);

  // Adapters externos. Chaves vem do env (validadas em setup.ts nos testes).
  const exchangeRate = new ExchangeRateAdapter(process.env.EXCHANGE_RATE_API_KEY ?? '');
  const bcb = new BCBAdapter();
  const newsAPI = new NewsAPIAdapter(process.env.NEWS_API_KEY ?? '');
  // GNews adapter ainda nao implementado - reusamos NewsAPIAdapter como
  // placeholder. Sera substituido ao implementar GNewsAdapter (RED tests
  // ainda nao cobrem GNews diretamente).
  const gnews = new NewsAPIAdapter(process.env.GNEWS_API_KEY ?? '');

  const currencyService = new CurrencyService(exchangeRate, bcb, cache);
  const newsService = new NewsService(newsAPI, gnews, cache);

  // Broadcaster compartilhado entre /ws e workers (currency/news pollers).
  const broadcaster = new Broadcaster();
  // Decora a instancia para que workers (registrados externamente) consigam
  // acessar via app.broadcaster sem ter que importar o singleton diretamente.
  app.decorate('broadcaster', broadcaster);

  // Shims que expoem so o que os handlers precisam - mantem o handler puro
  // (sem dependencia direta do Broadcaster) e facil de testar isoladamente.
  const subscriber = {
    addSubscription: (ws: { readyState: number; send: (d: string) => void }, pairs: string[]) =>
      broadcaster.subscribe(ws, pairs),
  };
  // AlertService completo fica para Fase V1 (ROADMAP.md). MVP responde ACK
  // mas ainda nao persiste o alerta nem dispara notificacao.
  const alerts = {
    register: () => undefined,
  };

  await app.register(healthRoutes);
  await app.register(quotesRoutes, { currencyService });
  await app.register(newsRoutes, { newsService });

  // Rota WebSocket - protocolo definido em ARCHITECTURE.md secao 3.
  // @fastify/websocket v10 entrega o `socket` (ws.WebSocket) diretamente como
  // primeiro arg do handler - api antiga `connection.socket` foi removida.
  app.get('/ws', { websocket: true }, (socket) => {
    // setImmediate da tempo do cliente registrar onmessage antes do HELLO.
    // Sem isso, em loopback, o frame chega antes do listener e e descartado.
    setImmediate(() => {
      try {
        socket.send(JSON.stringify({ type: 'HELLO', payload: { version: '0.1.0' } }));
      } catch {
        // Se a conexao ja fechou (cliente desistiu), nao tem o que fazer.
      }
    });
    socket.on('message', (raw: Buffer) => {
      void handleClientMessage(socket, raw.toString(), { subscriber, alerts });
    });
    socket.on('close', () => {
      broadcaster.cleanupDead();
    });
  });

  return app;
}
