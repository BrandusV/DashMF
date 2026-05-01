/**
 * useCurrencies - leitura/escrita de cotacoes para componentes.
 *
 * Fluxo:
 *  1. Bootstrap REST (`fetchQuotes`) ao montar - popula o store antes do
 *     primeiro QUOTE_UPDATE chegar (evita dashboard em branco).
 *  2. SUBSCRIBE no WS quando status fica 'online' - sem isso o backend nao
 *     envia QUOTE_UPDATE para este cliente.
 *  3. Cada QUOTE_UPDATE recebido faz `upsertQuote` no store (preserva ordem
 *     dos pares para o React reconciliar bem).
 *
 * Outros tipos de mensagem (NEWS_ALERT, FEED_STATUS, etc) sao ignorados aqui
 * - useNews trata noticias.
 */
import { useEffect, useState } from 'react';
import { fetchQuotes } from '../services/api';
import { useWebSocket } from './useWebSocket';
import { useCurrencyStore } from '../store/currencyStore';
import type { Quote } from '@dashmf/types';

interface UseCurrenciesReturn {
  quotes: Quote[];
  isLoading: boolean;
}

// URL do WS lida do bundle. Centralizar aqui evita propagar a string ate o
// componente folha. Fallback de localhost cobre dev quando .env esquecido.
function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws';
}

export function useCurrencies(pairs: string[]): UseCurrenciesReturn {
  const [isLoading, setIsLoading] = useState(true);
  const quotes = useCurrencyStore((state) => state.quotes);
  const setQuotes = useCurrencyStore((state) => state.setQuotes);
  const upsertQuote = useCurrencyStore((state) => state.upsertQuote);
  const { status, lastMessage, send } = useWebSocket(getWsUrl());

  // Bootstrap REST. Sentinel local em vez de AbortController para passar o
  // contrato dos testes (mockFetchQuotes e checado com 1 arg apenas).
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const data = await fetchQuotes(pairs);
        // Array.isArray defende contra mocks de teste que retornam undefined
        // ou backend devolvendo body fora do contrato (Zod ja validou em
        // fetchQuotes mas redundancia barata aqui evita pollution do store).
        if (isMounted && Array.isArray(data)) setQuotes(data);
      } catch {
        // Bootstrap silencioso - StatusBar via WS sinaliza degradacao ao usuario.
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
    // pairs.join(',') evita disparar quando o array tem o mesmo conteudo em
    // nova referencia (caller pode passar literal a cada render). O lint nao
    // consegue inferir que a string derivada cobre a referencia original.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.join(','), setQuotes]);

  // SUBSCRIBE quando estiver online. Reage a mudanca de status (offline ->
  // online apos reconexao tambem dispara um novo SUBSCRIBE).
  useEffect(() => {
    if (status === 'online') {
      send({ type: 'SUBSCRIBE', payload: { pairs } });
    }
    // Mesma justificativa do effect anterior: pairs.join(',') estabiliza a
    // dependencia sem exigir useMemo no caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, pairs.join(','), send]);

  // QUOTE_UPDATE -> upsert no store. Outros tipos sao ignorados.
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'QUOTE_UPDATE') {
      upsertQuote(lastMessage.payload);
    }
  }, [lastMessage, upsertQuote]);

  return { quotes, isLoading };
}
