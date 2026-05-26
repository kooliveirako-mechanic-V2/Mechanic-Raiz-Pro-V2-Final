import { Droplets, Disc, Settings, Gauge, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceStat {
  name: string;
  count: number;
  percentage: number;
  icon: typeof Droplets;
  color: string;
}

const topServices: ServiceStat[] = [
  { name: "Troca de Óleo", count: 45, percentage: 35, icon: Droplets, color: "bg-accent" },
  { name: "Troca de Pastilhas", count: 28, percentage: 22, icon: Disc, color: "bg-primary" },
  { name: "Revisão Completa", count: 22, percentage: 17, icon: Settings, color: "bg-success" },
  { name: "Troca de Pneu", count: 18, percentage: 14, icon: Gauge, color: "bg-info" },
  { name: "Parte Elétrica", count: 15, percentage: 12, icon: Zap, color: "bg-warning" },
];

export function TopServices() {
  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          Serviços Mais Realizados
        </h2>
        <p className="text-sm text-muted-foreground">Este mês</p>
      </div>

      <div className="space-y-4">
        {topServices.map((service, index) => (
          <div
            key={service.name}
            className="animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    service.color + "/10"
                  )}
                >
                  <service.icon
                    className={cn("w-4 h-4", service.color.replace("bg-", "text-"))}
                  />
                </div>
                <span className="font-medium text-foreground">{service.name}</span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-foreground">{service.count}</span>
                <span className="text-sm text-muted-foreground ml-1">serviços</span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", service.color)}
                style={{ width: `${service.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
