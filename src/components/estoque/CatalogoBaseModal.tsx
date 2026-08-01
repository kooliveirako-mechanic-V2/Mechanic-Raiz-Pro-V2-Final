import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEstoque } from "@/hooks/useEstoque";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Search, Plus, Package, Check, Loader2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface CatalogoBaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CatalogItem {
  nome: string;
  categoria: string;
  sugestao_preco: number;
  sugestao_custo: number;
}

// Catálogo base para oficinas mecânicas
const catalogoMecanica: CatalogItem[] = [
  // Óleos
  { nome: "Óleo Motor 5W30 Sintético (1L)", categoria: "Óleo", sugestao_custo: 35, sugestao_preco: 65 },
  { nome: "Óleo Motor 15W40 Mineral (1L)", categoria: "Óleo", sugestao_custo: 18, sugestao_preco: 35 },
  { nome: "Óleo Câmbio ATF (1L)", categoria: "Óleo", sugestao_custo: 25, sugestao_preco: 50 },
  { nome: "Óleo de Freio DOT 4 (500ml)", categoria: "Fluído", sugestao_custo: 18, sugestao_preco: 35 },
  { nome: "Fluído de Arrefecimento (1L)", categoria: "Fluído", sugestao_custo: 15, sugestao_preco: 30 },
  // Filtros
  { nome: "Filtro de Óleo Universal", categoria: "Filtro", sugestao_custo: 15, sugestao_preco: 35 },
  { nome: "Filtro de Ar Motor", categoria: "Filtro", sugestao_custo: 25, sugestao_preco: 55 },
  { nome: "Filtro de Combustível", categoria: "Filtro", sugestao_custo: 20, sugestao_preco: 45 },
  { nome: "Filtro de Cabine/Ar Condicionado", categoria: "Filtro", sugestao_custo: 30, sugestao_preco: 65 },
  // Peças de Desgaste
  { nome: "Pastilha de Freio Dianteira (Jogo)", categoria: "Peça", sugestao_custo: 80, sugestao_preco: 150 },
  { nome: "Pastilha de Freio Traseira (Jogo)", categoria: "Peça", sugestao_custo: 60, sugestao_preco: 120 },
  { nome: "Disco de Freio Dianteiro (Unid)", categoria: "Peça", sugestao_custo: 90, sugestao_preco: 180 },
  { nome: "Correia Dentada", categoria: "Peça", sugestao_custo: 45, sugestao_preco: 95 },
  { nome: "Correia Poly-V (Alternador)", categoria: "Peça", sugestao_custo: 35, sugestao_preco: 75 },
  { nome: "Vela de Ignição (Unid)", categoria: "Peça", sugestao_custo: 25, sugestao_preco: 55 },
  { nome: "Amortecedor Dianteiro (Unid)", categoria: "Peça", sugestao_custo: 180, sugestao_preco: 350 },
  { nome: "Amortecedor Traseiro (Unid)", categoria: "Peça", sugestao_custo: 150, sugestao_preco: 290 },
  // Baterias
  { nome: "Bateria 60Ah", categoria: "Bateria", sugestao_custo: 280, sugestao_preco: 450 },
  { nome: "Bateria 45Ah", categoria: "Bateria", sugestao_custo: 220, sugestao_preco: 380 },
  // Acessórios
  { nome: "Lâmpada H4 (Par)", categoria: "Acessório", sugestao_custo: 25, sugestao_preco: 55 },
  { nome: "Lâmpada H7 (Par)", categoria: "Acessório", sugestao_custo: 30, sugestao_preco: 60 },
  { nome: "Palheta Limpador (Par)", categoria: "Acessório", sugestao_custo: 35, sugestao_preco: 70 },
];

