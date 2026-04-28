# CONTRIBUTING.md
## Guia de Contribuição — Dashboard Interativo de Mercado Financeiro

> **Etapa 3 do Método Akita** — TDD: testes primeiro, depois o código de produção.

---

## 1. Filosofia de Desenvolvimento

> "Código sem governança é caos. Código sem arquitetura é acidente.
> Código sem testes é aposta. O Método Akita é sobre transformar apostas em certezas."

Antes de escrever qualquer código:
1. Verifique se a funcionalidade está alinhada com o ROADMAP.md.
2. Verifique se não viola as regras de DATA_GOVERNANCE.md.
3. Verifique se é consistente com ARCHITECTURE.md.
4. Escreva o teste antes do código (TDD).

---

## 2. Fluxo de Desenvolvimento

```
1. Crie uma branch  ->  2. Escreva o teste  ->  3. Escreva o código  ->  4. Refatore  ->  5. PR
   (feature/nome)        (RED -- falha)           (GREEN -- passa)        (REFACTOR)
```

```bash
git checkout develop && git pull origin develop
git checkout -b feature/currency-widget

# TDD: escreva o teste ANTES da implementação

pnpm test && pnpm lint && pnpm typecheck
git commit -m "feat(web): add CurrencyWidget with real-time price display"
# Abra PR para develop
```

---

## 3. Ciclo TDD (Obrigatorio)

### RED — Escreva o teste que falha

```typescript
// apps/api/src/services/__tests__/CurrencyService.test.ts
// ESCREVA ESTE ARQUIVO ANTES DE CRIAR CurrencyService.ts

import { describe, it, expect, vi } from 'vitest';
import { CurrencyService } from '../CurrencyService';

describe('CurrencyService', () => {
  it('deve retornar cotacao do par USD/BRL', async () => {
    const service = new CurrencyService();
    const quote = await service.getQuote('USD', 'BRL');
    expect(quote.pair).toBe('USD/BRL');
    expect(quote.bid).toBeGreaterThan(0);
  });

  it('deve usar cache quando disponivel', async () => {
    const mockAdapter = { fetchQuote: vi.fn().mockResolvedValue({ bid: 5.12, ask: 5.15 }) };
    const service = new CurrencyService(mockAdapter);
    await service.getQuote('USD', 'BRL');
    await service.getQuote('USD', 'BRL');
    expect(mockAdapter.fetchQuote).toHaveBeenCalledTimes(1);
  });
});
```

### GREEN — Escreva o mínimo para passar

```typescript
export class CurrencyService {
  constructor(private adapter = new ExchangeRateAdapter()) {}
  async getQuote(base: string, quote: string): Promise<Quote> {
    const pair = `${base}/${quote}`;
    // implementacao minima para os testes passarem
  }
}
```

### REFACTOR — Melhore sem quebrar

Após todos os testes passando, melhore nomes, extraia funções, remova duplicações.

---

## 4. Conventional Commits

**Formato:** `<tipo>(<escopo>): <descrição>`

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correcao de bug |
| `docs` | Apenas documentacao |
| `refactor` | Refatoracao sem nova feature |
| `test` | Adicao ou correcao de testes |
| `chore` | Manutencao: deps, configs |
| `ci` | Alteracoes em CI/CD |

**Escopos:** `web`, `api`, `types`, `utils`, `ws`, `docs`

**Exemplos validos:**
```
feat(web): add CurrencyWidget with live price updates
feat(api): implement WebSocket broadcaster for quote updates
fix(ws): handle reconnection when server drops connection
test(api): add unit tests for CurrencyService cache logic
chore(deps): update Fastify to v4.28.0
```

---

## 5. Convencoes de Branches

```
main          -> Producao. Protegida. Merge somente via PR aprovada.
develop       -> Branch de integracao.
feature/nome  -> Nova funcionalidade
fix/nome      -> Correcao de bug
docs/nome     -> Atualizacao de documentacao
chore/nome    -> Manutencao
```

---

## 6. Checklist de Pull Request

**Código**
- [ ] Funcionalidade esta no ROADMAP.md
- [ ] Segue as convencoes de ARCHITECTURE.md
- [ ] Sem `any` implicito no TypeScript
- [ ] Sem credenciais no codigo

**Testes (TDD)**
- [ ] Testes escritos ANTES do codigo de producao
- [ ] `pnpm test` passa sem falhas
- [ ] Cobertura >= 80% nos services

**Qualidade**
- [ ] `pnpm lint` sem erros
- [ ] `pnpm typecheck` sem erros

**Documentacao**
- [ ] Se nova fonte de dados -> DATA_GOVERNANCE.md atualizado
- [ ] Se novo modulo -> ARCHITECTURE.md atualizado
- [ ] Se nova feature -> ROADMAP.md status atualizado

---

## 7. Padroes de Codigo

### TypeScript
```typescript
// Tipos explicitos para funcoes publicas
function formatCurrency(value: number, currency: string): string { ... }

// Interfaces para objetos de dominio
interface Quote {
  pair: string;
  bid: number;
  ask: number;
  mid: number;
  changePct: number;
  timestamp: number;
}
```

### Validacao com Zod
```typescript
const quoteSchema = z.object({
  pair: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/),
  bid: z.number().positive(),
  ask: z.number().positive(),
  timestamp: z.number().int().positive()
});
type Quote = z.infer<typeof quoteSchema>;
```

---

## 8. Ferramentas de Teste

| Ferramenta | Uso |
|---|---|
| **Vitest** | Testes unitarios e de integracao |
| **Playwright** | Testes E2E |
| **Testing Library** | Testes de componentes React |

```bash
pnpm test             # todos os testes
pnpm test:watch       # modo watch
pnpm test:coverage    # com cobertura
pnpm test:e2e         # somente E2E
```

---

## 9. Setup do Ambiente de Desenvolvimento

```bash
npm install -g pnpm       # 1. Instalar pnpm
pnpm install              # 2. Instalar dependencias
cp .env.example .env      # 3. Configurar variaveis de ambiente
docker-compose up -d      # 4. Subir infraestrutura (Docker)
pnpm --filter api prisma migrate dev  # 5. Executar migrations
pnpm dev                  # 6. Iniciar em modo desenvolvimento
pnpm test && pnpm lint && pnpm typecheck  # 7. Verificar
```

---

*Baseado no Método Akita — Etapa 3: Implementacao com TDD*
