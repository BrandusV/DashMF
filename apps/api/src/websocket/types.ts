/**
 * Tipo estrutural unificado para conexoes WebSocket usadas no API.
 *
 * Por que existe: broadcaster.ts (precisa readyState para safeSend) e
 * handlers.ts (precisa close para encerrar 1003) tinham SocketLike
 * separados e divergentes - causando incompatibilidade de variancia
 * em server.ts ao montar o `subscriber` shim.
 *
 * Definir um unico SocketLike com os 3 campos garante que qualquer ws
 * passado por server.ts (real do `ws.WebSocket`) seja aceito por ambos
 * sem casts. Testes que mockam parcial seguem usando `as never`.
 */
export interface SocketLike {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
}
