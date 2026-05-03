# ROADMAP.md
## Dashboard Interativo de Mercado Financeiro

> Documento vivo. Atualizar conforme novas especificações forem adicionadas ao projeto.
> Cada fase deve respeitar o ciclo completo do Método Akita antes de avançar.

---

## Status das Fases

```
MVP (Fase 0) --> V1 (Fase 1) --> V2 (Fase 2) --> V3 (Fase 3)
  Em andamento   Planejado      Planejado        Conceito
```

---

## MVP — Fase 0: Fundação em Tempo Real

**Objetivo:** Dashboard funcional ao vivo com WebSocket, cotações de moedas e notícias básicas.

**Critérios de aceitação:**
- [ ] Conexão WebSocket estável com reconexão automática
- [ ] Cotações de pelo menos 5 pares de moedas atualizando ao vivo
- [ ] Feed de notícias financeiras com atualização a cada 5 minutos
- [ ] Indicador visual do status da conexão (Online / Reconectando / Offline)
- [ ] Layout responsivo (desktop e tablet)
- [ ] Cobertura de testes unitários >= 80% nos services
- [ ] Deploy em produção funcional (Vercel + Railway)

**Funcionalidades:**

| Feature | Módulo | Prioridade | Status |
|---|---|---|---|
| Setup monorepo (pnpm + Turborepo) | Infraestrutura | P0 | Implementado |
| Servidor WebSocket (Fastify + ws) | Backend | P0 | Implementado |
| Hook `useWebSocket` com reconexão | Frontend | P0 | Implementado |
| Widget de cotação (par de moedas) | Frontend | P0 | Implementado |
| Integração ExchangeRate-API | Backend Adapter | P0 | Implementado |
| Integração BCB/PTAX | Backend Adapter | P1 | Implementado |
| Poller de cotações (30s) | Backend Worker | P0 | Implementado |
| Cache Redis de cotações | Backend | P0 | Implementado (cache stub; ioredis injetado em prod via REDIS_URL) |
| Feed de notícias (NewsAPI) | Backend + Frontend | P1 | Implementado |
| Poller de notícias (5min) | Backend Worker | P1 | Implementado |
| Status bar da conexão WS | Frontend | P1 | Implementado |
| Health endpoint (`GET /health`) | Backend | P1 | Implementado |
| CI/CD GitHub Actions | Infraestrutura | P1 | Implementado (CI: lint+typecheck+test+build em PRs/push para main e develop. CD pendente até deploy.) |
| Variação % (colorida) nas cotações | Frontend | P2 | Implementado |
| Sentry básico (captura de erros) | Monitoramento | P2 | Implementado (web `@sentry/react` + api `@sentry/node`, ativados via `SENTRY_DSN`/`VITE_SENTRY_DSN`) |
| Entrypoint de produção do backend | Backend | P0 | Implementado (`apps/api/src/index.ts` com graceful shutdown SIGTERM/SIGINT) |
| Configs de deploy (Vercel + Railway) | Infraestrutura | P0 | Implementado (`vercel.json`, `railway.json`, `nixpacks.toml`) |
| Push `develop` para `origin` | Infraestrutura | P0 | Pendente |
| Deploy em produção (Vercel + Railway) | Infraestrutura | P0 | Pendente |

---

## V1 — Fase 1: Análise e Alertas

**Objetivo:** Adicionar gráficos históricos, alertas de preço e análise de sentimento de notícias.

**Pré-requisito:** MVP completo e estável em produção por >= 1 semana.

**Critérios de aceitação:**
- [ ] Gráfico de linha histórica para cada par de moedas (diário / semanal / mensal)
- [ ] Sistema de alertas: usuário configura threshold e recebe notificação no dashboard
- [ ] Notícias com tag de sentimento (positivo / negativo / neutro)
- [ ] Histórico persistido no PostgreSQL (mínimo 90 dias)
- [ ] Filtro de notícias por moeda relacionada
- [ ] Cobertura de testes E2E nos fluxos principais (Playwright)

**Funcionalidades:**

| Feature | Módulo | Prioridade | Status |
|---|---|---|---|
| Schema Prisma + migrations (histórico) | Backend / DB | P0 | Pendente |
| Worker que persiste cotações no banco | Backend Worker | P0 | Pendente |
| Endpoint `GET /quotes?pair=USD/BRL&range=7d` | Backend API | P0 | Pendente |
| Componente `ChartPanel` (Recharts) | Frontend | P0 | Pendente |
| Seletor de intervalo (1d / 7d / 1m / 3m) | Frontend | P1 | Pendente |
| Protocolo WS `SET_ALERT` | Backend + Frontend | P0 | Pendente |
| Componente `AlertsPanel` | Frontend | P0 | Pendente |
| Análise de sentimento de notícias | Backend Service | P1 | Pendente |
| Filtro de notícias por par de moedas | Frontend | P1 | Pendente |
| Testes E2E (Playwright) fluxo principal | QA | P2 | Pendente |

---

## V2 — Fase 2: Multi-usuário e Personalização

**Objetivo:** Suporte a múltiplos usuários com configurações persistidas, notificações push e painel customizável.

**Critérios de aceitação:**
- [ ] Autenticação de usuários (login via Google ou e-mail+senha)
- [ ] Configurações de alertas persistidas por usuário no banco
- [ ] Notificações push no browser (Web Push API)
- [ ] Seleção de moedas favoritas por usuário
- [ ] Layout do dashboard customizável (drag-and-drop de widgets)

**Funcionalidades:**

| Feature | Módulo | Prioridade | Status |
|---|---|---|---|
| Autenticação JWT (login/cadastro) | Backend + Frontend | P0 | Pendente |
| Schema usuários e preferências (Prisma) | Backend / DB | P0 | Pendente |
| Persistência de alertas por usuário | Backend | P0 | Pendente |
| Web Push notifications | Backend + Frontend | P1 | Pendente |
| Análise LGPD (coleta de PII) | Governança | P0 | Pendente |
| Atualizar DATA_GOVERNANCE.md (cadastro) | Documentação | P0 | Pendente |

---

## V3 — Fase 3: Inteligência e Integrações (Conceito)

- Indicadores técnicos (RSI, médias móveis)
- Correlação automática notícia <-> variação de preço
- API pública para desenvolvedores
- Integração com Telegram/WhatsApp para alertas

---

## Backlog de Melhorias Contínuas

| Item | Categoria |
|---|---|
| Suporte a criptomoedas via Binance WS | Dados |
| Dark/Light mode | UX |
| PWA (Progressive Web App) | Performance |
| Acessibilidade WCAG 2.1 AA | Acessibilidade |
| Documentação da API (OpenAPI/Swagger) | Developer XP |

---

## Histórico de Alterações

| Data | Versão | Alteração |
|---|---|---|
| 2026-04-26 | 1.0.0 | Criação inicial com MVP, V1, V2 e V3 |
| 2026-05-01 | 1.1.0 | MVP backend + frontend implementados (TDD GREEN). Pendentes: CI/CD, Sentry, deploy. |
| 2026-05-02 | 1.1.1 | CI GitHub Actions adicionado (lint+typecheck+test+build). Pendentes: Sentry, deploy. |
| 2026-05-03 | 1.2.0 | Sentry web+api integrado. Página Dashboard composta. Entrypoint de produção e configs Vercel/Railway/Nixpacks adicionados. Pendentes: push para origin e deploy real. |

---

*Baseado no Método Akita — documento vivo*
