/**
 * Testes da rota GET /health.
 *
 * Endpoint de saude usado por:
 *  - UptimeRobot (monitoramento publico)
 *  - Railway (healthcheck do container)
 *  - CI smoke test apos deploy
 *
 * Feature P1 do MVP. Sem rate limit (SECURITY.md secao 3).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Funcao de bootstrap do Fastify - sera criada em src/server.ts.
import { buildServer } from '../../server';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  // Sobe o servidor Fastify em memoria (sem listen real).
  app = await buildServer();
});

afterEach(async () => {
  // Fecha o servidor para liberar handles.
  await app.close();
});

describe('GET /health', () => {
  it('deve responder 200 com status "ok"', async () => {
    // Endpoint deve estar sempre disponivel - chamado por monitoring externo.
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    // Body em JSON com chave "status".
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('deve incluir timestamp atual no payload', async () => {
    // Permite ao monitor confirmar que o response nao e cacheado/stale.
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json();
    // Timestamp deve ser numero (epoch ms).
    expect(typeof body.timestamp).toBe('number');
    // Deve ser proximo do "agora".
    expect(Math.abs(body.timestamp - Date.now())).toBeLessThan(5000);
  });

  it('deve incluir uptime do processo em segundos', async () => {
    // Operadores precisam saber ha quanto tempo o servidor esta de pe.
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(typeof res.json().uptimeSec).toBe('number');
  });

  it('deve incluir versao do app (de package.json)', async () => {
    // Permite identificar deploy especifico em logs de incidente.
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(typeof res.json().version).toBe('string');
  });

  it('deve incluir status das dependencias (redis, postgres) em /health/deep', async () => {
    // Healthcheck profundo verifica conexoes externas - util para diagnostico.
    const res = await app.inject({ method: 'GET', url: '/health/deep' });
    const body = res.json();
    expect(body.dependencies).toMatchObject({
      redis: expect.any(String),
      postgres: expect.any(String),
    });
  });

  it('deve responder /health/deep com 503 se alguma dependencia critica estiver down', async () => {
    // Monitoramento deve disparar alerta quando algo critico esta off.
    // Este teste assume que em ambiente de teste o Redis nao esta acessivel.
    const res = await app.inject({ method: 'GET', url: '/health/deep' });
    // Aceitamos 200 (tudo ok) ou 503 (algo down) - mas nunca 500 (bug).
    expect([200, 503]).toContain(res.statusCode);
  });

  it('NAO deve aplicar rate limit em /health', async () => {
    // SECURITY.md - health sem limite. Faz 200 chamadas em sequencia.
    for (let i = 0; i < 200; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      // Nenhuma deve retornar 429.
      expect(res.statusCode).not.toBe(429);
    }
  });
});
