import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, Wrench, Trash2, Pencil, Sparkles, Clock } from "lucide-react";
import { useCatalogoServicos, CatalogoServico, SUGESTOES_CATALOGO, TipoVeiculoCatalogo } from "@/hooks/useCatalogoServicos";
import { CatalogoServicoFormModal } from "./CatalogoServicoFormModal";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const TIPO_LABEL: Record<TipoVeiculoCatalogo, string> = {
  todos: "Todos",
  carro: "Carro",
  moto: "Moto",
  eletrica: "Auto Elétrica",
  caminhao: "Caminhão",
};

export function CatalogoServicosTab() {
  const { servicos, isLoading, deleteServico, toggleAtivo, importarSugestoes } = useCatalogoServicos();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoVeiculoCatalogo | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editServico, setEditServico] = useState<CatalogoServico | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogoServico | null>(null);

  const filtered = useMemo(() => {
    const t = search.toLowerCase().trim();
    return servicos.filter((s) => {
      const matchTipo = filtroTipo === "all" || s.tipo_veiculo === filtroTipo || s.tipo_veiculo === "todos";
      const matchTxt = !t || s.nome.toLowerCase().includes(t) || (s.categoria || "").toLowerCase().includes(t);
      return matchTipo && matchTxt;
    });
  }, [servicos, search, filtroTipo]);

  const handleNew = () => { setEditServico(null); setModalOpen(true); };
  const handleEdit = (s: CatalogoServico) => { setEditServico(s); setModalOpen(true); };

  // Empty state — onboarding com sugestões
  if (!isLoading && servicos.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Wrench className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Seu catálogo está vazio</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre os serviços que você faz com mais frequência (com valor pronto) e use 1 clique pra adicionar na OS.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button
            onClick={() => importarSugestoes.mutate(SUGESTOES_CATALOGO)}
            disabled={importarSugestoes.isPending}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Importar lista sugerida ({SUGESTOES_CATALOGO.length})
          </Button>
          <Button variant="outline" onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Cadastrar manualmente
          </Button>
        </div>
        <CatalogoServicoFormModal open={modalOpen} onOpenChange={setModalOpen} servico={editServico} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header de ações */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo serviço</span>
        </Button>
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "carro", "moto", "eletrica", "caminhao"] as const).map((t) => (
          <Button
            key={t}
            type="button"
            variant={filtroTipo === t ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroTipo(t)}
            className="shrink-0 h-8"
          >
            {t === "all" ? "Todos" : TIPO_LABEL[t as TipoVeiculoCatalogo]}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum serviço encontrado.
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
          {filtered.map((s) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn("p-3 flex items-center gap-3", !s.ativo && "opacity-60")}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-medium text-sm truncate">{s.nome}</h4>
                  <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[s.tipo_veiculo]}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {s.categoria && <span>{s.categoria}</span>}
                  {s.tempo_estimado_minutos ? (
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.tempo_estimado_minutos}min</span>
                  ) : null}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-success tabular-nums text-sm">{formatCurrency(s.valor_mao_obra)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={s.ativo}
                  onCheckedChange={(v) => toggleAtivo.mutate({ id: s.id, ativo: v })}
                  className="scale-75"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(s)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CatalogoServicoFormModal open={modalOpen} onOpenChange={setModalOpen} servico={editServico} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.nome}" será removido do catálogo. As OS já criadas com esse serviço não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) deleteServico.mutate(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
