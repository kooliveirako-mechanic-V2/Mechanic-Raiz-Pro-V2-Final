import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, LayoutDashboard, Car, Wrench, Calendar, Package, FileText, DollarSign } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

// Import ORIGINAL real screenshots from the user
import dashboardImg from "@/assets/carousel/dashboard.png";
import veiculosImg from "@/assets/carousel/veiculos.png";
import servicosImg from "@/assets/carousel/servicos.png";
import agendaImg from "@/assets/carousel/agenda.png";
import estoqueImg from "@/assets/carousel/estoque.png";
import orcamentosImg from "@/assets/carousel/orcamentos.png";
import financeiroImg from "@/assets/carousel/financeiro.png";

const slides = [
  {
    id: 1,
    image: dashboardImg,
    title: "Dashboard",
    icon: LayoutDashboard,
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: 2,
    image: veiculosImg,
    title: "Veículos",
    icon: Car,
    color: "from-violet-500 to-purple-500",
  },
  {
    id: 3,
    image: servicosImg,
    title: "Ordens de Serviço",
    icon: Wrench,
    color: "from-orange-500 to-amber-500",
  },
  {
    id: 4,
    image: agendaImg,
    title: "Agenda",
    icon: Calendar,
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: 5,
    image: estoqueImg,
    title: "Estoque",
    icon: Package,
    color: "from-cyan-500 to-blue-500",
  },
  {
    id: 6,
    image: orcamentosImg,
    title: "Orçamentos",
    icon: FileText,
    color: "from-pink-500 to-rose-500",
  },
  {
    id: 7,
    image: financeiroImg,
    title: "Financeiro",
    icon: DollarSign,
    color: "from-green-500 to-emerald-500",
  }
];

export function DashboardShowcaseCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: "center",
    skipSnaps: false
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    
    emblaApi.on("select", onSelect);
    onSelect();
    
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  // Auto-play
  useEffect(() => {
    if (!emblaApi || !isPlaying) return;
    
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
    
    return () => clearInterval(interval);
  }, [emblaApi, isPlaying]);

  const handleMouseEnter = () => setIsPlaying(false);
  const handleMouseLeave = () => setIsPlaying(true);

  const currentSlide = slides[selectedIndex];

  return (
    <div 
      className="relative w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Glow Effect */}
      <div className={`absolute -inset-4 sm:-inset-8 bg-gradient-to-r ${currentSlide.color} rounded-3xl blur-3xl opacity-30 transition-all duration-700`} />
      
      {/* Main Container - FULL WIDTH */}
      <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-white/5">
          <div className="flex items-center gap-3">
            <motion.div 
              key={selectedIndex}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentSlide.color} flex items-center justify-center`}
            >
              <currentSlide.icon className="w-4 h-4 text-white" />
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.span 
                key={selectedIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-white font-semibold text-sm sm:text-base"
              >
                {currentSlide.title}
              </motion.span>
            </AnimatePresence>
          </div>
          
          {/* Navigation arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={scrollPrev}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={scrollNext}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Image Carousel - MAXIMUM SIZE */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, index) => (
              <div 
                key={slide.id} 
                className="flex-[0_0_100%] min-w-0"
              >
                <div className="relative">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-auto max-h-[70vh] object-contain"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom dots - minimal */}
        <div className="flex justify-center gap-2 py-3 bg-slate-800/50">
          {slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all duration-300 ${
                index === selectedIndex 
                  ? "bg-white/20" 
                  : "bg-transparent hover:bg-white/10"
              }`}
            >
              <slide.icon className={`w-3 h-3 ${index === selectedIndex ? "text-white" : "text-white/40"}`} />
              <span className={`text-xs hidden sm:inline ${index === selectedIndex ? "text-white" : "text-white/40"}`}>
                {slide.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Badge - Carros e Motos */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        viewport={{ once: true }}
        className="absolute -top-3 -right-3 px-4 py-2 bg-gradient-to-r from-[#0077B6] to-[#00A8E8] rounded-full shadow-lg"
      >
        <p className="text-white text-xs sm:text-sm font-bold">🏍️ Motos + 🚗 Carros</p>
      </motion.div>

      {/* Counter */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        viewport={{ once: true }}
        className="absolute -bottom-3 -left-3 px-3 py-1.5 bg-white rounded-xl shadow-xl"
      >
        <p className="text-slate-800 text-xs font-bold">{slides.length} ferramentas para organizar sua oficina</p>
      </motion.div>
    </div>
  );
}