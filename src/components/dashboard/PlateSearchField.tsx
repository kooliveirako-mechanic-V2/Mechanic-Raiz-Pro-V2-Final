import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Car, X, Loader2, Wrench } from "lucide-react";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useClientes } from "@/hooks/useClientes";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export function PlateSearchField() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { veiculos, isLoading: veiculosLoading } = useVeiculos();
  const { clientes } = useClientes();
  const { ordens } = useOrdensServico();

  const results = query.length >= 2
    ? veiculos
        .filter(v => v.placa?.toUpperCase().includes(query.toUpperCase()))
        .slice(0, 5)
        .map(v => {
          const cliente = clientes.find(c => c.id === v.cliente_id);
          const ultimaOS = ordens
            .filter(os => os.veiculo_id === v.id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          return { veiculo: v, cliente, ultimaOS };
        })
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (veiculoId: string) => {
    navigate(`/servicos?veiculo=${veiculoId}`);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value.toUpperCase()); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="🔍 Buscar por placa..."
          inputMode="text"
          autoCapitalize="characters"
          className="w-full h-11 pl-9 pr-9 rounded-xl bg-card border border-border/60 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all font-mono tracking-wider"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[50vh] overflow-y-auto"
          >
            {veiculosLoading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Buscando...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Nenhum veículo com placa "{query}"</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {results.map(({ veiculo, cliente, ultimaOS }) => (
                  <button
                    key={veiculo.id}
                    onClick={() => handleSelect(veiculo.id)}
                    className="w-full flex items-center gap-3 p-3 active:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Car className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm font-mono">
                        {veiculo.placa}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {veiculo.marca} {veiculo.modelo} · {cliente?.nome || "Sem cliente"}
                      </p>
                      {ultimaOS && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          Última OS: {ultimaOS.tipo_servico}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
