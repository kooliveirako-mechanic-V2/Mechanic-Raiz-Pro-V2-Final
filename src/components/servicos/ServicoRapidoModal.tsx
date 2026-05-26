import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEstoque } from "@/hooks/useEstoque";
import { CatalogoServico, useCatalogoServicos } from "@/hooks/useCatalogoServicos";
import { useOficina } from "@/contexts/OficinaContext";
import { Zap, Loader2, Package, Wrench, Plus, Search, AlertTriangle, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface EditingItemSnapshot {
  id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_mao_obra?: number;
  custo_unitario?: number;
  tipo?: "servico" | "produto";
  estoque_id?: string | null;
}

interface ServicoRapidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (item: {
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    valor_mao_obra?: number;
    estoque_id?: string | null;
    tipo?: "servico" | "produto";
  }) => Promise<void>;
  onSaveToEstoque?: (item: {
    nome: string;
    preco_venda: number;
    categoria: string;
  }) => Promise<void>;
  initialView?: "menu" | "livre" | "estoque" | "catalogo";
  editingItem?: EditingItemSnapshot | null;
  onUpdateItem?: (id: string, patch: {
    nome_item: string;
    quantidade: number;
    valor_unitario: number;
    custo_unitario: number;
    valor_mao_obra: number;
    tipo: "servico" | "produto";
  }) => void | Promise<void>;
}

type ModalView = "menu" | "livre" | "estoque" | "catalogo";
type TipoItem = "servico" | "peca";

