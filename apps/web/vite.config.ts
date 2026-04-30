/**
 * Configuracao do Vite (dev server + build de producao do frontend).
 *
 * Mantida separada de `vitest.config.ts` para nao misturar dependencias
 * de teste (jsdom, setup files) com o pipeline de bundle do app.
 * Quando `packages/config` for criado (ARCHITECTURE.md secao 2), a base
 * comum migra para la.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Porta padrao do Vite. Backend Fastify roda em 3000 (apps/api/src/server.ts).
    port: 5173,
    // host:true expoe o servidor na LAN para testar layout em tablet/celular
    // (criterio de aceitacao do MVP - ROADMAP.md "Layout responsivo desktop e tablet").
    host: true,
  },
  preview: {
    port: 4173,
  },
});
