import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Star, Bike, Car } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  id: number;
  name: string;
  workshop: string;
  workshopInitial: string;
  city: string;
  quote: string;
  rating: number;
  vehicleType: "moto" | "carro" | "ambos";
  logoColor: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "João Pereira",
    workshop: "Oficina São Lucas",
    workshopInitial: "SL",
    city: "São Paulo, SP",
    quote: "Depois do sistema, finalmente sei quanto minha oficina lucra por mês. Antes era tudo no escuro, agora tenho controle real.",
    rating: 5,
    vehicleType: "carro",
    logoColor: "from-blue-500 to-cyan-500"
  },
  {
    id: 2,
    name: "Carlos Ferreira",
    workshop: "Moto Express",
    workshopInitial: "ME",
    city: "Belo Horizonte, MG",
    quote: "O sistema é simples. Comecei a usar no mesmo dia. Não precisei de curso nem de ajuda. Registro tudo pelo celular mesmo.",
    rating: 5,
    vehicleType: "moto",
    logoColor: "from-orange-500 to-red-500"
  },
  {
    id: 3,
    name: "Marcos Silva",
    workshop: "Auto Elétrica Precisão",
    workshopInitial: "AP",
    city: "Campinas, SP",
    quote: "Antes eu gastava 2 horas num diagnóstico e cobrava R$ 80. Agora o sistema mostra o tempo real, sei exatamente quanto vale meu trabalho técnico. Parei de pagar pra trabalhar.",
    rating: 5,
    vehicleType: "carro",
    logoColor: "from-amber-500 to-yellow-500"
  },
  {
    id: 4,
    name: "José Santos",
    workshop: "Garage Premium",
    workshopInitial: "GP",
    city: "Rio de Janeiro, RJ",
    quote: "O checklist com fotos salvou minha pele várias vezes. Cliente reclamou de risco que já existia, mostrei a foto e pronto. Evito discussão toda semana.",
    rating: 5,
    vehicleType: "carro",
    logoColor: "from-emerald-500 to-teal-500"
  },
  {
    id: 5,
    name: "Roberto Almeida",
    workshop: "Auto Center RA",
    workshopInitial: "RA",
    city: "Curitiba, PR",
    quote: "Trabalho com carro e moto. O sistema trata igual, sem complicação. Meu lucro aumentou 30% só organizando melhor as ordens de serviço.",
    rating: 5,
    vehicleType: "ambos",
    logoColor: "from-purple-500 to-violet-500"
  },
  {
    id: 6,
    name: "Anderson Costa",
    workshop: "Eletro Car",
    workshopInitial: "EC",
    city: "Goiânia, GO",
    quote: "O histórico elétrico por veículo é ouro. Quando o cliente volta com o mesmo problema, já sei exatamente o que testei antes. Zero retrabalho.",
    rating: 5,
    vehicleType: "carro",
    logoColor: "from-yellow-500 to-amber-600"
  },
  {
    id: 7,
    name: "Paulo Henrique",
    workshop: "PH Motos",
    workshopInitial: "PH",
    city: "Salvador, BA",
    quote: "Os lembretes de manutenção fazem cliente voltar sozinho. Troca de óleo, revisão... o sistema avisa e o cliente liga. Fidelização automática.",
    rating: 5,
    vehicleType: "moto",
    logoColor: "from-rose-500 to-pink-500"
  }
];

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  // Auto-play with pause on hover
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  const currentTestimonial = testimonials[currentIndex];

  const VehicleIcon = () => {
    switch (currentTestimonial.vehicleType) {
      case "moto":
        return <Bike className="w-4 h-4 text-[#FF7A18]" />;
      case "carro":
        return <Car className="w-4 h-4 text-[#00A8E8]" />;
      case "ambos":
        return (
          <div className="flex items-center gap-1">
            <Car className="w-3.5 h-3.5 text-[#00A8E8]" />
            <span className="text-white/30">+</span>
            <Bike className="w-3.5 h-3.5 text-[#FF7A18]" />
          </div>
        );
    }
  };

  return (
    <section 
      className="py-16 sm:py-20 md:py-28 bg-gradient-to-br from-[#0E1B2A] via-[#1a3a52] to-[#0E1B2A] relative overflow-hidden"
      id="depoimentos"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,119,182,0.15)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(0,168,232,0.1)_0%,_transparent_50%)]" />
      
      <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10 sm:mb-12"
          >
            <span className="inline-block text-xs sm:text-sm font-bold text-[#00A8E8] mb-3 tracking-wide uppercase">
              Quem usa, recomenda
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white">
              Oficinas que já{" "}
              <span className="bg-gradient-to-r from-[#0077B6] to-[#00A8E8] bg-clip-text text-transparent">
                transformaram
              </span>{" "}
              sua gestão
            </h2>
          </motion.div>

          {/* Carousel */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 border border-white/10"
              >
                {/* Top row: Quote icon + Rating */}
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                  <Quote className="w-8 h-8 sm:w-10 sm:h-10 text-[#00A8E8]/40" />
                  <div className="flex items-center gap-1">
                    {[...Array(currentTestimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                </div>
                
                {/* Testimonial text */}
                <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white leading-relaxed mb-6 sm:mb-8 font-medium">
                  "{currentTestimonial.quote}"
                </p>
                
                {/* Author info with logo */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Workshop Logo */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${currentTestimonial.logoColor} flex items-center justify-center shadow-lg`}>
                      <span className="text-white font-bold text-sm sm:text-base">{currentTestimonial.workshopInitial}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base">
                        {currentTestimonial.name}
                      </h4>
                      <p className="text-white/60 text-xs sm:text-sm">
                        {currentTestimonial.workshop}
                      </p>
                      <p className="text-white/40 text-xs">
                        {currentTestimonial.city}
                      </p>
                    </div>
                  </div>
                  
                  {/* Vehicle type badge */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
                    <VehicleIcon />
                    <span className="text-white/60 text-xs font-medium">
                      {currentTestimonial.vehicleType === "moto" ? "Moto" : 
                       currentTestimonial.vehicleType === "carro" ? "Carro" : "Carro e Moto"}
                    </span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            <div className="flex justify-center gap-4 mt-6 sm:mt-8">
              <Button
                size="icon"
                onClick={prevSlide}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/30 bg-white/5 hover:bg-white/20 text-white"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
              
              {/* Dots */}
              <div className="flex items-center gap-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${
                      index === currentIndex 
                        ? "bg-[#00A8E8] w-6 sm:w-8" 
                        : "bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
              
              <Button
                size="icon"
                onClick={nextSlide}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/30 bg-white/5 hover:bg-white/20 text-white"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}