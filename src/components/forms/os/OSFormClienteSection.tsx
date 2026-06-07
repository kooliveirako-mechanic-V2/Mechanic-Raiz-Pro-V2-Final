import { Label } from "@/components/ui/label";
import { ClienteSelectWithCreate } from "../ClienteSelectWithCreate";
import { VeiculoSelectWithCreate } from "../VeiculoSelectWithCreate";
import { SectionHeader } from "./SectionHeader";
import { Search } from "lucide-react";

interface Props {
  clienteId: string;
  setClienteId: (v: string) => void;
  veiculoId: string;
  setVeiculoId: (v: string) => void;
  veiculosDoCliente: Array<{ id: string; cliente_id: string; tipo: string; marca: string; modelo: string; placa: string | null }>;
}

export function OSFormClienteSection({ clienteId, setClienteId, veiculoId, setVeiculoId, veiculosDoCliente }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Search} title="Cliente e Veículo" subtitle="Quem é e qual o carro/moto" step={1} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente *</Label>
          <ClienteSelectWithCreate value={clienteId} onValueChange={setClienteId} required />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Veículo *</Label>
          <VeiculoSelectWithCreate
            value={veiculoId}
            onValueChange={setVeiculoId}
            clienteId={clienteId}
            veiculosDoCliente={veiculosDoCliente}
            required
          />
        </div>
      </div>
    </div>
  );
}
