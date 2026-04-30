/**
 * Setup global dos testes do frontend.
 *
 * - Habilita matchers do @testing-library/jest-dom (toBeInTheDocument etc).
 * - Limpa o DOM apos cada teste para isolamento.
 * - Mocka APIs do navegador que jsdom nao implementa (matchMedia, ResizeObserver).
 *
 * Em conformidade com SECURITY.md - testes nunca podem chamar APIs externas
 * (sem fetch real, sem WebSocket real para servidor de producao).
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Compatibilidade vitest <-> @testing-library: o detector de fake timers do
// dom-testing-library (usado por waitFor) checa por `jest`. No vitest a API
// e `vi`. Sem este alias, `waitFor` em testes que usam `vi.useFakeTimers()`
// fica polling via setInterval falso e estoura o timeout de 5s.
// Issue conhecida: https://github.com/testing-library/react-testing-library/issues/1197
// @ts-expect-error - injeta o alias no escopo global.
globalThis.jest = vi;

afterEach(() => {
  // Garante que cada teste comeca com DOM limpo.
  cleanup();
  // Reseta mocks acumulados.
  vi.clearAllMocks();
});

// jsdom nao implementa matchMedia - alguns componentes shadcn/ui usam.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom nao tem ResizeObserver - Recharts depende disso.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error - injeta o stub no escopo global.
global.ResizeObserver = ResizeObserverStub;
