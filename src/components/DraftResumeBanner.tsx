import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * BLINDAGEM: Banner de retomada de rascunho.
 *
 * Detecta rascunhos salvos pelo useAutoSave (chave `mechanic_draft_<key>`)
 * e oferece ao usuário retomar de onde parou ou descartar.
 *
 * Caso de uso real: usuário preenche orçamento/OS no mobile, sai para o
 * WhatsApp, app PWA recarrega ao voltar — o banner aparece na tela
 * inicial da seção (Orçamentos / Serviços) e permite voltar ao formulário.
 */

interface DraftResumeBannerProps {
  /** Chave do useAutoSave (sem o prefixo `mechanic_draft_`). */
  draftKey: string;
  /** Rótulo do tipo de rascunho (ex: "orçamento", "ordem de serviço"). */
  label: string;
  /** Disparado ao clicar em "Retomar". O componente abre o modal correspondente. */
  onResume: () => void;
  /** Não mostrar se algum modal/form já está aberto. */
  hidden?: boolean;
}

interface StoredDraft {
  timestamp: number;
  data: any;
}

const PREFIX = "mechanic_draft_";
const EXPIRY_HOURS = 24;

function hasMeaningfulContent(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  // Considerar relevante se houver título, cliente, veículo, itens ou observações
  const keys = ["titulo", "clienteId", "cliente_id", "veiculoId", "veiculo_id", "pendingItems", "itens", "observacoes", "descricao"];
  return keys.some((k) => {
    const v = data[k];
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" ? v.trim().length > 0 : !!v;
  });
}

export function DraftResumeBanner({ draftKey, label, onResume, hidden }: DraftResumeBannerProps) {
  const [draft, setDraft] = useState<StoredDraft | null>(null);
  const storageKey = `${PREFIX}${draftKey}`;

  const check = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setDraft(null);
        return;
      }
      const parsed = JSON.parse(raw) as StoredDraft;
      const ageHours = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
      if (ageHours > EXPIRY_HOURS) {
        localStorage.removeItem(storageKey);
        setDraft(null);
        return;
      }
      if (!hasMeaningfulContent(parsed.data)) {
        setDraft(null);
        return;
      }
      setDraft(parsed);
    } catch {
      setDraft(null);
    }
  };

  useEffect(() => {
    check();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === storageKey) check();
    };
    const onFocus = () => check();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const handleDiscard = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setDraft(null);
  };

  if (!draft || hidden) return null;

  const when = formatDistanceToNow(new Date(draft.timestamp), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
        <FileText className="w-4 h-4 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Você tem um {label} não finalizado
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Rascunho salvo {when}
        </p>
      </div>
      <Button size="sm" className="h-8 px-3 text-xs flex-shrink-0" onClick={onResume}>
        Retomar
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 flex-shrink-0 text-muted-foreground"
        onClick={handleDiscard}
        aria-label="Descartar rascunho"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