// Catálogo base para auto elétricas
const catalogoAutoEletrica: CatalogItem[] = [
  // Baterias
  { nome: "Bateria 60Ah", categoria: "Bateria", sugestao_custo: 280, sugestao_preco: 450 },
  { nome: "Bateria 45Ah", categoria: "Bateria", sugestao_custo: 220, sugestao_preco: 380 },
  { nome: "Bateria 70Ah", categoria: "Bateria", sugestao_custo: 320, sugestao_preco: 520 },
  { nome: "Bateria Moto 5Ah", categoria: "Bateria", sugestao_custo: 80, sugestao_preco: 150 },
  // Alternadores
  { nome: "Alternador Recondicionado Universal", categoria: "Alternador", sugestao_custo: 250, sugestao_preco: 450 },
  { nome: "Regulador de Voltagem", categoria: "Alternador", sugestao_custo: 45, sugestao_preco: 95 },
  { nome: "Rolamento Alternador", categoria: "Alternador", sugestao_custo: 25, sugestao_preco: 55 },
  // Motor de Partida
  { nome: "Motor de Partida Recondicionado", categoria: "Motor de Partida", sugestao_custo: 280, sugestao_preco: 500 },
  { nome: "Bendix Motor Partida", categoria: "Motor de Partida", sugestao_custo: 60, sugestao_preco: 120 },
  { nome: "Induzido Motor Partida", categoria: "Motor de Partida", sugestao_custo: 80, sugestao_preco: 160 },
  // Componentes Elétricos
  { nome: "Relé Auxiliar 12V", categoria: "Relé", sugestao_custo: 8, sugestao_preco: 20 },
  { nome: "Fusível Lâmina 10A (10un)", categoria: "Fusível", sugestao_custo: 5, sugestao_preco: 15 },
  { nome: "Fusível Lâmina 15A (10un)", categoria: "Fusível", sugestao_custo: 5, sugestao_preco: 15 },
  { nome: "Fusível Lâmina 20A (10un)", categoria: "Fusível", sugestao_custo: 5, sugestao_preco: 15 },
  { nome: "Soquete Lâmpada H4", categoria: "Conector", sugestao_custo: 8, sugestao_preco: 18 },
  { nome: "Conector Macho/Fêmea (10un)", categoria: "Conector", sugestao_custo: 10, sugestao_preco: 25 },
  // Iluminação
  { nome: "Lâmpada H4 (Par)", categoria: "Lâmpada / LED", sugestao_custo: 25, sugestao_preco: 55 },
  { nome: "Lâmpada H7 (Par)", categoria: "Lâmpada / LED", sugestao_custo: 30, sugestao_preco: 60 },
  { nome: "Lâmpada LED T10 (Par)", categoria: "Lâmpada / LED", sugestao_custo: 15, sugestao_preco: 35 },
  { nome: "Lâmpada Placa LED", categoria: "Lâmpada / LED", sugestao_custo: 10, sugestao_preco: 25 },
  // Ignição
  { nome: "Bobina de Ignição Universal", categoria: "Bobina de Ignição", sugestao_custo: 80, sugestao_preco: 160 },
  { nome: "Cabo de Vela (Jogo)", categoria: "Velas / Cabos", sugestao_custo: 60, sugestao_preco: 120 },
  { nome: "Vela de Ignição NGK", categoria: "Velas / Cabos", sugestao_custo: 25, sugestao_preco: 55 },
  // Sensores
  { nome: "Sensor de Temperatura", categoria: "Sensor", sugestao_custo: 35, sugestao_preco: 75 },
  { nome: "Sensor de Rotação", categoria: "Sensor", sugestao_custo: 80, sugestao_preco: 160 },
];

