# Dashboard Interativo de Mercado Financeiro

> Dashboard em tempo real para acompanhamento de cotações de moedas e notícias de alto impacto cambial.
> Construído seguindo o **Método Akita** de engenharia de software.

---

## Funcionalidades

- **Cotações ao vivo** — USD/BRL, EUR/BRL, GBP/BRL, BTC/USD e mais, atualizadas via WebSocket
- **Feed de notícias** — Notícias financeiras filtradas por relevância cambial, em tempo real
- **Gráficos históricos** — Visualização de variação de preços com granularidade configurável
- **Alertas de preço** — Configure alertas personalizados por par de moedas e threshold
- **Indicador de impacto** — Análise de sentimento de notícias (positivo / negativo / neutro)
- **Status de conexão** — Indicador visual do estado do WebSocket e das fontes de dados

---

## Arquitetura Resumida

```
Frontend React (Vite) <-- WebSocket --> Backend Fastify (Node.js)
                                              |
                                 Redis     PostgreSQL  APIs Externas
                                (cache)   (histórico) (ExchangeRate, NewsAPI, BCB)
```

Para a arquitetura completa, consulte [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Como Rodar Localmente

### Pré-requisitos

- Node.js 20 LTS
- pnpm 9+
- Docker (para Redis e PostgreSQL locais)

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/dashboard-mercado-financeiro.git
cd dashboard-mercado-financeiro
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env e preencha suas chaves de API
```

Variáveis necessárias:

```env
EXCHANGE_RATE_API_KEY=           # https://www.exchangerate-api.com/
OPEN_EXCHANGE_RATES_APP_ID=      # https://openexchangerates.org/
NEWS_API_KEY=                    # https://newsapi.org/
GNEWS_API_KEY=                   # https://gnews.io/
DATABASE_URL=postgresql://user:password@localhost:5432/dashboard
REDIS_URL=redis://localhost:6379
JWT_SECRET=
```

### 4. Suba os serviços de infraestrutura

```bash
docker-compose up -d   # PostgreSQL + Redis
```

### 5. Execute as migrations do banco

```bash
pnpm --filter api prisma migrate dev
```

### 6. Inicie o projeto em modo desenvolvimento

```bash
pnpm dev   # Inicia frontend e backend em paralelo via Turborepo
```

- Dashboard: `http://localhost:5173`
- API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`

---

## Scripts Disponíveis

| Script | Descrição |
|---|---|
| `pnpm dev` | Inicia todos os apps em modo desenvolvimento |
| `pnpm build` | Build de produção de todos os apps |
| `pnpm test` | Executa todos os testes (Vitest + Playwright) |
| `pnpm lint` | Lint de todo o monorepo (ESLint) |
| `pnpm typecheck` | Verificação de tipos TypeScript |
| `pnpm db:migrate` | Executa migrations pendentes |
| `pnpm db:studio` | Abre Prisma Studio para explorar o banco |

---

## Documentação do Projeto

| Documento | Descrição |
|---|---|
| [DATA_GOVERNANCE.md](./DATA_GOVERNANCE.md) | Fontes de dados, segurança e conformidade LGPD |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura, stack, WebSocket e módulos |
| [ROADMAP.md](./ROADMAP.md) | Fases de desenvolvimento e backlog |
| [SECURITY.md](./SECURITY.md) | Política de segurança e gestão de credenciais |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guia de contribuição, TDD e convenções |

---

## Fases de Desenvolvimento

| Fase | Status | Descrição |
|---|---|---|
| **MVP** | Em andamento | Cotações ao vivo + WebSocket + Feed de notícias |
| **V1** | Planejado | Gráficos históricos + Alertas + Análise de sentimento |
| **V2** | Planejado | Multi-usuário + Notificações push + Dashboard customizável |

---

## Metodologia

Desenvolvido seguindo o **Método Akita** — 5 etapas:

1. **Governança** -> DATA_GOVERNANCE.md
2. **Arquitetura** -> ARCHITECTURE.md
3. **Implementação (TDD)** -> CONTRIBUTING.md
4. **Execução (CI/CD)** -> .github/workflows/
5. **Monitoramento** -> Sentry + Uptime Robot

---

*Última atualização: 2026-04-26*
