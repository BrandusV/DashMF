/**
 * Testes do Broadcaster - distribuidor de mensagens server -> clientes.
 *
 * Responsabilidades:
 *  - Manter mapa de subscricoes (ws -> set<pair>)
 *  - Despachar QUOTE_UPDATE apenas para clientes inscritos no par
 *  - Despachar NEWS_ALERT broadcast (todos os clientes recebem)
 *  - Limpar entradas de conexoes mortas (readyState !== OPEN)
 *  - Validar payload com wsServerMessageSchema antes de enviar (defesa)
 *
 * Cobertura >= 80% conforme ROADMAP.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Broadcaster } from '../broadcaster';

// Cria um socket fake com readyState OPEN.
const OPEN = 1;
const CLOSED = 3;
function fakeSocket(state = OPEN) {
  const sent: string[] = [];
  return {
    sent,
    readyState: state,
    send: vi.fn((data: string) => sent.push(data)),
  };
}

describe('Broadcaster.subscribe', () => {
  it('deve registrar a subscricao do socket para os pares informados', () => {
    // Mantem a tabela de roteamento usada pelo broadcastQuote.
    const b = new Broadcaster();
    const ws = fakeSocket();
    b.subscribe(ws as never, ['USD/BRL']);
    expect(b.subscribersOf('USD/BRL')).toContain(ws);
  });

  it('deve permitir o mesmo socket inscrito em multiplos pares', () => {
    // Cliente do dashboard normalmente assina varios pares.
    const b = new Broadcaster();
    const ws = fakeSocket();
    b.subscribe(ws as never, ['USD/BRL', 'EUR/BRL']);
    expect(b.subscribersOf('USD/BRL')).toContain(ws);
    expect(b.subscribersOf('EUR/BRL')).toContain(ws);
  });

  it('deve ser idempotente - subscrever 2x ao mesmo par mantem 1 entrada', () => {
    // Sem isso o broadcast enviaria a mensagem duplicada.
    const b = new Broadcaster();
    const ws = fakeSocket();
    b.subscribe(ws as never, ['USD/BRL']);
    b.subscribe(ws as never, ['USD/BRL']);
    expect(b.subscribersOf('USD/BRL').length).toBe(1);
  });
});

describe('Broadcaster.broadcastQuote', () => {
  it('deve enviar QUOTE_UPDATE apenas para sockets inscritos no par', () => {
    // Roteamento - quem nao assinou nao paga banda.
    const b = new Broadcaster();
    const wsA = fakeSocket();
    const wsB = fakeSocket();
    b.subscribe(wsA as never, ['USD/BRL']);
    b.subscribe(wsB as never, ['EUR/BRL']);
    b.broadcastQuote({ pair: 'USD/BRL', bid: 5.10, ask: 5.12, mid: 5.11, changePct: 0, timestamp: 1 });
    expect(wsA.send).toHaveBeenCalledTimes(1);
    expect(wsB.send).not.toHaveBeenCalled();
  });

  it('deve serializar a mensagem como JSON com type=QUOTE_UPDATE', () => {
    // Contrato definido em ARCHITECTURE.md secao 3.
    const b = new Broadcaster();
    const ws = fakeSocket();
    b.subscribe(ws as never, ['USD/BRL']);
    b.broadcastQuote({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    const payload = JSON.parse(ws.sent[0]);
    expect(payload.type).toBe('QUOTE_UPDATE');
    expect(payload.payload.pair).toBe('USD/BRL');
  });

  it('NAO deve tentar enviar para socket fechado (readyState !== OPEN)', () => {
    // Send em socket morto causa erro - defender antes de enviar.
    const b = new Broadcaster();
    const dead = fakeSocket(CLOSED);
    b.subscribe(dead as never, ['USD/BRL']);
    b.broadcastQuote({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    expect(dead.send).not.toHaveBeenCalled();
  });

  it('deve remover sockets fechados na proxima limpeza (cleanupDead)', () => {
    // Manter dead sockets na tabela vaza memoria.
    const b = new Broadcaster();
    const dead = fakeSocket(CLOSED);
    b.subscribe(dead as never, ['USD/BRL']);
    b.cleanupDead();
    expect(b.subscribersOf('USD/BRL')).not.toContain(dead);
  });
});

describe('Broadcaster.broadcastNews', () => {
  it('deve enviar NEWS_ALERT para TODOS os sockets conectados', () => {
    // Noticia e broadcast global - todo dashboard ve.
    const b = new Broadcaster();
    const wsA = fakeSocket();
    const wsB = fakeSocket();
    b.subscribe(wsA as never, ['USD/BRL']);
    b.subscribe(wsB as never, ['EUR/BRL']);
    b.broadcastNews({ id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 });
    expect(wsA.send).toHaveBeenCalledTimes(1);
    expect(wsB.send).toHaveBeenCalledTimes(1);
  });

  it('deve serializar com type=NEWS_ALERT', () => {
    const b = new Broadcaster();
    const ws = fakeSocket();
    b.subscribe(ws as never, ['USD/BRL']);
    b.broadcastNews({ id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 });
    expect(JSON.parse(ws.sent[0]).type).toBe('NEWS_ALERT');
  });
});

describe('Broadcaster - resiliencia', () => {
  it('deve continuar entregando para outros sockets se um lancar erro no send', () => {
    // Um cliente bugado nao pode derrubar o broadcast.
    const b = new Broadcaster();
    const bad = { readyState: OPEN, send: vi.fn(() => { throw new Error('socket gone'); }) };
    const good = fakeSocket();
    b.subscribe(bad as never, ['USD/BRL']);
    b.subscribe(good as never, ['USD/BRL']);
    b.broadcastQuote({ pair: 'USD/BRL', bid: 5, ask: 5, mid: 5, changePct: 0, timestamp: 1 });
    // O bom recebeu apesar do erro no outro.
    expect(good.send).toHaveBeenCalled();
  });

  it('NAO deve enviar payload que falhe na validacao do schema (defesa)', () => {
    // Defesa em profundidade contra bug de upstream que tentaria enviar dado invalido.
    const b = new Broadcaster();
    const ws = fakeSocket();
    b.subscribe(ws as never, ['USD/BRL']);
    // bid > ask = invariante violada.
    expect(() => b.broadcastQuote({ pair: 'USD/BRL', bid: 99, ask: 1, mid: 50, changePct: 0, timestamp: 1 } as never))
      .toThrow();
    expect(ws.send).not.toHaveBeenCalled();
  });
});
