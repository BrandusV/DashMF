/**
 * Worker que mantem o feed de noticias vivo.
 *
 * Diferenca chave em relacao ao currencyPoller: deduplicacao por id.
 * Headlines repetidas entre ciclos NAO sao re-broadcastadas - economia de
 * banda WS e do tempo de render no NewsFeed do frontend.
 *
 * O Set de ids vistos eh resetado a cada startNewsPoller() para evitar
 * vazamento de memoria em runtime longo. Em V1 sera substituido por TTL
 * sliding (ids expirando apos N horas) ou backend Redis.
 */
import type { NewsItem } from '@dashmf/types';

interface NewsServiceLike {
  getHeadlines: (keywords: string[]) => Promise<NewsItem[]>;
}

interface BroadcasterLike {
  broadcastNews: (item: NewsItem) => void;
}

export interface NewsPollerOptions {
  service: NewsServiceLike;
  broadcaster: BroadcasterLike;
  keywords: string[];
  intervalMs: number;
}

let active = false;
let timer: NodeJS.Timeout | null = null;
const seenIds = new Set<string>();

export function startNewsPoller(opts: NewsPollerOptions): void {
  stopNewsPoller();
  active = true;
  // Reset entre starts - garante isolamento em testes e deploy/rollback.
  seenIds.clear();

  const tick = async (): Promise<void> => {
    if (!active) return;
    try {
      const items = await opts.service.getHeadlines(opts.keywords);
      for (const item of items) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        opts.broadcaster.broadcastNews(item);
      }
    } catch {
      // Falha transitoria (rate limit, timeout) NAO cancela o poller -
      // proximo tick tenta de novo.
    }
    if (active) {
      timer = setTimeout(() => {
        void tick();
      }, opts.intervalMs);
    }
  };

  timer = setTimeout(() => {
    void tick();
  }, 0);
}

export function stopNewsPoller(): void {
  active = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
