/**
 * Testes de funcoes utilitarias compartilhadas entre apps/web e apps/api.
 * Foco: formatacao de moedas, normalizacao de pares, calculo de variacao.
 */

import { describe, it, expect } from 'vitest';
// Funcoes que serao implementadas em packages/utils/src/format.ts.
import { formatCurrency, normalizePair, calculateChangePct, formatTimestamp } from '../format';

describe('formatCurrency', () => {
  it('deve formatar 5.1234 como BRL no padrao pt-BR', () => {
    // Padroniza saida monetaria para o usuario brasileiro.
    expect(formatCurrency(5.1234, 'BRL')).toBe('R$ 5,1234');
  });

  it('deve formatar 1.5 como USD no padrao en-US', () => {
    // Para USD usamos o padrao americano com ponto decimal.
    expect(formatCurrency(1.5, 'USD')).toBe('$1.5000');
  });

  it('deve manter 4 casas decimais (precisao FX)', () => {
    // Mercado de cambio trabalha com 4 casas (pip = 0.0001).
    expect(formatCurrency(5.1, 'BRL')).toBe('R$ 5,1000');
  });

  it('deve lancar erro para valor NaN', () => {
    // NaN representa erro de calculo upstream - nao deve ser silenciado.
    expect(() => formatCurrency(Number.NaN, 'BRL')).toThrow();
  });
});

describe('normalizePair', () => {
  it('deve converter "usd/brl" para "USD/BRL"', () => {
    // Garante chave consistente no Redis e nas mensagens WS.
    expect(normalizePair('usd/brl')).toBe('USD/BRL');
  });

  it('deve aceitar "USD-BRL" e converter para "USD/BRL"', () => {
    // Aceita o separador comum em URLs (-) mas a saida canonica e com /.
    expect(normalizePair('USD-BRL')).toBe('USD/BRL');
  });

  it('deve remover espacos em branco extremos', () => {
    // Resiliencia contra entrada vinda de query strings.
    expect(normalizePair('  USD/BRL  ')).toBe('USD/BRL');
  });

  it('deve lancar erro para par invalido (sem separador)', () => {
    // Nao tenta adivinhar - falha rapido para sinalizar bug do chamador.
    expect(() => normalizePair('USDBRL')).toThrow();
  });
});

describe('calculateChangePct', () => {
  it('deve calcular +10% quando current=110 e previous=100', () => {
    // Formula classica: (current - previous) / previous * 100.
    expect(calculateChangePct(110, 100)).toBeCloseTo(10);
  });

  it('deve calcular -5% quando current=95 e previous=100', () => {
    // Variacoes negativas devem ser sinalizadas com numero negativo.
    expect(calculateChangePct(95, 100)).toBeCloseTo(-5);
  });

  it('deve retornar 0 quando current === previous', () => {
    // Sem variacao - feature P2 do MVP usa este valor para nao colorir o widget.
    expect(calculateChangePct(100, 100)).toBe(0);
  });

  it('deve retornar 0 quando previous === 0 (evita divisao por zero)', () => {
    // Defensivo: na primeira leitura nao ha valor anterior.
    expect(calculateChangePct(100, 0)).toBe(0);
  });
});

describe('formatTimestamp', () => {
  it('deve formatar timestamp ms para "HH:MM:SS" no fuso local', () => {
    // Usado no header do widget para mostrar quando a cotacao foi atualizada.
    const ts = new Date('2026-04-26T15:30:45').getTime();
    // O matcher e um regex porque o resultado depende do TZ da maquina.
    expect(formatTimestamp(ts)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('deve lancar erro para timestamp negativo', () => {
    // Timestamp negativo geralmente indica bug upstream.
    expect(() => formatTimestamp(-1)).toThrow();
  });
});
