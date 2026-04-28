/**
 * Testes do adapter do Banco Central do Brasil (PTAX).
 *
 * Endpoint OData publico, sem autenticacao (DATA_GOVERNANCE.md secao 1.1).
 * Util para validar consistencia das taxas USD/BRL e EUR/BRL com fonte oficial.
 *
 * Feature P1 do MVP segundo o ROADMAP.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BCBAdapter } from '../BCBAdapter';

const mockFetch = vi.fn();
beforeEach(() => {
  // Garante isolamento entre testes.
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('BCBAdapter.fetchPtax', () => {
  it('deve montar URL OData correta para o par USD/BRL', async () => {
    // Resposta padrao OData do BCB.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        value: [{ cotacaoCompra: 5.10, cotacaoVenda: 5.12, dataHoraCotacao: '2026-04-26 13:00:00.000' }],
      }),
    });
    const adapter = new BCBAdapter();
    // Solicita PTAX para USD.
    await adapter.fetchPtax('USD');
    // A URL precisa ter o formato esperado da API olinda.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(/olinda\.bcb\.gov\.br.*PTAX.*USD/),
      expect.any(Object),
    );
  });

  it('deve mapear cotacaoCompra para bid e cotacaoVenda para ask', async () => {
    // BCB usa terminologia portuguesa - precisa ser traduzida ao formato Quote.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        value: [{ cotacaoCompra: 5.10, cotacaoVenda: 5.12, dataHoraCotacao: '2026-04-26 13:00:00.000' }],
      }),
    });
    const adapter = new BCBAdapter();
    const quote = await adapter.fetchPtax('USD');
    // bid = compra (preco que o BC compra do mercado).
    expect(quote.bid).toBe(5.10);
    // ask = venda (preco que o BC vende ao mercado).
    expect(quote.ask).toBe(5.12);
    // mid = media.
    expect(quote.mid).toBeCloseTo(5.11);
  });

  it('deve converter dataHoraCotacao para epoch ms no campo timestamp', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        value: [{ cotacaoCompra: 5.10, cotacaoVenda: 5.12, dataHoraCotacao: '2026-04-26 13:00:00.000' }],
      }),
    });
    const adapter = new BCBAdapter();
    const quote = await adapter.fetchPtax('USD');
    // O timestamp deve corresponder a 2026-04-26 13:00:00 (interpretado como UTC-3 BR).
    expect(quote.timestamp).toBe(new Date('2026-04-26T13:00:00-03:00').getTime());
  });

  it('deve lancar erro quando value vem vazio (nao houve cotacao no dia)', async () => {
    // Em finais de semana e feriados o BCB nao publica PTAX.
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ value: [] }) });
    const adapter = new BCBAdapter();
    // Sinaliza ao service para usar fonte alternativa.
    await expect(adapter.fetchPtax('USD')).rejects.toThrow(/sem cotacao/i);
  });

  it('deve aceitar somente moedas suportadas pelo BCB (USD, EUR, GBP, JPY)', async () => {
    const adapter = new BCBAdapter();
    // BCB nao publica PTAX para criptos.
    await expect(adapter.fetchPtax('BTC')).rejects.toThrow(/nao suportada/i);
  });

  it('deve definir User-Agent personalizado para identificacao em logs do BCB', async () => {
    // Boa pratica: APIs publicas pedem identificacao do consumer.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ value: [{ cotacaoCompra: 1, cotacaoVenda: 1, dataHoraCotacao: '2026-04-26 13:00:00.000' }] }),
    });
    const adapter = new BCBAdapter();
    await adapter.fetchPtax('USD');
    // Verifica que o header esta presente.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': expect.stringContaining('DashMF') }) }),
    );
  });
});
