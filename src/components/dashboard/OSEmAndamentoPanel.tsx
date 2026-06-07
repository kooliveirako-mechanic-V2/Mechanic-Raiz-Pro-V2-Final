import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { Wrench, ChevronRight, PartyPopper, Clock } from "lucide-react";
import { differenceInDays, differenceInHours, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function OSEmAndamentoPanel() {
  const navigate = useNavigate();
  const { oficinaAtual } = useOficina();

  const { data: osAbertas = [], isLoading } = useQuery({
    queryKey: ["os-em-andamento", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          id, tipo_servico, data_servico, created_at, status,
          clientes(nome),
          veiculos(placa, marca, modelo)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["aberto", "em_andamento", "aguardando_peca"])
        .order("created_at", { ascending: true })
        .limit(6);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!oficinaAtual,
    staleTime: 30_000,
  });

  const getTempoAberta = (createdAt: string) => {
    const dias = differenceInDays(new Date(), parseISO(createdAt));
    if (dias > 0) return `${dias}d`;
    const horas = differenceInHours(new Date(), parseISO(createdAt));
    return `${horas}h`;
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card border border-border/50 rounded-xl overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">OS em Andamento</h3>
          {osAbertas.length > 0 && (
            <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {osAbertas.length}
            </span>
          )}
        </div>
        {osAbertas.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/servicos")}
            className="text-xs text-muted-foreground hover:text-foreground h-7"
          >
            Ver todas <ChevronRight className="w-3 h-3 ml-0.5" />
          </Button>
        )}
      </div>

      {osAbertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <PartyPopper className="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum serviço em andamento 🎉
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {osAbertas.map((os, i) => {
            const dias = differenceInDays(new Date(), parseISO(os.created_at));
            const isAtrasada = dias >= 3;
            const placa = (os.veiculos as any)?.placa || "—";
            const cliente = (os.clientes as any)?.nome || "—";

            return (
              <button
                key={os.id}
                onClick={() => navigate(`/servicos?os=${os.id}`)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
                  "hover:bg-muted/40",
                  isAtrasada && "bg-destructive/5"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={cn(
                    "text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 uppercase",
                    "bg-muted text-muted-foreground"
                  )}>
                    {placa}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cliente}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{os.tipo_servico}</p>
                  </div>
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-[11px] font-semibold shrink-0 px-1.5 py-0.5 rounded",
                  isAtrasada
                    ? "text-destructive bg-destructive/10"
                    : "text-muted-foreground"
                )}>
                  <Clock className="w-3 h-3" />
                  {getTempoAberta(os.created_at)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
