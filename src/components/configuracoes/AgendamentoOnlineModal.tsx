import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useAgendamentoOnlineConfig, type DiaSemana, type HorariosSemana } from "@/hooks/useAgendamentoOnline";
import { useCatalogoServicos } from "@/hooks/useCatalogoServicos";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DIAS: { key: DiaSemana; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const DEFAULT_HORARIOS: HorariosSemana = {
  seg: { aberto: true, abre: "08:00", fecha: "18:00", pausa_inicio: "12:00", pausa_fim: "13:00" },
  ter: { aberto: true, abre: "08:00", fecha: "18:00", pausa_inicio: "12:00", pausa_fim: "13:00" },
  qua: { aberto: true, abre: "08:00", fecha: "18:00", pausa_inicio: "12:00", pausa_fim: "13:00" },
  qui: { aberto: true, abre: "08:00", fecha: "18:00", pausa_inicio: "12:00", pausa_fim: "13:00" },
  sex: { aberto: true, abre: "08:00", fecha: "18:00", pausa_inicio: "12:00", pausa_fim: "13:00" },
  sab: { aberto: true, abre: "08:00", fecha: "12:00" },
  dom: { aberto: false },
};

export function AgendamentoOnlineModal({ open, onOpenChange }: Props) {
  const { config, isLoading, update } = useAgendamentoOnlineConfig();
  const { servicos } = useCatalogoServicos();

  const [ativo, setAtivo] = useState(false);
  const [slug, setSlug] = useState("");
  const [horarios, setHorarios] = useState<HorariosSemana>(DEFAULT_HORARIOS);
  const [capacidade, setCapacidade] = useState(1);
  const [duracao, setDuracao] = useState(30);
  const [diasMax, setDiasMax] = useState(30);
  const [mostrarPrecos, setMostrarPrecos] = useState(true);
  const [servicosPermitidos, setServicosPermitidos] = useState<string[]>([]);
  const [msgConfirmacao, setMsgConfirmacao] = useState("");
  const [msgAprovacao, setMsgAprovacao] = useState("");

  useEffect(() => {
    if (!config) return;
    setAtivo(config.agendamento_online_ativo);
    setSlug(config.agendamento_online_slug || "");
    setHorarios((config.agendamento_online_horarios as HorariosSemana) || DEFAULT_HORARIOS);
    setCapacidade(config.agendamento_online_capacidade_simultanea);
    setDuracao(config.agendamento_online_duracao_slot_minutos);
    setDiasMax(config.agendamento_online_dias_antecedencia_max);
    setMostrarPrecos(config.agendamento_online_mostrar_precos);
    setServicosPermitidos(config.agendamento_online_servicos_permitidos || []);
    setMsgConfirmacao(config.agendamento_online_mensagem_confirmacao);
    setMsgAprovacao(config.agendamento_online_mensagem_aprovacao);
  }, [config]);

  const PUBLIC_BASE_URL = "https://www.mechanicraizpro.com.br";
  const publicUrl = useMemo(() => {
    if (!slug) return "";
    return `${PUBLIC_BASE_URL}/agendar/${slug}`;
  }, [slug]);

  const slugValido = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(slug);

  const handleSalvar = async () => {
    if (ativo && !slugValido) {
      toast.error("Slug inválido", { description: "Use 3-50 caracteres: letras minúsculas, números e hífens." });
      return;
    }
    await update.mutateAsync({
      agendamento_online_ativo: ativo,
      agendamento_online_slug: slug ? slug.toLowerCase() : null,
      agendamento_online_horarios: horarios as any,
      agendamento_online_capacidade_simultanea: capacidade,
      agendamento_online_duracao_slot_minutos: duracao,
      agendamento_online_dias_antecedencia_max: diasMax,
      agendamento_online_mostrar_precos: mostrarPrecos,
      agendamento_online_servicos_permitidos: servicosPermitidos as any,
      agendamento_online_mensagem_confirmacao: msgConfirmacao,
      agendamento_online_mensagem_aprovacao: msgAprovacao,
    });
  };

  const updateDia = (dia: DiaSemana, patch: Partial<HorariosSemana[DiaSemana]>) => {
    setHorarios((h) => ({ ...h, [dia]: { ...h[dia], ...patch } }));
  };

  const toggleServico = (id: string) => {
    setServicosPermitidos((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendamento Online</DialogTitle>
          <DialogDescription>
            Permita que seus clientes solicitem horários direto pelo link público.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {/* Toggle principal */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium">Ativar agendamento online</p>
                <p className="text-sm text-muted-foreground">Cliente preenche pelo link, você aprova manualmente.</p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>

            {/* Slug e link público */}
            <div className="space-y-2">
              <Label htmlFor="slug">Endereço público (slug)</Label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center rounded-md border bg-background px-3 text-sm">
                  <span className="text-muted-foreground truncate">{PUBLIC_BASE_URL}/agendar/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="minha-oficina"
                    className="border-0 px-1 h-10 focus-visible:ring-0"
                    maxLength={50}
                  />
                </div>
              </div>
              {slug && !slugValido && (
                <p className="text-xs text-destructive">3-50 caracteres. Apenas letras minúsculas, números e hífens.</p>
              )}
              {ativo && slug && slugValido && (
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="text-xs">Link público</Badge>
                  <code className="text-xs flex-1 truncate">{publicUrl}</code>
                  <Button size="sm" variant="ghost" onClick={copyUrl}><Copy className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => window.open(publicUrl, "_blank")}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Parâmetros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Duração do slot (min)</Label>
                <Input type="number" min={15} max={240} step={15} value={duracao}
                  onChange={(e) => setDuracao(Math.max(15, parseInt(e.target.value) || 30))} className="text-base" />
              </div>
              <div>
                <Label>Atendimentos simultâneos</Label>
                <Input type="number" min={1} max={20} value={capacidade}
                  onChange={(e) => setCapacidade(Math.max(1, parseInt(e.target.value) || 1))} className="text-base" />
              </div>
              <div>
                <Label>Antecedência máx. (dias)</Label>
                <Input type="number" min={1} max={180} value={diasMax}
                  onChange={(e) => setDiasMax(Math.max(1, parseInt(e.target.value) || 30))} className="text-base" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="precos">Mostrar preços dos serviços para o cliente</Label>
              <Switch id="precos" checked={mostrarPrecos} onCheckedChange={setMostrarPrecos} />
            </div>

            <Separator />

            {/* Horários */}
            <div>
              <Label className="text-base font-semibold">Horários de atendimento</Label>
              <div className="space-y-2 mt-2">
                {DIAS.map(({ key, label }) => {
                  const d = horarios[key] || { aberto: false };
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2 p-2 rounded-md border">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Switch checked={d.aberto} onCheckedChange={(v) => updateDia(key, { aberto: v })} />
                        <span className="font-medium text-sm">{label}</span>
                      </div>
                      {d.aberto && (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <Input type="time" value={d.abre || "08:00"} onChange={(e) => updateDia(key, { abre: e.target.value })} className="w-28 text-base" />
                          <span className="text-muted-foreground text-sm">às</span>
                          <Input type="time" value={d.fecha || "18:00"} onChange={(e) => updateDia(key, { fecha: e.target.value })} className="w-28 text-base" />
                          <span className="text-muted-foreground text-sm">pausa</span>
                          <Input type="time" value={d.pausa_inicio || ""} onChange={(e) => updateDia(key, { pausa_inicio: e.target.value || undefined })} className="w-28 text-base" />
                          <span className="text-muted-foreground text-sm">-</span>
                          <Input type="time" value={d.pausa_fim || ""} onChange={(e) => updateDia(key, { pausa_fim: e.target.value || undefined })} className="w-28 text-base" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Serviços permitidos */}
            <div>
              <Label className="text-base font-semibold">Serviços disponíveis no agendamento</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {servicosPermitidos.length === 0 ? "Nenhum selecionado = todos do catálogo serão exibidos." : `${servicosPermitidos.length} selecionados.`}
              </p>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {servicos.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">Cadastre serviços em Estoque → Serviços primeiro.</p>
                ) : (
                  servicos.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer">
                      <Checkbox checked={servicosPermitidos.includes(s.id)} onCheckedChange={() => toggleServico(s.id)} />
                      <span className="text-sm flex-1">{s.nome}</span>
                      <span className="text-xs text-muted-foreground">{s.categoria}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Mensagens */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Mensagens para o cliente</Label>
              <div>
                <Label className="text-xs">Confirmação de recebimento</Label>
                <Textarea value={msgConfirmacao} onChange={(e) => setMsgConfirmacao(e.target.value)} rows={2} className="text-base" />
              </div>
              <div>
                <Label className="text-xs">Mensagem de aprovação</Label>
                <Textarea value={msgAprovacao} onChange={(e) => setMsgAprovacao(e.target.value)} rows={2} className="text-base" />
              </div>
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{{cliente_nome}} {{servico}} {{data}} {{hora}} {{oficina}}"}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={update.isPending}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
