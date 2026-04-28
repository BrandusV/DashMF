/**
 * Testes dos handlers de mensagens WS (cliente -> servidor).
 *
 * handlers.ts sera responsavel por:
 *  - Validar a mensagem com wsClientMessageSchema (Zod)
 *  - Despachar para o handler correto (subscribe / setAlert / ping)
 *  - Responder ACK / PONG / ERROR de forma uniforme
 *
 * Cobertura >= 80% obrigatoria por ROADMAP.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleClientMessage } from '../handlers';

// Conexao WS fake - so precisamos do .send() para inspecionar respostas.
function makeFakeSocket() {
  const sent: string[] = [];
  return {
    sent,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
  };
}

// Servicos mockados que os handlers usarao via injecao.
const mockSubscriber = { addSubscription: vi.fn(), removeSubscription: vi.fn() };
const mockAlertService = { register: vi.fn() };

beforeEach(() => {
  // Reseta para isolar cada teste.
  mockSubscriber.addSubscription.mockReset();
  mockSubscriber.removeSubscription.mockReset();
  mockAlertService.register.mockReset();
});

describe('handleClientMessage - SUBSCRIBE', () => {
  it('deve registrar a subscricao para os pares informados', async () => {
    // Caso feliz - subscribe valido.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, JSON.stringify({
      type: 'SUBSCRIBE',
      payload: { pairs: ['USD/BRL', 'EUR/BRL'] },
    }), { subscriber: mockSubscriber as never, alerts: mockAlertService as never });
    expect(mockSubscriber.addSubscription).toHaveBeenCalledWith(ws, ['USD/BRL', 'EUR/BRL']);
    // Resposta ACK enviada.
    expect(ws.sent.some((s) => JSON.parse(s).type === 'ACK')).toBe(true);
  });

  it('deve responder ERROR com motivo quando schema rejeita', async () => {
    // Pares vazios - schema deve falhar.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, JSON.stringify({
      type: 'SUBSCRIBE',
      payload: { pairs: [] },
    }), { subscriber: mockSubscriber as never, alerts: mockAlertService as never });
    const reply = ws.sent.map((s) => JSON.parse(s)).find((m) => m.type === 'ERROR');
    expect(reply).toBeTruthy();
    // Servico de subscricao NAO deve ter sido tocado.
    expect(mockSubscriber.addSubscription).not.toHaveBeenCalled();
  });
});

describe('handleClientMessage - SET_ALERT', () => {
  it('deve registrar alerta valido no AlertService', async () => {
    // Feature P0 V1.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, JSON.stringify({
      type: 'SET_ALERT',
      payload: { pair: 'USD/BRL', condition: 'above', threshold: 5.20 },
    }), { subscriber: mockSubscriber as never, alerts: mockAlertService as never });
    expect(mockAlertService.register).toHaveBeenCalledWith(ws, {
      pair: 'USD/BRL', condition: 'above', threshold: 5.20,
    });
  });

  it('deve responder ERROR para threshold negativo', async () => {
    // Schema rejeita - mas o handler tem que devolver ERROR ao cliente.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, JSON.stringify({
      type: 'SET_ALERT',
      payload: { pair: 'USD/BRL', condition: 'above', threshold: -1 },
    }), { subscriber: mockSubscriber as never, alerts: mockAlertService as never });
    expect(ws.sent.some((s) => JSON.parse(s).type === 'ERROR')).toBe(true);
    expect(mockAlertService.register).not.toHaveBeenCalled();
  });
});

describe('handleClientMessage - PING', () => {
  it('deve responder PONG imediatamente', async () => {
    // Keep-alive deve ser sincrono (ou quase) para detectar conexao morta.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, JSON.stringify({ type: 'PING' }), {
      subscriber: mockSubscriber as never, alerts: mockAlertService as never,
    });
    const reply = JSON.parse(ws.sent[0]);
    expect(reply.type).toBe('PONG');
  });
});

describe('handleClientMessage - JSON invalido', () => {
  it('deve responder ERROR e fechar a conexao com codigo 1003', async () => {
    // Defesa em profundidade contra cliente malformado.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, '{garbage', {
      subscriber: mockSubscriber as never, alerts: mockAlertService as never,
    });
    expect(ws.close).toHaveBeenCalledWith(1003, expect.any(String));
  });
});

describe('handleClientMessage - mensagem com type desconhecido', () => {
  it('deve responder ERROR sem despachar para nenhum handler', async () => {
    // Defesa contra type forjado no protocolo.
    const ws = makeFakeSocket();
    await handleClientMessage(ws as never, JSON.stringify({ type: 'EVIL', payload: {} }), {
      subscriber: mockSubscriber as never, alerts: mockAlertService as never,
    });
    expect(ws.sent.some((s) => JSON.parse(s).type === 'ERROR')).toBe(true);
    expect(mockSubscriber.addSubscription).not.toHaveBeenCalled();
    expect(mockAlertService.register).not.toHaveBeenCalled();
  });
});
