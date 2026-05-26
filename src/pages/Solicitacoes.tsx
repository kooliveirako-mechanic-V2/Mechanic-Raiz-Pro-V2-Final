import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, Clock, MessageCircle, Calendar, Car, Phone, ExternalLink } from "lucide-react";
import { useSolicitacoesAgendamento, useSolicitacaoActions, type SolicitacaoAgendamento, type SolicitacaoStatus } from "@/hooks/useAgendamentoOnline";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useNavigate } from "react-router-dom";

const STATUS_META: Record<SolicitacaoStatus, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  aprovado: { label: "Aprovada", color: "bg-success/15 text-success border-success/30" },
  recusado: { label: "Recusada", color: "bg-destructive/15 text-destructive border-destructive/30" },
  sugerido: { label: "Sugerida", color: "bg-info/15 text-info border-info/30" },
  cancelado: { label: "Cancelada", color: "bg-muted text-muted-foreground border-border" },
};

function formatData(d: string) {
  try { return format(parseISO(d + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR }); } catch { return d; }
}

export default function Solicitacoes() {
  const [status, setStatus] = useState<SolicitacaoStatus | "todos">("pendente");
  const { data: solicitacoes = [], isLoading } = useSolicitacoesAgendamento(status);
  const { aprovar, recusar, sugerir, cancelar } = useSolicitacaoActions();
  const navigate = useNavigate();

  const [recusaModal, setRecusaModal] = useState<SolicitacaoAgendamento | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [sugestaoModal, setSugestaoModal] = useState<SolicitacaoAgendamento | null>(null);
  const [novaData, setNovaData] = useState("");
  const [novaHora, setNovaHora] = useState("");

  const handleAprovar = async (s: SolicitacaoAgendamento) => {
    const result = await aprovar.mutateAsync({ solicitacao_id: s.id });
    if (result && (result as any).numero_os) {
      navigate(`/servicos`);
    }
  };

  const handleWhatsApp = (s: SolicitacaoAgendamento) => {
    const tel = s.cliente_telefone.replace(/\D/g, "");
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    const msg = encodeURIComponent(`Olá ${s.cliente_nome}! Sobre sua solicitação de agendamento para ${s.servico_nome} em ${formatData(s.data_agendamento_solicitada)} às ${s.hora_agendamento_solicitada.slice(0,5)}...`);
    window.open(`https://wa.me/${numero}?text=${msg}`, "_blank");
  };

  return (
    <MainLayout>
      <div className="max-w-5xl space-y-6 pb-20">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Solicitações de Agendamento</h1>
          <p className="text-muted-foreground mt-1">Pedidos feitos pelos clientes pelo link público.</p>
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="pendente">Pendentes</TabsTrigger>
            <TabsTrigger value="aprovado">Aprovadas</TabsTrigger>
            <TabsTrigger value="sugerido">Sugeridas</TabsTrigger>
            <TabsTrigger value="recusado">Recusadas</TabsTrigger>
            <TabsTrigger value="todos">Todas</TabsTrigger>
          </TabsList>

          <TabsContent value={status} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : solicitacoes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma solicitação {status !== "todos" ? STATUS_META[status as SolicitacaoStatus].label.toLowerCase() : ""}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {solicitacoes.map((s) => (
                  <div key={s.id} className="border rounded-xl p-4 bg-card space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{s.cliente_nome}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {s.cliente_telefone}
                        </p>
                      </div>
                      <Badge variant="outline" className={STATUS_META[s.status].color}>
                        {STATUS_META[s.status].label}
                      </Badge>
                    </div>

                    <div className="text-sm space-y-1">
                      <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /> <strong>{formatData(s.data_agendamento_solicitada)}</strong> às <strong>{s.hora_agendamento_solicitada.slice(0,5)}</strong></p>
                      <p className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> {s.servico_nome}{s.servico_valor_estimado ? ` — R$ ${s.servico_valor_estimado.toFixed(2)}` : ""}</p>
                      {s.veiculo_placa && (
                        <p className="flex items-center gap-2"><Car className="w-4 h-4 text-muted-foreground" /> {s.veiculo_placa} {s.veiculo_modelo && `· ${s.veiculo_modelo}`}</p>
                      )}
                      {s.observacoes_cliente && (
                        <p className="text-muted-foreground italic pt-1">"{s.observacoes_cliente}"</p>
                      )}
                      {s.status === "sugerido" && s.nova_data_sugerida && (
                        <p className="text-info text-xs">Sugerido: {formatData(s.nova_data_sugerida)} {s.nova_hora_sugerida?.slice(0,5)}</p>
                      )}
                      {s.status === "recusado" && s.motivo_recusa && (
                        <p className="text-destructive text-xs">Motivo: {s.motivo_recusa}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button size="sm" variant="ghost" onClick={() => handleWhatsApp(s)}>
                        <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                      </Button>
                      {s.status === "pendente" && (
                        <>
                          <Button size="sm" onClick={() => handleAprovar(s)} disabled={aprovar.isPending}>
                            <Check className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setSugestaoModal(s); setNovaData(s.data_agendamento_solicitada); setNovaHora(s.hora_agendamento_solicitada.slice(0,5)); }}>
                            <Clock className="w-4 h-4 mr-1" /> Sugerir horário
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setRecusaModal(s); setMotivoRecusa(""); }}>
                            <X className="w-4 h-4 mr-1" /> Recusar
                          </Button>
                        </>
                      )}
                      {s.status === "aprovado" && s.ordem_servico_id && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/servicos`)}>
                          <ExternalLink className="w-4 h-4 mr-1" /> Ver OS
                        </Button>
                      )}
                      {(s.status === "pendente" || s.status === "sugerido") && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => cancelar.mutate(s.id)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Recusar */}
      <Dialog open={!!recusaModal} onOpenChange={(v) => !v && setRecusaModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar solicitação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{recusaModal?.cliente_nome} — {recusaModal && formatData(recusaModal.data_agendamento_solicitada)} às {recusaModal?.hora_agendamento_solicitada.slice(0,5)}</p>
            <div>
              <Label>Motivo (opcional)</Label>
              <Textarea value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} rows={3} placeholder="Ex: agenda lotada nesse horário" className="text-base" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusaModal(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => { if (recusaModal) { await recusar.mutateAsync({ solicitacao_id: recusaModal.id, motivo: motivoRecusa }); setRecusaModal(null); } }} disabled={recusar.isPending}>
              {recusar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sugerir */}
      <Dialog open={!!sugestaoModal} onOpenChange={(v) => !v && setSugestaoModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sugerir novo horário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{sugestaoModal?.cliente_nome}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nova data</Label>
                <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} className="text-base" />
              </div>
              <div>
                <Label>Novo horário</Label>
                <Input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} className="text-base" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSugestaoModal(null)}>Cancelar</Button>
            <Button onClick={async () => { if (sugestaoModal && novaData && novaHora) { await sugerir.mutateAsync({ solicitacao_id: sugestaoModal.id, nova_data: novaData, nova_hora: novaHora }); setSugestaoModal(null); } }} disabled={sugerir.isPending || !novaData || !novaHora}>
              {sugerir.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sugerir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
