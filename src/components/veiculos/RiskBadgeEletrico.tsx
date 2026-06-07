import { AlertTriangle, Shield, Zap, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface RiskBadgeEletricoProps {
  risco: "alto" | "medio" | "baixo" | "saudavel";
  variant?: "badge" | "compact" | "full";
  className?: string;
}

// Linguagem progressiva: orienta sem julgar
const riskConfig = {
  alto: {
    label: "Padrão recorrente detectado",
    labelCompact: "Atenção",
    description: "Este histórico ajuda a evitar retrabalho",
    icon: AlertTriangle,
    bgColor: "bg-warning/10",
    borderColor: "border-warning/50",
    textColor: "text-warning",
    iconPulse: true,
  },
  medio: {
    label: "Sinal de atenção identificado",
    labelCompact: "Analisar",
    description: "Baseado no histórico real do veículo",
    icon: Zap,
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/50",
    textColor: "text-amber-600",
    iconPulse: false,
  },
  baixo: {
    label: "Histórico registrado",
    labelCompact: "Normal",
    description: "Dados disponíveis para consulta",
    icon: Zap,
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    textColor: "text-muted-foreground",
    iconPulse: false,
  },
  saudavel: {
    label: "Histórico elétrico saudável",
    labelCompact: "Saudável",
    description: "Veículo sem padrões de recorrência",
    icon: Shield,
    bgColor: "bg-success/10",
    borderColor: "border-success/50",
    textColor: "text-success",
    iconPulse: false,
  },
};

export function RiskBadgeEletrico({ 
  risco, 
  variant = "badge",
  className 
}: RiskBadgeEletricoProps) {
  const config = riskConfig[risco];
  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "text-[10px] font-medium",
          config.bgColor,
          config.borderColor,
          config.textColor,
          className
        )}
      >
        <Icon className={cn(
          "w-3 h-3 mr-1",
          config.iconPulse && "animate-pulse"
        )} />
        {config.labelCompact}
      </Badge>
    );
  }

  if (variant === "full") {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border",
        config.bgColor,
        config.borderColor,
        className
      )}>
        <div className={cn(
          "p-1.5 rounded-md",
          config.bgColor
        )}>
          <Icon className={cn(
            "w-4 h-4",
            config.textColor,
            config.iconPulse && "animate-pulse"
          )} />
        </div>
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.label}
        </span>
      </div>
    );
  }

  // Default badge variant
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-medium",
        config.bgColor,
        config.borderColor,
        config.textColor,
        className
      )}
    >
      <Icon className={cn(
        "w-3 h-3 mr-1",
        config.iconPulse && "animate-pulse"
      )} />
      {config.label}
    </Badge>
  );
}

// Status Modo Guerra Badge para timeline - Linguagem consultiva
interface StatusModoGuerraBadgeProps {
  status: "prejuizo" | "margem_baixa" | "saudavel" | "excelente";
  showValue?: number;
  className?: string;
}

// Termos orientativos, sem acusação
const statusModoGuerraConfig = {
  prejuizo: {
    emoji: "🔴",
    label: "Revisar margem",
    tooltip: "Este serviço pode precisar de ajuste de preço",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    textColor: "text-destructive",
  },
  margem_baixa: {
    emoji: "🟠",
    label: "Atenção",
    tooltip: "Margem abaixo do ideal — considere revisar",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    textColor: "text-warning",
  },
  saudavel: {
    emoji: "🟢",
    label: "Saudável",
    tooltip: "Margem dentro do esperado",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    textColor: "text-success",
  },
  excelente: {
    emoji: "🔵",
    label: "Excelente",
    tooltip: "Ótima rentabilidade",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    textColor: "text-primary",
  },
};

export function StatusModoGuerraBadge({ 
  status, 
  showValue,
  className 
}: StatusModoGuerraBadgeProps) {
  const config = statusModoGuerraConfig[status];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[10px] font-semibold gap-1",
        config.bgColor,
        config.borderColor,
        config.textColor,
        className
      )}
    >
      <span>{config.emoji}</span>
      {config.label}
      {showValue !== undefined && (
        <span className="font-bold">{formatCurrency(showValue)}</span>
      )}
    </Badge>
  );
}

// Recurrence Badge - Linguagem orientativa
interface RecorrenciaBadgeProps {
  ocorrencias: number;
  dias?: number;
  className?: string;
}

export function RecorrenciaBadge({ 
  ocorrencias, 
  dias,
  className 
}: RecorrenciaBadgeProps) {
  const isRecente = dias !== undefined && dias < 30;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[10px] font-medium gap-1",
        isRecente ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "bg-muted border-border text-muted-foreground",
        className
      )}
    >
      <AlertTriangle className={cn("w-3 h-3", isRecente && "animate-pulse")} />
      {ocorrencias}x {isRecente ? "nos últimos 30 dias" : "no histórico"}
    </Badge>
  );
}
