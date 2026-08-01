import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEstoque, ItemEstoque } from "@/hooks/useEstoque";
import { Search, Package, Wrench, Plus, Minus, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { markChildModalOpen, markChildModalClosed } from "@/lib/childModalLock";

interface ItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: {
    estoque_id?: string;
    nome_item: string;
    tipo: "produto" | "servico";
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    valor_mao_obra: number;
  }) => void;
}

export function ItemSelector({ open, onOpenChange, onAddItem }: ItemSelectorProps) {
  const { itens: estoqueItens, isLoading } = useEstoque();
  const { canViewLucro } = useUserRole();
  const { isAutoEletrica } = useOficinaLabels();
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<"produto" | "servico">("produto");
  const [selectedItem, setSelectedItem] = useState<ItemEstoque | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [valorUnitario, setValorUnitario] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [nomeManual, setNomeManual] = useState("");
  const [valorMaoObra, setValorMaoObra] = useState("");

  const filteredItens = estoqueItens.filter((item) =>
    item.nome.toLowerCase().includes(search.toLowerCase()) ||
    item.categoria.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectItem = (item: ItemEstoque) => {
    setSelectedItem(item);
    setValorUnitario(item.preco_venda.toString());
    setCustoUnitario(item.custo_unitario.toString());
    setNomeManual(item.nome);
    setQuantidade(1);
  };

  const handleAddItem = () => {
    if (tipo === "servico") {
      if (!nomeManual || !valorUnitario) return;
      onAddItem({
        nome_item: nomeManual,
        tipo: "servico",
        quantidade: 1,
        valor_unitario: parseFloat(valorUnitario),
        custo_unitario: parseFloat(custoUnitario) || 0,
        valor_mao_obra: 0,
      });
    } else if (selectedItem) {
      onAddItem({
        estoque_id: selectedItem.id,
        nome_item: selectedItem.nome,
        tipo: "produto",
        quantidade,
        valor_unitario: parseFloat(valorUnitario),
        custo_unitario: parseFloat(custoUnitario),
        valor_mao_obra: parseFloat(valorMaoObra) || 0,
      });
    } else if (nomeManual) {
      onAddItem({
        nome_item: nomeManual,
        tipo: "produto",
        quantidade,
        valor_unitario: parseFloat(valorUnitario) || 0,
        custo_unitario: parseFloat(custoUnitario) || 0,
        valor_mao_obra: parseFloat(valorMaoObra) || 0,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setQuantidade(1);
    setValorUnitario("");
    setCustoUnitario("");
    setNomeManual("");
    setSearch("");
    setValorMaoObra("");
  };

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    // tipo/quantidade têm default mas são escolha real; ficam na comparação.
    // search é filtro de busca (volátil), não dado do usuário.
    data: { tipo, selectedItem, quantidade, valorUnitario, custoUnitario, nomeManual, valorMaoObra, search },
    onOpenChange,
    onReset: resetForm,
    ignoreKeys: ["search"],
  });

  // D2: este ItemSelector é Dialog em portal, filho do OrcamentoFormModal.
  // Marca o childModalLock enquanto aberto para que o pai (Orcamento) não feche
  // por eco de pointerdown/escape do Radix quando este fecha. Mesmo padrão do
  // par ClienteForm→VeiculoForm. Sincroniza com `open` e libera no unmount.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      wasOpenRef.current = true;
      markChildModalOpen();
    } else if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      markChildModalClosed();
    }
  }, [open]);
  useEffect(() => {
    return () => {
      if (wasOpenRef.current) markChildModalClosed();
    };
  }, []);

  const isValid = tipo === "servico"
    ? nomeManual && valorUnitario
    : (selectedItem || nomeManual) && valorUnitario && quantidade > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-accent" />
            Adicionar Item ao Orçamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={tipo === "produto" ? "default" : "outline"}
              className="flex-1"
              onClick={() => { setTipo("produto"); resetForm(); }}
            >
              <Package className="w-4 h-4 mr-2" />
              {isAutoEletrica ? "Componente" : "Produto"}
            </Button>
            <Button
              type="button"
              variant={tipo === "servico" ? "default" : "outline"}
              className="flex-1"
              onClick={() => { setTipo("servico"); resetForm(); }}
            >
              {isAutoEletrica ? <Zap className="w-4 h-4 mr-2" /> : <Wrench className="w-4 h-4 mr-2" />}
              {isAutoEletrica ? "Diagnóstico / Serviço" : "Serviço"}
            </Button>
          </div>

          {tipo === "produto" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar no estoque..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 text-base"
                />
              </div>

              <div
                className="max-h-48 overflow-y-auto overscroll-contain touch-pan-y border rounded-lg"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Carregando...</div>
                ) : filteredItens.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {search ? "Nenhum item encontrado" : "Estoque vazio"}
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredItens.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className={`w-full flex items-center justify-between gap-3 p-3 rounded-lg text-left transition-colors ${
                          selectedItem?.id === item.id
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.nome}</p>
                          <p className="text-sm text-muted-foreground truncate">{item.categoria}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">{formatCurrency(item.preco_venda)}</p>
                          <Badge variant={item.quantidade > item.alerta_minimo ? "outline" : "destructive"}>
                            {item.quantidade} em estoque
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!selectedItem && (
                <div className="space-y-2">
                  <Label>Ou digite o nome do produto</Label>
                  <Input
                    placeholder="Nome do produto..."
                    value={nomeManual}
                    onChange={(e) => setNomeManual(e.target.value)}
                    className="text-base"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Quantidade</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                    className="w-20 text-center text-base"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantidade(quantidade + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  {selectedItem && (
                    <span className="text-sm text-muted-foreground">
                      Máx: {selectedItem.quantidade}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {tipo === "servico" && (
            <div className="space-y-2">
              <Label>{isAutoEletrica ? "Descrição do Diagnóstico/Serviço" : "Nome do Serviço"}</Label>
              <Input
                placeholder={isAutoEletrica
                  ? "Ex: Diagnóstico de injeção eletrônica, Reparo alternador..."
                  : "Ex: Mão de obra troca de óleo..."
                }
                value={nomeManual}
                onChange={(e) => setNomeManual(e.target.value)}
                className="text-base"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Unitário (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={valorUnitario}
                onChange={(e) => setValorUnitario(e.target.value)}
                className="text-base"
              />
            </div>
            {canViewLucro && (
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={custoUnitario}
                  onChange={(e) => setCustoUnitario(e.target.value)}
                  className="text-base"
                />
              </div>
            )}
          </div>

          {tipo === "produto" && (
            <div className="space-y-2">
              <Label>Mão de Obra (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={valorMaoObra}
                onChange={(e) => setValorMaoObra(e.target.value)}
                className="text-base"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddItem} disabled={!isValid}>
              Adicionar item
            </Button>
          </div>
        </div>
      </DialogContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Descartar item?"
        description="Você preencheu dados deste item e não adicionou. As informações serão descartadas."
        confirmText="Descartar"
        cancelText="Continuar preenchendo"
        onConfirm={confirmClose}
      />
    </Dialog>
  );
}
