# Runbook — Deploy do MVP no Vercel + Railway

> **Escopo:** fechar o último critério de aceitação da Fase 0 do
> [ROADMAP.md](../../ROADMAP.md): *"Deploy em produção funcional (Vercel + Railway)"*.
>
> **Pré-requisitos:** working tree limpo em `develop`, CI verde no último push,
> contas criadas em GitHub, Sentry, Vercel e Railway.
>
> **Tempo estimado:** 30–45 min na primeira execução.

---

## 0. Por que este runbook existe

O Método Akita exige que cada fase tenha o ciclo completo
**Governança → Arquitetura → TDD → Execução → Monitoramento** antes de avançar.
As configs de deploy (`vercel.json`, `railway.json`, `nixpacks.toml`) cobrem a
arquitetura. Este documento cobre a **execução** — os passos manuais que não
moram em código.

Mantenha este runbook atualizado: cada vez que algo der errado em produção e
exigir um passo extra, registre aqui. Runbook desatualizado é pior que nenhum.

---

## 1. Publicar `develop` no GitHub

Os commits da Fase 0 estão na sua máquina. Vercel e Railway só conseguem clonar
o que está no `origin`.

```powershell
git push -u origin develop
```

**Por que `-u`:** cria o tracking entre `develop` local e `origin/develop`.
Próximos `git push` sem argumentos saberão para onde ir.

**Por que `develop` e não `main`:** pelo `CONTRIBUTING.md` (Akita), `main`
recebe só releases. `develop` é o tronco de integração. Trocaremos o branch
de produção para `main` via PR ao subir V1.

---

## 2. Criar projetos no Sentry (antes do deploy)

Você precisa de **dois projetos distintos**: um Node (api) e um React (web).
DSN diferente para cada. Sem isso, o deploy roda mas erros caem no vazio.

