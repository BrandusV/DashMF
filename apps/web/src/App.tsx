/**
 * App - shell raiz da aplicacao.
 *
 * Hoje apenas monta a pagina Dashboard. Quando V2 (autenticacao + multi-rota)
 * entrar no roadmap, este componente vira o Router/AuthProvider; a Dashboard
 * passa a ser uma rota entre outras (ex: /alerts, /settings).
 *
 * Mantemos o shell separado da Dashboard para que o teste de composicao da
 * pagina nao precise mockar Router/Provider.
 */
import { Dashboard } from './pages/Dashboard';

export function App(): JSX.Element {
  return <Dashboard />;
}
