/**
 * Inicializa o Sentry no bundle do frontend.
 *
 * Por que helper em vez de chamar Sentry.init direto no main.tsx:
 *  - Permite teste isolado da decisao "init ou nao" (ver __tests__/sentry.test.ts).
 *  - Centraliza opcoes - main.tsx fica enxuto.
 *
 * Por que noop quando DSN ausente:
 *  - Em dev/test/CI nao temos credencial e nao queremos handlers do Sentry
 *    no window nem tentativas de envio. Tratamos string vazia como ausente
 *    (caso comum do .env.example com valor em branco).
 *
 * Sobre o DSN ser publico: a documentacao oficial do Sentry classifica o DSN
 * do navegador como nao-secreto (so permite enviar eventos, nao ler dados).
 * Por isso pode entrar no bundle via VITE_SENTRY_DSN sem violar SECURITY.md.
 *
 * Escopo MVP (ROADMAP.md Fase 0): apenas captura de erros. Performance,
 * session replay e profiling ficam para V1.
 */
import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    // Nada a fazer - dev/test/CI sem credencial.
    return;
  }
  Sentry.init({
    dsn,
    // MODE eh injetado pelo Vite ('development' | 'production' | 'test').
    environment: import.meta.env.MODE,
    // 0 = nao captura traces de performance no MVP. Reavaliar em V1 conforme
    // volume e plano contratado do Sentry.
    tracesSampleRate: 0,
  });
}
