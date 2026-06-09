import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type StatVariant = "default" | "primary" | "accent" | "success" | "warning" | "destructive" | "info";

interface MobileStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: StatVariant;
  className?: string;
  delay?: number;
}

const variantConfig: Record<StatVariant, { 
  gradient: string;
  iconGradient: string;
  glowClass: string;
  border: string;
  lightShadow: string;
}> = {
  default: { 
    gradient: "from-primary/15 via-primary/5 to-transparent", 
    iconGradient: "from-primary to-primary/70",
    glowClass: "dark:shadow-glow-primary",
    border: "border-primary/10 dark:border-primary/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
  primary: { 
    gradient: "from-primary/15 via-primary/5 to-transparent", 
    iconGradient: "from-primary to-primary/70",
    glowClass: "dark:shadow-glow-primary",
    border: "border-primary/10 dark:border-primary/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
  accent: { 
    gradient: "from-accent/15 via-accent/5 to-transparent", 
    iconGradient: "from-accent to-accent/70",
    glowClass: "dark:shadow-glow-accent",
    border: "border-accent/10 dark:border-accent/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
  success: { 
    gradient: "from-success/15 via-success/5 to-transparent", 
    iconGradient: "from-success to-success/70",
    glowClass: "dark:shadow-glow-success",
    border: "border-success/10 dark:border-success/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
  warning: { 
    gradient: "from-warning/15 via-warning/5 to-transparent", 
    iconGradient: "from-warning to-warning/70",
    glowClass: "dark:shadow-glow-warning",
    border: "border-warning/10 dark:border-warning/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
  destructive: { 
    gradient: "from-destructive/15 via-destructive/5 to-transparent", 
    iconGradient: "from-destructive to-destructive/70",
    glowClass: "dark:shadow-[0_0_20px_hsl(var(--destructive)/0.25)]",
    border: "border-destructive/10 dark:border-destructive/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
  info: { 
    gradient: "from-info/15 via-info/5 to-transparent", 
    iconGradient: "from-info to-info/70",
    glowClass: "dark:shadow-[0_0_20px_hsl(var(--info)/0.25)]",
    border: "border-info/10 dark:border-info/30",
    lightShadow: "shadow-[0_4px_16px_-2px_rgb(15_23_42/0.05)]"
  },
};

export function MobileStatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  className,
  delay = 0,
}: MobileStatCardProps) {
  const config = variantConfig[variant];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-3 border",
        "bg-card",
        config.lightShadow,
        `bg-gradient-to-br ${config.gradient}`,
        config.border,
        config.glowClass,
        "flex flex-col items-center text-center gap-2",
        "transition-all duration-200",
        className
      )}
    >
      {/* Industrial top glow line */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent dark:via-primary/70" />
      
      {/* Background glow */}
      <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-xl" />
      
      <motion.div 
        whileTap={{ scale: 1.1 }}
        className={cn(
          "relative w-10 h-10 rounded-xl flex items-center justify-center",
          `bg-gradient-to-br ${config.iconGradient}`,
          "shadow-lg",
          config.glowClass
        )}
      >
        <Icon className="w-5 h-5 text-white" />
      </motion.div>

      <div className="relative w-full">
        <p className="text-base font-bold text-foreground leading-tight dark:text-glow">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">{title}</p>
      </div>
    </motion.div>
  );
}
