import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { ChevronRight, Clock, Wrench, Pencil, CheckCircle } from "lucide-react";
import { differenceInDays, differenceInHours, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const statusLabels: Record<string, { label: string; className: string }> = {
  pendente: { label: "Aguardando", className: "bg-warning/15 text-warning" },
  em_diagnostico: { label: "Diagnóstico", className: "bg-accent/15 text-accent" },
  em_andamento: { label: "Em andamento", className: "bg-info/15 text-info" },
  aguardando_peca: { label: "Aguard. peça", className: "bg-destructive/15 text-destructive" },
};

export function MobileActiveOSList() {
  const navigate = useNavigate();
  const { oficinaAtual } = useOficina();

  const { data: osAbertas = [], isLoading } = useQuery({
    queryKey: ["mobile-active-os", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          id, numero, tipo_servico, data_servico, created_at, status,
          clientes(nome),
          veiculos(placa, marca, modelo)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "em_andamento", "em_diagnostico", "aguardando_peca"])
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!oficinaAtual,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-32" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }

  if (osAbertas.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          OS em andamento
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/servicos")}
          className="text-[11px] text-muted-foreground h-6 px-1.5"
        >
          Ver todas <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </div>

      <div className="space-y-1">
        {osAbertas.map((os) => {
          const dias = differenceInDays(new Date(), parseISO(os.created_at));
          const horas = differenceInHours(new Date(), parseISO(os.created_at));
          const tempoText = dias > 0 ? `${dias}d` : `${horas}h`;
          const isAtrasada = dias >= 3;
          const placa = (os.veiculos as any)?.placa || "";
          const modelo = (os.veiculos as any)?.modelo || "";
          const cliente = (os.clientes as any)?.nome || "Cliente";
          const statusInfo = statusLabels[os.status] || { label: os.status, className: "bg-muted text-muted-foreground" };

          return (
            <div
              key={os.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-card",
                isAtrasada && "border-destructive/30 bg-destructive/5"
              )}
            >
              {/* Placa */}
              <div className="shrink-0">
                {placa ? (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    {placa}
                  </span>
                ) : (
                  <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center">
                    <Wrench className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
              </div>

              {/* Info — compact single row feel */}
              <button
                onClick={() => navigate(`/servicos?os=${os.id}`)}
                className="flex-1 min-w-0 text-left active:opacity-80"
              >
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-foreground truncate">{cliente}</p>
                  <span className={cn("text-[9px] font-medium px-1 py-0.5 rounded-full shrink-0", statusInfo.className)}>
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {modelo} · {os.tipo_servico}
                  {os.numero ? ` · #${os.numero}` : ""}
                </p>
              </button>

              {/* Tempo */}
              <div className={cn(
                "flex items-center gap-0.5 text-[10px] font-semibold shrink-0",
                isAtrasada ? "text-destructive" : "text-muted-foreground"
              )}>
                <Clock className="w-2.5 h-2.5" />
                {tempoText}
              </div>

              {/* Ações explícitas */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => navigate(`/servicos?os=${os.id}`)}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-muted/60 hover:bg-muted active:scale-95 transition-all"
                  title="Editar"
                >
                  <Pencil className="w-3 h-3 text-foreground" />
                </button>
                <button
                  onClick={() => navigate(`/servicos?os=${os.id}`)}
                  className="w-7 h-7 rounded-md flex items-center justify-center bg-success/10 hover:bg-success/20 active:scale-95 transition-all"
                  title="Finalizar"
                >
                  <CheckCircle className="w-3 h-3 text-success" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
