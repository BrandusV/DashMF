/**
 * Funcoes de formatacao compartilhadas entre apps/web e apps/api.
 *
 * Convencoes do dominio:
 *  - 4 casas decimais para cotacoes (precisao "pip" do mercado FX).
 *  - Pares sempre canonicos: "USD/BRL" maiusculo com barra como separador.
 *  - Timestamps em epoch ms (UTC) - converter so na renderizacao.
 */

// Mapa CURRENCY -> locale para formatacao monetaria.
// MVP cobre BRL/USD; novas moedas no V1 adicionam aqui sem tocar na funcao.
const CURRENCY_LOCALE: Record<string, string> = {
  BRL: 'pt-BR',
  USD: 'en-US',
};

// NBSP (U+00A0) e usado pelo Intl.NumberFormat entre simbolo e numero em alguns locales;
// construir o regex a partir do code point evita problemas de codificacao no editor.
const NBSP_REGEX = new RegExp(String.fromCharCode(0xa0), 'g');

/**
 * Formata um valor numerico como moeda no padrao do locale apropriado.
 * Mantem 4 casas decimais (precisao "pip" exigida pelo mercado de cambio).
 * Lanca para NaN porque valor NaN tipicamente vem de bug upstream e
 * silenciar isso esconderia o problema na UI.
 */
export function formatCurrency(value: number, currency: string): string {
  if (Number.isNaN(value)) {
    throw new Error(`formatCurrency: valor NaN nao e formatavel (currency=${currency})`);
  }
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
  // Normaliza NBSP para espaco comum para resultado estavel em testes e logs.
  return formatted.replace(NBSP_REGEX, ' ');
}

/**
 * Normaliza um par de moedas para o formato canonico "BASE/QUOTE" (ISO-4217).
 * Aceita variacoes praticas de entrada (minusculas, separador "-", espacos)
 * mas falha rapido para entradas que nao podem ser interpretadas com seguranca.
 */
export function normalizePair(input: string): string {
  const canonical = input.trim().toUpperCase().replace('-', '/');
  if (!/^[A-Z]{3}\/[A-Z]{3}$/.test(canonical)) {
    throw new Error(`normalizePair: par invalido "${input}" - formato esperado BASE/QUOTE`);
  }
  return canonical;
}

/**
 * Variacao percentual entre o valor atual e o anterior.
 * Retorna 0 quando previous=0 (defensivo contra divisao por zero na primeira leitura).
 */
export function calculateChangePct(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Converte um timestamp epoch ms para "HH:MM:SS" no fuso local.
 * Usado no header do widget de cotacao para mostrar a hora da ultima atualizacao.
 */
export function formatTimestamp(timestampMs: number): string {
  if (timestampMs < 0) {
    throw new Error(`formatTimestamp: timestamp negativo invalido (${timestampMs})`);
  }
  const date = new Date(timestampMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
