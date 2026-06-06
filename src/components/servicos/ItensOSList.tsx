import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useItensOS, ItemOS } from "@/hooks/useItensOS";
import { ServicoRapidoModal } from "./ServicoRapidoModal";
import { Zap, Trash2, Package, Wrench, Plus, ChevronDown, ChevronUp, DollarSign, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { markChildModalClosed, markChildModalOpen } from "@/lib/childModalLock";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ItensOSListProps {
  ordemServicoId: string | undefined;
  className?: string;
}

export function ItensOSList({ ordemServicoId, className }: ItensOSListProps) {
  const { itens, isLoading, addItem, updateItem, deleteItem, totalItens } = useItensOS(ordemServicoId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemOS | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Ref espelhada para o cleanup ler o valor atual (closure de deps=[] capturaria stale).
  const modalOpenRef = useRef(false);
  useEffect(() => { modalOpenRef.current = modalOpen; }, [modalOpen]);

  // Garante que o lock seja liberado se o componente desmontar com o modal aberto.
  useEffect(() => {
    return () => {
      if (modalOpenRef.current) markChildModalClosed();
    };
  }, []);


  const handleAddItem = async (item: {
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    valor_mao_obra?: number;
    estoque_id?: string | null;
    custo_unitario?: number;
    tipo?: "servico" | "produto";
  }) => {
    if (!ordemServicoId) return;

    await addItem.mutateAsync({
      ordem_servico_id: ordemServicoId,
      nome_item: item.nome_item,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_mao_obra: item.valor_mao_obra ?? 0,
      estoque_id: item.estoque_id ?? null,
      custo_unitario: item.custo_unitario ?? 0,
      tipo: item.tipo ?? (item.estoque_id ? "produto" : "servico"),
    });
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleUpdateItem = async (id: string, patch: {
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    valor_mao_obra: number;
    tipo: "servico" | "produto";
  }) => {
    await updateItem.mutateAsync({ id, ...patch });
    setEditingItem(null);
  };

  // Não mostrar se não houver OS (criação)
  if (!ordemServicoId) {
    return null;
  }

  return (
    <>
      <div className={cn("rounded-lg border bg-card", className)}>
        {/* Header clicável */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-sm">Peças e Serviços</h3>
              <p className="text-xs text-muted-foreground">
                {itens.length === 0 
                  ? "Nenhum item adicionado" 
                  : `${itens.length} item${itens.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalItens > 0 && (
              <Badge variant="secondary" className="font-mono text-xs">
                {formatCurrency(totalItens)}
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Conteúdo expandível */}
        {expanded && (
          <div className="overflow-hidden">
              <div className="border-t px-3 pb-3 pt-2 space-y-2">
              {/* Lista — Serviços (só MO) e Peças (qtd × unit) */}
              {itens.length > 0 && (() => {
                const servicosBase = itens.filter((i) => (i.tipo ?? (i.estoque_id ? "produto" : "servico")) === "servico");
                const produtos = itens.filter((i) => (i.tipo ?? (i.estoque_id ? "produto" : "servico")) === "produto");

                const servicoRows = [
                  ...servicosBase.map((i) => ({
                    id: `s-${i.id}`,
                    realId: i.id,
                    nome: i.nome_item,
                    valor: Number(i.valor_mao_obra ?? 0) > 0 ? Number(i.valor_mao_obra) : Number(i.valor_total ?? 0),
                  })),
                  ...produtos
                    .filter((i) => Number(i.valor_mao_obra ?? 0) > 0)
                    .map((i) => ({
                      id: `mo-${i.id}`,
                      realId: i.id,
                      nome: `Mão de obra: ${i.nome_item}`,
                      valor: Number(i.valor_mao_obra),
                    })),
                ];

                const pecaRows = produtos.map((i) => ({
                  id: i.id,
                  nome: i.nome_item,
                  quantidade: Number(i.quantidade || 0),
                  valor_unitario: Number(i.valor_unitario || 0),
                  subtotal: Number(i.quantidade || 0) * Number(i.valor_unitario || 0),
                }));

                const subServ = servicoRows.reduce((a, r) => a + r.valor, 0);
                const subPec = pecaRows.reduce((a, r) => a + r.subtotal, 0);

                const removeBtn = (id: string) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[44px] min-w-[44px] h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deleteItem.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteConfirm(id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                );

                const editBtn = (id: string) => {
                  const item = itens.find((i) => i.id === id);
                  if (!item) return null;
                  // Itens vinculados ao estoque não podem ser editados livremente (risco de reclassificar tipo)
                  if (item.estoque_id) return null;
                  return (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px] h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                      disabled={updateItem.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingItem(item);
                        setModalOpen(true);
                      }}
                      aria-label="Editar item"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  );
                };

                return (
                  <div className="space-y-3">
                    {servicoRows.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Wrench className="w-3 h-3" /> Serviços Executados
                          </span>
                          <span className="text-xs font-semibold font-mono">{formatCurrency(subServ)}</span>
                        </div>
                        {servicoRows.map((row) => (
                          <div key={row.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                            <Wrench className="w-3 h-3 text-muted-foreground shrink-0" />
                            <p className="flex-1 min-w-0 truncate font-medium">{row.nome}</p>
                            <p className="font-mono font-semibold text-xs whitespace-nowrap">{formatCurrency(row.valor)}</p>
                            {editBtn(row.realId)}
                            {removeBtn(row.realId)}
                          </div>
                        ))}
                      </div>
                    )}
                    {pecaRows.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Package className="w-3 h-3" /> Peças Utilizadas
                          </span>
                          <span className="text-xs font-semibold font-mono">{formatCurrency(subPec)}</span>
                        </div>
                        {pecaRows.map((row) => (
                          <div key={row.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm">
                            <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{row.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.quantidade}x {formatCurrency(row.valor_unitario)}
                              </p>
                            </div>
                            <p className="font-mono font-semibold text-xs whitespace-nowrap">{formatCurrency(row.subtotal)}</p>
                            {editBtn(row.id)}
                            {removeBtn(row.id)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

                {/* Total quando há itens */}
                {itens.length > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t text-sm">
                    <span className="font-medium">Total dos itens:</span>
                    <span className="font-bold text-accent">
                      {formatCurrency(totalItens)}
                    </span>
                  </div>
                )}

                {/* Botão de adicionar */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setModalOpen(true);
                  }}
                  className="w-full h-10 gap-2 border-dashed border-accent/50 text-accent hover:bg-accent/5"
                >
                  <Zap className="w-4 h-4" />
                  Adicionar item (estoque ou livre)
                </Button>
              </div>
          </div>
        )}
      </div>

      {/* Modal de Serviço Rápido */}
      <ServicoRapidoModal
        open={modalOpen}
        onOpenChange={(open) => {
          if (open) markChildModalOpen();
          else markChildModalClosed();
          setModalOpen(open);
          if (!open) setEditingItem(null);
        }}
        onAddItem={handleAddItem}
        initialView={editingItem ? "livre" : "menu"}
        editingItem={editingItem}
        onUpdateItem={handleUpdateItem}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O item será removido da OS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteItem(deleteConfirm)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
