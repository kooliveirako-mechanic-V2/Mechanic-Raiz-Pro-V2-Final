import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, LayoutDashboard, Wrench, DollarSign, Package, FileText } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

// Import real screenshots from the app
import dashboardImg from "@/assets/mockup/dashboard-mobile.png";
import servicosImg from "@/assets/mockup/servicos-mobile.png";
import financeiroImg from "@/assets/mockup/financeiro-mobile.png";
import estoqueImg from "@/assets/mockup/estoque-mobile.png";
import novaOsImg from "@/assets/mockup/nova-os-mobile.png";

const slides = [
  {
    id: 1,
    image: dashboardImg,
    title: "Painel Inicial",
    subtitle: "Veja tudo da sua oficina em um só lugar",
    icon: LayoutDashboard,
    color: "from-cyan-500 to-blue-600",
  },
  {
    id: 2,
    image: servicosImg,
    title: "Ordens de Serviço",
    subtitle: "Gerencie todos os serviços da oficina",
    icon: Wrench,
    color: "from-orange-500 to-amber-500",
  },
  {
    id: 3,
    image: financeiroImg,
    title: "Financeiro",
    subtitle: "Controle receitas, despesas e lucro",
    icon: DollarSign,
    color: "from-emerald-500 to-green-600",
  },
  {
    id: 4,
    image: estoqueImg,
    title: "Estoque",
    subtitle: "Controle de peças e produtos",
    icon: Package,
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: 5,
    image: novaOsImg,
    title: "Nova Ordem de Serviço",
    subtitle: "Crie uma OS em segundos",
    icon: FileText,
    color: "from-violet-500 to-purple-600",
  },
];

export function IPhoneMockupCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: "center",
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
    }, 3500);
    
    return () => clearInterval(interval);
  }, [emblaApi, isPlaying]);

  const handleMouseEnter = () => setIsPlaying(false);
  const handleMouseLeave = () => setIsPlaying(true);

  const currentSlide = slides[selectedIndex];

  return (
    <div 
      className="relative w-full py-6"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background glow - contained and not affecting text */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
        <motion.div 
          key={selectedIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`absolute inset-0 bg-gradient-to-r ${currentSlide.color} blur-[80px] opacity-15 scale-75`}
        />
      </div>
      
      {/* Title and subtitle - with solid background for visibility */}
      <div className="text-center mb-6 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-2"
          >
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r ${currentSlide.color} text-white font-bold text-base shadow-lg`}>
              <currentSlide.icon className="w-5 h-5" />
              {currentSlide.title}
            </div>
            <p className="text-white/80 text-sm font-medium drop-shadow-md">{currentSlide.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Carousel */}
      <div className="relative">
        {/* Navigation arrows - desktop */}
        <button
          onClick={scrollPrev}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white shadow-xl hover:bg-slate-50 transition-all border border-slate-200"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <button
          onClick={scrollNext}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white shadow-xl hover:bg-slate-50 transition-all border border-slate-200"
          aria-label="Próximo"
        >
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>

        {/* Carousel container */}
        <div className="overflow-hidden mx-12 md:mx-16" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, index) => (
              <div 
                key={slide.id} 
                className="flex-[0_0_100%] min-w-0 flex justify-center px-2"
              >
                <motion.div
                  animate={{
                    scale: index === selectedIndex ? 1 : 0.9,
                    opacity: index === selectedIndex ? 1 : 0.4,
                  }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  {/* Glow effect behind image - contained */}
                  <div className={`absolute -inset-2 bg-gradient-to-b ${slide.color} blur-xl opacity-20 rounded-3xl`} />
                  
                  {/* Image with border */}
                  <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-slate-900">
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-auto h-[450px] sm:h-[550px] lg:h-[650px] object-cover object-top"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dots navigation */}
      <div className="flex justify-center gap-2 sm:gap-3 mt-6 flex-wrap px-4">
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-full transition-all duration-300 ${
              index === selectedIndex 
                ? `bg-gradient-to-r ${slide.color} text-white shadow-lg scale-105` 
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <slide.icon className="w-4 h-4" />
            <span className="text-xs font-semibold hidden sm:inline">
              {slide.title}
            </span>
          </button>
        ))}
      </div>

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        viewport={{ once: true }}
        className="flex justify-center mt-6"
      >
        <div className="px-6 py-3 bg-gradient-to-r from-[#0077B6] to-[#00A8E8] rounded-full shadow-lg">
          <p className="text-white text-sm font-bold">🏍️ Motos + 🚗 Carros • {slides.length} Módulos Completos</p>
        </div>
      </motion.div>
    </div>
  );
}
