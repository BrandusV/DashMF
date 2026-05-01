/**
 * StatusBar - indicador visual da conexao WebSocket.
 *
 * Feature P1 do MVP (ROADMAP.md): "usuario sempre sabe se a tela esta
 * atualizada ou nao". Convencao visual classica: verde=ok, amarelo=em
 * andamento, vermelho=falha.
 *
 * a11y: role=status para que leitores de tela anunciem mudancas (CONTRIBUTING.md
 * referencia WCAG 2.1 AA no backlog de melhorias continuas).
 */
import { cn } from '../../lib/cn';

export type ConnectionStatus = 'online' | 'connecting' | 'offline';

interface StatusBarProps {
  status: ConnectionStatus;
  lastUpdate?: number;
}

const LABELS: Record<ConnectionStatus, string> = {
  online: 'Online',
  connecting: 'Reconectando',
  offline: 'Offline',
};

// Tailwind precisa das classes literais no codigo (nao gera dinamicas via JIT).
const DOT_CLASSES: Record<ConnectionStatus, string> = {
  online: 'bg-green-500',
  connecting: 'bg-yellow-500',
  offline: 'bg-red-500',
};

function formatElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'agora';
  return `${minutes} min`;
}

export function StatusBar({ status, lastUpdate }: StatusBarProps): JSX.Element {
  const elapsed = lastUpdate !== undefined ? formatElapsed(Date.now() - lastUpdate) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm text-slate-300"
    >
      <span
        data-testid="status-dot"
        className={cn('inline-block h-2 w-2 rounded-full', DOT_CLASSES[status])}
        aria-hidden="true"
      />
      <span>{LABELS[status]}</span>
      {elapsed && <span className="text-slate-400">· {elapsed}</span>}
    </div>
  );
}
