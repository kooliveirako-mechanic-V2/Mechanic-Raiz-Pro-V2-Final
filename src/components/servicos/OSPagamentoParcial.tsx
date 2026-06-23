import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcWithRetry } from "@/lib/rpcWithRetry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Loader2, CheckCircle2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, parseCurrency } from "@/lib/formatters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

interface Sinal {
  id: string;
  valor: number;
  forma_pagamento: string | null;
  data_pagamento: string;
  observacao: string | null;
  created_at: string;
}

interface Props {
  ordemServicoId: string;
  valorTotalOS: number;
}

export function OSPagamentoParcial({ ordemServicoId, valorTotalOS }: Props) {
  const qc = useQueryClient();
  const { formasPagamento } = useFormasPagamento();
  const [valor, setValor] = useState("");
  const [formaId, setFormaId] = useState<string>("");
  const [dataPag, setDataPag] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [observacao, setObservacao] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: os } = useQuery({
    queryKey: ["os-sinal", ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("valor_sinal, valor_servico, status")
        .eq("id", ordemServicoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ordemServicoId,
  });

  const { data: sinais = [] } = useQuery({
    queryKey: ["os-sinais-list", ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_sinais" as any)
        .select("id, valor, forma_pagamento, data_pagamento, observacao, created_at")
        .eq("ordem_servico_id", ordemServicoId)
        .order("data_pagamento", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Sinal[];
    },
    enabled: !!ordemServicoId,
  });

  const sinalAtual = Number(os?.valor_sinal || 0);
  const total = Math.max(valorTotalOS, Number(os?.valor_servico || 0));
  const restante = Math.max(total - sinalAtual, 0);
  const isFinalizada = os?.status === "finalizado";

  const registrar = useMutation({
    mutationFn: async () => {
      const v = parseCurrency(valor);
      const formaNome = formaId
        ? (formasPagamento.find((f) => f.id === formaId)?.nome || null)
        : "Dinheiro";
      const { data, error } = await rpcWithRetry("registrar_sinal_os", {
        p_os_id: ordemServicoId,
        p_valor: v,
        p_forma_pagamento_id: formaId || null,
        p_forma_pagamento_nome: formaNome,
        p_data_pagamento: dataPag,
        p_observacao: observacao || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Sinal registrado!", {
        description: "Lançado no financeiro como entrada paga.",
      });
      setValor("");
      setObservacao("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["os-sinal", ordemServicoId] });
      qc.invalidateQueries({ queryKey: ["os-sinais-list", ordemServicoId] });
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["ordens-servico"] });
      qc.invalidateQueries({ queryKey: ["ordens_servico"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => {
      toast.error("Não foi possível registrar o sinal", {
        description: e?.message || "Erro desconhecido",
      });
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("os_sinais" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sinal removido", { description: "Lançamento financeiro também foi excluído." });
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["os-sinal", ordemServicoId] });
      qc.invalidateQueries({ queryKey: ["os-sinais-list", ordemServicoId] });
      qc.invalidateQueries({ queryKey: ["financeiro-resumo"] });
      qc.invalidateQueries({ queryKey: ["ordens_servico"] });
    },
    onError: (e: any) => toast.error("Erro ao excluir", { description: e?.message }),
  });

  const handleClick = () => {
    const v = parseCurrency(valor);
    if (!v || v <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (total > 0 && sinalAtual + v > total + 0.01) {
      toast.error("Sinal ultrapassa o total da OS", {
        description: `Falta apenas ${formatCurrency(restante)} para quitar.`,
      });
      return;
    }
    setConfirmOpen(true);
  };

  const fmtData = (d: string) => {
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  };

  if (isFinalizada) return null;

  return (
    <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="w-5 h-5 text-amber-600" />
        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">
          Pagamento Parcial / Sinal
        </h3>
      </div>

      {/* Resumo: Total / Recebido / Falta */}
      {(sinalAtual > 0 || restante > 0) && (
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-background border border-border">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Total OS</p>
            <p className="text-sm font-bold">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Recebido</p>
            <p className="text-sm font-bold text-success">{formatCurrency(sinalAtual)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Falta</p>
            <p className={`text-sm font-bold ${restante > 0 ? "text-destructive" : "text-success"}`}>
              {formatCurrency(restante)}
            </p>
          </div>
        </div>
      )}

      {/* Histórico de sinais */}
      {sinais.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Histórico ({sinais.length})
          </p>
          <div className="space-y-1">
            {sinais.map((s, idx) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border text-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    Sinal {idx + 1}: {formatCurrency(Number(s.valor))}
                  </p>
                  <p className="text-muted-foreground truncate">
                    {s.forma_pagamento || "—"} · {fmtData(s.data_pagamento)}
                    {s.observacao ? ` · ${s.observacao}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteId(s.id)}
                  title="Excluir sinal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário de novo sinal */}
      {restante > 0 && !showForm && (
        <Button
          type="button"
          onClick={() => setShowForm(true)}
          variant="outline"
          className="w-full h-11 border-amber-400 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-semibold"
        >
          <Plus className="w-4 h-4 mr-1" />
          {sinais.length > 0 ? "Registrar mais um sinal" : "Registrar sinal/entrada"}
        </Button>
      )}

      {restante > 0 && showForm && (
        <div className="space-y-2 p-3 rounded-lg border border-amber-300 bg-background">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Valor</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="R$ 0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-11 text-base font-semibold"
                disabled={registrar.isPending}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Data</Label>
              <Input
                type="date"
                value={dataPag}
                onChange={(e) => setDataPag(e.target.value)}
                className="h-11 text-base"
                disabled={registrar.isPending}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">Forma de pagamento</Label>
            <Select value={formaId} onValueChange={setFormaId} disabled={registrar.isPending}>
              <SelectTrigger className="h-11 text-base">
                <SelectValue placeholder="Dinheiro (padrão)" />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold">Observação (opcional)</Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: 1ª parcela combinada"
              className="h-11 text-base"
              disabled={registrar.isPending}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11"
              onClick={() => {
                setShowForm(false);
                setValor("");
                setObservacao("");
              }}
              disabled={registrar.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleClick}
              disabled={registrar.isPending || !valor}
              className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {registrar.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Registrar
                </>
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ℹ️ Cria entrada no financeiro com cliente, forma e data. Ao finalizar, só o saldo será cobrado.
          </p>
        </div>
      )}

      {restante <= 0 && sinalAtual > 0 && (
        <p className="text-xs font-semibold text-success">
          ✓ OS quitada via sinal — basta finalizar.
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar recebimento do sinal"
        description={`Registrar ${formatCurrency(parseCurrency(valor))} como sinal recebido em ${fmtData(dataPag)}? Vai criar uma entrada no financeiro imediatamente.`}
        confirmText="Sim, registrar"
        onConfirm={() => registrar.mutate()}
        isLoading={registrar.isPending}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir sinal?"
        description="O lançamento correspondente no financeiro também será removido. Não pode ser desfeito."
        confirmText="Sim, excluir"
        variant="destructive"
        onConfirm={() => deleteId && excluir.mutate(deleteId)}
        isLoading={excluir.isPending}
      />
    </div>
  );
}
