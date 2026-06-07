import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isOnline, waitForOnline, logBusinessEvent } from "@/lib/errorHandling";

/**
 * FILA DE AÇÕES OFFLINE - Retry Inteligente
 * 
 * Sistema que:
 * 1. Registra ações críticas localmente antes de enviar
 * 2. Detecta falhas de rede e reexecuta automaticamente
 * 3. Usa idempotência server-side para evitar duplicação
 * 4. Funciona mesmo com internet instável
 * 
 * BLINDAGEM: Sistema funcional mesmo offline
 */

interface QueuedAction {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  oficina_id: string;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastAttempt?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

interface UseOfflineQueueOptions {
  maxRetries?: number;
  retryDelay?: number;
  onSuccess?: (action: QueuedAction, result: unknown) => void;
  onError?: (action: QueuedAction, error: Error) => void;
}

const QUEUE_STORAGE_KEY = "mechanic_offline_queue";
const MAX_QUEUE_SIZE = 50;

/**
 * Gera uma chave de idempotência única
 */
function generateIdempotencyKey(action: string, payload: Record<string, unknown>): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  const payloadHash = JSON.stringify(payload).substring(0, 50);
  return `${action}-${timestamp}-${random}-${btoa(payloadHash).substring(0, 10)}`;
}

/**
 * Carrega a fila do localStorage
 */
function loadQueue(): QueuedAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) return [];
    
    const queue: QueuedAction[] = JSON.parse(stored);
    
    // Filtrar ações expiradas (mais de 24h)
    const now = Date.now();
    const validQueue = queue.filter((action) => {
      const age = now - new Date(action.createdAt).getTime();
      return age < 24 * 60 * 60 * 1000; // 24 horas
    });
    
    return validQueue;
  } catch {
    return [];
  }
}

/**
 * Salva a fila no localStorage
 */
function saveQueue(queue: QueuedAction[]): void {
  try {
    // Limitar tamanho da fila
    const trimmedQueue = queue.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(trimmedQueue));
  } catch (error) {
    console.error("[OfflineQueue] Erro ao salvar fila:", error);
  }
}

