import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  animationType?: "word" | "character" | "line";
}

export function AnimatedText({ 
  text, 
  className = "", 
  delay = 0,
  animationType = "word" 
}: AnimatedTextProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  if (animationType === "character") {
    const characters = text.split("");
    
    return (
      <motion.span ref={ref} className={className}>
        {characters.map((char, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{
              duration: 0.3,
              delay: delay + index * 0.02,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            style={{ display: "inline-block", whiteSpace: "pre" }}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    );
  }

  if (animationType === "word") {
    const words = text.split(" ");
    
    return (
      <motion.span ref={ref} className={className}>
        {words.map((word, index) => (
          <motion.span
            key={index}
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 20, filter: "blur(10px)" }}
            transition={{
              duration: 0.4,
              delay: delay + index * 0.08,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            style={{ display: "inline-block", marginRight: "0.25em" }}
          >
            {word}
          </motion.span>
        ))}
      </motion.span>
    );
  }

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className={className}
    >
      {text}
    </motion.span>
  );
}

// Animated Gradient Text
interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  from?: string;
  to?: string;
}

export function GradientText({ 
  children, 
  className = "",
  from = "#0077B6",
  to = "#00A8E8"
}: GradientTextProps) {
  return (
    <span 
      className={`bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        textShadow: "0 0 40px rgba(0, 168, 232, 0.3)"
      }}
    >
      {children}
    </span>
  );
}

// Reveal animation wrapper
interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
}

export function Reveal({ 
  children, 
  className = "", 
  delay = 0,
  direction = "up" 
}: RevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const directionVariants = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ 
        opacity: 0, 
        ...directionVariants[direction],
        filter: "blur(10px)"
      }}
      animate={isInView ? { 
        opacity: 1, 
        y: 0, 
        x: 0,
        filter: "blur(0px)"
      } : { 
        opacity: 0, 
        ...directionVariants[direction],
        filter: "blur(10px)"
      }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
