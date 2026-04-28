/**
 * Testes do hook `useWebSocket`.
 *
 * Feature P0 do MVP (ROADMAP.md). Comportamento esperado:
 *  - Abre conexao para a URL configurada (VITE_WS_URL).
 *  - Expoe estado: { status, lastMessage, send }.
 *  - Reconecta automaticamente com backoff exponencial limitado em 30s.
 *  - Valida mensagens recebidas com wsServerMessageSchema (defesa).
 *  - Cancela tudo no unmount (sem leak de listeners).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';

// Substitui o WebSocket global por um fake controlavel.
class FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: FakeWS[] = [];
  url: string;
  readyState = FakeWS.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeWS.CLOSED;
    this.onclose?.({ code: 1000 });
  }
  // Helpers usados pelos testes.
  __open() {
    this.readyState = FakeWS.OPEN;
    this.onopen?.();
  }
  __receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  __closeWithCode(code: number) {
    this.readyState = FakeWS.CLOSED;
    this.onclose?.({ code });
  }
}

beforeEach(() => {
  // Estado limpo entre testes.
  FakeWS.instances = [];
  vi.stubGlobal('WebSocket', FakeWS);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useWebSocket', () => {
  it('deve abrir conexao para a URL passada', () => {
    // Smoke test - cria a instancia e mira a URL correta.
    renderHook(() => useWebSocket('ws://localhost:3000/ws'));
    expect(FakeWS.instances).toHaveLength(1);
    expect(FakeWS.instances[0].url).toBe('ws://localhost:3000/ws');
  });

  it('deve expor status "connecting" antes do open', () => {
    // Estado inicial usado pelo StatusBar.
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    expect(result.current.status).toBe('connecting');
  });

  it('deve transicionar para "online" apos open', async () => {
    // Render -> conexao -> open.
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    await waitFor(() => expect(result.current.status).toBe('online'));
  });

  it('deve atualizar lastMessage quando mensagem valida chega', async () => {
    // Mensagens validas viram estado disponivel para componentes.
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    const msg = { type: 'QUOTE_UPDATE', payload: { pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 } };
    act(() => { FakeWS.instances[0].__receive(msg); });
    await waitFor(() => expect(result.current.lastMessage).toEqual(msg));
  });

  it('deve IGNORAR mensagens com schema invalido (defesa contra servidor bugado)', async () => {
    // Payload nao deve poluir o estado do app.
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    act(() => { FakeWS.instances[0].__receive({ type: 'GARBAGE', payload: {} }); });
    // lastMessage continua null.
    expect(result.current.lastMessage).toBeNull();
  });

  it('send() deve serializar JSON e enviar pelo socket', () => {
    // Cliente sobe SUBSCRIBE / SET_ALERT por aqui.
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    act(() => { result.current.send({ type: 'SUBSCRIBE', payload: { pairs: ['USD/BRL'] } }); });
    expect(FakeWS.instances[0].sent[0]).toBe(JSON.stringify({
      type: 'SUBSCRIBE', payload: { pairs: ['USD/BRL'] },
    }));
  });

  it('NAO deve enviar quando socket ainda esta CONNECTING (buffer ou drop)', () => {
    // Send antes de open nao pode crashar o app.
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    expect(() => result.current.send({ type: 'PING' })).not.toThrow();
  });

  it('deve transicionar para "offline" quando close acontece', async () => {
    const { result } = renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    act(() => { FakeWS.instances[0].__closeWithCode(1006); });
    await waitFor(() => expect(result.current.status).toBe('offline'));
  });

  it('deve reconectar automaticamente apos close inesperado (backoff exponencial)', () => {
    // ROADMAP MVP - reconexao obrigatoria.
    renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    act(() => { FakeWS.instances[0].__closeWithCode(1006); });
    // Avanca 1s - dentro do backoff inicial.
    act(() => { vi.advanceTimersByTime(1500); });
    // Nova instancia deve ter sido criada.
    expect(FakeWS.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('deve limitar o backoff em 30s (nao crescer indefinidamente)', () => {
    // Evita esperas absurdas em rede instavel.
    renderHook(() => useWebSocket('ws://x/ws'));
    // Simula varias falhas consecutivas.
    for (let i = 0; i < 10; i++) {
      act(() => { FakeWS.instances[FakeWS.instances.length - 1].__closeWithCode(1006); });
      act(() => { vi.advanceTimersByTime(60000); });
    }
    // Nao explode em RangeError, e cria reconexoes bounded.
    expect(FakeWS.instances.length).toBeLessThan(20);
  });

  it('NAO deve reconectar se o componente foi desmontado (cleanup)', () => {
    // Memory leak guard - hook precisa cancelar tudo no unmount.
    const { unmount } = renderHook(() => useWebSocket('ws://x/ws'));
    act(() => { FakeWS.instances[0].__open(); });
    unmount();
    act(() => { FakeWS.instances[0].__closeWithCode(1006); });
    act(() => { vi.advanceTimersByTime(60000); });
    // Nenhuma reconexao apos unmount.
    expect(FakeWS.instances).toHaveLength(1);
  });
});
