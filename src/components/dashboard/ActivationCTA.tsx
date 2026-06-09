import { useNavigate } from "react-router-dom";
import { Wrench, Zap, ArrowRight, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalUrl } from "@/hooks/useModalUrl";
import { OSRapidaModal } from "@/components/servicos/OSRapidaModal";
import { motion } from "framer-motion";

interface ActivationCTAProps {
  /** "first_os" = has clients but no OS; "finalize_os" = has OS but none finalized */
  stage: "first_os" | "finalize_os";
  osCount?: number;
}

/**
 * Dominant activation CTA for Camada B (no OS yet) and Camada C (OS not finalized).
 * Replaces generic dashboard content with a single, unmissable call to action.
 */
export function ActivationCTA({ stage, osCount = 0 }: ActivationCTAProps) {
  const navigate = useNavigate();
  const [osRapidaOpen, setOsRapidaOpen] = useModalUrl("os-rapida");

  if (stage === "first_os") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-accent/10 via-card to-primary/5 p-5 sm:p-6"
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg shadow-accent/30">
              <Wrench className="w-7 h-7 text-accent-foreground" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                Você está a 1 passo de começar a usar de verdade
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Crie sua primeira OS agora — leva menos de 30 segundos.
              </p>
            </div>

            <Button
              onClick={() => setOsRapidaOpen(true)}
              size="lg"
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-bold py-6 text-base shadow-lg shadow-accent/25 gap-2"
            >
              <Zap className="w-5 h-5" />
              Criar minha 1ª OS
              <ArrowRight className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent" />
                30 segundos
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-success" />
                Veja o lucro de cada serviço
              </span>
            </div>
          </div>
        </motion.div>
        <OSRapidaModal open={osRapidaOpen} onOpenChange={setOsRapidaOpen} />
      </>
    );
  }

  // stage === "finalize_os"
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-success/30 bg-gradient-to-br from-success/5 via-card to-primary/5 p-4 sm:p-5"
    >
      <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
        <div className="w-12 h-12 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center shrink-0">
          <TrendingUp className="w-6 h-6 text-success" />
        </div>

        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">
            Finalize sua OS e registre o faturamento
          </h3>
          <p className="text-sm text-muted-foreground">
            {osCount === 1
              ? "Você tem 1 OS aberta. Encerre o atendimento para lançar no financeiro."
              : `Você tem ${osCount} OS abertas. Conclua a primeira para ativar seu controle financeiro.`}
          </p>
        </div>

        <Button
          onClick={() => navigate("/servicos")}
          className="bg-success hover:bg-success/90 text-success-foreground font-bold gap-2 shrink-0"
        >
          <Wrench className="w-4 h-4" />
          Ver minhas OS
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
