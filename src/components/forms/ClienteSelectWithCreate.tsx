import { KeyboardEvent, WheelEvent, useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientes, ClienteInput } from "@/hooks/useClientes";
import { useOficina } from "@/contexts/OficinaContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, User, Phone, Loader2, Check, X, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ClienteSelectWithCreateProps {
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

interface ClienteOption {
  id: string;
  nome: string;
  telefone: string | null;
}

export function ClienteSelectWithCreate({
  value,
  onValueChange,
  required,
  disabled,
  error,
}: ClienteSelectWithCreateProps) {
  const { createCliente } = useClientes();
  const { oficinaAtual } = useOficina();
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const nomeInputRef = useRef<HTMLInputElement | null>(null);
  const telefoneInputRef = useRef<HTMLInputElement | null>(null);
  
  // Search state
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ClienteOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const popoverHostRef = useRef<HTMLDivElement | null>(null);
  const resultsListRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Quick create fields
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  // Load selected client label
  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    // Try to find in current results first
    const found = searchResults.find(c => c.id === value);
    if (found) {
      setSelectedLabel(found.nome);
      return;
    }
    // Otherwise fetch from server
    supabase
      .from("clientes")
      .select("nome")
      .eq("id", value)
      .single()
      .then(({ data }) => {
        if (data) setSelectedLabel(data.nome);
      });
  }, [value, searchResults]);

  // Server-side search
  const doSearch = useCallback(async (term: string) => {
    if (!oficinaAtual?.id) return;
    setSearching(true);
    try {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("oficina_id", oficinaAtual.id)
        .order("nome", { ascending: true })
        .limit(50);

      if (term.trim()) {
        query = query.or(`nome.ilike.%${term.trim()}%,telefone.ilike.%${term.trim()}%,cpf_cnpj.ilike.%${term.trim()}%`);
      }

      const { data } = await query;
      setSearchResults((data || []) as ClienteOption[]);
    } catch (err) {
      console.warn("[ClienteSelect] Search error:", err);
    } finally {
      setSearching(false);
    }
  }, [oficinaAtual?.id]);

  // Load initial results when popover opens
  useEffect(() => {
    if (popoverOpen) {
      doSearch("");
      // Focus search input after popover animation
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [popoverOpen, doSearch]);

  // Debounced search
  useEffect(() => {
    if (!popoverOpen) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => doSearch(searchTerm), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, popoverOpen, doSearch]);

  const handleSelect = (clienteId: string) => {
    onValueChange(clienteId);
    setPopoverOpen(false);
    setSearchTerm("");
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setPopoverOpen(false);
    setNome("");
    setTelefone("");
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNome("");
    setTelefone("");
  };

  const handleQuickCreate = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const data: ClienteInput = {
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
      };
      
      const novoCliente = await createCliente.mutateAsync(data);
      onValueChange(novoCliente.id);
      setIsCreating(false);
      setNome("");
      setTelefone("");
    } catch (error) {
      // Error handled by mutation
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreateKeyDown = async (
    e: KeyboardEvent<HTMLInputElement>,
    field: "nome" | "telefone",
  ) => {
    if (e.key !== "Enter") return;

    e.preventDefault();
    e.stopPropagation();

    if (field === "nome") {
      telefoneInputRef.current?.focus();
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
          <Label className="text-sm font-medium text-accent">Novo Cliente</Label>
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
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={nomeInputRef}
              placeholder="Nome do cliente *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => void handleQuickCreateKeyDown(e, "nome")}
              className="pl-9 h-12 text-base"
              autoFocus={false}
            />
          </div>
          
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={telefoneInputRef}
              placeholder="Telefone (opcional)"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              onKeyDown={(e) => void handleQuickCreateKeyDown(e, "telefone")}
              className="pl-9 h-12 text-base"
            />
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full bg-accent hover:bg-accent/90"
          onClick={handleQuickCreate}
          disabled={loading || !nome.trim()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Criar Cliente
        </Button>
      </div>
    );
  }

  return (
    <div ref={popoverHostRef} className="space-y-2 relative">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={popoverOpen}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-10 font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
          >
            {selectedLabel || "Selecione o cliente"}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
          <PopoverContent container={popoverHostRef.current ?? undefined} className="w-[--radix-popover-trigger-width] p-0 z-[9999]" align="start">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar por nome, telefone ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div ref={resultsListRef} onWheel={handleResultsWheel} className="max-h-[240px] overflow-y-auto overscroll-auto touch-pan-y">
            {searching ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </div>
            ) : (
              searchResults.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => handleSelect(cliente.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm hover:bg-accent/10 transition-colors flex items-center justify-between",
                    value === cliente.id && "bg-accent/10 font-medium"
                  )}
                >
                  <div>
                    <span className="block">{cliente.nome}</span>
                    {cliente.telefone && (
                      <span className="block text-xs text-muted-foreground">{cliente.telefone}</span>
                    )}
                  </div>
                  {value === cliente.id && <Check className="w-4 h-4 text-accent" />}
                </button>
              ))
            )}
          </div>
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-accent hover:text-accent hover:bg-accent/10"
              onClick={handleStartCreate}
            >
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Novo Cliente
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
