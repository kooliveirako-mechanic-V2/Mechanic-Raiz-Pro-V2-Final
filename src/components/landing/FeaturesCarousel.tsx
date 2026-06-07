import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  FileText, 
  BarChart3, 
  DollarSign, 
  History, 
  Package, 
  Camera, 
  Smartphone,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const features = [
  { icon: CheckCircle2, title: "Checklist completo de entrada e saída", desc: "Combustível, estepe, riscos, pertences — tudo registrado. Sua oficina protegida.", color: "bg-emerald-600" },
  { icon: Users, title: "Cliente volta e você já sabe tudo", desc: "Histórico completo. Sem perguntar duas vezes. Sem correr atrás.", color: "bg-[#0077B6]" },
  { icon: FileText, title: "OS nunca mais se perde", desc: "Registro com foto, data e tudo que foi feito. Cliente reclamou? Mostra.", color: "bg-[#005F8A]" },
  { icon: BarChart3, title: "Orçamento que vira venda", desc: "Cliente recebe o link, vê o preço, aprova. Sem vai-e-volta no WhatsApp.", color: "bg-cyan-500" },
  { icon: DollarSign, title: "Acho que tá dando lucro? Acho não paga conta.", desc: "Veja qual serviço dá dinheiro e qual te faz pagar pra trabalhar.", color: "bg-emerald-500" },
  { icon: History, title: "Histórico que prova serviço", desc: "Cliente questiona? Mostra foto, data, o que foi feito. Zero discussão.", color: "bg-violet-500" },
  { icon: Package, title: "Estoque bagunçado é prejuízo escondido", desc: "Peça sumiu? Saiba quem pegou. Acabando? Sistema avisa antes de faltar.", color: "bg-amber-500" },
  { icon: Camera, title: "Foto prova tudo", desc: "Entrada, saída, antes e depois. Acabou a desculpa do cliente.", color: "bg-rose-500" },
  { icon: Smartphone, title: "Tudo no celular", desc: "Cadastra, acompanha, finaliza. Como WhatsApp, mas organizado.", color: "bg-pink-500" }
];

export function FeaturesCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const isMobile = useIsMobile();
  
  const itemsPerView = isMobile ? 1 : 3;
  const totalSlides = Math.ceil(features.length / itemsPerView);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Auto-play with pause on hover
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const visibleFeatures = features.slice(
    currentIndex * itemsPerView,
    currentIndex * itemsPerView + itemsPerView
  );

  return (
    <section 
      className="py-16 sm:py-20 md:py-28 bg-slate-50 overflow-hidden"
      id="funcionalidades"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto px-4 sm:px-6 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0E1B2A] mb-4">
            O que muda
            <br />
            <span className="bg-gradient-to-r from-[#0077B6] to-[#00A8E8] bg-clip-text text-transparent">
              no seu dia a dia.
            </span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-[#1a3a52] font-medium">
            Cada item aqui resolve um problema real da oficina.
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="relative max-w-6xl mx-auto">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
              >
                {visibleFeatures.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0, 
                      scale: index === Math.floor(itemsPerView / 2) || isMobile ? 1.05 : 1 
                    }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.08, y: -10 }}
                    className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer"
                  >
                    <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${feature.color} flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                      <feature.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h3 className="font-bold text-[#0E1B2A] text-lg sm:text-xl mb-2">{feature.title}</h3>
                    <p className="text-sm sm:text-base text-[#1a3a52] leading-relaxed">{feature.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex justify-center items-center gap-4 mt-8 sm:mt-10">
            <Button
              variant="outline"
              size="icon"
              onClick={prevSlide}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-slate-300 hover:border-[#0077B6] hover:bg-[#0077B6]/10"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
            
            {/* Dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSlides }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? "bg-[#0077B6] w-6 sm:w-8" 
                      : "bg-slate-300 hover:bg-slate-400"
                  }`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={nextSlide}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-slate-300 hover:border-[#0077B6] hover:bg-[#0077B6]/10"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
