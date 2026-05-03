/**
 * Broadcaster - distribuidor de mensagens WebSocket server -> clientes.
 *
 * Mantem duas estruturas:
 *  - subscribers: Map<pair, Set<ws>> para roteamento de QUOTE_UPDATE (apenas
 *    quem assinou o par recebe).
 *  - allSockets: Set<ws> para broadcast global (NEWS_ALERT vai para todos).
 *
 * Principios:
 *  - Defesa em profundidade: payload e validado com schemas Zod ANTES do envio.
 *    Um bug upstream que tente publicar quote com bid > ask falha rapido aqui.
 *  - Resiliencia: se um socket lanca em send (cliente bugado), o broadcast
 *    continua para os demais - 1 cliente quebrado nao paralisa o sistema.
 *  - Higiene: cleanupDead remove sockets em readyState != OPEN. Chamado pelos
 *    workers periodicamente para evitar vazamento de memoria.
 */
import { type NewsItem, type Quote, newsItemSchema, quoteSchema } from '@dashmf/types';
import type { SocketLike } from './types';

// readyState OPEN do WebSocket (RFC 6455). ws.WebSocket exporta o valor 1.
const WS_OPEN = 1;

export class Broadcaster {
  private readonly subscribersByPair = new Map<string, Set<SocketLike>>();
  private readonly allSockets = new Set<SocketLike>();

  subscribe(ws: SocketLike, pairs: string[]): void {
    this.allSockets.add(ws);
    for (const pair of pairs) {
      let set = this.subscribersByPair.get(pair);
      if (!set) {
        set = new Set();
        this.subscribersByPair.set(pair, set);
      }
      // Set garante idempotencia - subscribe 2x do mesmo socket no mesmo par
      // mantem 1 entrada (sem duplicar broadcast).
      set.add(ws);
    }
  }

  subscribersOf(pair: string): SocketLike[] {
    return Array.from(this.subscribersByPair.get(pair) ?? []);
  }

  broadcastQuote(quote: Quote): void {
    // Valida ANTES de fan-out. Falha aqui sinaliza bug upstream e e melhor
    // explodir cedo do que enviar payload corrompido para clientes.
    const valid = quoteSchema.parse(quote);
    const subs = this.subscribersByPair.get(valid.pair);
    if (!subs) return;
    const message = JSON.stringify({ type: 'QUOTE_UPDATE', payload: valid });
    for (const ws of subs) {
      this.safeSend(ws, message);
    }
  }

  broadcastNews(news: NewsItem): void {
    const valid = newsItemSchema.parse(news);
    const message = JSON.stringify({ type: 'NEWS_ALERT', payload: valid });
    for (const ws of this.allSockets) {
      this.safeSend(ws, message);
    }
  }

  cleanupDead(): void {
    // Remove sockets fechados. Iterar e mutar o mesmo Set e seguro em JS
    // (delete durante iteracao do proprio Set nao quebra o iterator).
    for (const set of this.subscribersByPair.values()) {
      for (const ws of set) {
        if (ws.readyState !== WS_OPEN) set.delete(ws);
      }
    }
    for (const ws of this.allSockets) {
      if (ws.readyState !== WS_OPEN) this.allSockets.delete(ws);
    }
  }

  private safeSend(ws: SocketLike, message: string): void {
    if (ws.readyState !== WS_OPEN) return;
    try {
      ws.send(message);
    } catch {
      // Cliente quebrado nao pode parar o broadcast para os demais.
      // Higiene fica a cargo do cleanupDead.
    }
  }
}
