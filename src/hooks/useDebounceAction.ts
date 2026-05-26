import { useRef, useCallback, useState } from "react";

/**
 * Hook para proteção contra duplo clique/toque em ações críticas.
 * Implementa debounce + idempotência para garantir que a ação
 * só seja executada uma vez, mesmo com múltiplos toques rápidos.
 * 
 * BLINDAGEM: Tolerância a requisições duplicadas
 */
export function useDebounceAction<T extends (...args: any[]) => Promise<any>>(
  action: T,
  delay: number = 500
) {
  const [isPending, setIsPending] = useState(false);
  const lastCallRef = useRef<number>(0);
  const pendingRef = useRef<boolean>(false);
  const executionIdRef = useRef<string>("");

  const debouncedAction = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      const now = Date.now();
      const executionId = `${now}-${Math.random().toString(36).substr(2, 9)}`;

      // Bloquear se já há uma execução pendente
      if (pendingRef.current) {
        console.log("[DebounceAction] Execução bloqueada - ação já em andamento");
        return undefined;
      }

      // Bloquear se chamada muito rápida (debounce)
      if (now - lastCallRef.current < delay) {
        console.log("[DebounceAction] Execução bloqueada - debounce ativo");
        return undefined;
      }

      lastCallRef.current = now;
      pendingRef.current = true;
      executionIdRef.current = executionId;
      setIsPending(true);

      try {
        const result = await action(...args);
        
        // Verificar se ainda é a mesma execução (idempotência)
        if (executionIdRef.current === executionId) {
          return result as ReturnType<T>;
        }
        return undefined;
      } finally {
        // Só liberar se for a mesma execução
        if (executionIdRef.current === executionId) {
          pendingRef.current = false;
          setIsPending(false);
        }
      }
    },
    [action, delay]
  );

  const reset = useCallback(() => {
    pendingRef.current = false;
    setIsPending(false);
  }, []);

  return {
    execute: debouncedAction,
    isPending,
    reset,
  };
}

/**
 * Hook simplificado para debounce de funções síncronas (ex: filtros, busca)
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const updateValue = useCallback(
    (newValue: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(newValue);
      }, delay);
    },
    [delay]
  );

  // Atualizar quando value mudar
  if (value !== debouncedValue) {
    updateValue(value);
  }

  return debouncedValue;
}
