/**
 * NewsService - orquestra adapters de noticias + cache.
 *
 * Estrategia:
 *  1. Cache hit (TTL 5min) -> retorna direto, economizando quota.
 *  2. Cache miss -> tenta NewsAPI (primario). Se falhar, fallback GNews.
 *  3. Mescla com cache historico, deduplicando por id (versao mais recente
 *     ganha) - evita que noticias antigas reapareceram apos o TTL expirar.
 *  4. Ordena desc por publishedAt e limita a 50 itens (cap defensivo para
 *     proteger payload de WebSocket e tempo de render no NewsFeed).
 */
import type { NewsItem, Pair } from '@dashmf/types';
import { CacheService } from './CacheService';

interface NewsAdapterLike {
  fetchHeadlines: (keywords: string[]) => Promise<NewsItem[]>;
}

interface CacheLike {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}

const NEWS_TTL_SECONDS = 300;
const MAX_ITEMS = 50;
const HISTORY_KEY = 'news:history';

export class NewsService {
  constructor(
    private readonly newsAPI: NewsAdapterLike,
    private readonly gnews: NewsAdapterLike,
    private readonly cache: CacheLike,
  ) {}

  async getHeadlines(keywords: string[]): Promise<NewsItem[]> {
    const cacheKey = CacheService.newsKey(keywords);

    // 1. Cache da query - se valido, retorna sem tocar adapters.
    const cached = await this.cache.get<NewsItem[]>(cacheKey);
    if (cached) return cached;

    // 2. Historico mantem noticias entre ciclos do poller (5min TTL da query
    // expira mas o historico fica mais tempo - permite enriquecer o resultado).
    const history = (await this.cache.get<NewsItem[]>(HISTORY_KEY)) ?? [];

    // 3. Adapter primario com fallback.
    const fresh = await this.fetchFresh(keywords);

    // 4. Dedup por id, prefere versao mais recente (publishedAt maior).
    const merged = mergeAndDedupe(fresh, history);

    // 5. Ordena desc e aplica cap.
    merged.sort((a, b) => b.publishedAt - a.publishedAt);
    const limited = merged.slice(0, MAX_ITEMS);

    // 6. Persiste cache da query.
    await this.cache.set(cacheKey, limited, NEWS_TTL_SECONDS);
    return limited;
  }

  filterByPair(items: NewsItem[], pair: Pair): NewsItem[] {
    return items.filter((item) => item.impactedPairs.includes(pair));
  }

  private async fetchFresh(keywords: string[]): Promise<NewsItem[]> {
    try {
      return await this.newsAPI.fetchHeadlines(keywords);
    } catch {
      return this.gnews.fetchHeadlines(keywords);
    }
  }
}

/**
 * Mescla duas listas de NewsItem deduplicando por id. Quando o mesmo id aparece
 * em ambas as listas, a versao com publishedAt maior eh mantida (assume que o
 * adapter pode atualizar metadados como sentimento ou pares impactados).
 *
 * Importante: o array `fresh` tem prioridade na ordem de iteracao para que,
 * em empate de publishedAt, a versao mais nova (recem fetchada) sobrescreva
 * a do historico.
 */
function mergeAndDedupe(fresh: NewsItem[], history: NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of [...fresh, ...history]) {
    const existing = byId.get(item.id);
    if (!existing || item.publishedAt > existing.publishedAt) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}
