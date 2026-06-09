import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, FileText, Calendar, DollarSign, Phone, Share2, Check, Clock, X, Package, Wrench, User, MapPin, Mail, MessageCircle, AlertCircle, ThumbsUp, ThumbsDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";

interface ItemOrcamento {
  id: string;
  nome_item: string;
  tipo: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface PublicOrcamento {
  id: string;
  numero: number;
  titulo: string;
  descricao: string | null;
  status: string;
  valor_total: number;
  custo_total: number;
  desconto: number;
  validade: string | null;
  observacoes: string | null;
  created_at: string;
  oficina: {
    nome: string;
    logo_url: string | null;
    telefone: string | null;
    endereco: string | null;
  };
  cliente: {
    nome: string;
    telefone: string | null;
    email: string | null;
  } | null;
  veiculo: {
    marca: string;
    modelo: string;
    placa: string | null;
    ano: number | null;
    tipo: string;
  } | null;
  itens: ItemOrcamento[];
}

const statusConfig: Record<string, { label: string; className: string; icon: any; description: string }> = {
  rascunho: { label: "Em Elaboração", className: "bg-muted text-muted-foreground", icon: FileText, description: "Este orçamento ainda está sendo preparado" },
  enviado: { label: "Aguardando sua Aprovação", className: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock, description: "Analise os detalhes e aprove para iniciarmos o serviço" },
  aprovado: { label: "✓ Aprovado", className: "bg-success/10 text-success border-success/20", icon: Check, description: "Orçamento aprovado! Entraremos em contato" },
  rejeitado: { label: "Recusado", className: "bg-destructive/10 text-destructive border-destructive/20", icon: X, description: "Orçamento não aprovado" },
  convertido: { label: "Em Execução", className: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: Wrench, description: "Serviço em andamento!" },
};

export default function OrcamentoPublico() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [orcamento, setOrcamento] = useState<PublicOrcamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // Detect if param is UUID or numeric
  const isUuid = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;
  const isNumeric = id ? /^\d+$/.test(id) : false;

