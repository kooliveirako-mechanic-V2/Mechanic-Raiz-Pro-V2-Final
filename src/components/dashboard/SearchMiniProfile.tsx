import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Car, Wrench, Clock, Plus, ChevronRight, History, Edit2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVeiculos } from "@/hooks/useVeiculos";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";

interface MiniProfileProps {
  clienteId: string;
  clienteNome: string;
  clienteTelefone?: string | null;
  onClose: () => void;
  compact?: boolean;
}

interface UltimaOS {
  id: string;
  numero: number | null;
  tipo_servico: string;
  status: string;
  valor_servico: number;
  data_servico: string;
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_diagnostico: "Diagnóstico",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguard. peça",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning/15 text-warning",
  em_diagnostico: "bg-accent/15 text-accent",
  em_andamento: "bg-primary/15 text-primary",
  aguardando_peca: "bg-highlight/15 text-highlight",
  finalizado: "bg-success/15 text-success",
  cancelado: "bg-destructive/15 text-destructive",
};

export function SearchMiniProfile({ clienteId, clienteNome, clienteTelefone, onClose, compact }: MiniProfileProps) {
  const navigate = useNavigate();
  const { veiculos } = useVeiculos();
  const [ultimaOS, setUltimaOS] = useState<UltimaOS | null>(null);
  const [totalOS, setTotalOS] = useState(0);
  const [loading, setLoading] = useState(true);

  const veiculosCliente = veiculos.filter(v => v.cliente_id === clienteId);

  const [pendentes, setPendentes] = useState(0);
  const [diasDesdeUltima, setDiasDesdeUltima] = useState<number | null>(null);

  useEffect(() => {
    async function fetchOS() {
      try {
        const { data, count } = await supabase
          .from("ordens_servico")
          .select("id, numero, tipo_servico, status, valor_servico, data_servico", { count: "exact" })
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          setUltimaOS(data[0] as UltimaOS);
          const dias = Math.floor((Date.now() - new Date(data[0].data_servico).getTime()) / 86400000);
          setDiasDesdeUltima(dias);
        }
        setTotalOS(count || 0);

        // Count pending OS
        const { count: pendCount } = await supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId)
          .in("status", ["pendente", "em_diagnostico", "em_andamento", "aguardando_peca"]);
        setPendentes(pendCount || 0);
      } catch (err) {
        console.warn("Erro ao buscar OS do cliente:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOS();
  }, [clienteId]);

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clienteTelefone) return;
    const phone = clienteTelefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank");
  };

  const handleNovaOS = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/servicos", { state: { novaOS: true, clienteId } });
    onClose();
  };

  const handleVerHistorico = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/clientes", { state: { editClienteId: clienteId, tab: "historico" } });
    onClose();
  };

  const handleEditarCliente = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate("/clientes", { state: { editClienteId: clienteId } });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-3 pb-3 space-y-2.5">
        {/* Telefone + WhatsApp */}
        {clienteTelefone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground flex-1">{clienteTelefone}</span>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-medium active:scale-95 transition-transform"
            >
              <MessageCircle className="w-3 h-3" />
              WhatsApp
            </button>
          </div>
        )}

        {/* Veículos */}
        <div className="flex items-center gap-2">
          <Car className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            {veiculosCliente.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhum veículo</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {veiculosCliente.slice(0, 3).map(v => (
                  <span key={v.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-foreground">
                    {v.placa || `${v.marca} ${v.modelo}`}
                  </span>
                ))}
                {veiculosCliente.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{veiculosCliente.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Última OS */}
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
          {loading ? (
            <span className="text-xs text-muted-foreground">Carregando...</span>
          ) : ultimaOS ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-foreground truncate">
                {ultimaOS.tipo_servico}
              </span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", statusColors[ultimaOS.status] || "bg-muted text-muted-foreground")}>
                {statusLabels[ultimaOS.status] || ultimaOS.status}
              </span>
              {ultimaOS.valor_servico > 0 && (
                <span className="text-[10px] text-success font-medium ml-auto">
                  {formatCurrency(ultimaOS.valor_servico)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Nenhuma OS registrada</span>
          )}
        </div>

        {/* Context: dias + pendências */}
        <div className="flex flex-wrap gap-1.5">
          {diasDesdeUltima !== null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {diasDesdeUltima === 0 ? "Hoje" : `${diasDesdeUltima}d atrás`}
            </span>
          )}
          {pendentes > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-medium">
              {pendentes} pendência{pendentes > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Total de serviços */}
        {totalOS > 0 && (
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{totalOS} serviço{totalOS > 1 ? "s" : ""} no total</span>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleNovaOS}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova OS
          </button>
          <button
            onClick={handleVerHistorico}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-medium active:scale-95 transition-transform"
          >
            <History className="w-3.5 h-3.5" />
            Histórico
          </button>
          <button
            onClick={handleEditarCliente}
            className="flex items-center justify-center px-2.5 py-2 rounded-lg bg-muted text-foreground active:scale-95 transition-transform"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
