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
| Setup monorepo (pnpm + Turborepo) | Infraestrutura | P0 | Pendente |
| Servidor WebSocket (Fastify + ws) | Backend | P0 | Pendente |
| Hook `useWebSocket` com reconexão | Frontend | P0 | Pendente |
| Widget de cotação (par de moedas) | Frontend | P0 | Pendente |
| Integração ExchangeRate-API | Backend Adapter | P0 | Pendente |
| Integração BCB/PTAX | Backend Adapter | P1 | Pendente |
| Poller de cotações (30s) | Backend Worker | P0 | Pendente |
| Cache Redis de cotações | Backend | P0 | Pendente |
| Feed de notícias (NewsAPI) | Backend + Frontend | P1 | Pendente |
| Poller de notícias (5min) | Backend Worker | P1 | Pendente |
| Status bar da conexão WS | Frontend | P1 | Pendente |
| Health endpoint (`GET /health`) | Backend | P1 | Pendente |
| CI/CD GitHub Actions | Infraestrutura | P1 | Pendente |
| Variação % (colorida) nas cotações | Frontend | P2 | Pendente |
| Sentry básico (captura de erros) | Monitoramento | P2 | Pendente |

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

---

*Baseado no Método Akita — documento vivo*
