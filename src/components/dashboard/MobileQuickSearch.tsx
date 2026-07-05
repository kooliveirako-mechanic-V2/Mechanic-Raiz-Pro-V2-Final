import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Car, X, Loader2, ChevronDown, FileText, Receipt } from "lucide-react";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { useOSSearch } from "@/hooks/useOSSearch";
import { useClienteSearch } from "@/hooks/useClienteSearch";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { SearchMiniProfile } from "./SearchMiniProfile";

interface SearchResult {
  type: "cliente" | "veiculo" | "os" | "orcamento";
  id: string;
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string | null;
  title: string;
  subtitle: string;
  valor?: number;
}

const categoryLabels: Record<string, string> = {
  cliente: "Clientes",
  veiculo: "Veículos",
  os: "Ordens de Serviço",
  orcamento: "Orçamentos",
};

const categoryOrder: SearchResult["type"][] = ["cliente", "veiculo", "os", "orcamento"];

const statusLabels: Record<string, string> = {
  pendente: "Pendente", em_diagnostico: "Diagnóstico", em_andamento: "Em andamento",
  aguardando_peca: "Aguard. peça", finalizado: "Finalizado", cancelado: "Cancelado",
  rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado",
  rejeitado: "Rejeitado", convertido: "Convertido",
};

function formatCurrency(val?: number) {
  if (!val) return "";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function MobileQuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { veiculos, isLoading: veiculosLoading } = useVeiculos();
  const { orcamentos, isLoading: orcLoading } = useOrcamentos();
  const { results: clienteResults, isLoading: clientesLoading } = useClienteSearch(query);
  const { results: osResults, isLoading: osLoading } = useOSSearch(query);
  const isLoading = (query.length >= 2) && (clientesLoading || veiculosLoading || osLoading || orcLoading);

  // FIX: useMemo instead of useEffect+setState to prevent infinite render loop
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];

    const s = query.toLowerCase();
    const numeroMatch = query.trim().match(/^(?:os\s*)?#?\s*(\d+)$/i);
    const queryNum = numeroMatch ? parseInt(numeroMatch[1]) : NaN;
    const r: SearchResult[] = [];

    clienteResults
      .slice(0, 3)
      .forEach(c => r.push({
        type: "cliente", id: c.id, clienteId: c.id, clienteNome: c.nome, clienteTelefone: c.telefone,
        title: c.nome, subtitle: c.telefone || "Sem contato",
      }));

    veiculos
      .filter(v => v.placa?.toLowerCase().includes(s) || v.modelo.toLowerCase().includes(s) || v.marca.toLowerCase().includes(s))
      .slice(0, 3)
      .forEach(v => {
        r.push({
          type: "veiculo", id: v.id, clienteId: v.cliente_id, clienteNome: v.cliente?.nome || "Cliente", clienteTelefone: v.cliente?.telefone,
          title: `${v.marca} ${v.modelo}`, subtitle: v.placa || "Sem placa",
        });
      });

    osResults
      .slice(0, 3)
      .forEach(os => {
        r.push({
          type: "os", id: os.id,
          title: `OS #${os.numero || "—"}`,
          subtitle: `${os.cliente?.nome || "Cliente"} · ${statusLabels[os.status] || os.status}`,
          valor: os.valor_servico,
        });
      });

    orcamentos
      .filter(orc => (orc.numero && !isNaN(queryNum) && orc.numero === queryNum) || orc.titulo.toLowerCase().includes(s))
      .slice(0, 3)
      .forEach(orc => {
        r.push({
          type: "orcamento", id: orc.id,
          title: `Orç #${orc.numero || "—"} — ${orc.titulo}`,
          subtitle: `${orc.cliente?.nome || "Sem cliente"} · ${statusLabels[orc.status] || orc.status}`,
          valor: orc.valor_total,
        });
      });

    return r;
  }, [query, clienteResults, veiculos, osResults, orcamentos]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setExpandedId(null);
    }
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "cliente" || result.type === "veiculo") {
      const key = `${result.type}-${result.id}`;
      setExpandedId(prev => prev === key ? null : key);
      return;
    }
    if (result.type === "os") {
      navigate(`/servicos?os=${result.id}`);
    } else if (result.type === "orcamento") {
      navigate(`/orcamentos?edit=${result.id}`);
    }
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    setExpandedId(null);
    setQuery("");
  };

  const iconMap: Record<string, React.ReactNode> = {
    cliente: <User className="w-3.5 h-3.5 text-emerald-500" />,
    veiculo: <Car className="w-3.5 h-3.5 text-cyan-500" />,
    os: <FileText className="w-3.5 h-3.5 text-amber-500" />,
    orcamento: <Receipt className="w-3.5 h-3.5 text-violet-500" />,
  };

  const iconBgMap: Record<string, string> = {
    cliente: "bg-emerald-500/10",
    veiculo: "bg-cyan-500/10",
    os: "bg-amber-500/10",
    orcamento: "bg-violet-500/10",
  };

  const grouped = categoryOrder
    .map(cat => ({ cat, items: results.filter(r => r.type === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setExpandedId(null); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Placa, cliente, #123 da OS..."
          inputMode="text"
          autoCapitalize="characters"
          className="w-full h-11 pl-10 pr-9 rounded-xl bg-card border border-border/60 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setExpandedId(null); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-4 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Buscando...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhum resultado para "{query}"</p>
              </div>
            ) : (
              <div>
                {grouped.map(({ cat, items }) => (
                  <div key={cat}>
                    <div className="px-2.5 py-1 bg-muted/30 border-b border-border/40">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {categoryLabels[cat]}
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {items.map((result) => {
                        const key = `${result.type}-${result.id}`;
                        const isExpanded = expandedId === key;
                        const isExpandable = result.type === "cliente" || result.type === "veiculo";

                        return (
                          <div key={key}>
                            <button
                              onClick={() => handleResultClick(result)}
                              className="w-full flex items-center gap-2.5 p-2.5 active:bg-muted/50 transition-colors text-left"
                            >
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", iconBgMap[result.type])}>
                                {iconMap[result.type]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-xs truncate">{result.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{result.subtitle}</p>
                              </div>
                              {result.valor ? (
                                <span className="text-[10px] font-semibold text-foreground whitespace-nowrap">
                                  {formatCurrency(result.valor)}
                                </span>
                              ) : null}
                              {isExpandable && (
                                <ChevronDown className={cn(
                                  "w-3.5 h-3.5 text-muted-foreground transition-transform",
                                  isExpanded && "rotate-180"
                                )} />
                              )}
                            </button>

                            <AnimatePresence>
                              {isExpanded && result.clienteId && (
                                <SearchMiniProfile
                                  clienteId={result.clienteId}
                                  clienteNome={result.clienteNome || ""}
                                  clienteTelefone={result.clienteTelefone}
                                  onClose={handleClose}
                                />
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
