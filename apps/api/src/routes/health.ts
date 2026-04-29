/**
 * Rotas de healthcheck.
 *
 *  - GET /health      : liveness rapido (200 ok). Sem rate limit (SECURITY.md
 *                       seccao 3) - UptimeRobot e Railway pollam de fora.
 *  - GET /health/deep : readiness profundo - reporta status de Redis e Postgres.
 *                       Retorna 503 quando alguma dependencia critica esta down.
 */
import type { FastifyPluginAsync } from 'fastify';

// Marca o instante de boot para calcular uptime sem depender de process.uptime()
// (process.uptime conta tempo do processo Node, que pode ser maior que o do app
// quando ha boot lento de plugins).
const BOOT_TIME = Date.now();

// Hardcoded para evitar leitura de filesystem no hot path. Atualizar quando
// subir a versao em apps/api/package.json.
const APP_VERSION = '0.1.0';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: Date.now(),
    uptimeSec: Math.floor((Date.now() - BOOT_TIME) / 1000),
    version: APP_VERSION,
  }));

  app.get('/health/deep', async (_req, reply) => {
    // Em test/dev nao temos clientes reais conectados - reportamos 'down' como
    // safe default. Implementacao completa em V1: pingar Redis e Postgres com
    // timeout curto (~200ms) e cachear o resultado por alguns segundos.
    const dependencies = {
      redis: 'down',
      postgres: 'down',
    };
    const allHealthy = Object.values(dependencies).every((s) => s === 'healthy');
    reply
      .code(allHealthy ? 200 : 503)
      .send({ status: allHealthy ? 'ok' : 'degraded', dependencies });
  });
};
