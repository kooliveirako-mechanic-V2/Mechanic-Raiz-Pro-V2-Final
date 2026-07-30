import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { DraftPromptDialog } from "@/components/DraftPromptDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { humanizeError, withRetry, logBusinessEvent } from "@/lib/errorHandling";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useAutoSave } from "@/hooks/useAutoSave";

interface FinanceiroFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo?: "entrada" | "saida";
}

const categorias = {
  entrada: [
    "Serviço",
    "Venda de peças",
    "Pagamento pendente",
    "Outros",
  ],
  saida: [
    "Compra de peças",
    "Fornecedores",
    "Salários",
    "Aluguel",
    "Conta de luz",
    "Conta de água",
    "Internet",
    "Manutenção",
    "Impostos",
    "Outros",
  ],
};

export function FinanceiroFormModal({ open, onOpenChange, tipo: tipoInicial }: FinanceiroFormModalProps) {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">(tipoInicial || "entrada");
  const [origem, setOrigem] = useState("");
  const [origemCustom, setOrigemCustom] = useState("");
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false); // Estado independente
  const [valor, setValor] = useState("");
  
  // BLINDAGEM: Proteção contra duplo clique
  const isSubmittingRef = useRef(false);
  const lastSubmitRef = useRef<number>(0);
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [descricao, setDescricao] = useState("");

  const showCustomInput = isCustomCategoryMode;

  // ─── AutoSave: persiste lançamento financeiro em rascunho ────────
  const draftData = useMemo(() => ({
    tipo, origem, origemCustom, isCustomCategoryMode, valor, data, descricao,
  }), [tipo, origem, origemCustom, isCustomCategoryMode, valor, data, descricao]);

  const { hasDraft, restore, clearDraft, lastSaved } = useAutoSave({
    key: `financeiro-form-${oficinaAtual?.id || "global"}-new`,
    data: draftData,
    enabled: open,
    interval: 1500,
  });

  const hasRestoredRef = useRef(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  const resetFinanceiroForm = useCallback(() => {
    setOrigem("");
    setOrigemCustom("");
    setIsCustomCategoryMode(false);
    setValor("");
    setData(new Date().toISOString().split("T")[0]);
    setDescricao("");
  }, []);

  const applyDraft = useCallback(() => {
    const saved = restore() as typeof draftData | null;
    if (saved) {
      if (!tipoInicial) setTipo(saved.tipo || "entrada");
      setOrigem(saved.origem || "");
      setOrigemCustom(saved.origemCustom || "");
      setIsCustomCategoryMode(!!saved.isCustomCategoryMode);
      setValor(saved.valor || "");
      setData(saved.data || new Date().toISOString().split("T")[0]);
      setDescricao(saved.descricao || "");
    }
    setDraftPromptOpen(false);
  }, [restore, tipoInicial]);

  const discardDraft = useCallback(() => {
    clearDraft();
    resetFinanceiroForm();
    setDraftPromptOpen(false);
  }, [clearDraft, resetFinanceiroForm]);

  // BLINDAGEM UX: nunca restaurar rascunho silenciosamente.
  useEffect(() => {
    if (tipoInicial) {
      setTipo(tipoInicial);
    }
    if (open) {
      if (hasDraft && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        setDraftPromptOpen(true);
      } else if (!hasRestoredRef.current) {
        hasRestoredRef.current = true;
      }
    } else {
      hasRestoredRef.current = false;
      setDraftPromptOpen(false);
      resetFinanceiroForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoInicial, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const origemFinal = isCustomCategoryMode ? origemCustom.trim() : origem;
    if (!oficinaAtual || !origemFinal || !valor) return;

    // BLINDAGEM: Proteção contra duplo clique/submit
    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitRef.current < 1000) {
      console.log("[Financeiro Form] Submit bloqueado - ação já em andamento");
      return;
    }
    
    isSubmittingRef.current = true;
    lastSubmitRef.current = now;
    setLoading(true);

    try {
      // BLINDAGEM: Retry automático para falhas de rede
      await withRetry(
        async () => {
          const { error } = await supabase.from("financeiro").insert({
            oficina_id: oficinaAtual.id,
            tipo,
            origem: origemFinal,
            valor: parseFloat(valor),
            data,
            // Competência = data do lançamento. O trigger trg_financeiro_competencia_default
            // cobre writers que omitam o campo, mas enviar explícito é o que faz o dado
            // nascer certo e aparecer em code review (data_competencia é NOT NULL).
            data_competencia: data,
            descricao: descricao || null,
          });

          if (error) throw error;
        },
        { maxRetries: 2, delay: 1000 }
      );

      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-prefiscal", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(tipo === "entrada" ? "Receita registrada!" : "Despesa registrada!");
      
      // BLINDAGEM: Log de evento de negócio
      logBusinessEvent("financeiro_criado", { tipo, origem, valor: parseFloat(valor) });
      
      clearDraft();
      onOpenChange(false);
    } catch (error: any) {
      // BLINDAGEM: Mensagem humanizada
      const errorInfo = humanizeError(error);
      toast.error(errorInfo.message, { description: errorInfo.description });
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const FormContent = (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4 px-1">
      {/* Type Toggle */}
      {!tipoInicial && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tipo === "entrada" ? "default" : "outline"}
            className={cn(
              "flex-1 h-12",
              tipo === "entrada" && "bg-success hover:bg-success/90"
            )}
            onClick={() => setTipo("entrada")}
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Entrada
          </Button>
          <Button
            type="button"
            variant={tipo === "saida" ? "default" : "outline"}
            className={cn(
              "flex-1 h-12",
              tipo === "saida" && "bg-destructive hover:bg-destructive/90"
            )}
            onClick={() => setTipo("saida")}
          >
            <ArrowDownRight className="w-4 h-4 mr-2" />
            Saída
          </Button>
        </div>
      )}

      {/* Category */}
      <div className="space-y-2">
        <Label className="text-base">Categoria *</Label>
        <Select 
          value={isCustomCategoryMode ? "Outros" : origem} 
          onValueChange={(value) => {
            if (value === "Outros") {
              setIsCustomCategoryMode(true);
              setOrigemCustom("");
            } else {
              setIsCustomCategoryMode(false);
              setOrigem(value);
              setOrigemCustom("");
            }
          }}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            {categorias[tipo].map((cat) => (
              <SelectItem key={cat} value={cat} className="text-base py-3">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {/* Campo para categoria personalizada */}
        {showCustomInput && (
          <Input
            placeholder="Digite a nova categoria..."
            value={origemCustom}
            onChange={(e) => {
              setOrigemCustom(e.target.value);
              // Manter origem sincronizada para validação do form
              setOrigem(e.target.value || "__custom__");
            }}
            className="h-12 text-base mt-2"
            autoFocus={false}
          />
        )}
      </div>

      {/* Value */}
      <div className="space-y-2">
        <Label htmlFor="valor" className="text-base">Valor *</Label>
        <CurrencyInput
          id="valor"
          value={valor}
          onValueChange={setValor}
        />
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="data" className="text-base">Data</Label>
        <Input
          id="data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="descricao" className="text-base">Descrição (opcional)</Label>
        <Textarea
          id="descricao"
          placeholder="Detalhes do lançamento..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="text-base"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 pb-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => onOpenChange(false)} 
          className="flex-1 h-12 text-base"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || !origem || !valor}
          className={cn(
            "flex-1 h-12 text-base font-semibold",
            tipo === "entrada" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"
          )}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </form>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      {tipo === "entrada" ? (
        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
          <ArrowUpRight className="w-5 h-5 text-success" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <ArrowDownRight className="w-5 h-5 text-destructive" />
        </div>
      )}
      <span>{tipo === "entrada" ? "Nova Receita" : "Nova Despesa"}</span>
    </div>
  );

  const draftPrompt = (
    <DraftPromptDialog
      open={draftPromptOpen}
      label={tipo === "entrada" ? "lançamento de entrada" : "lançamento de saída"}
      savedAt={lastSaved}
      onResume={applyDraft}
      onDiscard={discardDraft}
    />
  );

  // Mobile: Drawer from bottom
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="px-4 pb-6 max-h-[90dvh]">
            <DrawerHeader className="text-left px-0">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                {HeaderContent}
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto">
              {FormContent}
            </div>
          </DrawerContent>
        </Drawer>
        {draftPrompt}
      </>
    );
  }

  // Desktop: Dialog
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {HeaderContent}
            </DialogTitle>
          </DialogHeader>
          {FormContent}
        </DialogContent>
      </Dialog>
      {draftPrompt}
    </>
  );
}
