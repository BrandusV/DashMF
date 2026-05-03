/**
 * NewsFeed - lista cronologica reversa de noticias relevantes.
 *
 * Feature P1 do MVP (ROADMAP.md). Cada item linka para a fonte original em nova
 * aba.
 *
 * SECURITY.md: links externos com `target="_blank"` exigem
 * `rel="noopener noreferrer"` para mitigar tabnabbing - o site externo nao
 * recebe acesso ao window.opener nem ao Referer header.
 *
 * V1 do ROADMAP: tag de sentimento (positive/negative/neutral) - hoje apenas
 * exibida; analise vem do backend (services/news/sentiment.ts).
 */
import type { NewsItem } from '@dashmf/types';
import { cn } from '../../lib/cn';

interface NewsFeedProps {
  items: NewsItem[];
}

const SENTIMENT_CLASSES: Record<NewsItem['sentiment'], string> = {
  positive: 'bg-emerald-900/40 text-emerald-300',
  negative: 'bg-rose-900/40 text-rose-300',
  neutral: 'bg-slate-700/40 text-slate-300',
};

const SENTIMENT_LABELS: Record<NewsItem['sentiment'], string> = {
  positive: 'positivo',
  negative: 'negativo',
  neutral: 'neutro',
};

export function NewsFeed({ items }: NewsFeedProps): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-800/40 p-4 text-sm text-slate-400">
        Nenhuma noticia disponivel no momento.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-md border border-slate-700 bg-slate-800/40 p-3"
        >
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-100 hover:underline"
          >
            {item.headline}
          </a>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span>{item.source}</span>
            <span
              data-testid={`sentiment-${item.id}`}
              data-sentiment={item.sentiment}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide',
                SENTIMENT_CLASSES[item.sentiment],
              )}
            >
              {SENTIMENT_LABELS[item.sentiment]}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
