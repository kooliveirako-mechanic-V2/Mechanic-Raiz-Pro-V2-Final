import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Car, Bike, Wrench, DollarSign, Clock, CheckCircle, AlertTriangle, FileText, Plus, Star, Package, Gauge } from "lucide-react";
import { formatCurrency as formatCurrencyBase } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClienteResumoCard } from "./ClienteResumoCard";
import { ClientePendencias } from "./ClientePendencias";
import { ClienteContextoAtendimento } from "./ClienteContextoAtendimento";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

interface ClienteHistoricoProps {
  clienteId: string;
  onNovaOS?: (clienteId: string, veiculoId?: string) => void;
  onNovoOrcamento?: (clienteId: string, veiculoId?: string) => void;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pendente: { label: "Pendente", icon: Clock, className: "bg-warning/10 text-warning border-warning/20" },
  em_andamento: { label: "Em andamento", icon: Wrench, className: "bg-info/10 text-info border-info/20" },
  finalizado: { label: "Finalizado", icon: CheckCircle, className: "bg-success/10 text-success border-success/20" },
  cancelado: { label: "Cancelado", icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  em_diagnostico: { label: "Diagnóstico", icon: Wrench, className: "bg-primary/10 text-primary border-primary/20" },
  aguardando_peca: { label: "Aguardando peça", icon: Clock, className: "bg-accent/10 text-accent border-accent/20" },
};

export function ClienteHistorico({ clienteId, onNovaOS, onNovoOrcamento }: ClienteHistoricoProps) {
  const { oficinaAtual } = useOficina();
  const [expandedOS, setExpandedOS] = useState<string | null>(null);

  const { data: ordensServico = [], isLoading: loadingOS } = useQuery({
    queryKey: ["cliente-historico-os", clienteId, oficinaAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, tipo_servico, descricao, data_servico, data_conclusao, status, valor_servico, km_no_servico, observacoes_conclusao, veiculo_id")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual!.id)
        .order("data_servico", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!oficinaAtual && !!clienteId,
  });

  // Fetch items for all OS in one batch
  const osIds = ordensServico.map(os => os.id);
  const { data: itensMap = {} } = useQuery({
    queryKey: ["cliente-historico-itens", clienteId, osIds.length],
    queryFn: async () => {
      if (osIds.length === 0) return {};
      const { data, error } = await supabase
        .from("itens_os")
        .select("ordem_servico_id, nome_item, quantidade, valor_unitario, valor_total")
        .in("ordem_servico_id", osIds);
      if (error) throw error;
      const grouped: Record<string, typeof data> = {};
      data?.forEach(item => {
        if (!grouped[item.ordem_servico_id]) grouped[item.ordem_servico_id] = [];
        grouped[item.ordem_servico_id].push(item);
      });
      return grouped;
    },
    enabled: osIds.length > 0,
  });

  const { data: veiculos = [], isLoading: loadingVeiculos } = useQuery({
    queryKey: ["cliente-historico-veiculos", clienteId, oficinaAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, tipo, marca, modelo, placa, ano, km_atual")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!oficinaAtual && !!clienteId,
  });

  const { data: orcamentos = [], isLoading: loadingOrc } = useQuery({
    queryKey: ["cliente-historico-orcamentos", clienteId, oficinaAtual?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, numero, titulo, status, valor_total, created_at")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!oficinaAtual && !!clienteId,
  });

  const isLoading = loadingOS || loadingVeiculos || loadingOrc;

  const formatCurrency = (value: number | null) => {
    if (!value) return "—";
    return formatCurrencyBase(value);
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const veiculoMap = new Map(veiculos.map(v => [v.id, v]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Clock className="w-4 h-4 mr-2 animate-spin" />
        Carregando histórico...
      </div>
    );
  }

  const isEmpty = ordensServico.length === 0 && orcamentos.length === 0;
  const osFinalizadas = ordensServico.filter(os => os.status === "finalizado").length;
  const isClienteFiel = osFinalizadas >= 5;
  const veiculoUnico = veiculos.length === 1 ? veiculos[0].id : undefined;

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex gap-2">
        {onNovaOS && (
          <Button onClick={() => onNovaOS(clienteId, veiculoUnico)} className="flex-1 h-10 text-sm font-semibold bg-accent hover:bg-accent/90">
            <Wrench className="w-4 h-4 mr-2" />
            Nova OS
          </Button>
        )}
        {onNovoOrcamento && (
          <Button variant="outline" onClick={() => onNovoOrcamento(clienteId, veiculoUnico)} className="flex-1 h-10 text-sm font-semibold">
            <FileText className="w-4 h-4 mr-2" />
            Orçamento
          </Button>
        )}
      </div>

      {/* Cliente Fiel Badge */}
      {isClienteFiel && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
          <Star className="w-4 h-4 text-accent fill-accent" />
          <span className="text-sm font-medium text-accent">Cliente Fiel — {osFinalizadas} serviços concluídos</span>
        </div>
      )}

      {isEmpty ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum histórico ainda</p>
          <p className="text-xs mt-1">Os serviços e orçamentos deste cliente aparecerão aqui.</p>
        </div>
      ) : (
        <>
          {/* Resumo Card */}
          <ClienteResumoCard clienteId={clienteId} />

          {/* Contexto de Atendimento */}
          <ClienteContextoAtendimento clienteId={clienteId} />

          {/* Pendências e Recorrências */}
          <ClientePendencias clienteId={clienteId} />

          <Separator className="opacity-30" />

          {/* Timeline de Serviços */}
          {ordensServico.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
                <Wrench className="w-3.5 h-3.5" />
                Histórico de Serviços ({ordensServico.length})
              </h4>
              <div className="space-y-1.5">
                {ordensServico.map((os) => {
                  const veiculo = veiculoMap.get(os.veiculo_id);
                  const statusInfo = statusConfig[os.status] || statusConfig.pendente;
                  const StatusIcon = statusInfo.icon;
                  const isExpanded = expandedOS === os.id;
                  const itens = itensMap[os.id] || [];

                  return (
                    <div key={os.id} className="rounded-lg border border-border/50 overflow-hidden bg-card">
                      {/* Header row - clickable */}
                      <button
                        type="button"
                        onClick={() => setExpandedOS(isExpanded ? null : os.id)}
                        className="w-full p-3 flex items-start justify-between gap-2 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {os.numero && (
                              <span className="text-[10px] text-muted-foreground font-mono">#{os.numero}</span>
                            )}
                            <p className="font-medium text-sm text-foreground truncate">{os.tipo_servico}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-muted-foreground">
                            <span>{formatDate(os.data_servico)}</span>
                            {veiculo && (
                              <span className="flex items-center gap-0.5">
                                {veiculo.tipo === "moto" ? <Bike className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                                {veiculo.placa || `${veiculo.marca} ${veiculo.modelo}`}
                              </span>
                            )}
                            {os.km_no_servico && os.km_no_servico > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Gauge className="w-3 h-3" />
                                {os.km_no_servico.toLocaleString("pt-BR")} km
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <Badge variant="outline" className={`text-[10px] h-5 ${statusInfo.className}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                          {(os.valor_servico || 0) > 0 && (
                            <span className="text-xs font-medium text-foreground">{formatCurrency(os.valor_servico)}</span>
                          )}
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-border/50 px-3 py-2.5 space-y-2 bg-muted/20">
                          {os.descricao && (
                            <p className="text-xs text-muted-foreground">{os.descricao}</p>
                          )}
                          {itens.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                                <Package className="w-3 h-3" /> Peças / Serviços
                              </p>
                              <div className="space-y-0.5">
                                {itens.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-muted-foreground truncate">{item.quantidade}x {item.nome_item}</span>
                                    {item.valor_total && <span className="font-medium shrink-0 ml-2">{formatCurrency(item.valor_total)}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {os.observacoes_conclusao && (
                            <div>
                              <p className="text-[10px] font-semibold text-success uppercase tracking-wide mb-0.5">Conclusão</p>
                              <p className="text-xs text-muted-foreground">{os.observacoes_conclusao}</p>
                            </div>
                          )}
                          {os.data_conclusao && (
                            <p className="text-[10px] text-muted-foreground">
                              Concluído em {formatDate(os.data_conclusao)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Orçamentos */}
          {orcamentos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5" />
                Orçamentos ({orcamentos.length})
              </h4>
              <div className="space-y-1.5">
                {orcamentos.map((orc) => (
                  <div key={orc.id} className="p-3 rounded-lg border border-border/50 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          #{orc.numero} — {orc.titulo}
                        </p>
                        <span className="text-[11px] text-muted-foreground">{formatDate(orc.created_at)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge variant="outline" className={`text-[10px] h-5 ${
                          orc.status === "aprovado" ? "bg-success/10 text-success border-success/20" :
                          orc.status === "rejeitado" ? "bg-destructive/10 text-destructive border-destructive/20" :
                          "bg-warning/10 text-warning border-warning/20"
                        }`}>
                          {orc.status === "aprovado" ? "Aprovado" : orc.status === "rejeitado" ? "Rejeitado" : orc.status === "enviado" ? "Enviado" : "Rascunho"}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">{formatCurrency(orc.valor_total)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
