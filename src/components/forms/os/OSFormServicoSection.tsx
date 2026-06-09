import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsavelSelect } from "../ResponsavelSelect";
import { SectionHeader } from "./SectionHeader";
import { StatusOS } from "@/hooks/useOrdensServico";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  responsavelId: string;
  setResponsavelId: (v: string) => void;
  dataServico: string;
  setDataServico: (v: string) => void;
  horaAgendamento: string;
  setHoraAgendamento: (v: string) => void;
  tiposServicoSelecionados: string[];
  setTiposServicoSelecionados: React.Dispatch<React.SetStateAction<string[]>>;
  isCustomTipoServico: boolean;
  setIsCustomTipoServico: (v: boolean) => void;
  customTipoServico: string;
  setCustomTipoServico: (v: string) => void;
  tiposServico: string[];
  kmNoServico: string;
  setKmNoServico: (v: string) => void;
  status: StatusOS;
  setStatus: (v: StatusOS) => void;
  descricao: string;
  setDescricao: (v: string) => void;
  isAutoEletrica: boolean;
  maoDeObraPorServico?: Record<string, string>;
  setMaoDeObraPorServico?: (v: Record<string, string>) => void;
  isEditing?: boolean;
}

export function OSFormServicoSection({
  responsavelId, setResponsavelId,
  dataServico, setDataServico,
  horaAgendamento, setHoraAgendamento,
  kmNoServico, setKmNoServico,
  status, setStatus,
  descricao, setDescricao,
  isAutoEletrica,
}: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={CalendarClock} title="Atendimento" subtitle="Responsável, data, status e descrição do que será feito" step={2} />

      <ResponsavelSelect value={responsavelId} onValueChange={setResponsavelId} />

      {/* Data e Hora */}
      <div className="grid grid-cols-5 sm:grid-cols-2 gap-3">
        <div className="space-y-2 col-span-3 sm:col-span-1">
          <Label htmlFor="data" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data *</Label>
          <Input id="data" type="date" value={dataServico} onChange={(e) => setDataServico(e.target.value)} required className="h-12 text-base" />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="hora" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hora</Label>
          <Input id="hora" type="time" value={horaAgendamento} onChange={(e) => setHoraAgendamento(e.target.value)} className="h-12 w-full text-base" placeholder="08:00" />
        </div>
      </div>

      {/* KM e Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="km" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">KM Atual</Label>
          <Input id="km" type="number" inputMode="numeric" placeholder="50000" value={kmNoServico} onChange={(e) => setKmNoServico(e.target.value)} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusOS)}>
            <SelectTrigger className={cn(
              "h-12 text-base font-semibold transition-all",
              status === "finalizado" 
                ? "border-success bg-success/5 text-success ring-1 ring-success/20" 
                : "border-input"
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999] bg-background" position="popper" sideOffset={4}>
              <SelectItem value="aberto" className="py-3">Aberto</SelectItem>
              <SelectItem value="pendente" className="py-3">Aguardando</SelectItem>
              {isAutoEletrica && <SelectItem value="em_diagnostico" className="py-3">Em Diagnóstico</SelectItem>}
              <SelectItem value="em_andamento" className="py-3">Em Andamento</SelectItem>
              <SelectItem value="aguardando_peca" className="py-3">Aguardando Peça</SelectItem>
              <SelectItem value="finalizado" className="py-3 font-bold text-success">✅ Finalizado</SelectItem>
              <SelectItem value="cancelado" className="py-3 text-destructive">❌ Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label htmlFor="descricao" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {isAutoEletrica ? "Sintoma Relatado" : "O que será feito?"}
        </Label>
        <Textarea
          id="descricao"
          placeholder={isAutoEletrica ? "Ex: Carro não liga, luzes do painel acendem mas motor não dá partida..." : "Descreva os serviços a serem realizados..."}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="text-base min-h-[80px]"
        />
      </div>
    </div>
  );
}
