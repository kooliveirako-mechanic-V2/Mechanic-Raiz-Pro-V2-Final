import { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEstoque } from "@/hooks/useEstoque";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { useOficina } from "@/contexts/OficinaContext";
import { useAutoSave } from "@/hooks/useAutoSave";
import { toast } from "sonner";
import { Zap, Plus, X, Check, Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface EntradaLoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LoteItem {
  id: string;
  nome: string;
  categoria: string;
  categoriaCustom: string;
  isCustomCategoryMode: boolean; // Estado independente para modo custom
  quantidade: number;
  custo_unitario: number;
  preco_venda: number;
  saved: boolean;
  saving: boolean;
  error?: string;
}

const categoriasOficina = [
  "Óleo", "Filtro", "Peça", "Pneu", "Bateria", "Fluído", "Ferramenta", "Acessório", "Outro"
];

const categoriasAutoEletrica = [
  "Bateria", "Alternador", "Motor de Partida", "Módulo / Central", "Sensor",
  "Relé", "Fusível", "Chicote / Cabo", "Conector", "Lâmpada / LED",
  "Bobina de Ignição", "Velas / Cabos", "Componente Eletrônico", "Outro"
];

export function EntradaLoteModal({ open, onOpenChange }: EntradaLoteModalProps) {
  const { createItem } = useEstoque();
  const { isAutoEletrica } = useOficinaLabels();
  const { oficinaAtual } = useOficina();
  const [items, setItems] = useState<LoteItem[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasRestoredRef = useRef(false);

  const categorias = isAutoEletrica ? categoriasAutoEletrica : categoriasOficina;

  // ─── AutoSave: persiste a lista de itens pendentes ────────────────
  const draftData = useMemo(() => ({
    items: items.filter(i => !i.saved).map(({ saving, error, ...rest }) => rest),
  }), [items]);

  const { hasDraft, restore, clearDraft } = useAutoSave({
    key: `entrada-lote-${oficinaAtual?.id || "global"}`,
    data: draftData,
    enabled: open,
    interval: 1500,
  });

  useEffect(() => {
    if (open) {
      if (hasDraft && !hasRestoredRef.current) {
        hasRestoredRef.current = true;
        const saved = restore() as { items?: LoteItem[] } | null;
        if (saved?.items && saved.items.length > 0) {
          setItems(saved.items.map(i => ({ ...i, saving: false, error: undefined })));
          return;
        }
      }
      if (items.length === 0) addNewItem();
    } else {
      hasRestoredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addNewItem = () => {
    const newItem: LoteItem = {
      id: generateId(),
      nome: "",
      categoria: categorias[0],
      categoriaCustom: "",
      isCustomCategoryMode: false,
      quantidade: 1,
      custo_unitario: 0,
      preco_venda: 0,
      saved: false,
      saving: false,
    };
    setItems(prev => [...prev, newItem]);
    
    // Focus the new input after render
    setTimeout(() => {
      const lastIndex = items.length;
      inputRefs.current[lastIndex]?.focus();
    }, 50);
  };

  const updateItem = (id: string, field: keyof LoteItem, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value, error: undefined } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const saveItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.saved || item.saving) return;

    if (item.nome.trim().length < 2) {
      updateItem(id, "error", "Nome muito curto");
      return;
    }

    // Determinar categoria final
    const categoriaFinal = item.categoria === "Outro" && item.categoriaCustom.trim()
      ? item.categoriaCustom.trim()
      : item.categoria;

    if (categoriaFinal === "Outro" && !item.categoriaCustom.trim()) {
      updateItem(id, "error", "Digite o nome da categoria");
      return;
    }

    updateItem(id, "saving", true);

    try {
      await createItem.mutateAsync({
        nome: item.nome.trim(),
        categoria: categoriaFinal,
        quantidade: item.quantidade,
        custo_unitario: item.custo_unitario,
        preco_venda: item.preco_venda,
        alerta_minimo: 5,
      });
      
      updateItem(id, "saved", true);
      updateItem(id, "saving", false);
      
      // Auto add new item
      addNewItem();
    } catch (error) {
      updateItem(id, "saving", false);
      updateItem(id, "error", "Erro ao salvar");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const item = items.find(i => i.id === id);
      if (item && !item.saved && item.nome.trim().length >= 2) {
        saveItem(id);
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      // If on last field of row, save and add new
      const target = e.target as HTMLElement;
      if (target.getAttribute("data-last-field") === "true") {
        e.preventDefault();
        const item = items.find(i => i.id === id);
        if (item && !item.saved && item.nome.trim().length >= 2) {
          saveItem(id);
        } else if (!item?.saved) {
          addNewItem();
        }
      }
    }
  };

  const saveAllPending = async () => {
    const pendingItems = items.filter(i => !i.saved && i.nome.trim().length >= 2);
    if (pendingItems.length === 0) return;

    setSavingAll(true);
    
    for (const item of pendingItems) {
      await saveItem(item.id);
    }
    
    setSavingAll(false);
  };

  const handleClose = () => {
    const unsaved = items.filter(i => !i.saved && i.nome.trim().length >= 2);
    if (unsaved.length > 0) {
      if (!confirm(`Você tem ${unsaved.length} item(ns) não salvos. Deseja fechar mesmo assim?`)) {
        return;
      }
    }
    setItems([]);
    clearDraft();
    onOpenChange(false);
  };

  const savedCount = items.filter(i => i.saved).length;
  const pendingCount = items.filter(i => !i.saved && i.nome.trim().length >= 2).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Entrada em Lote
          </DialogTitle>
          <DialogDescription>
            Adicione vários itens rapidamente. Pressione Enter para salvar e ir para o próximo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-success" />
            <span>{savedCount} salvos</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-amber-500">
              <Package className="w-4 h-4" />
              <span>{pendingCount} pendentes</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "grid grid-cols-12 gap-2 p-3 rounded-lg border transition-all",
                item.saved 
                  ? "bg-success/5 border-success/30" 
                  : item.error 
                    ? "bg-destructive/5 border-destructive/30"
                    : "border-border"
              )}
            >
              {/* Nome - 4 cols */}
              <div className="col-span-12 sm:col-span-4">
                <Input
                  ref={el => inputRefs.current[index] = el}
                  placeholder="Nome do item *"
                  value={item.nome}
                  onChange={(e) => updateItem(item.id, "nome", e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                  disabled={item.saved || item.saving}
                  className={cn(item.error && "border-destructive")}
                />
                {item.error && (
                  <p className="text-xs text-destructive mt-1">{item.error}</p>
                )}
              </div>

              {/* Categoria - 2 cols (or 3 if custom input shown) */}
              <div className={cn(
                "col-span-6",
                item.categoria === "Outro" ? "sm:col-span-3" : "sm:col-span-2"
              )}>
                <div className="flex gap-1">
                  <Select
                    value={item.isCustomCategoryMode ? "Outro" : item.categoria}
                    onValueChange={(v) => {
                      if (v === "Outro") {
                        updateItem(item.id, "isCustomCategoryMode", true);
                        updateItem(item.id, "categoriaCustom", "");
                      } else {
                        updateItem(item.id, "isCustomCategoryMode", false);
                        updateItem(item.id, "categoria", v);
                        updateItem(item.id, "categoriaCustom", "");
                      }
                    }}
                    disabled={item.saved || item.saving}
                  >
                    <SelectTrigger className="h-10 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {item.isCustomCategoryMode && (
                    <Input
                      placeholder="Nova categoria"
                      value={item.categoriaCustom}
                      onChange={(e) => {
                        updateItem(item.id, "categoriaCustom", e.target.value);
                        // Atualizar categoria com o valor digitado para validação
                        updateItem(item.id, "categoria", e.target.value);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                      disabled={item.saved || item.saving}
                      className="flex-1"
                      autoFocus={false}
                    />
                  )}
                </div>
              </div>

              {/* Quantidade - 1 col */}
              <div className="col-span-3 sm:col-span-1">
                <Input
                  type="number"
                  min="0"
                  placeholder="Qtd"
                  value={item.quantidade || ""}
                  onChange={(e) => updateItem(item.id, "quantidade", parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                  disabled={item.saved || item.saving}
                />
              </div>

              {/* Custo - 2 cols */}
              <div className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Custo R$"
                  value={item.custo_unitario || ""}
                  onChange={(e) => updateItem(item.id, "custo_unitario", parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                  disabled={item.saved || item.saving}
                />
              </div>

              {/* Preço Venda - 2 cols */}
              <div className="col-span-4 sm:col-span-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Venda R$"
                  value={item.preco_venda || ""}
                  onChange={(e) => updateItem(item.id, "preco_venda", parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                  disabled={item.saved || item.saving}
                  data-last-field="true"
                />
              </div>

              {/* Actions - 1 col */}
              <div className="col-span-4 sm:col-span-1 flex items-center justify-end gap-1">
                {item.saving ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : item.saved ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => saveItem(item.id)}
                      disabled={item.nome.trim().length < 2}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addNewItem}
            className="w-full border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar linha
          </Button>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <div className="flex gap-2">
            {pendingCount > 0 && (
              <Button
                onClick={saveAllPending}
                disabled={savingAll}
                className="bg-accent hover:bg-accent/90"
              >
                {savingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Salvar todos ({pendingCount})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
