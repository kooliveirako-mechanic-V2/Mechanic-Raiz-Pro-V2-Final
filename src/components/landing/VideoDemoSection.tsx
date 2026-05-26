import { motion } from "framer-motion";
import { Play, Volume2, VolumeX } from "lucide-react";
import { useState, useRef } from "react";

export function VideoDemoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-b from-[#0E1B2A] via-[#0a1520] to-[#0E1B2A] relative overflow-hidden" id="video-demo">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,119,182,0.12)_0%,_transparent_60%)]" />
      
      <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-4">
              <Play className="w-3.5 h-3.5 text-[#00A8E8]" />
              <span className="text-xs sm:text-sm font-bold text-white/90">O DIA A DIA NA OFICINA</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3">
              Você se reconhece?{" "}
              <span className="bg-gradient-to-r from-[#00A8E8] to-[#0077B6] bg-clip-text text-transparent">
                A gente resolve.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Da bancada pro celular — controle total sem parar o serviço.
            </p>
          </motion.div>

          {/* iPhone Mockup with Video */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative mx-auto flex justify-center"
          >
            {/* Glow behind phone */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[480px] sm:w-[320px] sm:h-[560px] bg-gradient-to-b from-[#0077B6]/30 to-[#00A8E8]/20 rounded-[60px] blur-3xl" />

            {/* Phone frame */}
            <div className="relative w-[260px] sm:w-[300px] md:w-[320px]">
              {/* Phone body */}
              <div className="relative bg-black rounded-[2.5rem] sm:rounded-[3rem] p-[6px] sm:p-2 shadow-2xl shadow-black/60 border border-white/10">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] sm:w-[120px] h-[22px] sm:h-[28px] bg-black rounded-b-2xl z-20" />
                
                {/* Screen */}
                <div className="relative bg-black rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden aspect-[9/19.5]">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    loop
                    preload="metadata"
                    poster=""
                    onClick={handlePlay}
                  >
                    <source src="/videos/oficina-demo.mp4" type="video/mp4" />
                  </video>

                  {/* Play overlay */}
                  {!isPlaying && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                      onClick={handlePlay}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-[#0077B6] to-[#00A8E8] flex items-center justify-center shadow-2xl shadow-[#0077B6]/50"
                      >
                        <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white ml-1" fill="white" />
                      </motion.div>
                    </div>
                  )}

                  {/* Bottom home indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-1 bg-white/30 rounded-full z-20" />
                </div>
              </div>

              {/* Side buttons (visual detail) */}
              <div className="absolute left-[-2px] top-[100px] w-[3px] h-8 bg-gray-700 rounded-l-md" />
              <div className="absolute left-[-2px] top-[145px] w-[3px] h-14 bg-gray-700 rounded-l-md" />
              <div className="absolute left-[-2px] top-[185px] w-[3px] h-14 bg-gray-700 rounded-l-md" />
              <div className="absolute right-[-2px] top-[130px] w-[3px] h-16 bg-gray-700 rounded-r-md" />
            </div>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-8 text-xs sm:text-sm text-slate-500"
          >
            <span>✅ Sem instalar nada</span>
            <span>✅ Funciona no celular</span>
            <span>✅ Teste grátis por 14 dias</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
