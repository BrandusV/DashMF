/**
 * Testes da pagina Dashboard.
 *
 * Composicao raiz do MVP (ROADMAP.md Fase 0): combina CurrencyWidget(s),
 * NewsFeed e StatusBar usando os hooks ja implementados.
 *
 * Foco do teste: CONTRATO DE COMPOSICAO - os hooks corretos sao chamados,
 * os dados sao distribuidos para os componentes filhos, o store de settings
 * eh a fonte de verdade dos pares assinados. Layout visual (grid, espacamentos,
 * cores) eh detalhe de implementacao e NAO deve ser asserto aqui - mudar o
 * layout nao deve quebrar testes (CONTRIBUTING.md - "testes acoplados ao
 * comportamento, nao a aparencia").
 *
 * Os hooks (useCurrencies, useNews, useWebSocket) sao mockados por completo:
 * cada um ja tem seus proprios testes unitarios e nao queremos re-testar a
 * camada de IO aqui (DRY de teste - SECURITY.md tambem proibe IO real em CI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import { useSettingsStore, DEFAULT_PAIRS } from '../../store/settingsStore';

// Mocks dos hooks - controle total dos retornos por teste.
const mockUseCurrencies = vi.fn();
const mockUseNews = vi.fn();
const mockUseWebSocket = vi.fn();

vi.mock('../../hooks/useCurrencies', () => ({
  useCurrencies: (...args: unknown[]) => mockUseCurrencies(...args),
}));
vi.mock('../../hooks/useNews', () => ({
  useNews: () => mockUseNews(),
}));
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: (...args: unknown[]) => mockUseWebSocket(...args),
}));

beforeEach(() => {
  // Defaults razoaveis - cada teste sobrescreve o que precisa.
  mockUseCurrencies.mockReturnValue({ quotes: [], isLoading: false });
  mockUseNews.mockReturnValue({ items: [], isLoading: false });
  mockUseWebSocket.mockReturnValue({
    status: 'online',
    lastMessage: null,
    send: vi.fn(),
  });
  // Reseta o store global - persist middleware pode reter valores entre testes
  // se algum teste anterior chamar addPair/removePair (ver useCurrencies.test.ts
  // para o mesmo padrao com currencyStore).
  useSettingsStore.setState({ pairs: DEFAULT_PAIRS, theme: 'light' });
});

describe('Dashboard', () => {
  it('deve usar os pares do settingsStore ao chamar useCurrencies', () => {
    // settingsStore eh a fonte de verdade das preferencias do usuario.
    // Hardcodear pairs no Dashboard quebraria a feature de adicionar/remover
    // pares prevista no V2 (settingsStore.addPair).
    render(<Dashboard />);
    expect(mockUseCurrencies).toHaveBeenCalledWith(DEFAULT_PAIRS);
  });

  it('deve renderizar um CurrencyWidget para cada par configurado', () => {
    // Cobre o criterio de aceitacao do MVP: "ao menos 5 pares atualizando ao
    // vivo" (ROADMAP.md Fase 0). Usamos os DEFAULT_PAIRS (5 pares) como prova.
    mockUseCurrencies.mockReturnValue({
      quotes: DEFAULT_PAIRS.map((pair) => ({
        pair,
        bid: 5,
        ask: 5.05,
        mid: 5.025,
        changePct: 0,
        timestamp: 1,
      })),
      isLoading: false,
    });
    render(<Dashboard />);
    // CurrencyWidget renderiza o nome do par como heading nivel 3.
    DEFAULT_PAIRS.forEach((pair) => {
      expect(
        screen.getByRole('heading', { level: 3, name: pair }),
      ).toBeInTheDocument();
    });
  });

  it('deve renderizar skeleton para pares sem cotacao carregada ainda', () => {
    // Bootstrap REST em andamento - pares sem dado renderizam skeleton (decisao
    // do CurrencyWidget: quote=undefined => data-testid="widget-skeleton").
    // Sem isso, dashboard ficaria vazio durante o bootstrap inicial.
    mockUseCurrencies.mockReturnValue({ quotes: [], isLoading: true });
    render(<Dashboard />);
    expect(screen.getAllByTestId('widget-skeleton')).toHaveLength(
      DEFAULT_PAIRS.length,
    );
  });

  it('deve renderizar o NewsFeed com os itens vindos de useNews', () => {
    // Feed de noticias eh feature P1 do MVP. Verifica que o Dashboard
    // realmente conecta useNews ao componente NewsFeed.
    mockUseNews.mockReturnValue({
      items: [
        {
          id: 'n1',
          headline: 'Dolar sobe apos decisao do Fed',
          source: 'Reuters',
          url: 'https://reuters.com/article-1',
          impactedPairs: ['USD/BRL'],
          sentiment: 'negative',
          publishedAt: Date.now(),
        },
      ],
      isLoading: false,
    });
    render(<Dashboard />);
    expect(
      screen.getByText(/dolar sobe apos decisao do fed/i),
    ).toBeInTheDocument();
  });

  it('deve refletir o status do WebSocket no StatusBar', () => {
    // Criterio de aceitacao MVP: "Indicador visual do status da conexao
    // (Online / Reconectando / Offline)". Aqui validamos que a mudanca do
    // status no hook propaga para o componente StatusBar.
    mockUseWebSocket.mockReturnValue({
      status: 'connecting',
      lastMessage: null,
      send: vi.fn(),
    });
    render(<Dashboard />);
    // StatusBar usa role=status (a11y) e label "Reconectando" para connecting.
    expect(screen.getByRole('status')).toHaveTextContent(/reconectando/i);
  });

  it('deve exibir o titulo "DashMF" no header da pagina', () => {
    // Identidade visual minima - usuario sabe em qual aplicacao esta. Heading
    // nivel 1 atende ao criterio de hierarquia semantica (WCAG 2.1 AA).
    //
    // Por que `toHaveTextContent` em vez do `name` do getByRole: o titulo eh
    // estilizado como `Dash<span>MF</span>` (cor diferente em "MF"). O <span>
    // intermediario faz o accessible name ser computado como "Dash MF" (com
    // espaco), o que falharia em `name: /dashmf/i`. textContent eh normalizado
    // e isola o teste do detalhe de estilizacao.
    render(<Dashboard />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /dashmf/i,
    );
  });
});
