import CountUp from "react-countup";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";

interface AnimatedCounterProps {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  labelClassName?: string;
  label?: string;
}

export function AnimatedCounter({ 
  end, 
  prefix = "", 
  suffix = "",
  duration = 2.5,
  className = "",
  labelClassName = "",
  label
}: AnimatedCounterProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: "50px 0px"
  });

  return (
    <motion.div 
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="text-center"
    >
      <span className={className}>
        {prefix}
        <CountUp
          start={0}
          end={inView ? end : 0}
          duration={duration}
          separator="."
          useEasing={true}
          preserveValue={true}
        />
        {suffix}
      </span>
      {label && (
        <p className={labelClassName}>{label}</p>
      )}
    </motion.div>
  );
}

// Stats section with multiple counters
interface StatItem {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

interface StatsGridProps {
  stats: StatItem[];
  className?: string;
}

export function StatsGrid({ stats, className = "" }: StatsGridProps) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
    rootMargin: "50px 0px"
  });

  return (
    <div ref={ref} className={`grid grid-cols-2 md:grid-cols-4 gap-6 ${className}`}>
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ 
            duration: 0.6, 
            delay: index * 0.1,
            ease: [0.25, 0.46, 0.45, 0.94]
          }}
          className="text-center p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
        >
          <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2">
            {stat.prefix || ""}
            <CountUp
              start={0}
              end={inView ? stat.value : 0}
              duration={2.5}
              separator="."
              useEasing={true}
              preserveValue={true}
            />
            {stat.suffix || ""}
          </div>
          <p className="text-white/70 text-sm sm:text-base font-medium">{stat.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