  useEffect(() => {
    async function fetchOrcamento() {
      if (!id) {
        setError("ID do orçamento não fornecido");
        setLoading(false);
        return;
      }

      try {
        let data: any = null;
        let rpcError: any = null;

        if (isNumeric) {
          //Friendly URL: /orcamento/42
          const res = await supabase.rpc("get_public_orcamento_by_numero", { p_numero: parseInt(id, 10) });
          data = res.data;
          rpcError = res.error;
        } else if (isUuid) {
          // Legacy UUID URL
          const res = await supabase.rpc("get_public_orcamento", { orcamento_id: id });
          data = res.data;
          rpcError = res.error;
        } else {
          setError("Link inválido");
          setLoading(false);
          return;
        }

        if (!rpcError && data) {
          // Se for UUID mas tiver numero, redireciona para a URL amigável
          if (isUuid && (data as any).numero) {
            navigate(`/orcamento/${(data as any).numero}`, { replace: true });
            return;
          }
          setOrcamento(data as unknown as PublicOrcamento);
          setLoading(false);
          return;
        }

        // Fallback: SELECT direto (Blindagem contra falhas de RPC)
        console.log("[OrcamentoPublico] RPC falhou ou não retornou dados, tentando SELECT direto...");
        let query = supabase
          .from('orcamentos')
          .select(`
            id, numero, titulo, descricao, status, valor_total, custo_total, 
            desconto, validade, observacoes, created_at,
            oficina:oficinas(nome, logo_url, telefone, endereco),
            cliente:clientes(nome, telefone, email),
            veiculo:veiculos(marca, modelo, placa, ano, tipo),
            itens:itens_orcamento(id, nome_item, tipo, quantidade, valor_unitario, valor_total)
          `);

        if (isNumeric) {
          query = query.eq('numero', parseInt(id, 10));
        } else {
          query = query.eq('id', id);
        }

        const { data: directData, error: directError } = await query.maybeSingle();
        
        if (directData && !directError) {
          console.log("[OrcamentoPublico] Dados recuperados via Fallback Select");
          const fetchedOrcamento = directData as unknown as PublicOrcamento;
          // Redireciona para URL amigável se for UUID mas recuperamos o número
          if (isUuid && fetchedOrcamento.numero) {
            navigate(`/orcamento/${fetchedOrcamento.numero}`, { replace: true });
            return;
          }
          setOrcamento(fetchedOrcamento);
          setLoading(false);
          return;
        }

        if (rpcError) throw rpcError;
        if (directError) throw directError;
        
        setError("Orçamento não encontrado");
      } catch (err: any) {
        console.error("Error fetching orcamento:", err);
        setError(`Erro ao carregar orçamento: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    }

    fetchOrcamento();
  }, [id, isUuid, isNumeric, navigate]);

  // Realtime: subscribe to orcamento changes
  useEffect(() => {
    if (!orcamento?.id) return;

    const channel = supabase
      .channel(`orcamento-public-${orcamento.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orcamentos',
          filter: `id=eq.${orcamento.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated) {
            // Re-fetch full data via RPC to get joined relations
            const fetchFn = isNumeric
              ? supabase.rpc("get_public_orcamento_by_numero", { p_numero: parseInt(id!, 10) })
              : supabase.rpc("get_public_orcamento", { orcamento_id: orcamento.id });
            fetchFn.then(({ data }) => {
              if (data) {
                const newData = data as unknown as PublicOrcamento;
                setOrcamento(newData);
                if (newData.status === "aprovado") {
                  setApproved(true);
                }
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orcamento?.id, id, isNumeric]);

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Orçamento #${orcamento?.numero} - ${orcamento?.oficina.nome}`,
          text: `Confira o orçamento para seu veículo`,
          url,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const handleWhatsAppContact = () => {
    if (orcamento?.oficina.telefone) {
      const phone = orcamento.oficina.telefone.replace(/\D/g, "");
      const message = encodeURIComponent(
        `Olá! Gostaria de falar sobre o orçamento #${orcamento.numero} - ${orcamento.titulo}`
      );
      window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
    }
  };

  const handleApproveWhatsApp = async () => {
    if (!orcamento || !id) return;
    setApproving(true);
    try {
      const { data, error } = await supabase.rpc("public_approve_orcamento", {
        p_orcamento_id: orcamento.id,
        p_action: "aprovar",
      });

      const result = data as any;
      if (error || !result?.success) {
        throw new Error(result?.error || "Falha na aprovação");
      }

      setApproved(true);
      setOrcamento({ ...orcamento, status: "aprovado" });
    } catch (err) {
      console.error("Erro ao aprovar:", err);
      toast.error("Não foi possível confirmar. Por favor, entre em contato pelo WhatsApp.");
      // Fallback: open WhatsApp
      if (orcamento?.oficina.telefone) {
        const phone = orcamento.oficina.telefone.replace(/\D/g, "");
        const valorFinalMsg = formatCurrency((orcamento.valor_total || 0) - (orcamento.desconto || 0));
        const message = encodeURIComponent(
          `✅ *APROVAÇÃO DE ORÇAMENTO*\n\n` +
          `Olá! Eu, ${orcamento.cliente?.nome || 'Cliente'}, *APROVO* o orçamento:\n\n` +
          `📋 Orçamento #${orcamento.numero}\n` +
          `📌 ${orcamento.titulo}\n` +
          `💰 Valor: ${valorFinalMsg}\n\n` +
          `Podem iniciar o serviço! 👍`
        );
        window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
      }
    } finally {
      setApproving(false);
    }
  };

  const handleRejectWhatsApp = () => {
    if (orcamento?.oficina.telefone) {
      const phone = orcamento.oficina.telefone.replace(/\D/g, "");
      const message = encodeURIComponent(
        `Olá! Sobre o orçamento #${orcamento.numero} - ${orcamento.titulo}:\n\n` +
        `Gostaria de entender melhor algumas questões antes de aprovar...`
      );
      window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background safe-area-inset">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  if (error || !orcamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 safe-area-inset">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="max-w-sm w-full">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Oops!</h2>
              <p className="text-muted-foreground text-sm">
                {error || "Orçamento não encontrado"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const status = statusConfig[orcamento.status] || { label: orcamento.status, className: "bg-muted text-muted-foreground", icon: FileText, description: "" };
  const StatusIcon = status.icon;
  const valorFinal = (orcamento.valor_total || 0) - (orcamento.desconto || 0);
  const isExpired = orcamento.validade && new Date(orcamento.validade) < new Date();
  const showApprovalButtons = orcamento.status === "enviado" && !isExpired && !approved;

  // Separate items by type
  const produtos = orcamento.itens?.filter(item => item.tipo === "produto") || [];
  const servicos = orcamento.itens?.filter(item => item.tipo === "servico") || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 safe-area-inset">
      {/* Fixed Header on Mobile */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 md:hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {orcamento.oficina.logo_url ? (
              <img
                src={orcamento.oficina.logo_url}
                alt={orcamento.oficina.nome}
                className="w-10 h-10 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
            )}
            <div>
              <h1 className="font-semibold text-foreground text-sm truncate max-w-[180px]">
                {orcamento.oficina.nome}
              </h1>
              <p className="text-xs text-muted-foreground">Orçamento #{orcamento.numero}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </motion.header>

      <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-4 md:space-y-6">
        {/* Print Button */}
        <div className="flex justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>

        {/* Desktop Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden md:block text-center pt-4"
        >
          {orcamento.oficina.logo_url ? (
            <img
              src={orcamento.oficina.logo_url}
              alt={orcamento.oficina.nome}
              className="w-24 h-24 rounded-2xl mx-auto mb-4 object-cover border-4 border-card shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 border-4 border-card shadow-xl">
              <Wrench className="w-12 h-12 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">{orcamento.oficina.nome}</h1>
          <p className="text-muted-foreground mt-1">Orçamento #{orcamento.numero}</p>
          {orcamento.oficina.endereco && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" />
              {orcamento.oficina.endereco}
            </p>
          )}
          {orcamento.oficina.telefone && (
            <a
              href={`tel:${orcamento.oficina.telefone}`}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary mt-2 text-sm"
            >
              <Phone className="w-4 h-4" />
              {orcamento.oficina.telefone}
            </a>
          )}
        </motion.div>

        {/* Status Card with CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className={`border-2 ${showApprovalButtons ? 'border-blue-500/30 bg-blue-500/5' : 'bg-card/50'}`}>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <h2 className="font-bold text-lg text-foreground">{orcamento.titulo}</h2>
                  {orcamento.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{orcamento.descricao}</p>
                  )}
                </div>
                <Badge className={`text-sm px-4 py-1.5 ${status.className}`}>
                  <StatusIcon className="w-4 h-4 mr-1.5" />
                  {status.label}
                </Badge>
              </div>
              
              {status.description && (
                <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {status.description}
                </p>
              )}
              
              {orcamento.validade && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {isExpired ? "⚠️ Expirou em" : "Válido até"}: {formatDate(orcamento.validade)}
                  </span>
                </div>
              )}

              {/* Approval Success */}
              {approved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 pt-4 border-t border-border"
                >
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <p className="text-lg font-semibold text-foreground text-center">
                      ✅ Orçamento aprovado!
                    </p>
                    <p className="text-sm text-muted-foreground text-center">
                      A oficina foi notificada e entrará em contato para agendar o serviço.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Approval Buttons */}
              {showApprovalButtons && (
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <p className="text-sm font-medium text-foreground">O que deseja fazer?</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApproveWhatsApp}
                      disabled={approving}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {approving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aprovando...
                        </>
                      ) : (
                        <>
                          <ThumbsUp className="w-4 h-4 mr-2" />
                          Aprovar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRejectWhatsApp}
                      disabled={approving}
                      className="flex-1"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Tenho Dúvidas
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Customer Info */}
        {orcamento.cliente && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Card>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 md:w-7 md:h-7 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-foreground">
                      {orcamento.cliente.nome}
                    </p>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {orcamento.cliente.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {orcamento.cliente.telefone}
                        </span>
                      )}
                      {orcamento.cliente.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {orcamento.cliente.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Vehicle Info */}
        {orcamento.veiculo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Car className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg md:text-xl font-semibold text-foreground truncate">
                        {orcamento.veiculo.marca} {orcamento.veiculo.modelo}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {orcamento.veiculo.tipo === "moto" ? "🏍️ Moto" : "🚗 Carro"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {orcamento.veiculo.placa && (
                        <span className="font-mono font-medium bg-muted px-2 py-0.5 rounded">
                          {orcamento.veiculo.placa}
                        </span>
                      )}
                      {orcamento.veiculo.ano && (
                        <span>Ano {orcamento.veiculo.ano}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Services List */}
        {servicos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-accent" />
                  Serviços ({servicos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
                <div className="space-y-3">
                  {servicos.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between py-3 ${
                        index !== servicos.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{item.nome_item}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade > 1 ? `${item.quantidade}x ` : ""}{formatCurrency(item.valor_unitario)}
                        </p>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(item.valor_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Products List */}
        {produtos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  Peças e Produtos ({produtos.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-2">
                <div className="space-y-3">
                  {produtos.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between py-3 ${
                        index !== produtos.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{item.nome_item}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade}x {formatCurrency(item.valor_unitario)}
                        </p>
                      </div>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(item.valor_total)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Value Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="p-4 md:p-6 space-y-3">
              {orcamento.desconto > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">
                      {formatCurrency(orcamento.valor_total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-success font-medium">🏷️ Desconto</span>
                    <span className="text-success font-medium">
                      - {formatCurrency(orcamento.desconto)}
                    </span>
                  </div>
                  <Separator className="bg-accent/20" />
                </>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-accent" />
                  </div>
                  <span className="text-muted-foreground text-sm md:text-base font-medium">
                    Valor Total
                  </span>
                </div>
                <span className="text-2xl md:text-3xl font-bold text-accent">
                  {formatCurrency(valorFinal)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Observations */}
        {orcamento.observacoes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardContent className="p-4 md:p-6">
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Observações
                </p>
                <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-line">
                  {orcamento.observacoes}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Created Date */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
        >
          <div className="text-center text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 inline mr-1" />
            Orçamento emitido em {formatDate(orcamento.created_at.split("T")[0])}
          </div>
        </motion.div>

        {/* Contact Buttons */}
        {orcamento.oficina.telefone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-3 pb-4"
          >
            <Button
              onClick={handleWhatsAppContact}
              className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Falar no WhatsApp
            </Button>
            <a href={`tel:${orcamento.oficina.telefone}`} className="block">
              <Button variant="outline" className="w-full h-12 text-base">
                <Phone className="w-5 h-5 mr-2" />
                Ligar para Oficina
              </Button>
            </a>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center py-4 space-y-2"
        >
          <p className="text-xs text-muted-foreground">
            Orçamento gerado por <strong>{orcamento.oficina.nome}</strong>
          </p>
          {orcamento.oficina.endereco && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" />
              {orcamento.oficina.endereco}
            </p>
          )}
        </motion.div>
      </div>

      {/* ===== PRINT-ONLY LAYOUT ===== */}
      <div className="hidden print:block print-orcamento">
        {/* Header */}
        <div className="print-header">
          {orcamento.oficina.logo_url && (
            <img src={orcamento.oficina.logo_url} alt="" className="print-logo" />
          )}
          <div>
            <h1 className="print-oficina-nome">{orcamento.oficina.nome}</h1>
            {orcamento.oficina.endereco && <p>{orcamento.oficina.endereco}</p>}
            {orcamento.oficina.telefone && <p>Tel: {orcamento.oficina.telefone}</p>}
          </div>
        </div>

        <div className="print-title-bar">
          <h2>ORÇAMENTO Nº {orcamento.numero || "—"}</h2>
          <p>Emitido em: {formatDate(orcamento.created_at.split("T")[0])}</p>
          {orcamento.validade && <p>Válido até: {formatDate(orcamento.validade)}</p>}
        </div>

        {/* Client + Vehicle */}
        <div className="print-two-cols">
          <div className="print-col">
            <h3>Cliente</h3>
            <p><strong>{orcamento.cliente?.nome || "—"}</strong></p>
            {orcamento.cliente?.telefone && <p>Tel: {orcamento.cliente.telefone}</p>}
            {orcamento.cliente?.email && <p>E-mail: {orcamento.cliente.email}</p>}
          </div>
          {orcamento.veiculo && (
            <div className="print-col">
              <h3>Veículo</h3>
              <p><strong>{orcamento.veiculo.marca} {orcamento.veiculo.modelo}</strong></p>
              {orcamento.veiculo.ano && <p>Ano: {orcamento.veiculo.ano}</p>}
              {orcamento.veiculo.placa && <p>Placa: {orcamento.veiculo.placa}</p>}
            </div>
          )}
        </div>

        {/* Services Table */}
        {servicos.length > 0 && (
          <>
            <h3 className="print-section-title">Serviços</h3>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "50%" }}>Descrição</th>
                  <th>Qtd</th>
                  <th>Valor Unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {servicos.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome_item}</td>
                    <td style={{ textAlign: "center" }}>{item.quantidade}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(item.valor_unitario)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>Subtotal Serviços</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    {formatCurrency(servicos.reduce((a, i) => a + (i.valor_total || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {/* Parts Table */}
        {produtos.length > 0 && (
          <>
            <h3 className="print-section-title">Peças e Produtos</h3>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "50%" }}>Descrição</th>
                  <th>Qtd</th>
                  <th>Valor Unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((item) => (
                  <tr key={item.id}>
                    <td>{item.nome_item}</td>
                    <td style={{ textAlign: "center" }}>{item.quantidade}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(item.valor_unitario)}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>Subtotal Peças</td>
                  <td style={{ textAlign: "right", fontWeight: "bold" }}>
                    {formatCurrency(produtos.reduce((a, i) => a + (i.valor_total || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {/* Totals */}
        <div className="print-totals">
          {(orcamento.desconto || 0) > 0 && (
            <>
              <div className="print-total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(orcamento.valor_total || 0)}</span>
              </div>
              <div className="print-total-row">
                <span>Desconto</span>
                <span>- {formatCurrency(orcamento.desconto || 0)}</span>
              </div>
            </>
          )}
          <div className="print-total-row print-total-final">
            <span>VALOR TOTAL</span>
            <span>{formatCurrency(valorFinal)}</span>
          </div>
        </div>

        {/* Observations */}
        {orcamento.observacoes && (
          <div className="print-obs">
            <h3>Observações</h3>
            <p>{orcamento.observacoes}</p>
          </div>
        )}

        {/* Signature */}
        <div className="print-signature">
          <div className="print-signature-line">
            <p>Autorizo a execução dos serviços acima:</p>
            <div className="print-sig-underline"></div>
            <p className="print-sig-label">Assinatura do Cliente</p>
          </div>
          <div className="print-signature-date">
            <p>Data: ____/____/________</p>
          </div>
        </div>

        {/* Footer */}
        <div className="print-footer">
          <p>{orcamento.oficina.nome}</p>
          {orcamento.oficina.telefone && <p>Tel: {orcamento.oficina.telefone}</p>}
          {orcamento.oficina.endereco && <p>{orcamento.oficina.endereco}</p>}
        </div>
      </div>
    </div>
  );
}