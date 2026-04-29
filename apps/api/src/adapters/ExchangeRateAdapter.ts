/**
 * Adapter para a ExchangeRate-API (https://www.exchangerate-api.com).
 *
 * Responsabilidade: traduzir o formato de resposta da API externa para o
 * contrato interno `Quote` (definido em packages/types). Validacao defensiva
 * vive aqui porque eh a fronteira do sistema (DATA_GOVERNANCE.md secao 1).
 *
 * NUNCA logar a chave de API em mensagens de erro - regra explicita do
 * SECURITY.md (credenciais nao podem aparecer em logs estruturados nem em
 * stack traces que possam ir para Sentry).
 */
import type { Quote } from '@dashmf/types';
import { withTimeout } from '@dashmf/utils';

interface ExchangeRateAdapterOptions {
  timeoutMs?: number;
}

interface ExchangeRateApiResponse {
  result: 'success' | 'error';
  base_code?: string;
  conversion_rates?: Record<string, number>;
  'error-type'?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;
// Spread sintetico para o free tier que so retorna a taxa central. Equivale
// a +/-0.05% em torno do mid - alinhado a faixa tipica do mercado de varejo.
const SYNTHETIC_SPREAD = 0.0005;

export class ExchangeRateAdapter {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: ExchangeRateAdapterOptions = {}) {
    this.apiKey = apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async fetchQuote(base: string, target: string): Promise<Quote> {
    const url = `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/${base}`;
    let data: ExchangeRateApiResponse;
    try {
      const response = await withTimeout(fetch(url, { method: 'GET' }), this.timeoutMs);
      if (!response.ok) {
        throw new Error(`ExchangeRate-API HTTP ${response.status}`);
      }
      data = (await response.json()) as ExchangeRateApiResponse;
    } catch (err) {
      // Repassa preservando a mensagem original mas sem expor a URL (que contem a chave).
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`ExchangeRate-API ${base}/${target}: ${message}`);
    }

    if (data.result === 'error') {
      throw new Error(`ExchangeRate-API erro: ${data['error-type'] ?? 'unknown'}`);
    }
    const rate = data.conversion_rates?.[target];
    if (typeof rate !== 'number') {
      throw new Error(`ExchangeRate-API: par ${base}/${target} ausente na resposta`);
    }

    const mid = rate;
    const bid = mid * (1 - SYNTHETIC_SPREAD);
    const ask = mid * (1 + SYNTHETIC_SPREAD);

    return {
      pair: `${base}/${target}`,
      bid,
      ask,
      mid,
      // changePct eh calculado pelo CurrencyService a partir do historico.
      // O adapter nao tem contexto de cotacoes anteriores, retorna 0.
      changePct: 0,
      timestamp: Date.now(),
    };
  }
}
