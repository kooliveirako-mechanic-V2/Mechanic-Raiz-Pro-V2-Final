import { Button } from "@/components/ui/button";
import { Package, Wrench, Trash2, BookOpen, Sparkles, Pencil } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

export interface PendingItem {
  id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  custo_unitario: number;
  valor_mao_obra: number;
  estoque_id?: string | null;
  tipo?: "servico" | "produto";
}

export type ServicoRapidoView = "menu" | "livre" | "estoque" | "catalogo";

interface Props {
  pendingItens: PendingItem[];
  setPendingItens: React.Dispatch<React.SetStateAction<PendingItem[]>>;
  onOpenServicoRapido: (initialView?: ServicoRapidoView) => void;
  onEditItem?: (item: PendingItem) => void;
}

export function OSFormPendingItens({ pendingItens, setPendingItens, onOpenServicoRapido, onEditItem }: Props) {
  const pendingItensTotal = pendingItens.reduce(
    (acc, item) => acc + item.valor_unitario * item.quantidade + (item.valor_mao_obra || 0),
    0
  );

  return (
    <div className="space-y-3 min-w-0">
      <SectionHeader
        icon={Package}
        title="Peças e serviços cobrados"
        subtitle={
          pendingItens.length === 0
            ? "É daqui que sai o total da OS: peças do estoque, serviços do catálogo ou itens livres"
            : `${pendingItens.length} item${pendingItens.length > 1 ? "s" : ""} adicionado${pendingItens.length > 1 ? "s" : ""}`
        }
        color="text-accent"
        step={3}
      />

      {/* 3 botões diretos — cada um abre o fluxo correspondente sem menu intermediário */}
      <div className="grid grid-cols-3 gap-2 min-w-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenServicoRapido("estoque"); }}
          className="h-14 min-w-0 flex-col gap-1 border-dashed border-primary/50 text-primary hover:bg-primary/10 px-1"
        >
          <Package className="w-4 h-4" />
          <span className="text-[11px] font-semibold leading-none text-center break-words">Peça do<br />Estoque</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenServicoRapido("catalogo"); }}
          className="h-14 min-w-0 flex-col gap-1 border-dashed border-success/50 text-success hover:bg-success/10 px-1"
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[11px] font-semibold leading-none text-center break-words">Serviços</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenServicoRapido("livre"); }}
          className="h-14 min-w-0 flex-col gap-1 border-dashed border-accent/50 text-accent hover:bg-accent/10 px-1"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-semibold leading-none text-center break-words">Item<br />Livre</span>
        </Button>
      </div>

      {pendingItens.length > 0 && (
        <div className="space-y-1 min-w-0">
          {pendingItens.map((item) => (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 text-sm min-w-0">
              <div className="w-6 h-6 rounded bg-muted flex items-center justify-center shrink-0">
                {item.estoque_id ? <Package className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.nome_item}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.quantidade}x R$ {item.valor_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  {(item.valor_mao_obra || 0) > 0 && (
                    <span className="ml-1 text-primary">+ M.O R$ {item.valor_mao_obra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-semibold text-xs whitespace-nowrap">
                  R$ {(item.valor_unitario * item.quantidade + (item.valor_mao_obra || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {onEditItem && !item.estoque_id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEditItem(item); }}
                  aria-label="Editar item"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.preventDefault(); setPendingItens((prev) => prev.filter((i) => i.id !== item.id)); }}
                aria-label="Remover item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2 border-t text-sm">
            <span className="font-medium">Subtotal dos itens:</span>
            <span className="font-bold text-accent">
              R$ {pendingItensTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
