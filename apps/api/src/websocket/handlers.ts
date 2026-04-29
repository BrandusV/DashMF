/**
 * Handlers de mensagens cliente -> servidor.
 *
 * Pipeline:
 *  1. JSON.parse - falha => ERROR + close(1003).
 *  2. Validacao com wsClientMessageSchema (Zod) - falha => ERROR + close(1003).
 *  3. Despacho por type:
 *     - SUBSCRIBE  -> subscriber.addSubscription + ACK
 *     - SET_ALERT  -> alerts.register + ACK
 *     - PING       -> PONG
 *
 * Codigo 1003 (Unsupported Data, RFC 6455) e a resposta correta para payload
 * malformado. Clientes legitimos nunca veem isso - apenas bugs ou tentativas
 * de injecao de protocolo.
 */
import { type AlertCondition, wsClientMessageSchema } from '@dashmf/types';

interface SocketLike {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
}

interface SubscriberLike {
  addSubscription: (ws: SocketLike, pairs: string[]) => void;
  removeSubscription?: (ws: SocketLike, pairs: string[]) => void;
}

interface AlertServiceLike {
  register: (
    ws: SocketLike,
    alert: { pair: string; condition: AlertCondition; threshold: number },
  ) => void;
}

interface HandlerDeps {
  subscriber: SubscriberLike;
  alerts: AlertServiceLike;
}

const CLOSE_UNSUPPORTED_DATA = 1003;

function send(ws: SocketLike, type: string, payload?: unknown): void {
  ws.send(JSON.stringify(payload === undefined ? { type } : { type, payload }));
}

export async function handleClientMessage(
  ws: SocketLike,
  raw: string,
  deps: HandlerDeps,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    send(ws, 'ERROR', { reason: 'invalid JSON' });
    ws.close(CLOSE_UNSUPPORTED_DATA, 'invalid JSON');
    return;
  }

  const result = wsClientMessageSchema.safeParse(parsed);
  if (!result.success) {
    // Inclui o primeiro issue para o cliente conseguir corrigir o request.
    // Detalhes completos ficam apenas no log do servidor (nao expostos ao cliente).
    const reason = result.error.issues[0]?.message ?? 'schema rejected';
    send(ws, 'ERROR', { reason });
    ws.close(CLOSE_UNSUPPORTED_DATA, 'schema rejected');
    return;
  }

  const message = result.data;
  switch (message.type) {
    case 'SUBSCRIBE':
      deps.subscriber.addSubscription(ws, message.payload.pairs);
      send(ws, 'ACK', { for: 'SUBSCRIBE', pairs: message.payload.pairs });
      return;
    case 'SET_ALERT':
      deps.alerts.register(ws, message.payload);
      send(ws, 'ACK', { for: 'SET_ALERT' });
      return;
    case 'PING':
      send(ws, 'PONG');
      return;
  }
}
