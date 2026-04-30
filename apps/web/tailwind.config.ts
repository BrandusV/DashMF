/**
 * Tailwind CSS - configuracao do scanner e do tema.
 *
 * - `content`: arquivos varridos para gerar somente as classes usadas
 *   (mantem o CSS final pequeno).
 * - `darkMode: 'class'`: tema controlado pela classe `.dark` no <html>;
 *   alternancia futura via settingsStore.theme (feature backlog do ROADMAP).
 * - Cores semanticas extras: status do WebSocket e sentimento de noticia
 *   (consumidos por StatusBar, NewsFeed e CurrencyWidget no PR seguinte).
 */
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cores nomeadas que espelham as decisoes visuais do design original
        // (slate/emerald/rose/amber). Nomes semanticos facilitam mudar a paleta
        // num so lugar sem caçar todas as classes pelo codigo.
        sentiment: {
          positive: '#10b981',
          negative: '#f43f5e',
          neutral: '#94a3b8',
        },
        status: {
          online: '#10b981',
          connecting: '#f59e0b',
          offline: '#f43f5e',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
