/**
 * Componente raiz - placeholder do bootstrap (PR feature/web-bootstrap).
 *
 * Sera substituido pelo layout real (sidebar + header + Dashboard) em
 * feature/web-components-pages, onde tambem plugaremos `useWebSocket`
 * e o componente StatusBar.
 *
 * Manter este stub aqui permite rodar `pnpm --filter web dev` ja agora
 * para validar que Tailwind/PostCSS/Vite estao corretamente configurados.
 */
export function App() {
  return (
    <main className="min-h-screen flex items-center justify-center text-slate-200">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wider">
          Dash<span className="text-blue-500">MF</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Bootstrap pronto. Aguardando componentes do dashboard.
        </p>
      </div>
    </main>
  );
}
