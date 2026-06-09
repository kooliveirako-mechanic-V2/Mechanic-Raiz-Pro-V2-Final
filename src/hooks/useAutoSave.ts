import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Hook para autosave de formulários críticos.
 * Salva rascunho no localStorage a cada mudança,
 * permitindo recuperação após refresh/queda de conexão.
 *
 * BLINDAGEM: Proteção contra perda de dados
 */

interface AutoSaveOptions<T> {
  /** Chave única para identificar o rascunho (ex: "os-form-123") */
  key: string;
  /** Dados a serem salvos */
  data: T;
  /** Intervalo de salvamento em ms (default: 2000) */
  interval?: number;
  /** Callback quando dados são restaurados */
  onRestore?: (data: T) => void;
  /** Se deve salvar automaticamente */
  enabled?: boolean;
}

interface AutoSaveResult<T> {
  /** Se há um rascunho salvo disponível */
  hasDraft: boolean;
  /** Timestamp do último salvamento */
  lastSaved: Date | null;
  /** Restaurar dados do rascunho */
  restore: () => T | null;
  /** Limpar rascunho (chamar após salvar com sucesso) */
  clearDraft: () => void;
  /** Forçar salvamento imediato */
  saveNow: () => void;
  /** Se está salvando */
  isSaving: boolean;
}

const DRAFT_PREFIX = "mechanic_draft_";
const DRAFT_EXPIRY_HOURS = 24; // Rascunhos expiram após 24h

interface DraftData<T> {
  data: T;
  timestamp: number;
  version: number;
}

export function useAutoSave<T>({
  key,
  data,
  interval = 2000,
  onRestore,
  enabled = true,
}: AutoSaveOptions<T>): AutoSaveResult<T> {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const dataRef = useRef<T>(data);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const versionRef = useRef(1);

  const storageKey = `${DRAFT_PREFIX}${key}`;

  // Verificar se há rascunho válido ao montar / trocar de chave
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: DraftData<T> = JSON.parse(stored);
        const hoursSinceSave = (Date.now() - draft.timestamp) / (1000 * 60 * 60);

        if (hoursSinceSave < DRAFT_EXPIRY_HOURS) {
          setHasDraft(true);
          setLastSaved(new Date(draft.timestamp));
          versionRef.current = draft.version;
        } else {
          localStorage.removeItem(storageKey);
          setHasDraft(false);
          setLastSaved(null);
        }
      } else {
        setHasDraft(false);
        setLastSaved(null);
      }
    } catch (error) {
      console.error("[AutoSave] Erro ao verificar rascunho:", error);
      setHasDraft(false);
      setLastSaved(null);
    }
  }, [storageKey]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const saveNow = useCallback(() => {
    if (!enabled) return;

    try {
      setIsSaving(true);
      versionRef.current += 1;

      const draft: DraftData<T> = {
        data: dataRef.current,
        timestamp: Date.now(),
        version: versionRef.current,
      };

      localStorage.setItem(storageKey, JSON.stringify(draft));
      setLastSaved(new Date(draft.timestamp));
      setHasDraft(true);
    } catch (error) {
      console.error("[AutoSave] Erro ao salvar rascunho:", error);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, storageKey]);

  // Debounce do salvamento em digitação normal
  useEffect(() => {
    if (!enabled) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(saveNow, interval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, enabled, interval, saveNow]);

  // Flush imediato ao trocar de aba/app ou encerrar a página
  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveNow();
      }
    };

    const handlePageHide = () => {
      saveNow();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, true);
    window.addEventListener("pagehide", handlePageHide, true);
    window.addEventListener("beforeunload", handlePageHide, true);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange, true);
      window.removeEventListener("pagehide", handlePageHide, true);
      window.removeEventListener("beforeunload", handlePageHide, true);
    };
  }, [enabled, saveNow]);

  const restore = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: DraftData<T> = JSON.parse(stored);

        onRestore?.(draft.data);

        toast.info("Rascunho recuperado", {
          description: "Seus dados foram restaurados automaticamente",
        });

        return draft.data;
      }
    } catch (error) {
      console.error("[AutoSave] Erro ao restaurar rascunho:", error);
      toast.error("Não foi possível restaurar o rascunho");
    }
    return null;
  }, [onRestore, storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSaved(null);
    } catch (error) {
      console.error("[AutoSave] Erro ao limpar rascunho:", error);
    }
  }, [storageKey]);

  return {
    hasDraft,
    lastSaved,
    restore,
    clearDraft,
    saveNow,
    isSaving,
  };
}

/**
 * Utilitário para limpar todos os rascunhos de uma oficina
 */
export function clearAllDrafts(oficinaId?: string): void {
  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) {
        if (!oficinaId || key.includes(oficinaId)) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("[AutoSave] Erro ao limpar rascunhos:", error);
  }
}
