/**
 * Store global de noticias (Zustand).
 *
 * Lista cronologica reversa (mais recente primeiro):
 *  - useNews popula via REST (`setItems`) e WS NEWS_ALERT (`prepend`).
 *
 * Invariantes (enforced em newsStore.test.ts):
 *  - Insercao no topo (UX: noticia nova sempre visivel).
 *  - Deduplicacao por `id` (defesa contra retransmissao do servidor).
 *  - Cap em 50 itens (DATA_GOVERNANCE.md - controle de memoria do client;
 *    espelha o cap do servidor descrito em ARCHITECTURE.md secao 7).
 */
import { create } from 'zustand';
import type { NewsItem } from '@dashmf/types';

const MAX_ITEMS = 50;

interface NewsState {
  items: NewsItem[];
  setItems: (items: NewsItem[]) => void;
  prepend: (item: NewsItem) => void;
}

export const useNewsStore = create<NewsState>((set) => ({
  items: [],
  // Cap aplicado tambem no setItems para defender de bootstrap REST com
  // payload acima do limite (improvavel mas evita supresa em runtime).
  setItems: (items) => set({ items: items.slice(0, MAX_ITEMS) }),
  prepend: (item) =>
    set((state) => {
      // Dedupe: se ja existe id igual, ignora silenciosamente.
      if (state.items.some((existing) => existing.id === item.id)) {
        return { items: state.items };
      }
      // Cap removendo do final (mais antigos saem para a noticia nova entrar).
      const next = [item, ...state.items];
      return { items: next.slice(0, MAX_ITEMS) };
    }),
}));
