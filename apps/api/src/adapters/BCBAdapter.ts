/**
 * Adapter para a API Olinda do Banco Central do Brasil (PTAX).
 *
 * Endpoint publico OData, sem autenticacao (DATA_GOVERNANCE.md secao 1.1).
 * Funciona como fonte de verdade para validar cotacoes USD/BRL e EUR/BRL
 * obtidas em provedores comerciais (cross-check de consistencia).
 *
 * Em finais de semana e feriados o BCB nao publica PTAX - o adapter sinaliza
 * via erro para que o service decida: usar cache ou fallback comercial.
 */
import type { Quote } from '@dashmf/types';
import { withTimeout } from '@dashmf/utils';

interface BCBOptions {
  timeoutMs?: number;
}

interface BCBPtaxRow {
  cotacaoCompra: number;
  cotacaoVenda: number;
  dataHoraCotacao: string;
}

interface BCBPtaxResponse {
  value: BCBPtaxRow[];
}

const DEFAULT_TIMEOUT_MS = 5_000;
// Lista oficial das moedas com PTAX publicada diariamente pelo BCB.
// Criptos e moedas exoticas nao tem PTAX - o service deve cair em outro adapter.
const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY']);

export class BCBAdapter {
  private readonly timeoutMs: number;

  constructor(options: BCBOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetchPtax(currency: string): Promise<Quote> {
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new Error(`BCB: moeda ${currency} nao suportada pela PTAX`);
    }

    const url = this.buildUrl(currency);
    const response = await withTimeout(
      fetch(url, {
        method: 'GET',
        headers: {
          // BCB recomenda identificar o consumer em logs do servidor publico.
          'User-Agent': 'DashMF/0.1 (https://github.com/BrandusV/DashMF)',
          Accept: 'application/json',
        },
      }),
      this.timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`BCB: HTTP ${response.status}`);
    }
    const data = (await response.json()) as BCBPtaxResponse;

    const row = data.value[0];
    if (!row) {
      throw new Error(`BCB: sem cotacao para ${currency} no periodo solicitado`);
    }

    const bid = row.cotacaoCompra;
    const ask = row.cotacaoVenda;
    const mid = (bid + ask) / 2;

    return {
      // PTAX so cota contra BRL - par sempre XXX/BRL.
      pair: `${currency}/BRL`,
      bid,
      ask,
      mid,
      changePct: 0,
      timestamp: parseBcbTimestamp(row.dataHoraCotacao),
    };
  }

  private buildUrl(currency: string): string {
    // Endpoint OData espera a data no formato MM-DD-YYYY (peculiar do BCB) e a
    // moeda entre aspas simples como literal de string OData.
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateParam = `${mm}-${dd}-${yyyy}`;
    const base = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata';
    return (
      `${base}/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)` +
      `?@moeda='${currency}'&@dataCotacao='${dateParam}'&$top=1&$format=json`
    );
  }
}

/**
 * Converte "YYYY-MM-DD HH:MM:SS.sss" (horario de Brasilia, BCB nao informa TZ)
 * para epoch ms. Concatena offset -03:00 explicitamente para evitar que
 * o parser do V8 interprete como UTC ou como horario local da maquina.
 */
function parseBcbTimestamp(raw: string): number {
  const [date, time] = raw.split(' ');
  const iso = `${date}T${time}-03:00`;
  return new Date(iso).getTime();
}
