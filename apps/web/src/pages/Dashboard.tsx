/**
 * Dashboard - pagina principal do MVP.
 *
 * Composicao raiz exigida pelos criterios de aceitacao do ROADMAP.md (Fase 0):
 *  - Pelo menos 5 pares de moedas atualizando ao vivo (CurrencyWidget x N).
 *  - Feed de noticias financeiras (NewsFeed).
 *  - Indicador visual do status da conexao (StatusBar).
 *
 * Fontes de dados:
 *  - `useSettingsStore`: pares assinados (DEFAULT_PAIRS para MVP, customizavel
 *    no V2 do roadmap).
 *  - `useCurrencies(pairs)`: bootstrap REST + QUOTE_UPDATE via WS.
 *  - `useNews()`: bootstrap REST + NEWS_ALERT via WS.
 *  - `useWebSocket(...)`: status da conexao para o StatusBar.
 *
 * Limitacao conhecida (documentada no useWebSocket.ts): este Dashboard chama
 * useWebSocket separadamente do que useCurrencies/useNews ja fazem - em
 * producao isso resulta em 3 conexoes WS por aba. Refactor para Context
 * Provider esta no backlog tecnico (V1).
 */
import { CurrencyWidget } from '../components/CurrencyWidget/CurrencyWidget';
import { NewsFeed } from '../components/NewsFeed/NewsFeed';
import { StatusBar } from '../components/StatusBar/StatusBar';
import { useCurrencies } from '../hooks/useCurrencies';
import { useNews } from '../hooks/useNews';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSettingsStore } from '../store/settingsStore';

// URL do WS centralizada aqui pelo mesmo motivo dos hooks: evita propagar a
// string ate componentes. Fallback de localhost cobre dev sem .env.
function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws';
}

export function Dashboard(): JSX.Element {
  const pairs = useSettingsStore((state) => state.pairs);
  const { quotes } = useCurrencies(pairs);
  const { items } = useNews();
  const { status } = useWebSocket(getWsUrl());

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <h1 className="text-2xl font-bold tracking-wider">
          Dash<span className="text-blue-500">MF</span>
        </h1>
        <StatusBar status={status} />
      </header>

      <section className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Cotacoes
        </h2>
        <div
          // Grid responsivo: 1 col mobile, 2 col tablet, 3 col desktop -
          // atende ao criterio "Layout responsivo (desktop e tablet)" do MVP.
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {pairs.map((pair) => {
            // `find` por par garante que cada widget recebe a quote correta
            // mesmo se o backend devolver em ordem diferente da configurada.
            // Quote ausente => widget renderiza skeleton (loading state).
            const quote = quotes.find((q) => q.pair === pair);
            return <CurrencyWidget key={pair} quote={quote} />;
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Noticias
        </h2>
        <NewsFeed items={items} />
      </section>
    </main>
  );
}
