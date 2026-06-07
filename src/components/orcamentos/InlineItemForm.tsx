import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEstoque, ItemEstoque } from "@/hooks/useEstoque";
import { Search, Package, Wrench, Plus, Minus, Zap, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

export interface PendingItem {
  id: string; // temporary ID for local state
  estoque_id?: string;
  nome_item: string;
  tipo: "produto" | "servico";
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
  valor_mao_obra: number;
  valor_total: number;
}

interface InlineItemFormProps {
  pendingItems: PendingItem[];
  onAddItem: (item: Omit<PendingItem, "id" | "valor_total">) => void;
  onRemoveItem: (id: string) => void;
  desconto: number;
}

export function InlineItemForm({ pendingItems, onAddItem, onRemoveItem, desconto }: InlineItemFormProps) {
  const { itens: estoqueItens, isLoading } = useEstoque();
  const { canViewLucro } = useUserRole();
  const { isAutoEletrica } = useOficinaLabels();
  const isMobile = useIsMobile();
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

  const handleSelectItem = (e: React.MouseEvent, item: ItemEstoque) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedItem(item);
    setValorUnitario(item.preco_venda.toString());
    setCustoUnitario(item.custo_unitario.toString());
    setNomeManual(item.nome);
    setQuantidade(1);
  };

  const handleAddItem = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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

  const handleTipoChange = (e: React.MouseEvent, newTipo: "produto" | "servico") => {
    e.preventDefault();
    e.stopPropagation();
    setTipo(newTipo);
    resetForm();
  };

  const handleQuantityChange = (e: React.MouseEvent, delta: number) => {
    e.preventDefault();
    e.stopPropagation();
    setQuantidade(Math.max(1, quantidade + delta));
  };

  const handleRemoveItemClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveItem(id);
  };

  const isValid = tipo === "servico" 
    ? nomeManual && valorUnitario 
    : (selectedItem || nomeManual) && valorUnitario && quantidade > 0;

  // Calculate totals
  const valorTotal = pendingItems.reduce((acc, item) => acc + item.valor_total, 0);
  const custoTotal = pendingItems.reduce((acc, item) => acc + (item.custo_unitario * item.quantidade), 0);
  const valorFinal = valorTotal - desconto;
  const lucroEstimado = valorFinal - custoTotal;

  return (
    <div className="space-y-4">
      {/* Tipo Toggle - Larger touch targets on mobile */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={tipo === "produto" ? "default" : "outline"}
          className={`flex-1 ${isMobile ? "h-12" : ""}`}
          size={isMobile ? "lg" : "sm"}
          onClick={(e) => handleTipoChange(e, "produto")}
        >
          <Package className="w-4 h-4 mr-2" />
          {isAutoEletrica ? "Componente" : "Produto"}
        </Button>
        <Button
          type="button"
          variant={tipo === "servico" ? "default" : "outline"}
          className={`flex-1 ${isMobile ? "h-12" : ""}`}
          size={isMobile ? "lg" : "sm"}
          onClick={(e) => handleTipoChange(e, "servico")}
        >
          {isAutoEletrica ? <Zap className="w-4 h-4 mr-2" /> : <Wrench className="w-4 h-4 mr-2" />}
          {isAutoEletrica ? "Diagnóstico" : "Serviço"}
        </Button>
      </div>

      {tipo === "produto" && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no estoque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stock Items List */}
          <div className="h-32 border rounded-lg overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filteredItens.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {search ? "Nenhum item encontrado" : "Estoque vazio - digite manualmente"}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredItens.slice(0, 10).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => handleSelectItem(e, item)}
                    className={`w-full flex items-center justify-between ${isMobile ? "p-3" : "p-2"} rounded-lg text-left transition-colors text-sm ${
                      selectedItem?.id === item.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted active:bg-muted"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">{item.categoria}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.preco_venda)}</p>
                      <Badge variant={item.quantidade > item.alerta_minimo ? "outline" : "destructive"} className="text-xs">
                        {item.quantidade} un.
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual product name if not from stock */}
          {!selectedItem && (
            <div className="space-y-2">
              <Label className="text-sm">Ou digite o nome do produto</Label>
              <Input
                placeholder="Nome do produto..."
                value={nomeManual}
                onChange={(e) => setNomeManual(e.target.value)}
                className={isMobile ? "h-12" : ""}
              />
            </div>
          )}

          {/* Quantity */}
          {(selectedItem || nomeManual) && (
            <div className="space-y-2">
              <Label className="text-sm">Quantidade</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={isMobile ? "h-10 w-10" : "h-8 w-8"}
                  onClick={(e) => handleQuantityChange(e, -1)}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                  className={`w-20 text-center ${isMobile ? "h-10" : "h-8"}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={isMobile ? "h-10 w-10" : "h-8 w-8"}
                  onClick={(e) => handleQuantityChange(e, 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                {selectedItem && (
                  <span className="text-xs text-muted-foreground">
                    Máx: {selectedItem.quantidade}
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tipo === "servico" && (
        <div className="space-y-2">
          <Label className="text-sm">{isAutoEletrica ? "Descrição do Diagnóstico/Serviço" : "Nome do Serviço"}</Label>
          <Input
            placeholder={isAutoEletrica 
              ? "Ex: Diagnóstico de injeção eletrônica..." 
              : "Ex: Mão de obra troca de óleo..."
            }
            value={nomeManual}
            onChange={(e) => setNomeManual(e.target.value)}
            className={isMobile ? "h-12" : ""}
          />
        </div>
      )}

      {/* Pricing - Always show */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm">Valor Unitário (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={valorUnitario}
            onChange={(e) => setValorUnitario(e.target.value)}
            className={isMobile ? "h-12" : "h-9"}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Custo (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={custoUnitario}
            onChange={(e) => setCustoUnitario(e.target.value)}
            className={isMobile ? "h-12" : "h-9"}
          />
        </div>
      </div>

      {/* Mão de obra por item - only for produtos */}
      {tipo === "produto" && (selectedItem || nomeManual) && (
        <div className="space-y-1">
          <Label className="text-sm">Mão de obra deste item (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00 (opcional)"
            value={valorMaoObra}
            onChange={(e) => setValorMaoObra(e.target.value)}
            className={isMobile ? "h-12" : "h-9"}
          />
          <p className="text-[10px] text-muted-foreground">Valor da mão de obra para instalar/trocar esta peça</p>
        </div>
      )}

      {/* Add Button */}
      <Button 
        type="button" 
        onClick={handleAddItem} 
        disabled={!isValid}
        className={`w-full ${isMobile ? "h-12" : ""}`}
        size={isMobile ? "lg" : "sm"}
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar Item
      </Button>

      {/* Items List */}
      {pendingItems.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Itens adicionados ({pendingItems.length})</Label>
            <div className={isMobile ? "max-h-40 overflow-y-auto" : "max-h-32 overflow-y-auto"} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <div className="space-y-1">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between ${isMobile ? "p-3" : "p-2"} bg-muted/50 rounded-lg text-sm`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.tipo === "produto" ? (
                        <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.nome_item}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantidade}x {formatCurrency(item.valor_unitario)}
                          {(item.valor_mao_obra || 0) > 0 && (
                            <span className="ml-1 text-primary">+ M.O {formatCurrency(item.valor_mao_obra)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold">{formatCurrency(item.valor_total)}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={`${isMobile ? "h-10 w-10" : "h-8 w-8"} text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30`}
                        onClick={(e) => handleRemoveItemClick(e, item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Totals */}
      <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal:</span>
          <span>{formatCurrency(valorTotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="flex justify-between text-destructive">
            <span>Desconto:</span>
            <span>- {formatCurrency(desconto)}</span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between font-bold">
          <span>Total:</span>
          <span>{formatCurrency(valorFinal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>Custo estimado:</span>
          <span>{formatCurrency(custoTotal)}</span>
        </div>
        {canViewLucro && (
          <div className={`flex justify-between text-xs font-medium ${lucroEstimado >= 0 ? "text-success" : "text-destructive"}`}>
            <span>Lucro estimado:</span>
            <span>{formatCurrency(lucroEstimado)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
