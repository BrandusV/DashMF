/**
 * Store de preferencias do usuario (Zustand + persist).
 *
 * Persiste em localStorage via middleware:
 *  - pairs: pares assinados pelo dashboard (defaults cobrem o criterio MVP).
 *  - theme: 'light' | 'dark' (feature backlog do ROADMAP.md).
 *
 * SECURITY.md: jamais armazenar PII no localStorage. Aqui ficam apenas
 * preferencias publicas que nao identificam o usuario.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 5 pares atende ao criterio "ao menos 5 pares atualizando ao vivo"
// (ROADMAP.md - MVP Fase 0 Criterios de aceitacao).
export const DEFAULT_PAIRS = ['USD/BRL', 'EUR/BRL', 'GBP/BRL', 'BTC/USD', 'ETH/USD'];

// Cap espelha o limite do servidor (ARCHITECTURE.md secao 7 -
// "Cotacoes monitoradas: 20 pares") - evita SUBSCRIBE rejeitado pelo backend.
const MAX_PAIRS = 20;

type Theme = 'light' | 'dark';
const VALID_THEMES: readonly Theme[] = ['light', 'dark'];

interface SettingsState {
  pairs: string[];
  theme: Theme;
  addPair: (pair: string) => void;
  removePair: (pair: string) => void;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      pairs: DEFAULT_PAIRS,
      theme: 'light',
      addPair: (pair) => {
        const { pairs } = get();
        // Sem duplicatas e respeitando o cap arquitetural.
        if (pairs.includes(pair) || pairs.length >= MAX_PAIRS) return;
        set({ pairs: [...pairs, pair] });
      },
      removePair: (pair) =>
        set((state) => ({ pairs: state.pairs.filter((p) => p !== pair) })),
      setTheme: (theme) => {
        // Falha rapido em valor fora do enum - protege contra entrada externa
        // (ex: deserializacao de localStorage corrompido manualmente).
        if (!VALID_THEMES.includes(theme)) {
          throw new Error(
            `setTheme: tema invalido "${theme}" - aceitos: ${VALID_THEMES.join(', ')}`,
          );
        }
        set({ theme });
      },
    }),
    {
      // Chave do localStorage. Prefixo identifica este app em browsers
      // compartilhados com outras aplicacoes.
      name: 'dashmf-settings',
      // Versao usada por migrations futuras (V2 vai adicionar favoritos etc).
      version: 1,
    },
  ),
);
