import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Modern spinning loader
export function ModernLoader({ size = "default", className }: { size?: "sm" | "default" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "w-5 h-5",
    default: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Loader2 className={cn(sizeClasses[size], "text-accent")} />
      </motion.div>
    </div>
  );
}

// Pulsing dots loader
export function DotsLoader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse" as const,
            delay: i * 0.15,
          }}
          className="w-2.5 h-2.5 rounded-full bg-accent"
        />
      ))}
    </div>
  );
}

// Skeleton with shimmer effect
export function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
    </div>
  );
}

// Card skeleton
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border p-6 space-y-4", className)}>
      <div className="flex items-start justify-between">
        <ShimmerSkeleton className="w-12 h-12 rounded-xl" />
        <ShimmerSkeleton className="w-16 h-6 rounded-md" />
      </div>
      <div className="space-y-2">
        <ShimmerSkeleton className="h-4 w-24" />
        <ShimmerSkeleton className="h-8 w-32" />
      </div>
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border">
          <ShimmerSkeleton className="w-10 h-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <ShimmerSkeleton className="h-4 w-48" />
            <ShimmerSkeleton className="h-3 w-32" />
          </div>
          <ShimmerSkeleton className="w-20 h-6 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// Full page loader
export function PageLoader({ message = "Carregando..." }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 rounded-full border-4 border-muted border-t-accent"
          />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-8 h-8 rounded-full bg-accent/20" />
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground font-medium"
        >
          {message}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

// Success checkmark animation
export function SuccessCheck({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
      className={cn(
        "w-16 h-16 rounded-full bg-success/10 flex items-center justify-center",
        className
      )}
    >
      <motion.svg
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="w-8 h-8 text-success"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <motion.path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </motion.svg>
    </motion.div>
  );
}
