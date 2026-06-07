import { KeyboardEvent, WheelEvent, useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVeiculos, VeiculoInput } from "@/hooks/useVeiculos";
import { useOficina } from "@/contexts/OficinaContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Car, Bike, Loader2, Check, X, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VeiculoSelectWithCreateProps {
  value: string;
  onValueChange: (value: string) => void;
  clienteId: string;
  veiculosDoCliente?: Array<{
    id: string;
    marca: string;
    modelo: string;
    placa?: string | null;
  }>;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

interface VeiculoOption {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  placa: string | null;
}

export function VeiculoSelectWithCreate({
  value,
  onValueChange,
  clienteId,
  required,
  disabled,
  error,
}: VeiculoSelectWithCreateProps) {
  const { createVeiculo } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const marcaInputRef = useRef<HTMLInputElement | null>(null);
  const modeloInputRef = useRef<HTMLInputElement | null>(null);
  const placaInputRef = useRef<HTMLInputElement | null>(null);
  
  const tipoOficina = oficinaAtual?.tipo || "ambos";
  const showCarro = tipoOficina === "carro" || tipoOficina === "ambos";
  const showMoto = tipoOficina === "moto" || tipoOficina === "ambos";
  const tipoDefault: "carro" | "moto" = tipoOficina === "carro" ? "carro" : tipoOficina === "moto" ? "moto" : "moto";

  // Search state  
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<VeiculoOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const popoverHostRef = useRef<HTMLDivElement | null>(null);
  const resultsListRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  // Quick create fields
  const [tipo, setTipo] = useState<"carro" | "moto">(tipoDefault);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");

  // Load selected vehicle label
  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    const found = searchResults.find(v => v.id === value);
    if (found) {
      setSelectedLabel(`${found.marca} ${found.modelo}${found.placa ? ` - ${found.placa}` : ""}`);
      return;
    }
    supabase
      .from("veiculos")
      .select("marca, modelo, placa")
      .eq("id", value)
      .single()
      .then(({ data }) => {
        if (data) setSelectedLabel(`${data.marca} ${data.modelo}${data.placa ? ` - ${data.placa}` : ""}`);
      });
  }, [value, searchResults]);

  // Server-side search
  const doSearch = useCallback(async (term: string) => {
    if (!clienteId) return;
    setSearching(true);
    try {
      let query = supabase
        .from("veiculos")
        .select("id, tipo, marca, modelo, placa")
        .eq("cliente_id", clienteId)
        .order("marca", { ascending: true })
        .limit(50);

      if (term.trim()) {
        query = query.or(`marca.ilike.%${term.trim()}%,modelo.ilike.%${term.trim()}%,placa.ilike.%${term.trim()}%`);
      }

      const { data } = await query;
      setSearchResults((data || []) as VeiculoOption[]);
    } catch (err) {
      console.warn("[VeiculoSelect] Search error:", err);
    } finally {
      setSearching(false);
    }
  }, [clienteId]);

  // Track if initial load completed for this popover session
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load when popover opens
  useEffect(() => {
    if (popoverOpen && clienteId) {
      setInitialLoaded(false);
      setSearching(true);
      doSearch("").then(() => setInitialLoaded(true));
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setInitialLoaded(false);
    }
  }, [popoverOpen, clienteId, doSearch]);

  // Debounced search
  useEffect(() => {
    if (!popoverOpen) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => doSearch(searchTerm), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, popoverOpen, doSearch]);

  // Reset when client changes
  useEffect(() => {
    setSearchResults([]);
    setSearchTerm("");
  }, [clienteId]);

  const handleSelect = (veiculoId: string) => {
    onValueChange(veiculoId);
    setPopoverOpen(false);
    setSearchTerm("");
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setPopoverOpen(false);
    setTipo(tipoDefault);
    setMarca("");
    setModelo("");
    setPlaca("");
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setMarca("");
    setModelo("");
    setPlaca("");
  };

  const handleQuickCreate = async () => {
    if (!clienteId) {
      toast.error("Selecione o cliente primeiro");
      return;
    }

    if (!marca.trim() || !modelo.trim()) {
      toast.error("Marca e modelo são obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const data: VeiculoInput = {
        cliente_id: clienteId,
        tipo,
        marca: marca.trim(),
        modelo: modelo.trim(),
        placa: placa.trim().toUpperCase() || undefined,
      };
      
      const novoVeiculo = await createVeiculo.mutateAsync(data);
      onValueChange(novoVeiculo.id);
      setIsCreating(false);
      setMarca("");
      setModelo("");
      setPlaca("");
    } catch (error) {
      // Error handled by mutation
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateKeyDown = async (
    e: KeyboardEvent<HTMLInputElement>,
    field: "marca" | "modelo" | "placa",
  ) => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    e.stopPropagation();

    if (field === "marca") {
      modeloInputRef.current?.focus();
      return;
    }

    if (field === "modelo") {
      if (!placa.trim()) {
        await handleQuickCreate();
        return;
      }

      placaInputRef.current?.focus();
      return;
    }

    await handleQuickCreate();
  };

  const handleResultsWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = resultsListRef.current;
    if (!el) return;

    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    const shouldBubbleToForm = (e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom) || el.scrollHeight <= el.clientHeight;

    if (shouldBubbleToForm) {
      e.preventDefault();
      const scrollParent = el.closest("[data-os-form-scroll]") as HTMLElement | null;
      scrollParent?.scrollBy({ top: e.deltaY, behavior: "auto" });
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-3 p-3 border border-accent/50 rounded-lg bg-accent/5">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-accent">Novo Veículo</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCancelCreate}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          {showCarro && showMoto ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tipo === "carro" ? "default" : "outline"}
                size="sm"
                className={cn("flex-1", tipo === "carro" && "bg-accent")}
                onClick={() => setTipo("carro")}
              >
                <Car className="w-4 h-4 mr-1" />
                Carro
              </Button>
              <Button
                type="button"
                variant={tipo === "moto" ? "default" : "outline"}
                size="sm"
                className={cn("flex-1", tipo === "moto" && "bg-accent")}
                onClick={() => setTipo("moto")}
              >
                <Bike className="w-4 h-4 mr-1" />
                Moto
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30 text-sm">
              {showMoto ? <Bike className="w-4 h-4" /> : <Car className="w-4 h-4" />}
              <span>{showMoto ? "Moto" : "Carro"}</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              ref={marcaInputRef}
              placeholder="Marca *"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              onKeyDown={(e) => void handleQuickCreateKeyDown(e, "marca")}
              className="h-12 text-base"
            />
            <Input
              ref={modeloInputRef}
              placeholder="Modelo *"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              onKeyDown={(e) => void handleQuickCreateKeyDown(e, "modelo")}
              className="h-12 text-base"
            />
          </div>
          
          <Input
            ref={placaInputRef}
            placeholder="Placa (opcional)"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            onKeyDown={(e) => void handleQuickCreateKeyDown(e, "placa")}
            className="h-12 text-base"
            maxLength={10}
          />
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full bg-accent hover:bg-accent/90"
          onClick={handleQuickCreate}
          disabled={loading || !marca.trim() || !modelo.trim()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Criar Veículo
        </Button>
      </div>
    );
  }

  const isDisabled = disabled || !clienteId;
  const placeholderText = !clienteId 
    ? "Selecione o cliente primeiro" 
    : "Selecione o veículo";

  return (
    <div ref={popoverHostRef} className="space-y-2 relative">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={popoverOpen}
            disabled={isDisabled}
            className={cn(
              "w-full justify-between h-10 font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            {selectedLabel || placeholderText}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent container={popoverHostRef.current ?? undefined} className="w-[--radix-popover-trigger-width] p-0 z-[9999]" align="start">
          {searchResults.length > 3 && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar por marca, modelo ou placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
          )}
          <div ref={resultsListRef} onWheel={handleResultsWheel} className="max-h-[240px] overflow-y-auto overscroll-auto touch-pan-y">
            {searching || !initialLoaded ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando veículos...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchTerm ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
              </div>
            ) : (
              searchResults.map((veiculo) => (
                <button
                  key={veiculo.id}
                  type="button"
                  onClick={() => handleSelect(veiculo.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-accent/10 transition-colors flex items-center justify-between",
                    value === veiculo.id && "bg-accent/10 font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {veiculo.tipo === "moto" ? <Bike className="w-4 h-4 text-muted-foreground" /> : <Car className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <span className="block">{veiculo.marca} {veiculo.modelo}</span>
                      {veiculo.placa && (
                        <span className="block text-xs text-muted-foreground">{veiculo.placa}</span>
                      )}
                    </div>
                  </div>
                  {value === veiculo.id && <Check className="w-4 h-4 text-accent" />}
                </button>
              ))
            )}
          </div>
          {initialLoaded && (
            <div className="border-t border-border p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-accent hover:text-accent hover:bg-accent/10"
                onClick={handleStartCreate}
              >
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Novo Veículo
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
