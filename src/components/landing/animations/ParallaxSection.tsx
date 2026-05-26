import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useRef, ReactNode } from "react";

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  backgroundImage?: string;
  overlayColor?: string;
  parallaxStrength?: number;
  id?: string;
}

export function ParallaxSection({ 
  children, 
  className = "", 
  backgroundImage,
  overlayColor = "rgba(14, 27, 42, 0.7)",
  parallaxStrength = 0.3,
  id
}: ParallaxSectionProps) {
  const ref = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y = useTransform(
    scrollYProgress, 
    [0, 1], 
    [`${-parallaxStrength * 100}%`, `${parallaxStrength * 100}%`]
  );

  return (
    <section 
      ref={ref} 
      id={id}
      className={`relative overflow-hidden ${className}`}
    >
      {backgroundImage && (
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={prefersReducedMotion ? {} : { y }}
        >
          <img 
            src={backgroundImage}
            alt=""
            className="w-full h-full object-cover scale-110"
            loading="lazy"
          />
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(to bottom, ${overlayColor}, ${overlayColor.replace('0.7', '0.5')}, ${overlayColor})` 
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(0,119,182,0.2)_0%,_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(0,168,232,0.15)_0%,_transparent_50%)]" />
        </motion.div>
      )}
      
      <div className="relative z-10">
        {children}
      </div>
    </section>
  );
}

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  duration?: number;
  delay?: number;
  distance?: number;
}

export function FloatingElement({ 
  children, 
  className = "",
  duration = 4,
  delay = 0,
  distance = 10
}: FloatingElementProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      animate={prefersReducedMotion ? {} : {
        y: [-distance, distance, -distance],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}
