/**
 * Store global de cotacoes (Zustand).
 *
 * Estado central das quotes - leitura por componentes/hooks, escrita por:
 *  - useCurrencies: bootstrap REST (`setQuotes`) + QUOTE_UPDATE WS (`upsertQuote`).
 *
 * Invariantes (enforced em currencyStore.test.ts):
 *  - Pares unicos (upsert por `pair`, sem duplicar).
 *  - Ordem de insercao preservada (chave estavel para o React reconciliar
 *    sem remontar todos os widgets a cada update).
 *
 * ADR-002: Zustand foi escolhido (vs Redux) por baixo overhead em
 * atualizacoes frequentes - QUOTE_UPDATE pode chegar a cada 30s para varios
 * pares simultaneamente.
 */
import { create } from 'zustand';
import type { Quote } from '@dashmf/types';

interface CurrencyState {
  quotes: Quote[];
  setQuotes: (quotes: Quote[]) => void;
  upsertQuote: (quote: Quote) => void;
  clear: () => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  quotes: [],
  setQuotes: (quotes) => set({ quotes }),
  upsertQuote: (quote) =>
    set((state) => {
      // Defensivo contra estado corrompido (ex: setQuotes(undefined) por
      // resposta inesperada do backend). Trata como lista vazia em vez de
      // crashar com TypeError.
      const current = state.quotes ?? [];
      const idx = current.findIndex((q) => q.pair === quote.pair);
      if (idx === -1) {
        // Par novo: anexa no final preservando a ordem de chegada.
        return { quotes: [...current, quote] };
      }
      // Substitui in-place mantendo a posicao - evita remount do widget.
      const next = current.slice();
      next[idx] = quote;
      return { quotes: next };
    }),
  clear: () => set({ quotes: [] }),
}));
