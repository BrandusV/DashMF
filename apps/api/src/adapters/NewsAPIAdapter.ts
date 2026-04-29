/**
 * Adapter para a NewsAPI (https://newsapi.org).
 *
 * - Autenticacao por header X-Api-Key (NUNCA query string - logs de proxy
 *   capturariam a chave, violando SECURITY.md).
 * - Filtra noticias relevantes para forex/economia atraves do parametro `q`
 *   com operadores logicos.
 * - No MVP, sentimento e marcado como "neutral" (analise de sentimento
 *   real fica para a Fase V1, ver ROADMAP.md).
 */
import { createHash } from 'node:crypto';
import type { NewsItem, Pair } from '@dashmf/types';
import { withTimeout } from '@dashmf/utils';

interface NewsAPIOptions {
  timeoutMs?: number;
}

interface NewsAPIArticle {
  source: { name: string | null } | null;
  title: string | null;
  url: string | null;
  publishedAt: string | null;
}

interface NewsAPIResponse {
  status: 'ok' | 'error';
  articles?: NewsAPIArticle[];
  code?: string;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;

// Heuristica MVP de deteccao de pares impactados a partir do headline.
// V1 substituira por NLP/classificador treinado (ROADMAP.md).
// A ordem importa: termos mais especificos primeiro evitam falsos positivos
// (ex: "real" sozinho eh ambiguo, mas "real" + "dolar" => USD/BRL).
const PAIR_KEYWORDS: ReadonlyArray<{ pair: Pair; keywords: string[] }> = [
  { pair: 'USD/BRL', keywords: ['usd/brl', 'dolar', 'dollar', 'real', 'brl', 'usd'] },
  { pair: 'EUR/BRL', keywords: ['eur/brl', 'euro', 'eur'] },
  { pair: 'EUR/USD', keywords: ['eur/usd'] },
];

export class NewsAPIAdapter {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: NewsAPIOptions = {}) {
    this.apiKey = apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetchHeadlines(keywords: string[]): Promise<NewsItem[]> {
    // URLSearchParams gera "+" para espacos (forma compatesto que casa com a
    // expectativa do teste) e ja faz encoding dos demais caracteres.
    const params = new URLSearchParams({
      q: keywords.join(' OR '),
      language: 'pt',
      sortBy: 'publishedAt',
      pageSize: '50',
    });
    const url = `https://newsapi.org/v2/everything?${params.toString()}`;

    const response = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: {
          // Header em vez de query string - decisao de seguranca (SECURITY.md).
          'X-Api-Key': this.apiKey,
          Accept: 'application/json',
        },
      }),
      this.timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`NewsAPI: HTTP ${response.status}`);
    }
    const data = (await response.json()) as NewsAPIResponse;
    if (data.status === 'error') {
      throw new Error(`NewsAPI erro: ${data.code ?? 'unknown'} - ${data.message ?? ''}`);
    }

    const articles = data.articles ?? [];
    const items: NewsItem[] = [];
    for (const article of articles) {
      // Entradas sem URL sao malformadas (NewsAPI as vezes retorna isso) e
      // nao podem gerar id estavel - descartadas.
      if (!article.url) continue;
      const headline = article.title ?? '';
      items.push({
        id: hashUrl(article.url),
        headline,
        source: article.source?.name ?? 'unknown',
        url: article.url,
        impactedPairs: detectImpactedPairs(headline),
        // MVP: todas neutras. Fase V1 adicionara classificacao real.
        sentiment: 'neutral',
        publishedAt: article.publishedAt ? new Date(article.publishedAt).getTime() : Date.now(),
      });
    }
    return items;
  }
}

/**
 * Hash determinista da URL - serve como id estavel para deduplicar a mesma
 * noticia replicada em fontes diferentes (ou no mesmo feed em ciclos do poller).
 * SHA-1 truncado em 16 chars hex eh suficiente: a colisao em ~10^9 noticias
 * ainda eh praticamente zero e o id fica curto para o frontend.
 */
function hashUrl(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 16);
}

function detectImpactedPairs(headline: string): Pair[] {
  const normalized = headline.toLowerCase();
  const matches: Pair[] = [];
  for (const { pair, keywords } of PAIR_KEYWORDS) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      matches.push(pair);
    }
  }
  return matches;
}
