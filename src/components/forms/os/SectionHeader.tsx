import React from "react";

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  color?: string;
  step?: number;
}

export function SectionHeader({ icon: Icon, title, subtitle, color = "text-primary", step }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b border-border/60">
      <div className={`relative w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${
        color === "text-primary" ? "bg-primary/10"
        : color === "text-green-600" || color === "text-success" ? "bg-success/10"
        : color === "text-amber-600" ? "bg-amber-100 dark:bg-amber-900/30"
        : "bg-purple-100 dark:bg-purple-900/30"
      }`}>
        <Icon className={`w-5 h-5 ${color}`} />
        {typeof step === "number" && (
          <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-black flex items-center justify-center shadow-sm">
            {step}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-sm uppercase tracking-wide break-words">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground break-words leading-snug">{subtitle}</p>}
      </div>
    </div>
  );
}
