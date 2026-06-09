import { motion } from "framer-motion";
import { 
  AlertTriangle, 
  TrendingDown, 
  Zap, 
  Users, 
  Wrench, 
  Package,
  CheckCircle,
  X,
  ChevronRight,
  Flame,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModoGuerraAlert, ModoGuerraSeverity } from "@/hooks/useModoGuerraAlerts";
import { useNavigate } from "react-router-dom";

interface ModoGuerraAlertCardProps {
  alert: ModoGuerraAlert;
  onResolver?: (id: string) => void;
  onIgnorar?: (id: string) => void;
  compact?: boolean;
}

// Linguagem consultiva: orienta sem julgar
const severityConfig: Record<ModoGuerraSeverity, {
  bg: string;
  border: string;
  iconBg: string;
  iconColor: string;
  label: string;
  tone: string;
}> = {
  critical: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600",
    label: "Importante",
    tone: "Requer sua atenção",
  },
  attention: {
    bg: "bg-warning/5",
    border: "border-warning/30",
    iconBg: "bg-warning/15",
    iconColor: "text-warning",
    label: "Atenção",
    tone: "Vale revisar",
  },
  insight: {
    bg: "bg-blue-500/5",
    border: "border-blue-500/30",
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600",
    label: "Insight",
    tone: "Oportunidade identificada",
  },
};

const tipoIcons: Record<ModoGuerraAlert["tipo"], typeof AlertTriangle> = {
  prejuizo_os: TrendingDown,
  margem_baixa: TrendingDown,
  diagnostico_subvalorizado: Zap,
  cliente_risco: Users,
  servico_problematico: Wrench,
  estoque_critico: Package,
};


export function ModoGuerraAlertCard({ 
  alert, 
  onResolver, 
  onIgnorar,
  compact = false 
}: ModoGuerraAlertCardProps) {
  const navigate = useNavigate();
  const config = severityConfig[alert.severity];
  const Icon = tipoIcons[alert.tipo];

  const handlePrimaryAction = () => {
    // Navegar baseado no tipo de referência
    switch (alert.referenciaTipo) {
      case "os":
        navigate("/servicos");
        break;
      case "cliente":
        navigate("/clientes");
        break;
      case "estoque":
        navigate("/estoque");
        break;
      default:
        break;
    }
    onResolver?.(alert.id);
  };

  const handleSecondaryAction = () => {
    onIgnorar?.(alert.id);
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className={cn(
          "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
          config.bg,
          config.border
        )}
        onClick={handlePrimaryAction}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", config.iconBg)}>
            <Icon className={cn("w-4 h-4", config.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{alert.titulo}</p>
            <p className={cn("text-xs font-semibold", config.iconColor)}>
              {alert.impactoLabel}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        config.bg,
        config.border
      )}
    >
      {/* Badge Modo Guerra - Mais discreto */}
      <div className="absolute top-3 right-3">
        <Badge 
          variant="outline" 
          className="bg-background/80 backdrop-blur-sm border-amber-500/30 text-amber-600 text-[10px] font-medium"
        >
          <Eye className="w-3 h-3 mr-1" />
          Alerta Inteligente
        </Badge>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3 pr-24">
        <div className={cn(
          "p-3 rounded-xl flex-shrink-0",
          config.iconBg
        )}>
          <Icon className={cn("w-5 h-5", config.iconColor)} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-foreground">
              {alert.titulo}
            </h4>
            {alert.recorrencia && alert.recorrencia > 1 && (
              <Badge variant="secondary" className="text-[10px]">
                {alert.recorrencia}x recorrente
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mt-1">
            {alert.descricao}
          </p>
        </div>
      </div>

      {/* Impacto Financeiro - Tom consultivo */}
      <div className={cn(
        "mt-3 p-3 rounded-lg border",
        alert.severity === "critical" 
          ? "bg-amber-500/5 border-amber-500/20" 
          : "bg-muted/50 border-border"
      )}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {alert.severity === "critical" ? "Impacto potencial:" : "Valor envolvido:"}
          </span>
          <span className={cn(
            "text-lg font-bold",
            alert.severity === "critical" ? "text-amber-600" : config.iconColor
          )}>
            {alert.impactoFinanceiro > 0 
              ? formatCurrency(alert.impactoFinanceiro)
              : alert.impactoLabel
            }
          </span>
        </div>
        {/* Subtexto consultivo */}
        <p className="text-xs text-muted-foreground mt-1">
          {alert.severity === "critical" 
            ? "Corrigir isso ajuda a proteger sua margem"
            : "Informação baseada nos seus dados reais"
          }
        </p>
      </div>

      {/* Ação Recomendada */}
      <div className="mt-3 flex items-start gap-2">
        <Eye className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Ação recomendada:</span> {alert.acaoRecomendada}
        </p>
      </div>

      {/* CTAs */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant={alert.severity === "critical" ? "destructive" : "default"}
          onClick={handlePrimaryAction}
          className="flex-1"
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          {alert.ctaPrimario}
        </Button>
        
        {alert.ctaSecundario && onIgnorar && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSecondaryAction}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
