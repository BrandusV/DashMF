/**
 * Testes do currencyStore (Zustand).
 *
 * Estado central das cotacoes - leitura por hooks, escrita por:
 *  - bootstrap REST (setQuotes)
 *  - QUOTE_UPDATE WS (upsertQuote)
 *
 * Invariantes:
 *  - Pares unicos (upsert por pair, nao push).
 *  - Ordenacao por insercao (estavel para o React reconciliar bem).
 *
 * ADR-002: Zustand foi escolhido por baixo overhead em atualizacoes frequentes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCurrencyStore } from '../currencyStore';

beforeEach(() => {
  // Reseta o estado do store entre testes (evita vazamento).
  useCurrencyStore.setState({ quotes: [] });
});

describe('currencyStore', () => {
  it('deve iniciar com lista vazia', () => {
    // Estado limpo.
    expect(useCurrencyStore.getState().quotes).toEqual([]);
  });

  it('setQuotes deve substituir a lista inteira (bootstrap REST)', () => {
    // Bootstrap inicial = sobrescreve.
    const data = [{ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 }];
    useCurrencyStore.getState().setQuotes(data);
    expect(useCurrencyStore.getState().quotes).toEqual(data);
  });

  it('upsertQuote deve adicionar par novo no final', () => {
    // Primeira ocorrencia do par.
    useCurrencyStore.getState().upsertQuote({
      pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1,
    });
    expect(useCurrencyStore.getState().quotes).toHaveLength(1);
  });

  it('upsertQuote deve atualizar par existente sem duplicar', () => {
    // Crucial - QUOTE_UPDATE chega varias vezes para o mesmo par.
    const store = useCurrencyStore.getState();
    store.upsertQuote({ pair: 'USD/BRL', bid: 5.0, ask: 5.0, mid: 5.0, changePct: 0, timestamp: 1 });
    store.upsertQuote({ pair: 'USD/BRL', bid: 5.1, ask: 5.1, mid: 5.1, changePct: 1, timestamp: 2 });
    const state = useCurrencyStore.getState();
    expect(state.quotes).toHaveLength(1);
    expect(state.quotes[0].mid).toBe(5.1);
  });

  it('upsertQuote NAO deve mudar a ordem dos pares na lista', () => {
    // React reconciliacao - chave estavel para evitar re-render geral.
    const s = useCurrencyStore.getState();
    s.upsertQuote({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    s.upsertQuote({ pair: 'EUR/BRL', bid: 6, ask: 6, mid: 6, changePct: 0, timestamp: 1 });
    s.upsertQuote({ pair: 'USD/BRL', bid: 5.1, ask: 5.1, mid: 5.1, changePct: 1, timestamp: 2 });
    const pairs = useCurrencyStore.getState().quotes.map((q) => q.pair);
    expect(pairs).toEqual(['USD/BRL', 'EUR/BRL']);
  });

  it('clear deve esvaziar a lista', () => {
    // Util para logout/reconexao.
    const s = useCurrencyStore.getState();
    s.upsertQuote({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    s.clear();
    expect(useCurrencyStore.getState().quotes).toEqual([]);
  });
});
