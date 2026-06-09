import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Car, Bike, User, ChevronRight, Zap, AlertTriangle, RefreshCcw, Wrench, Clock, CheckCircle2, Package, Pause } from "lucide-react";
import { useVeiculos, Veiculo } from "@/hooks/useVeiculos";
import { VeiculoFormModal } from "@/components/forms/VeiculoFormModal";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHistoricoEletrico } from "@/hooks/useHistoricoEletrico";
import { PageLoader } from "@/components/ui/loading-states";
import { cn } from "@/lib/utils";
import { useOficina } from "@/contexts/OficinaContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

// Tipo para informações do pátio
interface PatioInfo {
  status: string;
  diasNoPatio: number;
  tipoServico: string;
  osNumero?: number;
}

// Cores por status de OS no pátio
function getPatioStatusConfig(status: string, diasNoPatio: number) {
  // Pronto para retirada
  if (status === "pronto") {
    return {
      label: "Pronto p/ retirada",
      color: "border-emerald-500/50 text-emerald-700 bg-emerald-500/10",
      icon: CheckCircle2,
    };
  }
  // Parado há mais de 3 dias = vermelho
  if (diasNoPatio > 3 && status !== "em_andamento") {
    return {
      label: `Parado ${diasNoPatio}d`,
      color: "border-destructive/50 text-destructive bg-destructive/10",
      icon: Pause,
    };
  }
  // Aguardando peça
  if (status === "aguardando_peca") {
    return {
      label: "Aguardando peça",
      color: "border-amber-500/50 text-amber-700 bg-amber-500/10",
      icon: Package,
    };
  }
  // Em andamento
  if (status === "em_andamento") {
    return {
      label: "Em andamento",
      color: "border-orange-500/50 text-orange-700 bg-orange-500/10",
      icon: Wrench,
    };
  }
  // Pendente / aguardando aprovação (default)
  return {
    label: `No pátio ${diasNoPatio}d`,
    color: "border-blue-500/50 text-blue-700 bg-blue-500/10",
    icon: Clock,
  };
}

// Componente para badge de risco elétrico
function RiscoBadgeVeiculo({ veiculoId, isAutoEletrica }: { veiculoId: string; isAutoEletrica: boolean }) {
  const { recorrenciasCompletas, resumoCompleto } = useHistoricoEletrico(veiculoId);
  if (!isAutoEletrica) return null;
  if (resumoCompleto.totalDiagnosticos === 0) return null;
  const isRiscoAlto = resumoCompleto.riscoPotencial === "alto";
  const hasRecorrencias = recorrenciasCompletas.length > 0;
  if (!hasRecorrencias) {
    return (
      <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-amber-500/30 text-amber-600 bg-amber-500/10">
        <Zap className="w-2.5 h-2.5 mr-0.5" />
        {resumoCompleto.totalDiagnosticos}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[9px] h-5 px-2 font-bold gap-1",
        isRiscoAlto
          ? "border-destructive/50 text-destructive bg-destructive/10 animate-pulse"
          : "border-warning/50 text-warning bg-warning/10"
      )}
    >
      {isRiscoAlto ? <AlertTriangle className="w-3 h-3" /> : <RefreshCcw className="w-3 h-3" />}
      {recorrenciasCompletas.length}x
      {isRiscoAlto && <span className="hidden sm:inline ml-0.5">RISCO</span>}
    </Badge>
  );
}

