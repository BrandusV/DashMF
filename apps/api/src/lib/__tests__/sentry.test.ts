/**
 * Testes do helper initSentry (backend).
 *
 * Helper centraliza a inicializacao do Sentry no Node.js
 * (ROADMAP.md MVP Fase 0 - "Sentry basico (captura de erros)").
 *
 * Mesmo contrato do helper do frontend:
 *  - DSN ausente => init NAO eh chamado.
 *  - DSN presente => init eh chamado com options minimos do MVP.
 *
 * Mockamos o pacote @sentry/node inteiro - testes nao podem instalar
 * handlers globais reais (uncaughtException, unhandledRejection) nem
 * fazer requisicoes externas (SECURITY.md proibe IO real em CI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { initSentry } from '../sentry';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
}));

beforeEach(() => {
  // setup.ts global nao mexe em SENTRY_DSN - garantimos estado limpo
  // antes de cada teste para evitar leak entre cenarios.
  delete process.env.SENTRY_DSN;
});

describe('initSentry (api)', () => {
  it('NAO deve inicializar quando SENTRY_DSN esta ausente', () => {
    // Em test/CI nunca temos DSN real (setup.ts nao injeta) - init ficaria
    // tentando enviar eventos para a internet, o que viola SECURITY.md.
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('NAO deve inicializar quando SENTRY_DSN eh string vazia', () => {
    // .env.example com `SENTRY_DSN=` (chave presente, valor vazio) deve
    // ser tratado como "sem DSN" - evita crash com URL invalida.
    process.env.SENTRY_DSN = '';
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('deve inicializar Sentry com DSN quando SENTRY_DSN esta definido', () => {
    const dsn = 'https://exemplo@o0.ingest.sentry.io/0';
    process.env.SENTRY_DSN = dsn;
    initSentry();
    expect(Sentry.init).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({ dsn });
  });

  it('deve passar environment derivado do NODE_ENV', () => {
    // Sentry usa o environment para separar eventos no dashboard
    // (development vs staging vs production).
    process.env.SENTRY_DSN = 'https://exemplo@o0.ingest.sentry.io/0';
    // setup.ts ja seta NODE_ENV='test'.
    initSentry();
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({
      environment: 'test',
    });
  });

  it('deve passar tracesSampleRate=0 (MVP nao usa performance)', () => {
    // Mesma decisao do helper do frontend: MVP captura apenas erros, sem
    // tracing de performance (V1 reavalia conforme volume e plano).
    process.env.SENTRY_DSN = 'https://exemplo@o0.ingest.sentry.io/0';
    initSentry();
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({
      tracesSampleRate: 0,
    });
  });
});
