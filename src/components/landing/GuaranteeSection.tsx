import { motion } from "framer-motion";
import { Shield, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuaranteeSectionProps {
  onScrollToSignup: () => void;
}

export function GuaranteeSection({ onScrollToSignup }: GuaranteeSectionProps) {
  return (
    <section className="py-14 sm:py-20 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 relative overflow-hidden" id="garantia">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.15)_0%,_transparent_60%)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      
      <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            {/* Shield icon */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40"
            >
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </motion.div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
              🔒 14 dias grátis. Sem cartão. Sem contrato.
            </h2>
            
            <p className="text-base sm:text-lg text-emerald-100/80 mb-6 max-w-xl mx-auto leading-relaxed">
              Se não gostar, é só não continuar. Sem multa, sem burocracia.
              <br />
              <strong className="text-white">A gente confia no produto. Você vai confiar também.</strong>
            </p>

            {/* Trust points */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-8">
              {[
                "Acesso completo por 14 dias",
                "Sem pedir cartão de crédito",
                "Cancela com 1 clique"
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                  <span className="text-sm text-white font-medium">{item}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button 
              onClick={onScrollToSignup}
              size="lg"
              className="cta-track bg-white hover:bg-slate-100 text-emerald-900 font-bold shadow-2xl shadow-black/20 px-8 py-7 text-base md:text-lg rounded-xl"
            >
              Começar meus 14 dias grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-xs text-emerald-300/60 mt-3">
              Leva 2 minutos · Sem compromisso
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
