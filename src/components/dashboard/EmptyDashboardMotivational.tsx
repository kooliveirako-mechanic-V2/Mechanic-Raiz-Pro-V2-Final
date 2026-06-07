import { Wrench, ArrowRight, TrendingUp, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OSRapidaModal } from "@/components/servicos/OSRapidaModal";
import { useModalUrl } from "@/hooks/useModalUrl";
import { motion } from "framer-motion";

export function EmptyDashboardMotivational() {
  const [osRapidaOpen, setOsRapidaOpen] = useModalUrl("os-rapida");

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-2 border-dashed border-primary/30 rounded-2xl p-5 sm:p-8 text-center"
      >
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-lg">
          <Wrench className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
        </div>
        
        <h3 className="text-lg sm:text-2xl font-bold text-foreground mb-1.5 sm:mb-2">
          Sua oficina está pronta! 💰
        </h3>
        
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md mx-auto">
          Cria sua primeira OS agora — leva menos de 30 segundos.
        </p>

        <Button
          onClick={() => setOsRapidaOpen(true)}
          size="lg"
          className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-bold shadow-lg shadow-accent/30 py-6 text-base"
        >
          <Zap className="w-5 h-5 mr-2" />
          Abrir minha primeira OS
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mt-4 text-sm text-muted-foreground">
          <span className="flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 text-accent" />
            30 segundos pra criar
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-success" />
            Veja o lucro de cada serviço
          </span>
        </div>
      </motion.div>

      <OSRapidaModal open={osRapidaOpen} onOpenChange={setOsRapidaOpen} />
    </>
  );
}
