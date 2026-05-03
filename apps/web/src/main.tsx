/**
 * Bootstrap do React no DOM.
 *
 * Monta o componente App raiz dentro de #root (declarado em index.html).
 * StrictMode esta ativo para detectar efeitos colaterais inesperados em dev
 * (alinhado a CLAUDE.md - TypeScript estrito + qualidade defensiva).
 *
 * Sentry eh inicializado ANTES do createRoot para que qualquer erro durante
 * o bootstrap (incluindo o primeiro render) ja seja capturado pelos handlers
 * globais (ROADMAP.md MVP P2 - "Sentry basico").
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initSentry } from './lib/sentry';
import './index.css';

initSentry();

const container = document.getElementById('root');
if (!container) {
  // Falha rapida em vez de continuar com root inexistente.
  throw new Error('main.tsx: elemento #root nao encontrado em index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
