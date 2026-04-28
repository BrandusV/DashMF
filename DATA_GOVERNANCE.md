# DATA_GOVERNANCE.md
## Dashboard Interativo de Mercado Financeiro

> **Etapa 1 do Método Akita** — Este documento é o contrato do projeto com a realidade dos dados.
> Ele deve ser lido e atualizado antes de qualquer mudança nas fontes de dados ou na infraestrutura.

---

## 1. Fontes de Dados

### 1.1 Cotações de Moedas (Câmbio)

| Fonte | URL / Endpoint | Protocolo | Autenticação | Frequência |
|---|---|---|---|---|
| ExchangeRate-API | `https://v6.exchangerate-api.com/v6/{KEY}/latest/{base}` | REST + WebSocket | API Key (header) | A cada 60s (free) / tempo real (pago) |
| Open Exchange Rates | `https://openexchangerates.org/api/latest.json` | REST | App ID (query param) | A cada 60s (free tier) |
| Binance WebSocket *(criptomoedas)* | `wss://stream.binance.com:9443/ws/{symbol}@ticker` | WebSocket nativo | Sem auth (stream público) | Tempo real (tick a tick) |
| Banco Central do Brasil (PTAX) | `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` | REST/OData | Aberto (sem chave) | Diário (D-1) |

**Moedas prioritárias monitoradas:** USD/BRL, EUR/BRL, GBP/BRL, BTC/USD, ETH/USD

### 1.2 Notícias de Mercado

| Fonte | URL / Endpoint | Protocolo | Autenticação | Cobertura |
|---|---|---|---|---|
| NewsAPI | `https://newsapi.org/v2/everything?q=forex+economia` | REST | API Key (header) | 70+ fontes internacionais |
| GNews | `https://gnews.io/api/v4/search?q=mercado+financeiro` | REST | API Key (query param) | Notícias em PT-BR + EN |
| RSS — InfoMoney | `https://www.infomoney.com.br/feed/` | RSS/XML | Aberto | Notícias financeiras BR |
| RSS — Valor Econômico | Feed público Valor | RSS/XML | Aberto | Macro + câmbio |

### 1.3 Dados Internos (Cache / Histórico)

| Tipo | Tecnologia | Propósito |
|---|---|---|
| Cache em memória | Redis (ou Upstash Redis serverless) | Evitar requisições repetidas às APIs externas; TTL de 30s para cotações |
| Histórico de cotações | PostgreSQL (Supabase) | Armazenar série histórica para gráficos de variação |
| Logs de eventos WebSocket | PostgreSQL ou arquivo de log | Rastreabilidade de conexões e eventos |

---

## 2. Classificação dos Dados

| Categoria | Exemplos | Sensibilidade | Armazenamento Permitido |
|---|---|---|---|
| **Dados de Mercado** | Cotações, variações, spreads | Público (via APIs abertas) | Cache + banco histórico |
| **Conteúdo Editorial** | Títulos de notícias, resumos | Público (via feeds) | Cache temporário (TTL 5min) |
| **Dados de Sessão** | Token de sessão do usuário | Interno / Privado | Memória do servidor (não persistido) |
| **Configurações do Usuário** | Moedas favoritas, alertas | Interno / Privado | Banco de dados, criptografado |
| **Chaves de API** | ExchangeRate Key, NewsAPI Key | **Confidencial** | Somente em variáveis de ambiente — NUNCA no código |
| **Logs de Acesso** | IP, timestamp, endpoint acessado | Interno | Servidor de logs (30 dias de retenção) |

> ⚠️ **Este projeto NÃO coleta dados pessoais identificáveis (PII)** na versão MVP.

---

## 3. Segurança

### 3.1 Dados em Trânsito
- **TLS 1.3 obrigatório** em todos os endpoints HTTP e WebSocket (`wss://`).
- Headers de segurança HTTP obrigatórios (gerenciados pelo Fastify Helmet).

### 3.2 Dados em Repouso
- Banco de dados PostgreSQL com criptografia em repouso habilitada.
- Backups encriptados com AES-256.

### 3.3 Gestão de Credenciais
```
# .env.example (commitar este arquivo — sem valores reais)
EXCHANGE_RATE_API_KEY=
OPEN_EXCHANGE_RATES_APP_ID=
NEWS_API_KEY=
GNEWS_API_KEY=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
```

---

## 4. Conformidade Legal (LGPD)

| Requisito | Status na versão MVP | Ação necessária se expandir |
|---|---|---|
| Coleta de dados pessoais | Não coleta | Adicionar consentimento explícito ao implementar cadastro |
| Direito ao esquecimento | N/A (sem PII) | Implementar `DELETE /users/:id` se houver cadastro |
| Cookies de rastreamento | Sem cookies de tracking | Adicionar banner de consentimento se usar analytics |

### Termos de Uso das APIs
- **ExchangeRate-API:** Free tier: somente uso não comercial.
- **NewsAPI:** Free tier apenas para desenvolvimento. Produção requer plano Business.
- **Binance WebSocket:** Uso gratuito conforme Binance API Terms of Service.
- **BCB/PTAX:** Dados públicos, uso livre.

---

## 5. Política de Backup e Retenção

| Dado | Frequência de Backup | Retenção |
|---|---|---|
| Banco de dados (histórico de cotações) | Diário (snapshot automático Supabase) | 30 dias |
| Logs de aplicação | Contínuo (streaming para Axiom/Logtail) | 14 dias |
| Cache Redis | Sem backup (dados efêmeros) | TTL configurado por chave |

---

## 6. Responsáveis

| Papel | Responsabilidade | Contato |
|---|---|---|
| **Data Owner** | Decisões sobre quais dados coletar e como usar | BrandusV (vambs0@gmail.com) |
| **Data Steward** | Implementação técnica da governança, rotação de chaves | Desenvolvedor responsável |

---

## 7. Histórico de Alterações

| Data | Versão | Alteração | Autor |
|---|---|---|---|
| 2026-04-26 | 1.0.0 | Criação inicial do documento | Agente (via Método Akita) |

---

> ⚠️ **Este documento deve ser atualizado ANTES de:**
> - Adicionar uma nova fonte de dados externa
> - Implementar funcionalidades de cadastro/login
> - Alterar a infraestrutura de deploy
>
> *Baseado no Método Akita — Etapa 1: Governança de Dados*
