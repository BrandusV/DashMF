# ARCHITECTURE.md
## Dashboard Interativo de Mercado Financeiro

> **Etapa 2 do Método Akita** — Define o esqueleto do sistema: quais ferramentas usar,
> como os componentes se comunicam, como o código é organizado e como o sistema vai crescer.

---

## 1. Visão Geral da Arquitetura

```
CLIENTE (Browser)
  React Dashboard (Vite + TypeScript)
    CurrencyWidget | NewsFeed | ChartPanel | AlertsPanel
    Zustand Store  <--  useWebSocket Hook
          |
    WebSocket (wss://)  <-- Push de cotações e alertas
    REST API (https://) <-- Dados históricos e notícias
          |
BACKEND (Node.js + Fastify)
    WebSocket Server | REST Routes | Background Workers
          |
    Service Layer
    CurrencyAdapter | NewsAdapter | CacheService
          |
APIs Câmbio (externas) | APIs News (externas) | Redis (cache)
          |
    PostgreSQL (histórico + configurações)
```

---

## 2. Estrutura do Monorepo

```
dashboard-mercado-financeiro/
├── apps/
│   ├── web/                           (Frontend React)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── CurrencyWidget/
│   │       │   ├── NewsFeed/
│   │       │   ├── ChartPanel/
│   │       │   ├── AlertsPanel/
│   │       │   └── StatusBar/
│   │       ├── hooks/
│   │       │   ├── useWebSocket.ts
│   │       │   ├── useCurrencies.ts
│   │       │   └── useNews.ts
│   │       ├── store/
│   │       │   ├── currencyStore.ts
│   │       │   ├── newsStore.ts
│   │       │   └── settingsStore.ts
│   │       ├── services/
│   │       │   └── api.ts
│   │       └── pages/
│   │           └── Dashboard.tsx
│   └── api/                           (Backend Fastify)
│       └── src/
│           ├── routes/
│           │   ├── quotes.ts
│           │   ├── news.ts
│           │   └── health.ts
│           ├── websocket/
│           │   ├── server.ts
│           │   ├── handlers.ts
│           │   └── broadcaster.ts
│           ├── services/
│           │   ├── CurrencyService.ts
│           │   ├── NewsService.ts
│           │   └── AlertService.ts
│           ├── adapters/
│           │   ├── ExchangeRateAdapter.ts
│           │   ├── BinanceAdapter.ts
│           │   ├── BCBAdapter.ts
│           │   ├── NewsAPIAdapter.ts
│           │   └── GNewsAdapter.ts
│           └── workers/
│               ├── currencyPoller.ts
│               └── newsPoller.ts
├── packages/
│   ├── types/
│   ├── utils/
│   └── config/
├── docs/adr/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 3. Protocolo WebSocket — Contrato de Mensagens

### Servidor → Cliente

```typescript
// Atualização de cotação
{ type: "QUOTE_UPDATE", payload: { pair: "USD/BRL", bid: 5.1234, ask: 5.1290, mid: 5.1262, changePct: 0.088, timestamp: 1714147200000 } }

// Nova notícia de impacto
{ type: "NEWS_ALERT", payload: { id: "abc123", headline: "Fed mantém juros...", source: "Reuters", url: "https://...", impactedPairs: ["USD/BRL"], sentiment: "neutral", publishedAt: 1714147200000 } }

// Alerta de preço disparado
{ type: "PRICE_ALERT_TRIGGERED", payload: { pair: "USD/BRL", condition: "above", threshold: 5.20, currentValue: 5.21 } }

// Status da fonte de dados
{ type: "FEED_STATUS", payload: { source: "ExchangeRate-API", status: "healthy", latencyMs: 45 } }
```

### Cliente → Servidor

```typescript
// Subscrever pares
{ type: "SUBSCRIBE", payload: { pairs: ["USD/BRL", "EUR/BRL", "BTC/USD"] } }

// Configurar alerta
{ type: "SET_ALERT", payload: { pair: "USD/BRL", condition: "above", threshold: 5.20 } }

// Ping keep-alive
{ type: "PING" }
```

---

## 4. Fluxo de Dados em Tempo Real

```
APIs Externas (ExchangeRate, Binance, BCB)
        |
  Background Worker (currencyPoller.ts) -- a cada 30s
        |
  Valida (Zod) -> Normaliza -> Redis (TTL 30s) -> PostgreSQL (histórico)
        |
  WebSocket Broadcaster
        |
  Clientes React (useWebSocket hook)
        |
  Zustand Store -> Componentes re-renderizam
```

---

## 5. Stack Técnico Completo

### Frontend (`apps/web`)
| Tecnologia | Versão | Justificativa |
|---|---|---|
| React | 18+ | Concurrent Mode para UI fluida |
| TypeScript | 5+ | Segurança de tipos end-to-end |
| Vite | 5+ | Build ultra-rápido |
| Tailwind CSS | 3+ | Styling rápido e consistente |
| shadcn/ui | latest | Componentes acessíveis |
| Zustand | 4+ | Estado global performático |
| Recharts | 2+ | Gráficos declarativos |
| TanStack Query | 5+ | Cache de dados REST |

### Backend (`apps/api`)
| Tecnologia | Versão | Justificativa |
|---|---|---|
| Node.js | 20 LTS | Estabilidade a longo prazo |
| Fastify | 4+ | 3x mais rápido que Express |
| `ws` | 8+ | WebSocket server leve |
| Zod | 3+ | Validação de esquemas |
| Prisma | 5+ | ORM type-safe |
| Redis (ioredis) | 5+ | Cache em memória |

### Infraestrutura
| Tecnologia | Uso |
|---|---|
| pnpm workspaces | Gerenciador do monorepo |
| Turborepo | Builds em paralelo com cache |
| GitHub Actions | CI/CD |
| Vercel | Deploy frontend |
| Railway | Deploy backend + Redis + PostgreSQL |
| Sentry | Monitoramento de erros |

---

## 6. Decisões Arquiteturais (ADRs)

### ADR-001: WebSocket vs. Server-Sent Events (SSE)
- **Decisão:** WebSocket
- **Motivo:** Comunicação bidirecional necessária (alertas, subscrições).
- **Trade-off:** Servidor stateful. Mitigado com reconexão automática.

### ADR-002: Zustand vs. Redux
- **Decisão:** Zustand
- **Motivo:** Menos boilerplate, performance para atualizações frequentes.

### ADR-003: Fastify vs. Express
- **Decisão:** Fastify
- **Motivo:** Performance superior, TypeScript first-class, validação nativa.

### ADR-004: Monorepo vs. repositórios separados
- **Decisão:** Monorepo (pnpm + Turborepo)
- **Motivo:** Tipos compartilhados, refatorações atômicas.

---

## 7. Escalabilidade e Limites

| Métrica | Limite MVP | Solução para Escalar |
|---|---|---|
| Conexões WebSocket | ~500 (1 instância) | Redis Pub/Sub + múltiplas instâncias |
| Cotações monitoradas | 20 pares | Aumentar no poller |
| Latência de atualização | ~30s (free tier) | ~1s com Binance WS |

---

## 8. Histórico de Alterações

| Data | Versão | Alteração |
|---|---|---|
| 2026-04-26 | 1.0.0 | Criação inicial |

---

*Baseado no Método Akita — Etapa 2: Arquitetura da Solução*
