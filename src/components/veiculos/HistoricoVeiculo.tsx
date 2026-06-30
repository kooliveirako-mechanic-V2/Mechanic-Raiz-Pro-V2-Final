import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveFotoUrl } from "@/lib/storage/fotos";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  Wrench, 
  DollarSign, 
  Package, 
  Calendar, 
  Gauge,
  ChevronDown,
  ChevronUp,
  Camera,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  Cpu,
  Battery
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useOficina } from "@/contexts/OficinaContext";

interface HistoricoVeiculoProps {
  veiculoId: string;
  veiculoInfo?: {
    marca: string;
    modelo: string;
    placa?: string;
  };
}

interface OrdemServicoHistorico {
  id: string;
  tipo_servico: string;
  descricao: string | null;
  data_servico: string;
  data_conclusao: string | null;
  status: string;
  valor_servico: number | null;
  custo_servico: number | null;
  km_no_servico: number | null;
  tem_garantia: boolean;
  dias_garantia: number | null;
  observacoes_conclusao: string | null;
  fotos_entrada: string[] | null;
  fotos_saida: string[] | null;
  // Campos Auto Elétrica (opcionais)
  codigo_obd?: string | null;
  codigos_obd_lista?: string[] | null;
  hipotese_diagnostico?: string | null;
  modulos_testados?: string[] | null;
  tempo_diagnostico_minutos?: number | null;
  checklist_voltagem_bateria?: string | null;
}

interface ItemOS {
  id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number | null;
  valor_total: number | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pendente: { label: "Aguardando", icon: Clock, className: "text-warning" },
  em_diagnostico: { label: "Em Diagnóstico", icon: Zap, className: "text-amber-500" },
  em_andamento: { label: "Em Andamento", icon: Wrench, className: "text-info" },
  aguardando_peca: { label: "Aguardando Peça", icon: Package, className: "text-orange-500" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, className: "text-success" },
  cancelado: { label: "Cancelado", icon: AlertCircle, className: "text-destructive" },
};