export function CatalogoBaseModal({ open, onOpenChange }: CatalogoBaseModalProps) {
  const { createItem, itens } = useEstoque();
  const { isAutoEletrica } = useOficinaLabels();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  const catalogo = isAutoEletrica ? catalogoAutoEletrica : catalogoMecanica;
  
  // Filter items not already in stock
  const existingNames = new Set(itens.map(i => i.nome.toLowerCase()));
  const availableItems = catalogo.filter(
    item => !existingNames.has(item.nome.toLowerCase())
  );

  const filteredItems = availableItems.filter(
    item => item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((_, i) => i)));
    }
  };

  const handleAddSelected = async () => {
    if (selectedItems.size === 0) return;
    
    setAdding(true);
    let added = 0;

    for (const index of selectedItems) {
      const item = filteredItems[index];
      if (!item) continue;
      
      try {
        await createItem.mutateAsync({
          nome: item.nome,
          categoria: item.categoria,
          quantidade: 0,
          custo_unitario: item.sugestao_custo,
          preco_venda: item.sugestao_preco,
          alerta_minimo: 3,
        });
        added++;
      } catch (error) {
        // Continue with other items
      }
    }

    setAdding(false);
    setSelectedItems(new Set());
    toast.success(`${added} ${added === 1 ? "item adicionado" : "itens adicionados"} ao estoque!`);
    onOpenChange(false);
  };

  // Estado "sujo" = o Set de itens selecionados. searchTerm/adding são voláteis
  // (buscar não é editar) e ficam de fora via ignoreKeys. O comparador tem
  // suporte a Set (conteúdo, independente de ordem) desde 38ab25a.
  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: { selectedItems, searchTerm, adding },
    onOpenChange,
    ignoreKeys: ["searchTerm", "adding"],
    onReset: () => {
      setSearchTerm("");
      setSelectedItems(new Set());
    },
  });

  const categorias = [...new Set(filteredItems.map(i => i.categoria))];

  const modalContent = (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no catálogo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11"
        />
      </div>

      {availableItems.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <Check className="w-12 h-12 mx-auto mb-3 text-success" />
            <p className="font-medium">Catálogo completo!</p>
            <p className="text-sm text-muted-foreground">
              Todos os itens do catálogo já estão no seu estoque.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm mb-2">
            <button
              onClick={selectAll}
              className="text-accent hover:underline"
            >
              {selectedItems.size === filteredItems.length ? "Desmarcar todos" : "Selecionar todos"}
            </button>
            <span className="text-muted-foreground text-xs">
              {filteredItems.length} {isAutoEletrica ? "componentes" : "itens"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 max-h-[50vh] md:max-h-[60vh]">
            {categorias.map(cat => (
              <div key={cat}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">{cat}</h4>
                <div className="space-y-1">
                  {filteredItems
                    .map((item, originalIndex) => ({ item, originalIndex }))
                    .filter(({ item }) => item.categoria === cat)
                    .map(({ item, originalIndex }) => {
                      const isSelected = selectedItems.has(originalIndex);
                      return (
                        <button
                          key={originalIndex}
                          onClick={() => toggleItem(originalIndex)}
                          className={cn(
                            "w-full flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg border transition-all text-left gap-2",
                            isSelected 
                              ? "border-accent bg-accent/5" 
                              : "border-border hover:border-muted-foreground"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                              isSelected 
                                ? "border-accent bg-accent text-accent-foreground" 
                                : "border-muted-foreground"
                            )}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="font-medium text-sm">{item.nome}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs md:text-sm ml-8 md:ml-0">
                            <span className="text-muted-foreground">
                              R$ {item.sugestao_custo}
                            </span>
                            <span className="mx-1">→</span>
                            <span className="font-medium text-success">
                              R$ {item.sugestao_preco}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse md:flex-row justify-between gap-2 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full md:w-auto">
              Cancelar
            </Button>
            <Button
              onClick={handleAddSelected}
              disabled={selectedItems.size === 0 || adding}
              className="bg-accent hover:bg-accent/90 w-full md:w-auto"
            >
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar {selectedItems.size} {selectedItems.size === 1 ? "item" : "itens"}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const sairSemSalvar = (
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Sair sem salvar?"
      description="Você selecionou itens do catálogo e não os adicionou. A seleção será descartada."
      confirmText="Descartar"
      cancelText="Continuar editando"
      onConfirm={confirmClose}
    />
  );

  if (isMobile) {
    return (
      <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="text-left px-0">
            <DrawerTitle className="flex items-center gap-2">
              {isAutoEletrica ? (
                <Cpu className="w-5 h-5 text-amber-500" />
              ) : (
                <Package className="w-5 h-5 text-accent" />
              )}
              Catálogo de {isAutoEletrica ? "Componentes" : "Peças"}
            </DrawerTitle>
            <DrawerDescription>
              Adicione itens com 1 clique
            </DrawerDescription>
          </DrawerHeader>
          {modalContent}
        </DrawerContent>
      </Drawer>
      {sairSemSalvar}
      </>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAutoEletrica ? (
              <Cpu className="w-5 h-5 text-amber-500" />
            ) : (
              <Package className="w-5 h-5 text-accent" />
            )}
            Catálogo de {isAutoEletrica ? "Componentes" : "Peças"} Comuns
          </DialogTitle>
          <DialogDescription>
            Adicione itens do catálogo com 1 clique. Preços são sugestões editáveis.
          </DialogDescription>
        </DialogHeader>
        {modalContent}
      </DialogContent>
    </Dialog>
    {sairSemSalvar}
    </>
  );
}
