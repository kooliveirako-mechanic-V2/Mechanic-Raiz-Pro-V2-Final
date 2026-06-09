import { LucideIcon, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type StatVariant = "default" | "primary" | "accent" | "success" | "warning" | "destructive";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: StatVariant;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  delay?: number;
  isModoLimpo?: boolean;
}

const variantConfig: Record<StatVariant, {
  iconBg: string;
  iconColor: string;
}> = {
  default: { iconBg: "bg-primary/15", iconColor: "text-primary" },
  primary: { iconBg: "bg-primary/15", iconColor: "text-primary" },
  accent: { iconBg: "bg-accent/15", iconColor: "text-accent" },
  success: { iconBg: "bg-success/15", iconColor: "text-success" },
  warning: { iconBg: "bg-warning/15", iconColor: "text-warning" },
  destructive: { iconBg: "bg-destructive/15", iconColor: "text-destructive" },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  className,
  delay = 0,
  isModoLimpo = false,
}: StatCardProps) {
  const config = variantConfig[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "relative p-4 rounded-xl",
        "bg-card border border-border/50",
        "transition-colors duration-150",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
          {isModoLimpo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Shield className="w-3 h-3 text-info shrink-0 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[10px]">Modo Limpo Ativo: Registros de teste ignorados por manifesto.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center",
          config.iconBg
        )}>
          <Icon className={cn("w-4 h-4", config.iconColor)} />
        </div>
      </div>

      <p className="text-2xl font-bold text-foreground tracking-tight leading-none">
        {value}
      </p>

      {trend && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded",
            trend.value >= 0
              ? "text-success bg-success/10"
              : "text-destructive bg-destructive/10"
          )}>
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{trend.label}</span>
        </div>
      )}

      {subtitle && !trend && (
        <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
      )}
    </motion.div>
  );
}