1. Acesse [sentry.io](https://sentry.io) — conta gratuita serve.
2. **Create Project** → plataforma `Node.js` → nome `dashmf-api` → copie o **DSN**
   (formato `https://xxx@yyy.ingest.sentry.io/zzz`).
3. **Create Project** → plataforma `React` → nome `dashmf-web` → copie o **DSN**.

Guarde os dois DSNs — vão entrar nas variáveis de ambiente abaixo.

> **DSN do Sentry é público por design** (só envia eventos, não lê dados).
> Pode entrar no bundle do frontend sem risco — diferente de chaves de API,
> que ficam só no backend.

---

## 3. Backend no Railway (`apps/api`)

Railway é onde o **Fastify + WebSocket** vai rodar. Ele lê
[railway.json](../../railway.json) e [nixpacks.toml](../../nixpacks.toml)
automaticamente da raiz do repo.

### 3.1 Criar projeto

1. Acesse [railway.com](https://railway.com) → login com GitHub.
2. **New Project** → **Deploy from GitHub repo** → autorize o repositório `DashMF`.
3. Selecione o repo. Railway detecta o `nixpacks.toml` e inicia um build.

### 3.2 Configurar o painel

Antes do primeiro deploy completar, vá em **Settings** do serviço:

| Campo | Valor | Por quê |
|---|---|---|
| **Root Directory** | `/` (vazio) | `pnpm install` precisa rodar da raiz para resolver os workspaces `@dashmf/types` e `@dashmf/utils`. Apontar para `apps/api` quebraria o `workspace:*`. |
| **Branch** | `develop` | Tronco da Fase 0. Trocaremos para `main` ao subir V1. |
| **Watch Paths** | (vazio) | Deixe Railway redeployar a cada push. Filtros viriam só se o monorepo crescer. |
| **Healthcheck Path** | `/health` (já vem do `railway.json`) | Railway só promove o deploy se essa rota responder 200. |

### 3.3 Variáveis de ambiente (aba **Variables**)

Adicione uma a uma. Os nomes saem de
[apps/api/.env.example](../../apps/api/.env.example):

```
NODE_ENV=production
FRONTEND_URL=<deixe pendente — preenchemos depois do passo 4>
SENTRY_DSN=<DSN do projeto dashmf-api>
EXCHANGE_RATE_API_KEY=<sua chave>
OPEN_EXCHANGE_RATES_APP_ID=<seu app_id>
NEWS_API_KEY=<sua chave>
GNEWS_API_KEY=<opcional>
```

**Não defina `PORT`** — Railway injeta sozinho, e
[apps/api/src/index.ts](../../apps/api/src/index.ts) já lê de `process.env.PORT`.

`DATABASE_URL` e `REDIS_URL` ficam em branco no MVP — `CacheService` cai
pro stub interno.

### 3.4 Gerar domínio público

**Settings → Networking → Generate Domain.** Vai aparecer algo como
`dashmf-api-production.up.railway.app`.

**Anote esse domínio** — ele alimenta as variáveis do Vercel no próximo passo.

### 3.5 Validar antes de seguir

```powershell
curl https://<seu-dominio>.up.railway.app/health
```

Tem que devolver `{"status":"ok"}`. Se devolver erro, abra
**Deployments → Logs** no Railway e investigue antes de seguir para o Vercel —
deploy do frontend depende do backend funcionando.

---

## 4. Frontend no Vercel (`apps/web`)

Vercel serve o **React buildado pelo Vite** como estático.

### 4.1 Criar projeto

1. Acesse [vercel.com](https://vercel.com) → login com GitHub.
2. **Add New → Project** → import o repo `DashMF`.
3. Tela de configuração:
   - **Framework Preset:** `Other` (o `vercel.json` cuida — `framework: null`).
   - **Root Directory:** `/` (vazio). Mesmo motivo do Railway: workspaces
     precisam da raiz.
4. Build/output já estão fixados em [vercel.json](../../vercel.json):
   - `installCommand`: `pnpm install --frozen-lockfile`
   - `buildCommand`: `pnpm --filter web build`
   - `outputDirectory`: `apps/web/dist`
5. **Production Branch:** `develop` (Settings → Git, depois do create).

### 4.2 Variáveis de ambiente (Settings → Environment Variables)

```
VITE_API_URL=https://<dominio-railway>.up.railway.app
VITE_WS_URL=wss://<dominio-railway>.up.railway.app/ws
VITE_SENTRY_DSN=<DSN do projeto dashmf-web>
```

Marque **Production, Preview, Development** nas três.

> **Por que `wss://` e não `ws://`:** Railway termina TLS na borda. Tentar `ws://`
> em domínio HTTPS faz o navegador bloquear como *mixed content*.
>
> **Por que prefixo `VITE_`:** Vite só expõe ao bundle do navegador variáveis com
> esse prefixo. Sem ele, `import.meta.env.X` retorna `undefined` em produção.

### 4.3 Disparar deploy

**Deployments → Redeploy** (ou faça um push qualquer para disparar). Anote o
domínio gerado, tipo `dashmf.vercel.app`.

---

## 5. Fechar o ciclo CORS

Volte ao **Railway → Variables** e atualize:

```
FRONTEND_URL=https://dashmf.vercel.app
```

Salve. Railway redeploya sozinho.

> **Por que isso importa:** sem essa env batendo com o domínio real do Vercel,
> o Fastify rejeita as requisições com erro de CORS e o `StatusBar` fica preso
> em "Reconectando". O `apps/api/src/server.ts` lê `FRONTEND_URL` para
> configurar o `@fastify/cors`.

---

## 6. Validar deploy ao vivo

Abra o domínio do Vercel no navegador e confira:

| Sinal | Onde olhar | O que esperar |
|---|---|---|
| WS conectado | `StatusBar` no header | Bolinha verde "Online" |
| Cotações chegando | Grid de `CurrencyWidget` | Valores aparecem em até 30s (intervalo do poller) |
| Notícias chegando | `NewsFeed` no fim da página | Itens aparecem em até 5min (intervalo do poller) |
| Sentry funcionando | Dashboards em `sentry.io` | Sem erros em produção; teste forçando `throw new Error('test')` no DevTools |
| Healthcheck Railway | aba **Deployments** | Status `Active`, healthcheck verde |

---

## 7. Onde olhar quando algo quebrar

Akita exige saber para onde olhar **antes** do incidente, não durante.

| Sintoma | Onde olhar |
|---|---|
| Build falhou no Railway | Railway → Deployments → step **Build** |
| Build falhou no Vercel | Vercel → Deployments → **Build Logs** |
| WS não conecta no browser | DevTools → Network → filtro **WS** → status do handshake |
| Backend dá 500 em produção | Railway → Deployments → **Runtime Logs** + Sentry `dashmf-api` |
| Frontend quebra em produção | Vercel → **Functions/Logs** + Sentry `dashmf-web` |
| Cotações não atualizam | Railway logs do `currencyPoller` (procure `[poller:currency]`) |
| Notícias não atualizam | Railway logs do `newsPoller` (procure `[poller:news]`) |

---

## 8. Pós-deploy — janela de observação

Antes de marcar a Fase 0 como fechada e abrir V1, o `ROADMAP.md` exige
**>= 1 semana de produção estável**. Durante essa janela:

- Cheque Sentry diariamente — qualquer erro recorrente vira issue antes do V1.
- Confirme que healthcheck do Railway permaneceu verde 24×7.
- Anote qualquer manobra manual que tiver que fazer — vai pra esta runbook.

---

*Runbook vivo. Toda vez que um deploy exigir um passo não documentado aqui,
abra um PR atualizando este arquivo.*
