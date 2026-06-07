import { ReactNode, forwardRef } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  className?: string;
  hoverScale?: number;
  hoverY?: number;
  glowColor?: string;
  variant?: "default" | "glass" | "gradient" | "elevated";
}

const variantClasses = {
  default: "bg-card border border-border",
  glass: "bg-card/80 backdrop-blur-xl border border-border/50",
  gradient: "bg-gradient-to-br from-card via-card to-muted/30 border border-border",
  elevated: "bg-card border border-border shadow-xl shadow-primary/5",
};

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ children, className, hoverScale = 1.01, hoverY = -4, glowColor, variant = "default", ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ 
          scale: hoverScale, 
          y: hoverY,
          transition: { duration: 0.2, ease: "easeOut" }
        }}
        whileTap={{ scale: 0.99 }}
        transition={{ 
          duration: 0.4, 
          ease: [0.25, 0.46, 0.45, 0.94]
        }}
        className={cn(
          "rounded-2xl overflow-hidden transition-shadow duration-300",
          "hover:shadow-2xl hover:shadow-primary/10",
          variantClasses[variant],
          className
        )}
        style={{
          boxShadow: glowColor ? `0 0 40px ${glowColor}` : undefined,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";

// Stat card with number animation
interface AnimatedStatProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedStat({ value, prefix = "", suffix = "", className }: AnimatedStatProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        type: "spring" as const, 
        stiffness: 200, 
        damping: 20,
        delay: 0.2
      }}
      className={className}
    >
      {prefix}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {value.toLocaleString("pt-BR")}
      </motion.span>
      {suffix}
    </motion.span>
  );
}

// Hover glow effect
export function GlowEffect({ color = "accent", className }: { color?: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      className={cn(
        "absolute inset-0 -z-10 blur-3xl rounded-full",
        color === "accent" && "bg-accent/20",
        color === "primary" && "bg-primary/20",
        color === "success" && "bg-success/20",
        className
      )}
    />
  );
}
