import { Plus, ClipboardList, User, Car, Package, Zap } from "lucide-react";
import { OSRapidaModal } from "@/components/servicos/OSRapidaModal";
import { OrdemServicoFormModal } from "@/components/forms/OrdemServicoFormModal";
import { ClienteFormModal } from "@/components/forms/ClienteFormModal";
import { VeiculoFormModal } from "@/components/forms/VeiculoFormModal";
import { EstoqueFormModal } from "@/components/forms/EstoqueFormModal";
import { VendaRapidaModal } from "@/components/vendas/VendaRapidaModal";
import { useModalUrl } from "@/hooks/useModalUrl";
import { cn } from "@/lib/utils";

interface DashboardQuickActionsProps {
  onOSCreated?: () => void;
}

const actions = [
  {
    id: "os-rapida",
    icon: Plus,
    label: "Nova OS Rápida",
    color: "text-accent",
    bgColor: "bg-accent/12",
    borderColor: "border-accent/25",
    primary: true,
  },
  {
    id: "venda-rapida",
    icon: Zap,
    label: "Venda Rápida",
    color: "text-warning",
    bgColor: "bg-warning/12",
    borderColor: "border-warning/25",
    primary: true,
  },
  {
    id: "os-completa",
    icon: ClipboardList,
    label: "OS Completa",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  {
    id: "novo-cliente",
    icon: User,
    label: "Cliente",
    color: "text-info",
    bgColor: "bg-info/10",
    borderColor: "border-info/20",
  },
  {
    id: "novo-veiculo",
    icon: Car,
    label: "Veículo",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/20",
  },
  {
    id: "nova-peca",
    icon: Package,
    label: "Peça",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/20",
  },
];

export function DashboardQuickActions({ onOSCreated }: DashboardQuickActionsProps) {
  const [osRapidaOpen, setOsRapidaOpen] = useModalUrl("os-rapida");
  const [vendaRapidaOpen, setVendaRapidaOpen] = useModalUrl("venda-rapida");
  const [osCompletaOpen, setOsCompletaOpen] = useModalUrl("os-completa");
  const [clienteModalOpen, setClienteModalOpen] = useModalUrl("novo-cliente");
  const [veiculoModalOpen, setVeiculoModalOpen] = useModalUrl("novo-veiculo");
  const [estoqueModalOpen, setEstoqueModalOpen] = useModalUrl("nova-peca");

  const modalMap: Record<string, () => void> = {
    "os-rapida": () => setOsRapidaOpen(true),
    "venda-rapida": () => setVendaRapidaOpen(true),
    "os-completa": () => setOsCompletaOpen(true),
    "novo-cliente": () => setClienteModalOpen(true),
    "novo-veiculo": () => setVeiculoModalOpen(true),
    "nova-peca": () => setEstoqueModalOpen(true),
  };

  return (
    <>
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Ações rápidas
        </p>
        {/* Mobile: row horizontal compacta / Desktop: 6 colunas */}
        <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible scrollbar-none">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => modalMap[action.id]()}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-card shrink-0",
                "hover:shadow-sm active:scale-[0.97] transition-all duration-150 cursor-pointer",
                "lg:flex-col lg:items-center lg:gap-1.5 lg:px-3 lg:py-3",
                action.borderColor,
                action.primary && "ring-1 ring-accent/30"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  "lg:w-9 lg:h-9 lg:rounded-xl",
                  action.bgColor
                )}
              >
                <action.icon className={cn("w-4 h-4", action.color)} strokeWidth={action.primary ? 2.5 : 2} />
              </div>
              <span className="text-xs font-semibold text-foreground whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <OSRapidaModal open={osRapidaOpen} onOpenChange={setOsRapidaOpen} />
      <VendaRapidaModal open={vendaRapidaOpen} onOpenChange={setVendaRapidaOpen} />
      <OrdemServicoFormModal open={osCompletaOpen} onOpenChange={setOsCompletaOpen} ordem={null} />
      <ClienteFormModal open={clienteModalOpen} onOpenChange={setClienteModalOpen} cliente={null} />
      <VeiculoFormModal open={veiculoModalOpen} onOpenChange={setVeiculoModalOpen} veiculo={null} />
      <EstoqueFormModal open={estoqueModalOpen} onOpenChange={setEstoqueModalOpen} item={null} />
    </>
  );
}
