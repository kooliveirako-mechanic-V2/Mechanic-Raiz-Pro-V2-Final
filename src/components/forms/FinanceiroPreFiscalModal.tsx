import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SelectWithCreate } from "@/components/ui/select-with-create";
import { useFinanceiroPreFiscal, FinanceiroInput, PREJUIZO_LABELS } from "@/hooks/useFinanceiroPreFiscal";
import { useCategoriasFinanceiras } from "@/hooks/useCategoriasFinanceiras";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";
import { Loader2, ArrowUpRight, ArrowDownRight, Building2, User, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { handleFormKeyDown } from "@/lib/formGuard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useModalClose } from "@/hooks/useModalClose";
import { useAutoSave } from "@/hooks/useAutoSave";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DraftPromptDialog } from "@/components/DraftPromptDialog";

interface FinanceiroPreFiscalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo?: "entrada" | "saida";
}

export function FinanceiroPreFiscalModal({ open, onOpenChange, tipo: tipoInicial }: FinanceiroPreFiscalModalProps) {
  const isMobile = useIsMobile();
  const { createRegistro, isCreating } = useFinanceiroPreFiscal();
  const { categoriasEntrada, categoriasSaida, createCategoria } = useCategoriasFinanceiras();
  const { centrosCusto, createCentroCusto } = useCentrosCusto();
  const { fornecedores, createFornecedor } = useFornecedores();
  const { formasPagamento, createFormaPagamento } = useFormasPagamento();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">(tipoInicial || "entrada");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false); // Estado independente
  const [centroCustoId, setCentroCustoId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [formaPagamentoCustom, setFormaPagamentoCustom] = useState("");
  const [isCustomPaymentMode, setIsCustomPaymentMode] = useState(false); // Estado independente
  const [status, setStatus] = useState<"pago" | "a_receber" | "a_pagar">("pago");
  const [classificacao, setClassificacao] = useState<"empresa" | "pessoal">("empresa");
  const [dataCompetencia, setDataCompetencia] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<"mensal" | "semanal" | "anual">("mensal");
  const [observacoesContador, setObservacoesContador] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [categoriaTipo, setCategoriaTipo] = useState<string>("operacional");

  const categorias = tipo === "entrada" ? categoriasEntrada : categoriasSaida;
  const showCategoriaCustom = isCustomCategoryMode;
  const showFormaPagamentoCustom = isCustomPaymentMode;

  const [draftPromptOpen, setDraftPromptOpen] = useState(false);

  // Objeto único de dados: serve de snapshot (useModalClose) e de rascunho (useAutoSave).
  const formData = {
    tipo,
    valor,
    data,
    descricao,
    categoriaId,
    categoriaCustom,
    centroCustoId,
    fornecedorId,
    formaPagamentoId,
    formaPagamentoCustom,
    status,
    classificacao,
    dataCompetencia,
    dataPagamento,
    recorrente,
    recorrenciaTipo,
    observacoesContador,
    numeroDocumento,
    categoriaTipo,
    // voláteis (ver ignoreKeys abaixo) — ficam no rascunho, fora da comparação de sujo
    isCustomCategoryMode,
    isCustomPaymentMode,
    showAdvanced,
  };

  const { hasDraft, lastSaved, restore, clearDraft } = useAutoSave({
    key: "financeiro-prefiscal",
    data: formData,
    enabled: open,
  });

  const restoreDraft = (d: typeof formData) => {
    setTipo(d.tipo);
    setValor(d.valor);
    setData(d.data);
    setDescricao(d.descricao);
    setCategoriaId(d.categoriaId);
    setCategoriaCustom(d.categoriaCustom);
    setCentroCustoId(d.centroCustoId);
    setFornecedorId(d.fornecedorId);
    setFormaPagamentoId(d.formaPagamentoId);
    setFormaPagamentoCustom(d.formaPagamentoCustom);
    setStatus(d.status);
    setClassificacao(d.classificacao);
    setDataCompetencia(d.dataCompetencia);
    setDataPagamento(d.dataPagamento);
    setRecorrente(d.recorrente);
    setRecorrenciaTipo(d.recorrenciaTipo);
    setObservacoesContador(d.observacoesContador);
    setNumeroDocumento(d.numeroDocumento);
    setCategoriaTipo(d.categoriaTipo);
    setIsCustomCategoryMode(d.isCustomCategoryMode);
    setIsCustomPaymentMode(d.isCustomPaymentMode);
    setShowAdvanced(d.showAdvanced);
  };

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: formData,
    onOpenChange,
    // `data` nasce com a data de hoje; as 3 flags são de UI. Sem excluí-las, o
    // modal abriria "sujo" e perguntaria a quem só abriu e fechou.
    ignoreKeys: ["data", "isCustomCategoryMode", "isCustomPaymentMode", "showAdvanced"],
  });

  useEffect(() => {
    if (tipoInicial) setTipo(tipoInicial);
    if (!open) {
      setValor("");
      setData(new Date().toISOString().split("T")[0]);
      setDescricao("");
      setCategoriaId("");
      setCategoriaCustom("");
      setIsCustomCategoryMode(false);
      setCentroCustoId("");
      setFornecedorId("");
      setFormaPagamentoId("");
      setFormaPagamentoCustom("");
      setIsCustomPaymentMode(false);
      setStatus("pago");
      setClassificacao("empresa");
      setDataCompetencia("");
      setDataPagamento("");
      setRecorrente(false);
      setRecorrenciaTipo("mensal");
      setObservacoesContador("");
      setNumeroDocumento("");
      setCategoriaTipo("operacional");
      setShowAdvanced(false);
    }
  }, [tipoInicial, open]);

  // Ao abrir: se há rascunho válido, oferece retomar (nunca aplica em silêncio).
  useEffect(() => {
    if (open && hasDraft) setDraftPromptOpen(true);
    if (!open) setDraftPromptOpen(false);
  }, [open, hasDraft]);

  // Update status when tipo changes
  useEffect(() => {
    if (tipo === "entrada") {
      setStatus(status === "a_pagar" ? "pago" : status);
    } else {
      setStatus(status === "a_receber" ? "pago" : status);
    }
  }, [tipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor) return;

    const categoria = categorias.find(c => c.id === categoriaId);
    
    const isPrejuizo = tipo === "saida" && categoriaTipo.startsWith("prejuizo");
    const origemPrejuizo = isPrejuizo ? PREJUIZO_LABELS[categoriaTipo] : null;

    const input: FinanceiroInput = {
      tipo,
      origem: origemPrejuizo || categoria?.nome || (tipo === "entrada" ? "Outros (Entrada)" : "Outros (Saída)"),
      valor: parseFloat(valor),
      data,
      descricao: descricao || undefined,
      categoria: isPrejuizo ? "prejuizo" : "operacional",
      categoria_id: !isPrejuizo && categoriaId ? categoriaId : undefined,
      centro_custo_id: centroCustoId || undefined,
      fornecedor_id: fornecedorId || undefined,
      forma_pagamento_id: formaPagamentoId || undefined,
      status,
      classificacao,
      data_competencia: dataCompetencia || data,
      data_pagamento: dataPagamento || (status === "pago" ? data : undefined),
      recorrente,
      recorrencia_tipo: recorrente ? recorrenciaTipo : undefined,
      observacoes_contador: observacoesContador || undefined,
      numero_documento: numeroDocumento || undefined,
    };

    createRegistro(input, {
      onSuccess: () => {
        clearDraft(); // some com o rascunho só após salvar de verdade
        onOpenChange(false);
      },
    });
  };

  const FormContent = (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-4 px-1">
      {/* Type Toggle */}
      {!tipoInicial && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={tipo === "entrada" ? "default" : "outline"}
            className={cn("flex-1 h-12", tipo === "entrada" && "bg-success hover:bg-success/90")}
            onClick={() => setTipo("entrada")}
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Receita
          </Button>
          <Button
            type="button"
            variant={tipo === "saida" ? "default" : "outline"}
            className={cn("flex-1 h-12", tipo === "saida" && "bg-destructive hover:bg-destructive/90")}
            onClick={() => setTipo("saida")}
          >
            <ArrowDownRight className="w-4 h-4 mr-2" />
            Despesa
          </Button>
        </div>
      )}

      {/* Classificação Empresa/Pessoal */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          type="button"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
            classificacao === "empresa" 
              ? "bg-background shadow-sm text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setClassificacao("empresa")}
        >
          <Building2 className="w-4 h-4" />
          Empresa
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
            classificacao === "pessoal" 
              ? "bg-background shadow-sm text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setClassificacao("pessoal")}
        >
          <User className="w-4 h-4" />
          Pessoal
        </button>
      </div>

      {/* Tipo de Despesa (apenas saída) — separa Operacional de Prejuízo */}
      {tipo === "saida" && (
        <div className="space-y-2">
          <Label className="text-base">Tipo de despesa *</Label>
          <Select value={categoriaTipo} onValueChange={setCategoriaTipo}>
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="operacional" className="text-base py-3">
                💼 Despesa Operacional
              </SelectItem>
              <SelectItem value="prejuizo_retrabalho" className="text-base py-3">
                🔴 Prejuízo / Retrabalho
              </SelectItem>
              <SelectItem value="prejuizo_garantia" className="text-base py-3">
                🟠 Garantia Acionada
              </SelectItem>
              <SelectItem value="prejuizo_peca" className="text-base py-3">
                ⚠️ Peça Quebrada / Avariada
              </SelectItem>
              <SelectItem value="prejuizo_sinistro" className="text-base py-3">
                💥 Sinistro
              </SelectItem>
            </SelectContent>
          </Select>
          {categoriaTipo.startsWith("prejuizo") && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
              ⚠️ Este lançamento será contado como prejuízo e descontado do lucro líquido real (separado das despesas operacionais).
            </p>
          )}
        </div>
      )}

      {/* Valor */}
      <div className="space-y-2">
        <Label htmlFor="valor" className="text-base">Valor *</Label>
        <CurrencyInput id="valor" value={valor} onValueChange={setValor} />
      </div>

      {/* Categoria */}
      <div className="space-y-2">
        <Label className="text-base">Categoria</Label>
        <Select 
          value={isCustomCategoryMode ? "__custom__" : categoriaId} 
          onValueChange={(value) => {
            if (value === "__custom__") {
              setIsCustomCategoryMode(true);
              setCategoriaCustom("");
            } else {
              setIsCustomCategoryMode(false);
              setCategoriaId(value);
              setCategoriaCustom("");
            }
          }}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Selecione a categoria" />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={cat.id} className="text-base py-3">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }} />
                  {cat.nome}
                </span>
              </SelectItem>
            ))}
            <SelectItem value="__custom__" className="text-base py-3 text-primary">
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nova Categoria
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        
        {/* Campo para categoria personalizada */}
        {showCategoriaCustom && (
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Digite o nome da categoria..."
              value={categoriaCustom}
              onChange={(e) => setCategoriaCustom(e.target.value)}
              className="h-10 flex-1"
              autoFocus={false}
            />
            <Button
              type="button"
              size="sm"
              className="h-10"
              disabled={!categoriaCustom.trim()}
              onClick={() => {
                if (categoriaCustom.trim()) {
                  createCategoria({ 
                    nome: categoriaCustom.trim(), 
                    tipo: tipo === "entrada" ? "entrada" : "saida" 
                  });
                  setIsCustomCategoryMode(false);
                  setCategoriaId("");
                  setCategoriaCustom("");
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Data */}
      <div className="space-y-2">
        <Label htmlFor="data" className="text-base">Data do lançamento</Label>
        <Input
          id="data"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label className="text-base">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pago" className="text-base py-3">
              {tipo === "entrada" ? "Recebido" : "Pago"}
            </SelectItem>
            {tipo === "entrada" && (
              <SelectItem value="a_receber" className="text-base py-3">A receber</SelectItem>
            )}
            {tipo === "saida" && (
              <SelectItem value="a_pagar" className="text-base py-3">A pagar</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Forma de Pagamento */}
      <div className="space-y-2">
        <Label className="text-base">Forma de Pagamento</Label>
        <Select 
          value={isCustomPaymentMode ? "__custom__" : formaPagamentoId} 
          onValueChange={(value) => {
            if (value === "__custom__") {
              setIsCustomPaymentMode(true);
              setFormaPagamentoCustom("");
            } else {
              setIsCustomPaymentMode(false);
              setFormaPagamentoId(value);
              setFormaPagamentoCustom("");
            }
          }}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            {formasPagamento.map((forma) => (
              <SelectItem key={forma.id} value={forma.id} className="text-base py-3">
                {forma.nome}
              </SelectItem>
            ))}
            <SelectItem value="__custom__" className="text-base py-3 text-primary">
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nova Forma
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        
        {/* Campo para forma de pagamento personalizada */}
        {showFormaPagamentoCustom && (
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Digite o nome..."
              value={formaPagamentoCustom}
              onChange={(e) => setFormaPagamentoCustom(e.target.value)}
              className="h-10 flex-1"
              autoFocus={false}
            />
            <Button
              type="button"
              size="sm"
              className="h-10"
              disabled={!formaPagamentoCustom.trim()}
              onClick={() => {
                if (formaPagamentoCustom.trim()) {
                  createFormaPagamento({ 
                    nome: formaPagamentoCustom.trim(), 
                    tipo: "outro" 
                  });
                  setIsCustomPaymentMode(false);
                  setFormaPagamentoId("");
                  setFormaPagamentoCustom("");
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="descricao" className="text-base">Descrição</Label>
        <Textarea
          id="descricao"
          placeholder="Detalhes do lançamento..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="text-base"
        />
      </div>

      {/* Advanced Options */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground">
            Opções avançadas (contábil)
            <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          {/* Centro de Custo */}
          <div className="space-y-2">
            <Label className="text-sm">Centro de Custo</Label>
            <Select value={centroCustoId} onValueChange={setCentroCustoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {centrosCusto.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fornecedor (apenas para saídas) */}
          {tipo === "saida" && (
            <div className="space-y-2">
              <Label className="text-sm">Fornecedor</Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Data de Competência */}
          <div className="space-y-2">
            <Label htmlFor="dataCompetencia" className="text-sm">Data de Competência</Label>
            <Input
              id="dataCompetencia"
              type="date"
              value={dataCompetencia}
              onChange={(e) => setDataCompetencia(e.target.value)}
            />
          </div>

          {/* Data de Pagamento */}
          {status === "pago" && (
            <div className="space-y-2">
              <Label htmlFor="dataPagamento" className="text-sm">Data de {tipo === "entrada" ? "Recebimento" : "Pagamento"}</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
          )}

          {/* Número do Documento */}
          <div className="space-y-2">
            <Label htmlFor="numeroDocumento" className="text-sm">Nº Documento / NF</Label>
            <Input
              id="numeroDocumento"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ex: NF-123456"
            />
          </div>

          {/* Recorrente */}
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="recorrente" className="text-sm">Lançamento recorrente</Label>
            <Switch id="recorrente" checked={recorrente} onCheckedChange={setRecorrente} />
          </div>

          {recorrente && (
            <div className="space-y-2">
              <Label className="text-sm">Frequência</Label>
              <Select value={recorrenciaTipo} onValueChange={(v) => setRecorrenciaTipo(v as typeof recorrenciaTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observações para Contador */}
          <div className="space-y-2">
            <Label htmlFor="observacoesContador" className="text-sm">Observações para Contador</Label>
            <Textarea
              id="observacoesContador"
              value={observacoesContador}
              onChange={(e) => setObservacoesContador(e.target.value)}
              placeholder="Informações adicionais para contabilidade..."
              rows={2}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex gap-3 pt-4 pb-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => onOpenChange(false)} 
          className="flex-1 h-12 text-base"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isCreating || !valor}
          className={cn(
            "flex-1 h-12 text-base font-semibold",
            tipo === "entrada" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"
          )}
        >
          {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar"}
        </Button>
      </div>
    </form>
  );

  const HeaderContent = (
    <div className="flex items-center gap-2">
      {tipo === "entrada" ? (
        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
          <ArrowUpRight className="w-5 h-5 text-success" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <ArrowDownRight className="w-5 h-5 text-destructive" />
        </div>
      )}
      <div>
        <span className="font-semibold">{tipo === "entrada" ? "Nova Receita" : "Nova Despesa"}</span>
        {classificacao === "pessoal" && (
          <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">Pessoal</span>
        )}
      </div>
    </div>
  );

  // Diálogos compartilhados entre mobile e desktop — mesma lógica nos dois.
  const SharedDialogs = (
    <>
      <DraftPromptDialog
        open={draftPromptOpen}
        label="lançamento financeiro"
        savedAt={lastSaved}
        onResume={() => { const d = restore(); if (d) restoreDraft(d); setDraftPromptOpen(false); }}
        onDiscard={() => { clearDraft(); setDraftPromptOpen(false); }}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sair sem salvar?"
        description="Você tem dados não salvos neste lançamento. Seu rascunho fica guardado para você retomar depois."
        confirmText="Sair"
        cancelText="Continuar editando"
        onConfirm={confirmClose}
      />
    </>
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="px-4 pb-6 max-h-[90dvh]">
            <DrawerHeader className="text-left px-0">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                {HeaderContent}
              </DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto">{FormContent}</div>
          </DrawerContent>
        </Drawer>
        {SharedDialogs}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{HeaderContent}</DialogTitle>
          </DialogHeader>
          {FormContent}
        </DialogContent>
      </Dialog>
      {SharedDialogs}
    </>
  );
}
