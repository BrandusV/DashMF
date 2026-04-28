/**
 * Testes do StatusBar.
 *
 * Indicador visual da conexao WebSocket.
 * Feature P1 do MVP - usuario sempre sabe se a tela esta atualizada ou nao.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar';

describe('StatusBar', () => {
  it('deve mostrar "Online" quando status=online', () => {
    // Estado normal - dashboard sincronizado.
    render(<StatusBar status="online" />);
    expect(screen.getByText(/online/i)).toBeInTheDocument();
  });

  it('deve mostrar "Reconectando" quando status=connecting', () => {
    // Backoff em andamento - feedback claro evita confusao.
    render(<StatusBar status="connecting" />);
    expect(screen.getByText(/reconectando|conectando/i)).toBeInTheDocument();
  });

  it('deve mostrar "Offline" quando status=offline', () => {
    // Sem conexao - usuario sabe que dados estao stale.
    render(<StatusBar status="offline" />);
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
  });

  it('deve aplicar cor verde para online, amarelo para connecting, vermelho para offline', () => {
    // Convencao visual padrao de status.
    const { rerender } = render(<StatusBar status="online" />);
    expect(screen.getByTestId('status-dot').className).toMatch(/(green|emerald)/);
    rerender(<StatusBar status="connecting" />);
    expect(screen.getByTestId('status-dot').className).toMatch(/(yellow|amber)/);
    rerender(<StatusBar status="offline" />);
    expect(screen.getByTestId('status-dot').className).toMatch(/(red|rose)/);
  });

  it('deve ter role=status para leitores de tela (a11y)', () => {
    // ARIA - mudanca de status anunciada por screen reader.
    render(<StatusBar status="online" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('deve mostrar timestamp da ultima atualizacao quando lastUpdate e passado', () => {
    // Util quando offline - mostra "ultima sincronizacao foi a X minutos".
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    render(<StatusBar status="offline" lastUpdate={fiveMinAgo} />);
    expect(screen.getByText(/5\s*min/i)).toBeInTheDocument();
  });
});
