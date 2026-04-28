/**
 * Testes do NewsFeed.
 *
 * Lista cronologica reversa de noticias, cada item com link externo (rel=noopener).
 * Feature P1 do MVP.
 *
 * SECURITY.md - target=_blank obrigatoriamente com rel="noopener noreferrer".
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewsFeed } from '../NewsFeed';

const sample = [
  { id: '1', headline: 'Fed mantem juros', source: 'Reuters', url: 'https://r.com/1', impactedPairs: ['USD/BRL'], sentiment: 'neutral' as const, publishedAt: 1714147200000 },
  { id: '2', headline: 'Petroleo cai 3%', source: 'Bloomberg', url: 'https://b.com/2', impactedPairs: ['USD/BRL'], sentiment: 'negative' as const, publishedAt: 1714147300000 },
];

describe('NewsFeed', () => {
  it('deve renderizar todas as headlines', () => {
    render(<NewsFeed items={sample} />);
    expect(screen.getByText('Fed mantem juros')).toBeInTheDocument();
    expect(screen.getByText('Petroleo cai 3%')).toBeInTheDocument();
  });

  it('cada link deve ter rel="noopener noreferrer" e target="_blank" (SECURITY.md)', () => {
    // Mitigacao tabnabbing.
    render(<NewsFeed items={sample} />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringMatching(/noopener/));
    });
  });

  it('deve mostrar a fonte de cada noticia', () => {
    // Atribuicao da fonte e requisito legal/etico.
    render(<NewsFeed items={sample} />);
    expect(screen.getByText('Reuters')).toBeInTheDocument();
    expect(screen.getByText('Bloomberg')).toBeInTheDocument();
  });

  it('deve renderizar tag de sentimento (positive/negative/neutral) - V1', () => {
    // V1 do ROADMAP - sentimento exibido.
    render(<NewsFeed items={sample} />);
    expect(screen.getByTestId('sentiment-2')).toHaveAttribute('data-sentiment', 'negative');
  });

  it('deve mostrar mensagem amigavel quando lista esta vazia', () => {
    // UX: nao mostrar tela em branco.
    render(<NewsFeed items={[]} />);
    expect(screen.getByText(/nenhuma not[ií]cia/i)).toBeInTheDocument();
  });

  it('deve usar id como key estavel (sem warnings do React)', () => {
    // Implicito - React usaria index se faltasse key, gerando warning.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<NewsFeed items={sample} />);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('unique "key"'),
    );
    consoleErrorSpy.mockRestore();
  });
});
