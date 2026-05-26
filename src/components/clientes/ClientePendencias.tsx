import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, RotateCcw, Clock, Wrench, Car } from "lucide-react";

interface ClientePendenciasProps {
  clienteId: string;
}

interface PendingOS {
  id: string;
  tipo_servico: string;
  status: string;
  data_servico: string;
  veiculo_id: string;
  observacoes: string | null;
}

interface ProximaRecorrencia {
  tipo_servico: string;
  proxima_execucao: string | null;
  ultima_execucao: string | null;
  veiculo?: { marca: string; modelo: string; placa: string | null };
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_diagnostico: "Diagnóstico",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguard. peça",
};

export function ClientePendencias({ clienteId }: ClientePendenciasProps) {
  const { oficinaAtual } = useOficina();

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-pendencias", clienteId, oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return { pendentes: [], recorrencias: [] };

      // OS not finalized/canceled
      const { data: pendentes } = await supabase
        .from("ordens_servico")
        .select("id, tipo_servico, status, data_servico, veiculo_id, observacoes")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "em_diagnostico", "em_andamento", "aguardando_peca"])
        .order("data_servico", { ascending: true });

      // Vehicle IDs for recorrencias
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id, marca, modelo, placa")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id);

      let recorrencias: ProximaRecorrencia[] = [];
      if (veiculos && veiculos.length > 0) {
        const { data: recs } = await supabase
          .from("recorrencias")
          .select("tipo_servico, proxima_execucao, ultima_execucao, veiculo_id")
          .in("veiculo_id", veiculos.map(v => v.id))
          .eq("ativo", true)
          .order("proxima_execucao", { ascending: true })
          .limit(5);

        if (recs) {
          const veiculoMap = new Map(veiculos.map(v => [v.id, v]));
          recorrencias = recs.map(r => ({
            ...r,
            veiculo: veiculoMap.get((r as any).veiculo_id) || undefined,
          }));
        }
      }

      return {
        pendentes: (pendentes || []) as PendingOS[],
        recorrencias,
      };
    },
    enabled: !!oficinaAtual && !!clienteId,
    staleTime: 30_000,
  });

  if (isLoading || !data) return null;

  const { pendentes, recorrencias } = data;
  const hasPendentes = pendentes.length > 0;
  const hasRecorrencias = recorrencias.length > 0;

  if (!hasPendentes && !hasRecorrencias) return null;

  const hoje = new Date();

  return (
    <div className="space-y-3">
      {/* Pending OS */}
      {hasPendentes && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            Pendências ({pendentes.length})
          </h4>
          <div className="space-y-1">
            {pendentes.map(os => {
              const diasAberto = Math.floor((hoje.getTime() - new Date(os.data_servico).getTime()) / 86400000);
              return (
                <div key={os.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
                  <Wrench className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{os.tipo_servico}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {statusLabels[os.status] || os.status} · {diasAberto > 0 ? `há ${diasAberto}d` : "hoje"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming recurrences */}
      {hasRecorrencias && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wide">
            <RotateCcw className="w-3.5 h-3.5" />
            Manutenções recorrentes
          </h4>
          <div className="space-y-1">
            {recorrencias.map((rec, i) => {
              const isVencida = rec.proxima_execucao && new Date(rec.proxima_execucao) < hoje;
              const diasAte = rec.proxima_execucao
                ? Math.ceil((new Date(rec.proxima_execucao).getTime() - hoje.getTime()) / 86400000)
                : null;

              return (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border ${isVencida ? "bg-destructive/5 border-destructive/15" : "bg-blue-500/5 border-blue-500/15"}`}>
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${isVencida ? "text-destructive" : "text-blue-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{rec.tipo_servico}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {rec.veiculo && (
                        <span className="flex items-center gap-0.5">
                          <Car className="w-2.5 h-2.5" />
                          {rec.veiculo.placa || `${rec.veiculo.marca} ${rec.veiculo.modelo}`}
                          {" · "}
                        </span>
                      )}
                      {isVencida ? (
                        <span className="text-destructive font-medium">Vencida há {Math.abs(diasAte!)}d</span>
                      ) : diasAte !== null ? (
                        <span>em {diasAte}d — {format(new Date(rec.proxima_execucao!), "dd/MM", { locale: ptBR })}</span>
                      ) : (
                        <span>Sem data definida</span>
                      )}
                    </p>
                    {rec.ultima_execucao && (
                      <p className="text-[10px] text-muted-foreground/70">
                        Última: {format(new Date(rec.ultima_execucao), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
