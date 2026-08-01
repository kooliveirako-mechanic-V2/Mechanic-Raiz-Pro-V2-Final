import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEstoque, ItemEstoque, ItemEstoqueInput } from "@/hooks/useEstoque";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { HistoricoMovimentacoes } from "@/components/estoque/HistoricoMovimentacoes";
import { Loader2, Package, Trash2, Car, Bike, MapPin, Phone, Building2, History, Info, Cpu, Check } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { logBusinessEvent } from "@/lib/errorHandling";
import { handleFormKeyDown } from "@/lib/formGuard";
import { useModalClose } from "@/hooks/useModalClose";

const estoqueSchema = z.object({
  nome: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Máximo 100 caracteres"),
  categoria: z.string().min(1, "Selecione uma categoria"),
  quantidade: z.number().min(0, "Quantidade não pode ser negativa"),
  custo_unitario: z.number().min(0, "Custo não pode ser negativo"),
  preco_venda: z.number().min(0, "Preço não pode ser negativo"),
  alerta_minimo: z.number().min(0, "Alerta não pode ser negativo"),
});

interface EstoqueFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ItemEstoque | null;
}

// Categorias padrão para oficinas mecânicas
const categoriasOficina = [
  "Óleo",
  "Filtro",
  "Peça",
  "Pneu",
  "Bateria",
  "Fluído",
  "Ferramenta",
  "Acessório",
  "Outro",
];

// Categorias específicas para Auto Elétrica
const categoriasAutoEletrica = [
  "Bateria",
  "Alternador",
  "Motor de Partida",
  "Módulo / Central",
  "Sensor",
  "Relé",
  "Fusível",
  "Chicote / Cabo",
  "Conector",
  "Lâmpada / LED",
  "Bobina de Ignição",
  "Velas / Cabos",
  "Buzina / Sirene",
  "Retrovisor Elétrico",
  "Vidro Elétrico",
  "Som / Multimídia",
  "Alarme / Trava",
  "Componente Eletrônico",
  "Ferramenta de Diagnóstico",
  "Outro",
];

