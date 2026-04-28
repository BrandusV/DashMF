# CLAUDE.md — Instruções do Agente para o Projeto

> Este arquivo é lido automaticamente pelo agente em cada sessão.
> Ele define contexto, convenções e regras inegociáveis do projeto.

---

## 🎯 Identidade do Projeto

**Nome:** Dashboard Interativo de Mercado Financeiro
**Objetivo:** Dashboard em tempo real que exibe cotações de moedas e notícias de alto impacto sobre variações cambiais, conectado via WebSocket.
**Metodologia:** Método Akita (5 etapas: Governança → Arquitetura → TDD → Execução → Monitoramento)
**Dono do Projeto:** BrandusV (vambs0@gmail.com)

---

## 📂 Estrutura de Documentos de Governança

| Arquivo | Propósito |
|---|---|
| `CLAUDE.md` | Este arquivo — instruções para o agente |
| `README.md` | Porta de entrada pública do projeto |
| `DATA_GOVERNANCE.md` | Fontes de dados, segurança, LGPD, backup |
| `ARCHITECTURE.md` | Stack, monorepo, WebSocket, módulos |
| `ROADMAP.md` | Fases MVP → V1 → V2 e backlog |
| `SECURITY.md` | Credenciais, variáveis de ambiente, CORS |
| `CONTRIBUTING.md` | Commits, branches, TDD, PR checklist |

---

## 🗂️ Estrutura de Pastas do Projeto (Monorepo)

```
dashboard-mercado-financeiro/
├── apps/
│   ├── web/                    # Frontend (React + Vite ou Next.js)
│   │   ├── src/
│   │   │   ├── components/     # Componentes visuais do dashboard
│   │   │   ├── hooks/          # Custom hooks (useWebSocket, useCurrency, useNews)
│   │   │   ├── pages/          # Páginas principais
│   │   │   ├── services/       # Camada de chamadas a APIs externas
│   │   │   ├── store/          # Estado global (Zustand ou Redux)
│   │   │   └── types/          # Tipos TypeScript locais
│   │   ├── public/
│   │   └── package.json
│   └── api/                    # Backend (Node.js + Fastify ou Express)
│       ├── src/
│       │   ├── routes/         # Rotas REST
│       │   ├── services/       # Lógica de negócio
│       │   ├── websocket/      # Servidor WebSocket
│       │   ├── adapters/       # Conectores para APIs externas
│       │   └── types/
│       └── package.json
├── packages/
│   ├── types/                  # Tipos TypeScript compartilhados
│   ├── utils/                  # Funções utilitárias compartilhadas
│   └── config/                 # Configurações compartilhadas (ESLint, TSConfig)
├── scripts/
│   ├── backup.sh
│   └── seed.ts
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docs/
│   ├── runbooks/
│   ├── post-mortems/
│   └── adr/
├── CLAUDE.md
├── README.md
├── DATA_GOVERNANCE.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── SECURITY.md
├── CONTRIBUTING.md
└── package.json
```

---

## 🛠️ Stack Técnico Definido

### Frontend
- **Framework:** React 18+ com TypeScript
- **Build:** Vite (dev) / Next.js (se SSR for necessário)
- **Estilo:** Tailwind CSS + shadcn/ui
- **Estado:** Zustand
- **Gráficos:** Recharts ou TradingView Lightweight Charts
- **WebSocket Client:** nativo (`WebSocket` API) com hook `useWebSocket`

### Backend
- **Runtime:** Node.js 20 LTS
- **Framework:** Fastify (alta performance)
- **WebSocket Server:** `ws` ou `@fastify/websocket`
- **Validação:** Zod
- **ORM:** Prisma

### Dados em Tempo Real
- **Cotações:** ExchangeRate-API, Open Exchange Rates, Binance WS
- **Notícias:** NewsAPI, GNews, RSS feeds
- **Protocolo:** WebSocket

### Infraestrutura
- **Monorepo:** pnpm workspaces + Turborepo
- **Deploy:** Vercel (frontend) + Railway (backend)
- **CI/CD:** GitHub Actions
- **Monitoramento:** Sentry + Uptime Robot

---

## 📏 Convenções Inegociáveis

1. **TypeScript estrito** — sem `any` implícito.
2. **Zod para validação** — toda entrada de dados externos.
3. **Nunca commitar `.env`** — usar `.env.example`.
4. **Sem segredos no código** — sempre via `process.env`.
5. **Componentes pequenos** — máximo ~150 linhas.
6. **TDD obrigatório** — testes antes do código de produção.
7. **Conventional Commits** — formato padronizado.

---

## ⚠️ Regras Críticas para o Agente

- **Nunca** criar arquivos `.env` com valores reais no repositório.
- **Sempre** consultar `DATA_GOVERNANCE.md` antes de adicionar novas fontes de dados.
- **Sempre** consultar `ARCHITECTURE.md` antes de adicionar novos módulos.
- **Sempre** seguir o ciclo TDD (Red → Green → Refactor).
- Ao receber novos documentos, **atualizar a documentação antes de escrever código**.

---

*Gerado com base no Método Akita — última atualização: 2026-04-26*
