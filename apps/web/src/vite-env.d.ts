/// <reference types="vite/client" />

/**
 * Tipos das variaveis de ambiente expostas via `import.meta.env`.
 *
 * SECURITY.md: apenas variaveis com prefixo VITE_ entram no bundle do
 * frontend - tudo que for segredo (chaves de API externas, tokens) deve
 * permanecer no backend (apps/api).
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
