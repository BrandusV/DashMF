/**
 * useWebSocket - conexao persistente com o backend Fastify (rota /ws).
 *
 * Comportamento (ROADMAP.md MVP P0 - "Conexao WebSocket estavel com
 * reconexao automatica"):
 *  - Status: 'connecting' inicial -> 'online' apos open -> 'offline' apos close.
 *  - Reconexao automatica em close anormal (qualquer codigo != 1000) usando
 *    exponential backoff: 1s -> 2s -> 4s -> ... cap 30s
 *    (formula `min(1000 * 2^(tentativa-1), 30000)`).
 *  - Mensagens entrantes validadas com `wsServerMessageSchema`; payload
 *    fora do contrato e descartado silenciosamente (defesa contra servidor
 *    bugado).
 *  - `send()` antes do socket abrir faz drop silencioso (decisao MVP -
 *    retornar erro complicaria o caller sem ganho real).
 *  - Cleanup no unmount cancela timer pendente e fecha o socket com codigo
 *    1000 (close limpo) para nao agendar nova reconexao.
 *
 * Limitacao conhecida: useCurrencies e useNews chamam useWebSocket
 * separadamente - em producao isso abre 2 conexoes por aba. PR de refactor
 * (Context Provider em App) esta no backlog tecnico.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  wsServerMessageSchema,
  type WsServerMessage,
  type WsClientMessage,
} from '@dashmf/types';
import { exponentialBackoff } from '@dashmf/utils';

export type WsStatus = 'connecting' | 'online' | 'offline';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;
// 1000 = "Normal Closure" do RFC 6455 - close limpo voluntario.
// Evita reconectar quando o cleanup do hook chama `socket.close(1000)`.
const NORMAL_CLOSURE_CODE = 1000;

interface UseWebSocketReturn {
  status: WsStatus;
  lastMessage: WsServerMessage | null;
  send: (msg: WsClientMessage | { type: string }) => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<WsServerMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sentinel de unmount - todos os handlers consultam antes de chamar setState
  // ou agendar reconexao para evitar memory leak.
  const isMountedRef = useRef(true);

  // `connect` precisa ser callable tambem pelo timer de reconexao - por isso
  // fica fora do useEffect. useCallback estabiliza a referencia para o
  // dep array do useEffect abaixo.
  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    const ws = new WebSocket(url);
    socketRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (!isMountedRef.current) return;
      // Reset do contador de tentativas: proxima queda comeca o backoff
      // novamente em 1s, em vez de continuar acumulando.
      attemptRef.current = 0;
      setStatus('online');
    };

    ws.onmessage = (event: { data: string }) => {
      if (!isMountedRef.current) return;
      try {
        const raw = JSON.parse(event.data);
        const parsed = wsServerMessageSchema.safeParse(raw);
        if (parsed.success) {
          setLastMessage(parsed.data);
        }
        // Schema invalido = drop silencioso (NAO atualiza lastMessage).
      } catch {
        // JSON invalido tambem e descartado silenciosamente.
      }
    };

    ws.onclose = (event: { code: number }) => {
      if (!isMountedRef.current) return;
      setStatus('offline');
      // Close limpo (1000) significa que NOS pedimos para fechar - nao reconecta.
      if (event.code === NORMAL_CLOSURE_CODE) return;
      attemptRef.current += 1;
      const delay = exponentialBackoff(
        attemptRef.current,
        BACKOFF_BASE_MS,
        BACKOFF_CAP_MS,
      );
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // ws emitira onclose logo em seguida - reconexao acontece la.
      // Handler vazio aqui evita "unhandled error event" no console.
    };
  }, [url]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();
    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const sock = socketRef.current;
      if (sock && sock.readyState !== WebSocket.CLOSED) {
        // close(1000) sinaliza ao onclose handler que NAO deve agendar reconect.
        sock.close(NORMAL_CLOSURE_CODE);
      }
    };
  }, [connect]);

  const send = useCallback((msg: WsClientMessage | { type: string }) => {
    const sock = socketRef.current;
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      // Drop silencioso quando socket nao esta pronto (decisao MVP).
      return;
    }
    sock.send(JSON.stringify(msg));
  }, []);

  return { status, lastMessage, send };
}
