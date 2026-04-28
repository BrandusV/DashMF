/**
 * Testes do settingsStore (Zustand).
 *
 * Persiste preferencias do usuario em localStorage:
 *  - Pares assinados (default: USD/BRL, EUR/BRL, GBP/BRL, BTC/USD, ETH/USD).
 *  - Tema (light | dark) - feature backlog.
 *
 * SECURITY.md - jamais armazenar PII no localStorage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore, DEFAULT_PAIRS } from '../settingsStore';

beforeEach(() => {
  // Limpa storage e estado.
  localStorage.clear();
  useSettingsStore.persist?.clearStorage?.();
  useSettingsStore.setState({ pairs: DEFAULT_PAIRS, theme: 'light' });
});

describe('settingsStore', () => {
  it('deve inicializar com 5 pares default (MVP - 5 pares minimos)', () => {
    // ROADMAP MVP - "ao menos 5 pares atualizando ao vivo".
    expect(useSettingsStore.getState().pairs).toHaveLength(5);
  });

  it('addPair deve incluir um par novo', () => {
    const s = useSettingsStore.getState();
    s.addPair('JPY/BRL');
    expect(useSettingsStore.getState().pairs).toContain('JPY/BRL');
  });

  it('addPair NAO deve duplicar par ja existente', () => {
    const s = useSettingsStore.getState();
    const before = s.pairs.length;
    s.addPair('USD/BRL'); // ja esta no default
    expect(useSettingsStore.getState().pairs).toHaveLength(before);
  });

  it('addPair deve respeitar limite de 20 pares (ARCHITECTURE.md secao 7)', () => {
    // Espelha o limite do servidor.
    const s = useSettingsStore.getState();
    // Tenta adicionar ate 30 - so 20 devem entrar.
    for (let i = 0; i < 30; i++) s.addPair(`A${i.toString().padStart(2, '0')}/BBB`);
    expect(useSettingsStore.getState().pairs.length).toBeLessThanOrEqual(20);
  });

  it('removePair deve remover o par da lista', () => {
    const s = useSettingsStore.getState();
    s.removePair('USD/BRL');
    expect(useSettingsStore.getState().pairs).not.toContain('USD/BRL');
  });

  it('setTheme deve alternar entre light e dark', () => {
    // Feature backlog - dark mode.
    const s = useSettingsStore.getState();
    s.setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('NAO deve aceitar tema fora do enum (light | dark)', () => {
    const s = useSettingsStore.getState();
    // @ts-expect-error - validacao runtime.
    expect(() => s.setTheme('rainbow')).toThrow();
  });
});
