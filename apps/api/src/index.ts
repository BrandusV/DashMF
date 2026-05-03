/**
 * Entry point de producao do backend.
 *
 * server.ts exporta apenas `buildServer()` para que os testes consigam usar
 * Fastify Inject (sem abrir socket TCP). Este arquivo eh o "main" real:
 *  - Constroi a instancia
 *  - Liga em 0.0.0.0:PORT (Railway exige bind em 0.0.0.0, nao em 127.0.0.1)
 *  - Trata SIGTERM/SIGINT para graceful shutdown (Railway/Docker enviam
 *    SIGTERM antes de matar o container)
 *
 * Por que `tsx` em producao em vez de `tsc` + `node dist`: os packages
 * workspace (@dashmf/types, @dashmf/utils) apontam `main` direto para
 * src/index.ts (TypeScript puro, sem build separado). Para `node dist`
 * funcionar precisariamos de bundler (tsup/esbuild) ou build cascateado
 * dos packages - decisao postergada para V1 (ver project_deploy_strategy).
 */
import { buildServer } from './server';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = '0.0.0.0';

async function start(): Promise<void> {
  const app = await buildServer();

  // Graceful shutdown: Railway envia SIGTERM antes de derrubar o container,
  // queremos terminar conexoes WS abertas e drenar requests em voo antes
  // de fechar - evita 502 para clientes no momento do redeploy.
  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[server] recebido ${signal} - iniciando shutdown`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[server] erro durante shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: PORT, host: HOST });
  // eslint-disable-next-line no-console
  console.log(`[server] escutando em http://${HOST}:${PORT}`);
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] falha ao iniciar', err);
  process.exit(1);
});
