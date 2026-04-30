/**
 * Bootstrap do React no DOM.
 *
 * Monta o componente App raiz dentro de #root (declarado em index.html).
 * StrictMode esta ativo para detectar efeitos colaterais inesperados em dev
 * (alinhado a CLAUDE.md - TypeScript estrito + qualidade defensiva).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

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
