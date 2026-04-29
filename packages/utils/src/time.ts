/**
 * Utilitarios de tempo - usados pelos workers (currencyPoller a cada 30s,
 * newsPoller a cada 5min) e pelo hook useWebSocket (reconexao com backoff).
 */

/**
 * Promessa que resolve apos `ms` milissegundos.
 * Lanca SINCRONAMENTE para ms negativo - evita mascarar bugs upstream.
 */
export function sleep(ms: number): Promise<void> {
  if (ms < 0) {
    throw new Error(`sleep: ms negativo invalido (${ms})`);
  }
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Encapsula uma promessa em um timeout.
 * Se a promessa terminar antes, retorna seu valor; se demorar mais que `ms`,
 * rejeita com erro contendo "timeout" (testavel via regex).
 *
 * Aplicado aos adapters de API externa (ExchangeRate, BCB, NewsAPI) para evitar
 * que uma fonte pendurada bloqueie o ciclo do poller.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout apos ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Calcula o delay para a tentativa N de um exponential backoff.
 * Formula: baseMs * 2^(attempt-1), com teto opcional (capMs).
 *
 * Usado no useWebSocket para reconexao apos queda - evita martelar o servidor
 * quando ele estiver sobrecarregado e da espaco para recuperacao.
 */
export function exponentialBackoff(attempt: number, baseMs: number, capMs?: number): number {
  if (attempt < 1) {
    throw new Error(`exponentialBackoff: tentativa deve ser >= 1 (recebido ${attempt})`);
  }
  const delay = baseMs * 2 ** (attempt - 1);
  return capMs !== undefined ? Math.min(delay, capMs) : delay;
}
