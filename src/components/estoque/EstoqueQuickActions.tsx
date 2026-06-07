import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImportCSVModal } from "./ImportCSVModal";
import { CatalogoBaseModal } from "./CatalogoBaseModal";
import { EntradaLoteModal } from "./EntradaLoteModal";
import { useEstoque, ItemEstoque } from "@/hooks/useEstoque";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  ChevronDown, 
  FileSpreadsheet, 
  Package, 
  Zap, 
  Copy,
  Plus,
  Loader2,
  MinusCircle
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface EstoqueQuickActionsProps {
  onNewItem: () => void;
  selectedItem?: ItemEstoque | null;
  onDuplicateComplete?: () => void;
}

export function EstoqueQuickActions({ 
  onNewItem, 
  selectedItem,
  onDuplicateComplete 
}: EstoqueQuickActionsProps) {
  const { createItem, itens } = useEstoque();
  const { oficinaAtual } = useOficina();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [csvOpen, setCsvOpen] = useState(false);
  const [catalogoOpen, setCatalogoOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);

  // BLINDAGEM: permite abrir o modal "Entrada em Lote" via evento (banner de rascunho)
  useEffect(() => {
    const open = () => setLoteOpen(true);
    window.addEventListener("open-entrada-lote", open);
    return () => window.removeEventListener("open-entrada-lote", open);
  }, []);
  const [duplicating, setDuplicating] = useState(false);
  const [saidaOpen, setSaidaOpen] = useState(false);
  const [saidaQtd, setSaidaQtd] = useState("1");
  const [saidaMotivo, setSaidaMotivo] = useState("");
  const [saidaLoading, setSaidaLoading] = useState(false);

  const handleSaidaManual = async () => {
    if (!selectedItem || !oficinaAtual) return;
    const qtd = parseInt(saidaQtd) || 1;
    if (qtd <= 0) { toast.error("Quantidade inválida"); return; }

    setSaidaLoading(true);
    try {
      const novaQtd = selectedItem.quantidade - qtd;
      const { error: updateErr } = await supabase
        .from("estoque")
        .update({ quantidade: novaQtd, ultima_saida: new Date().toISOString() })
        .eq("id", selectedItem.id);
      if (updateErr) throw updateErr;

      const { error: movErr } = await supabase
        .from("estoque_movimentacoes")
        .insert({
          estoque_id: selectedItem.id,
          oficina_id: oficinaAtual.id,
          tipo: "saida",
          quantidade: qtd,
          quantidade_anterior: selectedItem.quantidade,
          quantidade_nova: novaQtd,
          motivo: saidaMotivo.trim() || "Saída manual",
          referencia_tipo: "manual",
          user_id: user?.id,
        });
      if (movErr) throw movErr;

      queryClient.invalidateQueries({ queryKey: ["estoque"] });
      toast.success(`✅ ${qtd}x ${selectedItem.nome} removido do estoque`);
      setSaidaOpen(false);
      setSaidaQtd("1");
      setSaidaMotivo("");
    } catch (err: any) {
      toast.error("Erro na saída: " + (err.message || "Tente novamente"));
    } finally {
      setSaidaLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedItem) {
      toast.error("Selecione um item para duplicar");
      return;
    }

    setDuplicating(true);
    try {
      await createItem.mutateAsync({
        nome: `${selectedItem.nome} (cópia)`,
        categoria: selectedItem.categoria,
        tipo_veiculo: selectedItem.tipo_veiculo,
        quantidade: 0,
        custo_unitario: selectedItem.custo_unitario,
        preco_venda: selectedItem.preco_venda,
        alerta_minimo: selectedItem.alerta_minimo,
        localizacao: selectedItem.localizacao || undefined,
        fornecedor_nome: selectedItem.fornecedor_nome || undefined,
        fornecedor_telefone: selectedItem.fornecedor_telefone || undefined,
        fornecedor_email: selectedItem.fornecedor_email || undefined,
        codigo: selectedItem.codigo ? `${selectedItem.codigo}-COPIA` : undefined,
      });
      toast.success("Item duplicado com sucesso!");
      onDuplicateComplete?.();
    } catch (error) {
      toast.error("Erro ao duplicar item");
    } finally {
      setDuplicating(false);
    }
  };

  // Mobile: Compact dropdown layout
  if (isMobile) {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button onClick={onNewItem} className="bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            <span>Novo</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="border-warning/40 bg-warning/10 hover:bg-warning/20">
                <ChevronDown className="w-4 h-4 text-warning" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLoteOpen(true)}>
                <Zap className="w-4 h-4 mr-2 text-warning" />
                <div>
                  <p className="font-medium">Entrada em Lote</p>
                  <p className="text-xs text-muted-foreground">Adicionar vários itens rápido</p>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => setCatalogoOpen(true)}>
                <Package className="w-4 h-4 mr-2 text-accent" />
                <div>
                  <p className="font-medium">Catálogo de Peças</p>
                  <p className="text-xs text-muted-foreground">Itens comuns pré-definidos</p>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => setCsvOpen(true)}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-success" />
                <div>
                  <p className="font-medium">Importar CSV</p>
                  <p className="text-xs text-muted-foreground">Upload de planilha</p>
                </div>
              </DropdownMenuItem>

              {selectedItem && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSaidaOpen(true)}>
                    <MinusCircle className="w-4 h-4 mr-2 text-destructive" />
                    <div>
                      <p className="font-medium">Saída Manual</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        Baixa de "{selectedItem.nome}"
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
                    {duplicating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">Duplicar Item</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        Copiar "{selectedItem.nome}"
                      </p>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <ImportCSVModal open={csvOpen} onOpenChange={setCsvOpen} />
        <CatalogoBaseModal open={catalogoOpen} onOpenChange={setCatalogoOpen} />
        <EntradaLoteModal open={loteOpen} onOpenChange={setLoteOpen} />

        {/* Saída Manual Dialog (mobile) */}
        <Dialog open={saidaOpen} onOpenChange={setSaidaOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-destructive" />
                Saída Manual
              </DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="font-medium text-sm">{selectedItem.nome}</p>
                  <p className="text-xs text-muted-foreground">Estoque atual: {selectedItem.quantidade} un</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida-qtd-m">Quantidade a retirar</Label>
                  <Input id="saida-qtd-m" type="number" min="1" max={selectedItem.quantidade} value={saidaQtd} onChange={(e) => setSaidaQtd(e.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saida-motivo-m">Motivo (opcional)</Label>
                  <Textarea id="saida-motivo-m" placeholder="Ex: Peça quebrada, uso interno..." value={saidaMotivo} onChange={(e) => setSaidaMotivo(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSaidaOpen(false)} className="flex-1">Cancelar</Button>
                  <Button onClick={handleSaidaManual} disabled={saidaLoading} className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {saidaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MinusCircle className="w-4 h-4 mr-2" />}
                    Confirmar Saída
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Desktop/Tablet: Expanded buttons with labels
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Productivity buttons - visible on desktop/tablet */}
        <Button 
          variant="outline" 
          onClick={() => setLoteOpen(true)}
          className="border-warning/30 text-warning hover:bg-warning/10"
        >
          <Zap className="w-4 h-4 mr-2" />
          <span className="hidden lg:inline">Entrada em Lote</span>
          <span className="lg:hidden">Em Lote</span>
        </Button>

        <Button 
          variant="outline" 
          onClick={() => setCatalogoOpen(true)}
          className="border-accent/30 hover:bg-accent/10"
        >
          <Package className="w-4 h-4 mr-2 text-accent" />
          <span className="hidden lg:inline">Catálogo de Peças</span>
          <span className="lg:hidden">Catálogo</span>
        </Button>

        <Button 
          variant="outline" 
          onClick={() => setCsvOpen(true)}
          className="border-success/30 text-success hover:bg-success/10"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          <span className="hidden lg:inline">Importar CSV</span>
          <span className="lg:hidden">CSV</span>
        </Button>

        {/* Saída Manual - only when item is selected */}
        {selectedItem && (
          <Button 
            variant="outline"
            onClick={() => setSaidaOpen(true)}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <MinusCircle className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Saída Manual</span>
            <span className="lg:hidden">Saída</span>
          </Button>
        )}

        {/* Duplicate button - only when item is selected */}
        {selectedItem && (
          <Button 
            variant="outline"
            onClick={handleDuplicate}
            disabled={duplicating}
            className="border-muted-foreground/20"
          >
            {duplicating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Copy className="w-4 h-4 mr-2 text-muted-foreground" />
            )}
            <span className="hidden lg:inline">Duplicar</span>
          </Button>
        )}

        {/* Main add button */}
        <Button onClick={onNewItem} className="bg-accent hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          Novo Item
        </Button>
      </div>

      {/* Modals */}
      <ImportCSVModal open={csvOpen} onOpenChange={setCsvOpen} />
      <CatalogoBaseModal open={catalogoOpen} onOpenChange={setCatalogoOpen} />
      <EntradaLoteModal open={loteOpen} onOpenChange={setLoteOpen} />

      {/* Saída Manual Dialog */}
      <Dialog open={saidaOpen} onOpenChange={setSaidaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MinusCircle className="w-5 h-5 text-destructive" />
              Saída Manual
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="font-medium text-sm">{selectedItem.nome}</p>
                <p className="text-xs text-muted-foreground">Estoque atual: {selectedItem.quantidade} un</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="saida-qtd">Quantidade a retirar</Label>
                <Input id="saida-qtd" type="number" min="1" max={selectedItem.quantidade} value={saidaQtd} onChange={(e) => setSaidaQtd(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saida-motivo">Motivo (opcional)</Label>
                <Textarea id="saida-motivo" placeholder="Ex: Peça quebrada, uso interno..." value={saidaMotivo} onChange={(e) => setSaidaMotivo(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSaidaOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSaidaManual} disabled={saidaLoading} className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  {saidaLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MinusCircle className="w-4 h-4 mr-2" />}
                  Confirmar Saída
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
