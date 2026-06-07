import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { humanizeError, isOnline, waitForOnline } from "@/lib/errorHandling";

/**
 * Hook para updates otimistas com rollback automático.
 * Aplica mudança imediatamente no UI, sincroniza em background.
 * Se falhar, reverte para estado anterior.
 * 
 * BLINDAGEM: Cache local + Sync inteligente
 */

interface OptimisticUpdateOptions<T> {
  /** Estado inicial */
  initialData: T;
  /** Chave para cache local (opcional) */
  cacheKey?: string;
  /** Callback quando sync falhar */
  onSyncError?: (error: Error) => void;
}

interface OptimisticUpdateResult<T> {
  /** Estado atual (otimista) */
  data: T;
  /** Se há updates pendentes de sync */
  isPending: boolean;
  /** Se está sincronizando */
  isSyncing: boolean;
  /** Aplicar update otimista + sincronizar */
  update: (
    newData: T | ((prev: T) => T),
    syncAction: () => Promise<void>
  ) => Promise<boolean>;
  /** Forçar sync de pendentes */
  forceSync: () => Promise<void>;
  /** Limpar estado */
  reset: (newData: T) => void;
}

interface PendingUpdate<T> {
  id: string;
  previousData: T;
  newData: T;
  syncAction: () => Promise<void>;
  timestamp: number;
}

export function useOptimisticUpdate<T>({
  initialData,
  cacheKey,
  onSyncError,
}: OptimisticUpdateOptions<T>): OptimisticUpdateResult<T> {
  const [data, setData] = useState<T>(initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const pendingUpdatesRef = useRef<PendingUpdate<T>[]>([]);
  const syncingRef = useRef(false);

  const isPending = pendingUpdatesRef.current.length > 0;

  // Salvar no cache local
  const saveToCache = useCallback((newData: T) => {
    if (!cacheKey) return;
    
    try {
      localStorage.setItem(
        `mechanic_cache_${cacheKey}`,
        JSON.stringify({
          data: newData,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error("[OptimisticUpdate] Erro ao salvar cache:", error);
    }
  }, [cacheKey]);

  // Restaurar do cache local
  const restoreFromCache = useCallback((): T | null => {
    if (!cacheKey) return null;
    
    try {
      const cached = localStorage.getItem(`mechanic_cache_${cacheKey}`);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const hoursSinceSave = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        if (hoursSinceSave < 24) {
          return cachedData;
        }
      }
    } catch (error) {
      console.error("[OptimisticUpdate] Erro ao restaurar cache:", error);
    }
    return null;
  }, [cacheKey]);

  const syncPendingUpdates = useCallback(async () => {
    if (syncingRef.current || pendingUpdatesRef.current.length === 0) return;
    
    syncingRef.current = true;
    setIsSyncing(true);

    // Esperar conexão se offline
    if (!isOnline()) {
      toast.info("Sem conexão", {
        description: "Suas alterações serão sincronizadas quando a conexão voltar",
      });
      await waitForOnline();
    }

    const updates = [...pendingUpdatesRef.current];
    const failedUpdates: PendingUpdate<T>[] = [];

    for (const update of updates) {
      try {
        await update.syncAction();
        // Remover da lista de pendentes
        pendingUpdatesRef.current = pendingUpdatesRef.current.filter(
          (u) => u.id !== update.id
        );
      } catch (error) {
        const errorInfo = humanizeError(error);
        
        if (errorInfo.recoverable) {
          failedUpdates.push(update);
        } else {
          // Rollback para updates não recuperáveis
          setData(update.previousData);
          pendingUpdatesRef.current = pendingUpdatesRef.current.filter(
            (u) => u.id !== update.id
          );
          
          toast.error(errorInfo.message, {
            description: "A alteração foi revertida",
          });
          
          if (onSyncError) {
            onSyncError(error instanceof Error ? error : new Error(String(error)));
          }
        }
      }
    }

    // Manter apenas falhas recuperáveis para retry
    pendingUpdatesRef.current = failedUpdates;
    
    syncingRef.current = false;
    setIsSyncing(false);

    if (failedUpdates.length > 0) {
      // Retry após 5 segundos
      setTimeout(syncPendingUpdates, 5000);
    }
  }, [onSyncError]);

  const update = useCallback(
    async (
      newDataOrFn: T | ((prev: T) => T),
      syncAction: () => Promise<void>
    ): Promise<boolean> => {
      const previousData = data;
      const newData =
        typeof newDataOrFn === "function"
          ? (newDataOrFn as (prev: T) => T)(previousData)
          : newDataOrFn;

      // Aplicar update otimista imediatamente
      setData(newData);
      saveToCache(newData);

      // Adicionar à fila de pendentes
      const pendingUpdate: PendingUpdate<T> = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        previousData,
        newData,
        syncAction,
        timestamp: Date.now(),
      };
      pendingUpdatesRef.current.push(pendingUpdate);

      // Tentar sincronizar
      try {
        await syncAction();
        // Remover da lista de pendentes
        pendingUpdatesRef.current = pendingUpdatesRef.current.filter(
          (u) => u.id !== pendingUpdate.id
        );
        return true;
      } catch (error) {
        // Manter na lista de pendentes para retry
        console.log("[OptimisticUpdate] Sync falhou, será tentado novamente:", error);
        
        // Iniciar retry em background
        setTimeout(syncPendingUpdates, 2000);
        return false;
      }
    },
    [data, saveToCache, syncPendingUpdates]
  );

  const forceSync = useCallback(async () => {
    await syncPendingUpdates();
  }, [syncPendingUpdates]);

  const reset = useCallback((newData: T) => {
    setData(newData);
    pendingUpdatesRef.current = [];
    if (cacheKey) {
      localStorage.removeItem(`mechanic_cache_${cacheKey}`);
    }
  }, [cacheKey]);

  return {
    data,
    isPending,
    isSyncing,
    update,
    forceSync,
    reset,
  };
}
