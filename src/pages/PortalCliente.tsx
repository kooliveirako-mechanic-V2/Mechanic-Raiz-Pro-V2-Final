import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcSentinelaPublic } from "@/lib/sentinela";
import { motion, AnimatePresence } from "framer-motion";
import { format, isPast, isFuture, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Car, 
  Bike, 
  Wrench, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Phone,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  Shield,
  Gauge,
  Bell,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

interface ServicoHistorico {
  id: string;
  tipo_servico: string;
  descricao: string;
  data_servico: string;
  status: string;
  valor_servico: number;
  tem_garantia: boolean;
  dias_garantia: number;
  data_conclusao: string | null;
}

interface Recorrencia {
  id: string;
  tipo_servico: string;
  proxima_execucao: string;
  intervalo_dias: number | null;
  intervalo_km: number | null;
}

interface Veiculo {
  id: string;
  marca: string;
  modelo: string;
  placa: string;
  ano: number | null;
  tipo: string;
  km_atual: number | null;
  servicos: ServicoHistorico[];
  recorrencias: Recorrencia[];
}

interface ItemOrcamento {
  nome_item: string;
  tipo: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface Orcamento {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: string;
  valor_total: number;
  desconto: number;
  validade: string | null;
  created_at: string;
  veiculo: { marca: string; modelo: string; placa: string } | null;
  itens: ItemOrcamento[];
}

interface PortalData {
  cliente: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  };
  oficina: {
    nome: string;
    logo_url: string | null;
    telefone: string | null;
    endereco: string | null;
  };
  veiculos: Veiculo[];
  orcamentos: Orcamento[];
}

export default function PortalCliente() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVehicles, setExpandedVehicles] = useState<Set<string>>(new Set());
  const [updatingOrcamento, setUpdatingOrcamento] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortalData() {
      if (!token) {
        setError("Link inválido");
        setLoading(false);
        return;
      }

      try {
        const { data: result, error: fetchError } = await supabase
          .rpc('get_client_portal_data', { p_token: token });

        if (fetchError) {
          console.error("[PortalCliente] Erro RPC:", fetchError);
          // Fallback via Select - portal_token não é uma coluna padrão, mas geralmente temos uuid de cliente ou similar
          // Aqui dependemos do RPC pois o token é gerado, mas vamos pelo menos melhorar o erro
          throw fetchError;
        }

        if (!result) {
          setError("Portal não encontrado. Verifique se o link está correto.");
          setLoading(false);
          return;
        }

        const portalData = result as unknown as PortalData;
        setData(portalData);
        
        // Auto-expand first vehicle if exists
        if (portalData.veiculos?.length > 0) {
          setExpandedVehicles(new Set([portalData.veiculos[0].id]));
        }
      } catch (err: any) {
        console.error("Error fetching portal data:", err);
        setError(`Erro ao carregar dados: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    }

    fetchPortalData();
  }, [token]);

  const toggleVehicle = (vehicleId: string) => {
    setExpandedVehicles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vehicleId)) {
        newSet.delete(vehicleId);
      } else {
        newSet.add(vehicleId);
      }
      return newSet;
    });
  };

  const handleWhatsApp = () => {
    if (!data?.oficina.telefone) {
      toast.error("Telefone da oficina não disponível");
      return;
    }
    const phone = data.oficina.telefone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Olá! Sou ${data.cliente.nome}, cliente da ${data.oficina.nome}. Vim através do Portal do Cliente.`
    );
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const handleOrcamentoAction = async (orcamentoId: string, action: 'aprovar' | 'rejeitar') => {
    setUpdatingOrcamento(orcamentoId);
    try {
      // P0-4: Use SECURITY DEFINER RPC instead of direct table update
      // This bypasses RLS which blocks unauthenticated portal users
      const { data: rpcResult, error: rpcError } = await rpcSentinelaPublic('portal_update_orcamento_status', {
        p_token: token,
        p_orcamento_id: orcamentoId,
        p_action: action,
      });

      if (rpcError) throw rpcError;
      
      const result = rpcResult as { success: boolean; error?: string; new_status?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao atualizar orçamento');
      }
      
      const newStatus = result.new_status!;

      // Update local state
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          orcamentos: prev.orcamentos.map(orc => 
            orc.id === orcamentoId ? { ...orc, status: newStatus } : orc
          )
        };
      });

      toast.success(action === 'aprovar' ? 'Orçamento aprovado!' : 'Orçamento rejeitado');
    } catch (err) {
      console.error("Error updating orcamento:", err);
      toast.error("Erro ao atualizar orçamento");
    } finally {
      setUpdatingOrcamento(null);
    }
  };

  // CAUSA RAIZ: Usar helper centralizado ao invés de definição local duplicada

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string; icon: typeof Clock }> = {
      pendente: { label: "Pendente", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
      em_andamento: { label: "Em Andamento", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Wrench },
      finalizado: { label: "Finalizado", className: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
      cancelado: { label: "Cancelado", className: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertTriangle },
    };
    return configs[status] || configs.pendente;
  };

  const getOrcamentoStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      rascunho: { label: "Rascunho", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
      enviado: { label: "Aguardando", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      aprovado: { label: "Aprovado", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      rejeitado: { label: "Rejeitado", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      expirado: { label: "Expirado", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    };
    return configs[status] || configs.rascunho;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando seu portal...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Portal Não Encontrado</h1>
            <p className="text-muted-foreground">
              {error || "Não foi possível carregar os dados do portal."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingOrcamentos = data.orcamentos.filter(o => o.status === 'enviado');
  const upcomingMaintenance = data.veiculos.flatMap(v => 
    v.recorrencias.filter(r => r.proxima_execucao && isFuture(new Date(r.proxima_execucao)))
      .map(r => ({ ...r, veiculo: v }))
  ).sort((a, b) => new Date(a.proxima_execucao).getTime() - new Date(b.proxima_execucao).getTime());

  const overdueMaintenance = data.veiculos.flatMap(v => 
    v.recorrencias.filter(r => r.proxima_execucao && isPast(new Date(r.proxima_execucao)))
      .map(r => ({ ...r, veiculo: v }))
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header with workshop branding */}
      <header className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {data.oficina.logo_url ? (
              <img 
                src={data.oficina.logo_url} 
                alt={data.oficina.nome}
                className="h-16 w-16 rounded-xl object-cover border border-border/50"
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary/20 flex items-center justify-center">
                <Wrench className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold">{data.oficina.nome}</h1>
              {data.oficina.endereco && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {data.oficina.endereco}
                </p>
              )}
            </div>
            {data.oficina.telefone && (
              <Button onClick={handleWhatsApp} className="bg-green-600 hover:bg-green-700">
                <Phone className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Welcome section */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-2xl font-bold">Olá, {data.cliente.nome.split(' ')[0]}! 👋</h2>
          <p className="text-muted-foreground">
            Bem-vindo ao seu portal. Aqui você pode acompanhar seus veículos e serviços.
          </p>
        </motion.div>

        {/* Alerts section */}
        <AnimatePresence>
          {(pendingOrcamentos.length > 0 || overdueMaintenance.length > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 space-y-3"
            >
              {pendingOrcamentos.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-500">
                      {pendingOrcamentos.length} orçamento{pendingOrcamentos.length > 1 ? 's' : ''} aguardando sua aprovação
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Veja abaixo e aprove ou rejeite
                    </p>
                  </div>
                </div>
              )}

              {overdueMaintenance.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-red-500">
                      {overdueMaintenance.length} manutenção{overdueMaintenance.length > 1 ? 'ões' : ''} atrasada{overdueMaintenance.length > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato para agendar
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleWhatsApp}>
                    Agendar
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending quotes section */}
        {pendingOrcamentos.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-500" />
              Orçamentos Pendentes
            </h3>
            <div className="space-y-4">
              {pendingOrcamentos.map((orcamento) => (
                <Card key={orcamento.id} className="border-yellow-500/30 bg-yellow-500/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          #{orcamento.numero} - {orcamento.titulo}
                        </CardTitle>
                        {orcamento.veiculo && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {orcamento.veiculo.marca} {orcamento.veiculo.modelo} • {orcamento.veiculo.placa}
                          </p>
                        )}
                      </div>
                      <Badge className={getOrcamentoStatusConfig(orcamento.status).className}>
                        {getOrcamentoStatusConfig(orcamento.status).label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {orcamento.descricao && (
                      <p className="text-sm text-muted-foreground mb-4">{orcamento.descricao}</p>
                    )}
                    
                    {/* Items list */}
                    <div className="space-y-2 mb-4">
                      {orcamento.itens.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm py-1 border-b border-border/30 last:border-0">
                          <span>
                            {item.quantidade}x {item.nome_item}
                            <Badge variant="outline" className="ml-2 text-xs">
                              {item.tipo === 'servico' ? 'Serviço' : 'Produto'}
                            </Badge>
                          </span>
                          <span className="font-medium">{formatCurrency(item.valor_total)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-4" />

                    <div className="flex items-center justify-between">
                      <div>
                        {orcamento.desconto > 0 && (
                          <p className="text-sm text-green-500">
                            Desconto: -{formatCurrency(orcamento.desconto)}
                          </p>
                        )}
                        <p className="text-xl font-bold text-primary">
                          Total: {formatCurrency(orcamento.valor_total - (orcamento.desconto || 0))}
                        </p>
                        {orcamento.validade && (
                          <p className="text-xs text-muted-foreground">
                            Válido até {format(new Date(orcamento.validade), "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOrcamentoAction(orcamento.id, 'rejeitar')}
                          disabled={updatingOrcamento === orcamento.id}
                          className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                        >
                          {updatingOrcamento === orcamento.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              Rejeitar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOrcamentoAction(orcamento.id, 'aprovar')}
                          disabled={updatingOrcamento === orcamento.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {updatingOrcamento === orcamento.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              Aprovar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {/* Upcoming maintenance section */}
        {upcomingMaintenance.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Próximas Manutenções
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {upcomingMaintenance.slice(0, 4).map((item) => {
                const daysUntil = differenceInDays(new Date(item.proxima_execucao), new Date());
                const isUrgent = daysUntil <= 7;
                
                return (
                  <Card 
                    key={item.id} 
                    className={isUrgent ? "border-orange-500/30 bg-orange-500/5" : ""}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isUrgent ? 'bg-orange-500/20' : 'bg-primary/20'}`}>
                          <Calendar className={`h-4 w-4 ${isUrgent ? 'text-orange-500' : 'text-primary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.tipo_servico}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.veiculo.marca} {item.veiculo.modelo} • {item.veiculo.placa}
                          </p>
                          <p className={`text-sm mt-1 ${isUrgent ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
                            {daysUntil === 0 ? 'Hoje!' : 
                             daysUntil === 1 ? 'Amanhã' : 
                             `Em ${daysUntil} dias`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Vehicles section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Meus Veículos ({data.veiculos.length})
          </h3>
          
          {data.veiculos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Car className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.veiculos.map((veiculo) => {
                const isExpanded = expandedVehicles.has(veiculo.id);
                const VehicleIcon = veiculo.tipo === 'moto' ? Bike : Car;
                const servicosFinalizados = veiculo.servicos.filter(s => s.status === 'finalizado');
                
                return (
                  <Card key={veiculo.id} className="overflow-hidden">
                    <button
                      onClick={() => toggleVehicle(veiculo.id)}
                      className="w-full text-left"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${veiculo.tipo === 'moto' ? 'bg-orange-500/20' : 'bg-primary/20'}`}>
                            <VehicleIcon className={`h-6 w-6 ${veiculo.tipo === 'moto' ? 'text-orange-500' : 'text-primary'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg">
                              {veiculo.marca} {veiculo.modelo}
                            </CardTitle>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted font-mono text-sm font-bold tracking-wider">
                                {veiculo.placa}
                              </span>
                              {veiculo.ano && (
                                <span className="text-sm text-muted-foreground">{veiculo.ano}</span>
                              )}
                              {veiculo.km_atual && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Gauge className="h-3 w-3" />
                                  {veiculo.km_atual.toLocaleString()} km
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="hidden sm:flex">
                              {servicosFinalizados.length} serviço{servicosFinalizados.length !== 1 ? 's' : ''}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CardContent className="pt-0">
                            <Separator className="mb-4" />
                            
                            {veiculo.servicos.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                Nenhum serviço realizado ainda.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-muted-foreground">
                                  Histórico de Serviços
                                </h4>
                                {veiculo.servicos.map((servico) => {
                                  const statusConfig = getStatusConfig(servico.status);
                                  const StatusIcon = statusConfig.icon;
                                  
                                  // Check if warranty is still valid
                                  const hasValidWarranty = servico.tem_garantia && 
                                    servico.data_conclusao && 
                                    differenceInDays(new Date(), new Date(servico.data_conclusao)) <= servico.dias_garantia;
                                  
                                  return (
                                    <div 
                                      key={servico.id} 
                                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                                    >
                                      <div className={`p-2 rounded-lg ${statusConfig.className}`}>
                                        <StatusIcon className="h-4 w-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <p className="font-medium">{servico.tipo_servico}</p>
                                            {servico.descricao && (
                                              <p className="text-sm text-muted-foreground line-clamp-2">
                                                {servico.descricao}
                                              </p>
                                            )}
                                          </div>
                                          <Badge className={statusConfig.className}>
                                            {statusConfig.label}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(servico.data_servico), "dd/MM/yyyy")}
                                          </span>
                                          {servico.valor_servico > 0 && (
                                            <span className="font-medium text-foreground">
                                              {formatCurrency(servico.valor_servico)}
                                            </span>
                                          )}
                                          {hasValidWarranty && (
                                            <Badge variant="outline" className="text-green-500 border-green-500/30">
                                              <Shield className="h-3 w-3 mr-1" />
                                              Garantia ativa
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* All quotes section */}
        {data.orcamentos.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Todos os Orçamentos ({data.orcamentos.length})
            </h3>
            <div className="space-y-3">
              {data.orcamentos.filter(o => o.status !== 'enviado').map((orcamento) => (
                <Card key={orcamento.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">#{orcamento.numero} - {orcamento.titulo}</p>
                        {orcamento.veiculo && (
                          <p className="text-sm text-muted-foreground">
                            {orcamento.veiculo.marca} {orcamento.veiculo.modelo}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(orcamento.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={getOrcamentoStatusConfig(orcamento.status).className}>
                          {getOrcamentoStatusConfig(orcamento.status).label}
                        </Badge>
                        <p className="font-bold mt-1">
                          {formatCurrency(orcamento.valor_total - (orcamento.desconto || 0))}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>
        )}

        {/* Footer */}
        <footer className="mt-12 py-6 text-center text-sm text-muted-foreground border-t border-border/50">
          <p>Portal do Cliente • {data.oficina.nome}</p>
          <p className="mt-1">Powered by Mechanic Raiz Pro</p>
        </footer>
      </div>
    </div>
  );
}