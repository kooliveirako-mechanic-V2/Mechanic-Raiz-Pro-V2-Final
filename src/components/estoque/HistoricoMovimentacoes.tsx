import { useMovimentacoesEstoque, MovimentacaoEstoque } from "@/hooks/useEstoque";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HistoricoMovimentacoesProps {
  estoqueId: string;
}

const tipoConfig = {
  entrada: {
    icon: ArrowUpCircle,
    label: "Entrada",
    color: "text-success",
    bg: "bg-success/10",
  },
  saida: {
    icon: ArrowDownCircle,
    label: "Saída",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  ajuste: {
    icon: RefreshCw,
    label: "Ajuste",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
};

const referenciaLabels: Record<string, string> = {
  manual: "Ajuste Manual",
  ordem_servico: "Ordem de Serviço",
  orcamento: "Orçamento",
  compra: "Compra",
};

export function HistoricoMovimentacoes({ estoqueId }: HistoricoMovimentacoesProps) {
  const { movimentacoes, isLoading } = useMovimentacoesEstoque(estoqueId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (movimentacoes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhuma movimentação registrada</p>
        <p className="text-xs mt-1">As movimentações aparecerão aqui quando você alterar a quantidade</p>
      </div>
    );
  }

  return (
    <div className="h-[250px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
      <div className="space-y-2 pr-3">
        {movimentacoes.map((mov) => {
          const config = tipoConfig[mov.tipo];
          const Icon = config.icon;
          const referencia = mov.referencia_tipo ? referenciaLabels[mov.referencia_tipo] || mov.referencia_tipo : null;

          return (
            <div
              key={mov.id}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
            >
              <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${config.color}`}>
                    {mov.tipo === "entrada" ? "+" : mov.tipo === "saida" ? "-" : ""}
                    {mov.quantidade} unid.
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {config.label}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>
                    {mov.quantidade_anterior} → {mov.quantidade_nova}
                  </span>
                  {referencia && (
                    <>
                      <span>•</span>
                      <span>{referencia}</span>
                    </>
                  )}
                </div>
                
                {mov.motivo && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {mov.motivo}
                  </p>
                )}
              </div>
              
              <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                <div>{format(new Date(mov.created_at), "dd/MM/yy", { locale: ptBR })}</div>
                <div>{format(new Date(mov.created_at), "HH:mm")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}