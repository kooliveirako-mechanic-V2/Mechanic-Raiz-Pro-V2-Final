import { useState } from "react";
import { format, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Bell, 
  Plus, 
  Calendar, 
  Gauge, 
  Wrench,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Car,
  Bike,
  Truck,
  Bus,
  Tractor,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRecorrencias, RecorrenciaInput } from "@/hooks/useRecorrencias";
import { useVeiculos } from "@/hooks/useVeiculos";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useModalClose } from "@/hooks/useModalClose";

const tiposServico = [
  "Troca de Óleo",
  "Troca de Óleo + Filtros",
  "Revisão Completa",
  "Troca de Pastilhas de Freio",
  "Troca de Pneu",
  "Alinhamento e Balanceamento",
  "Troca de Correia Dentada",
  "Troca de Bateria",
  "Troca de Embreagem",
  "Outro",
];

interface LembretesManutencaoProps {
  veiculoId?: string;
  showVeiculoSelect?: boolean;
}

export function LembretesManutencao({ 
  veiculoId, 
  showVeiculoSelect = false 
}: LembretesManutencaoProps) {
  const { recorrencias, isLoading, createRecorrencia, deleteRecorrencia } = useRecorrencias();
  const { veiculos } = useVeiculos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [selectedVeiculo, setSelectedVeiculo] = useState(veiculoId || "");
  const [tipoServico, setTipoServico] = useState("");
  const [intervaloDias, setIntervaloDias] = useState("");
  const [intervaloKm, setIntervaloKm] = useState("");

  // Filter by vehicle if provided
  const filteredRecorrencias = veiculoId 
    ? recorrencias.filter(r => r.veiculo_id === veiculoId)
    : recorrencias;

  const handleSubmit = async () => {
    if (!selectedVeiculo || !tipoServico) return;

    const hoje = new Date();
    const proximaExecucao = intervaloDias 
      ? format(addDays(hoje, parseInt(intervaloDias)), "yyyy-MM-dd")
      : null;

    const input: RecorrenciaInput = {
      veiculo_id: selectedVeiculo,
      tipo_servico: tipoServico,
      intervalo_dias: intervaloDias ? parseInt(intervaloDias) : null,
      intervalo_km: intervaloKm ? parseInt(intervaloKm) : null,
      ultima_execucao: format(hoje, "yyyy-MM-dd"),
      proxima_execucao: proximaExecucao,
      ativo: true,
    };

    await createRecorrencia.mutateAsync(input);
    setDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    if (!veiculoId) setSelectedVeiculo("");
    setTipoServico("");
    setIntervaloDias("");
    setIntervaloKm("");
  };

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open: dialogOpen,
    // selectedVeiculo pode vir de veiculoId (prop) — mas é estável na montagem,
    // não hidrata por efeito assíncrono, então entra na comparação normalmente.
    data: { selectedVeiculo, tipoServico, intervaloDias, intervaloKm },
    onOpenChange: setDialogOpen,
    onReset: resetForm,
  });

  const getStatusBadge = (recorrencia: typeof recorrencias[0]) => {
    if (!recorrencia.ativo) {
      return <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>;
    }

    if (!recorrencia.proxima_execucao) {
      return <Badge variant="outline" className="text-muted-foreground">Sem data</Badge>;
    }

    const hoje = new Date();
    const proxima = new Date(recorrencia.proxima_execucao);
    const diffDays = differenceInDays(proxima, hoje);

    if (diffDays < 0) {
      return (
        <Badge className="bg-destructive text-destructive-foreground">
          <AlertCircle className="w-3 h-3 mr-1" />
          Atrasado
        </Badge>
      );
    }

    if (diffDays <= 7) {
      return (
        <Badge className="bg-warning text-warning-foreground">
          <Clock className="w-3 h-3 mr-1" />
          Em {diffDays} dias
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-success border-success/30">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        OK
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Bell className="w-4 h-4 text-warning" />
          </div>
          <h3 className="font-semibold text-foreground">
            Lembretes de Manutenção
          </h3>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-accent hover:bg-accent/90">
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-warning" />
                Novo Lembrete
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Veículo (se não tiver ID fixo) */}
              {showVeiculoSelect && !veiculoId && (
                <div className="space-y-2">
                  <Label>Veículo *</Label>
                  <Select value={selectedVeiculo} onValueChange={setSelectedVeiculo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o veículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {veiculos.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="flex items-center gap-2">
                            {v.tipo === "caminhao" ? <Truck className="w-4 h-4" />
                              : v.tipo === "onibus" ? <Bus className="w-4 h-4" />
                              : v.tipo === "agricola" ? <Tractor className="w-4 h-4" />
                              : v.tipo === "moto" ? <Bike className="w-4 h-4" />
                              : <Car className="w-4 h-4" />}
                            {v.marca} {v.modelo} {v.placa && `• ${v.placa}`}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Tipo de Serviço */}
              <div className="space-y-2">
                <Label>Tipo de Serviço *</Label>
                <Select value={tipoServico} onValueChange={setTipoServico}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposServico.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Intervalo por dias */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  A cada quantos dias?
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 180 (6 meses)"
                  value={intervaloDias}
                  onChange={(e) => setIntervaloDias(e.target.value)}
                />
              </div>

              {/* Intervalo por KM */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-muted-foreground" />
                  A cada quantos KM?
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 10000"
                  value={intervaloKm}
                  onChange={(e) => setIntervaloKm(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90"
                  onClick={handleSubmit}
                  disabled={!selectedVeiculo || !tipoServico || createRecorrencia.isPending}
                >
                  Criar Lembrete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Descartar lembrete?"
          description="Você preencheu dados deste lembrete e não salvou. As informações serão descartadas."
          confirmText="Descartar"
          cancelText="Continuar preenchendo"
          onConfirm={confirmClose}
        />
      </div>

      {/* Lista de lembretes */}
      {filteredRecorrencias.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
          <Bell className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">
            Nenhum lembrete configurado
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie lembretes para troca de óleo, revisões, etc.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRecorrencias.map((recorrencia) => (
            <div
              key={recorrencia.id}
              className={cn(
                "p-3 rounded-lg border transition-all",
                recorrencia.ativo 
                  ? "bg-card border-border hover:border-primary/30" 
                  : "bg-muted/30 border-border opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Wrench className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-medium text-sm">
                      {recorrencia.tipo_servico}
                    </span>
                    {getStatusBadge(recorrencia)}
                  </div>
                  
                  {/* Vehicle info (if not filtered by vehicle) */}
                  {!veiculoId && recorrencia.veiculo && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      {recorrencia.veiculo.marca} {recorrencia.veiculo.modelo}
                      {recorrencia.veiculo.placa && ` • ${recorrencia.veiculo.placa}`}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {recorrencia.intervalo_dias && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        A cada {recorrencia.intervalo_dias} dias
                      </span>
                    )}
                    {recorrencia.intervalo_km && (
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        A cada {recorrencia.intervalo_km.toLocaleString("pt-BR")} km
                      </span>
                    )}
                  </div>

                  {recorrencia.proxima_execucao && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Próxima: {format(new Date(recorrencia.proxima_execucao), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteId(recorrencia.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remover Lembrete"
        description="Tem certeza que deseja remover este lembrete de manutenção?"
        confirmText="Remover"
        variant="destructive"
        onConfirm={() => {
          if (deleteId) {
            deleteRecorrencia.mutate(deleteId);
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}
