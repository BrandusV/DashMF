/**
 * PostCSS - pipeline de plugins aplicado a todo CSS importado pelo Vite.
 *
 * - tailwindcss: expande @tailwind nas camadas base/components/utilities
 *   conforme as classes detectadas em `tailwind.config.ts`.
 * - autoprefixer: insere prefixos de vendor (-webkit-, -moz-) para
 *   compatibilidade com browsers alvo.
 *
 * Vite localiza este arquivo automaticamente (postcss.config.{js,cjs}).
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
