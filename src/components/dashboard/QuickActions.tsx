import { Link } from "react-router-dom";
import { Plus, UserPlus, Car, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    icon: Plus,
    label: "Nova OS",
    description: "Criar ordem de serviço",
    color: "text-accent",
    bgColor: "bg-accent/10",
    path: "/servicos",
  },
  {
    icon: UserPlus,
    label: "Novo Cliente",
    description: "Cadastrar cliente",
    color: "text-info",
    bgColor: "bg-info/10",
    path: "/clientes",
  },
  {
    icon: Car,
    label: "Novo Veículo",
    description: "Adicionar veículo",
    color: "text-success",
    bgColor: "bg-success/10",
    path: "/veiculos",
  },
  {
    icon: Calendar,
    label: "Agendar",
    description: "Marcar serviço",
    color: "text-warning",
    bgColor: "bg-warning/10",
    path: "/agenda",
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.path}
          className="quick-action group"
        >
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110",
              action.bgColor
            )}
          >
            <action.icon className={cn("w-6 h-6", action.color)} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
