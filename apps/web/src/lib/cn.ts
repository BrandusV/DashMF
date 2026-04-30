/**
 * cn() - compoe classes Tailwind sem conflitos.
 *
 * `clsx` aceita strings, arrays e objetos condicionais (`{ active: true }`);
 * `twMerge` resolve sobreposicoes de classes Tailwind do tipo `px-2 px-4` ->
 * mantem apenas a ultima (px-4). Util quando um componente recebe `className`
 * por prop e precisa permitir override sem quebrar layout.
 *
 * Padrao herdado do shadcn/ui (citado em ARCHITECTURE.md secao 5).
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
