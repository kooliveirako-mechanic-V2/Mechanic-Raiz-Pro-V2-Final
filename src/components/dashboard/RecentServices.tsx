import { Clock, CheckCircle2, AlertCircle, PlayCircle, Car, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type ServiceStatus = "pending" | "in-progress" | "completed" | "overdue";

interface Service {
  id: string;
  clientName: string;
  vehicleType: "car" | "moto";
  vehicleModel: string;
  plate: string;
  serviceType: string;
  status: ServiceStatus;
  scheduledTime?: string;
  value: number;
}

const mockServices: Service[] = [
  {
    id: "1",
    clientName: "Carlos Silva",
    vehicleType: "car",
    vehicleModel: "Honda Civic 2020",
    plate: "ABC-1234",
    serviceType: "Troca de Óleo + Filtros",
    status: "in-progress",
    scheduledTime: "09:00",
    value: 280,
  },
  {
    id: "2",
    clientName: "Maria Santos",
    vehicleType: "moto",
    vehicleModel: "Honda CG 160",
    plate: "XYZ-5678",
    serviceType: "Revisão Completa",
    status: "pending",
    scheduledTime: "10:30",
    value: 450,
  },
  {
    id: "3",
    clientName: "João Oliveira",
    vehicleType: "car",
    vehicleModel: "Toyota Corolla 2019",
    plate: "DEF-9012",
    serviceType: "Troca de Pastilhas de Freio",
    status: "completed",
    scheduledTime: "08:00",
    value: 380,
  },
  {
    id: "4",
    clientName: "Ana Costa",
    vehicleType: "moto",
    vehicleModel: "Yamaha Fazer 250",
    plate: "GHI-3456",
    serviceType: "Troca de Pneu Traseiro",
    status: "overdue",
    scheduledTime: "Ontem",
    value: 320,
  },
];

const statusConfig: Record<
  ServiceStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "Aguardando",
    icon: Clock,
    className: "status-pending",
  },
  "in-progress": {
    label: "Em Andamento",
    icon: PlayCircle,
    className: "status-in-progress",
  },
  completed: {
    label: "Finalizado",
    icon: CheckCircle2,
    className: "status-completed",
  },
  overdue: {
    label: "Atrasado",
    icon: AlertCircle,
    className: "status-overdue",
  },
};

export function RecentServices() {
  const navigate = useNavigate();

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Serviços de Hoje</h2>
          <p className="text-sm text-muted-foreground">4 serviços agendados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/servicos")}>
          Ver Todos
        </Button>
      </div>
      <div className="divide-y divide-border">
        {mockServices.map((service, index) => {
          const status = statusConfig[service.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={service.id}
              className="p-4 hover:bg-muted/30 transition-colors cursor-pointer animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                {/* Vehicle Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {service.vehicleType === "car" ? (
                    <Car className="w-5 h-5 text-primary" />
                  ) : (
                    <Bike className="w-5 h-5 text-primary" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground truncate">
                      {service.clientName}
                    </p>
                    <Badge variant="outline" className={cn("text-xs", status.className)}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {service.vehicleModel} • {service.plate}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {service.serviceType}
                  </p>
                </div>

                {/* Time & Value */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {service.scheduledTime}
                  </p>
                  <p className="text-lg font-bold text-accent mt-1">
                    R$ {service.value.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
