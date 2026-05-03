/**
 * Testes do helper initSentry (frontend).
 *
 * Helper centraliza a inicializacao do Sentry para o bundle do navegador
 * (ROADMAP.md MVP Fase 0 - "Sentry basico (captura de erros)").
 *
 * Comportamento exigido:
 *  - DSN ausente => init NAO eh chamado (dev/test/CI sem credencial nao
 *    devem enviar eventos).
 *  - DSN presente => init eh chamado com options minimos do MVP:
 *      dsn, environment (do MODE do Vite), tracesSampleRate=0 (MVP nao
 *      usa performance/tracing - reduz volume e custo no plano gratuito).
 *
 * Mockamos o pacote @sentry/react inteiro - nao queremos efeitos colaterais
 * de Sentry em testes (envio de eventos, hooks no window, etc).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/react';
import { initSentry } from '../sentry';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
}));

beforeEach(() => {
  // vi.stubEnv eh limpo automaticamente pelo afterEach abaixo. Comecamos
  // sem DSN setado em cada teste para evitar leak entre cenarios.
  vi.stubEnv('VITE_SENTRY_DSN', '');
});

afterEach(() => {
  // Limpa todos os stubs de env aplicados pelo vi.stubEnv.
  vi.unstubAllEnvs();
});

describe('initSentry (web)', () => {
  it('NAO deve inicializar quando VITE_SENTRY_DSN esta ausente', () => {
    // Ambiente de dev/teste/CI nao tem DSN - nao podemos disparar init
    // (Sentry instalaria handlers no window e tentaria enviar eventos).
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('NAO deve inicializar quando VITE_SENTRY_DSN eh string vazia', () => {
    // Caso comum: .env.example com `VITE_SENTRY_DSN=` (chave presente, valor
    // vazio). Tratamos como "sem DSN" para nao quebrar com URL invalida.
    vi.stubEnv('VITE_SENTRY_DSN', '');
    initSentry();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('deve inicializar Sentry com DSN quando VITE_SENTRY_DSN esta definido', () => {
    const dsn = 'https://exemplo@o0.ingest.sentry.io/0';
    vi.stubEnv('VITE_SENTRY_DSN', dsn);
    initSentry();
    expect(Sentry.init).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({ dsn });
  });

  it('deve passar environment derivado do MODE do Vite', () => {
    // Vite expoe import.meta.env.MODE ('development' | 'production' | 'test').
    // Sentry usa isso para separar eventos por ambiente no dashboard.
    vi.stubEnv('VITE_SENTRY_DSN', 'https://exemplo@o0.ingest.sentry.io/0');
    initSentry();
    const opts = vi.mocked(Sentry.init).mock.calls[0][0];
    expect(opts).toMatchObject({ environment: expect.any(String) });
    // No vitest o MODE eh 'test'.
    expect(opts!.environment).toBe('test');
  });

  it('deve passar tracesSampleRate=0 (MVP nao usa performance)', () => {
    // MVP escopo: so captura de erros. Performance/replay aumentam custo e
    // volume de eventos sem ganho concreto agora (V1 reavalia).
    vi.stubEnv('VITE_SENTRY_DSN', 'https://exemplo@o0.ingest.sentry.io/0');
    initSentry();
    expect(vi.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({
      tracesSampleRate: 0,
    });
  });
});
