import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, AlertTriangle, Building2, ChevronRight, Cpu, Wrench, Zap } from "lucide-react";
import { useEstoque, ItemEstoque } from "@/hooks/useEstoque";
import { EstoqueFormModal } from "@/components/forms/EstoqueFormModal";
import { EstoqueProfitSummary } from "@/components/estoque/EstoqueProfitSummary";
import { EstoqueQuickActions } from "@/components/estoque/EstoqueQuickActions";
import { CatalogoServicosTab } from "@/components/estoque/CatalogoServicosTab";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { useOficina } from "@/contexts/OficinaContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { PageLoader } from "@/components/ui/loading-states";
import { usePlan } from "@/hooks/usePlan";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { useModalUrl } from "@/hooks/useModalUrl";
import { cn } from "@/lib/utils";

export default function Estoque() {
  const { itens, itensAlertaBaixo, valorTotalEstoque, isLoading } = useEstoque();
  const { hasFeature, isLoading: planLoading } = usePlan();
  const { labels, isAutoEletrica } = useOficinaLabels();
  const { oficinaAtual } = useOficina();
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [itemEdit, setItemEdit] = useState<ItemEstoque | null>(null);
  const [vendaRapidaOpen, setVendaRapidaOpen] = useModalUrl("venda-rapida");
  const [filtro, setFiltro] = useState<"todos" | "baixo">("todos");
  const [lastClickedItem, setLastClickedItem] = useState<ItemEstoque | null>(null);

  const filteredItens = useMemo(() => itens.filter((item) => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.localizacao?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filtro === "baixo") {
      return matchesSearch && item.quantidade <= item.alerta_minimo;
    }
    return matchesSearch;
  }), [itens, searchTerm, filtro]);

  const handleEdit = (item: ItemEstoque) => { 
    setItemEdit(item);
    setLastClickedItem(item);
    setModalOpen(true); 
  };
  
  const handleNew = () => { 
    setItemEdit(null); 
    setModalOpen(true); 
  };

  if (isLoading || planLoading) {
    return (
      <MainLayout>
        <PageLoader message="Carregando estoque..." />
      </MainLayout>
    );
  }

  if (!hasFeature("estoque")) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <UpgradePrompt feature="estoque" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4" style={{ overscrollBehaviorY: "contain" }}>
        {/* Header - Responsivo para evitar sobreposição */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2 truncate">
              {isAutoEletrica && <Cpu className="w-5 h-5 text-warning flex-shrink-0" />}
              {isAutoEletrica ? "Componentes" : "Estoque"}
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              {itens.length} {isAutoEletrica ? "componentes" : "itens"} • R$ {valorTotalEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setVendaRapidaOpen(true)}
              className="bg-warning hover:bg-warning/90 text-warning-foreground gap-1.5"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Venda Rápida</span>
              <span className="sm:hidden">Venda</span>
            </Button>
            <EstoqueQuickActions 
              onNewItem={handleNew}
              selectedItem={lastClickedItem}
              onDuplicateComplete={() => setLastClickedItem(null)}
            />
          </div>
        </div>

        {/* BLINDAGEM: banners de retomada de rascunho */}
        <DraftResumeBanner
          draftKey={`venda-rapida-${oficinaAtual?.id || "global"}`}
          label="venda rápida"
          hidden={vendaRapidaOpen || modalOpen}
          onResume={() => setVendaRapidaOpen(true)}
        />
        <DraftResumeBanner
          draftKey={`entrada-lote-${oficinaAtual?.id || "global"}`}
          label="entrada em lote"
          hidden={modalOpen || vendaRapidaOpen}
          onResume={() => window.dispatchEvent(new Event("open-entrada-lote"))}
        />


        <Tabs defaultValue="pecas" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full sm:w-[420px]">
            <TabsTrigger value="pecas" className="gap-2">
              <Package className="w-4 h-4" />
              Peças e Produtos
            </TabsTrigger>
            <TabsTrigger value="servicos" className="gap-2">
              <Wrench className="w-4 h-4" />
              Serviços
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pecas" className="space-y-4 mt-0">
            {/* Resumo de Lucro */}
            {itens.length > 0 && (
              <EstoqueProfitSummary itens={itens} />
            )}

            {/* Busca com indicador de estoque baixo */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, categoria ou localização..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {itensAlertaBaixo.length > 0 && (
                <Button
                  variant={filtro === "baixo" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setFiltro(filtro === "baixo" ? "todos" : "baixo")}
                  className={cn(
                    "gap-1.5 flex-shrink-0",
                    filtro !== "baixo" && "border-warning/50 text-warning hover:bg-warning/10"
                  )}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{itensAlertaBaixo.length} baixo</span>
                  <span className="sm:hidden">{itensAlertaBaixo.length}</span>
                </Button>
              )}
            </div>

            {/* Lista de Itens */}
            {filteredItens.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">
                  {itens.length === 0 ? "Estoque vazio." : "Nenhum item encontrado."}
                </p>
                {itens.length === 0 && (
                  <Button onClick={handleNew} size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Adicionar item
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="hidden md:grid md:grid-cols-12 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2">Categoria</div>
                  <div className="col-span-1 text-center">Qtd</div>
                  <div className="col-span-2 text-right">Custo</div>
                  <div className="col-span-2 text-right">Venda</div>
                </div>

                <div className="divide-y divide-border">
                  {filteredItens.map((item) => {
                    const isLowStock = item.quantidade <= (item.alerta_minimo || 0);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ backgroundColor: "hsl(var(--muted) / 0.3)" }}
                        className="p-4 cursor-pointer transition-colors"
                        onClick={() => handleEdit(item)}
                      >
                        {/* Mobile Layout */}
                        <div className="md:hidden flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                            isLowStock ? "bg-destructive/10" : "bg-muted"
                          )}>
                            <Package className={cn("w-4 h-4", isLowStock ? "text-destructive" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-sm font-medium text-foreground truncate">{item.nome}</h3>
                              <span className={cn(
                                "text-sm font-bold flex-shrink-0 tabular-nums",
                                isLowStock ? "text-destructive" : "text-foreground"
                              )}>
                                {item.quantidade}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-muted-foreground truncate">
                                Custo: R$ {Number(item.custo_unitario || 0).toFixed(2)}
                              </span>
                              <span className="text-xs font-semibold text-success flex-shrink-0 tabular-nums">
                                Venda: R$ {Number(item.preco_venda || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Desktop Layout */}
                        <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                          <div className="col-span-5 flex items-center gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                              isLowStock ? "bg-destructive/10" : "bg-warning/10"
                            )}>
                              <Package className={cn("w-4 h-4", isLowStock ? "text-destructive" : "text-warning")} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-foreground truncate block">{item.nome}</span>
                              {item.fornecedor_nome && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {item.fornecedor_nome}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <Badge variant="outline" className="font-normal text-xs">
                              {item.categoria}
                            </Badge>
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={cn(
                              "font-bold px-2 py-1 rounded text-sm",
                              isLowStock ? "bg-destructive/10 text-destructive" : ""
                            )}>
                              {item.quantidade}
                            </span>
                          </div>
                          <div className="col-span-2 text-right text-muted-foreground text-sm">
                            R$ {Number(item.custo_unitario || 0).toFixed(2)}
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <span className="font-semibold text-success">
                              R$ {Number(item.preco_venda || 0).toFixed(2)}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="servicos" className="mt-0">
            <CatalogoServicosTab />
          </TabsContent>
        </Tabs>
      </div>
      
      <EstoqueFormModal open={modalOpen} onOpenChange={setModalOpen} item={itemEdit} />
    </MainLayout>
  );
}
