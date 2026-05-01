/**
 * useNews - leitura/escrita de noticias para componentes.
 *
 * Fluxo:
 *  1. Bootstrap REST (`fetchNews`) ao montar - sem isso a feed iniciaria em
 *     branco e o usuario teria que esperar o primeiro NEWS_ALERT.
 *  2. Cada NEWS_ALERT recebido faz `prepend` no store (mais recente no topo).
 *
 * Outras mensagens (QUOTE_UPDATE, etc) sao ignoradas aqui - useCurrencies
 * trata cotacoes.
 */
import { useEffect, useState } from 'react';
import { fetchNews } from '../services/api';
import { useWebSocket } from './useWebSocket';
import { useNewsStore } from '../store/newsStore';
import type { NewsItem } from '@dashmf/types';

interface UseNewsReturn {
  items: NewsItem[];
  isLoading: boolean;
}

function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws';
}

export function useNews(): UseNewsReturn {
  const [isLoading, setIsLoading] = useState(true);
  const items = useNewsStore((state) => state.items);
  const setItems = useNewsStore((state) => state.setItems);
  const prepend = useNewsStore((state) => state.prepend);
  const { lastMessage } = useWebSocket(getWsUrl());

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const data = await fetchNews();
        // Array.isArray defende contra mocks/backend bugado (mesma logica do
        // useCurrencies - evita pollution do store).
        if (isMounted && Array.isArray(data)) setItems(data);
      } catch {
        // Bootstrap silencioso - feed eventualmente popula via NEWS_ALERT WS.
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [setItems]);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'NEWS_ALERT') {
      prepend(lastMessage.payload);
    }
  }, [lastMessage, prepend]);

  return { items, isLoading };
}
