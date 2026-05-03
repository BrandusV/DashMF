/**
 * Inicializa o Sentry no processo Node do backend.
 *
 * Mesmo contrato do helper do frontend (apps/web/src/lib/sentry.ts) - manter
 * simetria entre os dois ajuda a raciocinar sobre o sistema de observabilidade
 * como um todo:
 *  - DSN ausente => noop (dev/test/CI sem credencial real).
 *  - DSN presente => init com opcoes minimas do MVP.
 *
 * Por que helper em vez de Sentry.init direto no server.ts:
 *  - Permite teste isolado do "init ou nao" sem instalar handlers globais
 *    reais durante o vitest (SECURITY.md - sem IO externo em CI).
 *  - Centraliza opcoes - facilita evoluir para V1 (samplers customizados,
 *    integracoes do Fastify, beforeSend para PII scrubbing, etc).
 *
 * Escopo MVP (ROADMAP.md Fase 0): apenas captura de excecoes nao tratadas
 * (uncaughtException + unhandledRejection - handlers instalados pelo proprio
 * Sentry no init). Performance/tracing fica para V1.
 */
import * as Sentry from '@sentry/node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // Nada a fazer - dev/test/CI sem credencial.
    return;
  }
  Sentry.init({
    dsn,
    // SECURITY.md lista NODE_ENV como variavel obrigatoria - confiavel para
    // distinguir ambientes no dashboard do Sentry.
    environment: process.env.NODE_ENV,
    // 0 = sem traces de performance no MVP. Reavaliar em V1 conforme volume
    // e plano contratado (plano gratuito tem cota baixa de traces).
    tracesSampleRate: 0,
  });
}
