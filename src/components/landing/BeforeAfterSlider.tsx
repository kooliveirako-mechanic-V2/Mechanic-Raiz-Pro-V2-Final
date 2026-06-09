import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { XCircle, CheckCircle2, GripVertical } from "lucide-react";

interface BeforeAfterSliderProps {
  className?: string;
}

const beforeItems = [
  "Retrabalho constante e discussões",
  "Cliente desconfiado, sem comprovação",
  "Histórico perdido em papel ou memória",
  "Não sabe quanto lucra por serviço",
  "Estoque descontrolado, peças faltando"
];

const afterItems = [
  "Fotos de entrada e saída documentadas",
  "Orçamentos profissionais com link público",
  "Histórico completo por veículo",
  "Lucro calculado automaticamente",
  "Baixa automática de estoque"
];

export function BeforeAfterSlider({ className = "" }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = () => {
    isDragging.current = true;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-[400px] sm:h-[450px] rounded-2xl overflow-hidden cursor-ew-resize select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* AFTER Side (Green - Right) - Full background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="h-full flex flex-col justify-center p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider">Com Controle</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white">Cresce</h3>
            </div>
          </div>
          <ul className="space-y-3 sm:space-y-4">
            {afterItems.map((item, index) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-3"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-sm sm:text-base text-white/95 font-medium">{item}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* BEFORE Side (Red - Left) - Clipped overlay */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-red-500 via-red-600 to-rose-700"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,0,0,0.1),transparent_50%)]" />
        <div className="h-full flex flex-col justify-center p-6 sm:p-8 md:p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <XCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider">Sem Controle</span>
              <h3 className="text-xl sm:text-2xl font-bold text-white">Sobrevive</h3>
            </div>
            {/* Badge "Você está aqui?" */}
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              viewport={{ once: true }}
              className="ml-auto px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full border border-white/30"
            >
              <span className="text-[10px] sm:text-xs font-bold text-white">Você está aqui?</span>
            </motion.div>
          </div>
          <ul className="space-y-3 sm:space-y-4">
            {beforeItems.map((item, index) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-3"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-sm sm:text-base text-white/95 font-medium">{item}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)] cursor-ew-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Handle Grip */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-16 bg-white rounded-full shadow-xl flex items-center justify-center">
          <GripVertical className="w-5 h-5 text-slate-400" />
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 w-8 -left-3.5 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-sm" />
      </div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full"
      >
        <span className="text-xs sm:text-sm text-white/90 font-medium">
          ← Arraste para comparar →
        </span>
      </motion.div>
    </div>
  );
}
