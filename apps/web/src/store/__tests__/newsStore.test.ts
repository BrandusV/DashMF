/**
 * Testes do newsStore (Zustand).
 *
 * Lista de noticias com:
 *  - Insercao no topo (mais recente primeiro).
 *  - Deduplicacao por id.
 *  - Cap em 50 itens (DATA_GOVERNANCE.md - controle de memoria do client).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNewsStore } from '../newsStore';

beforeEach(() => {
  // Reset entre testes.
  useNewsStore.setState({ items: [] });
});

describe('newsStore', () => {
  it('deve iniciar com lista vazia', () => {
    expect(useNewsStore.getState().items).toEqual([]);
  });

  it('setItems substitui (bootstrap REST)', () => {
    // Bootstrap = state.items = lista nova.
    const items = [
      { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 1 },
    ];
    useNewsStore.getState().setItems(items);
    expect(useNewsStore.getState().items).toEqual(items);
  });

  it('prepend deve adicionar no inicio (mais recente primeiro)', () => {
    // UX requirement.
    const s = useNewsStore.getState();
    s.setItems([
      { id: 'a', headline: 'antigo', source: 's', url: 'https://x.com/a', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 },
    ]);
    s.prepend({ id: 'b', headline: 'novo', source: 's', url: 'https://x.com/b', impactedPairs: [], sentiment: 'neutral', publishedAt: 2 });
    expect(useNewsStore.getState().items[0].id).toBe('b');
  });

  it('prepend NAO deve duplicar quando id ja existe', () => {
    // Defesa contra repeticao do servidor.
    const item = { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 1 };
    const s = useNewsStore.getState();
    s.setItems([item]);
    s.prepend(item);
    expect(useNewsStore.getState().items).toHaveLength(1);
  });

  it('deve manter cap de 50 itens removendo do final ao adicionar', () => {
    // Cap defensivo.
    const fifty = Array.from({ length: 50 }, (_, i) => ({
      id: `i${i}`, headline: `h${i}`, source: 's', url: `https://x.com/${i}`,
      impactedPairs: [], sentiment: 'neutral' as const, publishedAt: i,
    }));
    const s = useNewsStore.getState();
    s.setItems(fifty);
    s.prepend({ id: 'new', headline: 'new', source: 's', url: 'https://x.com/new', impactedPairs: [], sentiment: 'neutral', publishedAt: 9999 });
    const state = useNewsStore.getState();
    expect(state.items).toHaveLength(50);
    expect(state.items[0].id).toBe('new');
  });
});
