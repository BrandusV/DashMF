/**
 * Testes dos schemas Zod compartilhados.
 *
 * Estes schemas serao a unica fonte de verdade para validar:
 *  - mensagens trafegadas no WebSocket (cliente <-> servidor)
 *  - respostas das APIs externas (ExchangeRate, BCB, NewsAPI)
 *  - payloads de rotas REST do backend
 *
 * O codigo de producao em `packages/types/src/schemas.ts` ainda nao existe -
 * estes testes seguem o ciclo TDD (RED) descrito em CONTRIBUTING.md.
 */

import { describe, it, expect } from 'vitest';
// Importa todos os schemas que serao implementados no arquivo de producao.
import {
  quoteSchema,
  newsItemSchema,
  feedStatusSchema,
  wsServerMessageSchema,
  wsClientMessageSchema,
  alertConditionSchema,
  pairSchema,
} from '../schemas';

describe('pairSchema', () => {
  it('deve aceitar par valido no formato BASE/QUOTE com 3 letras maiusculas', () => {
    // Garante que pares como "USD/BRL" passam, conforme convencao definida em ARCHITECTURE.md secao 3.
    expect(() => pairSchema.parse('USD/BRL')).not.toThrow();
  });

  it('deve rejeitar par sem barra separadora', () => {
    // Protege o sistema de identificadores invalidos vindos do cliente.
    expect(() => pairSchema.parse('USDBRL')).toThrow();
  });

  it('deve rejeitar par com letras minusculas', () => {
    // Padroniza a representacao para evitar duplicidade de chaves no cache Redis.
    expect(() => pairSchema.parse('usd/brl')).toThrow();
  });

  it('deve rejeitar par com mais de 3 letras por lado', () => {
    // Reforca que apenas codigos ISO-4217 (3 letras) sao aceitos.
    expect(() => pairSchema.parse('USDX/BRL')).toThrow();
  });
});

describe('quoteSchema', () => {
  it('deve validar uma cotacao completa com bid, ask, mid, changePct e timestamp', () => {
    // Reflete o contrato exato de QUOTE_UPDATE descrito em ARCHITECTURE.md.
    const valid = {
      pair: 'USD/BRL',
      bid: 5.1234,
      ask: 5.129,
      mid: 5.1262,
      changePct: 0.088,
      timestamp: 1714147200000,
    };
    // O parse deve retornar exatamente o mesmo objeto, sem campos extras.
    expect(quoteSchema.parse(valid)).toEqual(valid);
  });

  it('deve rejeitar bid negativo', () => {
    // Cotacoes nunca podem ser negativas - protege contra dados corrompidos da API externa.
    const invalid = { pair: 'USD/BRL', bid: -1, ask: 5.12, mid: 5.12, changePct: 0, timestamp: 1 };
    expect(() => quoteSchema.parse(invalid)).toThrow();
  });

  it('deve rejeitar timestamp nao numerico', () => {
    // Garante que o timestamp seja um epoch ms valido para ordenacao de eventos.
    const invalid = { pair: 'USD/BRL', bid: 5, ask: 5.1, mid: 5.05, changePct: 0, timestamp: 'now' };
    expect(() => quoteSchema.parse(invalid)).toThrow();
  });

  it('deve rejeitar bid maior que ask (spread invertido)', () => {
    // Spread invertido indica erro logico do adapter - validacao adicional contra inconsistencia.
    const invalid = { pair: 'USD/BRL', bid: 5.20, ask: 5.10, mid: 5.15, changePct: 0, timestamp: 1 };
    expect(() => quoteSchema.parse(invalid)).toThrow();
  });
});

