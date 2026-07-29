import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { DraftPromptDialog } from "@/components/DraftPromptDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Search, Plus, Minus, Trash2, Zap, ArrowLeft, Share2, X, CheckCircle2, Package } from "lucide-react";
import { useEstoque, type ItemEstoque } from "@/hooks/useEstoque";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { useOficina } from "@/contexts/OficinaContext";
import { ClienteSelectWithCreate } from "@/components/forms/ClienteSelectWithCreate";
import {
  useVendasBalcao,
  type VendaBalcaoItemInput,
} from "@/hooks/useVendasBalcao";
import { formatCurrency, parseCurrency } from "@/lib/formatters";
import {
  buildVendaBalcaoReceipt,
  openWhatsAppRecibo,
  copiarRecibo,
  baixarReciboPDF,
} from "@/lib/vendaBalcaoReceipt";
import { Copy, FileDown, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAutoSave } from "@/hooks/useAutoSave";

interface VendaRapidaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem extends VendaBalcaoItemInput {
  key: string;
  isManual: boolean;
}

type Step = "itens" | "finalizar" | "sucesso";

interface SuccessInfo {
  numero: number;
  valor_total: number;
  itens: CartItem[];
  forma_pagamento: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
}

export function VendaRapidaModal({ open, onOpenChange }: VendaRapidaModalProps) {
  const { oficinaAtual } = useOficina();
  const { itens: estoqueItens } = useEstoque();
  const { formasPagamento } = useFormasPagamento();
  const { criarVenda } = useVendasBalcao();
  const isSubmittingRef = useRef(false);

  const [step, setStep] = useState<Step>("itens");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualValor, setManualValor] = useState("");
  const [manualQty, setManualQty] = useState(1);

  const [formaPagamentoId, setFormaPagamentoId] = useState<string>("");
  const [formaPagamentoNome, setFormaPagamentoNome] = useState<string>("Dinheiro");
  const [clienteId, setClienteId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");

  // ─── AutoSave: persist cart + cliente/observação para sobreviver a kill do PWA
  const draftData = useMemo(() => ({
    step, cart, formaPagamentoId, formaPagamentoNome, clienteId, observacao,
  }), [step, cart, formaPagamentoId, formaPagamentoNome, clienteId, observacao]);

  const { hasDraft, restore, clearDraft, lastSaved } = useAutoSave({
    key: `venda-rapida-${oficinaAtual?.id || "global"}`,
    data: draftData,
    enabled: open && step !== "sucesso",
    interval: 1500,
  });

  const hasRestoredRef = useRef(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  const resetVenda = useCallback(() => {
    setStep("itens");
    setCart([]);
    setSearch("");
    setShowManual(false);
    setManualNome("");
    setManualValor("");
    setManualQty(1);
    setClienteId("");
    setObservacao("");
    setSuccess(null);
    const padrao = formasPagamento.find((f) => f.padrao) || formasPagamento[0];
    if (padrao) {
      setFormaPagamentoId(padrao.id);
      setFormaPagamentoNome(padrao.nome);
    } else {
      setFormaPagamentoId("");
      setFormaPagamentoNome("Dinheiro");
    }
  }, [formasPagamento]);

  const applyDraft = useCallback(() => {
    const saved = restore() as typeof draftData | null;
    if (saved) {
      setStep(saved.step || "itens");
      setCart(saved.cart || []);
      setFormaPagamentoId(saved.formaPagamentoId || "");
      setFormaPagamentoNome(saved.formaPagamentoNome || "Dinheiro");
      setClienteId(saved.clienteId || "");
      setObservacao(saved.observacao || "");
      setSearch("");
      setShowManual(false);
      setManualNome("");
      setManualValor("");
      setManualQty(1);
      setSuccess(null);
    }
    setDraftPromptOpen(false);
  }, [restore]);

  const discardDraft = useCallback(() => {
    clearDraft();
    resetVenda();
    setDraftPromptOpen(false);
  }, [clearDraft, resetVenda]);

  // BLINDAGEM UX: nunca restaurar rascunho automaticamente.
  // Antes: rascunho de venda anterior era restaurado sem aviso, podendo
  // gerar baixa de estoque errada. Agora usuário decide via prompt.
  useEffect(() => {
    if (open) {
      if (!hasRestoredRef.current) {
        hasRestoredRef.current = true;
        if (hasDraft) {
          setDraftPromptOpen(true);
        } else {
          resetVenda();
        }
      }
    } else {
      hasRestoredRef.current = false;
      setDraftPromptOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, formasPagamento]);

  const filteredEstoque = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as ItemEstoque[];
    return estoqueItens
      .filter(
        (i) =>
          i.tipo_item !== "servico" &&
          (i.nome.toLowerCase().includes(q) ||
            (i.categoria || "").toLowerCase().includes(q) ||
            (i.codigo || "").toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [search, estoqueItens]);

  const total = useMemo(
    () => cart.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0),
    [cart],
  );

  const addEstoqueItem = (item: ItemEstoque) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.estoque_id === item.id);
      if (existing) {
        return prev.map((p) =>
          p.estoque_id === item.id ? { ...p, quantidade: p.quantidade + 1 } : p,
        );
      }
      return [
        ...prev,
        {
          key: `e-${item.id}-${Date.now()}`,
          estoque_id: item.id,
          nome_item: item.nome,
          quantidade: 1,
          valor_unitario: Number(item.preco_venda || 0),
          custo_unitario: Number(item.custo_unitario || 0),
          isManual: false,
        },
      ];
    });
    setSearch("");
  };

  const addManualItem = () => {
    const nome = manualNome.trim();
    const valor = parseCurrency(manualValor);
    if (!nome) {
      toast.error("Informe o nome do item");
      return;
    }
    if (valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (manualQty <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        key: `m-${Date.now()}`,
        estoque_id: null,
        nome_item: nome,
        quantidade: manualQty,
        valor_unitario: valor,
        custo_unitario: 0,
        isManual: true,
      },
    ]);
    setManualNome("");
    setManualValor("");
    setManualQty(1);
    setShowManual(false);
  };

  const adjustQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => (it.key === key ? { ...it, quantidade: it.quantidade + delta } : it))
        .filter((it) => it.quantidade > 0),
    );
  };

  const removeItem = (key: string) => {
    setCart((prev) => prev.filter((it) => it.key !== key));
  };

  const handleAvancar = () => {
    if (cart.length === 0) {
      toast.error("Adicione pelo menos 1 item");
      return;
    }
    setStep("finalizar");
  };

  const handleConfirmar = async () => {
    if (isSubmittingRef.current) return;
    if (cart.length === 0) {
      toast.error("Adicione pelo menos 1 item");
      return;
    }
    if (!formaPagamentoNome) {
      toast.error("Escolha uma forma de pagamento");
      return;
    }

    isSubmittingRef.current = true;
    try {
      const result = await criarVenda.mutateAsync({
        itens: cart.map((c) => ({
          estoque_id: c.estoque_id || null,
          nome_item: c.nome_item,
          quantidade: c.quantidade,
          valor_unitario: c.valor_unitario,
          custo_unitario: c.custo_unitario || 0,
        })),
        forma_pagamento: formaPagamentoNome,
        forma_pagamento_id: formaPagamentoId || null,
        cliente_id: clienteId || null,
        observacao: observacao.trim() || null,
      });

      // Buscar nome + telefone do cliente para o recibo
      let cliente_nome: string | null = null;
      let cliente_telefone: string | null = null;
      if (clienteId) {
        const { data } = await supabase
          .from("clientes")
          .select("nome, telefone")
          .eq("id", clienteId)
          .maybeSingle();
        if (data) {
          cliente_nome = data.nome;
          cliente_telefone = data.telefone;
        }
      }

      setSuccess({
        numero: result.numero,
        valor_total: result.valor_total,
        itens: cart,
        forma_pagamento: formaPagamentoNome,
        cliente_nome,
        cliente_telefone,
      });
      setStep("sucesso");
      clearDraft();
      toast.success(`Venda #${result.numero} registrada!`, {
        description: `${formatCurrency(result.valor_total)} • Estoque e financeiro atualizados.`,
      });
    } catch {
      // erro já tratado no hook
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const buildTexto = () => {
    if (!success || !oficinaAtual) return "";
    return buildVendaBalcaoReceipt({
      numero: success.numero,
      itens: success.itens.map((i) => ({
        nome_item: i.nome_item,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
      })),
      valor_total: success.valor_total,
      forma_pagamento: success.forma_pagamento,
      cliente_nome: success.cliente_nome,
      oficina_nome: oficinaAtual.nome,
      oficina_telefone: oficinaAtual.telefone,
      observacao: observacao || null,
    });
  };

  const handleCopiar = async () => {
    const texto = buildTexto();
    if (!texto) return;
    const ok = await copiarRecibo(texto);
    if (ok) toast.success("Recibo copiado!", { description: "Cole onde quiser enviar." });
    else toast.error("Não foi possível copiar");
  };

  const handleWhatsApp = () => {
    if (!success) return;
    // Se tem telefone do cliente, abre direto. Senão, pede o número.
    if (success.cliente_telefone) {
      openWhatsAppRecibo(buildTexto(), success.cliente_telefone);
      return;
    }
    setPhoneInput("");
    setShowPhoneInput(true);
  };

  const handleEnviarWhatsAppComTelefone = () => {
    const tel = phoneInput.replace(/\D/g, "");
    if (tel.length < 10) {
      toast.error("Telefone inválido", { description: "Digite DDD + número." });
      return;
    }
    openWhatsAppRecibo(buildTexto(), tel);
    setShowPhoneInput(false);
  };

  const handlePDF = () => {
    if (!success || !oficinaAtual) return;
    baixarReciboPDF({
      numero: success.numero,
      itens: success.itens.map((i) => ({
        nome_item: i.nome_item,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
      })),
      valor_total: success.valor_total,
      forma_pagamento: success.forma_pagamento,
      cliente_nome: success.cliente_nome,
      oficina_nome: oficinaAtual.nome,
      oficina_telefone: oficinaAtual.telefone,
      observacao: observacao || null,
    });
    toast.success("PDF gerado!");
  };


  const handleNovaVenda = () => {
    setStep("itens");
    setCart([]);
    setClienteId("");
    setObservacao("");
    setSuccess(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {step !== "itens" && step !== "sucesso" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setStep("itens")}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <DialogTitle className="text-base font-semibold flex-1">
              {step === "sucesso" ? "Venda concluída" : "Venda Rápida"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* ── STEP 1: ITENS ───────────────────────────────────────── */}
        {step === "itens" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Buscar peça no estoque..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 text-base"
                  />
                </div>

                {search && (
                  <div className="mt-2 bg-card border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border">
                    {filteredEstoque.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nada encontrado.{" "}
                        <button
                          className="text-accent font-medium underline"
                          onClick={() => {
                            setManualNome(search);
                            setShowManual(true);
                            setSearch("");
                          }}
                        >
                          Adicionar como item manual
                        </button>
                      </div>
                    ) : (
                      filteredEstoque.map((item) => {
                        const semEstoque = item.quantidade <= 0;
                        return (
                          <button
                            key={item.id}
                            onClick={() => !semEstoque && addEstoqueItem(item)}
                            disabled={semEstoque}
                            className="w-full text-left p-3 hover:bg-muted/40 active:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                          >
                            <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.nome}</div>
                              <div className="text-xs text-muted-foreground">
                                Estoque: {item.quantidade} • {formatCurrency(item.preco_venda || 0)}
                              </div>
                            </div>
                            {semEstoque && (
                              <span className="text-[10px] uppercase font-bold text-destructive">
                                Sem estoque
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Itens manual */}
              {showManual ? (
                <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Item manual (não baixa estoque)</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowManual(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Nome do item"
                    value={manualNome}
                    onChange={(e) => setManualNome(e.target.value)}
                    className="text-base"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={manualQty}
                        onChange={(e) => setManualQty(parseInt(e.target.value) || 1)}
                        className="text-base"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Valor unitário</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0,00"
                        value={manualValor}
                        onChange={(e) => setManualValor(e.target.value)}
                        className="text-base"
                      />
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={addManualItem}>
                    Adicionar item
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowManual(true)}
                >
                  <Plus className="w-4 h-4 mr-1" /> Adicionar item manual
                </Button>
              )}

              {/* Carrinho */}
              {cart.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Itens da venda ({cart.length})
                  </div>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center gap-2 bg-card border border-border rounded-lg p-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-1.5">
                            {item.nome_item}
                            {item.estoque_id ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success bg-success/10 border border-success/30 px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
                                <Package className="w-2.5 h-2.5" /> Estoque
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
                                Manual
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(item.valor_unitario)} ×{" "}
                            <span className="font-semibold text-foreground">{item.quantidade}</span> ={" "}
                            <span className="font-semibold text-success">
                              {formatCurrency(item.quantidade * item.valor_unitario)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustQty(item.key, -1)}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => adjustQty(item.key, +1)}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeItem(item.key)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="border-t border-border p-4 flex items-center justify-between gap-3 bg-background flex-shrink-0">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {formatCurrency(total)}
                </div>
              </div>
              <Button
                onClick={handleAvancar}
                disabled={cart.length === 0}
                size="lg"
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Avançar
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 2: FINALIZAR ───────────────────────────────────── */}
        {step === "finalizar" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <Label className="text-sm">Forma de pagamento *</Label>
                <Select
                  value={formaPagamentoId || "__padrao__"}
                  onValueChange={(v) => {
                    if (v === "__padrao__") {
                      setFormaPagamentoId("");
                      setFormaPagamentoNome("Dinheiro");
                    } else {
                      const fp = formasPagamento.find((f) => f.id === v);
                      if (fp) {
                        setFormaPagamentoId(fp.id);
                        setFormaPagamentoNome(fp.nome);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="text-base h-11">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formasPagamento.length === 0 && (
                      <SelectItem value="__padrao__">Dinheiro</SelectItem>
                    )}
                    {formasPagamento.map((fp) => (
                      <SelectItem key={fp.id} value={fp.id}>
                        {fp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm">Cliente (opcional)</Label>
                <ClienteSelectWithCreate value={clienteId} onValueChange={setClienteId} />
              </div>

              <div>
                <Label className="text-sm">Observação (opcional)</Label>
                <Textarea
                  placeholder="Ex.: troco entregue, retorno em 7 dias..."
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  className="text-base"
                />
              </div>

              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Resumo
                </div>
                {cart.map((it) => (
                  <div key={it.key} className="flex justify-between text-sm">
                    <span className="truncate pr-2">
                      {it.quantidade}× {it.nome_item}
                    </span>
                    <span className="tabular-nums flex-shrink-0">
                      {formatCurrency(it.quantidade * it.valor_unitario)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border p-4 flex items-center justify-between gap-3 bg-background flex-shrink-0">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {formatCurrency(total)}
                </div>
              </div>
              <Button
                onClick={handleConfirmar}
                disabled={criarVenda.isPending}
                size="lg"
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                {criarVenda.isPending ? "Registrando..." : "✅ Confirmar Venda"}
              </Button>
            </div>
          </>
        )}

        {/* ── STEP 3: SUCESSO ─────────────────────────────────────── */}
        {step === "sucesso" && success && (
          <div className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Venda #{success.numero} registrada!</h3>
              <p className="text-2xl font-bold text-success tabular-nums mt-1">
                {formatCurrency(success.valor_total)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{success.forma_pagamento}</p>
              {(() => {
                const pecasBaixadas = success.itens
                  .filter((i) => i.estoque_id)
                  .reduce((s, i) => s + i.quantidade, 0);
                const manuais = success.itens.filter((i) => !i.estoque_id).length;
                return (
                  <div className="mt-3 inline-flex flex-col gap-1 text-xs">
                    {pecasBaixadas > 0 && (
                      <span className="inline-flex items-center gap-1 text-success font-medium">
                        <Package className="w-3.5 h-3.5" />
                        {pecasBaixadas} {pecasBaixadas === 1 ? "peça baixada" : "peças baixadas"} do estoque
                      </span>
                    )}
                    {manuais > 0 && (
                      <span className="text-muted-foreground">
                        {manuais} {manuais === 1 ? "item manual" : "itens manuais"} (não mexem no estoque)
                      </span>
                    )}
                    <span className="text-muted-foreground">✓ Lançado no financeiro</span>
                  </div>
                );
              })()}
            </div>

            <div className="w-full space-y-2 pt-2">
              {showPhoneInput ? (
                <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2 text-left">
                  <Label className="text-xs">WhatsApp do destinatário (com DDD)</Label>
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      inputMode="tel"
                      placeholder="11 91234-5678"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="text-base"
                    />
                    <Button onClick={handleEnviarWhatsAppComTelefone}>Enviar</Button>
                  </div>
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setShowPhoneInput(false)}
                  >
                    cancelar
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={handleWhatsApp} className="gap-1" size="sm" variant="outline">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </Button>
                  <Button onClick={handleCopiar} className="gap-1" size="sm" variant="outline">
                    <Copy className="w-4 h-4" /> Copiar
                  </Button>
                  <Button onClick={handlePDF} className="gap-1" size="sm" variant="outline">
                    <FileDown className="w-4 h-4" /> PDF
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="default" onClick={handleNovaVenda}>
                  Nova venda
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            </div>


            <p className="text-[10px] text-muted-foreground pt-2">
              Documento não fiscal.
            </p>
          </div>
        )}
      </DialogContent>
      <DraftPromptDialog
        open={draftPromptOpen}
        label="venda"
        savedAt={lastSaved}
        onResume={applyDraft}
        onDiscard={discardDraft}
      />
    </Dialog>
  );
}
