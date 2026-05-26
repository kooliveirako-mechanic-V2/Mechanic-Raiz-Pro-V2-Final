import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { useRef, ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  tiltStrength?: number;
}

export function TiltCard({ 
  children, 
  className = "",
  glowColor = "rgba(0, 168, 232, 0.3)",
  tiltStrength = 15
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 20, stiffness: 300 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltStrength, -tiltStrength]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltStrength, tiltStrength]), springConfig);
  
  const glowX = useSpring(useTransform(x, [-0.5, 0.5], ["0%", "100%"]), springConfig);
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], ["0%", "100%"]), springConfig);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    x.set((event.clientX - centerX) / rect.width);
    y.set((event.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={`relative ${className}`}
      style={{
        perspective: 1000,
        transformStyle: "preserve-3d"
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX: prefersReducedMotion ? 0 : rotateX,
          rotateY: prefersReducedMotion ? 0 : rotateY,
          transformStyle: "preserve-3d"
        }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${glowColor}, transparent 50%)`,
            filter: "blur(20px)"
          }}
        />
        {children}
      </motion.div>
    </motion.div>
  );
}

// Unfold Card Animation
interface UnfoldCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function UnfoldCard({ children, className = "", delay = 0 }: UnfoldCardProps) {
  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        scale: 0.8, 
        rotateX: -15,
        y: 30
      }}
      whileInView={{ 
        opacity: 1, 
        scale: 1, 
        rotateX: 0,
        y: 0
      }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ 
        scale: 1.03,
        y: -8,
        transition: { duration: 0.2 }
      }}
      className={className}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </motion.div>
  );
}

// Icon with micro-interactions
interface AnimatedIconProps {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
  containerClassName?: string;
  animation?: "bounce" | "pulse" | "wiggle" | "glow";
}

export function AnimatedIcon({ 
  icon: Icon, 
  className = "",
  containerClassName = "",
  animation = "bounce"
}: AnimatedIconProps) {
  const animations = {
    bounce: {
      y: [0, -5, 0],
      transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
    },
    pulse: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.6, repeat: Infinity, repeatDelay: 1.5 }
    },
    wiggle: {
      rotate: [0, -5, 5, -5, 0],
      transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
    },
    glow: {
      filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"],
      transition: { duration: 1.5, repeat: Infinity }
    }
  };

  return (
    <motion.div
      className={containerClassName}
      animate={animations[animation]}
      whileHover={{ scale: 1.15 }}
    >
      <Icon className={className} />
    </motion.div>
  );
}
