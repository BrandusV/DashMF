/**
 * Worker que mantem o broadcast de cotacoes vivo.
 *
 * Estrategia: setTimeout recursivo (NAO setInterval). Diferenca pratica:
 *  - setInterval enfileira ticks ainda que o anterior nao tenha terminado;
 *    em rede lenta isso geraria backlog crescente.
 *  - setTimeout recursivo so reagenda apos a tick atual completar - cadencia
 *    fica naturalmente ajustada a latencia do upstream.
 *
 * Cancelavel via stopCurrencyPoller (necessario para SIGTERM no Railway -
 * sem isso, o processo nao desliga limpo no deploy/rollback).
 */
import type { Quote } from '@dashmf/types';

interface CurrencyServiceLike {
  getMultipleQuotes: (
    pairs: Array<{ base: string; quote: string }>,
  ) => Promise<Quote[]>;
}

interface BroadcasterLike {
  broadcastQuote: (quote: Quote) => void;
}

export interface CurrencyPollerOptions {
  service: CurrencyServiceLike;
  broadcaster: BroadcasterLike;
  pairs: Array<{ base: string; quote: string }>;
  intervalMs: number;
}

// Estado module-level. MVP roda 1 instancia do worker por processo;
// V1 com Redis pub/sub permitira multiplas instancias coordenadas.
let active = false;
let timer: NodeJS.Timeout | null = null;

export function startCurrencyPoller(opts: CurrencyPollerOptions): void {
  // Idempotencia - se ja rodava, cancela antes de comecar de novo.
  stopCurrencyPoller();
  active = true;

  const tick = async (): Promise<void> => {
    if (!active) return;
    try {
      const quotes = await opts.service.getMultipleQuotes(opts.pairs);
      for (const quote of quotes) {
        opts.broadcaster.broadcastQuote(quote);
      }
    } catch {
      // Erro em uma rodada NUNCA derruba o poller (ROADMAP MVP - resiliencia).
      // Log estruturado fica a cargo do logger Pino quando integrado.
    }
    // Reagendar apos a tick completar - mantem cadencia ajustada a latencia.
    if (active) {
      timer = setTimeout(() => {
        void tick();
      }, opts.intervalMs);
    }
  };

  // Primeira tick "imediata" via setTimeout(0) - permite que startup do
  // Fastify termine antes da primeira chamada externa.
  timer = setTimeout(() => {
    void tick();
  }, 0);
}

export function stopCurrencyPoller(): void {
  active = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
