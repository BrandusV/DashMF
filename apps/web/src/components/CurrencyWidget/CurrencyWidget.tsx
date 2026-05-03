/**
 * CurrencyWidget - card que exibe um par de moedas.
 *
 * Feature P0 do MVP (ROADMAP.md). Mostra bid/ask/mid + variacao percentual
 * colorida (verde/vermelho/neutro) - dado fundamental para operadores
 * cambistas que precisam ver os dois lados do spread.
 *
 * a11y: aria-label combina par + valor mid para que leitores de tela
 * resumam a informacao sem precisar percorrer cada campo (WCAG 2.1 AA).
 *
 * Loading: quando `quote` e undefined (durante bootstrap REST do
 * useCurrencies), renderiza skeleton em vez de tela em branco.
 */
import { formatCurrency } from '@dashmf/utils';
import type { Quote } from '@dashmf/types';
import { cn } from '../../lib/cn';

interface CurrencyWidgetProps {
  quote: Quote | undefined;
}

function changeColor(changePct: number): string {
  if (changePct > 0) return 'text-emerald-400';
  if (changePct < 0) return 'text-rose-400';
  return 'text-gray-400';
}

function quoteCurrency(pair: string): string {
  // "USD/BRL" -> "BRL". Schema valida o formato (packages/types/schemas.ts),
  // entao split direto e seguro aqui.
  return pair.split('/')[1];
}

export function CurrencyWidget({ quote }: CurrencyWidgetProps): JSX.Element {
  if (!quote) {
    return (
      <div
        data-testid="widget-skeleton"
        className="h-32 animate-pulse rounded-lg border border-slate-700 bg-slate-800/40"
        aria-busy="true"
      />
    );
  }

  const currency = quoteCurrency(quote.pair);
  const mid = formatCurrency(quote.mid, currency);
  const bid = formatCurrency(quote.bid, currency);
  const ask = formatCurrency(quote.ask, currency);
  const sign = quote.changePct > 0 ? '+' : '';

  return (
    <article
      aria-label={`${quote.pair}: ${mid}`}
      className="rounded-lg border border-slate-700 bg-slate-800/40 p-4"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{quote.pair}</h3>
        <span
          data-testid="change-pct"
          className={cn('text-xs font-medium', changeColor(quote.changePct))}
        >
          {sign}
          {quote.changePct.toFixed(2)}%
        </span>
      </header>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{mid}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>
          <dt className="text-slate-500">Bid</dt>
          <dd>{bid}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ask</dt>
          <dd>{ask}</dd>
        </div>
      </dl>
    </article>
  );
}