export function HistoricoVeiculo({ veiculoId, veiculoInfo }: HistoricoVeiculoProps) {
  const [expandedOS, setExpandedOS] = useState<string | null>(null);
  const { canViewCustos } = useUserRole();
  const { oficinaAtual } = useOficina();
  const isAutoEletrica = oficinaAtual?.tipo === "auto_eletrica";

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["historico-veiculo", veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("veiculo_id", veiculoId)
        .order("data_servico", { ascending: false });

      if (error) throw error;
      return data as OrdemServicoHistorico[];
    },
    enabled: !!veiculoId,
  });

  const { data: itensMap = {} } = useQuery({
    queryKey: ["itens-os-historico", veiculoId],
    queryFn: async () => {
      if (ordens.length === 0) return {};
      
      const osIds = ordens.map(o => o.id);
      const { data, error } = await supabase
        .from("itens_os")
        .select("*")
        .in("ordem_servico_id", osIds);

      if (error) throw error;
      
      // Group by ordem_servico_id
      const grouped: Record<string, ItemOS[]> = {};
      data?.forEach(item => {
        if (!grouped[item.ordem_servico_id]) {
          grouped[item.ordem_servico_id] = [];
        }
        grouped[item.ordem_servico_id].push(item);
      });
      return grouped;
    },
    enabled: ordens.length > 0,
  });

  // Calculate totals
  const totalGasto = ordens
    .filter(o => o.status === "finalizado")
    .reduce((acc, o) => acc + (o.valor_servico || 0), 0);

  const totalServicos = ordens.filter(o => o.status === "finalizado").length;
  
  const kmAtual = ordens.length > 0 
    ? Math.max(...ordens.filter(o => o.km_no_servico).map(o => o.km_no_servico || 0))
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <History className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            Histórico do Veículo
          </h3>
          {veiculoInfo && (
            <p className="text-xs text-muted-foreground">
              {veiculoInfo.marca} {veiculoInfo.modelo} {veiculoInfo.placa && `• ${veiculoInfo.placa}`}
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <Wrench className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-lg font-bold text-foreground">{totalServicos}</p>
          <p className="text-[10px] text-muted-foreground">Serviços</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <DollarSign className="w-4 h-4 mx-auto text-success mb-1" />
          <p className="text-lg font-bold text-foreground">
            {formatCurrency(totalGasto)}
          </p>
          <p className="text-[10px] text-muted-foreground">Total Gasto</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <Gauge className="w-4 h-4 mx-auto text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">
            {kmAtual > 0 ? kmAtual.toLocaleString("pt-BR") : "-"}
          </p>
          <p className="text-[10px] text-muted-foreground">Último KM</p>
        </div>
      </div>

      {/* Lista de serviços */}
      <div className="max-h-[400px] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
        {ordens.length === 0 ? (
          <div className="text-center py-8">
            <Wrench className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              Nenhum serviço registrado ainda
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ordens.map((ordem) => {
              const status = statusConfig[ordem.status] || statusConfig.pendente;
              const StatusIcon = status.icon;
              const isExpanded = expandedOS === ordem.id;
              const itens = itensMap[ordem.id] || [];
              const fotos = [...(ordem.fotos_entrada || []), ...(ordem.fotos_saida || [])];

              return (
                <div
                  key={ordem.id}
                  className="bg-card rounded-lg border border-border overflow-hidden"
                >
                  {/* Header - sempre visível */}
                  <button
                    type="button"
                    onClick={() => setExpandedOS(isExpanded ? null : ordem.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className={cn("flex-shrink-0", status.className)}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {ordem.tipo_servico}
                        </span>
                        {ordem.tem_garantia && (
                          <Badge variant="outline" className="text-[10px] h-4 bg-success/10 text-success border-success/30">
                            Garantia
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(ordem.data_servico), "dd/MM/yyyy", { locale: ptBR })}
                        {ordem.km_no_servico && (
                          <span className="flex items-center gap-1">
                            <Gauge className="w-3 h-3" />
                            {ordem.km_no_servico.toLocaleString("pt-BR")} km
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {ordem.valor_servico && (
                        <span className="font-semibold text-sm text-success">
                          {formatCurrency(ordem.valor_servico)}
                        </span>
                      )}
                      {fotos.length > 0 && (
                        <Camera className="w-4 h-4 text-muted-foreground" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Detalhes expandidos */}
                  {isExpanded && (
                    <div className="border-t border-border p-3 space-y-3 bg-muted/30">
                      {/* Descrição */}
                      {ordem.descricao && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                          <p className="text-sm">{ordem.descricao}</p>
                        </div>
                      )}

                      {/* Observações de conclusão */}
                      {ordem.observacoes_conclusao && (
                        <div>
                          <p className="text-xs font-medium text-success mb-1">
                            Observações da Conclusão
                          </p>
                          <p className="text-sm">{ordem.observacoes_conclusao}</p>
                        </div>
                      )}

                      {/* Itens/Peças */}
                      {itens.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Package className="w-3 h-3" /> Peças/Serviços
                          </p>
                          <div className="space-y-1">
                            {itens.map((item) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {item.quantidade}x {item.nome_item}
                                </span>
                                {item.valor_total && (
                                  <span className="font-medium">
                                    {formatCurrency(item.valor_total)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dados Elétricos - só para oficinas de auto elétrica */}
                      {isAutoEletrica && (ordem.codigo_obd || ordem.hipotese_diagnostico || ordem.codigos_obd_lista?.length || ordem.modulos_testados?.length || ordem.checklist_voltagem_bateria) && (
                        <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Histórico Elétrico
                          </p>
                          
                          {ordem.checklist_voltagem_bateria && (
                            <div className="flex items-center gap-2 text-sm">
                              <Battery className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Voltagem:</span>
                              <span className={cn(
                                "font-medium",
                                ordem.checklist_voltagem_bateria === "< 11V" ? "text-destructive" :
                                ordem.checklist_voltagem_bateria === "11-12V" ? "text-warning" : "text-success"
                              )}>
                                {ordem.checklist_voltagem_bateria}
                              </span>
                            </div>
                          )}
                          
                          {(ordem.codigo_obd || ordem.codigos_obd_lista?.length) && (
                            <div className="flex items-start gap-2 text-sm">
                              <Cpu className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                              <div>
                                <span className="text-muted-foreground">Códigos OBD: </span>
                                <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                                  {ordem.codigos_obd_lista?.length 
                                    ? ordem.codigos_obd_lista.join(", ")
                                    : ordem.codigo_obd}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {ordem.hipotese_diagnostico && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Hipótese: </span>
                              <span>{ordem.hipotese_diagnostico}</span>
                            </div>
                          )}
                          
                          {ordem.modulos_testados?.length > 0 && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Módulos testados: </span>
                              <span>{ordem.modulos_testados.join(", ")}</span>
                            </div>
                          )}
                          
                          {ordem.tempo_diagnostico_minutos && ordem.tempo_diagnostico_minutos > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">Tempo técnico:</span>
                              <span className="font-medium">{ordem.tempo_diagnostico_minutos} min</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Fotos */}
                      {fotos.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Fotos ({fotos.length})
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {fotos.map((foto, i) => (
                              <img
                                key={i}
                                src={resolveFotoUrl(foto)}
                                alt={`Foto ${i + 1}`}
                                className="w-full aspect-square object-cover rounded-md border border-border"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Valores - custo só para proprietário */}
                      <div className="flex justify-between pt-2 border-t border-border text-sm">
                        {canViewCustos && (
                          <div>
                            <span className="text-muted-foreground">Custo: </span>
                            <span>{formatCurrency(ordem.custo_servico || 0)}</span>
                          </div>
                        )}
                        <div className={!canViewCustos ? "ml-auto" : ""}>
                          <span className="text-muted-foreground">Valor: </span>
                          <span className="font-semibold text-success">
                            {formatCurrency(ordem.valor_servico || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
