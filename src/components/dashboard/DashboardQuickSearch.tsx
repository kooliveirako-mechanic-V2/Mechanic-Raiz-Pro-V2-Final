import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Car, X, Loader2, ChevronDown, FileText, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClientes } from "@/hooks/useClientes";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useOrcamentos } from "@/hooks/useOrcamentos";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SearchMiniProfile } from "./SearchMiniProfile";

interface SearchResult {
  type: "cliente" | "veiculo" | "os" | "orcamento";
  id: string;
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string | null;
  title: string;
  subtitle: string;
  badge?: string;
  valor?: number;
}

const categoryLabels: Record<string, string> = {
  cliente: "Clientes",
  veiculo: "Veículos",
  os: "Ordens de Serviço",
  orcamento: "Orçamentos",
};

const categoryOrder: SearchResult["type"][] = ["cliente", "veiculo", "os", "orcamento"];

function formatCurrency(val?: number) {
  if (!val) return "";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_diagnostico: "Diagnóstico",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguard. peça",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  convertido: "Convertido",
};

export function DashboardQuickSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { clientes, isLoading: clientesLoading } = useClientes();
  const { veiculos, isLoading: veiculosLoading } = useVeiculos();
  const { ordens: ordensServico, isLoading: osLoading } = useOrdensServico();
  const { orcamentos, isLoading: orcLoading } = useOrcamentos();
  const isLoading = clientesLoading || veiculosLoading || osLoading || orcLoading;

  // FIX: useMemo instead of useEffect+setState to prevent infinite render loop
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];

    const s = query.toLowerCase();
    const queryNum = parseInt(query);
    const r: SearchResult[] = [];

    clientes
      .filter(c => c.nome.toLowerCase().includes(s) || c.telefone?.includes(query) || c.cpf_cnpj?.includes(query))
      .slice(0, 3)
      .forEach(c => r.push({
        type: "cliente", id: c.id, clienteId: c.id, clienteNome: c.nome, clienteTelefone: c.telefone,
        title: c.nome, subtitle: c.telefone || c.email || "Sem contato",
      }));

    veiculos
      .filter(v => v.placa?.toLowerCase().includes(s) || v.modelo.toLowerCase().includes(s) || v.marca.toLowerCase().includes(s))
      .slice(0, 3)
      .forEach(v => {
        const cliente = clientes.find(c => c.id === v.cliente_id);
        r.push({
          type: "veiculo", id: v.id, clienteId: v.cliente_id, clienteNome: cliente?.nome || "Cliente", clienteTelefone: cliente?.telefone,
          title: `${v.marca} ${v.modelo}`, subtitle: v.placa || "Sem placa",
        });
      });

    ordensServico
      .filter(os => {
        const cliente = clientes.find(c => c.id === os.cliente_id);
        return (
          (os.numero && !isNaN(queryNum) && os.numero === queryNum) ||
          os.tipo_servico.toLowerCase().includes(s) ||
          (cliente?.nome.toLowerCase().includes(s))
        );
      })
      .slice(0, 3)
      .forEach(os => {
        const cliente = clientes.find(c => c.id === os.cliente_id);
        r.push({
          type: "os", id: os.id,
          title: `OS #${os.numero || "—"}`,
          subtitle: `${cliente?.nome || "Cliente"} · ${statusLabels[os.status] || os.status}`,
          badge: statusLabels[os.status] || os.status,
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
          badge: statusLabels[orc.status] || orc.status,
          valor: orc.valor_total,
        });
      });

    return r;
  }, [query, clientes, veiculos, ordensServico, orcamentos]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setExpandedId(null);
    }
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setExpandedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        setExpandedId(null);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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
    cliente: <User className="w-4 h-4 text-emerald-500" />,
    veiculo: <Car className="w-4 h-4 text-cyan-500" />,
    os: <FileText className="w-4 h-4 text-amber-500" />,
    orcamento: <Receipt className="w-4 h-4 text-violet-500" />,
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
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setExpandedId(null); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar cliente, placa, OS, orçamento... (Ctrl+K)"
          className="pl-10 pr-10 h-10 bg-muted/50 border-border/50 focus:bg-background"
        />
        {query && (
          <Button
            variant="ghost" size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => { setQuery(""); setExpandedId(null); inputRef.current?.focus(); }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && query.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Buscando...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum resultado para "{query}"</p>
              </div>
            ) : (
              <div>
                {grouped.map(({ cat, items }) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 bg-muted/30 border-b border-border/40">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {categoryLabels[cat]}
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      {items.map((result, index) => {
                        const key = `${result.type}-${result.id}`;
                        const isExpanded = expandedId === key;
                        const isExpandable = result.type === "cliente" || result.type === "veiculo";

                        return (
                          <div key={key}>
                            <motion.button
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.03 }}
                              onClick={() => handleResultClick(result)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left group"
                            >
                              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBgMap[result.type])}>
                                {iconMap[result.type]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">{result.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                              </div>
                              {result.valor ? (
                                <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                                  {formatCurrency(result.valor)}
                                </span>
                              ) : null}
                              {isExpandable && (
                                <ChevronDown className={cn(
                                  "w-4 h-4 text-muted-foreground transition-transform",
                                  isExpanded && "rotate-180"
                                )} />
                              )}
                            </motion.button>

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
