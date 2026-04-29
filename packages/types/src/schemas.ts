/**
 * Schemas Zod compartilhados - fonte unica de verdade do contrato de dados.
 *
 * Conforme ARCHITECTURE.md, todo dado externo (APIs de cotacao, NewsAPI,
 * mensagens WebSocket) DEVE ser validado por estes schemas antes de
 * trafegar pelo sistema. O TypeScript so valida em tempo de compilacao;
 * estes schemas validam em runtime, fechando a lacuna nas bordas do sistema.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// pairSchema: identifica um par de moedas no formato ISO-4217 (BASE/QUOTE).
// Exemplo: "USD/BRL" = quantos reais (BRL) custa 1 dolar americano (USD).
// Regex exige exatamente 3 letras maiusculas + barra + 3 letras maiusculas.
// Padronizar maiusculas evita chaves duplicadas no cache Redis ("usd/brl"
// vs "USD/BRL" seriam entradas diferentes).
// ---------------------------------------------------------------------------
export const pairSchema = z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/);

// ---------------------------------------------------------------------------
// quoteSchema: cotacao instantanea de um par.
// `superRefine` adiciona validacao cruzada (bid <= ask) que regras de campo
// isoladas nao conseguem expressar - protege contra spread invertido vindo
// de adapter com bug.
// ---------------------------------------------------------------------------
export const quoteSchema = z
  .object({
    pair: pairSchema,
    bid: z.number().nonnegative(),
    ask: z.number().nonnegative(),
    mid: z.number().nonnegative(),
    changePct: z.number(),
    timestamp: z.number().int().nonnegative(),
  })
  .superRefine((quote, ctx) => {
    if (quote.bid > quote.ask) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bid nao pode ser maior que ask (spread invertido)',
        path: ['bid'],
      });
    }
  });

// ---------------------------------------------------------------------------
// sentimentSchema: vocabulario fechado para classificacao de noticias.
// Enum permite exhaustive switch no consumer (TypeScript avisa se faltar caso).
// ---------------------------------------------------------------------------
const sentimentSchema = z.enum(['positive', 'negative', 'neutral']);

// ---------------------------------------------------------------------------
// newsItemSchema: noticia normalizada do feed externo.
// `z.string().url()` ja garante formato de URL valido; o refine extra restringe
// a http/https para mitigar XSS via "javascript:" injetado pela fonte.
// ---------------------------------------------------------------------------
export const newsItemSchema = z.object({
  id: z.string().min(1),
  headline: z.string().min(1),
  source: z.string().min(1),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'URL deve usar protocolo http ou https',
    }),
  impactedPairs: z.array(pairSchema),
  sentiment: sentimentSchema,
  publishedAt: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// feedStatusSchema: saude de cada fonte de dados externa.
// Permite ao frontend mostrar quando uma API esta lenta (degraded) ou caiu (down).
// ---------------------------------------------------------------------------
export const feedStatusSchema = z.object({
  source: z.string().min(1),
  status: z.enum(['healthy', 'degraded', 'down']),
  latencyMs: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// alertConditionSchema: operadores suportados em SET_ALERT.
// "equal" foi excluido por design (cotacoes raramente igualam exatamente em
// tempo real, ver ADR correspondente).
// ---------------------------------------------------------------------------
export const alertConditionSchema = z.enum(['above', 'below']);

// ---------------------------------------------------------------------------
// wsServerMessageSchema: uniao discriminada das mensagens Servidor -> Cliente.
// `z.discriminatedUnion` usa o campo `type` como tag, permitindo parsing
// rapido e exhaustive switch no frontend.
// ---------------------------------------------------------------------------
export const wsServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('QUOTE_UPDATE'),
    payload: quoteSchema,
  }),
  z.object({
    type: z.literal('NEWS_ALERT'),
    payload: newsItemSchema,
  }),
  z.object({
    type: z.literal('PRICE_ALERT_TRIGGERED'),
    payload: z.object({
      pair: pairSchema,
      condition: alertConditionSchema,
      threshold: z.number().positive(),
      currentValue: z.number().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal('FEED_STATUS'),
    payload: feedStatusSchema,
  }),
]);

// ---------------------------------------------------------------------------
// wsClientMessageSchema: uniao discriminada das mensagens Cliente -> Servidor.
// Limite de 20 pares no SUBSCRIBE vem da secao "Escalabilidade e Limites" do
// ARCHITECTURE.md - protege o servidor de clientes que tentem subscrever a tudo.
// ---------------------------------------------------------------------------
export const wsClientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SUBSCRIBE'),
    payload: z.object({
      pairs: z.array(pairSchema).min(1).max(20),
    }),
  }),
  z.object({
    type: z.literal('SET_ALERT'),
    payload: z.object({
      pair: pairSchema,
      condition: alertConditionSchema,
      threshold: z.number().positive(),
    }),
  }),
  z.object({
    type: z.literal('PING'),
  }),
]);

// ---------------------------------------------------------------------------
// Tipos TypeScript inferidos automaticamente dos schemas.
// `z.infer` extrai o tipo estatico de um schema, evitando duplicacao manual.
// O resto do codigo importa esses tipos em vez de redefinir interfaces.
// ---------------------------------------------------------------------------
export type Pair = z.infer<typeof pairSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type NewsItem = z.infer<typeof newsItemSchema>;
export type FeedStatus = z.infer<typeof feedStatusSchema>;
export type AlertCondition = z.infer<typeof alertConditionSchema>;
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;
