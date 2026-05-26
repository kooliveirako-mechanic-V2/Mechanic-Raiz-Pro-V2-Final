import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Percent, DollarSign, User, Save } from "lucide-react";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useComissoes } from "@/hooks/useComissoes";

interface ComissoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComissoesModal({ open, onOpenChange }: ComissoesModalProps) {
  const { funcionarios, isLoading: loadingFunc } = useFuncionarios();
  const { comissoes, isLoading: loadingCom, upsertComissao, comissoesDoMes } = useComissoes();
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Initialize edit values from comissoes
  useEffect(() => {
    if (comissoes.length > 0) {
      const values: Record<string, string> = {};
      comissoes.forEach((c) => {
        values[c.user_id] = String(c.percentual);
      });
      setEditValues((prev) => ({ ...values, ...prev }));
    }
  }, [comissoes]);

  const getComissaoPercentual = (userId: string) => {
    return comissoes.find((c) => c.user_id === userId)?.percentual || 0;
  };

  const getTotalComissoesMes = (userId: string) => {
    // Parse name from description "Comissão NomeFuncionario (X%) — OS #N"
    // We match by checking if the description contains the funcionario name
    const func = funcionarios.find((f) => f.user_id === userId);
    if (!func) return 0;
    return comissoesDoMes
      .filter((c) => c.descricao?.includes(func.nome))
      .reduce((acc, c) => acc + (c.valor || 0), 0);
  };

  const handleSave = async (userId: string) => {
    const val = parseFloat(editValues[userId] || "0");
    if (isNaN(val) || val < 0 || val > 100) return;
    await upsertComissao.mutateAsync({ user_id: userId, percentual: val });
  };

  const isLoading = loadingFunc || loadingCom;

  // Filter out proprietario — they don't earn commission on their own work (typically)
  const membros = funcionarios.filter((f) => f.role !== "proprietario");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-accent" />
            Comissões
          </DialogTitle>
          <DialogDescription>
            Defina o percentual de comissão sobre a mão de obra para cada mecânico.
            A comissão é calculada automaticamente ao finalizar uma OS.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : membros.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
            <User className="w-10 h-10 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">Nenhum funcionário cadastrado</p>
            <p className="text-sm text-muted-foreground/70">
              Adicione membros na seção "Equipe" primeiro
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Include proprietario too if they want */}
            {funcionarios
              .filter((f) => f.role !== "proprietario" || funcionarios.length <= 1)
              .filter((f) => f.role !== "proprietario")
              .concat(
                funcionarios.filter((f) => f.role === "proprietario")
              )
              .map((func) => {
                const currentPct = getComissaoPercentual(func.user_id);
                const editVal = editValues[func.user_id] ?? String(currentPct);
                const totalMes = getTotalComissoesMes(func.user_id);
                const hasChanged = parseFloat(editVal) !== currentPct;

                return (
                  <div
                    key={func.user_id}
                    className="p-4 rounded-lg border border-border bg-card space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{func.nome}</p>
                          <p className="text-xs text-muted-foreground capitalize">{func.role}</p>
                        </div>
                      </div>
                      {totalMes > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <DollarSign className="w-3 h-3" />
                          R$ {totalMes.toFixed(0)} /mês
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={editVal}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              [func.user_id]: e.target.value,
                            }))
                          }
                          className="pr-8 text-base"
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          %
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={hasChanged ? "default" : "outline"}
                        disabled={!hasChanged || upsertComissao.isPending}
                        onClick={() => handleSave(func.user_id)}
                        className="min-w-[70px]"
                      >
                        {upsertComissao.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 mr-1" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}

            {/* Monthly summary */}
            {comissoesDoMes.length > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-medium text-foreground mb-1">Resumo do Mês</p>
                <p className="text-2xl font-bold text-accent">
                  R$ {comissoesDoMes.reduce((a, c) => a + (c.valor || 0), 0).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {comissoesDoMes.length} comissão(ões) gerada(s) automaticamente
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