export function EstoqueFormModal({ open, onOpenChange, item }: EstoqueFormModalProps) {
  const { createItem, updateItem, deleteItem } = useEstoque();
  const { oficinaAtual } = useOficina();
  const { isAutoEletrica, labels } = useOficinaLabels();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("info");
  
  // BLINDAGEM: Proteção contra duplo clique
  const isSubmittingRef = useRef(false);
  const lastSubmitRef = useRef<number>(0);
  const formRef = useRef<HTMLFormElement>(null);
  
  // Determinar tipo de oficina para filtrar opções
  const tipoOficina = oficinaAtual?.tipo || "ambos";
  const showCarro = tipoOficina === "carro" || tipoOficina === "ambos";
  const showMoto = tipoOficina === "moto" || tipoOficina === "ambos";
  const tipoDefault: "carro" | "moto" | "ambos" = 
    tipoOficina === "carro" ? "carro" : 
    tipoOficina === "moto" ? "moto" : "ambos";
  
  // Categorias baseadas no tipo de oficina
  const categorias = isAutoEletrica ? categoriasAutoEletrica : categoriasOficina;
  
  // Campos básicos
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [tipoVeiculo, setTipoVeiculo] = useState<"carro" | "moto" | "ambos">(tipoDefault);
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [alertaMinimo, setAlertaMinimo] = useState("5");
  
  // Novos campos
  const [localizacao, setLocalizacao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ncm, setNcm] = useState("");
  const [tipoItem, setTipoItem] = useState("peca");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [fornecedorTelefone, setFornecedorTelefone] = useState("");
  const [fornecedorEmail, setFornecedorEmail] = useState("");

  const isEditing = !!item;

  // Sem useAutoSave neste modal: a guarda de sujo é a ÚNICA rede, inclusive em
  // edição, que hidrata pelo useEffect abaixo. `!!item` seria true antes dos
  // setState rodarem → snapshot pegaria campos vazios × dados = falso-sujo.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) {
      setHydrated(false);
      setErrors({});
      return;
    }
    if (item) {
      setNome(item.nome);
      // Verifica se a categoria do item está na lista padrão
      const isCustomCategory = !categorias.includes(item.categoria);
      if (isCustomCategory && item.categoria) {
        setCategoria(item.categoria);
        setCategoriaCustom(item.categoria);
        setIsCustomCategoryMode(true);
      } else {
        setCategoria(item.categoria);
        setCategoriaCustom("");
        setIsCustomCategoryMode(false);
      }
      setTipoVeiculo(item.tipo_veiculo || tipoDefault);
      setQuantidade(item.quantidade.toString());
      setCustoUnitario(item.custo_unitario.toString());
      setPrecoVenda(item.preco_venda.toString());
      setAlertaMinimo(item.alerta_minimo.toString());
      // Novos campos
      setLocalizacao(item.localizacao || "");
      setCodigo(item.codigo || "");
      setNcm(item.ncm || "");
      setTipoItem(item.tipo_item || "peca");
      setFornecedorNome(item.fornecedor_nome || "");
      setFornecedorTelefone(item.fornecedor_telefone || "");
      setFornecedorEmail(item.fornecedor_email || "");
      setActiveTab("info");
    } else {
      resetForm();
    }
    setErrors({});
    // Snapshot só depois que os campos acima foram preenchidos nesta abertura.
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, open, tipoDefault, categorias]);

  const resetForm = () => {
    setNome("");
    setCategoria(isAutoEletrica ? "Bateria" : "Peça");
    setCategoriaCustom("");
    setIsCustomCategoryMode(false);
    setTipoVeiculo(tipoDefault);
    setQuantidade("");
    setCustoUnitario("");
    setPrecoVenda("");
    setAlertaMinimo("5");
    setLocalizacao("");
    setCodigo("");
    setNcm("");
    setTipoItem("peca");
    setFornecedorNome("");
    setFornecedorTelefone("");
    setFornecedorEmail("");
    setActiveTab("info");
  };

  // Snapshot = os 16 campos de DADOS. Os 5 restantes dos "21 estados" são de
  // UI/controle e ficam de fora: loading, deleteDialogOpen, deleteLoading,
  // errors, activeTab (aba não é dado do item). Campos numéricos entram como
  // string — "0" é valor preenchido (custo zerado legítimo), não vazio.
  const formData = {
    nome, categoria, categoriaCustom, isCustomCategoryMode, tipoVeiculo,
    quantidade, custoUnitario, precoVenda, alertaMinimo, localizacao,
    codigo, ncm, tipoItem, fornecedorNome, fornecedorTelefone, fornecedorEmail,
  };

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: formData,
    onOpenChange,
    onReset: resetForm,
    snapshotReady: hydrated,
  });

  const validateForm = useCallback((): boolean => {
    const result = estoqueSchema.safeParse({
      nome,
      categoria: categoria.trim(),
      quantidade: quantidade ? parseInt(quantidade) : 0,
      custo_unitario: custoUnitario ? parseFloat(custoUnitario) : 0,
      preco_venda: precoVenda ? parseFloat(precoVenda) : 0,
      alerta_minimo: alertaMinimo ? parseInt(alertaMinimo) : 5,
    });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const errorMessages: string[] = [];
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
          errorMessages.push(err.message);
        }
      });
      setErrors(fieldErrors);

      // Scroll to first error field
      if (formRef.current) {
        const firstErrorKey = Object.keys(fieldErrors)[0];
        const el = formRef.current.querySelector(`[id="${firstErrorKey}"]`) as HTMLElement;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }

      toast.error("Corrija os erros no formulário", {
        description: errorMessages.join(" • "),
      });
      return false;
    }
    
    setErrors({});
    return true;
  }, [nome, categoria, quantidade, custoUnitario, precoVenda, alertaMinimo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // BLINDAGEM MOBILE: blur teclado antes de processar
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    if (!validateForm()) {
      return;
    }
    
    // BLINDAGEM: Proteção contra duplo clique/submit
    const now = Date.now();
    if (isSubmittingRef.current || now - lastSubmitRef.current < 1000) {
      console.log("[Estoque Form] Submit bloqueado - ação já em andamento");
      return;
    }
    
    isSubmittingRef.current = true;
    lastSubmitRef.current = now;
    setLoading(true);

    try {
      const data: ItemEstoqueInput = {
        nome: nome.trim(),
        categoria,
        tipo_veiculo: tipoVeiculo,
        quantidade: quantidade ? parseInt(quantidade) : 0,
        custo_unitario: custoUnitario ? parseFloat(custoUnitario) : 0,
        preco_venda: precoVenda ? parseFloat(precoVenda) : 0,
        alerta_minimo: alertaMinimo ? parseInt(alertaMinimo) : 5,
        localizacao: localizacao.trim() || undefined,
        codigo: codigo.trim() || undefined,
        ncm: ncm.trim() || undefined,
        tipo_item: tipoItem || "peca",
        fornecedor_nome: fornecedorNome.trim() || undefined,
        fornecedor_telefone: fornecedorTelefone.trim() || undefined,
        fornecedor_email: fornecedorEmail.trim() || undefined,
      };

      if (isEditing && item) {
        await updateItem.mutateAsync({ id: item.id, ...data });
        logBusinessEvent("estoque_atualizado", { itemId: item.id, nome: data.nome });
      } else {
        await createItem.mutateAsync(data);
        logBusinessEvent("estoque_criado", { nome: data.nome, quantidade: data.quantidade });
      }

      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    
    setDeleteLoading(true);
    try {
      await deleteItem.mutateAsync(item.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCallFornecedor = () => {
    if (fornecedorTelefone) {
      window.open(`tel:${fornecedorTelefone.replace(/\D/g, "")}`, "_blank");
    }
  };

  const handleWhatsAppFornecedor = () => {
    if (fornecedorTelefone) {
      const phone = fornecedorTelefone.replace(/\D/g, "");
      const message = encodeURIComponent(`Olá! Preciso fazer um pedido de "${nome}".`);
      window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
    }
  };

  const margemLucro = custoUnitario && precoVenda && parseFloat(custoUnitario) > 0
    ? (((parseFloat(precoVenda) - parseFloat(custoUnitario)) / parseFloat(custoUnitario)) * 100).toFixed(1)
    : "0";

  const HeaderIcon = isAutoEletrica ? (
    <Cpu className="w-5 h-5 text-amber-500" />
  ) : (
    <Package className="w-5 h-5 text-accent" />
  );

  const HeaderTitle = isEditing 
    ? (isAutoEletrica ? "Editar Componente" : "Editar Item")
    : (isAutoEletrica ? "Novo Componente Elétrico" : "Novo Item de Estoque");

  const ModalContent = (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="flex-1 flex flex-col overflow-hidden">
      {isEditing ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info" className="text-xs sm:text-sm">
              <Info className="w-3.5 h-3.5 mr-1.5" />
              Info
            </TabsTrigger>
            <TabsTrigger value="fornecedor" className="text-xs sm:text-sm">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              Fornecedor
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-xs sm:text-sm">
              <History className="w-3.5 h-3.5 mr-1.5" />
              Histórico
            </TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="info" className="m-0">
              <FormFields
                isMobile={isMobile}
                nome={nome} setNome={setNome}
                categoria={categoria} setCategoria={setCategoria}
                tipoVeiculo={tipoVeiculo} setTipoVeiculo={setTipoVeiculo}
                quantidade={quantidade} setQuantidade={setQuantidade}
                custoUnitario={custoUnitario} setCustoUnitario={setCustoUnitario}
                precoVenda={precoVenda} setPrecoVenda={setPrecoVenda}
                alertaMinimo={alertaMinimo} setAlertaMinimo={setAlertaMinimo}
                localizacao={localizacao} setLocalizacao={setLocalizacao}
                codigo={codigo} setCodigo={setCodigo}
                ncm={ncm} setNcm={setNcm}
                showCarro={showCarro} showMoto={showMoto}
                errors={errors}
                margemLucro={margemLucro}
                categorias={categorias}
                isAutoEletrica={isAutoEletrica}
                categoriaCustom={categoriaCustom}
                setCategoriaCustom={setCategoriaCustom}
                isCustomMode={isCustomCategoryMode}
                setIsCustomMode={setIsCustomCategoryMode}
              />
            </TabsContent>
            
            <TabsContent value="fornecedor" className="m-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fornecedorNome">Nome do Fornecedor</Label>
                  <Input
                    id="fornecedorNome"
                    placeholder="Ex: Auto Peças Silva"
                    value={fornecedorNome}
                    onChange={(e) => setFornecedorNome(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fornecedorTelefone">Telefone</Label>
                  <Input
                    id="fornecedorTelefone"
                    placeholder="(11) 99999-9999"
                    value={fornecedorTelefone}
                    onChange={(e) => setFornecedorTelefone(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fornecedorEmail">Email</Label>
                  <Input
                    id="fornecedorEmail"
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={fornecedorEmail}
                    onChange={(e) => setFornecedorEmail(e.target.value)}
                  />
                </div>
                
                {fornecedorTelefone && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleCallFornecedor}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Ligar
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={handleWhatsAppFornecedor}
                    >
                      WhatsApp
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="historico" className="m-0">
              {item && <HistoricoMovimentacoes estoqueId={item.id} />}
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <FormFields
            isMobile={isMobile}
            nome={nome} setNome={setNome}
            categoria={categoria} setCategoria={setCategoria}
            tipoVeiculo={tipoVeiculo} setTipoVeiculo={setTipoVeiculo}
            quantidade={quantidade} setQuantidade={setQuantidade}
            custoUnitario={custoUnitario} setCustoUnitario={setCustoUnitario}
            precoVenda={precoVenda} setPrecoVenda={setPrecoVenda}
            alertaMinimo={alertaMinimo} setAlertaMinimo={setAlertaMinimo}
            localizacao={localizacao} setLocalizacao={setLocalizacao}
            codigo={codigo} setCodigo={setCodigo}
            ncm={ncm} setNcm={setNcm}
            showCarro={showCarro} showMoto={showMoto}
            errors={errors}
            margemLucro={margemLucro}
            categorias={categorias}
            isAutoEletrica={isAutoEletrica}
            categoriaCustom={categoriaCustom}
            setCategoriaCustom={setCategoriaCustom}
            isCustomMode={isCustomCategoryMode}
            setIsCustomMode={setIsCustomCategoryMode}
          />
        </div>
      )}

      <Separator className="my-3" />

      <div className="sticky bottom-0 bg-background pt-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] flex justify-between gap-2">
        <div>
          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-accent hover:bg-accent/90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>
    </form>
  );

  // Mobile: Drawer from bottom
  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="px-4 pb-6 max-h-[90dvh] flex flex-col">
            <DrawerHeader className="text-left px-0 shrink-0 flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2 text-lg">
                {HeaderIcon}
                {HeaderTitle}
              </DrawerTitle>
              <Button
                type="button"
                size="sm"
                className="bg-accent hover:bg-accent/90 min-h-[44px] min-w-[44px]"
                disabled={loading}
                onClick={() => formRef.current?.requestSubmit()}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
            </DrawerHeader>
            {ModalContent}
          </DrawerContent>
        </Drawer>

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir item do estoque"
          description={`Tem certeza que deseja excluir "${item?.nome}"? Esta ação não pode ser desfeita.`}
          confirmText="Excluir"
          onConfirm={handleDelete}
          isLoading={deleteLoading}
          variant="destructive"
        />

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Sair sem salvar?"
          description="Você alterou os dados deste item e não salvou. As alterações serão descartadas."
          confirmText="Descartar"
          cancelText="Continuar editando"
          onConfirm={confirmClose}
        />
      </>
    );
  }

  // Desktop/Tablet: Dialog
  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {HeaderIcon}
              {HeaderTitle}
            </DialogTitle>
          </DialogHeader>

          {ModalContent}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Excluir item do estoque"
        description={`Tem certeza que deseja excluir "${item?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        isLoading={deleteLoading}
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sair sem salvar?"
        description="Você alterou os dados deste item e não salvou. As alterações serão descartadas."
        confirmText="Descartar"
        cancelText="Continuar editando"
        onConfirm={confirmClose}
      />
    </>
  );
}

// Componente separado para os campos do formulário
interface FormFieldsProps {
  isMobile?: boolean;
  nome: string; setNome: (v: string) => void;
  categoria: string; setCategoria: (v: string) => void;
  tipoVeiculo: "carro" | "moto" | "ambos"; setTipoVeiculo: (v: "carro" | "moto" | "ambos") => void;
  quantidade: string; setQuantidade: (v: string) => void;
  custoUnitario: string; setCustoUnitario: (v: string) => void;
  precoVenda: string; setPrecoVenda: (v: string) => void;
  alertaMinimo: string; setAlertaMinimo: (v: string) => void;
  localizacao: string; setLocalizacao: (v: string) => void;
  codigo: string; setCodigo: (v: string) => void;
  ncm: string; setNcm: (v: string) => void;
  showCarro: boolean;
  showMoto: boolean;
  errors: Record<string, string>;
  margemLucro: string;
  categorias: string[];
  isAutoEletrica: boolean;
  categoriaCustom?: string;
  setCategoriaCustom?: (v: string) => void;
  isCustomMode: boolean;
  setIsCustomMode: (v: boolean) => void;
}

function FormFields({
  isMobile = false,
  nome, setNome,
  categoria, setCategoria,
  tipoVeiculo, setTipoVeiculo,
  quantidade, setQuantidade,
  custoUnitario, setCustoUnitario,
  precoVenda, setPrecoVenda,
  alertaMinimo, setAlertaMinimo,
  localizacao, setLocalizacao,
  codigo, setCodigo,
  ncm, setNcm,
  showCarro, showMoto,
  errors,
  margemLucro,
  categorias,
  isAutoEletrica,
  categoriaCustom = "",
  setCategoriaCustom,
  isCustomMode,
  setIsCustomMode,
}: FormFieldsProps) {
  const showCustomInput = isCustomMode;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="nome">
            {isAutoEletrica ? "Nome do Componente *" : "Nome do Item *"}
          </Label>
          <Input
            id="nome"
            placeholder={isAutoEletrica ? "Ex: Alternador Bosch 90A" : "Ex: Óleo 5W30"}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={100}
            className={`h-12 text-base ${errors.nome ? "border-destructive" : ""}`}
          />
          {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="codigo">
            {isAutoEletrica ? "Part Number" : "Código"}
          </Label>
          <Input
            id="codigo"
            placeholder={isAutoEletrica ? "PN / Ref" : "SKU"}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>

      {/* Localização */}
      <div className="space-y-2">
        <Label htmlFor="localizacao" className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          {isAutoEletrica ? "Localização no Estoque" : "Onde está guardado?"}
        </Label>
        <Input
          id="localizacao"
          placeholder={isAutoEletrica ? "Ex: Bancada 2, Gaveta Módulos" : "Ex: Prateleira A3, Gaveta 2"}
          value={localizacao}
          onChange={(e) => setLocalizacao(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      {/* Tipo de Veículo */}
      {showCarro && showMoto && (
        <div className="space-y-2">
          <Label>Para qual veículo?</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={tipoVeiculo === "carro" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1", tipoVeiculo === "carro" && "bg-accent")}
              onClick={() => setTipoVeiculo("carro")}
            >
              <Car className="w-4 h-4 mr-1" />
              Carro
            </Button>
            <Button
              type="button"
              variant={tipoVeiculo === "moto" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1", tipoVeiculo === "moto" && "bg-accent")}
              onClick={() => setTipoVeiculo("moto")}
            >
              <Bike className="w-4 h-4 mr-1" />
              Moto
            </Button>
            <Button
              type="button"
              variant={tipoVeiculo === "ambos" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1", tipoVeiculo === "ambos" && "bg-primary")}
              onClick={() => setTipoVeiculo("ambos")}
            >
              Ambos
            </Button>
          </div>
        </div>
      )}

      {/* Categoria - full width quando em modo custom no mobile */}
      {showCustomInput ? (
        <div className="space-y-2">
          <Label className="flex items-center justify-between">
            <span>Categoria *</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCustomMode(false);
                setCategoria("");
                setCategoriaCustom?.("");
              }}
              className="text-xs text-muted-foreground hover:underline"
            >
              ← Voltar
            </button>
          </Label>
          <Input
            placeholder="Digite o nome da nova categoria"
            value={categoriaCustom}
            onChange={(e) => {
              const value = e.target.value;
              setCategoriaCustom?.(value);
              setCategoria(value.trim() || "");
            }}
            className={cn("h-12 text-base", errors.categoria ? "border-destructive" : "")}
            autoFocus={!isMobile}
          />
          {errors.categoria && <p className="text-xs text-destructive">{errors.categoria}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>Categoria *</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsCustomMode(true);
                  setCategoria("");
                  setCategoriaCustom?.("");
                }}
                className="text-sm text-accent hover:underline font-semibold min-h-[44px] min-w-[44px] flex items-center justify-center px-2"
              >
                + Nova
              </button>
            </Label>
            <Select 
              value={categoria} 
              onValueChange={(value) => {
                setCategoria(value);
                setCategoriaCustom?.("");
              }}
            >
              <SelectTrigger className={`h-12 text-base ${errors.categoria ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent 
                className="z-[9999] bg-popover"
                position="popper"
                sideOffset={4}
              >
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoria && <p className="text-xs text-destructive">{errors.categoria}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input
              id="quantidade"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              min={0}
              className="h-12 text-base"
            />
          </div>
        </div>
      )}

      {/* Quantidade separada quando custom mode está ativo */}
      {showCustomInput && (
        <div className="space-y-2">
          <Label htmlFor="quantidade">Quantidade</Label>
          <Input
            id="quantidade"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            min={0}
            className="h-12 text-base"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="custo">Custo (R$)</Label>
          <Input
            id="custo"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={custoUnitario}
            onChange={(e) => setCustoUnitario(e.target.value)}
            min={0}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="venda">Venda (R$)</Label>
          <Input
            id="venda"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            value={precoVenda}
            onChange={(e) => setPrecoVenda(e.target.value)}
            min={0}
            className="h-12 text-base"
          />
        </div>
      </div>

      {custoUnitario && precoVenda && parseFloat(custoUnitario) > 0 && (
        <div className={`p-3 rounded-lg text-sm font-medium ${
          parseFloat(margemLucro) > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        }`}>
          Margem de Lucro: {margemLucro}%
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="alerta">Alerta Mínimo</Label>
          <Input
            id="alerta"
            type="number"
            inputMode="numeric"
            placeholder="5"
            value={alertaMinimo}
            onChange={(e) => setAlertaMinimo(e.target.value)}
            min={0}
            className="h-12 text-base"
          />
        <p className="text-xs text-muted-foreground">
          Aviso quando quantidade atingir este valor
        </p>
      </div>

      {/* Campos avançados (NCM) - colapsado por padrão */}
      {ncm !== undefined && ncm.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="ncm" className="text-xs text-muted-foreground">NCM (Classificação Fiscal)</Label>
          <Input
            id="ncm"
            placeholder="Ex: 8708.99.90"
            value={ncm}
            onChange={(e) => setNcm(e.target.value)}
            maxLength={20}
            className="h-12 text-base"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setNcm(" ");
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          + Adicionar NCM (uso fiscal)
        </button>
      )}
    </div>
  );
}