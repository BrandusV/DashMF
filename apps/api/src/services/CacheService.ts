/**
 * CacheService - wrapper sobre ioredis usado por CurrencyService e NewsService.
 *
 * Politica:
 *  - Cotacoes: TTL 30s (DATA_GOVERNANCE.md secao 1.3 - "Dados de Mercado").
 *  - Noticias: TTL 300s (5min) (mesma referencia).
 *  - Falhas de Redis NUNCA propagam: get devolve null, set/del sao no-op.
 *    Justificativa: o cache eh otimizacao, nao fonte de verdade. Se o Redis
 *    cair, a aplicacao continua funcionando direto contra os adapters.
 */
import { createHash } from 'node:crypto';

interface RedisLike {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, mode: 'EX', ttl: number) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
}

const DEFAULT_TTL_SECONDS = 30;

export class CacheService {
  private readonly redis: RedisLike;

  constructor(redis: RedisLike) {
    this.redis = redis;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    let raw: string | null;
    try {
      raw = await this.redis.get(key);
    } catch {
      // Redis indisponivel - degradacao gracioso, log fica a cargo do caller.
      return null;
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // JSON corrompido em cache - tratar como miss para nao quebrar a API.
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Falha no cache eh aceitavel - apenas pula.
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // Idem.
    }
  }

  /**
   * Chave canonica para cotacao de um par.
   * Padronizar o namespace evita colisao com outras features e facilita
   * varredura/expiry manual em emergencias (KEYS quote:* no redis-cli).
   */
  static quoteKey(pair: string): string {
    return `quote:${pair}`;
  }

  /**
   * Chave canonica para um conjunto de keywords de noticias.
   * As keywords sao ordenadas antes do hash para que ['a','b'] e ['b','a']
   * gerem a mesma chave - evita cache duplicado para a mesma consulta semantica.
   */
  static newsKey(keywords: string[]): string {
    const normalized = [...keywords].map((k) => k.toLowerCase()).sort().join(',');
    const hash = createHash('sha1').update(normalized).digest('hex').slice(0, 16);
    return `news:${hash}`;
  }
}
