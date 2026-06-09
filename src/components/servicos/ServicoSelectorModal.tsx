import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useEstoque, ItemEstoque } from "@/hooks/useEstoque";
import { Search, Wrench, Plus, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface ServicoSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (servico: { nome: string; valor: number }) => void;
}

export function ServicoSelectorModal({
  open,
  onOpenChange,
  onSelect,
}: ServicoSelectorModalProps) {
  const isMobile = useIsMobile();
  const { itens: estoqueItens, isLoading } = useEstoque();
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | null>(null);
  const [nomeManual, setNomeManual] = useState("");
  const [valorManual, setValorManual] = useState("");

  const servicosDisponiveis = estoqueItens.filter((item) => {
    const cat = item.categoria?.toLowerCase() || "";
    return (
      cat.includes("serviço") ||
      cat.includes("servico") ||
      cat.includes("mão de obra") ||
      cat.includes("mao de obra") ||
      cat.includes("diagnóstico") ||
      cat.includes("diagnostico")
    );
  });

  const filteredServicos = servicosDisponiveis.filter((item) =>
    item.nome.toLowerCase().includes(search.toLowerCase()) ||
    item.categoria?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectItem = (item: ItemEstoque) => {
    setSelectedItem(item);
    setNomeManual(item.nome);
    setValorManual(item.preco_venda?.toString() || "");
  };

  const handleConfirm = () => {
    if (selectedItem) {
      onSelect({
        nome: selectedItem.nome,
        valor: selectedItem.preco_venda || 0,
      });
    } else if (nomeManual) {
      onSelect({
        nome: nomeManual,
        valor: parseFloat(valorManual) || 0,
      });
    }
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setNomeManual("");
    setValorManual("");
    setSearch("");
  };

  const isValid = selectedItem || nomeManual.trim().length > 0;

  const Content = (
    <div className="space-y-4 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar mão de obra / serviço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Serviços cadastrados</Label>
        <div
          className="max-h-48 overflow-y-auto overscroll-contain touch-pan-y border rounded-lg"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Carregando...</div>
          ) : filteredServicos.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {search ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado ainda"}
              <p className="text-xs mt-1">Use o campo abaixo para digitar manualmente</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredServicos.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                    selectedItem?.id === item.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.categoria}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs shrink-0">
                    {formatCurrency(item.preco_venda || 0)}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">ou digite manualmente</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Mão de Obra / Serviço</Label>
          <div className="relative">
            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ex: Troca de correia, Diagnóstico..."
              value={nomeManual}
              onChange={(e) => {
                setNomeManual(e.target.value);
                setSelectedItem(null);
              }}
              className="pl-10 h-11 text-base"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={valorManual}
            onChange={(e) => setValorManual(e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      {isValid && (
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="flex justify-between items-center gap-3">
            <span className="text-sm font-medium truncate">
              {selectedItem?.nome || nomeManual}
            </span>
            <span className="text-sm font-bold text-accent shrink-0">
              {formatCurrency(selectedItem?.preco_venda || parseFloat(valorManual) || 0)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="flex-1 h-11"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!isValid}
          className="flex-1 h-11 bg-accent hover:bg-accent/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Selecionar
        </Button>
      </div>
    </div>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
        <Wrench className="w-5 h-5 text-accent" />
      </div>
      <span>Selecionar Mão de Obra</span>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{HeaderContent}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {Content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{HeaderContent}</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 -mb-6">
          {Content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
