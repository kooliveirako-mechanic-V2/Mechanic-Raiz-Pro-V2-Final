import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, User, CreditCard, Calendar, FileText, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  financeiroId: string | null;
}

interface VendaDetalhe {
  id: string;
  numero: number;
  created_at: string;
  valor_total: number;
  forma_pagamento: string | null;
  observacao: string | null;
  cliente: { nome: string; telefone: string | null } | null;
  itens: Array<{
    id: string;
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    estoque_id: string | null;
  }>;
}

export function VendaBalcaoDetalheModal({ open, onOpenChange, financeiroId }: Props) {
  const [loading, setLoading] = useState(false);
  const [venda, setVenda] = useState<VendaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !financeiroId) return;
    setLoading(true);
    setErro(null);
    setVenda(null);
    (async () => {
      const { data, error } = await supabase
        .from("vendas_balcao" as any)
        .select(
          "id, numero, created_at, valor_total, forma_pagamento, observacao, cliente:clientes(nome, telefone), itens:itens_venda_balcao(id, nome_item, quantidade, valor_unitario, valor_total, estoque_id)",
        )
        .eq("financeiro_id", financeiroId)
        .maybeSingle();
      if (error) {
        setErro("Não foi possível carregar os detalhes da venda.");
      } else if (!data) {
        setErro("Venda original não encontrada (lançamento avulso ou removida).");
      } else {
        setVenda(data as any);
      }
      setLoading(false);
    })();
  }, [open, financeiroId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent" />
            Detalhes da venda
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {erro && !loading && (
          <div className="p-6 text-sm text-muted-foreground text-center">{erro}</div>
        )}

        {venda && !loading && (
          <div className="space-y-4">
            {/* Cabeçalho */}
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">Venda Balcão #{venda.numero}</span>
                <Badge variant="secondary">Pago</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {format(new Date(venda.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
              {venda.forma_pagamento && (
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span>{venda.forma_pagamento}</span>
                </div>
              )}
              {venda.cliente && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {venda.cliente.nome}
                    {venda.cliente.telefone ? ` • ${venda.cliente.telefone}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Itens */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Itens vendidos ({venda.itens.length})
              </div>
              <div className="space-y-2">
                {venda.itens.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-3 bg-card border border-border rounded-lg p-3"
                  >
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{it.nome_item}</div>
                      <div className="text-xs text-muted-foreground">
                        {Number(it.quantidade)} × {formatCurrency(Number(it.valor_unitario))}
                        {!it.estoque_id && (
                          <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground">
                            • item avulso
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(it.valor_total))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Observação */}
            {venda.observacao && (
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Observação
                </div>
                <p className="text-sm">{venda.observacao}</p>
              </div>
            )}

            {/* Total */}
            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total da venda</span>
              <span className="text-2xl font-bold text-success tabular-nums">
                {formatCurrency(Number(venda.valor_total))}
              </span>
            </div>

            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
