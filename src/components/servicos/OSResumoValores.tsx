import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useItensOS } from "@/hooks/useItensOS";
import { DollarSign, Package, Wrench, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface OSResumoValoresProps {
  ordemServicoId: string | undefined;
  valorServico?: number;
  valorMaoObra?: number;
  custoServico?: number;
  desconto?: number;
  descontoMotivo?: string | null;
  className?: string;
}

export function OSResumoValores({
  ordemServicoId,
  valorServico = 0,
  valorMaoObra = 0,
  custoServico = 0,
  desconto = 0,
  descontoMotivo,
  className,
}: OSResumoValoresProps) {
  const { itens } = useItensOS(ordemServicoId);

  // Não mostrar se não houver OS ou não houver valores
  if (!ordemServicoId) return null;
  
  const totalProdutos = itens.reduce((acc, item) => acc + ((item.quantidade || 0) * (item.valor_unitario || 0)), 0);
  const temItens = totalProdutos > 0;
  const temValorServico = valorServico > 0 || valorMaoObra > 0;
  
  // Não mostrar se não há nada para exibir
  if (!temItens && !temValorServico) return null;

  // Detect items from stock with zero cost (livres sem custo NÃO são incompletos — apenas zero)
  const itensSemCusto = itens.filter(
    (item) => item.estoque_id && (!item.estoque?.custo_unitario || item.estoque.custo_unitario <= 0)
  );
  const hasItensSemCusto = itensSemCusto.length > 0;

  // CAUSA RAIZ: valor_servico é Master Total salvo; valorMaoObra é o campo editável.
  // Em edição, calcular a prévia como o banco: produtos + maior mão de obra aplicável.
  const totalMaoObraItens = itens.reduce((acc, item) => acc + (item.valor_mao_obra || 0), 0);
  const maoDeObraReal = Math.max(valorMaoObra, totalMaoObraItens, 0);
  const totalCalculado = totalProdutos + maoDeObraReal;
  const valorTotalOS = totalCalculado > 0 ? totalCalculado : valorServico;
  const temMaoDeObra = maoDeObraReal > 0;

  // Custo total: soma do custo de cada item (vinculado ou livre).
  // Para itens vinculados ao estoque, prioriza custo do estoque (mais atualizado).
  // Para itens livres, usa o custo informado pelo usuário.
  const custoItens = itens.reduce((acc, item) => {
    const custoUnit = item.estoque_id
      ? (item.estoque?.custo_unitario ?? item.custo_unitario ?? 0)
      : (item.custo_unitario ?? 0);
    return acc + custoUnit * (item.quantidade || 0);
  }, 0);
  const custoTotalReal = custoItens > 0 ? custoItens : custoServico;

  const lucroConfiavel = !hasItensSemCusto;
  const descontoAplicado = Math.max(0, Math.min(desconto || 0, valorTotalOS));
  const totalACobrar = Math.max(valorTotalOS - descontoAplicado, 0);
  const lucroEstimado = totalACobrar - custoTotalReal;
  const margemLucro = lucroConfiavel && totalACobrar > 0 ? (lucroEstimado / totalACobrar) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-2", className)}
    >
      <Card className="border-accent/30 bg-gradient-to-br from-accent/5 to-accent/10">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-accent" />
              </div>
              <span className="font-semibold text-sm">Resumo Financeiro</span>
            </div>
            {lucroConfiavel && margemLucro > 0 && (
              <Badge variant="outline" className={cn(
                "text-xs",
                margemLucro >= 30 
                  ? "bg-success/10 text-success border-success/30" 
                  : margemLucro >= 15 
                    ? "bg-warning/10 text-warning border-warning/30"
                    : "bg-destructive/10 text-destructive border-destructive/30"
              )}>
                <TrendingUp className="w-3 h-3 mr-1" />
                {margemLucro.toFixed(0)}% margem
              </Badge>
            )}
            {hasItensSemCusto && (
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                ⚠️ Custo incompleto
              </Badge>
            )}
          </div>

          {/* Breakdown */}
          <div className="space-y-2 text-sm">
            {temMaoDeObra && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Mão de Obra</span>
                </div>
                <span className="font-medium">
                  {formatCurrency(maoDeObraReal)}
                </span>
              </div>
            )}

            {temItens && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  <span>Peças/Itens ({itens.length})</span>
                </div>
                <span className="font-medium">
                  {formatCurrency(totalProdutos)}
                </span>
              </div>
            )}

            {custoTotalReal > 0 && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Custo total</span>
                <span className="text-xs">
                  - {formatCurrency(custoTotalReal)}
                </span>
              </div>
            )}
          </div>

          {/* Total Destacado */}
          <div className="mt-3 pt-3 border-t border-accent/20">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">TOTAL DA OS</span>
              <span className={cn("text-xl font-bold", descontoAplicado > 0 ? "text-muted-foreground line-through" : "text-accent")}>
                {formatCurrency(valorTotalOS)}
              </span>
            </div>

            {descontoAplicado > 0 && (
              <>
                <div className="flex justify-between items-center mt-1 text-sm text-success font-semibold">
                  <span>− Desconto{descontoMotivo ? ` (${descontoMotivo})` : ""}</span>
                  <span>{formatCurrency(descontoAplicado)}</span>
                </div>
                <div className="flex justify-between items-center mt-1 pt-1 border-t border-success/20">
                  <span className="font-bold text-foreground">Total a cobrar</span>
                  <span className="text-xl font-black text-success">{formatCurrency(totalACobrar)}</span>
                </div>
              </>
            )}
            
            {/* Lucro estimado */}
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                {hasItensSemCusto ? "⚠️ Lucro incompleto" : "Lucro estimado"}
              </span>
              {lucroConfiavel ? (
                <span className={cn(
                  "text-sm font-semibold",
                  lucroEstimado >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(lucroEstimado)}
                </span>
              ) : (
                <span className="text-sm font-semibold text-warning">---</span>
              )}
            </div>
          </div>

          {/* Warning for zero-cost items */}
          {hasItensSemCusto && (
            <div className="mt-3 p-2.5 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-xs font-semibold text-warning">
                ⚠️ Lucro não pode ser calculado
              </p>
              <p className="text-[11px] text-warning/80 mt-0.5">
                {itensSemCusto.length} item(ns) não têm custo de compra cadastrado: {itensSemCusto.map(i => i.nome_item).join(", ")}. Cadastre o custo no Estoque.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
