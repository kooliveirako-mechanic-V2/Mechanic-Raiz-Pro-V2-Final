import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { formatCurrency } from "@/lib/formatters";

// ============================================
// INDICADOR DE LUCRO POR DIAGNÓSTICO
// Classificação visual simples com cores
// ============================================

interface DiagnosticProfitIndicatorProps {
  valorServico: number;
  custoServico: number;
  tempoMinutos?: number;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

type ProfitClassification = "prejuizo" | "baixa" | "saudavel" | "excelente";

const getClassification = (margem: number): ProfitClassification => {
  if (margem <= 0) return "prejuizo";
  if (margem < 15) return "baixa";
  if (margem < 50) return "saudavel";
  return "excelente";
};

// Linguagem progressiva: orienta sem julgar
const classificationConfig: Record<ProfitClassification, {
  label: string;
  labelConsultivo: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof TrendingUp;
}> = {
  prejuizo: {
    label: "Revisar margem",
    labelConsultivo: "Ponto de atenção",
    emoji: "🔴",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    borderColor: "border-destructive/30",
    icon: TrendingDown,
  },
  baixa: {
    label: "Ajuste recomendado",
    labelConsultivo: "Oportunidade de melhoria",
    emoji: "🟠",
    color: "text-warning",
    bgColor: "bg-warning/10",
    borderColor: "border-warning/30",
    icon: TrendingDown,
  },
  saudavel: {
    label: "Saudável",
    labelConsultivo: "Dentro do esperado",
    emoji: "🟢",
    color: "text-success",
    bgColor: "bg-success/10",
    borderColor: "border-success/30",
    icon: TrendingUp,
  },
  excelente: {
    label: "Excelente",
    labelConsultivo: "Ótima rentabilidade",
    emoji: "🔵",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    icon: TrendingUp,
  },
};


export function DiagnosticProfitIndicator({
  valorServico,
  custoServico,
  tempoMinutos,
  showDetails = false,
  size = "md",
  className,
}: DiagnosticProfitIndicatorProps) {
  const { isAutoEletrica, labels } = useOficinaLabels();
  
  const lucro = valorServico - custoServico;
  const margem = valorServico > 0 ? (lucro / valorServico) * 100 : 0;
  const classification = getClassification(margem);
  const config = classificationConfig[classification];
  const Icon = config.icon;

  // Calcular valor por hora (rentabilidade)
  const valorPorHora = tempoMinutos && tempoMinutos > 0 
    ? (lucro / tempoMinutos) * 60 
    : null;

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  // Versão compacta (badge)
  if (!showDetails) {
    return (
      <Badge 
        variant="outline"
        className={cn(
          sizeClasses[size],
          config.bgColor,
          config.color,
          config.borderColor,
          "font-medium",
          className
        )}
      >
        <Icon className={cn(
          "mr-1",
          size === "sm" ? "w-3 h-3" : size === "md" ? "w-3.5 h-3.5" : "w-4 h-4"
        )} />
        {config.emoji} {margem.toFixed(0)}%
      </Badge>
    );
  }

  // Versão detalhada (card)
  return (
    <div className={cn(
      "rounded-lg border p-3",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            config.bgColor
          )}>
            <Icon className={cn("w-4 h-4", config.color)} />
          </div>
          <div>
            <p className={cn("font-semibold text-sm", config.color)}>
              {isAutoEletrica ? "Resultado do Diagnóstico" : labels.lucroOS}
            </p>
            <Badge 
              variant="outline" 
              className={cn("text-[10px] mt-0.5", config.bgColor, config.color, config.borderColor)}
            >
              {config.emoji} {config.label}
            </Badge>
          </div>
        </div>
        <p className={cn(
          "text-xl font-bold",
          lucro >= 0 ? "text-success" : "text-destructive"
        )}>
          {formatCurrency(lucro)}
        </p>
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-background/50 rounded">
          <p className="text-muted-foreground">Valor</p>
          <p className="font-semibold">{formatCurrency(valorServico)}</p>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <p className="text-muted-foreground">Custo</p>
          <p className="font-semibold">{formatCurrency(custoServico)}</p>
        </div>
        <div className="text-center p-2 bg-background/50 rounded">
          <p className="text-muted-foreground">
            {isAutoEletrica ? "Rentabilidade" : "Margem"}
          </p>
          <p className={cn("font-semibold", config.color)}>{margem.toFixed(1)}%</p>
        </div>
      </div>

      {/* Tempo técnico e valor/hora */}
      {tempoMinutos && tempoMinutos > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {isAutoEletrica ? "Tempo Técnico" : "Tempo"}: {tempoMinutos} min
          </span>
          {valorPorHora !== null && (
            <span className={cn(
              "font-medium",
              valorPorHora >= 100 ? "text-success" : valorPorHora >= 50 ? "text-warning" : "text-destructive"
            )}>
              {formatCurrency(valorPorHora)}/hora
            </span>
          )}
        </div>
      )}

      {/* Insight consultivo - tom de orientação */}
      {classification === "prejuizo" && (
        <p className="mt-2 text-[10px] text-muted-foreground italic">
          💡 Este {isAutoEletrica ? "diagnóstico" : "serviço"} pode precisar de ajuste. Revisar o valor ajuda a proteger sua margem.
        </p>
      )}
      {classification === "baixa" && (
        <p className="mt-2 text-[10px] text-muted-foreground italic">
          💡 Oportunidade de melhoria identificada. Um pequeno ajuste pode melhorar a rentabilidade.
        </p>
      )}
    </div>
  );
}