describe('newsItemSchema', () => {
  it('deve validar uma noticia completa com id, headline, source, url, impactedPairs e publishedAt', () => {
    // Reflete o contrato de NEWS_ALERT descrito em ARCHITECTURE.md.
    const valid = {
      id: 'abc123',
      headline: 'Fed mantem juros',
      source: 'Reuters',
      url: 'https://example.com/news/1',
      impactedPairs: ['USD/BRL'],
      sentiment: 'neutral' as const,
      publishedAt: 1714147200000,
    };
    expect(newsItemSchema.parse(valid)).toEqual(valid);
  });

  it('deve rejeitar URL invalida (sem protocolo http/https)', () => {
    // Mitiga risco de XSS/clickjacking via links arbitrarios injetados pela fonte externa.
    const invalid = {
      id: 'a',
      headline: 'h',
      source: 's',
      url: 'javascript:alert(1)',
      impactedPairs: [],
      sentiment: 'neutral',
      publishedAt: 1,
    };
    expect(() => newsItemSchema.parse(invalid)).toThrow();
  });

  it('deve aceitar sentiment apenas com valores positive | negative | neutral', () => {
    // Padroniza o vocabulario do analisador de sentimento previsto na Fase V1.
    const invalid = { id: 'a', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'bullish', publishedAt: 1 };
    expect(() => newsItemSchema.parse(invalid)).toThrow();
  });

  it('deve aceitar impactedPairs vazio (noticia geral sem par especifico)', () => {
    // Ha noticias macroeconomicas que afetam todo o mercado e nao um par especifico.
    const valid = { id: 'a', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral' as const, publishedAt: 1 };
    expect(newsItemSchema.parse(valid)).toEqual(valid);
  });
});

describe('feedStatusSchema', () => {
  it('deve validar status com source, status (healthy|degraded|down) e latencyMs', () => {
    // Contrato de FEED_STATUS - permite ao frontend mostrar a saude de cada fonte.
    const valid = { source: 'ExchangeRate-API', status: 'healthy' as const, latencyMs: 45 };
    expect(feedStatusSchema.parse(valid)).toEqual(valid);
  });

  it('deve rejeitar latencyMs negativa', () => {
    // Latencia negativa nao tem significado fisico.
    expect(() => feedStatusSchema.parse({ source: 's', status: 'healthy', latencyMs: -1 })).toThrow();
  });
});

describe('alertConditionSchema', () => {
  it('deve aceitar condicoes "above" e "below"', () => {
    // Conjunto fechado de operadores suportados pelo SET_ALERT - alinha com V1 do ROADMAP.
    expect(alertConditionSchema.parse('above')).toBe('above');
    expect(alertConditionSchema.parse('below')).toBe('below');
  });

  it('deve rejeitar condicao "equal" (nao suportada por design - cotacoes raramente igualam exatamente)', () => {
    // Decisao explicita: igualdade exata nao e util em tempo real - documentada em ADR.
    expect(() => alertConditionSchema.parse('equal')).toThrow();
  });
});

describe('wsServerMessageSchema (mensagens Servidor -> Cliente)', () => {
  it('deve validar mensagem QUOTE_UPDATE com payload Quote', () => {
    // Mensagem mais frequente do sistema - precisa ser ultra rapida no parsing.
    const msg = {
      type: 'QUOTE_UPDATE',
      payload: { pair: 'USD/BRL', bid: 5.1, ask: 5.15, mid: 5.125, changePct: 0.1, timestamp: 1 },
    };
    expect(wsServerMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve validar mensagem NEWS_ALERT com payload NewsItem', () => {
    // Tipo discriminado pela propriedade "type" - garante exhaustive switch no consumer.
    const msg = {
      type: 'NEWS_ALERT',
      payload: { id: '1', headline: 'h', source: 's', url: 'https://x.com', impactedPairs: [], sentiment: 'neutral', publishedAt: 1 },
    };
    expect(wsServerMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve validar mensagem PRICE_ALERT_TRIGGERED com pair, condition, threshold e currentValue', () => {
    // Disparo do alerta configurado pelo cliente.
    const msg = {
      type: 'PRICE_ALERT_TRIGGERED',
      payload: { pair: 'USD/BRL', condition: 'above', threshold: 5.20, currentValue: 5.21 },
    };
    expect(wsServerMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve validar mensagem FEED_STATUS', () => {
    // Mantem o frontend ciente da disponibilidade das fontes externas.
    const msg = { type: 'FEED_STATUS', payload: { source: 'BCB', status: 'degraded', latencyMs: 1500 } };
    expect(wsServerMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve rejeitar mensagem com type desconhecido', () => {
    // Defesa em profundidade contra mensagens forjadas ou versoes incompativeis do protocolo.
    expect(() => wsServerMessageSchema.parse({ type: 'HACKED', payload: {} })).toThrow();
  });
});

describe('wsClientMessageSchema (mensagens Cliente -> Servidor)', () => {
  it('deve validar SUBSCRIBE com array de pares', () => {
    // Cliente subscreve a multiplos pares em uma unica mensagem.
    const msg = { type: 'SUBSCRIBE', payload: { pairs: ['USD/BRL', 'EUR/BRL'] } };
    expect(wsClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve validar SET_ALERT com pair, condition e threshold', () => {
    // Configuracao de alerta - feature P0 da Fase V1.
    const msg = { type: 'SET_ALERT', payload: { pair: 'USD/BRL', condition: 'above', threshold: 5.20 } };
    expect(wsClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve validar PING sem payload', () => {
    // Mensagem de keep-alive para detectar conexoes mortas (NAT timeouts, proxies).
    const msg = { type: 'PING' };
    expect(wsClientMessageSchema.parse(msg)).toEqual(msg);
  });

  it('deve rejeitar SUBSCRIBE com pairs vazio', () => {
    // Subscrever a nada e sintoma de bug no cliente - rejeitar para sinalizar.
    expect(() => wsClientMessageSchema.parse({ type: 'SUBSCRIBE', payload: { pairs: [] } })).toThrow();
  });

  it('deve rejeitar SET_ALERT com threshold nao positivo', () => {
    // Threshold deve ser preco real (positivo).
    expect(() => wsClientMessageSchema.parse({ type: 'SET_ALERT', payload: { pair: 'USD/BRL', condition: 'above', threshold: 0 } })).toThrow();
  });

  it('deve rejeitar SUBSCRIBE com mais de 20 pares (limite arquitetural MVP)', () => {
    // Limite definido na secao "Escalabilidade e Limites" de ARCHITECTURE.md (20 pares).
    const muitos = Array.from({ length: 21 }, (_, i) => `AAA/B${i.toString().padStart(2, '0')}`);
    expect(() => wsClientMessageSchema.parse({ type: 'SUBSCRIBE', payload: { pairs: muitos } })).toThrow();
  });
});