export function useOfflineQueue(options: UseOfflineQueueOptions = {}) {
  const { maxRetries = 5, retryDelay = 2000, onSuccess, onError } = options;
  
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const processingRef = useRef(false);

  // Carregar fila ao inicializar
  useEffect(() => {
    setQueue(loadQueue());
  }, []);

  // Monitorar estado de conexão
  useEffect(() => {
    const handleOnline = () => {
      setIsOnlineState(true);
      console.log("[OfflineQueue] Conexão restaurada - processando fila");
      processQueue();
    };

    const handleOffline = () => {
      setIsOnlineState(false);
      console.log("[OfflineQueue] Sem conexão - ações serão enfileiradas");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Processar fila pendente quando ficar online
  useEffect(() => {
    if (isOnlineState && queue.some((a) => a.status === "pending")) {
      processQueue();
    }
  }, [isOnlineState, queue]);

  /**
   * Adiciona uma ação à fila
   */
  const enqueue = useCallback(
    async (
      action: string,
      payload: Record<string, unknown>,
      oficina_id: string
    ): Promise<{ queued: boolean; immediate: boolean; result?: unknown }> => {
      const idempotencyKey = generateIdempotencyKey(action, payload);
      
      const queuedAction: QueuedAction = {
        id: crypto.randomUUID(),
        action,
        payload,
        oficina_id,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: "pending",
      };

      // Adicionar à fila local primeiro (garante persistência)
      setQueue((prev) => {
        const updated = [...prev, queuedAction];
        saveQueue(updated);
        return updated;
      });

      logBusinessEvent("action_queued", { action, oficina_id, idempotencyKey });

      // Se online, tentar executar imediatamente
      if (isOnline()) {
        try {
          const result = await executeAction(queuedAction);
          
          // Marcar como completada
          setQueue((prev) => {
            const updated = prev.map((a) =>
              a.id === queuedAction.id ? { ...a, status: "completed" as const } : a
            );
            saveQueue(updated);
            return updated;
          });

          if (onSuccess) {
            onSuccess(queuedAction, result);
          }

          return { queued: true, immediate: true, result };
        } catch (error) {
          console.log("[OfflineQueue] Falha imediata, mantendo na fila para retry");
          return { queued: true, immediate: false };
        }
      }

      // Offline - ação ficará na fila
      toast.info("Você está offline", {
        description: "A ação será executada quando a conexão voltar",
      });

      return { queued: true, immediate: false };
    },
    [onSuccess]
  );

  /**
   * Executa uma ação via edge function de idempotência
   */
  /**
   * Executa uma ação via edge function de idempotência
   * Header x-system-action indica ação de retry automático (não conta rate limit)
   */
  const executeAction = async (action: QueuedAction): Promise<unknown> => {
    const isRetry = action.attempts > 0;
    
    const response = await supabase.functions.invoke("idempotency-guard", {
      body: {
        action: action.action,
        payload: action.payload,
        oficina_id: action.oficina_id,
      },
      headers: {
        "Idempotency-Key": action.idempotencyKey,
        // Marcar retries como ação de sistema para bypass de rate limit
        ...(isRetry && { "x-system-action": "true" }),
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.data;
  };

  /**
   * Processa todas as ações pendentes na fila
   */
  const processQueue = useCallback(async () => {
    if (processingRef.current || !isOnline()) return;
    
    processingRef.current = true;
    setIsProcessing(true);

    const pendingActions = queue.filter((a) => a.status === "pending");
    
    for (const action of pendingActions) {
      try {
        // Atualizar status para processando
        setQueue((prev) => {
          const updated = prev.map((a) =>
            a.id === action.id
              ? { ...a, status: "processing" as const, attempts: a.attempts + 1, lastAttempt: new Date().toISOString() }
              : a
          );
          saveQueue(updated);
          return updated;
        });

        const result = await executeAction(action);

        // Marcar como completada
        setQueue((prev) => {
          const updated = prev.map((a) =>
            a.id === action.id ? { ...a, status: "completed" as const } : a
          );
          saveQueue(updated);
          return updated;
        });

        logBusinessEvent("action_completed", { 
          action: action.action, 
          idempotencyKey: action.idempotencyKey 
        });

        if (onSuccess) {
          onSuccess(action, result);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        
        setQueue((prev) => {
          const updated = prev.map((a) => {
            if (a.id !== action.id) return a;
            
            // Se excedeu tentativas, marcar como falha
            if (a.attempts >= maxRetries) {
              return { ...a, status: "failed" as const, error: errorMessage };
            }
            
            // Voltar para pendente para retry
            return { ...a, status: "pending" as const, error: errorMessage };
          });
          saveQueue(updated);
          return updated;
        });

        if (action.attempts >= maxRetries) {
          logBusinessEvent("action_failed", { 
            action: action.action, 
            idempotencyKey: action.idempotencyKey,
            error: errorMessage 
          });

          if (onError) {
            onError(action, new Error(errorMessage));
          }
        } else {
          // Esperar antes do próximo retry
          await new Promise((resolve) => setTimeout(resolve, retryDelay * action.attempts));
        }
      }
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [queue, maxRetries, retryDelay, onSuccess, onError]);

  /**
   * Remove ações completadas da fila
   */
  const clearCompleted = useCallback(() => {
    setQueue((prev) => {
      const updated = prev.filter((a) => a.status !== "completed");
      saveQueue(updated);
      return updated;
    });
  }, []);

  /**
   * Força retry de ações falhas
   */
  const retryFailed = useCallback(() => {
    setQueue((prev) => {
      const updated = prev.map((a) =>
        a.status === "failed" ? { ...a, status: "pending" as const, attempts: 0 } : a
      );
      saveQueue(updated);
      return updated;
    });
  }, []);

  const pendingCount = queue.filter((a) => a.status === "pending").length;
  const failedCount = queue.filter((a) => a.status === "failed").length;

  return {
    enqueue,
    processQueue,
    clearCompleted,
    retryFailed,
    queue,
    isProcessing,
    isOnline: isOnlineState,
    pendingCount,
    failedCount,
    hasPending: pendingCount > 0,
    hasFailed: failedCount > 0,
  };
}

/**
 * Hook simplificado para ações críticas com proteção automática
 */
export function useProtectedAction<T extends (...args: unknown[]) => Promise<unknown>>(
  action: string,
  handler: T,
  oficina_id: string
) {
  const { enqueue, isOnline } = useOfflineQueue();

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      const payload = { args };
      
      if (!isOnline) {
        // Enfileirar para quando voltar online
        await enqueue(action, payload, oficina_id);
        return undefined;
      }

      try {
        // Executar diretamente se online
        return await handler(...args) as ReturnType<T>;
      } catch (error) {
        // Falha - enfileirar para retry
        await enqueue(action, payload, oficina_id);
        throw error;
      }
    },
    [action, handler, oficina_id, enqueue, isOnline]
  );

  return { execute, isOnline };
}
