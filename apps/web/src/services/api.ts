/**
 * Cliente HTTP do frontend - bate no backend Fastify (apps/api/src/routes).
 *
 * Defesa em profundidade:
 *  - Validacao Zod em runtime (defende contra backend bugado / payload corrompido).
 *  - Timeout (5s default - ARCHITECTURE.md "Latencia ~30s" deixa folga ampla)
 *    para nao deixar componente preso aguardando resposta indefinidamente.
 *  - AbortController via `signal` permite cancelar requisicao quando o
 *    componente desmonta (evita warning "setState on unmounted component").
 *
 * NUNCA chama API externa diretamente - somente o backend.
 */
import {
  quoteSchema,
  newsItemSchema,
  type Quote,
  type NewsItem,
} from '@dashmf/types';
import { withTimeout } from '@dashmf/utils';

interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

// Le base URL do bundle (`VITE_API_URL` configurado em apps/web/.env).
// Strip de barras finais permite passar tanto "http://x" quanto "http://x/".
function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    throw new Error('VITE_API_URL nao configurada - veja apps/web/.env.example');
  }
  return url.replace(/\/+$/, '');
}

// Centraliza fetch + timeout + checagem de status.
// Retorno `unknown` forca o caller a validar com Zod antes de usar.
async function getJson(path: string, opts: FetchOptions = {}): Promise<unknown> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const url = `${getBaseUrl()}${path}`;
  const response = await withTimeout(fetch(url, { signal }), timeoutMs);
  if (!response.ok) {
    // Mensagem inclui status mas nao body (que pode trazer detalhe sensivel
    // do upstream em caso de erro de adapter).
    throw new Error(`GET ${path} falhou com status ${response.status}`);
  }
  return response.json();
}

/**
 * Cotacoes de varios pares em uma chamada (backend aceita ate 20 -
 * ARCHITECTURE.md secao 7). settingsStore garante esse cap no cliente.
 *
 * Encoding: cada `/` vira `%2F` e a virgula separadora vira `%2C`,
 * gerando `?pairs=USD%2FBRL%2CEUR%2FBRL`.
 */
export async function fetchQuotes(
  pairs: string[],
  opts: FetchOptions = {},
): Promise<Quote[]> {
  const query = encodeURIComponent(pairs.join(','));
  const data = await getJson(`/quotes?pairs=${query}`, opts);
  // Valida o array com o schema canonico - rejeita backend mandando bid<0,
  // spread invertido ou qualquer outro payload fora do contrato.
  return quoteSchema.array().parse(data);
}

/**
 * Noticias do feed agregado. Sem `keywords`, backend usa defaults
 * "forex/economia/cambio" (DATA_GOVERNANCE.md 1.2).
 */
export async function fetchNews(
  keywords?: string[],
  opts: FetchOptions = {},
): Promise<NewsItem[]> {
  const path =
    keywords && keywords.length > 0
      ? `/news?keywords=${encodeURIComponent(keywords.join(','))}`
      : '/news';
  const data = await getJson(path, opts);
  return newsItemSchema.array().parse(data);
}
