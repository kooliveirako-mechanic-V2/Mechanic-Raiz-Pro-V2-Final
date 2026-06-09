import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RevenueLossSimulatorProps {
  onScrollToSignup: () => void;
}

export function RevenueLossSimulator({ onScrollToSignup }: RevenueLossSimulatorProps) {
  const [osPerMonth, setOsPerMonth] = useState(30);
  const [ticketMedio, setTicketMedio] = useState(300);
  const [showResult, setShowResult] = useState(false);

  // Estimate: 15% revenue lost without proper management
  const lossPercentage = 0.15;
  const monthlyRevenue = osPerMonth * ticketMedio;
  const monthlyLoss = Math.round(monthlyRevenue * lossPercentage);
  const yearlyLoss = monthlyLoss * 12;

  const handleCalculate = () => {
    setShowResult(true);
    // Track simulator interaction
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'simulator_used', {
        event_category: 'engagement',
        event_label: `os_${osPerMonth}_ticket_${ticketMedio}`,
        value: monthlyLoss,
      });
    }
  };

  return (
    <section className="py-16 sm:py-20 bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 relative overflow-hidden" id="simulador">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,122,24,0.08),_transparent_60%)]" />
      
      <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-200 rounded-full mb-4">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs sm:text-sm font-bold text-red-600">QUANTO VOCÊ ESTÁ PERDENDO?</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Se você não sabe quanto ganha,{" "}
              <span className="text-red-500">alguém tá decidindo por você</span>
            </h2>
            <p className="text-base text-slate-600">
              Sem controle, oficinas perdem em média 15% do faturamento com retrabalho, peças perdidas e cobranças no achismo.
            </p>
          </div>

          {/* Calculator Card */}
          <motion.div 
            className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              {/* OS per month */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Quantas OS você faz por mês?
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={osPerMonth}
                    onChange={(e) => { setOsPerMonth(Number(e.target.value)); setShowResult(false); }}
                    className="flex-1 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#0077B6]"
                  />
                  <span className="text-2xl font-bold text-[#0077B6] min-w-[3ch] text-right">{osPerMonth}</span>
                </div>
              </div>

              {/* Ticket médio */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Qual seu ticket médio? (R$)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={50}
                    max={2000}
                    step={50}
                    value={ticketMedio}
                    onChange={(e) => { setTicketMedio(Number(e.target.value)); setShowResult(false); }}
                    className="flex-1 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-[#FF7A18]"
                  />
                  <span className="text-2xl font-bold text-[#FF7A18] min-w-[5ch] text-right">R$ {ticketMedio}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCalculate}
              className="w-full h-12 bg-gradient-to-r from-[#0077B6] to-[#00A8E8] hover:from-[#005F8A] hover:to-[#0077B6] text-white font-bold shadow-lg mb-4"
            >
              <Calculator className="w-5 h-5 mr-2" />
              Calcular minha perda
            </Button>

            {/* Result */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="border-t border-slate-200 pt-6"
              >
                <div className="text-center mb-4">
                  <p className="text-sm text-slate-500 mb-1">Você pode estar perdendo até</p>
                  <p className="text-4xl sm:text-5xl font-black text-red-500">
                    R$ {monthlyLoss.toLocaleString('pt-BR')}
                    <span className="text-lg font-bold text-red-400">/mês</span>
                  </p>
                  <p className="text-lg text-slate-600 mt-2">
                    Isso é <strong className="text-red-500">R$ {yearlyLoss.toLocaleString('pt-BR')} por ano</strong> saindo do seu bolso.
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-emerald-700 text-center">
                    💡 Com o Mechanic Raiz Pro, oficinas recuperam em média <strong>R$ {Math.round(monthlyLoss * 0.7).toLocaleString('pt-BR')}/mês</strong> que estavam perdendo sem perceber.
                  </p>
                </div>

                <Button
                  onClick={onScrollToSignup}
                  className="cta-track w-full h-12 bg-gradient-to-r from-[#FF7A18] to-[#FF9A4D] hover:from-[#FF8A28] hover:to-[#FFAA5D] text-white font-bold shadow-lg shadow-[#FF7A18]/30"
                >
                  Parar de perder dinheiro agora
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <p className="text-xs text-slate-400 text-center mt-2">
                  14 dias grátis · Sem cartão · Cancele quando quiser
                </p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
