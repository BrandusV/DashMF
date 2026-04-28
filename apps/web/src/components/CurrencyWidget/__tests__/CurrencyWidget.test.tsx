/**
 * Testes do CurrencyWidget.
 *
 * Componente principal do dashboard - exibe 1 par com bid/ask/mid + variacao colorida.
 * Feature P0 do MVP (ROADMAP.md).
 *
 * Acessibilidade: deve ter aria-label e role apropriado.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CurrencyWidget } from '../CurrencyWidget';

describe('CurrencyWidget', () => {
  const baseQuote = {
    pair: 'USD/BRL',
    bid: 5.1234,
    ask: 5.1290,
    mid: 5.1262,
    changePct: 0.5,
    timestamp: Date.now(),
  };

  it('deve renderizar o nome do par', () => {
    // Identificacao visual basica.
    render(<CurrencyWidget quote={baseQuote} />);
    expect(screen.getByText('USD/BRL')).toBeInTheDocument();
  });

  it('deve formatar o mid no padrao do par (BRL)', () => {
    // formatCurrency aplicado no template.
    render(<CurrencyWidget quote={baseQuote} />);
    expect(screen.getByText(/R\$\s?5,1262/)).toBeInTheDocument();
  });

  it('deve mostrar bid e ask separadamente', () => {
    // Operadores cambistas precisam ver ambos os lados.
    render(<CurrencyWidget quote={baseQuote} />);
    expect(screen.getByText(/5,1234/)).toBeInTheDocument();
    expect(screen.getByText(/5,1290/)).toBeInTheDocument();
  });

  it('deve aplicar classe verde quando changePct > 0 (P2 do MVP)', () => {
    // ROADMAP MVP - variacao colorida.
    render(<CurrencyWidget quote={{ ...baseQuote, changePct: 1.5 }} />);
    const indicator = screen.getByTestId('change-pct');
    expect(indicator.className).toMatch(/text-(green|emerald|positive)/);
  });

  it('deve aplicar classe vermelha quando changePct < 0', () => {
    render(<CurrencyWidget quote={{ ...baseQuote, changePct: -1.5 }} />);
    const indicator = screen.getByTestId('change-pct');
    expect(indicator.className).toMatch(/text-(red|rose|negative)/);
  });

  it('deve aplicar classe neutra quando changePct = 0', () => {
    // Sem variacao - cor neutra para nao distrair.
    render(<CurrencyWidget quote={{ ...baseQuote, changePct: 0 }} />);
    const indicator = screen.getByTestId('change-pct');
    expect(indicator.className).toMatch(/text-(gray|neutral|muted)/);
  });

  it('deve ter aria-label descritivo (acessibilidade WCAG 2.1 AA)', () => {
    // Backlog - acessibilidade.
    render(<CurrencyWidget quote={baseQuote} />);
    expect(screen.getByLabelText(/USD\/BRL.*5,1262/i)).toBeInTheDocument();
  });

  it('deve mostrar skeleton/placeholder quando quote e undefined', () => {
    // Estado de loading durante bootstrap.
    render(<CurrencyWidget quote={undefined} />);
    expect(screen.getByTestId('widget-skeleton')).toBeInTheDocument();
  });
});
