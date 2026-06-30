import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcSentinelaPublic } from "@/lib/sentinela";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, ArrowLeft, ArrowRight, Calendar as CalIcon, Clock, User, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type DiaSemana = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom";

interface ServicoPublico {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  tempo_estimado_minutos: number | null;
  valor_mao_obra: number | null;
}

interface OficinaPublica {
  oficina_id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  logo_url: string | null;
  slug: string;
  horarios: Record<DiaSemana, { aberto: boolean; abre?: string; fecha?: string }>;
  dias_antecedencia_max: number;
  mostrar_precos: boolean;
  mensagem_confirmacao: string;
  servicos: ServicoPublico[];
}

const DIA_MAP: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function maskTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}

export default function AgendamentoPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [oficina, setOficina] = useState<OficinaPublica | null>(null);
  const [step, setStep] = useState(1);

  // Step 1
  const [servicoId, setServicoId] = useState<string | null>(null);
  // Step 2
  const [data, setData] = useState<Date | undefined>();
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [hora, setHora] = useState<string | null>(null);
  // Step 3
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", placa: "", modelo: "", observacoes: "" });
  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const servicoSelecionado = useMemo(
    () => oficina?.servicos.find((s) => s.id === servicoId) ?? null,
    [oficina, servicoId]
  );

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_oficina_publica_by_slug" as any, { p_slug: slug });
        if (error) {
          console.error("[AgendamentoPublico] Erro RPC:", error);
          setOficina(null);
        } else {
          setOficina(data as unknown as OficinaPublica);
        }
      } catch (err) {
        console.error("[AgendamentoPublico] Erro fatal:", err);
        setOficina(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!data || !slug) {
      setSlots([]);
      setHora(null);
      return;
    }
    (async () => {
      setSlotsLoading(true);
      setHora(null);
      const dataStr = format(data, "yyyy-MM-dd");
      const { data: res, error } = await supabase.rpc("get_slots_disponiveis" as any, {
        p_slug: slug,
        p_data: dataStr,
      });
      if (error || !res) {
        setSlots([]);
      } else {
        const r = res as any;
        setSlots(Array.isArray(r?.slots) ? r.slots : []);
      }
      setSlotsLoading(false);
    })();
  }, [data, slug]);

  const dayDisabled = (d: Date) => {
    if (!oficina) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (d < today) return true;
    const max = new Date(); max.setDate(max.getDate() + (oficina.dias_antecedencia_max ?? 30));
    if (d > max) return true;
    const dia = DIA_MAP[d.getDay()];
    const cfg = oficina.horarios?.[dia];
    return !cfg?.aberto;
  };

  const next = () => {
    if (step === 1 && !servicoId) return toast.error("Selecione um serviço");
    if (step === 2 && (!data || !hora)) return toast.error("Selecione data e horário");
    if (step === 3) {
      if (form.nome.trim().length < 2) return toast.error("Informe seu nome completo");
      if (form.telefone.replace(/\D/g, "").length < 10) return toast.error("Telefone inválido");
    }
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    if (!slug || !servicoId || !data || !hora) return;
    setSubmitting(true);
    const { data: res, error } = await rpcSentinelaPublic("solicitar_agendamento_publico", {
      p_slug: slug,
      p_cliente_nome: form.nome.trim(),
      p_cliente_telefone: form.telefone.replace(/\D/g, ""),
      p_cliente_email: form.email.trim() || null,
      p_veiculo_placa: form.placa.trim() || null,
      p_veiculo_modelo: form.modelo.trim() || null,
      p_servico_id: servicoId,
      p_data: format(data, "yyyy-MM-dd"),
      p_hora: hora,
      p_observacoes: form.observacoes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message?.includes("rate_limit") ? "Muitas solicitações. Tente novamente em alguns minutos." : (error.message || "Erro ao enviar solicitação");
      return toast.error(msg);
    }
    const r = res as any;
    if (r?.erro) {
      return toast.error(r.erro === "horario_indisponivel" ? "Horário não está mais disponível" : r.erro);
    }
    setSucesso(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!oficina) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Agendamento indisponível</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Esta oficina não foi encontrada ou o agendamento online não está ativo no momento.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
            <h2 className="text-2xl font-bold">Solicitação enviada!</h2>
            <p className="text-muted-foreground whitespace-pre-wrap">{oficina.mensagem_confirmacao || "Em breve entraremos em contato para confirmar seu agendamento."}</p>
            {oficina.telefone && (
              <a href={`https://wa.me/55${oficina.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full"><Phone className="w-4 h-4 mr-2" />Falar com a oficina</Button>
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center gap-4">
          {oficina.logo_url && <img src={oficina.logo_url} alt={oficina.nome} className="w-14 h-14 rounded-lg object-cover" />}
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{oficina.nome}</h1>
            {oficina.endereco && <p className="text-sm text-muted-foreground flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{oficina.endereco}</p>}
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex-1 flex items-center">
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{n}</div>
              {n < 4 && <div className={cn("flex-1 h-0.5 mx-2", step > n ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold">Escolha o serviço</h2>
                <div className="space-y-2">
                  {oficina.servicos.length === 0 && <p className="text-muted-foreground text-sm">Nenhum serviço disponível para agendamento.</p>}
                  {oficina.servicos.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setServicoId(s.id)}
                      className={cn("w-full text-left p-4 rounded-lg border-2 transition-all",
                        servicoId === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{s.nome}</p>
                          {s.descricao && <p className="text-sm text-muted-foreground mt-1">{s.descricao}</p>}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {s.categoria && <Badge variant="secondary" className="text-xs">{s.categoria}</Badge>}
                            {s.tempo_estimado_minutos && <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{s.tempo_estimado_minutos} min</Badge>}
                          </div>
                        </div>
                        {oficina.mostrar_precos && s.valor_mao_obra != null && (
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-primary">R$ {Number(s.valor_mao_obra).toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold">Escolha data e horário</h2>
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    disabled={dayDisabled}
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto rounded-md border")}
                  />
                </div>
                {data && (
                  <div>
                    <Label className="mb-2 block">Horários disponíveis em {format(data, "dd/MM/yyyy")}</Label>
                    {slotsLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhum horário disponível neste dia.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {slots.map((s) => (
                          <button
                            key={s}
                            onClick={() => setHora(s)}
                            className={cn("py-2 rounded-md text-sm border-2 transition",
                              hora === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50")}
                          >{s}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold">Seus dados</h2>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="nome">Nome completo *</Label>
                    <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={100} className="text-base" />
                  </div>
                  <div>
                    <Label htmlFor="tel">Telefone (WhatsApp) *</Label>
                    <Input id="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: maskTelefone(e.target.value) })} inputMode="tel" placeholder="(11) 91234-5678" className="text-base" />
                  </div>
                  <div>
                    <Label htmlFor="email">E-mail (opcional)</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={150} className="text-base" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="placa">Placa</Label>
                      <Input id="placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} maxLength={8} className="text-base" />
                    </div>
                    <div>
                      <Label htmlFor="modelo">Modelo</Label>
                      <Input id="modelo" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} maxLength={60} className="text-base" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="obs">Observações</Label>
                    <Textarea id="obs" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} maxLength={500} rows={3} className="text-base" />
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <h2 className="text-lg font-semibold">Confirme seu agendamento</h2>
                <div className="space-y-3 text-sm">
                  <Row label="Oficina" value={oficina.nome} />
                  <Row label="Serviço" value={servicoSelecionado?.nome ?? "—"} />
                  <Row label="Data" value={data ? format(data, "dd/MM/yyyy (EEEE)", { locale: ptBR }) : "—"} icon={<CalIcon className="w-4 h-4" />} />
                  <Row label="Horário" value={hora ?? "—"} icon={<Clock className="w-4 h-4" />} />
                  <Row label="Nome" value={form.nome} icon={<User className="w-4 h-4" />} />
                  <Row label="Telefone" value={form.telefone} icon={<Phone className="w-4 h-4" />} />
                  {form.email && <Row label="E-mail" value={form.email} />}
                  {(form.placa || form.modelo) && <Row label="Veículo" value={[form.placa, form.modelo].filter(Boolean).join(" • ")} />}
                  {form.observacoes && <Row label="Observações" value={form.observacoes} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao confirmar, sua solicitação será enviada para a oficina, que confirmará o horário em breve.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t mt-4 py-3 flex gap-2 -mx-4 px-4">
          {step > 1 && (
            <Button variant="outline" onClick={back} disabled={submitting} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={next} className="flex-1">Próximo <ArrowRight className="w-4 h-4 ml-1" /></Button>
          ) : (
            <Button onClick={submit} disabled={submitting} className="flex-1">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar agendamento
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
