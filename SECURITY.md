# SECURITY.md
## Dashboard Interativo de Mercado Financeiro

> Política de segurança do projeto. Qualquer dúvida ou vulnerabilidade encontrada
> deve seguir o processo descrito neste documento.

---

## 1. Reporte de Vulnerabilidades

**NAO** abra uma issue pública para reportar vulnerabilidades de segurança.

Envie um e-mail para **vambs0@gmail.com** com:
- Descrição detalhada da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (opcional)

**SLA de resposta:**
- Confirmação de recebimento: em até 48 horas
- Avaliação inicial: em até 7 dias
- Correção e release: em até 30 dias

---

## 2. Gestão de Credenciais e Chaves de API

### Regras Absolutas (nunca violar)

1. **Nunca commitar arquivos `.env`** com valores reais.
2. **Nunca hardcodar** chaves, senhas ou tokens no código.
3. **Nunca logar** credenciais em arquivos de log ou console.
4. O `.env.example` deve conter apenas os **nomes** das variáveis (valores vazios).

### Estrutura de Variáveis de Ambiente

```env
# .env.example
EXCHANGE_RATE_API_KEY=
OPEN_EXCHANGE_RATES_APP_ID=
NEWS_API_KEY=
GNEWS_API_KEY=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
SENTRY_DSN=
```

### Onde as Credenciais São Armazenadas por Ambiente

| Ambiente | Onde armazenar credenciais |
|---|---|
| Desenvolvimento local | `.env` (não versionado) |
| CI/CD (GitHub Actions) | GitHub Secrets |
| Produção (Vercel / Railway) | Painel do provedor |

### Rotação de Chaves

- **Rotação programada:** a cada 90 dias.
- **Rotação de emergência:** imediatamente após suspeita de vazamento.

---

## 3. Segurança da API REST

### Rate Limiting (`@fastify/rate-limit`)

```
GET  /quotes    -> 100 req/min por IP
GET  /news      -> 60  req/min por IP
POST /alerts    -> 20  req/min por IP
GET  /health    -> Sem limite
```

### CORS (`@fastify/cors`)

```typescript
{
  origin: [
    "https://dashboard-mercado.vercel.app",
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "DELETE"],
  credentials: true,
  // NUNCA: origin: "*" em producao
}
```

### Headers de Segurança HTTP (`@fastify/helmet`)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; connect-src 'self' wss:
```

---

## 4. Segurança do WebSocket

- Somente conexões de origens autorizadas (validação do header `Origin`).
- Toda mensagem recebida é validada com Zod.
- Limite: 10 mensagens/s por conexão.
- Timeout de inatividade: 5 minutos.
- Somente `wss://` em produção.

---

## 5. Segurança do Banco de Dados

- Conexão com TLS (`?sslmode=require`).
- Acesso somente pelo backend (sem acesso direto pelo frontend).
- Usuário com permissões mínimas (SELECT/INSERT/UPDATE).
- Queries via Prisma ORM (previne SQL injection).
- Migrations versionadas.

---

## 6. Checklist de Segurança por Release

- [ ] `pnpm audit` sem vulnerabilidades críticas
- [ ] Nenhuma variável de ambiente no código
- [ ] CORS somente para domínios autorizados
- [ ] Rate limiting ativo
- [ ] Headers de segurança HTTP presentes
- [ ] TLS/HTTPS ativo
- [ ] WebSocket usando `wss://` em produção
- [ ] Logs sem dados sensíveis

---

## 7. Histórico de Alterações

| Data | Versão | Alteração |
|---|---|---|
| 2026-04-26 | 1.0.0 | Criação inicial |

---

*Baseado no Método Akita — Etapas 1 e 2: Governança e Arquitetura (Segurança)*