// Modal de info do pátio
function PatioInfoModal({
  open,
  onOpenChange,
  veiculo,
  patioInfo,
  onEditVeiculo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  veiculo: Veiculo;
  patioInfo: PatioInfo;
  onEditVeiculo: () => void;
}) {
  const isMobile = useIsMobile();
  const config = getPatioStatusConfig(patioInfo.status, patioInfo.diasNoPatio);
  const StatusIcon = config.icon;

  const Content = (
    <div className="space-y-4">
      {/* Veículo info */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          {veiculo.tipo === "moto" ? <Bike className="w-5 h-5 text-primary" /> : <Car className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{veiculo.marca} {veiculo.modelo}</p>
          <div className="flex gap-2 text-xs text-muted-foreground">
            {veiculo.placa && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{veiculo.placa}</span>}
            {veiculo.ano && <span>{veiculo.ano}</span>}
          </div>
        </div>
      </div>

      {/* Status badge grande */}
      <div className={cn("flex items-center gap-3 p-4 rounded-lg border", config.color)}>
        <StatusIcon className="w-6 h-6 flex-shrink-0" />
        <div>
          <p className="font-semibold text-sm">{config.label}</p>
          <p className="text-xs opacity-80">{patioInfo.diasNoPatio} dia{patioInfo.diasNoPatio !== 1 ? "s" : ""} no pátio</p>
        </div>
      </div>

      {/* Detalhes */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serviço</span>
          <span className="font-medium">{patioInfo.tipoServico}</span>
        </div>
        {patioInfo.osNumero && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">OS</span>
            <span className="font-medium">#{patioInfo.osNumero}</span>
          </div>
        )}
        {veiculo.cliente && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">{veiculo.cliente.nome}</span>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1 h-11" onClick={() => { onOpenChange(false); onEditVeiculo(); }}>
          Editar Veículo
        </Button>
        <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="text-left px-0">
            <DrawerTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-accent" />
              Veículo no Pátio
            </DrawerTitle>
          </DrawerHeader>
          {Content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-accent" />
            Veículo no Pátio
          </DialogTitle>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
}

export default function Veiculos() {
  const { veiculos, isLoading } = useVeiculos();
  const { oficinaAtual } = useOficina();
  const isAutoEletrica = oficinaAtual?.tipo === "auto_eletrica";

  // Lightweight query: only active OS for pátio info (instead of loading ALL OS)
  const { data: osAtivas = [] } = useQuery({
    queryKey: ["veiculos-patio-os", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("veiculo_id, status, tipo_servico, data_servico, numero")
        .eq("oficina_id", oficinaAtual.id)
        .in("status", ["pendente", "em_andamento", "em_diagnostico", "aguardando_peca"]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!oficinaAtual,
    staleTime: 30_000,
  });

  // Map veículos no pátio com info da OS
  const veiculosPatioMap = useMemo(() => {
    const map = new Map<string, PatioInfo>();
    osAtivas.forEach(o => {
      const diasNoPatio = Math.max(0, Math.floor((Date.now() - new Date(o.data_servico).getTime()) / 86400000));
      if (!map.has(o.veiculo_id) || (map.get(o.veiculo_id)!.diasNoPatio < diasNoPatio)) {
        map.set(o.veiculo_id, {
          status: o.status,
          diasNoPatio,
          tipoServico: o.tipo_servico,
          osNumero: o.numero ?? undefined,
        });
      }
    });
    return map;
  }, [osAtivas]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "carro" | "moto">("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [veiculoEdit, setVeiculoEdit] = useState<Veiculo | null>(null);
  const [patioModalOpen, setPatioModalOpen] = useState(false);
  const [patioVeiculo, setPatioVeiculo] = useState<Veiculo | null>(null);

  const filteredVeiculos = veiculos.filter((v) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.modelo.toLowerCase().includes(term) ||
      v.marca.toLowerCase().includes(term) ||
      v.placa?.toLowerCase().includes(term) ||
      v.chassi?.toLowerCase().includes(term) ||
      v.cliente?.nome.toLowerCase().includes(term);
    const matchesTipo = filtroTipo === "todos" || v.tipo === filtroTipo;
    return matchesSearch && matchesTipo;
  });

  const handleClick = (veiculo: Veiculo) => {
    const patioInfo = veiculosPatioMap.get(veiculo.id);
    if (patioInfo) {
      setPatioVeiculo(veiculo);
      setPatioModalOpen(true);
    } else {
      setVeiculoEdit(veiculo);
      setModalOpen(true);
    }
  };

  const handleEditFromPatio = () => {
    if (patioVeiculo) {
      setVeiculoEdit(patioVeiculo);
      setModalOpen(true);
    }
  };

  const handleNew = () => {
    setVeiculoEdit(null);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageLoader message="Carregando veículos..." />
      </MainLayout>
    );
  }

  const countCarros = veiculos.filter(v => v.tipo === "carro").length;
  const countMotos = veiculos.filter(v => v.tipo === "moto").length;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Veículos</h1>
            <p className="text-sm text-muted-foreground">{veiculos.length} cadastrados</p>
          </div>
          <Button onClick={handleNew} className="bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Veículo
          </Button>
        </div>

        {/* BLINDAGEM: banner de retomada de rascunho de novo veículo */}
        <DraftResumeBanner
          draftKey={`veiculo-form-${oficinaAtual?.id || "global"}-new`}
          label="veículo"
          hidden={modalOpen}
          onResume={handleNew}
        />


        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por modelo, marca ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setFiltroTipo("todos")}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                filtroTipo === "todos" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipo("carro")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                filtroTipo === "carro" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Car className="w-3.5 h-3.5" />
              {countCarros}
            </button>
            <button
              onClick={() => setFiltroTipo("moto")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                filtroTipo === "moto" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bike className="w-3.5 h-3.5" />
              {countMotos}
            </button>
          </div>
        </div>

        {filteredVeiculos.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <Car className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">
              {veiculos.length === 0 ? "Nenhum veículo cadastrado." : "Nenhum resultado."}
            </p>
            {veiculos.length === 0 && (
              <Button onClick={handleNew} size="sm">
                <Plus className="w-4 h-4 mr-2" /> Cadastrar veículo
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {filteredVeiculos.map((veiculo) => {
                const isMoto = veiculo.tipo === "moto";
                const patioInfo = veiculosPatioMap.get(veiculo.id);
                const patioConfig = patioInfo ? getPatioStatusConfig(patioInfo.status, patioInfo.diasNoPatio) : null;
                const PatioIcon = patioConfig?.icon;

                return (
                  <div
                    key={veiculo.id}
                    className={cn(
                      "flex items-center gap-3 p-3 sm:p-4 cursor-pointer transition-colors hover:bg-muted/30",
                      patioInfo && patioInfo.diasNoPatio > 3 && patioInfo.status !== "em_andamento" && "border-l-2 border-l-destructive"
                    )}
                    onClick={() => handleClick(veiculo)}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      patioInfo ? "bg-accent/10" : "bg-primary/10"
                    )}>
                      {isMoto ? (
                        <Bike className={cn("w-4 h-4", patioInfo ? "text-accent" : "text-primary")} />
                      ) : (
                        <Car className={cn("w-4 h-4", patioInfo ? "text-accent" : "text-primary")} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {veiculo.marca} {veiculo.modelo}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {veiculo.placa && (
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">
                            {veiculo.placa}
                          </span>
                        )}
                        {veiculo.ano && <span>{veiculo.ano}</span>}
                      </div>
                    </div>

                    {veiculo.cliente && (
                      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{veiculo.cliente.nome}</span>
                      </div>
                    )}

                    <div className="hidden sm:flex items-center gap-1.5">
                      {patioInfo && patioConfig && PatioIcon && (
                        <Badge variant="outline" className={cn("text-xs font-semibold", patioConfig.color)}>
                          <PatioIcon className="w-3 h-3 mr-0.5" />
                          {patioConfig.label}
                        </Badge>
                      )}
                      <RiscoBadgeVeiculo veiculoId={veiculo.id} isAutoEletrica={isAutoEletrica} />
                      {!patioInfo && (
                        <Badge
                          variant="outline"
                          className={cn("text-xs", isMoto ? "border-accent/30 text-accent" : "border-primary/30 text-primary")}
                        >
                          {isMoto ? "Moto" : "Carro"}
                        </Badge>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <VeiculoFormModal open={modalOpen} onOpenChange={setModalOpen} veiculo={veiculoEdit} />

      {patioVeiculo && veiculosPatioMap.get(patioVeiculo.id) && (
        <PatioInfoModal
          open={patioModalOpen}
          onOpenChange={setPatioModalOpen}
          veiculo={patioVeiculo}
          patioInfo={veiculosPatioMap.get(patioVeiculo.id)!}
          onEditVeiculo={handleEditFromPatio}
        />
      )}
    </MainLayout>
  );
}
