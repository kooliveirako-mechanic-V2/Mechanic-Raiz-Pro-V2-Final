import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sparkles, Calendar, Wrench, AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  clienteId: string;
}

export function ClienteContextoAtendimento({ clienteId }: Props) {
  const { oficinaAtual } = useOficina();

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-contexto-atendimento", clienteId, oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return null;

      // Last finalized OS
      const { data: ultimaOS } = await supabase
        .from("ordens_servico")
        .select("tipo_servico, data_servico, valor_servico, observacoes_conclusao")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id)
        .eq("status", "finalizado")
        .order("data_servico", { ascending: false })
        .limit(1);

      // Pending OS count
      const { count: pendentesCount } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "em_diagnostico", "em_andamento", "aguardando_peca"]);

      // Next recurrence
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("oficina_id", oficinaAtual.id);

      let proximaRec: { tipo_servico: string; proxima_execucao: string } | null = null;
      if (veiculos && veiculos.length > 0) {
        const { data: recs } = await supabase
          .from("recorrencias")
          .select("tipo_servico, proxima_execucao")
          .in("veiculo_id", veiculos.map(v => v.id))
          .eq("ativo", true)
          .not("proxima_execucao", "is", null)
          .order("proxima_execucao", { ascending: true })
          .limit(1);
        if (recs && recs.length > 0) proximaRec = recs[0] as any;
      }

      const ultima = ultimaOS && ultimaOS.length > 0 ? ultimaOS[0] : null;
      const diasDesdeUltima = ultima
        ? Math.floor((Date.now() - new Date(ultima.data_servico).getTime()) / 86400000)
        : null;

      return {
        ultimoServico: ultima?.tipo_servico || null,
        diasDesdeUltima,
        pendentes: pendentesCount || 0,
        proximaManutencao: proximaRec?.tipo_servico || null,
        proximaData: proximaRec?.proxima_execucao || null,
      };
    },
    enabled: !!oficinaAtual && !!clienteId,
    staleTime: 30_000,
  });

  if (isLoading || !data) return null;

  const { ultimoServico, diasDesdeUltima, pendentes, proximaManutencao, proximaData } = data;

  // Don't show if there's nothing useful
  if (!ultimoServico && pendentes === 0 && !proximaManutencao) return null;

  const items: { icon: React.ElementType; text: string; className: string }[] = [];

  if (diasDesdeUltima !== null && ultimoServico) {
    items.push({
      icon: Calendar,
      text: `Última visita: ${diasDesdeUltima}d atrás — ${ultimoServico}`,
      className: "text-muted-foreground",
    });
  }

  if (pendentes > 0) {
    items.push({
      icon: AlertTriangle,
      text: `${pendentes} pendência${pendentes > 1 ? "s" : ""} aberta${pendentes > 1 ? "s" : ""}`,
      className: "text-yellow-600 dark:text-yellow-400",
    });
  }

  if (proximaManutencao && proximaData) {
    const isVencida = new Date(proximaData) < new Date();
    items.push({
      icon: RotateCcw,
      text: isVencida
        ? `${proximaManutencao} — vencida`
        : `Próx: ${proximaManutencao} em ${format(new Date(proximaData), "dd/MM", { locale: ptBR })}`,
      className: isVencida ? "text-destructive" : "text-blue-600 dark:text-blue-400",
    });
  }

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Contexto de Atendimento</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-2 ${item.className}`}>
          <item.icon className="w-3 h-3 shrink-0" />
          <span className="text-xs">{item.text}</span>
        </div>
      ))}
    </div>
  );
}