export function ServicoRapidoModal({
  open,
  onOpenChange,
  onAddItem,
  onSaveToEstoque,
  initialView = "menu",
  editingItem = null,
  onUpdateItem,
}: ServicoRapidoModalProps) {
  const isMobile = useIsMobile();
  const { oficinaAtual } = useOficina();
  const { itens: itensEstoque, createItem } = useEstoque();
  const { servicos: catalogoServicos, createServico } = useCatalogoServicos();
  const [salvarServicoManual, setSalvarServicoManual] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [qcNome, setQcNome] = useState("");
  const [qcValor, setQcValor] = useState("");
  const [qcCategoria, setQcCategoria] = useState("");
  const [qcTipoVeiculo, setQcTipoVeiculo] = useState<"todos" | "carro" | "moto" | "eletrica">("todos");
  const [searchCatalogo, setSearchCatalogo] = useState("");
  const [catalogoTab, setCatalogoTab] = useState<"servicos" | "salvos">("servicos");
  const [quantidadeCatalogo, setQuantidadeCatalogo] = useState("1");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ModalView>(initialView);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [savedItem, setSavedItem] = useState<{ nome: string; valor: number } | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  // Form state - Item Livre
  const [tipoItem, setTipoItem] = useState<TipoItem>("servico");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [valorMaoObra, setValorMaoObra] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [servicoManualNome, setServicoManualNome] = useState("");
  const [servicoManualValor, setServicoManualValor] = useState("");
  const descricaoInputRef = useRef<HTMLInputElement>(null);

  const tipoOficina = oficinaAtual?.tipo || "ambos";
  const tipoCatalogoOficina = tipoOficina === "auto_eletrica"
    ? "eletrica"
    : tipoOficina === "moto" || tipoOficina === "carro"
      ? tipoOficina
      : "todos";
  const isOficinaCompleta = tipoOficina === "ambos";
  const tipoCatalogoLabel = tipoCatalogoOficina === "eletrica"
    ? "Auto elétrica"
    : tipoCatalogoOficina === "moto"
      ? "Moto"
      : tipoCatalogoOficina === "carro"
        ? "Carro"
        : "Todos";
  const tipoServicoCompativel = (tipo?: string | null, aceitarTodos = true) => {
    const tipoServico = tipo || "todos";
    if (isOficinaCompleta) return true;
    if (aceitarTodos && tipoServico === "todos") return true;
    return tipoServico === tipoCatalogoOficina;
  };

  // Form state - Estoque
  const [searchEstoque, setSearchEstoque] = useState("");
  const [selectedEstoqueId, setSelectedEstoqueId] = useState<string | null>(null);
  const [quantidadeEstoque, setQuantidadeEstoque] = useState("1");
  const [valorMaoObraEstoque, setValorMaoObraEstoque] = useState("");

  const resetForm = () => {
    setView("menu");
    setTipoItem("servico");
    setDescricao("");
    setValor("");
    setValorMaoObra("");
    setCustoUnitario("");
    setQuantidade("1");
    setServicoManualNome("");
    setServicoManualValor("");
    setSearchEstoque("");
    setSelectedEstoqueId(null);
    setQuantidadeEstoque("1");
    setValorMaoObraEstoque("");
    setShowSavePrompt(false);
    setSavedItem(null);
    setAddedCount(0);
  };

  const resetFormKeepOpen = () => {
    setView("menu");
    setTipoItem("servico");
    setDescricao("");
    setValor("");
    setValorMaoObra("");
    setCustoUnitario("");
    setQuantidade("1");
    setServicoManualNome("");
    setServicoManualValor("");
    setSearchEstoque("");
    setSelectedEstoqueId(null);
    setQuantidadeEstoque("1");
    setValorMaoObraEstoque("");
    setShowSavePrompt(false);
    setSavedItem(null);
  };

  // When the modal opens, honor initialView (so external buttons can deep-link to a tab)
  // OR prefill from editingItem when editing an existing pending item.
  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setView("livre");
      setTipoItem(editingItem.tipo === "produto" ? "peca" : "servico");
      setDescricao(editingItem.nome_item || "");
      setValor(editingItem.valor_unitario ? String(editingItem.valor_unitario) : "");
      setValorMaoObra(editingItem.valor_mao_obra ? String(editingItem.valor_mao_obra) : "");
      setCustoUnitario(editingItem.custo_unitario ? String(editingItem.custo_unitario) : "");
      setQuantidade(String(editingItem.quantidade || 1));
    } else {
      setView(initialView);
    }
  }, [open, initialView, editingItem]);

  // Em Serviços, a entrada normal/manual vem primeiro. Salvos é só atalho.
  useEffect(() => {
    if (view !== "catalogo") return;
    setCatalogoTab("servicos");
    setQcTipoVeiculo(tipoCatalogoOficina as "todos" | "carro" | "moto" | "eletrica");
  }, [view, tipoCatalogoOficina]);

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && selectedEstoqueId && selectedItem) {
      // Item selected but not added — confirm before closing
      setShowCloseConfirm(true);
      return;
    }
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleConfirmAddAndClose = async () => {
    setShowCloseConfirm(false);
    await handleSubmitEstoque();
    resetForm();
    onOpenChange(false);
  };

  const handleConfirmCloseWithout = () => {
    setShowCloseConfirm(false);
    resetForm();
    onOpenChange(false);
  };

  const handleQuantidadeEstoqueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    void handleSubmitEstoque();
  };

  // Filtro de itens do estoque (apenas peças/produtos com quantidade > 0 ou todos)
  const filteredEstoque = useMemo(() => {
    if (!searchEstoque.trim()) return itensEstoque;
    const term = searchEstoque.toLowerCase();
    return itensEstoque.filter(
      (item) =>
        item.nome.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term) ||
        (item.codigo && item.codigo.toLowerCase().includes(term))
    );
  }, [itensEstoque, searchEstoque]);

  const selectedItem = useMemo(
    () => itensEstoque.find((i) => i.id === selectedEstoqueId),
    [itensEstoque, selectedEstoqueId]
  );

  // REMOVED: autoFocus causes scroll jumps and drawer instability on mobile
  // Per ARCHITECTURE_RULES: NEVER use autoFocus in MobileSheets

  // ---- Submit: Item Livre ----
  const handleSubmitLivre = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!descricao.trim()) {
      toast.error("Informe a descrição do serviço");
      return;
    }

    const valorNumerico = parseFloat(valor) || 0;
    const maoObraNumerica = parseFloat(valorMaoObra) || 0;
    if (tipoItem === "servico" && valorNumerico <= 0) {
      toast.error("Informe o valor do serviço");
      return;
    }
    if (tipoItem === "peca" && valorNumerico <= 0 && maoObraNumerica <= 0) {
      toast.error("Informe o valor da peça ou a mão de obra");
      return;
    }

    setLoading(true);
    try {
      const tipoFinal: "servico" | "produto" = tipoItem === "peca" ? "produto" : "servico";
      if (editingItem && onUpdateItem) {
        await onUpdateItem(editingItem.id, {
          nome_item: descricao.trim(),
          quantidade: parseInt(quantidade) || 1,
          valor_unitario: valorNumerico,
          custo_unitario: parseFloat(custoUnitario) || 0,
          valor_mao_obra: maoObraNumerica,
          tipo: tipoFinal,
        });
        toast.success("Item atualizado!", { duration: 1500 });
        resetForm();
        onOpenChange(false);
      } else {
        await onAddItem({
          nome_item: descricao.trim(),
          quantidade: parseInt(quantidade) || 1,
          valor_unitario: valorNumerico,
          custo_unitario: parseFloat(custoUnitario) || 0,
          valor_mao_obra: maoObraNumerica,
          estoque_id: null,
          tipo: tipoFinal,
        });
        toast.success(`${descricao.trim()} adicionado!`, { duration: 1500 });
        setAddedCount((c) => c + 1);
        resetFormKeepOpen();
      }
    } catch (error) {
      console.error("[ServicoRapido] Erro ao adicionar:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Submit: Do Estoque ----
  const handleSubmitEstoque = async () => {
    if (!selectedItem) {
      toast.error("Selecione um item do estoque");
      return;
    }

    const qtd = parseInt(quantidadeEstoque) || 1;

    // Alerta de estoque insuficiente
    if (qtd > selectedItem.quantidade) {
      toast.warning(
        `Estoque insuficiente! Disponível: ${selectedItem.quantidade}. A OS será criada, mas o estoque ficará negativo na finalização.`,
        { duration: 5000 }
      );
    }

    // Alerta de custo zerado
    if (!selectedItem.custo_unitario || selectedItem.custo_unitario <= 0) {
      toast.warning(
        `⚠️ "${selectedItem.nome}" não tem custo de compra cadastrado. O lucro da OS ficará incorreto. Cadastre o custo no Estoque.`,
        { duration: 6000 }
      );
    }

    setLoading(true);
    try {
      await onAddItem({
        nome_item: selectedItem.nome,
        quantidade: qtd,
        valor_unitario: selectedItem.preco_venda || 0,
        custo_unitario: selectedItem.custo_unitario || 0,
        valor_mao_obra: parseFloat(valorMaoObraEstoque) || 0,
        estoque_id: selectedItem.id,
        tipo: "produto",
      });

      toast.success(`${selectedItem.nome} adicionado à OS`, { duration: 1500 });
      setAddedCount((c) => c + 1);
      resetFormKeepOpen();
    } catch (error) {
      console.error("[ServicoRapido] Erro ao adicionar do estoque:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Submit: Do Catálogo ----
  const handleAddCatalogo = async (servico: { id: string; nome: string; valor_mao_obra: number }, overrideValor?: number) => {
    const qtd = parseInt(quantidadeCatalogo) || 1;
    const valorFinal = overrideValor !== undefined ? overrideValor : servico.valor_mao_obra;
    if (!valorFinal || valorFinal <= 0) {
      toast.error("Informe o valor do serviço antes de adicionar");
      return;
    }
    setLoading(true);
    try {
      await onAddItem({
        nome_item: servico.nome,
        quantidade: qtd,
        valor_unitario: valorFinal,
        custo_unitario: 0,
        valor_mao_obra: 0,
        estoque_id: null,
        tipo: "servico",
      });
      toast.success(`${servico.nome} adicionado!`, { duration: 1500 });
      setAddedCount((c) => c + 1);
      setQuantidadeCatalogo("1");
      setSearchCatalogo("");
      setView("menu");
    } catch (e) {
      console.error("[ServicoRapido] Erro catálogo:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitServicoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = servicoManualNome.trim();
    const valorNum = parseFloat(servicoManualValor) || 0;
    if (!nome) {
      toast.error("Informe o nome do serviço");
      return;
    }
    setLoading(true);
    try {
      if (salvarServicoManual && valorNum > 0) {
        try {
          await createServico.mutateAsync({
            nome,
            valor_mao_obra: valorNum,
            categoria: "geral",
            tipo_veiculo: tipoCatalogoOficina as "todos" | "carro" | "moto" | "eletrica",
          });
        } catch (err) {
          console.warn("[ServicoRapido] falha ao salvar serviço manual:", err);
        }
      }
      await onAddItem({
        nome_item: nome,
        quantidade: 1,
        valor_unitario: valorNum,
        custo_unitario: 0,
        valor_mao_obra: 0,
        estoque_id: null,
        tipo: "servico",
      });
      toast.success(`${nome} adicionado!`, { duration: 1500 });
      setAddedCount((c) => c + 1);
      setServicoManualNome("");
      setServicoManualValor("");
      setSalvarServicoManual(false);
      setView("menu");
    } catch (e) {
      console.error("[ServicoRapido] Erro serviço manual:", e);
    } finally {
      setLoading(false);
    }
  };

  // ---- Submit: Cadastrar e Adicionar (cadastro rápido inline) ----
  const handleQuickCreate = async () => {
    const nome = qcNome.trim();
    const valorNum = parseFloat(qcValor) || 0;
    if (!nome) {
      toast.error("Informe o nome do serviço");
      return;
    }
    if (valorNum <= 0) {
      toast.error("Informe o valor da mão de obra — serviço sem valor não pode ser salvo.");
      return;
    }
    setLoading(true);
    try {
      const created = await createServico.mutateAsync({
        nome,
        valor_mao_obra: valorNum,
        categoria: qcCategoria.trim() || "geral",
        tipo_veiculo: qcTipoVeiculo,
      }) as unknown as { id?: string };
      if (valorNum > 0 && created?.id) {
        await onAddItem({
          nome_item: nome,
          quantidade: 1,
          valor_unitario: valorNum,
          custo_unitario: 0,
          valor_mao_obra: 0,
          estoque_id: null,
          tipo: "servico",
        });
        toast.success(`${nome} salvo e adicionado!`, { duration: 1500 });
        setAddedCount((c) => c + 1);
        setView("menu");
      } else {
        toast.success(`${nome} salvo no catálogo. Defina um valor antes de adicionar.`, { duration: 2500 });
      }
      setShowQuickCreate(false);
      setQcNome("");
      setQcValor("");
      setQcCategoria("");
      setQcTipoVeiculo(tipoCatalogoOficina as "todos" | "carro" | "moto" | "eletrica");
    } catch (e) {
      console.error("[ServicoRapido] Erro cadastro rápido:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToEstoque = async () => {
    if (!savedItem) return;

    setLoading(true);
    try {
      await createItem.mutateAsync({
        nome: savedItem.nome,
        categoria: tipoItem === "servico" ? "Serviço" : "Peça",
        preco_venda: savedItem.valor,
        quantidade: 0,
      });

      toast.success("Salvo para uso futuro!", {
        description: "Agora ele aparecerá na lista de serviços/produtos.",
      });

      resetFormKeepOpen();
    } catch (error) {
      console.error("[ServicoRapido] Erro ao salvar no estoque:", error);
      toast.error("Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipSave = () => {
    resetFormKeepOpen();
  };

  // ===== RENDER: Menu Inicial =====
  const MenuContent = (
    <div className="space-y-3 p-4">
      {addedCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">
              {addedCount} {addedCount === 1 ? "item adicionado" : "itens adicionados"}
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="h-8"
          >
            Concluir
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground text-center">
        {addedCount > 0 ? "Adicionar mais um item?" : "Como deseja adicionar o item?"}
      </p>
      <Button
        variant="outline"
        className="w-full min-w-0 max-w-full h-16 flex items-center gap-3 justify-start px-3 sm:px-4 whitespace-normal overflow-hidden"
        onClick={() => setView("estoque")}
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div className="text-left min-w-0 flex-1 overflow-hidden">
          <p className="font-semibold text-sm truncate">Do Estoque</p>
          <p className="text-xs text-muted-foreground truncate">
            Buscar peça/produto cadastrado (baixa automática)
          </p>
        </div>
      </Button>
      <Button
        variant="outline"
        className="w-full min-w-0 max-w-full h-16 flex items-center gap-3 justify-start px-3 sm:px-4 whitespace-normal overflow-hidden"
        onClick={() => setView("catalogo")}
      >
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <Wrench className="w-5 h-5 text-success" />
        </div>
        <div className="text-left min-w-0 flex-1 overflow-hidden">
          <p className="font-semibold text-sm truncate">Serviços</p>
          <p className="text-xs text-muted-foreground truncate">
            Digitar serviço ou usar serviços salvos
          </p>
        </div>
      </Button>
      <Button
        variant="outline"
        className="w-full min-w-0 max-w-full h-16 flex items-center gap-3 justify-start px-3 sm:px-4 whitespace-normal overflow-hidden"
        onClick={() => setView("livre")}
      >
        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-accent" />
        </div>
        <div className="text-left min-w-0 flex-1 overflow-hidden">
          <p className="font-semibold text-sm truncate">Item Livre</p>
          <p className="text-xs text-muted-foreground truncate">
            Digitar manualmente (serviço ou peça avulsa)
          </p>
        </div>
      </Button>
      {addedCount > 0 && (
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => handleOpenChange(false)}
        >
          Concluir
        </Button>
      )}
    </div>
  );

  // ===== RENDER: Seletor do Estoque =====
  const EstoqueContent = (
    <div className="space-y-3 p-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar peça, produto ou código..."
          value={searchEstoque}
          onChange={(e) => setSearchEstoque(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Lista de itens */}
      <div
        className="h-[280px] overflow-y-auto overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="space-y-1">
          {filteredEstoque.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum item encontrado</p>
              <Button
                variant="link"
                size="sm"
                className="mt-1 text-accent"
                onClick={() => setView("livre")}
              >
                Adicionar como item livre
              </Button>
            </div>
          ) : (
            filteredEstoque.map((item) => {
              const isSelected = selectedEstoqueId === item.id;
              const isLowStock = item.quantidade <= item.alerta_minimo;
              const isOutOfStock = item.quantidade <= 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedEstoqueId(isSelected ? null : item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    {isSelected ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Package className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.nome}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.categoria}</span>
                      {item.codigo && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{item.codigo}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="font-mono font-semibold text-sm">
                      {formatCurrency(item.preco_venda || 0)}
                    </p>
                    <div className="flex items-center justify-end gap-1">
                      {(!item.custo_unitario || item.custo_unitario <= 0) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                          Sem custo
                        </Badge>
                      )}
                      {isOutOfStock ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Sem estoque
                        </Badge>
                      ) : isLowStock ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning text-warning">
                          <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                          {item.quantidade} un
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {item.quantidade} un
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Quantity + Confirm section with pending indicator */}
      {selectedItem && (
        <div className="border-t pt-3 space-y-3 bg-warning/5 -mx-4 px-4 pb-4 rounded-b-lg">
          {/* Pending badge */}
          <div className="flex items-center gap-2 text-xs font-medium text-warning">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>1 item pronto para adicionar</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedItem.nome}</p>
              <p className="text-xs text-muted-foreground">
                Peça: {formatCurrency(selectedItem.preco_venda || 0)} × {quantidadeEstoque || 1}
                {(parseFloat(valorMaoObraEstoque) || 0) > 0 && (
                  <> + M.O: {formatCurrency(parseFloat(valorMaoObraEstoque))}</>
                )}
                {" = "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(((selectedItem.preco_venda || 0) * (parseInt(quantidadeEstoque) || 1)) + (parseFloat(valorMaoObraEstoque) || 0))}
                </span>
              </p>
            </div>
            <div className="w-20 shrink-0">
              <Label htmlFor="qtd-estoque" className="text-xs">
                Qtd
              </Label>
              <Input
                id="qtd-estoque"
                type="number"
                inputMode="numeric"
                min="1"
                value={quantidadeEstoque}
                onChange={(e) => setQuantidadeEstoque(e.target.value)}
                className="h-10 text-center"
                onKeyDown={handleQuantidadeEstoqueKeyDown}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>

          {/* Mão de obra para este item — highlighted */}
          <div className="space-y-1 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Label htmlFor="mao-obra-estoque" className="text-xs font-semibold flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-primary" />
              Mão de obra desta peça (R$)
            </Label>
            <CurrencyInput
              value={valorMaoObraEstoque}
              onValueChange={setValorMaoObraEstoque}
              className="h-10"
              placeholder="0,00 (opcional)"
            />
            <p className="text-[10px] text-muted-foreground">Quanto cobrar pra instalar/trocar esta peça</p>
          </div>

          {/* Low stock alert */}
          {parseInt(quantidadeEstoque) > selectedItem.quantidade && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Estoque disponível: <strong>{selectedItem.quantidade}</strong>. Ao finalizar a OS, o estoque ficará negativo.
              </p>
            </div>
          )}

          <Button
            onClick={handleSubmitEstoque}
            disabled={loading}
            className="w-full h-12 animate-pulse-slow font-semibold shadow-lg"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Adicionar {selectedItem.nome.length > 25 ? selectedItem.nome.slice(0, 25) + "…" : selectedItem.nome} à OS
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  // ===== RENDER: Serviços (manual primeiro, salvos só como atalho) =====
  const termo = searchCatalogo.toLowerCase().trim();

  const salvosFiltrados = catalogoServicos.filter((s) => {
    if (!s.ativo) return false;
    if (Number(s.valor_mao_obra) <= 0) return false;
    if (!tipoServicoCompativel(s.tipo_veiculo, false)) return false;
    if (!termo) return true;
    return s.nome.toLowerCase().includes(termo) || (s.categoria || "").toLowerCase().includes(termo);
  });

  const renderSalvoItem = (s: CatalogoServico) => (
    <button
      key={s.id}
      type="button"
      disabled={loading}
      onClick={() => handleAddCatalogo({ id: s.id, nome: s.nome, valor_mao_obra: Number(s.valor_mao_obra) })}
      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted/50 disabled:opacity-50 border border-transparent hover:border-success/30"
    >
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-success/10">
        <Wrench className="w-4 h-4 text-success" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{s.nome}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {s.categoria && <span>{s.categoria}</span>}
          {s.tempo_estimado_minutos ? <span>· {s.tempo_estimado_minutos}min</span> : null}
        </div>
      </div>
      <p className="font-mono font-semibold text-sm text-success shrink-0">{formatCurrency(Number(s.valor_mao_obra))}</p>
    </button>
  );

  const CatalogoContent = (
    <div className="space-y-3 p-4">
      {/* Abas Serviços / Serviços salvos */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setCatalogoTab("servicos")}
          className={cn(
            "h-9 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
            catalogoTab === "servicos" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
          )}
        >
          <Wrench className="w-3.5 h-3.5" /> Serviços
        </button>
        <button
          type="button"
          onClick={() => setCatalogoTab("salvos")}
          className={cn(
            "h-9 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
            catalogoTab === "salvos" ? "bg-background shadow-sm text-success" : "text-muted-foreground"
          )}
        >
          <Check className="w-3.5 h-3.5" /> Serviços salvos
          {salvosFiltrados.length > 0 && (
            <span className="ml-0.5 text-[10px] bg-success/15 text-success rounded-full px-1.5">{salvosFiltrados.length}</span>
          )}
        </button>
      </div>

      {catalogoTab === "servicos" ? (
        <form onSubmit={handleSubmitServicoManual} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="servico-manual-nome">Nome do serviço *</Label>
            <Input
              id="servico-manual-nome"
              placeholder="Ex: Troca de óleo, revisão, diagnóstico..."
              value={servicoManualNome}
              onChange={(e) => setServicoManualNome(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="servico-manual-valor">Valor do serviço (opcional)</Label>
            <CurrencyInput
              id="servico-manual-valor"
              value={servicoManualValor}
              onValueChange={setServicoManualValor}
              className="h-12"
              placeholder="0,00"
            />
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 p-3 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={salvarServicoManual}
              onChange={(e) => setSalvarServicoManual(e.target.checked)}
              disabled={(parseFloat(servicoManualValor) || 0) <= 0}
              className="mt-0.5 w-4 h-4 accent-success disabled:opacity-50"
            />
            <span>
              Salvar em <strong>Serviços salvos</strong> para usar em 1 clique depois
              {(parseFloat(servicoManualValor) || 0) <= 0 && <span className="block">Para salvar, informe um valor. Sem valor, só adiciona nesta OS.</span>}
            </span>
          </label>
          <Button type="submit" disabled={loading || !servicoManualNome.trim()} className="w-full h-12 font-semibold">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Adicionar serviço à OS</>}
          </Button>
        </form>
      ) : (
        <>
          {/* Cadastro rápido inline (só na aba Salvos) */}
          {!showQuickCreate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowQuickCreate(true)}
              className="w-full h-10 border-dashed border-success/50 text-success hover:bg-success/10"
            >
              <Plus className="w-4 h-4 mr-1" /> Cadastrar novo serviço salvo
            </Button>
          ) : (
            <div className="space-y-3 p-3 rounded-lg border border-success/30 bg-success/5">
              <p className="text-xs font-semibold text-success uppercase tracking-wide">Novo serviço salvo</p>
              <Input
                placeholder="Nome do serviço *"
                value={qcNome}
                onChange={(e) => setQcNome(e.target.value)}
                className="h-10"
              />
              <div className="grid grid-cols-2 gap-2">
                <CurrencyInput value={qcValor} onValueChange={setQcValor} className="h-10" placeholder="Valor M.O (R$) *" />
                <Input
                  placeholder="Categoria"
                  value={qcCategoria}
                  onChange={(e) => setQcCategoria(e.target.value)}
                  className="h-10"
                />
              </div>
              {isOficinaCompleta ? (
                <div className="grid grid-cols-4 gap-1">
                  {(["todos", "carro", "moto", "eletrica"] as const).map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={qcTipoVeiculo === t ? "default" : "outline"}
                      onClick={() => setQcTipoVeiculo(t)}
                      className="h-8 text-[11px] capitalize"
                    >
                      {t === "eletrica" ? "elétrica" : t}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  Este serviço será salvo em: <strong className="text-foreground">{tipoCatalogoLabel}</strong>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                O valor é obrigatório — serviço sem valor não pode ser salvo.
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9" onClick={() => { setShowQuickCreate(false); setQcNome(""); setQcValor(""); setQcCategoria(""); }}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 h-9"
                  disabled={loading || !qcNome.trim() || !qcValor || parseFloat(qcValor) <= 0}
                  onClick={handleQuickCreate}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Salvar e Adicionar</>}
                </Button>
              </div>
            </div>
          )}

          <div className="h-[260px] overflow-y-auto overscroll-contain touch-pan-y space-y-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {salvosFiltrados.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Wrench className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-sm font-medium">Você ainda não tem serviços salvos</p>
                <p className="text-xs text-muted-foreground px-4">
                  Use a aba <strong>Serviços</strong> para digitar o serviço normal. Se informar valor, pode salvar para reutilizar depois.
                </p>
                <Button type="button" variant="link" size="sm" className="text-primary" onClick={() => setCatalogoTab("servicos")}>
                  Adicionar serviço →
                </Button>
              </div>
            ) : (
              salvosFiltrados.map(renderSalvoItem)
            )}
          </div>
        </>
      )}
    </div>
  );

  const LivreContent = (
    <form onSubmit={handleSubmitLivre} className="space-y-5 p-4">
      {/* Tipo do Item */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={tipoItem === "servico" ? "default" : "outline"}
          onClick={() => setTipoItem("servico")}
          className="h-14 flex-col gap-1"
        >
          <Wrench className="w-5 h-5" />
          <span className="text-xs">Mão de Obra</span>
        </Button>
        <Button
          type="button"
          variant={tipoItem === "peca" ? "default" : "outline"}
          onClick={() => setTipoItem("peca")}
          className="h-14 flex-col gap-1"
        >
          <Package className="w-5 h-5" />
          <span className="text-xs">Peça/Produto</span>
        </Button>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="descricao">
          {tipoItem === "servico" ? "Descrição do serviço *" : "Nome do produto *"}
        </Label>
        <Input
          id="descricao"
          ref={descricaoInputRef}
          placeholder={
            tipoItem === "servico"
              ? "Ex: Troca de correia, Diagnóstico elétrico..."
              : "Ex: Filtro de óleo, Pastilha de freio..."
          }
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="h-12"
        />
      </div>

      {/* Valor e Quantidade */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="valor">{tipoItem === "servico" ? "Valor do serviço (R$) *" : "Valor da peça (R$)"}</Label>
          <CurrencyInput value={valor} onValueChange={setValor} className="h-12" />
          {tipoItem === "peca" && (
            <p className="text-[10px] text-muted-foreground">Opcional se você cobrar só a mão de obra e pegar a peça do estoque depois.</p>
          )}
        </div>

        {tipoItem === "peca" && (
          <div className="space-y-2">
            <Label htmlFor="quantidade">Qtd</Label>
            <Input
              id="quantidade"
              type="number"
              inputMode="numeric"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="h-12"
            />
          </div>
        )}
      </div>

      {/* Mão de obra — always visible for peça type */}
      {tipoItem === "peca" && (
        <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Label htmlFor="mao-obra-livre" className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            Mão de obra desta peça (R$)
          </Label>
          <CurrencyInput value={valorMaoObra} onValueChange={setValorMaoObra} className="h-12" placeholder="0,00 (opcional)" />
          <p className="text-[10px] text-muted-foreground">Quanto cobrar pra instalar/trocar esta peça</p>
        </div>
      )}

      {/* Custo de compra — opcional, calcula lucro real */}
      {tipoItem === "peca" && (
        <div className="space-y-2 p-3 rounded-lg bg-success/5 border border-success/20">
          <Label htmlFor="custo-livre" className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-success" />
            Custo de compra (R$)
          </Label>
          <CurrencyInput value={custoUnitario} onValueChange={setCustoUnitario} className="h-12" placeholder="0,00 (opcional)" />
          <p className="text-[10px] text-muted-foreground">
            Quanto você pagou nesta peça. Preencha pra ver o <strong>lucro real</strong> da OS.
          </p>
        </div>
      )}

      {/* Resumo */}
      {descricao && ((parseFloat(valor) || 0) > 0 || (parseFloat(valorMaoObra) || 0) > 0) && (
        <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{tipoItem === "servico" ? "Serviço:" : "Peça:"}</span>
              <span className="text-sm font-semibold">
                R$ {((parseFloat(valor) || 0) * (parseInt(quantidade) || 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {(parseFloat(valorMaoObra) || 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Mão de obra:</span>
                <span className="text-sm font-semibold">
                  R$ {(parseFloat(valorMaoObra) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-accent/20 pt-1">
              <span className="text-sm font-medium">Total:</span>
              <span className="text-lg font-bold text-accent">
                R$ {(((parseFloat(valor) || 0) * (parseInt(quantidade) || 1)) + (parseFloat(valorMaoObra) || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {tipoItem === "peca" && (parseFloat(custoUnitario) || 0) > 0 && (() => {
              const venda = (parseFloat(valor) || 0) * (parseInt(quantidade) || 1);
              const mo = parseFloat(valorMaoObra) || 0;
              const custo = (parseFloat(custoUnitario) || 0) * (parseInt(quantidade) || 1);
              const lucro = venda + mo - custo;
              const margem = (venda + mo) > 0 ? (lucro / (venda + mo)) * 100 : 0;
              return (
                <div className="flex justify-between items-center pt-1 mt-1 border-t border-success/20">
                  <span className="text-xs text-muted-foreground">Lucro estimado:</span>
                  <span className={cn("text-sm font-bold", lucro >= 0 ? "text-success" : "text-destructive")}>
                    R$ {lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    <span className="text-[10px] ml-1 opacity-75">({margem.toFixed(0)}%)</span>
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Botões */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => editingItem ? handleOpenChange(false) : setView("menu")} className="flex-1 h-12">
          {editingItem ? "Cancelar" : "Voltar"}
        </Button>
        <Button
          type="submit"
          disabled={loading || !descricao.trim() || (tipoItem === "servico" ? (parseFloat(valor) || 0) <= 0 : (parseFloat(valor) || 0) <= 0 && (parseFloat(valorMaoObra) || 0) <= 0)}
          className="flex-1 h-12 bg-accent hover:bg-accent/90"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              {editingItem ? "Salvar alterações" : "Adicionar"}
            </>
          )}
        </Button>
      </div>
    </form>
  );

  // ===== RENDER: Header =====
  const getTitle = () => {
    if (showSavePrompt) return "Salvar serviço?";
    if (editingItem) return "Editar item";
    switch (view) {
      case "estoque":
        return "Selecionar do Estoque";
      case "catalogo":
        return "Serviços";
      case "livre":
        return "Item Livre";
      default:
        return "Adicionar Item";
    }
  };

  const HeaderContent = (
    <div className="flex items-center gap-2">
      {view !== "menu" && !showSavePrompt && !editingItem && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setView("menu")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
      )}
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
        {view === "estoque" ? (
          <Package className="w-5 h-5 text-primary" />
        ) : view === "catalogo" ? (
          <Wrench className="w-5 h-5 text-success" />
        ) : (
          <Zap className="w-5 h-5 text-accent" />
        )}
      </div>
      <span>{getTitle()}</span>
    </div>
  );

  // ===== RENDER: View Router =====
  const currentContent =
    view === "estoque" ? EstoqueContent :
    view === "catalogo" ? CatalogoContent :
    view === "livre" ? LivreContent :
    MenuContent;

  const CloseConfirmDialog = (
    <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Item não adicionado</AlertDialogTitle>
          <AlertDialogDescription>
            Você selecionou "{selectedItem?.nome}" mas não adicionou à OS. Deseja adicionar antes de fechar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleConfirmCloseWithout}>
            Fechar sem adicionar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmAddAndClose}>
            Adicionar e fechar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        {CloseConfirmDialog}
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[90dvh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>{HeaderContent}</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
              {currentContent}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {CloseConfirmDialog}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border/60">
            <DialogTitle className="min-w-0 pr-10 [&_span]:truncate">{HeaderContent}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-5rem)] overflow-y-auto overflow-x-hidden overscroll-contain">
            {currentContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
