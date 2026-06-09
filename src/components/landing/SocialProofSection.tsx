import { motion } from "framer-motion";
import { AnimatedCounter } from "./animations/AnimatedCounter";
import { Wrench, Car, MapPin, Star, Bike, Settings, Cog, CircleDot, Gauge, Shield } from "lucide-react";

// Workshop logos with realistic mechanic branding
const workshopLogos = [
  { 
    name: "Auto Silva", 
    city: "São Paulo",
    icon: Wrench,
    style: "bg-gradient-to-r from-slate-800 to-slate-700 border-amber-500/50"
  },
  { 
    name: "Moto Express", 
    city: "Belo Horizonte",
    icon: Bike,
    style: "bg-gradient-to-r from-red-600 to-orange-500"
  },
  { 
    name: "Garage Premium", 
    city: "Rio de Janeiro",
    icon: Settings,
    style: "bg-gradient-to-r from-zinc-900 to-zinc-700 border-yellow-400/50"
  },
  { 
    name: "JR Mecânica", 
    city: "Curitiba",
    icon: Cog,
    style: "bg-gradient-to-r from-blue-700 to-blue-500"
  },
  { 
    name: "Top Car", 
    city: "Salvador",
    icon: Car,
    style: "bg-gradient-to-r from-emerald-600 to-teal-500"
  },
  { 
    name: "Speed Moto", 
    city: "Porto Alegre",
    icon: Gauge,
    style: "bg-gradient-to-r from-orange-600 to-red-600"
  },
  { 
    name: "Força Motor", 
    city: "Recife",
    icon: CircleDot,
    style: "bg-gradient-to-r from-indigo-600 to-purple-600"
  },
  { 
    name: "Auto Center RJ", 
    city: "Niterói",
    icon: Shield,
    style: "bg-gradient-to-r from-slate-700 to-slate-600 border-sky-400/50"
  },
  { 
    name: "Oficina Central", 
    city: "Brasília",
    icon: Wrench,
    style: "bg-gradient-to-r from-amber-600 to-yellow-500"
  },
  { 
    name: "Moto Mania", 
    city: "Fortaleza",
    icon: Bike,
    style: "bg-gradient-to-r from-rose-600 to-pink-500"
  }
];

// Logo component for each workshop
function WorkshopLogo({ workshop }: { workshop: typeof workshopLogos[0] }) {
  const Icon = workshop.icon;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg ${workshop.style} border border-white/10 shadow-lg min-w-max`}>
      <div className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col">
        <span className="text-white font-bold text-sm leading-tight tracking-tight">{workshop.name}</span>
        <span className="text-white/50 text-[10px] leading-tight">{workshop.city}</span>
      </div>
    </div>
  );
}

export function SocialProofSection() {
  // Duplicate logos for seamless infinite scroll
  const duplicatedLogos = [...workshopLogos, ...workshopLogos, ...workshopLogos];

  return (
    <section 
      className="py-16 sm:py-20 md:py-28 bg-gradient-to-br from-slate-900 via-[#0E1B2A] to-slate-900 relative overflow-hidden"
      id="depoimentos"
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,119,182,0.1)_0%,_transparent_70%)]" />
      
      <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        {/* Stats counters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-block text-xs sm:text-sm font-bold text-[#00A8E8] mb-3 tracking-wide uppercase">
            Números que impressionam
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8 sm:mb-12">
            Oficinas por todo o{" "}
            <span className="bg-gradient-to-r from-[#0077B6] to-[#00A8E8] bg-clip-text text-transparent">
              Brasil
            </span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {[
              { icon: Wrench, value: 500, suffix: "+", label: "Oficinas ativas" },
              { 
                isDouble: true,
                value: 12500, 
                suffix: "+", 
                label: "Veículos cadastrados"
              },
              { icon: MapPin, value: 27, label: "Estados atendidos" },
              { icon: Star, value: 98, suffix: "%", label: "Satisfação" }
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="p-4 sm:p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-[#00A8E8]/50 transition-all duration-300"
              >
                {stat.isDouble ? (
                  <div className="flex items-center justify-center gap-1 mb-3">
                    <Car className="w-6 h-6 sm:w-8 sm:h-8 text-[#00A8E8]" />
                    <span className="text-white/40 text-lg">+</span>
                    <Bike className="w-6 h-6 sm:w-8 sm:h-8 text-[#FF7A18]" />
                  </div>
                ) : (
                  <stat.icon className="w-8 h-8 sm:w-10 sm:h-10 text-[#00A8E8] mx-auto mb-3" />
                )}
                <AnimatedCounter
                  end={stat.value}
                  suffix={stat.suffix || ""}
                  className="text-2xl sm:text-3xl md:text-4xl font-bold text-white"
                />
                <p className="text-white/60 text-xs sm:text-sm mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Workshop logos carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-white/50 text-sm mb-6">Oficinas que confiam na nossa solução</p>
          
          {/* Infinite scroll carousel - First row (left to right) */}
          <div className="relative overflow-hidden mb-4">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />
            
            <motion.div
              animate={{ x: [0, -1500] }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "linear"
              }}
              className="flex gap-4"
            >
              {duplicatedLogos.map((workshop, index) => (
                <WorkshopLogo key={`row1-${index}`} workshop={workshop} />
              ))}
            </motion.div>
          </div>

          {/* Second row (right to left) */}
          <div className="relative overflow-hidden">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-slate-900 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-slate-900 to-transparent z-10 pointer-events-none" />
            
            <motion.div
              animate={{ x: [-1500, 0] }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: "linear"
              }}
              className="flex gap-4"
            >
              {[...duplicatedLogos].reverse().map((workshop, index) => (
                <WorkshopLogo key={`row2-${index}`} workshop={workshop} />
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}