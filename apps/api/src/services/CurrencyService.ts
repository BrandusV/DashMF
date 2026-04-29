/**
 * CurrencyService - orquestra adapters de cotacao + cache.
 *
 * Estrategia (DATA_GOVERNANCE.md - "Dados de Mercado"):
 *  1. Cache hit (Redis, TTL 30s) -> retorna direto, sem tocar APIs externas.
 *  2. Cache miss -> chama ExchangeRate-API (provedor primario).
 *  3. Falha do primario E par contra BRL -> fallback para BCB (PTAX oficial).
 *  4. Calcula changePct comparando com a ultima cotacao registrada (`last:`)
 *     para que o widget colora verde/vermelho (P2 do MVP).
 *  5. Persiste no cache hot (TTL 30s) e no historico `last:` (sem TTL curto).
 */
import type { Quote } from '@dashmf/types';
import { calculateChangePct } from '@dashmf/utils';
import { CacheService } from './CacheService';

interface ExchangeRateLike {
  fetchQuote: (base: string, target: string) => Promise<Quote>;
}
interface BCBLike {
  fetchPtax: (currency: string) => Promise<Quote>;
}

interface CacheLike {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
}

interface PreviousQuote {
  mid: number;
}

const QUOTE_TTL_SECONDS = 30;
// Historico fica mais tempo no cache para sobreviver a reinicios curtos do worker.
const LAST_TTL_SECONDS = 60 * 60;

export class CurrencyService {
  constructor(
    private readonly exchangeRate: ExchangeRateLike,
    private readonly bcb: BCBLike,
    private readonly cache: CacheLike,
  ) {}

  async getQuote(base: string, target: string): Promise<Quote> {
    const pair = `${base}/${target}`;
    const cacheKey = CacheService.quoteKey(pair);

    // 1. Cache hot.
    const cached = await this.cache.get<Quote>(cacheKey);
    if (cached) return cached;

    // 2. Historico para o calculo de variacao.
    const previous = await this.cache.get<PreviousQuote>(`last:${pair}`);

    // 3. Adapter primario com fallback condicional.
    const fresh = await this.fetchFresh(base, target);

    // 4. Variacao percentual relativa a ultima cotacao registrada.
    const final: Quote =
      previous && typeof previous.mid === 'number'
        ? { ...fresh, changePct: calculateChangePct(fresh.mid, previous.mid) }
        : fresh;

    // 5. Persiste cache hot + historico para o proximo ciclo.
    await this.cache.set(cacheKey, final, QUOTE_TTL_SECONDS);
    await this.cache.set(`last:${pair}`, { mid: final.mid }, LAST_TTL_SECONDS);
    return final;
  }

  async getMultipleQuotes(pairs: Array<{ base: string; quote: string }>): Promise<Quote[]> {
    // Promise.allSettled para garantir que 1 par quebrado nao anule o broadcast.
    const settled = await Promise.allSettled(
      pairs.map((p) => this.getQuote(p.base, p.quote)),
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  private async fetchFresh(base: string, target: string): Promise<Quote> {
    try {
      return await this.exchangeRate.fetchQuote(base, target);
    } catch (primaryErr) {
      // Fallback BCB so vale para pares contra BRL - PTAX nao publica outras combinacoes.
      if (target !== 'BRL') {
        throw primaryErr;
      }
      return this.bcb.fetchPtax(base);
    }
  }
}
