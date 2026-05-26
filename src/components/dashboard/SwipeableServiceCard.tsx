import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Car, Bike, MessageCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface SwipeableServiceCardProps {
  service: any;
  onNavigate: () => void;
  onWhatsApp?: () => void;
  onFinalize?: () => void;
  statusBadge: { label: string; className: string };
}

export function SwipeableServiceCard({
  service,
  onNavigate,
  onWhatsApp,
  onFinalize,
  statusBadge,
}: SwipeableServiceCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const swiping = useRef(false);
  const haptic = useHapticFeedback();
  const triggeredRef = useRef(false);

  const isMoto = service.veiculo?.tipo === "moto";
  const VehicleIcon = isMoto ? Bike : Car;
  const canFinalize = service.status !== "finalizado" && service.status !== "cancelado";

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    swiping.current = true;
    triggeredRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.touches[0].clientX - startX.current;
    // Left swipe = negative (WhatsApp), Right swipe limited
    if (dx < 0) {
      setSwipeX(Math.max(dx, -120));
    } else if (dx > 0 && canFinalize) {
      setSwipeX(Math.min(dx, 120));
    }
  };

  const handleTouchEnd = () => {
    swiping.current = false;
    if (swipeX < -70 && onWhatsApp) {
      haptic.medium();
      onWhatsApp();
    } else if (swipeX > 70 && onFinalize && canFinalize) {
      haptic.success();
      onFinalize();
    }
    setSwipeX(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Left action (swipe right) - Finalizar */}
      {canFinalize && (
        <div className="absolute inset-y-0 left-0 w-24 flex items-center justify-center bg-success/90 text-white">
          <div className="flex flex-col items-center gap-0.5">
            <CheckCircle className="w-5 h-5" />
            <span className="text-[9px] font-bold">Finalizar</span>
          </div>
        </div>
      )}

      {/* Right action (swipe left) - WhatsApp */}
      <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-success/90 text-white">
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle className="w-5 h-5" />
          <span className="text-[9px] font-bold">WhatsApp</span>
        </div>
      </div>

      {/* Card content */}
      <div
        className="relative bg-card transition-transform"
        style={{ transform: `translateX(${swipeX}px)`, transition: swiping.current ? 'none' : 'transform 0.3s ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (Math.abs(swipeX) < 10) onNavigate(); }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            isMoto ? "bg-accent/12" : "bg-primary/12"
          )}>
            <VehicleIcon className={cn("w-[18px] h-[18px]", isMoto ? "text-accent" : "text-primary")} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">
              {service.cliente?.nome || "Cliente"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {service.veiculo?.modelo} • {service.tipo_servico}
            </p>
          </div>
          <Badge variant="outline" className={cn(
            "text-[10px] border px-2 py-0.5 whitespace-nowrap",
            statusBadge.className
          )}>
            {statusBadge.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
