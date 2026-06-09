import { BUILD_ID, BUILD_TIMESTAMP } from "@/lib/buildVersion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Compact version indicator shown in the bottom nav area.
 * Allows both team and client to verify which build they're running.
 */
export function VersionFooter() {
  const buildDate = (() => {
    try {
      return format(new Date(BUILD_TIMESTAMP), "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "—";
    }
  })();

  return (
    <p className="text-[10px] text-muted-foreground/40 text-center py-1 select-all">
      v{BUILD_ID.slice(0, 8)} • {buildDate}
    </p>
  );
}
