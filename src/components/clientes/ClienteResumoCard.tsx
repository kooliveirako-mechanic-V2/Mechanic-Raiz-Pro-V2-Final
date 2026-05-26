import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Wrench, DollarSign, Car, Clock, AlertTriangle, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ClienteResumoCardProps {
  clienteId: string;
}

export function ClienteResumoCard({ clienteId }: ClienteResumoCardProps) {
  const { oficinaAtual } = useOficina();

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-resumo", clienteId, oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      // Fetch all OS for this client in one query
      const { data: ordens, error } = await supabase
        .from("ordens_servico")
        .select("id, tipo_servico, status, valor_servico, data_servico, observacoes_conclusao")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id)
        .order("data_servico", { ascending: false });

      if (error) throw error;

      // Fetch vehicles count
      const { count: veiculosCount } = await supabase
        .from("veiculos")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id);

      // Fetch recorrencias proximas
      const { data: veiculosIds } = await supabase
        .from("veiculos")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id);

      let proximaManutencao: string | null = null;
      let proximaManutencaoTipo: string | null = null;
      if (veiculosIds && veiculosIds.length > 0) {
        const { data: recorrencias } = await supabase
          .from("recorrencias")
          .select("tipo_servico, proxima_execucao")
          .in("veiculo_id", veiculosIds.map(v => v.id))
          .eq("ativo", true)
          .not("proxima_execucao", "is", null)
          .order("proxima_execucao", { ascending: true })
          .limit(1);

        if (recorrencias && recorrencias.length > 0) {
          proximaManutencao = recorrencias[0].proxima_execucao;
          proximaManutencaoTipo = recorrencias[0].tipo_servico;
        }
      }

      const finalizadas = (ordens || []).filter(o => o.status === "finalizado");
      const totalGasto = finalizadas.reduce((acc, o) => acc + (o.valor_servico || 0), 0);
      const ticketMedio = finalizadas.length > 0 ? totalGasto / finalizadas.length : 0;
      const ultimaVisita = ordens && ordens.length > 0 ? ordens[0].data_servico : null;
      const ultimoServico = ordens && ordens.length > 0 ? ordens[0].tipo_servico : null;

      // Pending OS (not finalized, not canceled)
      const pendentes = (ordens || []).filter(o => 
        !["finalizado", "cancelado"].includes(o.status)
      );

      // Client since (oldest OS date or null)
      const primeiraOS = ordens && ordens.length > 0 ? ordens[ordens.length - 1].data_servico : null;

      return {
        totalOS: ordens?.length || 0,
        totalFinalizadas: finalizadas.length,
        totalGasto,
        ticketMedio,
        veiculosCount: veiculosCount || 0,
        ultimaVisita,
        ultimoServico,
        pendentes: pendentes.length,
        clienteDesde: primeiraOS,
        proximaManutencao,
        proximaManutencaoTipo,
      };
    },
    enabled: !!oficinaAtual && !!clienteId,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/30 rounded-lg" />
        ))}
      </div>
    );
  }


  const diasDesdeUltimaVisita = data.ultimaVisita
    ? Math.floor((Date.now() - new Date(data.ultimaVisita).getTime()) / 86400000)
    : null;

  return (
    <div className="space-y-3">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricItem
          icon={Wrench}
          label="Serviços"
          value={String(data.totalFinalizadas)}
          sub={data.totalOS > data.totalFinalizadas ? `${data.totalOS} total` : undefined}
        />
        <MetricItem
          icon={DollarSign}
          label="Total gasto"
          value={formatCurrency(data.totalGasto)}
          sub={data.ticketMedio > 0 ? `Ticket ${formatCurrency(data.ticketMedio)}` : undefined}
          highlight
        />
        <MetricItem
          icon={Car}
          label="Veículos"
          value={String(data.veiculosCount)}
        />
        <MetricItem
          icon={Calendar}
          label="Última visita"
          value={diasDesdeUltimaVisita !== null ? `${diasDesdeUltimaVisita}d atrás` : "—"}
          sub={data.ultimoServico || undefined}
        />
      </div>

      {/* Contextual alerts */}
      <div className="flex flex-wrap gap-2">
        {data.clienteDesde && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            Cliente desde {format(new Date(data.clienteDesde), "MMM/yyyy", { locale: ptBR })}
          </span>
        )}
        {data.pendentes > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-md">
            <AlertTriangle className="w-3 h-3" />
            {data.pendentes} OS {data.pendentes === 1 ? "pendente" : "pendentes"}
          </span>
        )}
        {data.proximaManutencao && (
          <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
            <RotateCcw className="w-3 h-3" />
            Próx: {data.proximaManutencaoTipo} em {format(new Date(data.proximaManutencao), "dd/MM", { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricItem({ icon: Icon, label, value, sub, highlight }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2.5 border ${highlight ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/50"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}
